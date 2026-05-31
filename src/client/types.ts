/**
 * OpenAIClient 类型定义 — Phase 2 扩展
 */

// ============================================================================
// 错误类型
// ============================================================================

export interface ClientError {
	type: 'auth' | 'rate_limit' | 'server' | 'network' | 'parse';
	statusCode?: number;
	message: string;
	raw?: unknown;
	retryable?: boolean;
}

// ============================================================================
// Token 用量
// ============================================================================

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

// ============================================================================
// OpenAI 消息类型 (Phase 2 扩展：支持 tool/thinking)
// ============================================================================

export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	/** 思考内容 (Phase 2: thinking 模式) */
	reasoning_content?: string;
	/** 工具调用 (Phase 2) */
	tool_calls?: OpenAIToolCall[];
	/** 工具调用 ID (Phase 2: role=tool 时) */
	tool_call_id?: string;
}

// ============================================================================
// 多模态 content part (Phase 2: 视觉)
// ============================================================================

export type OpenAIContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

// ============================================================================
// OpenAI 工具定义 (Phase 2)
// ============================================================================

export interface OpenAITool {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: object; // JSON Schema
	};
}

export interface OpenAIToolCall {
	id: string;
	type: 'function';
	index: number;
	function: {
		name: string;
		arguments: string;
	};
}

/** SSE 流中的 tool_calls delta */
export interface OpenAIToolCallDelta {
	index: number;
	id?: string;
	function?: {
		name?: string;
		arguments?: string;
	};
}

// ============================================================================
// 请求/响应类型 (Phase 2 扩展)
// ============================================================================

export interface OpenAIChatRequest {
	model: string;
	messages: OpenAIMessage[];
	stream?: boolean;
	temperature?: number;
	max_tokens?: number;
	tools?: OpenAITool[];
	tool_choice?: 'auto' | 'none' | 'required';
	reasoning_effort?: 'none' | 'low' | 'high' | 'max';
}

export interface OpenAIChatResponse {
	id: string;
	object: 'chat.completion';
	choices: {
		index: number;
		message: OpenAIMessage;
		finish_reason: string;
	}[];
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

// ============================================================================
// 流回调 (Phase 2 扩展)
// ============================================================================

export interface StreamCallbacks {
	onContent: (text: string) => void;
	onThinking?: (reasoning: string) => void;
	onToolCall?: (toolCall: OpenAIToolCallDelta) => void;
	onError: (error: ClientError) => void;
	onDone: (usage?: TokenUsage) => void;
	/** Phase 3: dump callback — called after stream completes with full request/response metadata */
	onDump?: (payload: StreamDumpPayload) => void;
}

/** Phase 3: dump payload passed from client to provider */
export interface StreamDumpPayload {
	requestUrl: string;
	requestHeaders: Record<string, string>;
	requestBody: unknown;
	responseStatus: number;
	responseHeaders: Record<string, string>;
	responseChunks: unknown[];
	durationMs: number;
}

// ============================================================================
// 客户端选项
// ============================================================================

export interface ClientOptions {
	defaultHeaders?: Record<string, string>;
	authHeader?: string;
	proxy?: string;
}

// ============================================================================
// /models 端点类型 (Phase 2)
// ============================================================================

export interface ModelListResponse {
	object: 'list';
	data: ModelListEntry[];
}

export interface ModelListEntry {
	id: string;
	object: 'model';
	created?: number;
	owned_by?: string;
	capabilities?: {
		toolCalling?: boolean | number;
		imageInput?: boolean;
		thinking?: boolean;
	};
}
