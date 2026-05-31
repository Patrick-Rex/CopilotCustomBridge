/**
 * 日志输出模块
 *
 * 支持三种日志级别：minimal（最少）、metadata（含元数据）、verbose（详细）。
 * 通过 vscode.window.createOutputChannel 输出到独立通道。
 */

import * as vscode from 'vscode';
import type { DebugMode } from './types';

let _channel: vscode.OutputChannel | undefined;
let _mode: DebugMode = 'minimal';

/** 获取或创建输出通道 */
function channel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Copilot Custom Bridge');
	}
	return _channel;
}

/** 设置为调试模式 */
export function setDebugMode(mode: DebugMode): void {
	_mode = mode;
}

/** 获取当前调试模式 */
export function getDebugMode(): DebugMode {
	return _mode;
}

/** 格式化时间戳 */
function timestamp(): string {
	return new Date().toISOString();
}

/** 级别排序 */
const LEVEL_ORDER: Record<DebugMode, number> = {
	minimal: 0,
	metadata: 1,
	verbose: 2,
};

/** 给定级别在当前模式下是否应输出 */
function shouldLog(level: DebugMode): boolean {
	return LEVEL_ORDER[level] <= LEVEL_ORDER[_mode];
}

// ---- 公开 API ----

/** 最低级别日志（始终输出）：错误 */
export function error(message: string, ...args: unknown[]): void {
	channel().appendLine(`[${timestamp()}] [ERROR] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}`);
}

/** 最低级别日志（始终输出）：警告 */
export function warn(message: string, ...args: unknown[]): void {
	if (shouldLog('minimal')) {
		channel().appendLine(`[${timestamp()}] [WARN] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}`);
	}
}

/** 中等级别日志：元数据 */
export function info(message: string, ...args: unknown[]): void {
	if (shouldLog('metadata')) {
		channel().appendLine(`[${timestamp()}] [INFO] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}`);
	}
}

/** 详细调试日志 */
export function debug(message: string, ...args: unknown[]): void {
	if (shouldLog('verbose')) {
		channel().appendLine(`[${timestamp()}] [DEBUG] ${message}${args.length ? ' ' + JSON.stringify(args) : ''}`);
	}
}

/** 释放输出通道 */
export function dispose(): void {
	if (_channel) {
		_channel.dispose();
		_channel = undefined;
	}
}
