/**
 * OpenAIClient — OpenAI 兼容 API HTTP 通信
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/client.md
 * 使用 Node.js 18+ 内置 fetch，零运行时依赖。
 */

import * as vscode from 'vscode';
import type {
	OpenAIChatRequest,
	StreamCallbacks,
	ClientOptions,
	ClientError,
	TokenUsage,
} from './types';
import { SSE_DONE, HTTP_CONFIG, RETRY_CONFIG, RATE_LIMIT_MAX_RETRIES, RATE_LIMIT_MAX_WAIT_SEC } from '../consts';
import * as logger from '../logger';

/** 指数退避延迟 */
function retryDelay(attempt: number): number {
	return Math.min(
		RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt),
		RETRY_CONFIG.MAX_DELAY_MS
	);
}

/** 判断错误是否可重试 */
function isRetryable(error: ClientError): boolean {
	return error.type === 'server' || error.type === 'network' || error.type === 'rate_limit';
}

/**
 * Phase 2: 解析 Retry-After 头（支持秒数和 HTTP-date 格式）
 */
function parseRetryAfter(header: string | null): number | null {
	if (!header) { return null; }
	// 尝试解析为秒数
	const seconds = parseInt(header, 10);
	if (!isNaN(seconds)) { return seconds; }
	// 尝试解析为 HTTP-date
	const date = new Date(header);
	if (!isNaN(date.getTime())) {
		return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
	}
	return null;
}

/** 根据 HTTP 状态码分类错误 */
function classifyError(statusCode: number, message: string): ClientError {
	if (statusCode === 401 || statusCode === 403) {
		return { type: 'auth', statusCode, message };
	}
	if (statusCode === 429) {
		return { type: 'rate_limit', statusCode, message };
	}
	if (statusCode >= 500) {
		return { type: 'server', statusCode, message };
	}
	// 4xx client errors
	return { type: 'auth', statusCode, message };
}

/**
 * SSE 行解析器 — 将 ReadableStream 转义为文本回调
 */
async function parseSSEStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	callbacks: StreamCallbacks,
	cancelToken?: vscode.CancellationToken,
): Promise<void> {
	const decoder = new TextDecoder();
	let lineBuffer = '';
	let totalUsage: TokenUsage | undefined;

	try {
		while (true) {
			// 检查取消
			if (cancelToken?.isCancellationRequested) {
				return; // 静默退出，不调用任何回调
			}

			const { done, value } = await reader.read();
			if (done) { break; }

			lineBuffer += decoder.decode(value, { stream: true });

			// 按 \n 拆分行
			const lines = lineBuffer.split('\n');
			// 最后一行可能不完整，保留到下一轮
			lineBuffer = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) { continue; }

				// [DONE] 信号
				if (trimmed === `data: ${SSE_DONE}`) {
					callbacks.onDone(totalUsage);
					return;
				}

				// data: {...} JSON 行
				if (trimmed.startsWith('data: ')) {
					try {
						const jsonStr = trimmed.slice(6);
						const chunk = JSON.parse(jsonStr) as Record<string, unknown>;

						// 提取 delta
						const choices = chunk?.choices as Array<Record<string, unknown>> | undefined;
						if (choices && choices.length > 0) {
							const delta = choices[0].delta as Record<string, unknown> | undefined;
							if (delta) {
								// delta.content
								if (delta.content && typeof delta.content === 'string') {
									callbacks.onContent(delta.content);
								}
								// Phase 2: delta.reasoning_content
								if (delta.reasoning_content && typeof delta.reasoning_content === 'string' && callbacks.onThinking) {
									callbacks.onThinking(delta.reasoning_content);
								}
								// Phase 2: delta.tool_calls
								if (delta.tool_calls && Array.isArray(delta.tool_calls) && callbacks.onToolCall) {
									for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
										callbacks.onToolCall({
											index: typeof tc.index === 'number' ? tc.index : 0,
											id: typeof tc.id === 'string' ? tc.id : undefined,
											function: tc.function as Record<string, unknown> | undefined,
										});
									}
								}
							}
						}

						// 收集 usage（最后的 chunk）
						const usage = chunk?.usage as Record<string, number> | undefined;
						if (usage && typeof usage.prompt_tokens === 'number') {
							totalUsage = {
								promptTokens: usage.prompt_tokens,
								completionTokens: usage.completion_tokens ?? 0,
								totalTokens: usage.total_tokens ?? 0,
							};
						}
					} catch {
						// JSON 解析失败，跳过该行（Phase 1 非致命）
						logger.debug('SSE JSON 解析失败', trimmed.slice(0, 100));
					}
				}
			}
		}

		// 流正常结束
		callbacks.onDone(totalUsage);
	} catch (err) {
		if (!cancelToken?.isCancellationRequested) {
			callbacks.onError({
				type: 'network',
				message: err instanceof Error ? err.message : '流读取失败',
				raw: err,
			});
		}
	}
}

/**
 * OpenAIClient 实现
 */
class OpenAIClientImpl {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly options: ClientOptions;

	constructor(baseUrl: string, apiKey: string, options: ClientOptions = {}) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.apiKey = apiKey;
		this.options = options;
	}

	/**
	 * 发起 SSE 流式聊天请求（含重试逻辑）
	 */
	async streamChatCompletion(
		request: OpenAIChatRequest,
		callbacks: StreamCallbacks,
		cancelToken?: vscode.CancellationToken,
	): Promise<void> {
		let lastError: ClientError | undefined;

		for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
			if (cancelToken?.isCancellationRequested) {
				return;
			}

			try {
				const url = `${this.baseUrl}${HTTP_CONFIG.CHAT_PATH}`;

				// 构建 fetch 选项
				const fetchInit: RequestInit & { dispatcher?: unknown } = {
					method: 'POST',
					headers: {
						'Content-Type': HTTP_CONFIG.CONTENT_TYPE,
						'Authorization': `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: request.model,
						messages: request.messages,
						stream: true,
						temperature: request.temperature ?? 0.7,
						max_tokens: request.max_tokens,
					}),
				};

				// 代理支持
				if (this.options.proxy) {
					// Phase 1: undici.ProxyAgent 需要 Node 18+ 内置 undici
					// 若不可用则静默降级（后续 Phase 可用 undici npm 包）
					logger.info(`代理已配置但 Phase 1 暂不启用: ${this.options.proxy}`);
				}

				// 创建 AbortController 用于取消
				const controller = new AbortController();
				fetchInit.signal = controller.signal;

				// 注册取消
				const cancelListener = cancelToken
					? cancelToken.onCancellationRequested(() => {
							controller.abort();
						})
					: undefined;

				try {
					const response = await fetch(url, fetchInit);

					// 非 2xx 响应
					if (!response.ok) {
						let errorBody = '';
						try {
							errorBody = await response.text();
						} catch { /* ignore */ }

						const error: ClientError = classifyError(response.status, errorBody || `HTTP ${response.status}`);
						error.retryable = isRetryable(error);

						// Phase 2: 429 特殊处理 — Retry-After 退避
						if (error.type === 'rate_limit' && attempt < RATE_LIMIT_MAX_RETRIES) {
							const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
							if (retryAfter !== null && retryAfter > RATE_LIMIT_MAX_WAIT_SEC) {
								logger.warn(`Retry-After > ${RATE_LIMIT_MAX_WAIT_SEC}s, 放弃重试`);
								callbacks.onError(error);
								return;
							}
							const delay = retryAfter !== null
								? retryAfter * 1000
								: retryDelay(attempt);
							logger.warn(`429 限速（重试 ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES}），等待 ${delay}ms`);
							lastError = error;
							await new Promise(resolve => setTimeout(resolve, delay));
							continue;
						}

						if (attempt < RETRY_CONFIG.MAX_RETRIES && isRetryable(error)) {
							logger.warn(`请求失败（可重试 ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES}）: ${error.type} ${error.statusCode}`);
							lastError = error;
							const delay = retryDelay(attempt);
							await new Promise(resolve => setTimeout(resolve, delay));
							continue;
						}

						callbacks.onError(error);
						return;
					}

					// 2xx 响应 — 解析 SSE 流
					if (!response.body) {
						callbacks.onError({ type: 'network', message: '响应体为空' });
						return;
					}

					const reader = response.body.getReader();
					await parseSSEStream(reader, callbacks, cancelToken);
					return;

				} finally {
					cancelListener?.dispose();
				}
			} catch (err) {
				if (cancelToken?.isCancellationRequested) {
					return;
				}

				const networkError: ClientError = {
					type: 'network',
					message: err instanceof Error ? err.message : '网络请求失败',
					raw: err,
				};

				if (attempt < RETRY_CONFIG.MAX_RETRIES && isRetryable(networkError)) {
					logger.warn(`网络错误（重试 ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES}）: ${networkError.message}`);
					lastError = networkError;
					const delay = retryDelay(attempt);
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}

				callbacks.onError(networkError);
				return;
			}
		}

		// 全部重试失败
		if (lastError) {
			callbacks.onError(lastError);
		}
	}

	/**
	 * Phase 2: 非流式聊天补全（视觉代理用）
	 */
	async chatCompletion(
		request: OpenAIChatRequest,
		cancelToken?: vscode.CancellationToken,
	): Promise<string> {
		const url = `${this.baseUrl}${HTTP_CONFIG.CHAT_PATH}`;

		const controller = new AbortController();
		const cancelListener = cancelToken
			? cancelToken.onCancellationRequested(() => controller.abort())
			: undefined;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': HTTP_CONFIG.CONTENT_TYPE,
					'Authorization': `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: request.model,
					messages: request.messages,
					stream: false,
					max_tokens: request.max_tokens ?? 1024,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorBody}`);
			}

			const data = await response.json() as Record<string, unknown>;
			const choices = data?.choices as Array<Record<string, unknown>> | undefined;
			if (choices && choices.length > 0) {
				const message = choices[0].message as Record<string, unknown> | undefined;
				if (message?.content && typeof message.content === 'string') {
					return message.content;
				}
			}
			throw new Error('响应中无有效内容');
		} finally {
			cancelListener?.dispose();
		}
	}

	/**
	 * Phase 2: 列出可用模型（自动探测用）
	 */
	async listModels(cancelToken?: vscode.CancellationToken): Promise<unknown> {
		const url = `${this.baseUrl}/models`;

		const controller = new AbortController();
		const cancelListener = cancelToken
			? cancelToken.onCancellationRequested(() => controller.abort())
			: undefined;

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
				},
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorBody = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorBody}`);
			}

			return await response.json();
		} finally {
			cancelListener?.dispose();
		}
	}
}

export const OpenAIClient = OpenAIClientImpl;
