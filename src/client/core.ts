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
import type { DumpPayload } from '../logger';
export type { DumpPayload };

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
): Promise<unknown[]> {
	const decoder = new TextDecoder();
	let lineBuffer = '';
	let totalUsage: TokenUsage | undefined;
	const chunks: unknown[] = []; // Phase 3: collected for dump

	try {
		while (true) {
			// 检查取消
			if (cancelToken?.isCancellationRequested) {
				return chunks; // Phase 3: return chunks for dump
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
					return chunks;
				}

				// data: {...} JSON 行
				if (trimmed.startsWith('data: ')) {
					try {
						const jsonStr = trimmed.slice(6);
						const chunk = JSON.parse(jsonStr) as Record<string, unknown>;
						chunks.push(chunk); // Phase 3: collect for dump

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
		return chunks;
	} catch (err) {
		if (!cancelToken?.isCancellationRequested) {
			callbacks.onError({
				type: 'network',
				message: err instanceof Error ? err.message : '流读取失败',
				raw: err,
			});
		}
		return chunks;
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

	/** 构建统一的请求头（defaultHeaders + 自定义 authHeader） */
	private _buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			...this.options.defaultHeaders,
			'Authorization': `Bearer ${this.apiKey}`,
		};
		if (this.options.authHeader && this.options.authHeader !== 'Authorization') {
			headers[this.options.authHeader] = this.apiKey;
		}
		return headers;
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
				const startTime = Date.now();

				// 构建请求体
				const requestBody: Record<string, unknown> = {
					model: request.model,
					messages: request.messages,
					stream: true,
					temperature: request.temperature ?? 0.7,
					max_tokens: request.max_tokens,
				};
				if (request.tools?.length) { requestBody.tools = request.tools; }
				if (request.tool_choice) { requestBody.tool_choice = request.tool_choice; }
				if (request.reasoning_effort && request.reasoning_effort !== 'none') {
					requestBody.reasoning_effort = request.reasoning_effort;
				}
				const bodyJson = JSON.stringify(requestBody);

			// 构建 fetch 选项（合并端点级 defaultHeaders + 自定义认证头）
			const mergedHeaders: Record<string, string> = {
				...this.options.defaultHeaders,
				'Content-Type': HTTP_CONFIG.CONTENT_TYPE,
				'Authorization': `Bearer ${this.apiKey}`,
			};
			if (this.options.authHeader && this.options.authHeader !== 'Authorization') {
				mergedHeaders[this.options.authHeader] = this.apiKey;
			}
				const fetchInit: RequestInit & { dispatcher?: unknown } = {
					method: 'POST',
					headers: mergedHeaders,
					body: bodyJson,
				};

				// Phase 3: verbose 模式输出等效 curl 命令（API Key 已脱敏）
				logger.debug(`>>> 请求 URL: ${url}`);
				logger.debug(`>>> 请求体: ${bodyJson.slice(0, 500)}`);
				logger.debug(`>>> curl 等效命令: curl '${url}' -H 'Content-Type: ${mergedHeaders['Content-Type']}' -H 'Authorization: Bearer <API_KEY>' -d '${bodyJson.replace(/'/g, "\\'")}'`);

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

					// T010: 采集响应元数据
					const responseStatus = response.status;
					const responseHeaders: Record<string, string> = {};
					response.headers.forEach((value, key) => {
						responseHeaders[key] = value;
					});

					// 非 2xx 响应
					if (!response.ok) {
						let errorBody = '';
						try {
							errorBody = await response.text();
						} catch { /* ignore */ }

						// Phase 3: dump on error too
						if (callbacks.onDump) {
							callbacks.onDump({
								requestUrl: url,
								requestHeaders: fetchInit.headers as Record<string, string>,
								requestBody,
								responseStatus,
								responseHeaders,
								responseChunks: [{ error: errorBody }],
								durationMs: Date.now() - startTime,
							});
						}

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
					const chunks = await parseSSEStream(reader, callbacks, cancelToken);

					// Phase 3: dump after successful stream
					if (callbacks.onDump) {
						callbacks.onDump({
							requestUrl: url,
							requestHeaders: fetchInit.headers as Record<string, string>,
							requestBody,
							responseStatus,
							responseHeaders,
							responseChunks: chunks,
							durationMs: Date.now() - startTime,
						});
					}
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
				headers: this._buildHeaders(),
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
				headers: this._buildHeaders(),
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
