/**
 * 命令注册模块 — Set API Key / Clear API Key
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/config.md
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { COMMAND_IDS } from '../consts';
import * as logger from '../logger';

/**
 * Set API Key 命令实现
 */
async function handleSetApiKey(): Promise<void> {
	try {
		const endpoints = ConfigManager.getEndpoints();
		if (endpoints.length === 0) {
			void vscode.window.showWarningMessage('未配置任何端点，请先在 settings.json 中配置 copilot-custom-bridge.endpoints');
			return;
		}

		// 让用户选择端点
		const items = endpoints.map(ep => ({
			label: ep.name,
			description: ep.id,
			detail: ep.baseUrl,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: '选择要设置 API Key 的端点',
		});

		if (!selected) { return; } // 用户取消

		// 密码输入
		const apiKey = await vscode.window.showInputBox({
			prompt: `请输入 ${selected.label} 的 API Key`,
			password: true,
			placeHolder: 'sk-...',
			validateInput: (value: string) => {
				if (!value || value.trim().length === 0) {
					return 'API Key 不能为空';
				}
				return undefined;
			},
		});

		if (apiKey === undefined) { return; } // 用户取消

		await AuthManager.setApiKey(selected.description, apiKey);
		void vscode.window.showInformationMessage(`API Key 已设置: ${selected.label}`);
	} catch (err) {
		logger.error('Set API Key 命令失败', err);
		void vscode.window.showErrorMessage(`设置 API Key 失败: ${err instanceof Error ? err.message : '未知错误'}`);
	}
}

/**
 * Clear API Key 命令实现
 */
async function handleClearApiKey(): Promise<void> {
	try {
		const endpoints = ConfigManager.getEndpoints();
		if (endpoints.length === 0) {
			void vscode.window.showWarningMessage('未配置任何端点');
			return;
		}

		// 让用户选择端点
		const items = endpoints.map(ep => ({
			label: ep.name,
			description: ep.id,
			detail: ep.baseUrl,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: '选择要清除 API Key 的端点',
		});

		if (!selected) { return; }

		const confirmed = await vscode.window.showWarningMessage(
			`确定要清除 ${selected.label} 的 API Key 吗？`,
			{ modal: true },
			'确定',
		);

		if (confirmed !== '确定') { return; }

		await AuthManager.clearApiKey(selected.description);
		void vscode.window.showInformationMessage(`API Key 已清除: ${selected.label}`);
	} catch (err) {
		logger.error('Clear API Key 命令失败', err);
		void vscode.window.showErrorMessage(`清除 API Key 失败: ${err instanceof Error ? err.message : '未知错误'}`);
	}
}

/**
 * 注册所有命令
 */
export function registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
	return [
		vscode.commands.registerCommand(COMMAND_IDS.SET_API_KEY, handleSetApiKey),
		vscode.commands.registerCommand(COMMAND_IDS.CLEAR_API_KEY, handleClearApiKey),
	];
}
