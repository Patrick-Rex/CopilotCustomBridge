/**
 * 模型映射模块 — ModelConfig → vscode.LanguageModelChatInformation (Phase 2 扩展)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import * as vscode from 'vscode';
import type { EndpointConfig, ModelConfig } from '../types';
import { DEFAULT_VERSION } from '../consts';
import * as logger from '../logger';

/** 扩展的 VS Code 模型信息（含内部元数据） */
export interface ExtendedModelInfo extends vscode.LanguageModelChatInformation {
	/** 端点 ID（内部路由用） */
	readonly _endpointId: string;
	/** 原始模型 ID（内部路由用） */
	readonly _modelId: string;
	/** 工具调用能力（agent 模式过滤用） */
	readonly _toolCalling: boolean | number;
	/** API Key 是否已配置 */
	readonly _hasApiKey: boolean;
}

/**
 * 将 EndpointConfig + ModelConfig 映射为 VS Code 模型信息 (Phase 2 扩展)
 */
export function toLanguageModelChatInformation(
	endpoint: EndpointConfig,
	model: ModelConfig,
	hasApiKey: boolean,
): ExtendedModelInfo {
	const caps = model.capabilities ?? {};

	return {
		id: `${endpoint.id}/${model.id}`,
		name: model.name,
		family: model.family || endpoint.name,
		version: model.version || DEFAULT_VERSION,
		maxInputTokens: model.maxInputTokens ?? 4096,
		maxOutputTokens: model.maxOutputTokens ?? 4096,
		capabilities: {
			imageInput: caps.imageInput ?? false,
			toolCalling: caps.toolCalling ?? false,
		},
		// Phase 2: 内部元数据
		_endpointId: endpoint.id,
		_modelId: model.id,
		_toolCalling: caps.toolCalling ?? false,
		_hasApiKey: hasApiKey,
	};
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
			const info = toLanguageModelChatInformation(ep, model, hasKey);
			// Phase 2: Agent 模式过滤 (T010a)
			if (agentMode && info._toolCalling === false) {
				logger.debug(`Agent 模式: 跳过不支持工具调用的模型 ${info.id}`);
				continue;
			}
			models.push(info);
		}
	}

	return models;
}

/**
 * Phase 2: 从完整模型 ID 提取端点 ID 和模型 ID
 */
export function parseModelId(fullModelId: string): { endpointId: string; modelId: string } | undefined {
	const slashIndex = fullModelId.indexOf('/');
	if (slashIndex === -1) { return undefined; }
	return {
		endpointId: fullModelId.substring(0, slashIndex),
		modelId: fullModelId.substring(slashIndex + 1),
	};
}
