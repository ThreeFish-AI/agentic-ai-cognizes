# AGENTS.md

This file provides guidance to Claude Code / Antigravity when working with code in this repository.

## Project Overview

**一个专注于 Agentic AI 学术研究与工程应用方案定制的智能平台**，通过 Agents 协作，构建一个 **认知增强的学术研究助手**，为中文读者提供高质量的论文收集、翻译、理解、语义检索与应用服务。

- **内容采集**：自动化收集、解析 Agentic AI 领域前沿论文
- **深度翻译**：保持学术术语准确性的高质量中英互译
- **语义理解**：基于 GraphRAG 的论文关联分析与知识图谱构建
- **智能检索**：混合检索（关键词 + 向量 + 图谱）支持多跳推理
- **应用研究**：论文综述与趋势分析、技术选型参考、认知增强与可视化、认知应用方案定制

## 开发总则

- 最小充分性：充分获取和理解相关信息，如非显式说明，仅修改或增加必需内容；
- 语义连续性：保持篇幅整体意义连贯与自洽；
- 内容充分理解：对内容的任何操作都是以对内容充分阅读并深入理解为前提，而不是通过字符的模式匹配方式进行机械操作；
- 优先使用 Mermaid 作图说明：能用「图 + 文」进行清晰描述的内容，尽量使用 Mermaid 作图来加以说明；
- 如非显性要求，不要调用 git commit 进行变更提交；
- 如需创建执行计划、Teams、Phases 等临时文件，一律在 .temp/ 路径下进行，使用完这些文件后将之清理干净；

## Mermaid 作图注意事项

- 为 Mermaid 图中的节点或模块添加合适的颜色（注意我的 IDE 是深色主题）；
- 适当使用 subgraph 来组织「过于复杂的 Mermaid 图」，使整体更具逻辑性和可读性；

## 常用导航

- [🗺️ 项目路线](docs/000-roadmap.md) - 项目整体开发计划和进度
- [📖 系统架构](docs/001-architecture.md) - 架构设计和技术栈
- [💻 开发指南](docs/002-development.md) - 开发环境和代码规范
- [👥 用户手册](docs/003-user-guide.md) - 安装部署和使用教程
- [🧪 测试方案](docs/004-testing.md) - 测试框架和 CI/CD
- [🚀 GitHub Actions](docs/005-github-actions.md) - 自动化工作流
- [🤖 AI Agents](docs/006-agents.md) - Claude SDK 与 Google ADK 实现方案
- [📡 API 文档](docs/007-apis.md) - RESTful API 和 WebSocket 详细文档
