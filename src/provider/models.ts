/**
 * 模型映射模块 — ModelConfig → vscode.LanguageModelChatInformation (Phase 2 扩展)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 *
 * NOTE: Copilot Chat 对模型对象有严格的字段解析，非标准字段可能被拒绝。
 * 路由信息（endpointId / modelId）通过 ModelRouter Map 存储，不嵌入模型对象。
 */

import * as vscode from 'vscode';
import type { EndpointConfig, ModelConfig } from '../types';
import { DEFAULT_VERSION } from '../consts';
import * as logger from '../logger';

/** 模型路由信息：模型 ID → 端点/模型映射 */
class ModelRouter {
	private readonly _map = new Map<string, { endpointId: string; modelId: string }>();

	set(modelId: string, endpointId: string, apiModelId: string): void {
		this._map.set(modelId, { endpointId, modelId: apiModelId });
	}

	get(modelId: string): { endpointId: string; modelId: string } | undefined {
		return this._map.get(modelId);
	}
}

/** 全局路由表 */
export const modelRouter = new ModelRouter();

/**
 * 将 EndpointConfig + ModelConfig 映射为 VS Code 模型信息
 *
 * 仅返回 VS Code 标准字段 + isUserSelectable/statusIcon（Copilot Chat 非公开字段）。
 * 路由信息存入 modelRouter，不混入模型对象。
 */
export function toLanguageModelChatInformation(
	endpoint: EndpointConfig,
	model: ModelConfig,
	hasApiKey: boolean,
): vscode.LanguageModelChatInformation {
	const caps = model.capabilities ?? {};
	const modelId = `${endpoint.id}__${model.id}`;

	// 注册路由信息
	modelRouter.set(modelId, endpoint.id, model.id);

	return {
		id: modelId,
		name: model.name,
		family: 'copilot-custom-bridge',
		version: model.version || DEFAULT_VERSION,
		detail: hasApiKey ? `${endpoint.name} / ${model.name}` : '⚠️ 请先设置 API Key',
		tooltip: hasApiKey ? undefined : '未配置 API Key，模型不可用',
		maxInputTokens: model.maxInputTokens ?? 4096,
		maxOutputTokens: model.maxOutputTokens ?? 4096,
		isUserSelectable: true,
		statusIcon: hasApiKey ? undefined : new vscode.ThemeIcon('warning'),
		capabilities: {
			imageInput: caps.imageInput ?? false,
			toolCalling: caps.toolCalling ?? false,
		},
	} as vscode.LanguageModelChatInformation & { isUserSelectable: boolean; statusIcon?: vscode.ThemeIcon };
}

/**
 * 从所有端点收集可用模型列表 (Phase 2: 含 agent 模式过滤)
 *
 * @param endpoints 有效端点列表
 * @param availability 端点 → 是否可用的映射
 * @param agentMode 是否为 agent 模式（过滤 toolCalling: false 的模型）
 */
export function collectModels(
	endpoints: EndpointConfig[],
	availability: Map<string, boolean>,
	agentMode = false,
): vscode.LanguageModelChatInformation[] {
	const models: vscode.LanguageModelChatInformation[] = [];

	for (const ep of endpoints) {
		const hasKey = availability.get(ep.id) ?? false;
		for (const model of ep.models) {
			const caps = model.capabilities ?? {};
			const toolCalling = caps.toolCalling ?? false;
			// Agent 模式过滤
			if (agentMode && toolCalling === false) {
				logger.debug(`Agent 模式: 跳过不支持工具调用的模型 ${ep.id}/${model.id}`);
				continue;
			}
			models.push(toLanguageModelChatInformation(ep, model, hasKey));
		}
	}
	return models;
}

/**
 * 从模型 ID 提取端点 ID 和模型 ID（优先使用 modelRouter 查找）
 */
export function parseModelId(fullModelId: string): { endpointId: string; modelId: string } | undefined {
	// 优先查路由表
	const routed = modelRouter.get(fullModelId);
	if (routed) { return routed; }
	// 回退：按 __ 分隔符解析
	const sepIndex = fullModelId.indexOf('__');
	if (sepIndex === -1) { return undefined; }
	return {
		endpointId: fullModelId.substring(0, sepIndex),
		modelId: fullModelId.substring(sepIndex + 2),
	};
}
