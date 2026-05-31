/**
 * 视觉处理入口 — 图片消息解析与代理路由 (Phase 2)
 *
 * 合约见 specs/002-advanced-capabilities/contracts/provider.md
 */

import * as vscode from 'vscode';
import { findVisionProxy } from './model';
import { extractDataParts } from '../convert';
import { OpenAIClient } from '../../client';
import { AuthManager } from '../../auth';
import { VISION_PROXY_PROMPT } from '../../consts';
import type { VisionProxyResult } from './types';
import * as logger from '../../logger';

/**
 * 处理消息中的图片：支持视觉则转 image_url，否则尝试代理
 *
 * @returns 处理后的消息列表和代理结果
 */
export async function resolveImageMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	endpointId: string,
	modelId: string,
	imageInputCapable: boolean,
	token: vscode.CancellationToken,
): Promise<{
	resolvedMessages: vscode.LanguageModelChatRequestMessage[];
	proxyResults: VisionProxyResult[];
}> {
	const proxyResults: VisionProxyResult[] = [];
	const resolved: vscode.LanguageModelChatRequestMessage[] = [];

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		const dataParts = extractDataParts(msg);

		if (dataParts.length === 0) {
			resolved.push(msg);
			continue;
		}

		// 模型支持视觉 → 直接保留图片（convert.ts 会处理 image_url 格式）
		if (imageInputCapable) {
			resolved.push(msg);
			continue;
		}

		// 模型不支持视觉 → 尝试视觉代理
		const proxyModelId = findVisionProxy(endpointId, modelId);
		if (!proxyModelId) {
			logger.warn('模型不支持图片输入且未配置视觉代理');
			// 转换为纯文本提示
			resolved.push(createFallbackMessage(msg, dataParts.length));
			continue;
		}

		// 调用视觉代理
		try {
			const startTime = Date.now();
			const apiKey = await AuthManager.getApiKey(endpointId);
			if (!apiKey) { throw new Error('API Key 未设置'); }

			const endpoint = (await import('../../config')).ConfigManager.getEndpoints()
				.find(ep => ep.id === endpointId);
			if (!endpoint) { throw new Error('端点未找到'); }

			const client = new OpenAIClient(endpoint.baseUrl, apiKey);
			const descriptions: string[] = [];

			for (const dp of dataParts) {
				const base64 = bufferToBase64(dp.data);
				const desc = await client.chatCompletion({
					model: proxyModelId,
					messages: [
						{
							role: 'user',
							content: VISION_PROXY_PROMPT,
						},
					],
					max_tokens: 1024,
				}, token);
				descriptions.push(desc);
				proxyResults.push({
					originalImageIndex: i,
					description: desc,
					sourceModelId: proxyModelId,
					processingTimeMs: Date.now() - startTime,
				});
			}

			// 用文本描述替代图片
			resolved.push(createProxyResolvedMessage(msg, descriptions.join('\n')));
		} catch (err) {
			logger.error('视觉代理处理失败', err);
			resolved.push(createFallbackMessage(msg, dataParts.length));
		}
	}

	return { resolvedMessages: resolved, proxyResults };
}

function bufferToBase64(buffer: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < buffer.length; i++) {
		binary += String.fromCharCode(buffer[i]);
	}
	return btoa(binary);
}

function createFallbackMessage(
	_original: vscode.LanguageModelChatRequestMessage,
	imageCount: number,
): vscode.LanguageModelChatRequestMessage {
	return {
		role: 1, // User
		content: [{ type: 'text' as const, value: `[图片消息 (${imageCount} 张): 当前模型不支持图片输入，请配置视觉代理模型]` }],
		name: '',
	};
}

function createProxyResolvedMessage(
	_original: vscode.LanguageModelChatRequestMessage,
	description: string,
): vscode.LanguageModelChatRequestMessage {
	return {
		role: 1, // User
		content: [{ type: 'text' as const, value: `[图片描述 (由视觉代理生成)]\n${description}` }],
		name: '',
	};
}
