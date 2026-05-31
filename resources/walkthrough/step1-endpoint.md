## 配置端点

要让 Copilot Custom Bridge 工作，首先需要在 VS Code 的 `settings.json` 中配置 API 端点。

### 操作步骤

点击下方按钮打开 `settings.json`，添加以下配置：

[打开 settings.json](command:workbench.action.openSettingsJson)

### 配置示例

```json
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "my-openai",
      "name": "My OpenAI Compatible API",
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

> 💡 支持所有 OpenAI 兼容的 API 端点，包括 DeepSeek、Ollama 等。
