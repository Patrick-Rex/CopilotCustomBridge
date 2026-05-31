---
title: "Copilot Custom Bridge 技术架构设计"
updated: "2026-05-31"
---

# Copilot Custom Bridge 技术架构设计

## 1. 项目概述

Copilot Custom Bridge 是一个 VS Code 扩展，允许用户在 GitHub Copilot Chat 中使用任意 **OpenAI 兼容 API** 的第三方模型。用户通过 VS Code 的 `settings.json` 自由配置 API 端点、密钥和模型列表，实现与 Copilot Chat 的无缝集成。

### 1.1 核心目标

- 🪝 **零代码切换模型**：在 Copilot Chat 模型选择器中直接切换第三方模型
- ⚙️ **配置驱动**：所有配置通过 VS Code settings.json 完成，无需修改代码
- 🌐 **OpenAI 兼容**：支持所有兼容 OpenAI Chat Completions API 的第三方端点
- 🔧 **能力可配**：模型能力（工具调用、视觉、思考）可手动声明，也支持自动探测

### 1.2 技术栈

| 维度 | 选择 | 说明 |
|------|------|------|
| 主语言 | TypeScript | VS Code 扩展标准语言 |
| JS 标准 | **ES6 (ES2015+)** | 所有 `.js` / `.mjs` 脚本使用 ES6 模块语法 |
| TS 编译目标 | ES2022 | 与 VS Code ^1.85 内置 Node.js 版本对齐 |
| 模块系统 | CommonJS (`module: "commonjs"`) | VS Code 扩展加载机制要求 |
| Node.js | >= 18（推荐 24） | 通过 `.nvmrc` 锁定版本 |
| 包管理器 | npm | VS Code 扩展生态标准 |
| HTTP 客户端 | 原生 `fetch`（Node 18+） | 零外部依赖，与 deepseek-v4 一致 |
| API 协议 | OpenAI Chat Completions | `/chat/completions` SSE 流式 |
| 密钥存储 | VS Code `SecretStorage` | 安全的密钥持久化，非明文 settings |
| 模型配置 | VS Code `settings.json` | 用户自主配置端点与模型列表 |
| Linter | ESLint + oxlint（可选） | TypeScript 严格模式 |
| Formatter | oxfmt（推荐）/ Prettier | 单引号 + Tab 缩进 |
| 构建工具 | TypeScript Compiler (`tsc`) | 简单直接，无需 bundler |
| 国际化 | VS Code `package.nls.json` | 标准扩展国际化方案 |

#### 1.2.1 TypeScript 编译配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",         // VS Code 扩展规范
    "target": "ES2022",           // Node 18+ 原生支持
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,               // 严格模式全开
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true
  }
}
```

#### 1.2.2 JS 脚本约定 (ES6)

项目中独立 JS 脚本（`*.js` / `*.mjs`）必须遵循 ES6 规范：

- 使用 `const` / `let`，禁止 `var`
- 使用箭头函数 `() => {}`（除需要 `this` 绑定的场景）
- 使用模板字符串 `` `Hello ${name}` `` 替代字符串拼接
- 使用 `import` / `export` 替代 `require` / `module.exports`
- 使用 `async` / `await` 替代回调/Promise 链
- 使用解构赋值 `const { a, b } = obj`
- 使用展开运算符 `[...arr]` / `{...obj}`

#### 1.2.3 格式化约定

```jsonc
// .oxfmtrc.json (推荐)
{
  "singleQuote": true,
  "useTabs": true,
  "tabWidth": 2
}
```

#### 1.2.4 Lint 约定

```jsonc
// .oxlintrc.json (可选，与 ESLint 二选一)
{
  "plugins": ["typescript", "import"],
  "rules": {
    "typescript/no-unused-vars": "error"
  }
}
```

#### 1.2.5 依赖策略

- **零运行时依赖**：HTTP 请求使用 Node 18+ 内置 `fetch`，不做第三方 HTTP 库依赖
- **开发依赖最小化**：仅 `@types/vscode`、`@types/node`、`typescript`
- **锁定版本**：使用 `package-lock.json`，不提交 `node_modules`

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Copilot Chat                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                     Model Picker (模型选择器)                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │ GPT-4o   │  │ Claude   │  │ MyModel1 │  │ MyModel2 ... │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│              vscode.lm.registerLanguageModelChatProvider()            │
│                              │                                       │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│   Copilot Custom Bridge      │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   CustomBridgeProvider                        │   │
│  │  implements vscode.LanguageModelChatProvider                  │   │
│  │                                                               │   │
│  │  • provideLanguageModelChatInformation() → 模型列表             │   │
│  │  • provideLanguageModelChatResponse()    → 请求处理             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                  │
│         ▼                    ▼                    ▼                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   AuthManager │  │  RequestPipeline │  │  StreamHandler   │       │
│  │               │  │                  │  │                  │       │
│  │ • SecretStore │  │ • MessageConvert │  │ • SSE Parse      │       │
│  │ • Settings    │  │ • ToolPrepare    │  │ • Chunk Dispatch  │       │
│  │   fallback    │  │ • VisionResolve  │  │ • Token Calibrate│       │
│  └──────────────┘  └──────────────────┘  └──────────────────┘       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        ConfigManager                          │   │
│  │                                                               │   │
│  │  • getEndpoints()      → 端点列表 (baseUrl + apiKey)           │   │
│  │  • getModels()         → 模型定义列表                          │   │
│  │  • getModelCapability() → 模型能力 (tool/vision/thinking)       │   │
│  │  • autoDetectModels()  → 自动探测模型 (fallback)                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
              ┌─────────────────────────────────┐
              │  第三方 API (OpenAI 兼容)          │
              │  POST /chat/completions          │
              │  SSE streaming                   │
              └─────────────────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 配置系统 (`src/config.ts`)

#### 3.1.1 Settings 结构

```jsonc
// .vscode/settings.json 或用户设置
{
  "copilot-custom-bridge.endpoints": [
    {
      "id": "my-openai",
      "name": "My OpenAI Compatible API",
      "baseUrl": "https://api.openai.com/v1",
      // apiKey 不在此配置，通过命令或 SecretStorage 设置
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "family": "GPT-4o",
          "version": "1.0.0",
          "maxInputTokens": 128000,
          "maxOutputTokens": 16384,
          "capabilities": {
            "toolCalling": true,
            "imageInput": true,
            "thinking": false
          }
        }
      ]
    }
  ],
  // 全局 API Key（回退用，不推荐）
  "copilot-custom-bridge.apiKey": "",
  // 调试模式: "minimal" | "metadata" | "verbose"
  "copilot-custom-bridge.debugMode": "minimal",
  // 模型 ID 覆盖（用于代理场景）
  "copilot-custom-bridge.modelIdOverrides": {
    "gpt-4o": "azure-gpt-4o-deployment"
  }
}
```

#### 3.1.2 配置接口

```typescript
// 端点配置
interface EndpointConfig {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称（在模型选择器中作为 vendor）
  baseUrl: string;               // API 基础 URL
  models: ModelConfig[];         // 模型列表
  defaultHeaders?: Record<string, string>; // 额外请求头
}

// 模型配置
interface ModelConfig {
  id: string;                    // 模型 ID（发送给 API）
  name: string;                  // 显示名称
  family?: string;               // 模型家族
  version?: string;              // 版本
  maxInputTokens?: number;       // 最大输入 token
  maxOutputTokens?: number;      // 最大输出 token
  capabilities: ModelCapabilities;
}

// 模型能力
interface ModelCapabilities {
  toolCalling?: boolean | number; // false=不支持, true/128=支持, number=工具数量上限
  imageInput?: boolean;           // 是否支持图片输入
  thinking?: boolean;             // 是否支持思考/推理模式
}

// 全局配置
interface BridgeConfig {
  endpoints: EndpointConfig[];
  apiKey?: string;               // 全局回退 API Key
  debugMode: DebugMode;
  modelIdOverrides: Record<string, string>;
  maxTokens?: number;            // 全局最大输出 token
}
```

### 3.2 认证系统 (`src/auth.ts`)

```
┌──────────────────────────────────────────────────────┐
│                    AuthManager                        │
│                                                      │
│  getApiKey(endpointId): Promise<string | undefined>  │
│    │                                                 │
│    ├── 1. SecretStorage: "bridge.{endpointId}.apiKey"│
│    ├── 2. Settings fallback: config.apiKey           │
│    └── 3. 全局回退: copilot-custom-bridge.apiKey     │
│                                                      │
│  setApiKey(endpointId, key): Promise<void>           │
│  deleteApiKey(endpointId): Promise<void>             │
│  promptForApiKey(endpointId): Promise<boolean>       │
└──────────────────────────────────────────────────────┘
```

**优先级**：SecretStorage（安全） > Endpoint 配置 > 全局回退

### 3.3 Provider 核心 (`src/provider/index.ts`)

`CustomBridgeProvider` 实现 `vscode.LanguageModelChatProvider`：

```
provideLanguageModelChatInformation()
  │
  ├── 读取所有 endpoints 配置
  ├── 检查每个 endpoint 的 API Key 是否已配置
  ├── 将 ModelConfig[] 转换为 vscode.LanguageModelChatInformation[]
  └── 返回模型列表（含状态图标、配置 Schema）

provideLanguageModelChatResponse(messages, options, progress, token)
  │
  ├── 1. 参数校验 & API Key 检查
  ├── 2. 消息转换 (convert.ts)
  │     ├── VS Code Message → OpenAI Message
  │     ├── 处理 thinking part（如果有）
  │     └── 处理 tool call/result
  ├── 3. 工具准备 (tools/request.ts)
  │     ├── VS Code Tools → OpenAI Tools
  │     └── 工具数量上限检查
  ├── 4. 视觉处理 (vision/)
  │     ├── 检测图片消息
  │     ├── 调用视觉模型（如果配置）
  │     └── 将图片替换为文本描述
  ├── 5. 构建请求 (request.ts)
  │     ├── model, messages, tools, stream=true
  │     ├── temperature, max_tokens
  │     └── thinking 配置
  └── 6. 流式响应 (stream.ts → client/core.ts)
        ├── SSE 解析
        ├── content delta → LanguageModelTextPart
        ├── reasoning delta → LanguageModelThinkingPart
        ├── tool_calls delta → LanguageModelToolCallPart
        └── usage → token 校准
```

### 3.4 HTTP 客户端 (`src/client/core.ts`)

```typescript
class OpenAIClient {
  constructor(baseUrl: string, apiKey: string, defaultHeaders?: Record<string, string>);

  // SSE 流式请求
  async streamChatCompletion(
    request: OpenAIChatRequest,
    callbacks: StreamCallbacks,
    cancelToken?: vscode.CancellationToken
  ): Promise<void>;

  // 非流式请求（用于自动探测模型）
  async listModels(): Promise<ModelListResponse>;
}
```

**SSE 解析流程**：

```
HTTP Response
  │
  ├── 状态码检查（非 200 → 错误处理）
  ├── ReadableStream reader
  │
  └── 逐行解析 SSE
       │
       ├── "data: [DONE]" → 流结束
       ├── "data: {...}" → JSON 解析
       │     ├── choices[0].delta.content          → onContent()
       │     ├── choices[0].delta.reasoning_content → onThinking()
       │     ├── choices[0].delta.tool_calls        → onToolCall()
       │     └── usage                              → onUsage()
       └── 其他 → 跳过
```

### 3.5 消息转换 (`src/provider/convert.ts`)

**VS Code → OpenAI 格式映射**：

| VS Code Part | OpenAI Format |
|-------------|---------------|
| `LanguageModelTextPart` | `{ role, content: string }` |
| `LanguageModelThinkingPart` | `{ role: "assistant", reasoning_content: string }` |
| `LanguageModelToolCallPart` | `{ role: "assistant", tool_calls: [...] }` |
| `LanguageModelToolResultPart` | `{ role: "tool", tool_call_id, content }` |
| `LanguageModelChatMessageRole.System` | `{ role: "system", content }` |

**角色映射**：

```typescript
function mapRole(vscodeRole: LanguageModelChatMessageRole): string {
  // 注意：System = 3 是 VS Code 内部值，未暴露在 @types/vscode 中
  const SYSTEM_ROLE = 3;
  switch (vscodeRole) {
    case SYSTEM_ROLE: return 'system';
    case LanguageModelChatMessageRole.User: return 'user';
    case LanguageModelChatMessageRole.Assistant: return 'assistant';
    default: return 'user';
  }
}
```

### 3.6 模型自动探测 (`src/provider/detect.ts`)

当用户未手动声明模型能力时的回退机制：

```
autoDetectModels(endpoint: EndpointConfig): Promise<ModelConfig[]>
  │
  ├── 1. 调用 GET {baseUrl}/models（如果端点支持）
  │     └── 解析返回的模型列表
  │
  ├── 2. 对每个新模型发送最小探测请求
  │     └── 测试 tool_calls 是否在响应中
  │
  └── 3. 合并探测结果 & 缓存
```

---

## 4. 目录结构

```
CopilotCustomBridge/
├── .gitignore
├── package.json                # 扩展清单：贡献点、命令、激活事件
├── tsconfig.json
├── README.md
├── AGENTS.md
├── docs/
│   ├── spec/
│   │   ├── architecture.md     # 本文档
│   │   ├── ai-markdown.md
│   │   ├── csharp-coding-standard.md
│   │   └── python-encoding.md
│   └── guides/
│       └── configuration.md    # 用户配置指南
├── src/
│   ├── extension.ts            # 入口（转发到 runtime）
│   ├── types.ts                # 类型定义
│   ├── consts.ts               # 常量
│   ├── config.ts               # 配置读取
│   ├── auth.ts                 # 认证管理
│   ├── i18n.ts                 # 国际化
│   ├── json.ts                 # JSON 工具
│   ├── logger.ts               # 日志
│   ├── client/
│   │   ├── index.ts            # 导出
│   │   ├── core.ts             # OpenAI HTTP 客户端 (SSE)
│   │   ├── types.ts            # 客户端类型
│   │   └── error.ts            # 错误处理
│   ├── provider/
│   │   ├── index.ts            # CustomBridgeProvider 实现
│   │   ├── convert.ts          # 消息格式转换
│   │   ├── request.ts          # 请求构建
│   │   ├── stream.ts           # 流式响应处理
│   │   ├── models.ts           # 模型信息转换 (toChatInfo)
│   │   ├── tokens.ts           # Token 估算
│   │   ├── segment.ts          # 对话段追踪
│   │   ├── detect.ts           # 模型能力自动探测
│   │   ├── tools/
│   │   │   ├── consts.ts       # 工具常量
│   │   │   ├── request.ts      # 工具请求准备
│   │   │   └── flow.ts         # 工具流程（预飞等）
│   │   ├── vision/
│   │   │   ├── index.ts        # 视觉处理入口
│   │   │   ├── model.ts        # 视觉模型管理
│   │   │   ├── resolve.ts      # 图片解析
│   │   │   └── types.ts        # 视觉类型
│   │   └── debug/
│   │       ├── index.ts        # 调试导出
│   │       ├── dump.ts         # 请求转储
│   │       └── diagnostics.ts  # 诊断信息
│   └── runtime/
│       ├── index.ts            # 运行时导出
│       ├── lifecycle.ts        # activate / deactivate
│       ├── provider.ts         # 注册 Provider
│       ├── commands.ts         # 命令注册
│       └── welcome.ts          # 欢迎引导
└── resources/
    └── walkthrough/            # 引导页资源
```

---

## 5. 关键数据流

### 5.1 用户发送消息的完整链路

```
User types in Copilot Chat
        │
        ▼
Copilot Chat sends request
  → messages: LanguageModelChatRequestMessage[]
  → options: { model, tools, ... }
  → modelInfo: { id: "my-gpt-4o", vendor: "bridge-my-openai" }
        │
        ▼
CustomBridgeProvider.provideLanguageModelChatResponse()
        │
        ├── 1. 查找模型所属 endpoint
        ├── 2. 获取 API Key
        ├── 3. processToolFlow() — 处理工具预飞
        ├── 4. prepareChatRequest()
        │       ├── resolveImageMessages() — 视觉处理
        │       ├── convertMessages() — 消息转换
        │       ├── prepareRequestTools() — 工具转换
        │       └── buildRequest() — 构建 OpenAI 请求体
        ├── 5. streamChatCompletion()
        │       ├── OpenAIClient.streamChatCompletion()
        │       │     └── fetch() → SSE parse → callbacks
        │       └── callbacks → LanguageModelResponsePart[]
        └── 6. progress.report() back to Copilot Chat
```

### 5.2 配置变更流程

```
User edits settings.json
        │
        ▼
vscode.workspace.onDidChangeConfiguration
        │
        ├── affectsConfiguration('copilot-custom-bridge.endpoints')
        │     └── provider.refreshModelPicker()
        │           └── onDidChangeLanguageModelChatInformation.fire()
        │                 └── Copilot Chat re-queries provideLanguageModelChatInformation()
        │
        └── affectsConfiguration('copilot-custom-bridge.apiKey')
              └── provider.refreshModelPicker()
```

---

## 6. 扩展清单设计 (`package.json`)

### 6.1 核心贡献点

```jsonc
{
  "name": "copilot-custom-bridge",
  "displayName": "Copilot Custom Bridge",
  "description": "Use any OpenAI-compatible third-party model in GitHub Copilot Chat",
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    // 注册为语言模型提供商
    "languageModelChatProviders": [
      {
        "vendor": "copilot-custom-bridge",
        "displayName": "Copilot Custom Bridge"
      }
    ],
    "commands": [
      { "command": "copilot-custom-bridge.setApiKey", "title": "Set API Key" },
      { "command": "copilot-custom-bridge.clearApiKey", "title": "Clear API Key" },
      { "command": "copilot-custom-bridge.openSettings", "title": "Open Settings" },
      { "command": "copilot-custom-bridge.showLogs", "title": "Show Logs" },
      { "command": "copilot-custom-bridge.detectModels", "title": "Auto-detect Models" }
    ],
    "configuration": {
      "title": "Copilot Custom Bridge",
      "properties": {
        "copilot-custom-bridge.endpoints": { /* ... */ },
        "copilot-custom-bridge.apiKey": { /* ... */ },
        "copilot-custom-bridge.debugMode": { /* ... */ },
        "copilot-custom-bridge.modelIdOverrides": { /* ... */ },
        "copilot-custom-bridge.maxTokens": { /* ... */ }
      }
    }
  }
}
```

### 6.2 vendor 命名策略

由于 VS Code 的 `languageModelChatProviders` 按 `vendor` 分组，需要决定如何将多端点映射到 vendor：

**方案**：使用单 vendor `copilot-custom-bridge`，模型在 `family` 字段中区分端点来源。

```
vendor: "copilot-custom-bridge"
  ├── family: "my-openai"     → 模型来自 endpoint "my-openai"
  └── family: "my-deepseek"   → 模型来自 endpoint "my-deepseek"
```

---

## 7. 与 deepseek-v4-for-copilot 的关键差异

| 方面 | deepseek-v4-for-copilot | Copilot Custom Bridge |
|------|------------------------|----------------------|
| **厂商绑定** | 硬编码 DeepSeek | 无绑定，全配置驱动 |
| **端点配置** | 单 baseUrl + modelIdOverrides | 多端点数组，每端点独立配置 |
| **模型定义** | 内置 MODELS 常量数组 | 完全由用户 settings 定义 |
| **API 协议** | DeepSeek 扩展字段 (thinking) | 标准 OpenAI + reasoning_content |
| **认证** | 单 API Key SecretStorage | 多 Key 管理（每端点独立） |
| **模型探测** | 无（内置列表） | 支持自动探测模型能力 |

---

## 8. 实现优先级

### Phase 1: 最小可用 (MVP)
- [x] 基础项目结构搭建
- [ ] 配置系统（单端点 + 单模型）
- [ ] Auth Manager（SecretStorage）
- [ ] CustomBridgeProvider 骨架
- [ ] OpenAI Client（SSE 流式）
- [ ] 消息格式转换
- [ ] 基础命令（Set/Clear API Key）

### Phase 2: 多端点 & 高级功能
- [ ] 多端点支持
- [ ] 模型能力探测
- [ ] 工具调用支持
- [ ] 视觉处理
- [ ] Thinking/推理模式支持

### Phase 3: 体验完善
- [ ] 调试模式 & 请求转储
- [ ] 国际化 (i18n)
- [ ] 欢迎引导页
- [ ] 错误诊断 & 用户提示

---

> 📌 本文档基于对 `deepseek-v4-for-copilot` (v0.5.3) 的架构分析编写，沿用其经过验证的架构模式，同时针对通用化场景做了适配。
