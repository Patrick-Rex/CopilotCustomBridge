## 设置 API Key

配置端点后，需要为端点设置 API Key。API Key 会**安全存储**在 VS Code 的 SecretStorage 中，不会明文写入配置文件。

### 操作步骤

1. 点击下方按钮执行「设置 API Key」命令：

   [设置 API Key](command:copilot-custom-bridge.setApiKey)

2. 在弹出的下拉列表中选择你配置的端点
3. 在密码输入框中粘贴 API Key（输入内容不可见，确保安全）

> 🔒 API Key 存储在操作系统的加密存储中（Windows Credential Manager / macOS Keychain / Linux libsecret），不会出现在 `settings.json` 中。
>
> ⚠️ 不要在 `settings.json` 中明文填写 API Key。
