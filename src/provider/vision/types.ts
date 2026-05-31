/**
 * 视觉类型定义 — Copilot Custom Bridge (Phase 2)
 */

export interface VisionProxyConfig {
	/** 代理模型 ID */
	readonly modelId: string;
	/** 来源端点 ID */
	readonly sourceEndpointId: string;
	/** 代理模型 API Key */
	readonly apiKey: string;
	/** 代理模型 baseUrl */
	readonly baseUrl: string;
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
