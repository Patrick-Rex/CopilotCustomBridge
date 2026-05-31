# Copilot Custom Bridge

在 VS Code Copilot Chat 中使用 OpenAI 兼容的第三方模型。

## 快速入门

### 1. 安装

```bash
# 从源码构建
npm install
npm run compile

# 或从 .vsix 安装
code --install-extension copilot-custom-bridge-0.0.1.vsix
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
          "maxOutputTokens": 4096
        }
      ]
    }
  ]
}
```

### 3. 设置 API Key

1. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）打开命令面板
2. 执行 **Copilot Custom Bridge: Set API Key**
3. 在弹出的输入框中输入 API Key（隐藏模式）

### 4. 选择模型对话

1. 打开 Copilot Chat
2. 在模型选择器中选择配置的第三方模型
3. 开始对话！

## 命令

| 命令 | 说明 |
|------|------|
| `Copilot Custom Bridge: Set API Key` | 设置 API Key（安全存储） |
| `Copilot Custom Bridge: Clear API Key` | 清除已存储的 API Key |

## 配置项

| 配置 | 类型 | 说明 |
|------|------|------|
| `copilot-custom-bridge.endpoints` | `array` | API 端点与模型列表 |
| `copilot-custom-bridge.debugMode` | `string` | 日志级别：`minimal` / `metadata` / `verbose` |
| `copilot-custom-bridge.maxTokens` | `number` | 全局最大输出 token |

## 要求

- VS Code ^1.85.0
- Node.js >= 18
