/**
 * 工具流程模块 — 预飞机制 + 循环控制 (Phase 2)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import * as vscode from 'vscode';
import { PREFLIGHT_TOOL_PREFIX, MAX_TOOL_CALL_ROUNDS } from './consts';
import * as logger from '../../logger';

/**
 * 查找 activate_ 前缀的预热工具
 */
export function findPreflightTools(
	tools: readonly vscode.LanguageModelChatTool[],
): readonly vscode.LanguageModelChatTool[] {
	return tools.filter(t => t.name.startsWith(PREFLIGHT_TOOL_PREFIX));
}

/**
 * 工具调用循环控制器
 */
export class ToolCallLoopController {
	private _currentRound = 0;
	readonly maxRounds: number;

	constructor(maxRounds = MAX_TOOL_CALL_ROUNDS) {
		this.maxRounds = maxRounds;
	}

	/** 是否可继续 */
	canContinue(): boolean {
		return this._currentRound < this.maxRounds;
	}

	/** 增加一轮 */
	increment(): void {
		this._currentRound++;
	}

	/** 重置 */
	reset(): void {
		this._currentRound = 0;
	}

	get currentRound(): number {
		return this._currentRound;
	}
}

/**
 * 执行预热工具并将结果注入为 system 消息上下文
 *
 * 注意: Phase 2 中 VS Code 的 `activate_` 工具由 Copilot 自身管理。
 * 本模块负责追踪预飞状态，不直接调用工具执行 API。
 */
export function getPreflightContextMessage(
	preflightResults: Map<string, string>,
): { role: 'system'; content: string } | undefined {
	if (preflightResults.size === 0) {
		return undefined;
	}

	const lines: string[] = ['[Preflight Context]'];
	for (const [toolName, result] of preflightResults) {
		lines.push(`${toolName}: ${result}`);
	}

	logger.info(`预热上下文已构建: ${preflightResults.size} 个工具`);
	return { role: 'system', content: lines.join('\n') };
}
