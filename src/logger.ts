/**
 * 日志输出模块 — Copilot Custom Bridge (Phase 3)
 *
 * 支持三级日志输出到 OutputChannel。
 * Phase 3: verbose 模式新增请求/响应自动转储到 globalStorage，含 API Key 脱敏与自动轮转。
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomBytes } from 'crypto';
import type { DebugMode } from './types';
import {
	DUMP_DIR_NAME,
	DUMP_FILE_PREFIX,
	DUMP_FILE_EXT,
	DUMP_MAX_FILES,
	SANITIZE_PATTERNS,
} from './consts';

let _channel: vscode.OutputChannel | undefined;
let _mode: DebugMode = 'minimal';
let _context: vscode.ExtensionContext | undefined;

/** 获取或创建输出通道 */
function channel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Copilot Custom Bridge');
	}
	return _channel;
}

/** 设置调试模式 */
export function setDebugMode(mode: DebugMode): void {
	_mode = mode;
}

/** 获取当前调试模式 */
export function getDebugMode(): DebugMode {
	return _mode;
}

/** 初始化转储系统（需要 ExtensionContext 访问 globalStorageUri） */
export function initDumpSystem(context: vscode.ExtensionContext): void {
	_context = context;
}

/** 格式化时间戳 (ISO) */
function timestamp(): string {
	return new Date().toISOString();
}

/** 格式化文件名时间戳 (YYYYMMDD-HHmmss) */
function fileTimestamp(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 生成短随机 hex */
function shortId(): string {
	return randomBytes(3).toString('hex');
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

// ============================================================================
// Phase 3: 请求/响应转储系统
// ============================================================================

/** 转储数据包 */
export interface DumpPayload {
	timestamp: string;
	endpointId: string;
	modelId: string;
	requestUrl: string;
	requestHeaders: Record<string, string>;
	requestBody: unknown;
	responseStatus?: number;
	responseHeaders?: Record<string, string>;
	responseBody?: unknown;
	durationMs?: number;
	error?: string;
}

/** 对文本应用脱敏规则 */
export function sanitize(text: string): string {
	let result = text;
	for (const [pattern, replacement] of SANITIZE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

/** 脱敏请求头副本 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
	const sanitized: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		sanitized[key] = sanitize(value);
	}
	return sanitized;
}

/** 获取转储目录路径 */
async function getDumpDir(): Promise<string> {
	if (!_context) {
		throw new Error('Dump system not initialized');
	}
	const dir = path.join(_context.globalStorageUri.fsPath, DUMP_DIR_NAME);
	await fs.mkdir(dir, { recursive: true });
	return dir;
}

/** 生成转储文件名 */
function dumpFileName(modelId: string): string {
	return `${DUMP_FILE_PREFIX}-${fileTimestamp()}-${modelId}-${shortId()}${DUMP_FILE_EXT}`;
}

/**
 * T008: 将一次请求/响应转储到文件。
 * 异步写入，不阻塞主流程。写入失败仅记日志。
 */
export async function dumpRequestResponse(payload: DumpPayload): Promise<void> {
	if (_mode !== 'verbose') return;

	try {
		const dir = await getDumpDir();
		const fileName = dumpFileName(payload.modelId);
		const filePath = path.join(dir, fileName);

		// 脱敏处理
		const sanitized = {
			...payload,
			requestHeaders: sanitizeHeaders(payload.requestHeaders),
			requestBody: payload.requestBody,
		};

		// 对序列化后的完整 JSON 再做一次脱敏（覆盖嵌套字段）
		const json = JSON.stringify(sanitized, null, 2);
		const final = sanitize(json);

		await fs.writeFile(filePath, final, 'utf-8');
		info(`Dump saved: ${filePath}`);

		// T009: 自动轮转
		await rotateDumps(dir);
	} catch (err) {
		warn(`Dump write failed: ${String(err)}`);
	}
}

/**
 * T009: 自动轮转——当转储文件数超过上限时删除最旧的。
 */
async function rotateDumps(dir: string): Promise<void> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const files = entries
			.filter(e => e.isFile() && e.name.startsWith(DUMP_FILE_PREFIX) && e.name.endsWith(DUMP_FILE_EXT))
			.map(e => e.name)
			.sort(); // 时间戳前缀天然可排序

		while (files.length > DUMP_MAX_FILES) {
			const oldest = files.shift()!;
			await fs.unlink(path.join(dir, oldest));
			debug(`Dump rotated: removed ${oldest}`);
		}
	} catch (err) {
		warn(`Dump rotation failed: ${String(err)}`);
	}
}

/**
 * 获取转储目录的 URI（用于打开文件管理器）。
 */
export function getDumpDirectoryUri(): vscode.Uri | undefined {
	if (!_context) return undefined;
	return vscode.Uri.joinPath(_context.globalStorageUri, DUMP_DIR_NAME);
}

/** 释放输出通道 */
export function dispose(): void {
	if (_channel) {
		_channel.dispose();
		_channel = undefined;
	}
}
