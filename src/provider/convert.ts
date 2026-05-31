/**
 * 消息格式转换模块 — VS Code Chat Message → OpenAI Chat Completions 格式
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/provider.md (处理流程第3步)
 */

import type * as vscode from 'vscode';
import type { OpenAIMessage } from '../client/types';
import * as logger from '../logger';

/**
 * 将单条 VS Code LanguageModelChatRequestMessage 转换为 OpenAI 格式
 *
 * VS Code roles:
 * - LanguageModelChatRequestMessageRole.User (1)
 * - LanguageModelChatRequestMessageRole.Assistant (2)
 * - LanguageModelChatRequestMessageRole.System (3)
 *
 * OpenAI roles: "system" | "user" | "assistant"
 *
 * Phase 1 仅处理 text 内容，忽略 tool call/result/thinking。
 */
export function convertMessage(
	msg: vscode.LanguageModelChatRequestMessage,
): OpenAIMessage | undefined {
	let role: 'system' | 'user' | 'assistant';

	// role 是 LanguageModelChatMessageRole 枚举（User=1, Assistant=2）
	// System 角色在部分场景下值可能为 3
	const roleValue = msg.role as number;

	switch (roleValue) {
		case 1: // User
			role = 'user';
			break;
		case 2: // Assistant
			role = 'assistant';
			break;
		case 3: // System
			role = 'system';
			break;
		default:
			logger.debug(`未知消息角色: ${roleValue}, 跳过`);
			return undefined;
	}

	// 提取文本内容
	const content = extractTextContent(msg);

	// 跳过空内容消息（保留 role 但内容为空通常无意义）
	if (!content && role !== 'system') {
		logger.debug(`跳过空内容消息 (role=${role})`);
		return undefined;
	}

	return { role, content };
}

/**
 * 从 VS Code 消息中提取纯文本内容
 *
 * LanguageModelChatRequestMessage 的内容可能是:
 * - LanguageModelTextPart (type: "text")
 * - 其他部分类型 Phase 1 忽略
 */
function extractTextContent(msg: vscode.LanguageModelChatRequestMessage): string {
	if (typeof msg.content === 'string') {
		return msg.content;
	}

	if (Array.isArray(msg.content)) {
		const parts: string[] = [];
		for (const part of msg.content) {
			if (typeof part === 'object' && part !== null) {
				const p = part as Record<string, unknown>;
				if (p.type === 'text' && typeof p.value === 'string') {
					parts.push(p.value);
				}
				// 忽略 tool call result, image 等其他类型
			}
		}
		return parts.join('\n');
	}

	return '';
}

/**
 * 批量转换消息列表
 */
export function convertMessages(
	messages: vscode.LanguageModelChatRequestMessage[],
): OpenAIMessage[] {
	const converted: OpenAIMessage[] = [];

	for (const msg of messages) {
		const openaiMsg = convertMessage(msg);
		if (openaiMsg) {
			converted.push(openaiMsg);
		}
	}

	logger.debug(`消息转换: ${messages.length} → ${converted.length} 条`);
	return converted;
}
