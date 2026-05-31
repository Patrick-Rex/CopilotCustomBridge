/**
 * OpenAIClient 错误类型定义
 */

export interface ClientError {
	type: 'auth' | 'rate_limit' | 'server' | 'network' | 'parse';
	statusCode?: number;
	message: string;
	raw?: unknown;
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface OpenAIChatRequest {
	model: string;
	messages: OpenAIMessage[];
	stream: true;
	temperature?: number;
	max_tokens?: number;
}

export interface StreamCallbacks {
	onContent: (text: string) => void;
	onError: (error: ClientError) => void;
	onDone: (usage?: TokenUsage) => void;
}

export interface ClientOptions {
	defaultHeaders?: Record<string, string>;
	proxy?: string;
}
