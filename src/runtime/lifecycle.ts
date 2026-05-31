/**
 * 扩展生命周期管理 — activate / deactivate
 *
 * docs/design/architecture.md 中 runtime/ 职责：
 * 扩展生命周期、命令注册、Provider 注册、欢迎引导
 */

import * as vscode from 'vscode';
import { ConfigManager } from '../config';
import { AuthManager } from '../auth';
import { registerCommands } from './commands';
import { registerProvider } from './provider';
import { setDebugMode, dispose as disposeLogger } from '../logger';
import * as logger from '../logger';

/**
 * 扩展激活入口
 */
export function activate(context: vscode.ExtensionContext): void {
	try {
		// 初始化 AuthManager（注入 ExtensionContext）
		AuthManager.init(context);

		// 设置日志级别
		const debugMode = ConfigManager.getDebugMode();
		setDebugMode(debugMode);
		logger.info(`Copilot Custom Bridge 启动 (debugMode=${debugMode})`);

		// 注册命令
		const cmdDisposables = registerCommands(context);
		context.subscriptions.push(...cmdDisposables);
		logger.info('命令已注册');

		// 注册 LanguageModelChatProvider
		registerProvider(context);

		// 清理
		context.subscriptions.push({
			dispose: () => {
				ConfigManager.dispose();
				AuthManager.dispose();
				disposeLogger();
			},
		});

		logger.info('Copilot Custom Bridge 启动完成');
	} catch (err) {
		logger.error('启动失败', err);
		void vscode.window.showErrorMessage(`Copilot Custom Bridge 启动失败: ${err instanceof Error ? err.message : '未知错误'}`);
	}
}

/**
 * 扩展停用入口
 */
export function deactivate(): void {
	logger.info('Copilot Custom Bridge 已停止');
	disposeLogger();
}
