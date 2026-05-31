/**
 * AuthManager — 通过 VS Code SecretStorage 管理 API Key
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/config.md
 * 优先级: SecretStorage > 全局回退 apiKey
 */

import * as vscode from 'vscode';
import { STORAGE_KEY_PREFIX } from './consts';
import { ConfigManager } from './config';
import * as logger from './logger';

/** 构造 SecretStorage key */
function storageKey(endpointId: string): string {
	return `${STORAGE_KEY_PREFIX}.${endpointId}.apiKey`;
}

/**
 * AuthManager 实例（模块级单例，需在 activate() 中调用 init() 注入 context）
 */
class AuthManagerImpl {
	private _context: vscode.ExtensionContext | undefined;
	private readonly _onDidChange = new vscode.EventEmitter<{ endpointId: string }>();
	readonly onDidChangeApiKey = this._onDidChange.event;

	/** 初始化（必须在使用前调用） */
	init(context: vscode.ExtensionContext): void {
		this._context = context;
	}

	private secrets(): vscode.SecretStorage {
		if (!this._context) {
			throw new Error('AuthManager 未初始化，请先调用 init()');
		}
		return this._context.secrets;
	}

	/**
	 * 获取 API Key
	 * 优先级: SecretStorage > 全局回退
	 */
	async getApiKey(endpointId: string): Promise<string | undefined> {
		try {
			const key = await this.secrets().get(storageKey(endpointId));
			if (key) {
				logger.debug(`从 SecretStorage 读取 API Key: endpointId=${endpointId}`);
				return key;
			}

			// 回退到全局配置
			const fallback = ConfigManager.getGlobalApiKey();
			if (fallback) {
				logger.info(`使用全局回退 API Key: endpointId=${endpointId}`);
				return fallback;
			}

			logger.info(`未找到 API Key: endpointId=${endpointId}`);
			return undefined;
		} catch (err) {
			logger.error(`读取 API Key 失败: endpointId=${endpointId}`, err);
			return undefined;
		}
	}

	/**
	 * 设置 API Key
	 */
	async setApiKey(endpointId: string, apiKey: string): Promise<void> {
		if (!apiKey || apiKey.trim().length === 0) {
			throw new Error('API Key 不能为空');
		}

		try {
			await this.secrets().store(storageKey(endpointId), apiKey.trim());
			logger.info(`API Key 已存储: endpointId=${endpointId}`);
			this._onDidChange.fire({ endpointId });
		} catch (err) {
			logger.error(`存储 API Key 失败: endpointId=${endpointId}`, err);
			throw err;
		}
	}

	/**
	 * 清除 API Key
	 */
	async clearApiKey(endpointId: string): Promise<void> {
		try {
			await this.secrets().delete(storageKey(endpointId));
			logger.info(`API Key 已删除: endpointId=${endpointId}`);
			this._onDidChange.fire({ endpointId });
		} catch (err) {
			logger.error(`删除 API Key 失败: endpointId=${endpointId}`, err);
			throw err;
		}
	}

	dispose(): void {
		this._onDidChange.dispose();
	}
}

export const AuthManager = new AuthManagerImpl();
