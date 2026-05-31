/**
 * 命令注册模块 — Set API Key / Clear API Key
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/config.md
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { COMMAND_IDS } from '../consts';
import { autoDetectModels } from '../provider/detect';
import * as logger from '../logger';
import { getDumpDirectoryUri } from '../logger';
import { getI18nString } from '../i18n';

/**
 * Set API Key 命令实现
 */
async function handleSetApiKey(): Promise<void> {
	try {
		const endpoints = ConfigManager.getEndpoints();
		if (endpoints.length === 0) {
			void vscode.window.showWarningMessage(getI18nString('NO_ENDPOINT_CONFIGURED'));
			return;
		}

		// 让用户选择端点
		const items = endpoints.map(ep => ({
			label: ep.name,
			description: ep.id,
			detail: ep.baseUrl,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: getI18nString('ENDPOINT_SELECT_PLACEHOLDER'),
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
		// Phase 3: trigger Walkthrough completion event (C1 fix)
		await vscode.commands.executeCommand('setContext', 'copilot-custom-bridge:apiKeySet', true);
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
 * Auto-detect Models 命令实现 (Phase 2)
 */
async function handleDetectModels(): Promise<void> {
	try {
		const endpoints = ConfigManager.getEndpoints();
		if (endpoints.length === 0) {
			void vscode.window.showWarningMessage('未配置任何端点');
			return;
		}

		const items = endpoints.map(ep => ({
			label: ep.name,
			description: ep.id,
			detail: ep.baseUrl,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: '选择要探测模型的端点',
		});

		if (!selected) { return; }

		const apiKey = await AuthManager.getApiKey(selected.description);
		if (!apiKey) {
			void vscode.window.showErrorMessage('请先为此端点设置 API Key');
			return;
		}

		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `正在探测 ${selected.label} 的模型...`,
			cancellable: true,
		}, async (progress, cancelToken) => {
			try {
				const endpoint = endpoints.find(ep => ep.id === selected.description)!;
				const detected = await autoDetectModels(endpoint.baseUrl, apiKey, cancelToken);
				ConfigManager.setDetectedModels(selected.description, detected);
				void vscode.window.showInformationMessage(
					`模型探测完成: ${selected.label} (${detected.length} 个模型)`
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : '未知错误';
				if (msg === 'AUTO_DETECT_NOT_SUPPORTED') {
					void vscode.window.showWarningMessage('该端点不支持模型自动探测，请手动配置模型列表');
				} else if (msg === 'AUTO_DETECT_AUTH_FAILED') {
					void vscode.window.showErrorMessage('API Key 无效或无权限');
				} else if (msg === 'AUTO_DETECT_FORMAT_ERROR') {
					void vscode.window.showErrorMessage('端点返回格式不符合预期');
				} else {
					void vscode.window.showErrorMessage(`探测失败: ${msg}`);
				}
				logger.error('模型探测失败', err);
			}
		});
	} catch (err) {
		logger.error('Auto-detect Models 命令失败', err);
	}
}

/**
 * T014: Open Dump Directory 命令实现 (Phase 3)
 */
async function handleOpenDumpDirectory(): Promise<void> {
	try {
		const uri = getDumpDirectoryUri();
		if (!uri) {
			void vscode.window.showErrorMessage(getI18nString('DUMP_OPEN_FAILED'));
			return;
		}
		await vscode.env.openExternal(uri);
	} catch (err) {
		logger.error('Open Dump Directory 命令失败', err);
		void vscode.window.showErrorMessage(getI18nString('DUMP_OPEN_FAILED'));
	}
}

/**
 * T027: Getting Started 命令实现 (Phase 3)
 */
async function handleGettingStarted(): Promise<void> {
	try {
		await vscode.commands.executeCommand(
			'workbench.action.openWalkthrough',
			'copilot-custom-bridge#copilot-custom-bridge.getting-started'
		);
	} catch (err) {
		logger.error('Getting Started 命令失败', err);
		void vscode.window.showErrorMessage(getI18nString('WALKTHROUGH_OPEN_FAILED'));
	}
}

/**
 * 注册所有命令
 */
export function registerCommands(_context: vscode.ExtensionContext): vscode.Disposable[] {
	// Phase 3: 初始化上下文 keys (C2 fix)
	const hasEndpoints = ConfigManager.getEndpoints().length > 0;
	void vscode.commands.executeCommand('setContext', 'copilot-custom-bridge:endpointsConfigured', hasEndpoints);

	return [
		vscode.commands.registerCommand(COMMAND_IDS.SET_API_KEY, handleSetApiKey),
		vscode.commands.registerCommand(COMMAND_IDS.CLEAR_API_KEY, handleClearApiKey),
		vscode.commands.registerCommand(COMMAND_IDS.DETECT_MODELS, handleDetectModels),
		vscode.commands.registerCommand('copilot-custom-bridge.openDumpDirectory', handleOpenDumpDirectory),
		vscode.commands.registerCommand('copilot-custom-bridge.gettingStarted', handleGettingStarted),
	];
}
