/**
 * 模型自动探测模块 (Phase 2)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import type { ModelConfig, ModelCapabilities } from '../types';
import { AUTO_DETECT_MAX_MODELS, MODELS_PATH } from '../consts';
import type { ModelListResponse } from '../client/types';
import * as logger from '../logger';

/**
 * 从 /models 端点自动探测模型列表（混合模式：元数据优先）
 */
export async function autoDetectModels(
	baseUrl: string,
	apiKey: string,
	cancelToken?: { isCancellationRequested: boolean },
): Promise<ModelConfig[]> {
	const url = `${baseUrl.replace(/\/+$/, '')}${MODELS_PATH}`;

	const controller = new AbortController();
	if (cancelToken?.isCancellationRequested) {
		controller.abort();
	}

	const response = await fetch(url, {
		method: 'GET',
		headers: { 'Authorization': `Bearer ${apiKey}` },
		signal: controller.signal,
	});

	if (!response.ok) {
		if (response.status === 404 || response.status === 405) {
			throw new Error('AUTO_DETECT_NOT_SUPPORTED');
		}
		if (response.status === 401 || response.status === 403) {
			throw new Error('AUTO_DETECT_AUTH_FAILED');
		}
		throw new Error(`HTTP ${response.status}`);
	}

	const data = await response.json() as ModelListResponse;
	if (!data?.data || !Array.isArray(data.data)) {
		throw new Error('AUTO_DETECT_FORMAT_ERROR');
	}

	// 限制数量
	const entries = data.data.slice(0, AUTO_DETECT_MAX_MODELS);
	if (data.data.length > AUTO_DETECT_MAX_MODELS) {
		logger.warn(`模型数量超过上限 (${AUTO_DETECT_MAX_MODELS})，仅加载前 ${AUTO_DETECT_MAX_MODELS} 个`);
	}

	// 提取模型列表（混合模式：元数据优先）
	return entries.map(entry => ({
		id: entry.id,
		name: entry.id,
		family: entry.owned_by ?? 'detected',
		maxInputTokens: 4096,
		maxOutputTokens: 4096,
		capabilities: extractCapabilities(entry),
	}));
}

/**
 * 提取能力元数据（混合模式：有则提取，无则默认 false）
 */
function extractCapabilities(entry: { capabilities?: Record<string, unknown> }): ModelCapabilities {
	const caps = entry?.capabilities ?? {};
	return {
		toolCalling: (caps.toolCalling as boolean | number) ?? false,
		imageInput: (caps.imageInput as boolean) ?? false,
		thinking: (caps.thinking as boolean) ?? false,
	};
}
