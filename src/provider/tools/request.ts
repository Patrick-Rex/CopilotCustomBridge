/**
 * 工具请求模块 — VS Code Tool → OpenAI function calling 格式 (Phase 2)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import * as vscode from 'vscode';
import type { OpenAITool } from '../../client/types';
import * as logger from '../../logger';

/**
 * 将 VS Code LanguageModelChatRequestToolInfo 列表转换为 OpenAI function calling 格式
 *
 * @param tools VS Code 传递的工具定义列表
 * @param maxTools 工具数量上限 (undefined = 不限制, number = 取前 N 个)
 */
export function convertVSCodeToolsToOpenAI(
	tools: readonly vscode.LanguageModelChatTool[],
	maxTools?: number | false,
): OpenAITool[] {
	if (!tools || tools.length === 0) {
		return [];
	}

	// 工具数量上限裁剪 (FR-005)
	const capped = capTools(tools, maxTools);

	const result: OpenAITool[] = [];
	for (const tool of capped) {
		result.push({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description ?? '',
				parameters: tool.inputSchema ?? { type: 'object', properties: {} },
			},
		});
	}

	logger.debug(`工具转换: ${tools.length} → ${result.length} 个 (maxTools=${maxTools})`);
	return result;
}

/**
 * 工具数量上限裁剪 (FR-005)
 *
 * @param tools 工具列表
 * @param limit false=不传工具, true=不限制, number=取前 N 个
 */
export function capTools(
	tools: readonly vscode.LanguageModelChatTool[],
	limit?: number | false | true,
): readonly vscode.LanguageModelChatTool[] {
	if (limit === false) {
		return []; // 不传递工具
	}
	if (limit === true || limit === undefined) {
		return tools; // 不限制
	}
	return tools.slice(0, limit); // 取前 N 个
}
