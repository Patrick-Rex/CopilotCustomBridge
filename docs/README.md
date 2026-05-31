---
title: "Docs 索引"
updated: "2026-06-01"
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
    └── configuration.md         用户配置指南
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
| [../README.md](../README.md) | 项目 README — 完整中文使用说明 |
| [../specs/001-custom-bridge-mvp/](../specs/001-custom-bridge-mvp/) | Phase 1 MVP（spec/plan/tasks/quickstart/contracts） |
| [../specs/002-advanced-capabilities/](../specs/002-advanced-capabilities/) | Phase 2 高级能力（spec/plan/tasks/research/data-model/quickstart/contracts） |
| [../specs/003-production-experience/spec.md](../specs/003-production-experience/spec.md) | Phase 3 生产级体验功能规格 |
| [../specs/003-production-experience/plan.md](../specs/003-production-experience/plan.md) | Phase 3 实现计划 |
| [../specs/003-production-experience/tasks.md](../specs/003-production-experience/tasks.md) | Phase 3 任务清单 |
| [../specs/003-production-experience/research.md](../specs/003-production-experience/research.md) | Phase 3 技术研究 |
| [../specs/003-production-experience/data-model.md](../specs/003-production-experience/data-model.md) | Phase 3 数据模型定义 |
| [../specs/003-production-experience/quickstart.md](../specs/003-production-experience/quickstart.md) | Phase 3 快速开始 |
| [../specs/003-production-experience/contracts/](../specs/003-production-experience/contracts/) | Phase 3 接口合约（client/config） |
| [../specs/003-production-experience/checklists/](../specs/003-production-experience/checklists/) | Phase 3 质量检查清单 |
