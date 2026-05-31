/**
 * 国际化字符串 — Copilot Custom Bridge (Phase 3)
 *
 * Phase 3 重构：从硬编码常量对象改为运行时翻译查找函数。
 * 静态字符串（命令标题、设置描述）走 package.nls.json / package.nls.zh-cn.json。
 * 运行时字符串（错误提示、通知）走此模块的内联映射表。
 */

import * as vscode from 'vscode';

// ============================================================================
// 语言检测
// ============================================================================

function getLanguage(): 'en' | 'zh-cn' {
	const lang = vscode.env.language.toLowerCase();
	return lang.startsWith('zh') ? 'zh-cn' : 'en';
}

// ============================================================================
// 运行时翻译表
// ============================================================================

type MessageMap = Record<string, string>;

const zhCN: MessageMap = {
	// 工具调用 (Phase 2)
	TOOL_CALL_LOOP_EXCEEDED: '工具调用已达到最大轮次（10轮），返回当前结果',
	TOOL_PREFLIGHT_FAILED: '预热工具执行失败',

	// 视觉代理 (Phase 2)
	VISION_PROXY_NOT_CONFIGURED: '当前模型不支持图片输入，请配置视觉代理模型或选择支持视觉的模型',
	VISION_PROXY_FAILED: '视觉代理模型处理失败',
	VISION_PROXY_UNAVAILABLE: '视觉代理模型不可用',

	// 模型自动探测 (Phase 2)
	AUTO_DETECT_NOT_SUPPORTED: '该端点不支持模型自动探测，请手动配置模型列表',
	AUTO_DETECT_AUTH_FAILED: 'API Key 无效或无权限访问模型列表',
	AUTO_DETECT_CONNECTION_FAILED: '无法连接端点',
	AUTO_DETECT_FORMAT_ERROR: '端点返回格式不符合预期',
	AUTO_DETECT_COMPLETE: '模型自动探测完成',
	AUTO_DETECT_PROGRESS: '正在探测模型...',
	AUTO_DETECT_MODEL_LIMIT: '模型数量超过上限（100个），仅加载前100个',

	// 速率限制 (Phase 2)
	RATE_LIMIT_TIMEOUT: '服务繁忙，请稍后再试',
	RATE_LIMIT_RETRYING: '服务限速，正在自动重试...',

	// 多端点 (Phase 2)
	ENDPOINT_SELECT_PLACEHOLDER: '选择要设置 API Key 的端点',
	ENDPOINT_SKIPPED_INVALID: '端点 {id} 的 baseUrl 格式无效，已跳过',
	ENDPOINT_MODEL_CONFLICT: '模型 ID 冲突，保留第一个配置',
	NO_ENDPOINT_CONFIGURED: '未配置任何端点，请在 settings.json 中添加 copilot-custom-bridge.endpoints',

	// Agent 模式 (Phase 2)
	AGENT_MODE_NOT_SUPPORTED: '当前模型不支持 Agent 模式（工具调用）',

	// Thinking (Phase 2)
	THINKING_INVALID_EFFORT: '推理力度值无效，已使用默认值',

	// Phase 3: 错误友好提示
	ERROR_CONNECTION: '无法连接到 API 端点。请检查网络连接、代理设置或端点 URL 是否正确',
	ERROR_TIMEOUT: '请求超时。请检查网络延迟或端点是否可用',
	ERROR_AUTH: 'API Key 无效。请执行「设置 API Key」命令重新配置',
	ERROR_FORBIDDEN: '无权限访问。请检查 API Key 权限范围或端点访问控制',
	ERROR_RATE_LIMIT: '请求过于频繁，系统正在自动重试，请稍候',
	ERROR_SERVER: '端点服务异常，请稍后重试或联系端点管理员',
	ERROR_UNAVAILABLE: '端点暂时不可用，系统正在自动重试',
	ERROR_PARSE: '端点返回格式异常。请检查端点 URL 是否指向 Chat Completions API',
	ERROR_UNKNOWN: '发生未知错误，请开启 verbose 调试模式获取详细信息',
	DUMP_OPEN_FAILED: '无法打开诊断目录',
	DUMP_WRITE_FAILED: '诊断转储写入失败（不影响正常对话）',
	WALKTHROUGH_OPEN_FAILED: '无法打开引导页',
};

const enUS: MessageMap = {
	// Tool Calling (Phase 2)
	TOOL_CALL_LOOP_EXCEEDED: 'Tool call loop exceeded maximum rounds (10), returning current result',
	TOOL_PREFLIGHT_FAILED: 'Preflight tool execution failed',

	// Vision Proxy (Phase 2)
	VISION_PROXY_NOT_CONFIGURED: 'Current model does not support image input. Configure a vision proxy model or select a vision-capable model',
	VISION_PROXY_FAILED: 'Vision proxy model processing failed',
	VISION_PROXY_UNAVAILABLE: 'Vision proxy model unavailable',

	// Auto-detect Models (Phase 2)
	AUTO_DETECT_NOT_SUPPORTED: 'Model auto-detection not supported by this endpoint. Configure models manually',
	AUTO_DETECT_AUTH_FAILED: 'Invalid API Key or no permission to access model list',
	AUTO_DETECT_CONNECTION_FAILED: 'Cannot connect to endpoint',
	AUTO_DETECT_FORMAT_ERROR: 'Unexpected response format from endpoint',
	AUTO_DETECT_COMPLETE: 'Model auto-detection complete',
	AUTO_DETECT_PROGRESS: 'Detecting models...',
	AUTO_DETECT_MODEL_LIMIT: 'Model count exceeds limit (100), only first 100 loaded',

	// Rate Limit (Phase 2)
	RATE_LIMIT_TIMEOUT: 'Service busy, please try again later',
	RATE_LIMIT_RETRYING: 'Rate limited, auto-retrying...',

	// Multi-Endpoint (Phase 2)
	ENDPOINT_SELECT_PLACEHOLDER: 'Select endpoint to set API Key for',
	ENDPOINT_SKIPPED_INVALID: 'Endpoint {id} has invalid baseUrl, skipped',
	ENDPOINT_MODEL_CONFLICT: 'Model ID conflict, keeping first configuration',
	NO_ENDPOINT_CONFIGURED: 'No endpoints configured. Add copilot-custom-bridge.endpoints in settings.json',

	// Agent Mode (Phase 2)
	AGENT_MODE_NOT_SUPPORTED: 'Current model does not support Agent mode (Tool Calling)',

	// Thinking (Phase 2)
	THINKING_INVALID_EFFORT: 'Invalid thinking effort value, using default',

	// Phase 3: Friendly Error Messages
	ERROR_CONNECTION: 'Cannot connect to API endpoint. Check your network, proxy, or endpoint URL',
	ERROR_TIMEOUT: 'Request timed out. Check network latency or endpoint availability',
	ERROR_AUTH: 'Invalid API Key. Run "Set API Key" command to reconfigure',
	ERROR_FORBIDDEN: 'Access denied. Check API Key scope or endpoint access control',
	ERROR_RATE_LIMIT: 'Rate limited. Auto-retrying, please wait',
	ERROR_SERVER: 'Server error. Try again later or contact the endpoint admin',
	ERROR_UNAVAILABLE: 'Endpoint temporarily unavailable. Auto-retrying',
	ERROR_PARSE: 'Unexpected response format. Verify the endpoint URL points to Chat Completions API',
	ERROR_UNKNOWN: 'Unknown error. Enable verbose debug mode for details',
	DUMP_OPEN_FAILED: 'Cannot open dump directory',
	DUMP_WRITE_FAILED: 'Diagnostic dump write failed (does not affect chat)',
	WALKTHROUGH_OPEN_FAILED: 'Cannot open walkthrough',
};

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 获取国际化字符串。
 * 根据 vscode.env.language 自动选择中文/英文。
 * 未找到 key 时回退显示 key 名称本身。
 */
export function getI18nString(key: string): string {
	const lang = getLanguage();
	const map = lang === 'zh-cn' ? zhCN : enUS;
	return map[key] ?? key;
}

/**
 * Phase 2 兼容出口：保留 I18N 常量对象供旧代码平滑迁移。
 * 新代码 SHOULD 使用 getI18nString() 函数。
 */
export const I18N = new Proxy({} as Record<string, string>, {
	get(_target, prop: string) {
		return getI18nString(prop);
	},
});

export type I18nKey = keyof typeof zhCN | keyof typeof enUS;

