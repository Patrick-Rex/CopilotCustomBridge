/**
 * Token 估算模块 — 字符近似法 + 上下文压缩/截断
 *
 * 合约见 specs/001-custom-bridge-mvp/contracts/provider.md (处理流程第4步)
 * Phase 1 使用字符近似法：1 token ≈ 4 英文字符或 1 中文字符。
 */

import type { OpenAIMessage } from '../client/types';
import * as logger from '../logger';

/** 字符/token 换算比例 */
const CHARS_PER_TOKEN_EN = 4;
const CHARS_PER_TOKEN_ZH = 1;

/** 判断是否为中文字符（含 CJK 统一表意文字） */
function isCJK(char: string): boolean {
	const code = char.charCodeAt(0);
	// CJK 统一表意文字范围 + 扩展
	return (code >= 0x4E00 && code <= 0x9FFF) ||
		(code >= 0x3400 && code <= 0x4DBF) ||
		(code >= 0x20000 && code <= 0x2A6DF) ||
		(code >= 0x2A700 && code <= 0x2B73F) ||
		(code >= 0x2B740 && code <= 0x2B81F) ||
		(code >= 0x2B820 && code <= 0x2CEAF) ||
		(code >= 0xF900 && code <= 0xFAFF) ||
		(code >= 0x2F800 && code <= 0x2FA1F);
}

/**
 * 估算单条消息的 token 数
 * 英文/ASCII: 每 4 字符 ≈ 1 token
 * 中文/CJK: 每 1 字符 ≈ 1 token
 * 每条消息额外 +4 token（role 开销）
 */
export function estimateTokens(message: OpenAIMessage): number {
	let tokens = 4; // role 开销

	for (const char of message.content) {
		if (isCJK(char)) {
			tokens += 1;
		} else {
			tokens += Math.ceil(1 / CHARS_PER_TOKEN_EN);
		}
	}
	return tokens;
}

/** 估算消息列表总 token 数 */
export function estimateTotalTokens(messages: OpenAIMessage[]): number {
	return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

/**
 * 生成消息摘要（简单截取前 N 字符）
 * Phase 1 简化：取内容前 200 字符 + "..."
 */
function summarize(message: OpenAIMessage): OpenAIMessage {
	const maxPreview = 200;
	const preview = message.content.length > maxPreview
		? message.content.slice(0, maxPreview) + '...'
		: message.content;

	return {
		...message,
		content: `[早期对话摘要] ${message.role}: ${preview}`,
	};
}

/**
 * 压缩与截断消息列表，确保不超出 maxInputTokens
 *
 * 策略:
 * 1. 保留所有 system 消息（role=system）
 * 2. 从最旧的非 system 消息开始压缩（摘要化）
 * 3. 仍超限则从最旧的非 system 消息开始丢弃
 *
 * @param messages 原始消息列表
 * @param maxInputTokens 最大输入 token 限制
 * @returns 压缩后的消息列表
 */
export function compressAndTruncate(
	messages: OpenAIMessage[],
	maxInputTokens: number,
): OpenAIMessage[] {
	if (messages.length === 0) { return []; }

	// 分离 system 消息和其他消息
	const systemMessages = messages.filter(m => m.role === 'system');
	const otherMessages = messages.filter(m => m.role !== 'system');

	let result: OpenAIMessage[] = [];
	let currentTokens = 0;

	// 先加入 system 消息
	for (const sys of systemMessages) {
		currentTokens += estimateTokens(sys);
	}
	result = [...systemMessages];

	if (currentTokens > maxInputTokens * 0.5) {
		// system 消息本身已超过一半限额，只保留第一条
		logger.warn('System 消息过大，仅保留第一条');
		result = systemMessages.length > 0 ? [systemMessages[0]] : [];
		currentTokens = result.length > 0 ? estimateTokens(result[0]) : 0;
	}

	// Step 1: 从最新到最旧逐个添加（保留最新对话），若超限则尝试压缩
	let i = otherMessages.length - 1;
	const retained: OpenAIMessage[] = [];

	while (i >= 0) {
		const msg = otherMessages[i];
		const msgTokens = estimateTokens(msg);

		if (currentTokens + msgTokens <= maxInputTokens) {
			currentTokens += msgTokens;
			retained.unshift(msg);
			i--;
		} else {
			break;
		}
	}

	if (retained.length > 0) {
		result = [...result, ...retained];
	} else {
		// 即使最新一条消息也放不下 — 截断该消息
		logger.warn('单条消息超出 maxInputTokens，截断消息内容');
		const lastMsg = otherMessages[otherMessages.length - 1];
		const availableTokens = maxInputTokens - currentTokens - estimateTokens({ ...lastMsg, content: '' });
		if (availableTokens > 0) {
			// 粗略截断：每 token 按 4 字符
			const maxChars = availableTokens * CHARS_PER_TOKEN_EN;
			result.push({
				...lastMsg,
				content: lastMsg.content.slice(0, maxChars) + '...',
			});
		}
	}

	// Step 2: 对压缩区域的消息用摘要替换
	if (i >= 0 && retained.length > 0) {
		// 有旧消息被截断，生成一条摘要消息插入最前面
		const compressed = otherMessages.slice(0, i + 1);
		if (compressed.length > 0) {
			const summaryMsg = summarize(compressed[compressed.length - 1]);
			const summaryTokens = estimateTokens(summaryMsg);
			if (estimateTotalTokens(result) + summaryTokens <= maxInputTokens) {
				// 在 system 消息之后、retained 之前插入
				const sysEndIndex = systemMessages.length;
				result.splice(sysEndIndex, 0, summaryMsg);
			}
		}
	}

	logger.info(`Token 压缩完成: ${messages.length} → ${result.length} 条消息, ${estimateTotalTokens(messages)} → ${estimateTotalTokens(result)} tokens`);
	return result;
}
