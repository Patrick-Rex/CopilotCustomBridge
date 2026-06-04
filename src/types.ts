/**
 * 全局类型定义 — Copilot Custom Bridge
 *
 * 所有跨模块共享的接口和类型 MUST 在此定义。
 * 不引入任何运行时依赖。
 */

// ============================================================================
// 模型能力声明（Phase 1 接受配置但忽略非文本能力）
// ============================================================================

// ============================================================================
// Thinking 推理力度枚举 (Phase 2)
// ============================================================================

export type ThinkingEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'max';

export const THINKING_EFFORT_VALUES: readonly ThinkingEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'max'] as const;

export const THINKING_EFFORT_DEFAULT: ThinkingEffort = 'none';

export const THINKING_EFFORT_PICKER_DEFAULTS: readonly ThinkingEffort[] = ['low', 'medium', 'high'] as const;

// ============================================================================
// 模型能力声明 (Phase 2 全面生效)
// ============================================================================

export interface ModelCapabilities {
	/** 工具调用能力，false=不支持, true=支持无上限, number=工具数量上限 */
	readonly toolCalling?: boolean | number;
	/** 图像输入能力 */
	readonly imageInput?: boolean;
	/** VS Code 新配置字段别名：是否支持视觉输入 */
	readonly vision?: boolean;
	/** 思考模式 */
	readonly thinking?: boolean;
	/** VS Code 模型选择器中的可选推理力度 */
	readonly supportsReasoningEffort?: readonly ThinkingEffort[];
	/** 覆盖端点级视觉代理模型 ID (Phase 2) */
	readonly visionProxy?: string;
	/** 覆盖端点级推理力度 (Phase 2) */
	readonly thinkingEffort?: ThinkingEffort;
}

// ============================================================================
// 模型配置
// ============================================================================

export interface ModelConfig {
	/** 发送给 API 的 model 字段值 */
	readonly id: string;
	/** 在模型选择器中展示的名称 */
	readonly name: string;
	/** 模型家族，默认使用 endpoint.name */
	readonly family?: string;
	/** 版本号 */
	readonly version?: string;
	/** 最大输入 token，默认 4096 */
	readonly maxInputTokens?: number;
	/** 最大输出 token，默认 4096 */
	readonly maxOutputTokens?: number;
	/** 能力声明 */
	readonly capabilities?: ModelCapabilities;
}

// ============================================================================
// 端点配置
// ============================================================================

export interface EndpointConfig {
	/** 唯一标识，用于 SecretStorage key 生成和日志 */
	readonly id: string;
	/** 显示名称，在模型选择器中作为 family 名称 */
	readonly name: string;
	/** API 基础 URL，请求时拼接 /chat/completions */
	readonly baseUrl: string;
	/** 模型列表 */
	readonly models: ModelConfig[];
	/** 额外请求头（值从 SecretStorage 获取的敏感 header 应使用 authHeader 代替） */
	readonly defaultHeaders?: Record<string, string>;
	/** 自定义认证头名称（如 X-Api-Key），Key 值自动从 SecretStorage 读取 */
	readonly authHeader?: string;
	/** 默认视觉代理模型 ID (Phase 2) */
	readonly visionProxy?: string;
	/** 默认推理力度 (Phase 2) */
	readonly defaultThinkingEffort?: ThinkingEffort;
}

// ============================================================================
// 调试模式
// ============================================================================

export type DebugMode = 'minimal' | 'metadata' | 'verbose';

// ============================================================================
// 全局桥接配置
// ============================================================================

export interface BridgeConfig {
	/** 端点列表 */
	readonly endpoints: EndpointConfig[];
	/** 全局回退 API Key（不推荐） */
	readonly apiKey?: string;
	/** 调试模式，默认 "minimal" */
	readonly debugMode?: DebugMode;
	/** 模型 ID 覆盖映射 */
	readonly modelIdOverrides?: Record<string, string>;
	/** 全局最大输出 token */
	readonly maxTokens?: number;
}

// ============================================================================
// 视觉代理类型 (Phase 2)
// ============================================================================

export interface VisionProxyConfig {
	/** 代理模型 ID */
	readonly modelId: string;
	/** 来源端点 ID */
	readonly sourceEndpointId: string;
}

export interface VisionProxyResult {
	/** 原始图片在消息中的位置索引 */
	readonly originalImageIndex: number;
	/** 视觉代理生成的文本描述 */
	readonly description: string;
	/** 代理模型 ID */
	readonly sourceModelId: string;
	/** 处理耗时 (ms) */
	readonly processingTimeMs: number;
}

// ============================================================================
// 自动探测类型 (Phase 2)
// ============================================================================

export interface AutoDetectedModel {
	/** 模型 ID（来自 API 响应） */
	readonly id: string;
	/** 能力声明 */
	readonly capabilities: ModelCapabilities;
	/** 来源端点 ID */
	readonly sourceEndpointId: string;
	/** 探测时间戳 */
	readonly detectedAt: Date;
}

export interface ModelCacheEntry {
	models: ModelConfig[];
	timestamp: number;
}

// ============================================================================
// 默认值
// ============================================================================

export const DEFAULT_MAX_INPUT_TOKENS = 4096;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_VERSION = '1.0.0';
export const DEFAULT_TEMPERATURE = 0.7;
