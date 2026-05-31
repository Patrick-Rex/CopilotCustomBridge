/**
 * 全局常量定义 — Copilot Custom Bridge
 */

/** 扩展 vendor 标识 */
export const VENDOR = 'copilot-custom-bridge';

/** 扩展 ID */
export const EXTENSION_ID = 'copilot-custom-bridge';

/** SecretStorage key 前缀（格式: bridge.{endpointId}.apiKey） */
export const STORAGE_KEY_PREFIX = 'bridge';

/** 配置节名称 */
export const CONFIG_SECTION = 'copilot-custom-bridge';

/** 命令 ID */
export const COMMAND_IDS = {
	SET_API_KEY: 'copilot-custom-bridge.setApiKey',
	CLEAR_API_KEY: 'copilot-custom-bridge.clearApiKey',
	DETECT_MODELS: 'copilot-custom-bridge.detectModels',
} as const;

/** 重试配置 */
export const RETRY_CONFIG = {
	/** 最大重试次数 */
	MAX_RETRIES: 3,
	/** 指数退避基础延迟 (ms) */
	BASE_DELAY_MS: 1000,
	/** 最大延迟 (ms) */
	MAX_DELAY_MS: 10000,
	/** 可重试状态码 */
	RETRYABLE_STATUS_CODES: new Set([500, 502, 503, 504]),
} as const;

/** HTTP 请求配置 */
export const HTTP_CONFIG = {
	/** 请求超时 (ms) */
	TIMEOUT_MS: 30000,
	/** Content-Type */
	CONTENT_TYPE: 'application/json',
	/** Chat Completions 端点后缀 */
	CHAT_PATH: '/chat/completions',
} as const;

/** SSE 信号 */
export const SSE_DONE = '[DONE]';

/** 默认 version */
export const DEFAULT_VERSION = '1.0.0';

// ============================================================================
// Phase 2: 工具调用常量
// ============================================================================

/** activate_ 预热工具前缀 */
export const PREFLIGHT_TOOL_PREFIX = 'activate_';

/** 默认工具数量上限（capabilities.toolCalling 未指定数字时） */
export const DEFAULT_MAX_TOOLS = 128;

/** 工具调用最大循环轮次 (Phase 2 硬编码，不可配置) */
export const MAX_TOOL_CALL_ROUNDS = 10;

// ============================================================================
// Phase 2: 模型自动探测常量
// ============================================================================

/** 自动探测模型数量上限 */
export const AUTO_DETECT_MAX_MODELS = 100;

/** 自动探测缓存 TTL (ms) — 30 分钟 */
export const AUTO_DETECT_CACHE_TTL_MS = 30 * 60 * 1000;

/** /models 端点路径 */
export const MODELS_PATH = '/models';

// ============================================================================
// Phase 2: 429 退避常量
// ============================================================================

/** 429 最大重试次数 */
export const RATE_LIMIT_MAX_RETRIES = 3;

/** Retry-After 最大等待时间 (秒) */
export const RATE_LIMIT_MAX_WAIT_SEC = 60;

// ============================================================================
// Phase 2: Thinking 常量
// ============================================================================

/** 推理力度取值 */
export const THINKING_EFFORT_VALUES = ['none', 'low', 'high', 'max'] as const;

/** 默认推理力度 */
export const THINKING_EFFORT_DEFAULT = 'none';

// ============================================================================
// Phase 2: 视觉代理常量
// ============================================================================

/** 视觉代理提示语 */
export const VISION_PROXY_PROMPT = 'Describe this image in detail.';

/** 视觉代理请求超时 (ms) */
export const VISION_PROXY_TIMEOUT_MS = 15000;
