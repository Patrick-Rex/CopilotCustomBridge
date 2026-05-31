---
title: "AI 优化 Markdown 规范"
updated: "2026-05-30"
---

# AI 优化 Markdown 规范

## 适用范围

`docs/` 目录下所有 `.md` 文件 MUST 遵循本规范。
目标受众为 AI 模型，可读性优先级：AI 解析准确性 > 人类审美。

## 结构规则

- 每个文件 MUST 有且仅有一个 H1 标题，位于文件首行（YAML frontmatter 之后）。
- 标题层级 MUST NOT 跳级：`#` → `##` → `###` 顺序使用，禁止 `#` 直接跳到 `###`。
- 每个 `##` 节 MUST 独立、自包含，AI 可以单节截取而不丢失上下文。
- 禁止使用 `---` 水平线作为节分隔符，避免与 YAML frontmatter 分隔符冲突。

## 代码与数据

- 所有 code block MUST 标注语言标识符：` ```csharp ` 而非 ` ``` `。
- JSON 或 YAML 示例 MUST 合法可解析，禁止使用 `...` 省略或注释。
- 文件路径 MUST 统一使用正斜杠 `/`，例如 `docs/spec/ai-markdown-spec.md`。
- Shell 命令 MUST 标注平台：` ```sh ` 用于跨平台命令，` ```powershell ` 用于 Windows 专用命令。

## 语言规则

- 主语 MUST 明确：使用「URL 转换器」「爬虫调度器」等具体名词，禁止使用「它」「这个」等代词。
- 量词 MUST 精确：使用「最多 3 次」「间隔 ≥ 2 秒」代替「几次」「适当延迟」。
- 每个列表项 MUST 以句号结尾，便于 AI 识别条目边界。
- 表格 MUST 有表头行和分隔行，禁止无表头表格。

## 元数据

- 每个文件 MUST 以 YAML frontmatter 开头：

```yaml
---
title: "文档标题"
updated: "2026-05-30"
---
```

## 禁止项

- 禁止 emoji 及 `:emoji:` 简码，AI 跨模型解析不稳定。
- 禁止 HTML 标签，包括 `<div>`、`<span>`、`<img>`，纯 Markdown 优先。
- 禁止 ASCII art 图表，使用 Mermaid 代码块替代。
- 禁止 `[click here](#)` 式无意义链接文本，链接文本 MUST 描述目标内容。
- 禁止行内样式，包括 `<style>` 标签和 `style=` 属性。
