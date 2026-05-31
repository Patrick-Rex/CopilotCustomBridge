/**
 * Provider 注册模块 — 注册 CustomBridgeProvider 到 VS Code
 */

import * as vscode from 'vscode';
import { CustomBridgeProvider } from '../provider';
import * as logger from '../logger';

/**
 * 注册 LanguageModelChatProvider
 *
 * 参考 deepseek-v4-for-copilot：注册后先激活 Copilot Chat 再刷新模型选择器，
 * 确保模型立即出现在 Copilot Chat 的模型下拉列表中。
 */
export async function registerProvider(context: vscode.ExtensionContext): Promise<vscode.Disposable> {
	logger.info('正在注册 CustomBridgeProvider...');

	const provider = vscode.lm.registerLanguageModelChatProvider(
		'copilot-custom-bridge',
		CustomBridgeProvider,
	);

	logger.info('CustomBridgeProvider 注册成功');

	// 清理时释放
	context.subscriptions.push(provider, CustomBridgeProvider);

	// 主动激活 Copilot Chat 并刷新模型选择器
	await activateCopilotChat();
	CustomBridgeProvider.refreshModelPicker();

	return provider;
}

/** 确保 Copilot Chat 已激活，以便模型选择器能够立即拉取模型列表 */
async function activateCopilotChat(): Promise<void> {
	try {
		await vscode.extensions.getExtension('github.copilot-chat')?.activate();
	} catch (error) {
		logger.warn('Copilot Chat 激活不可用；模型选择器刷新可能延迟', error);
	}
}
