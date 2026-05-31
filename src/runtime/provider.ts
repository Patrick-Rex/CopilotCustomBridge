/**
 * Provider 注册模块 — 注册 CustomBridgeProvider 到 VS Code
 */

import * as vscode from 'vscode';
import { CustomBridgeProvider } from '../provider';
import * as logger from '../logger';

/**
 * 注册 LanguageModelChatProvider
 */
export function registerProvider(context: vscode.ExtensionContext): vscode.Disposable {
	logger.info('正在注册 CustomBridgeProvider...');

	const provider = vscode.lm.registerLanguageModelChatProvider(
		'copilot-custom-bridge',
		CustomBridgeProvider,
	);

	logger.info('CustomBridgeProvider 注册成功');

	// 清理时释放
	context.subscriptions.push(provider, CustomBridgeProvider);

	return provider;
}
