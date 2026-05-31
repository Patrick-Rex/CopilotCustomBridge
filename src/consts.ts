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
