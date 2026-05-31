/**
 * 全局类型定义 — Copilot Custom Bridge
 *
 * 所有跨模块共享的接口和类型 MUST 在此定义。
 * 不引入任何运行时依赖。
 */

// ============================================================================
// 模型能力声明（Phase 1 接受配置但忽略非文本能力）
// ============================================================================

export interface ModelCapabilities {
	/** 工具调用能力，boolean 或版本号（Phase 1 忽略） */
	readonly toolCalling?: boolean | number;
	/** 图像输入能力（Phase 1 忽略） */
	readonly imageInput?: boolean;
	/** 思考模式（Phase 1 忽略） */
	readonly thinking?: boolean;
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
	/** 额外请求头（Phase 1 接受但暂不实现发送） */
	readonly defaultHeaders?: Record<string, string>;
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
// 默认值
// ============================================================================

export const DEFAULT_MAX_INPUT_TOKENS = 4096;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const DEFAULT_VERSION = '1.0.0';
export const DEFAULT_TEMPERATURE = 0.7;
