# Copilot Custom Bridge

在 VS Code Copilot Chat 中使用 OpenAI 兼容的第三方模型（DeepSeek / Ollama / 自定义端点等）。

## 特性

- 🪝 **零代码切换模型**：在 Copilot Chat 模型选择器中直接选择第三方模型
- ⚙️ **配置驱动**：所有端点、模型通过 VS Code `settings.json` 配置
- 🌐 **OpenAI 兼容**：支持所有 `/chat/completions` SSE 流式 API
- 🔧 **Agent 模式**：工具调用（文件读写、搜索、终端命令）
- 🖼️ **图片理解**：视觉模型支持截图分析、UI 审查
- 🧠 **推理模式**：思考过程可视化（Thinking）
- 🔒 **安全存储**：API Key 存储在操作系统加密存储中
- 🌍 **国际化**：中英文界面自动跟随 VS Code 显示语言

## 快速入门

### 1. 安装

```bash
# 从源码构建
npm install
npm run compile

# 或从 .vsix 安装
code --install-extension copilot-custom-bridge-0.1.0.vsix
```

### 2. 配置端点

在 VS Code `settings.json` 中添加端点配置：

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "my-openai",
      "name": "My OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "models": [
        {
          "id": "gpt-4o-mini",
          "name": "GPT-4o Mini",
          "maxInputTokens": 128000,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true,
            "imageInput": true
          }
        }
      ]
    }
  ]
}
```

### 3. 设置 API Key

1. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）打开命令面板
2. 执行 **Copilot Custom Bridge: 设置 API Key**
3. 在密码输入框中输入 API Key（隐藏模式，安全存储）

### 4. 选择模型对话

1. 打开 Copilot Chat
2. 在模型选择器中选择配置的第三方模型
3. 开始对话！

---

## 配置示例

### OpenAI

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "openai",
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "maxInputTokens": 128000,
          "maxOutputTokens": 16384,
          "capabilities": {
            "toolCalling": true,
            "imageInput": true,
            "thinking": false
          }
        },
        {
          "id": "gpt-4o-mini",
          "name": "GPT-4o Mini",
          "maxInputTokens": 128000,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true,
            "imageInput": true
          }
        }
      ]
    }
  ]
}
```

### DeepSeek

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "baseUrl": "https://api.deepseek.com/v1",
      "models": [
        {
          "id": "deepseek-chat",
          "name": "DeepSeek V3",
          "maxInputTokens": 65536,
          "maxOutputTokens": 8192,
          "capabilities": {
            "toolCalling": true,
            "imageInput": false,
            "thinking": false
          }
        },
        {
          "id": "deepseek-reasoner",
          "name": "DeepSeek R1",
          "maxInputTokens": 65536,
          "maxOutputTokens": 8192,
          "capabilities": {
            "toolCalling": true,
            "imageInput": false,
            "thinking": true,
            "thinkingEffort": "high"
          }
        }
      ]
    }
  ]
}
```

### Ollama（本地部署）

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "ollama",
      "name": "Ollama Local",
      "baseUrl": "http://localhost:11434/v1",
      "models": [
        {
          "id": "qwen2.5:7b",
          "name": "Qwen 2.5 7B",
          "maxInputTokens": 32768,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true
          }
        }
      ]
    }
  ],
  "copilot-custom-bridge.apiKey": "ollama"
}
```

> 💡 Ollama 本地部署不需要真实 API Key，可设置任意占位值。

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `Copilot Custom Bridge: 设置 API Key` | 为端点设置 API Key（安全存储） |
| `Copilot Custom Bridge: 清除 API Key` | 清除已存储的 API Key |
| `Copilot Custom Bridge: 自动探测模型` | 从端点自动获取可用模型列表 |
| `Copilot Custom Bridge: 打开诊断目录` | 打开 verbose 模式的请求转储文件夹 |
| `Copilot Custom Bridge: 开始使用` | 打开新手引导 Walkthrough |

## 配置项

| 配置 Key | 类型 | 默认值 | 说明 |
|---------|------|--------|------|
| `copilot-custom-bridge.endpoints` | `array` | `[]` | API 端点与模型列表 |
| `copilot-custom-bridge.apiKey` | `string` | `""` | 全局回退 API Key（不推荐，请用命令设置） |
| `copilot-custom-bridge.debugMode` | `string` | `"minimal"` | 调试模式：`minimal` / `metadata` / `verbose` |
| `copilot-custom-bridge.modelIdOverrides` | `object` | `{}` | 模型 ID 覆盖映射（代理场景） |
| `copilot-custom-bridge.maxTokens` | `number` | `4096` | 全局最大输出 token |

### 调试模式

| 模式 | 日志量 | 自动转储 | 适用场景 |
|------|--------|---------|---------|
| `minimal` | 仅错误和警告 | 否 | 日常使用 |
| `metadata` | + 请求元数据（URL、模型、Token） | 否 | 性能监控 |
| `verbose` | + 完整请求/响应内容 | **是**（自动轮转 50 个） | 问题排查 |

---

## 常见问题 (FAQ)

### 无法连接到 API 端点

**症状**：提示「无法连接到 API 端点」

**解决**：
1. 检查 `baseUrl` 是否正确（确保包含 `/v1` 后缀）
2. 检查网络连接和代理设置
3. 尝试在浏览器中访问 `{baseUrl}/models` 验证端点可达

### API Key 无效（401 错误）

**症状**：提示「API Key 无效」

**解决**：
1. 执行「设置 API Key」命令重新输入密钥
2. 确认密钥未过期、有足够的配额
3. 确认密钥格式正确（OpenAI: `sk-...`，DeepSeek: `sk-...`）

### 请求超时

**症状**：长时间无响应后提示「请求超时」

**解决**：
1. 检查网络延迟，特别是访问海外端点时
2. 如果使用代理，确认代理配置正确
3. 尝试降低 `maxTokens` 减少单次响应长度

### 模型不在选择器中显示

**症状**：模型选择器中没有配置的第三方模型

**解决**：
1. 确认 `copilot-custom-bridge.endpoints` 配置格式正确
2. 确认已为该端点设置了 API Key
3. 执行「Copilot Custom Bridge: 开始使用」检查配置步骤

### 如何开启详细诊断

设置 `debugMode` 为 `verbose` 后，所有请求/响应会自动转储到文件：

```json
{
  "copilot-custom-bridge.debugMode": "verbose"
}
```

通过「打开诊断目录」命令查看转储文件。API Key 已自动脱敏。

---

## 参与贡献

### 项目结构

```
src/
├── runtime/        # 扩展生命周期、命令注册
├── provider/       # LanguageModelChatProvider 核心
├── client/         # OpenAI HTTP 客户端（SSE 流式）
├── config.ts       # 配置管理
├── auth.ts         # 认证管理（SecretStorage）
├── i18n.ts         # 国际化翻译函数
├── logger.ts       # 日志与诊断转储
├── types.ts        # 全局类型定义
└── consts.ts       # 全局常量
```

### 编译与调试

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 调试（F5 启动 Extension Development Host）
# 在 VS Code 中按 F5 即可启动调试模式
```

### 代码规范

- TypeScript 严格模式（`strict: true`）
- ES6 语法标准（`const`/`let`、箭头函数、模板字符串）
- 零运行时依赖（仅使用 Node.js 内置模块）
- 代码注释使用英文，用户可见字符串通过 i18n 系统管理

## 要求

- VS Code ^1.85.0
- Node.js >= 18
