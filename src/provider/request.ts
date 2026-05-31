/**
 * 请求构建模块 — 构建 OpenAI Chat Completions 请求体 (Phase 2)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import type { OpenAIChatRequest, OpenAITool } from '../client/types';
import type { ThinkingEffort } from '../types';
import { DEFAULT_TEMPERATURE } from '../types';

interface BuildRequestParams {
	model: string;
	messages: OpenAIChatRequest['messages'];
	maxTokens?: number;
	temperature?: number;
	tools?: OpenAITool[];
	toolChoice?: 'auto' | 'none' | 'required';
	reasoningEffort?: ThinkingEffort;
	modelIdOverride?: string;
}

/**
 * 构建完整的 OpenAI Chat Completions 请求体
 */
export function buildChatRequest(params: BuildRequestParams): OpenAIChatRequest {
	const request: OpenAIChatRequest = {
		model: params.modelIdOverride ?? params.model,
		messages: params.messages,
		stream: true,
		temperature: params.temperature ?? DEFAULT_TEMPERATURE,
		max_tokens: params.maxTokens,
	};

	// Phase 2: 工具调用
	if (params.tools && params.tools.length > 0) {
		request.tools = params.tools;
		request.tool_choice = params.toolChoice ?? 'auto';
	}

	// Phase 2: 推理力度 (only for non-none)
	if (params.reasoningEffort && params.reasoningEffort !== 'none') {
		request.reasoning_effort = params.reasoningEffort;
	}

	return request;
}
