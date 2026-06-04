/**
 * 消息格式转换模块 — VS Code Chat Message → OpenAI Chat Completions 格式 (Phase 2 扩展)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import type * as vscode from 'vscode';
import type { OpenAIMessage, OpenAIContentPart } from '../client/types';
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

	// Phase 2: 提取图片数据 (视觉支持)
	const dataParts = extractDataParts(msg);

	// Phase 2: 提取 tool call 和 tool result
	const toolCalls = extractToolCalls(msg);
	const toolCallId = extractToolCallId(msg);
	const reasoningContent = extractReasoningContent(msg);

	// tool result 消息 (FR-007)
	if (toolCallId && content !== undefined) {
		return { role: 'tool' as const, content, tool_call_id: toolCallId };
	}

	// assistant 消息含 tool_calls (FR-004)
	if (toolCalls && toolCalls.length > 0) {
		return {
			role: 'assistant' as const,
			content: content || '',
			tool_calls: toolCalls,
			reasoning_content: reasoningContent,
		};
	}

	// 思考内容 (FR-012)
	if (reasoningContent) {
		return { role: 'assistant' as const, content: content || '', reasoning_content: reasoningContent };
	}

	// Phase 2: 图片消息 — 将 data parts 转为 image_url 格式 (视觉支持)
	if (dataParts.length > 0) {
		const contentParts: OpenAIContentPart[] = [];
		// 先添加文本（如有）
		if (content) {
			contentParts.push({ type: 'text', text: content });
		}
		// 添加图片
		for (const dp of dataParts) {
			const base64 = Buffer.from(dp.data).toString('base64');
			contentParts.push({
				type: 'image_url',
				image_url: {
					url: `data:${dp.mimeType};base64,${base64}`,
				},
			});
		}
		return { role, content: contentParts };
	}

	// 跳过空内容消息（保留 role 但内容为空通常无意义）
	if (!content && role !== 'system') {
		if (logger.getDebugMode() === 'verbose') {
			const diag = dumpContentStructure(msg.content);
			logger.debug(`跳过空内容消息 (role=${role}, contentType=${diag.contentType}, partTypes=${JSON.stringify(diag.partTypes)}, partKeys=${JSON.stringify(diag.partKeys)})`);
		}
		return undefined;
	}

	// Phase 3: system 消息内容也为空时记录警告
	if (!content && role === 'system') {
		if (logger.getDebugMode() === 'verbose') {
			const diag = dumpContentStructure(msg.content);
			logger.debug(`system 消息内容为空 (contentType=${diag.contentType}, partTypes=${JSON.stringify(diag.partTypes)}, partKeys=${JSON.stringify(diag.partKeys)})`);
		}
	}

	return { role, content };
}

/**
 * Phase 3: 诊断辅助 — dump 消息 content 结构
 */
function dumpContentStructure(content: unknown): {
	contentType: string;
	partTypes: string[] | undefined;
	partKeys: string[] | undefined;
} {
	const contentType = typeof content;
	let partTypes: string[] | undefined;
	let partKeys: string[] | undefined;
	if (Array.isArray(content)) {
		partTypes = content.map((p: unknown) => String((p as Record<string, unknown>)?.type ?? typeof p));
		partKeys = content.map((p: unknown) => {
			if (typeof p === 'object' && p !== null) {
				return Object.keys(p as object).join(',');
			}
			return typeof p;
		});
	}
	return { contentType, partTypes, partKeys };
}

/**
 * 从 VS Code 消息中提取纯文本内容
 *
 * LanguageModelChatRequestMessage 的内容可能是:
 * - 字符串
 * - Part 数组，文本 Part 有 value 属性（可能无 type 字段）
 * - 图片 Part 有 image/* mimeType 和 data，不提取
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
				// 文本 part: 有 value 且不是图片
				if (typeof p.value === 'string' && !isImageDataPart(p)) {
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

// ============================================================================
// Phase 2: 扩展提取函数
// ============================================================================

/** 提取 tool_calls */
function extractToolCalls(msg: vscode.LanguageModelChatRequestMessage): OpenAIMessage['tool_calls'] | undefined {
	if (typeof msg.content !== 'object' || !Array.isArray(msg.content)) {
		return undefined;
	}
	const calls: NonNullable<OpenAIMessage['tool_calls']> = [];
	for (const part of msg.content) {
		const p = part as Record<string, unknown>;
		// 跳过 tool result part (有 callId 但没有 name)
		if (typeof p.callId === 'string' && typeof p.name !== 'string') {
			continue;
		}
		// function call part: 有 name 属性（无论有无 type 字段）
		if (typeof p.name === 'string' && !p.mimeType) {
			calls.push({
				id: typeof p.callId === 'string' ? p.callId : '',
				type: 'function',
				index: typeof p.index === 'number' ? p.index : calls.length,
				function: {
					name: p.name,
					arguments: typeof p.input === 'string' ? p.input : JSON.stringify(p.input ?? {}),
				},
			});
		}
	}
	return calls.length > 0 ? calls : undefined;
}

/** 提取 tool_call_id */
function extractToolCallId(msg: vscode.LanguageModelChatRequestMessage): string | undefined {
	if (typeof msg.content !== 'object' || !Array.isArray(msg.content)) {
		return undefined;
	}
	for (const part of msg.content) {
		const p = part as Record<string, unknown>;
		// tool result part: 有 callId 且无 name（function call 也有 callId，需区分）
		// VS Code 可能不传 type 字段，用 hasCallId && !hasName 判断
		if (typeof p.callId === 'string' && typeof p.name !== 'string') {
			return p.callId;
		}
	}
	return undefined;
}

/** 提取 reasoning_content (thinking 模式) */
function extractReasoningContent(msg: vscode.LanguageModelChatRequestMessage): string | undefined {
	if (typeof msg.content !== 'object' || !Array.isArray(msg.content)) {
		return undefined;
	}
	for (const part of msg.content) {
		const p = part as Record<string, unknown>;
		// thinking part: 匹配 type==='thinking'（VS Code 可能不传 type，此时不提取）
		if (p.type === 'thinking' && typeof p.value === 'string') {
			return p.value;
		}
	}
	return undefined;
}

/**
 * Phase 2: 提取图片数据部分
 *
 * VS Code 图片 Part 有 image/* mimeType 和 data 属性（可能无 type 字段）。
 * 一些非图片上下文数据也带 mimeType/data/audience，不能按“有 data 就是图片”处理。
 */
export function extractDataParts(
	msg: vscode.LanguageModelChatRequestMessage,
): Array<{ mimeType: string; data: Uint8Array }> {
	if (typeof msg.content !== 'object' || !Array.isArray(msg.content)) {
		return [];
	}
	const parts: Array<{ mimeType: string; data: Uint8Array }> = [];
	for (const part of msg.content) {
		const p = part as Record<string, unknown>;
		if (isImageDataPart(p)) {
			parts.push({ mimeType: p.mimeType as string, data: p.data as Uint8Array });
		}
	}
	return parts;
}

function isImageDataPart(part: Record<string, unknown>): boolean {
	return typeof part.mimeType === 'string'
		&& part.mimeType.toLowerCase().startsWith('image/')
		&& part.data instanceof Uint8Array;
}
