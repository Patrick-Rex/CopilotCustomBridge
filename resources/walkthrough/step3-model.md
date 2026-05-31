## 选择模型开始对话

API Key 设置完成后，在 Copilot Chat 中切换到你的第三方模型即可开始使用。

### 操作步骤

1. 点击下方按钮打开 Copilot Chat：

   [打开 Copilot Chat](command:workbench.action.chat.open)

2. 在 Chat 面板顶部的模型选择器中，找到以你端点名称（如 "My OpenAI Compatible API"）为 family 的模型
3. 选择模型后即可发送消息

### 支持的功能

- 💬 **流式对话**：实时逐字输出
- 🔧 **Agent 模式**：文件读写、搜索、终端命令（需模型支持 tool calling）
- 🖼️ **图片理解**：粘贴截图让模型分析（需模型支持视觉或配置视觉代理）
- 🧠 **推理模式**：查看模型的思考过程（需模型支持 thinking）

> 💡 如需排查问题，可在 `settings.json` 中设置 `"copilot-custom-bridge.debugMode": "verbose"` 开启详细诊断。
