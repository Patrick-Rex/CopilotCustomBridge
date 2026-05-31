/**
 * 视觉代理模型管理 — 两级配置查找 (Phase 2)
 */

import { ConfigManager } from '../../config';
import type { EndpointConfig, ModelConfig } from '../../types';

/**
 * 查找视觉代理模型配置
 * 优先级: 模型级 capabilities.visionProxy > 端点级 visionProxy > 无代理
 */
export function findVisionProxy(
	endpointId: string,
	modelId: string,
): string | undefined {
	const endpoint = ConfigManager.getEndpoints().find(ep => ep.id === endpointId);
	if (!endpoint) { return undefined; }

	const model = ConfigManager.getModels(endpointId).find(m => m.id === modelId);
	if (!model) { return undefined; }

	// 模型级覆盖
	if (model.capabilities?.visionProxy) {
		return model.capabilities.visionProxy;
	}

	// 端点级默认
	return endpoint.visionProxy;
}

/**
 * 查找视觉代理模型完整信息（含端点配置）
 */
export function resolveVisionProxyModel(
	endpointId: string,
	proxyModelId: string,
): { endpoint: EndpointConfig; model: ModelConfig } | undefined {
	const endpoint = ConfigManager.getEndpoints().find(ep => ep.id === endpointId);
	if (!endpoint) { return undefined; }

	const model = ConfigManager.getModels(endpointId).find(m => m.id === proxyModelId);
	if (!model) { return undefined; }

	// 验证代理模型本身支持 imageInput
	if (!model.capabilities?.imageInput) { return undefined; }

	return { endpoint, model };
}
