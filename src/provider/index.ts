/**
 * CustomBridgeProvider — 实现 vscode.LanguageModelChatProvider
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/provider.md
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { OpenAIClient } from '../client';
import type { OpenAIChatRequest, StreamCallbacks, ClientError } from '../client';
import { convertMessages, extractDataParts } from './convert';
import { estimateTotalTokens, compressAndTruncate } from './tokens';
import { collectModels, parseModelId, type ExtendedModelInfo } from './models';
import { createStreamHandler } from './stream';
import { buildChatRequest } from './request';
import { convertVSCodeToolsToOpenAI } from './tools/request';
import { findPreflightTools, getPreflightContextMessage, ToolCallLoopController } from './tools/flow';
import { resolveImageMessages } from './vision';
import { DEFAULT_TEMPERATURE } from '../types';
import * as logger from '../logger';

/**
 * CustomBridgeProvider 实现
 */
class CustomBridgeProviderImpl implements vscode.LanguageModelChatProvider {
	readonly onDidChangeLanguageModelChatInformation: vscode.Event<void>;

	private readonly _onDidChange = new vscode.EventEmitter<void>();
	private _disposables: vscode.Disposable[] = [];

	constructor() {
		this.onDidChangeLanguageModelChatInformation = this._onDidChange.event;

		// 监听配置变更
		this._disposables.push(
			ConfigManager.onDidChangeConfiguration(() => {
				this._onDidChange.fire();
			}),
		);

		// 监听 API Key 变更
		this._disposables.push(
			AuthManager.onDidChangeApiKey(() => {
				this._onDidChange.fire();
			}),
		);
	}

	/**
	 * 提供模型选择器中的模型列表 (Phase 2: 支持 agent 模式过滤)
	 */
	async provideLanguageModelChatInformation(
		options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelChatInformation[]> {
		try {
			const endpoints = ConfigManager.getEndpoints();
			if (endpoints.length === 0) {
				return [];
			}

			// 检测 agent 模式
			const opts = options as unknown as Record<string, unknown>;
			const agentMode = !!(opts?.toolCalling || opts?.tools);

			// 并行检查所有端点的 API Key 可用性
			const availability = new Map<string, boolean>();
			const checks = endpoints.map(async ep => {
				const key = await AuthManager.getApiKey(ep.id);
				availability.set(ep.id, !!key);
			});
			await Promise.all(checks);

			// Phase 2: agent 模式时过滤 toolCalling: false 的模型
			const models = collectModels(endpoints, availability, agentMode);
			logger.info(`模型列表已刷新: ${models.length} 个模型 (agentMode=${agentMode})`);
			return models;
		} catch (err) {
			logger.error('获取模型列表失败', err);
			return [];
		}
	}

	/**
	 * 处理用户发送的聊天请求
	 */
	async provideLanguageModelChatResponse(
		model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
	): Promise<void> {
		const modelId = model.id;

		try {
			// 1. 解析 modelId (Phase 2: 使用 parseModelId)
			const parsed = parseModelId(modelId);
			if (!parsed) {
				this.reportError(progress, '无效的模型 ID 格式');
				return;
			}

			const { endpointId, modelId: apiModelId } = parsed;

			// 2. 获取端点和模型配置
			const found = ConfigManager.getModelById(modelId);
			if (!found) {
				this.reportError(progress, `未找到模型配置: ${modelId}`);
				return;
			}

			// 3. Phase 2: 获取完整能力（含两级解析）
			const capabilities = ConfigManager.getModelCapability(endpointId, apiModelId);

			// 3a. Phase 2: 工具预飞 (preflight)
			let preflightContext: string | undefined;
			if (options.tools && options.tools.length > 0) {
				const preflightTools = findPreflightTools(options.tools);
				if (preflightTools.length > 0) {
					logger.info(`预热工具: ${preflightTools.length} 个`);
					// 结果由 VS Code 管理，此处仅追踪状态
				}
			}

			// 4. 获取 API Key
			const apiKey = await AuthManager.getApiKey(endpointId);
			if (!apiKey) {
				this.reportError(progress, `请先为端点 "${found.endpoint.name}" 设置 API Key（命令: Set API Key）`);
				return;
			}
		// 3b. Phase 2: 视觉处理 (T034)
		const { resolvedMessages } = await resolveImageMessages(
			messages as vscode.LanguageModelChatRequestMessage[],
			endpointId,
			apiModelId,
			capabilities.imageInput ?? false,
			token,
		);

		// 4. 消息转换
		let openaiMessages = convertMessages(resolvedMessages);
		if (openaiMessages.length === 0) {
				this.reportError(progress, '消息转换后为空');
				return;
			}

			// 5. Token 检查与压缩
			const maxInputTokens = found.model.maxInputTokens ?? 4096;
			const totalTokens = estimateTotalTokens(openaiMessages);
			if (totalTokens > maxInputTokens) {
				logger.warn(`消息超出 token 限制: ${totalTokens}/${maxInputTokens}，开始压缩`);
				openaiMessages = compressAndTruncate(openaiMessages, maxInputTokens);
			}

			// 6. 获取 Max Output Tokens
			const maxOutputTokens = ConfigManager.getMaxTokens() ?? found.model.maxOutputTokens ?? 4096;

			// 7. Phase 2: 构建请求（使用 buildChatRequest）
			const proxy = vscode.workspace.getConfiguration('http').get<string>('proxy');
			const client = new OpenAIClient(found.endpoint.baseUrl, apiKey, {
				proxy: proxy || undefined,
			});

			// 工具转换 — toolCalling: true=不限制, false=不传工具, number=上限
			const toolLimit = capabilities.toolCalling === true ? undefined
				: capabilities.toolCalling === false ? false
				: capabilities.toolCalling;
			const tools = options.tools
				? convertVSCodeToolsToOpenAI(options.tools, toolLimit)
				: undefined;

			// 推理力度
			const thinkingEffort = ConfigManager.getThinkingEffort(endpointId, apiModelId);

			// 模型 ID 覆盖
			const modelIdOverride = ConfigManager.getModelIdOverride(apiModelId);

			const request = buildChatRequest({
				model: apiModelId,
				messages: openaiMessages,
				maxTokens: maxOutputTokens,
				tools,
				reasoningEffort: thinkingEffort,
				modelIdOverride,
			});

			// Phase 2: 使用 createStreamHandler
			const streamHandler = createStreamHandler(progress);
			const callbacks: StreamCallbacks = {
				onContent: streamHandler.onContent,
				onThinking: streamHandler.onThinking,
				onToolCall: streamHandler.onToolCall,
				onError: (error: ClientError) => {
					const msg = this.formatErrorMessage(error, found.endpoint.name);
					progress.report(new vscode.LanguageModelTextPart(msg));
				},
				onDone: (_usage) => {
					streamHandler.flushToolCalls();
					streamHandler.onComplete();
				},
			};

			await client.streamChatCompletion(request, callbacks, token);
		} catch (err) {
			if (!token.isCancellationRequested) {
				logger.error('对话处理异常', err);
				this.reportError(progress, `对话失败: ${err instanceof Error ? err.message : '未知错误'}`);
			}
		}
	}

	/**
	 * Token 计数（字符近似法）
	 */
	async provideTokenCount(
		_model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken,
	): Promise<number> {
		if (typeof text === 'string') {
			return estimateTotalTokens([{ role: 'user', content: text }]);
		}
		const converted = convertMessages([text]);
		return estimateTotalTokens(converted);
	}

	/** 向对话面板报告错误消息 */
	private reportError(progress: vscode.Progress<vscode.LanguageModelResponsePart>, message: string): void {
		progress.report(new vscode.LanguageModelTextPart(`❌ ${message}`));
	}

	/** 格式化用户可见错误消息 */
	private formatErrorMessage(error: ClientError, endpointName: string): string {
		switch (error.type) {
			case 'auth':
				return `❌ API Key 无效，请重新设置（端点: ${endpointName}）`;
			case 'rate_limit':
				return `❌ 请求过于频繁，请稍后重试（端点: ${endpointName}）`;
			case 'server':
				return `❌ 服务暂时不可用（端点: ${endpointName}）`;
			case 'network':
				return `❌ 无法连接到 ${endpointName}，请检查网络和端点配置`;
			case 'parse':
				return `❌ 响应解析失败（端点: ${endpointName}）`;
			default:
				return `❌ ${error.message}`;
		}
	}

	/** 释放资源 */
	dispose(): void {
		for (const d of this._disposables) {
			d.dispose();
		}
		this._disposables = [];
		this._onDidChange.dispose();
	}
}

export const CustomBridgeProvider = new CustomBridgeProviderImpl();
