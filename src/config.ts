/**
 * ConfigManager — 读取和校验 settings.json 扩展配置
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/config.md
 */

import * as vscode from 'vscode';
import type { EndpointConfig, ModelConfig } from './types';
import { CONFIG_SECTION } from './consts';
import * as logger from './logger';

/** 端点 ID 格式校验正则 */
const ENDPOINT_ID_RE = /^[a-zA-Z0-9-]+$/;

/** 获取扩展原始配置 */
function rawConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/** 校验单个 EndpointConfig */
function validateEndpoint(ep: unknown, index: number): EndpointConfig | undefined {
	const e = ep as Record<string, unknown>;

	// id: 非空字符串，仅允许字母数字和连字符
	if (typeof e?.id !== 'string' || !e.id || !ENDPOINT_ID_RE.test(e.id)) {
		logger.warn(`端点 [${index}] 的 id 无效 (应为 /^[a-zA-Z0-9-]+$/)`, { id: e?.id });
		return undefined;
	}

	// name: 非空字符串
	if (typeof e?.name !== 'string' || !e.name) {
		logger.warn(`端点 [${index}] 的 name 无效 (应为非空字符串)`, { name: e?.name });
		return undefined;
	}

	// baseUrl: 非空字符串
	if (typeof e?.baseUrl !== 'string' || !e.baseUrl) {
		logger.warn(`端点 [${index}] 的 baseUrl 无效 (应为非空字符串)`, { baseUrl: e?.baseUrl });
		return undefined;
	}

	// 去除尾部斜杠
	const baseUrl = e.baseUrl.replace(/\/+$/, '');

	// models: 非空数组
	const models = Array.isArray(e?.models) ? e.models : [];
	if (models.length === 0) {
		logger.warn(`端点 [${index}] 的 models 为空`, { name: e.name });
		return undefined;
	}

	// 校验每个 model
	const validModels: ModelConfig[] = [];
	for (let mi = 0; mi < models.length; mi++) {
		const m = models[mi] as Record<string, unknown>;
		if (typeof m?.id !== 'string' || !m.id) {
			logger.warn(`端点 [${index}] 的 model [${mi}] id 无效`);
			continue;
		}
		if (typeof m?.name !== 'string' || !m.name) {
			logger.warn(`端点 [${index}] 的 model [${mi}] name 无效`);
			continue;
		}

		const maxInput = typeof m?.maxInputTokens === 'number' && m.maxInputTokens > 0
			? Math.floor(m.maxInputTokens) : 4096;
		const maxOutput = typeof m?.maxOutputTokens === 'number' && m.maxOutputTokens > 0
			? Math.floor(m.maxOutputTokens) : 4096;

		validModels.push({
			id: m.id as string,
			name: m.name as string,
			family: typeof m?.family === 'string' ? m.family : undefined,
			version: typeof m?.version === 'string' ? m.version : undefined,
			maxInputTokens: maxInput,
			maxOutputTokens: maxOutput,
			capabilities: m?.capabilities as ModelConfig['capabilities'],
		});
	}

	if (validModels.length === 0) {
		logger.warn(`端点 [${index}] 无有效模型，跳过`, { name: e.name });
		return undefined;
	}

	return {
		id: e.id as string,
		name: e.name as string,
		baseUrl,
		models: validModels,
		defaultHeaders: typeof e?.defaultHeaders === 'object' && e.defaultHeaders
			? e.defaultHeaders as Record<string, string>
			: undefined,
	};
}

/**
 * ConfigManager 实例（模块级单例）
 */
class ConfigManagerImpl {
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChangeConfiguration = this._onDidChange.event;
	private _subscription: vscode.Disposable | undefined;

	constructor() {
		this._subscription = vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(CONFIG_SECTION)) {
				logger.info('配置变更触发模型刷新');
				this._onDidChange.fire();
			}
		});
	}

	/** 获取所有有效端点 */
	getEndpoints(): EndpointConfig[] {
		try {
			const endpoints = rawConfig().get<unknown[]>('endpoints', []);
			if (!Array.isArray(endpoints)) {
				logger.warn('endpoints 配置不是数组');
				return [];
			}

			const valid: EndpointConfig[] = [];
			for (let i = 0; i < endpoints.length; i++) {
				const ep = validateEndpoint(endpoints[i], i);
				if (ep) {
					valid.push(ep);
				}
			}
			return valid;
		} catch (err) {
			logger.error('读取端点配置失败', err);
			return [];
		}
	}

	/** 根据完整模型 ID 查找端点和模型 */
	getModelById(fullModelId: string): { endpoint: EndpointConfig; model: ModelConfig } | undefined {
		const slashIndex = fullModelId.indexOf('/');
		if (slashIndex === -1) {
			return undefined;
		}

		const endpointId = fullModelId.substring(0, slashIndex);
		const modelId = fullModelId.substring(slashIndex + 1);

		for (const ep of this.getEndpoints()) {
			if (ep.id !== endpointId) { continue; }
			const model = ep.models.find(m => m.id === modelId);
			if (model) {
				return { endpoint: ep, model };
			}
		}
		return undefined;
	}

	/** 获取全局回退 API Key */
	getGlobalApiKey(): string | undefined {
		const key = rawConfig().get<string>('apiKey', '');
		return key || undefined;
	}

	/** 获取调试模式 */
	getDebugMode(): 'minimal' | 'metadata' | 'verbose' {
		const mode = rawConfig().get<string>('debugMode', 'minimal');
		if (mode === 'metadata' || mode === 'verbose') {
			return mode;
		}
		return 'minimal';
	}

	/** 获取模型 ID 覆盖 */
	getModelIdOverride(originalId: string): string | undefined {
		const overrides = rawConfig().get<Record<string, string>>('modelIdOverrides', {});
		return overrides?.[originalId];
	}

	/** 获取全局最大 token */
	getMaxTokens(): number {
		const tokens = rawConfig().get<number>('maxTokens', 4096);
		return tokens > 0 ? tokens : 4096;
	}

	/** 释放资源 */
	dispose(): void {
		this._subscription?.dispose();
		this._onDidChange.dispose();
	}
}

export const ConfigManager = new ConfigManagerImpl();
