/**
 * 模型映射模块 — ModelConfig → vscode.LanguageModelChatInformation
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/provider.md
 */

import * as vscode from 'vscode';
import type { EndpointConfig, ModelConfig } from '../types';
import { DEFAULT_VERSION } from '../consts';

/**
 * 将 EndpointConfig + ModelConfig 映射为 VS Code 模型信息
 *
 * @param endpoint 端点配置
 * @param model 模型配置
 * @param isAvailable 模型是否可用（已设置 API Key）
 */
export function toLanguageModelChatInformation(
	endpoint: EndpointConfig,
	model: ModelConfig,
	_isAvailable: boolean,
): vscode.LanguageModelChatInformation {
	return {
		// 格式: "{endpoint.id}/{model.id}"
		id: `${endpoint.id}/${model.id}`,
		name: model.name,
		family: model.family || endpoint.name,
		version: model.version || DEFAULT_VERSION,
		maxInputTokens: model.maxInputTokens ?? 4096,
		maxOutputTokens: model.maxOutputTokens ?? 4096,
		capabilities: {
			imageInput: model.capabilities?.imageInput ?? false,
			toolCalling: model.capabilities?.toolCalling ?? false,
		},
	};
}

/**
 * 从所有端点收集可用模型列表
 *
 * @param endpoints 有效端点列表
 * @param availability 端点 → 是否可用的映射
 */
export function collectModels(
	endpoints: EndpointConfig[],
	availability: Map<string, boolean>,
): vscode.LanguageModelChatInformation[] {
	const models: vscode.LanguageModelChatInformation[] = [];

	for (const ep of endpoints) {
		const hasKey = availability.get(ep.id) ?? false;
		for (const model of ep.models) {
			models.push(toLanguageModelChatInformation(ep, model, hasKey));
		}
	}

	return models;
}
