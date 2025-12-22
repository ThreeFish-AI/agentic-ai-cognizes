# AGENTS.md

This file provides guidance to Claude Code/Antigravity when working with code/docs in this repository.

## 核心定位

见「docs/000-prd-architecture.md」的「产品愿景 · 核心定位」

## 方法精要

核心理念：能抄不写，能连不造，能复用不原创。

- 道：上下文是 vibe coding 的第一性要素，垃圾进，垃圾出；奥卡姆剃刀定理，如无必要，勿增代码
- 法：借鉴经典，能抄不写，不重复造轮子，先问 AI 有没有合适的仓库，下载下来改
- 术：AI 犯的错误使用提示词整理为经验持久化存储，遇到问题始终无法解决，就让 AI 检索这个收集的问题然后寻找解决方案

Vibe Coding = 规划驱动 + 上下文固定 + AI 结对执行，让「从想法到可维护代码」变成一条可审计的流水线，而不是一团无法迭代的巨石文件。

## 开发总则

- **上下文充分性**：任何操作都是以对相关内容充分摄取、筛选、深入理解、实践归纳为前提，而不是通过文本字符的模式匹配等方式进行机械操作
- **最小充分性**：在充分获取上下文信息并深入理解需求、分析归纳解决方案后，如非显式说明，仅变更必需内容
- **语义连续性**：始终保持篇幅整体意义的连贯与自洽

- **使用 Mermaid 图辅助说明**：能用「图 + 文」进行清晰描述的内容，尽量使用 Mermaid 作图来加以辅助说明
- **避免机械操作**：如非显性要求，不要调用 git commit 进行变更提交
- **临时文件清理**：如需创建执行计划、Teams、Phases 等临时文件，一律在 .temp/ 路径下进行，使用完这些文件后将之清理干净

## Mermaid 作图注意事项

- 为 Mermaid 图中的节点或模块添加合适的颜色（注意我的 IDE 是深色主题）
- 适当使用 subgraph 来组织「过于复杂的 Mermaid 图」，使整体更具逻辑性和可读性

## 常用导航

- [🗺️ 项目路线](docs/000-roadmap.md) - 项目整体开发计划和进度
- [📖 系统架构](docs/001-architecture.md) - 架构设计和技术栈
- [💻 开发指南](docs/002-development.md) - 开发环境和代码规范
- [👥 用户手册](docs/003-user-guide.md) - 安装部署和使用教程
- [🧪 测试方案](docs/004-testing.md) - 测试框架和 CI/CD
- [🚀 GitHub Actions](docs/005-github-actions.md) - 自动化工作流
- [🤖 AI Agents](docs/006-agents.md) - Claude SDK 与 Google ADK 实现方案
- [📡 API 文档](docs/007-apis.md) - RESTful API 和 WebSocket 详细文档
