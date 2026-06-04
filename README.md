# Copilot Custom Bridge

在 VS Code Copilot Chat 中使用 OpenAI 兼容的第三方模型，例如 DeepSeek、MiniMax、Ollama 或自定义网关。

## 功能

- 在 Copilot Chat 模型选择器中直接选择第三方模型
- 通过 VS Code `settings.json` 配置端点、模型和能力
- 支持 OpenAI 兼容 `/chat/completions` SSE 流式接口
- 支持 Agent 模式工具调用
- 支持视觉模型直接接收图片，也支持通过视觉代理把图片转成文本描述
- 支持推理模型的 `reasoning_effort` 参数和 `<think>` 正文过滤
- API Key 使用 VS Code SecretStorage 安全存储
- 支持中英文界面

## 快速开始

### 1. 安装依赖并编译

```bash
npm install
npm run compile
```

也可以直接安装已打包的 `.vsix`：

```bash
code --install-extension copilot-custom-bridge-0.0.1.vsix
```

### 2. 配置模型端点

在 VS Code `settings.json` 中添加：

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "minimax",
      "name": "MiniMax",
      "baseUrl": "https://api.minimaxi.com/v1",
      "models": [
        {
          "id": "MiniMax-M2.7",
          "name": "MiniMax-M2.7",
          "maxInputTokens": 128000,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true,
            "thinking": true,
            "thinkingEffort": "high"
          }
        }
      ]
    }
  ]
}
```

### 3. 设置 API Key

1. 打开命令面板：`Ctrl+Shift+P`，macOS 为 `Cmd+Shift+P`
2. 执行 `Copilot Custom Bridge: 设置 API Key`
3. 选择端点并输入 API Key

### 4. 选择模型

打开 Copilot Chat，在模型选择器中选择配置的第三方模型即可开始对话。

## 图像功能配置

图像能力有两种配置方式：目标模型直接支持图片，或者目标模型不支持图片但使用视觉代理模型。

### 方式一：模型直接支持图片

如果模型本身支持图像输入，在模型能力中设置 `imageInput: true`。插件会把 VS Code 传入的图片转换成 OpenAI 兼容的 `image_url` 内容块发送给该模型。

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
            "imageInput": true
          }
        }
      ]
    }
  ]
}
```

也兼容 VS Code 新文档里的别名写法：`"vision": true`。推荐在本插件配置里继续使用 `capabilities.imageInput`，语义更明确。

### 方式二：使用视觉代理

如果当前对话模型不支持图片，可以在同一个端点下配置一个支持图片的代理模型。插件会先把图片发给代理模型生成文本描述，再把描述传给目标模型。

端点级 `visionProxy` 是默认代理；模型级 `capabilities.visionProxy` 可以覆盖默认值。

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "gateway",
      "name": "Custom Gateway",
      "baseUrl": "https://api.example.com/v1",
      "visionProxy": "gpt-4o",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o Vision Proxy",
          "maxInputTokens": 128000,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true,
            "imageInput": true
          }
        },
        {
          "id": "deepseek-chat",
          "name": "DeepSeek Chat",
          "maxInputTokens": 65536,
          "maxOutputTokens": 8192,
          "capabilities": {
            "toolCalling": true,
            "imageInput": false,
            "visionProxy": "gpt-4o"
          }
        }
      ]
    }
  ]
}
```

注意事项：

- 视觉代理目前要求代理模型和目标模型配置在同一个 `endpoint` 中，并共用该端点的 API Key。
- 代理模型自身必须配置 `capabilities.imageInput: true`。
- 如果没有配置视觉代理，且目标模型也没有 `imageInput: true`，图片会被替换成一条提示文本。
- 插件只会把 `mimeType` 以 `image/` 开头的数据当作图片处理，避免把 VS Code 的其他上下文数据误判为图片。

## 推理功能配置

如果模型支持 OpenAI 兼容的 `reasoning_effort`，可以配置：

```json
{
  "capabilities": {
    "thinking": true,
    "thinkingEffort": "high"
  }
}
```

可用值：`none`、`minimal`、`low`、`medium`、`high`、`max`。

说明：

- 当前 VS Code 第三方 `LanguageModelChatProvider` API 不提供思考深度下拉菜单控制字段，因此 `supportsReasoningEffort` 只作为配置兼容字段保留。
- 如果模型把思考过程输出在普通正文的 `<think>...</think>` 中，插件会过滤这段内容，避免直接显示在聊天面板。

## 配置示例

### MiniMax

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "minimax",
      "name": "MiniMax",
      "baseUrl": "https://api.minimaxi.com/v1",
      "models": [
        {
          "id": "MiniMax-M2.7",
          "name": "MiniMax-M2.7",
          "maxInputTokens": 128000,
          "maxOutputTokens": 4096,
          "capabilities": {
            "toolCalling": true,
            "thinking": true,
            "thinkingEffort": "high"
          }
        }
      ]
    }
  ]
}
```

如果该模型确认支持图片，再加：

```json
{
  "capabilities": {
    "toolCalling": true,
    "thinking": true,
    "thinkingEffort": "high",
    "imageInput": true
  }
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
            "imageInput": false
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

### Ollama

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

Ollama 本地部署不需要真实 API Key，可以设置任意占位值。

## 命令

| 命令 | 说明 |
| --- | --- |
| `Copilot Custom Bridge: 设置 API Key` | 为端点设置 API Key |
| `Copilot Custom Bridge: 清除 API Key` | 清除已存储的 API Key |
| `Copilot Custom Bridge: 自动探测模型` | 从端点自动获取可用模型列表 |
| `Copilot Custom Bridge: 打开诊断目录` | 打开 verbose 模式的请求转储文件夹 |
| `Copilot Custom Bridge: 开始使用` | 打开新手引导 |

## 配置项

| 配置 Key | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `copilot-custom-bridge.endpoints` | `array` | `[]` | API 端点与模型列表 |
| `copilot-custom-bridge.apiKey` | `string` | `""` | 全局回退 API Key，不推荐，优先使用设置 API Key 命令 |
| `copilot-custom-bridge.debugMode` | `string` | `"minimal"` | 调试模式：`minimal`、`metadata`、`verbose` |
| `copilot-custom-bridge.modelIdOverrides` | `object` | `{}` | 模型 ID 覆盖映射 |
| `copilot-custom-bridge.maxTokens` | `number` | `4096` | 全局最大输出 token |

### 模型能力字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `toolCalling` | `boolean \| number` | 是否支持工具调用；数字表示最多传递的工具数量 |
| `imageInput` | `boolean` | 是否支持图像输入 |
| `vision` | `boolean` | `imageInput` 的兼容别名 |
| `thinking` | `boolean` | 是否为推理模型 |
| `thinkingEffort` | `string` | 发送给 API 的推理力度 |
| `supportsReasoningEffort` | `string[]` | 兼容 VS Code BYOK 配置字段；第三方 Provider 暂不能用它驱动下拉菜单 |
| `visionProxy` | `string` | 覆盖端点级视觉代理模型 ID |

## 调试

设置 `debugMode` 为 `verbose` 后，请求和响应会自动转储到诊断目录，API Key 会脱敏。

```json
{
  "copilot-custom-bridge.debugMode": "verbose"
}
```

通过 `Copilot Custom Bridge: 打开诊断目录` 查看转储文件。

| 模式 | 日志量 | 自动转储 | 适用场景 |
| --- | --- | --- | --- |
| `minimal` | 仅错误和警告 | 否 | 日常使用 |
| `metadata` | 请求 URL、模型、Token 等元数据 | 否 | 性能监控 |
| `verbose` | 完整请求和响应内容 | 是 | 问题排查 |

## 开发与打包

### 项目结构

```text
src/
├── runtime/        # 扩展生命周期、命令注册
├── provider/       # LanguageModelChatProvider 核心
│   ├── tools/      # 工具调用转换
│   └── vision/     # 图像输入与视觉代理
├── client/         # OpenAI HTTP 客户端
├── config.ts       # 配置管理
├── auth.ts         # SecretStorage 认证管理
├── i18n.ts         # 国际化
├── logger.ts       # 日志与诊断转储
├── types.ts        # 全局类型定义
└── consts.ts       # 全局常量
```

### 本地开发

```bash
npm install
npm run compile
npm run lint
```

在 VS Code 中按 `F5` 启动 Extension Development Host，手动验证模型选择、普通文本、工具调用、图像输入和推理输出。

### 打包发布

```bash
# 1. 编译
npm run compile

# 2. 语法检查
npm run lint

# 3. 打包 .vsix
npx vsce package

# 4. 安装验证
code --install-extension copilot-custom-bridge-0.0.1.vsix
```

如果版本号发生变化，安装命令中的 `.vsix` 文件名需要同步替换。

## 常见问题

### 模型不在选择器中显示

1. 确认 `copilot-custom-bridge.endpoints` 是合法 JSON。
2. 确认端点 `id` 只包含字母、数字和连字符。
3. 确认已为该端点设置 API Key。
4. 打开输出面板查看 `Copilot Custom Bridge` 日志。

### 输入文字却被当作图片

请升级到包含图片识别修复的版本。插件现在只会把 `image/*` 类型的数据 part 当作图片处理。

### 图片没有被模型理解

1. 如果目标模型支持图片，确认配置了 `capabilities.imageInput: true`。
2. 如果目标模型不支持图片，确认配置了 `visionProxy`，且代理模型在同一个端点下并配置了 `imageInput: true`。
3. 开启 `verbose` 调试，确认请求体中是否包含 `image_url`。

### 思考内容显示为 `<think>...</think>`

部分模型会把思考过程放在普通正文中。插件会过滤 `<think>...</think>` 块；如果仍然显示，请打开 verbose 日志确认模型返回格式。

### API Key 无效

1. 重新执行 `Copilot Custom Bridge: 设置 API Key`。
2. 确认密钥未过期且有调用额度。
3. 确认端点使用的认证头符合服务商要求。

### 无法连接到 API 端点

1. 检查 `baseUrl` 是否包含 `/v1`。
2. 检查网络和代理设置。
3. 访问 `{baseUrl}/models` 验证端点是否可达。

## 要求

- VS Code `^1.85.0`
- Node.js `>= 18`
