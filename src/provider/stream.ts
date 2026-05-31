/**
 * 流式响应处理模块 — SSE delta → VS Code LanguageModelPart (Phase 2)
 *
 * 处理 content / reasoning_content / tool_calls delta 累积拼接
 */

import * as vscode from 'vscode';
import type { OpenAIToolCallDelta, OpenAIToolCall } from '../client/types';
import * as logger from '../logger';

interface ToolCallAccumulator {
	id: string;
	type: 'function';
	index: number;
	name: string;
	arguments: string;
}

/**
 * tool_calls 累积拼接器
 */
export class ToolCallAggregator {
	private map = new Map<number, ToolCallAccumulator>();

	addDelta(delta: OpenAIToolCallDelta): void {
		const index = delta.index;
		let acc = this.map.get(index);
		if (!acc) {
			acc = { id: delta.id ?? '', type: 'function', index, name: '', arguments: '' };
			this.map.set(index, acc);
		}
		if (delta.id) { acc.id = delta.id; }
		if (delta.function?.name) { acc.name = delta.function.name; }
		if (delta.function?.arguments) { acc.arguments += delta.function.arguments; }
	}

	/** 获取所有累积的 tool_calls（不过滤完整性） */
	getAll(): ToolCallAccumulator[] {
		return Array.from(this.map.values());
	}

	/** 获取已完整的 tool_calls（有 id + name + arguments） */
	getCompleted(): ToolCallAccumulator[] {
		return this.getAll().filter(tc => tc.id && tc.name && tc.arguments);
	}

	/** 生成 VS Code ToolCallPart */
	toToolCallParts(accs: ToolCallAccumulator[]): vscode.LanguageModelToolCallPart[] {
		return accs.map(acc => new vscode.LanguageModelToolCallPart(
			acc.id,
			acc.name,
			// 尝试解析 arguments 为 JSON object
			(() => { try { return JSON.parse(acc.arguments); } catch { return { raw: acc.arguments }; } })(),
		));
	}

	/** 清空 */
	reset(): void {
		this.map.clear();
	}

	get size(): number {
		return this.map.size;
	}
}

/**
 * 流处理器 — 将 SSE 回调转为 VS Code progress.report
 */
export function createStreamHandler(
	progress: vscode.Progress<vscode.LanguageModelResponsePart>,
): {
	onContent: (text: string) => void;
	onThinking: (reasoning: string) => void;
	onToolCall: (delta: OpenAIToolCallDelta) => void;
	flushToolCalls: () => void;
	onComplete: () => void;
} {
	const toolAggregator = new ToolCallAggregator();

	return {
		onContent: (text: string) => {
			progress.report(new vscode.LanguageModelTextPart(text));
		},

		onThinking: (reasoning: string) => {
			progress.report(new vscode.LanguageModelTextPart(`[Thinking] ${reasoning}`));
		},

		onToolCall: (delta: OpenAIToolCallDelta) => {
			toolAggregator.addDelta(delta);
		},

		flushToolCalls: () => {
			const completed = toolAggregator.getCompleted();
			if (completed.length === 0) { return; }
			const parts = toolAggregator.toToolCallParts(completed);
			for (const part of parts) {
				progress.report(part);
			}
			logger.info(`工具调用已输出: ${parts.length} 个`);
		},

		onComplete: () => {
			// 流结束时输出任何残留的 tool_calls
			const all = toolAggregator.getAll();
			if (all.length > 0) {
				const parts = toolAggregator.toToolCallParts(all);
				for (const part of parts) {
					progress.report(part);
				}
			}
			toolAggregator.reset();
		},
	};
}
