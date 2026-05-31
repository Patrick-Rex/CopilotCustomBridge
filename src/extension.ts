/**
 * 扩展入口 — 转发到 runtime/lifecycle
 *
 * 架构说明见 docs/design/architecture.md
 * runtime/ 层负责生命周期、命令注册、Provider 注册。
 */

export { activate, deactivate } from './runtime/lifecycle';
