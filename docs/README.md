---
title: "Docs 索引"
updated: "2026-05-31"
---

# Docs 索引

本文档是 `docs/` 目录的唯一索引。任何 `docs/` 内文件的增删改 MUST 同步更新本索引。

## 目录结构

```text
docs/
├── README.md                    唯一索引（本文件）
├── design/                      架构设计、技术选型、组件交互、数据流
│   └── architecture.md          技术架构设计（spec-kit 代理 MUST 读取）
├── spec/                        编写规范、命名规范、代码审查清单
│   ├── ai-markdown.md           AI 优化 Markdown 规范
│   ├── csharp-coding-standard.md C# 代码编写规范
│   └── python-encoding.md       Python 脚本编码规范
└── guides/                      操作指南、环境搭建、故障排查
    └── configuration.md         用户配置指南（Phase 3 完善）
```

## 文件清单

| 文件 | 说明 |
|------|------|
| [design/architecture.md](design/architecture.md) | 技术架构设计 — 分层架构、模块边界、数据流、并发模型 |
| [spec/ai-markdown.md](spec/ai-markdown.md) | AI 优化 Markdown 规范 — `docs/` 下所有 `.md` 文件 MUST 遵循 |
| [spec/csharp-coding-standard.md](spec/csharp-coding-standard.md) | C# 代码编写规范 — 命名、格式、架构约定 |
| [spec/python-encoding.md](spec/python-encoding.md) | Python 脚本编码规范 — Windows 控制台中文乱码解决方案 |

## 相关 Spec

| 路径 | 说明 |
|------|------|
| [../specs/001-custom-bridge-mvp/spec.md](../specs/001-custom-bridge-mvp/spec.md) | Phase 1 MVP 功能规格 |
| [../specs/001-custom-bridge-mvp/plan.md](../specs/001-custom-bridge-mvp/plan.md) | Phase 1 MVP 实现计划 |
| [../specs/001-custom-bridge-mvp/tasks.md](../specs/001-custom-bridge-mvp/tasks.md) | Phase 1 MVP 任务清单 |
| [../specs/001-custom-bridge-mvp/quickstart.md](../specs/001-custom-bridge-mvp/quickstart.md) | 中文快速入门 |
| [../specs/001-custom-bridge-mvp/contracts/](../specs/001-custom-bridge-mvp/contracts/) | 接口合约（provider/client/config） |
| [../specs/002-advanced-capabilities/spec.md](../specs/002-advanced-capabilities/spec.md) | Phase 2 高级能力功能规格 |
| [../specs/002-advanced-capabilities/plan.md](../specs/002-advanced-capabilities/plan.md) | Phase 2 高级能力实现计划 |
| [../specs/002-advanced-capabilities/tasks.md](../specs/002-advanced-capabilities/tasks.md) | Phase 2 高级能力任务清单 |
| [../specs/002-advanced-capabilities/research.md](../specs/002-advanced-capabilities/research.md) | Phase 2 技术研究 |
| [../specs/002-advanced-capabilities/data-model.md](../specs/002-advanced-capabilities/data-model.md) | Phase 2 数据模型定义 |
| [../specs/002-advanced-capabilities/quickstart.md](../specs/002-advanced-capabilities/quickstart.md) | Phase 2 快速开始 |
| [../specs/002-advanced-capabilities/contracts/](../specs/002-advanced-capabilities/contracts/) | Phase 2 接口合约（client/config/provider） |
| [../README.md](../README.md) | 项目 README 中文快速入门 |
