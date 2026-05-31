/**
 * ConfigManager — 读取和校验 settings.json 扩展配置
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/config.md
 */

import * as vscode from 'vscode';
import type { EndpointConfig, ModelConfig, ModelCapabilities, ThinkingEffort, ModelCacheEntry } from './types';
import { THINKING_EFFORT_DEFAULT } from './types';
import { CONFIG_SECTION } from './consts';
import * as logger from './logger';

/** 端点 ID 格式校验正则 */
const ENDPOINT_ID_RE = /^[a-zA-Z0-9-]+$/;

/** 获取扩展原始配置 */
function rawConfig(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/** 规范化用户配置的能力字段（兼容 toolCalls→toolCalling 等别名） */
function normalizeCapabilities(raw: Record<string, unknown> | undefined): ModelConfig['capabilities'] {
	if (!raw || typeof raw !== 'object') { return undefined; }
	const caps: Record<string, unknown> = { ...raw };

	// 兼容别名: toolCalls → toolCalling
	if ('toolCalls' in caps && !('toolCalling' in caps)) {
		caps.toolCalling = caps.toolCalls;
	}
	// 过滤掉不支持的能力字段
	delete caps.toolCalls;
	delete caps.streaming;

	return caps as ModelConfig['capabilities'];
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

	// URL 有效性检查 (Phase 2)
	try {
		new URL(baseUrl);
	} catch {
		logger.warn(`端点 [${index}] 的 baseUrl 格式无效`, { baseUrl: e.baseUrl });
		return undefined;
	}

	// models: 数组（Phase 2: 允许为空，配合自动探测）
	const models = Array.isArray(e?.models) ? e.models : [];

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
			capabilities: normalizeCapabilities(m?.capabilities as Record<string, unknown> | undefined),
		});
	}

	if (validModels.length === 0) {
		// Phase 2: 允许空 models（用于自动探测），但记录警告
		logger.warn(`端点 [${index}] 无有效模型（可能使用自动探测补充）`, { name: e.name });
	}

	return {
		id: e.id as string,
		name: e.name as string,
		baseUrl,
		models: validModels,
		defaultHeaders: typeof e?.defaultHeaders === 'object' && e.defaultHeaders
			? e.defaultHeaders as Record<string, string>
			: undefined,		authHeader: typeof e?.authHeader === 'string' ? e.authHeader : undefined,		visionProxy: typeof e?.visionProxy === 'string' ? e.visionProxy : undefined,
		defaultThinkingEffort: typeof e?.defaultThinkingEffort === 'string'
			? e.defaultThinkingEffort as ThinkingEffort
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
				// Phase 2: endpoints 变更时清除探测缓存
				if (e.affectsConfiguration(`${CONFIG_SECTION}.endpoints`)) {
					this.clearAllDetectedCache();
				}
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
			const seenIds = new Set<string>(); // Phase 2: ID 唯一性检查
			for (let i = 0; i < endpoints.length; i++) {
				const ep = validateEndpoint(endpoints[i], i);
				if (!ep) { continue; }
				// Phase 2: 检查重复 ID
				if (seenIds.has(ep.id)) {
					logger.warn(`端点 ID 重复: ${ep.id}，保留第一个`);
					continue;
				}
				seenIds.add(ep.id);
				valid.push(ep);
			}
			return valid;
		} catch (err) {
			logger.error('读取端点配置失败', err);
			return [];
		}
	}

	/** 根据完整模型 ID 查找端点和模型（支持 __ 分隔符） */
	getModelById(fullModelId: string): { endpoint: EndpointConfig; model: ModelConfig } | undefined {
		const sepIndex = fullModelId.indexOf('__');
		if (sepIndex === -1) {
			return undefined;
		}

		const endpointId = fullModelId.substring(0, sepIndex);
		const modelId = fullModelId.substring(sepIndex + 2);

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

	// ============================================================================
	// Phase 2: 两级能力解析
	// ============================================================================

	/** 获取指定端点的模型列表（合并自动探测结果） */
	getModels(endpointId: string): ModelConfig[] {
		const endpoint = this.getEndpoints().find(ep => ep.id === endpointId);
		if (!endpoint) { return []; }
		// 合并手动配置 + 探测缓存
		const detected = this._detectedCache.get(endpointId);
		if (!detected) { return endpoint.models; }
		return this.mergeModels(endpoint.models, detected.models);
	}

	/** 获取指定模型的完整能力（合并端点默认值 + 模型覆盖值） */
	getModelCapability(endpointId: string, modelId: string): ModelCapabilities {
		const endpoint = this.getEndpoints().find(ep => ep.id === endpointId);
		if (!endpoint) {
			return { toolCalling: false, imageInput: false, thinking: false };
		}
		const model = this.getModels(endpointId).find(m => m.id === modelId);
		return model?.capabilities ?? { toolCalling: false, imageInput: false, thinking: false };
	}

	/** 获取视觉代理模型 ID（模型级 > 端点级 > 无） */
	getVisionProxy(endpointId: string, modelId: string): string | undefined {
		const endpoint = this.getEndpoints().find(ep => ep.id === endpointId);
		if (!endpoint) { return undefined; }
		const model = this.getModels(endpointId).find(m => m.id === modelId);
		return model?.capabilities?.visionProxy ?? endpoint.visionProxy;
	}

	/** 获取推理力度（模型级 > 端点级 > 默认 none） */
	getThinkingEffort(endpointId: string, modelId: string): ThinkingEffort {
		const endpoint = this.getEndpoints().find(ep => ep.id === endpointId);
		if (!endpoint) { return THINKING_EFFORT_DEFAULT; }
		const model = this.getModels(endpointId).find(m => m.id === modelId);
		return model?.capabilities?.thinkingEffort
			?? endpoint.defaultThinkingEffort
			?? THINKING_EFFORT_DEFAULT;
	}

	// ============================================================================
	// Phase 2: 模型合并与探测缓存 (T006, T012, T048, T052)
	// ============================================================================

	private _detectedCache = new Map<string, ModelCacheEntry>();

	/** 合并手动配置与探测结果（手动优先） */
	mergeModels(manual: ModelConfig[], detected: ModelConfig[]): ModelConfig[] {
		const manualIds = new Set(manual.map(m => m.id));
		const merged = [...manual];
		for (const dm of detected) {
			if (!manualIds.has(dm.id)) {
				merged.push(dm);
			}
		}
		return merged;
	}

	/** 存储探测结果缓存 */
	setDetectedModels(endpointId: string, models: ModelConfig[]): void {
		this._detectedCache.set(endpointId, { models, timestamp: Date.now() });
		logger.info(`探测结果已缓存: endpointId=${endpointId}, count=${models.length}`);
	}

	/** 获取探测结果缓存 */
	getDetectedModels(endpointId: string): ModelCacheEntry | undefined {
		return this._detectedCache.get(endpointId);
	}

	/** 清除指定端点的探测缓存 */
	clearDetectedCache(endpointId: string): void {
		this._detectedCache.delete(endpointId);
	}

	/** 清除所有探测缓存 */
	clearAllDetectedCache(): void {
		this._detectedCache.clear();
	}

	/** 释放资源 */
	dispose(): void {
		this._subscription?.dispose();
		this._onDidChange.dispose();
		this._detectedCache.clear();
	}
}

export const ConfigManager = new ConfigManagerImpl();
