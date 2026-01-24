# AGENTS.md

This file provides guidance to Claude Code/Antigravity when working with code/docs in this repository.

## 项目定位

This is a research repository focused on Agentic AI Cognizes, containing the following components (Cognizes Engine):

- Context Engineering
- Runtime
- RAG Engine (Agentic RAG、Graph RAG)
- Storage (DB、Vector DB、Graph DB)
- AG-UI
- CI/CD
- Monitor
- Evaluation

Cognizes Business Layer 见「docs/000-prd-architecture.md」的「产品愿景 · 核心定位」

## 开发总则

- **上下文充分性**：任何操作都是以对相关内容充分摄取、筛选、深入理解、实践归纳为前提，而不是通过文本字符的模式匹配等方式进行机械操作
- **最小充分性**：在充分获取上下文信息并深入理解需求、分析归纳解决方案后，如非显式说明，仅变更必需内容
- **语义连续性**：始终保持篇幅整体意义的连贯与自洽
- **引用权威文献**：文档中的核心内容（如算法、框架、方案、实现等）必须引用权威文献，引用文献统一采用 IEEE 格式
- **使用 Mermaid 图辅助说明**：能用「图 + 文」进行清晰描述的内容，尽量使用 Mermaid 作图来加以辅助说明
- **避免机械操作**：如非显性要求，不要调用 git commit 进行变更提交
- **临时文件清理**：如需创建执行计划、Teams、Phases 等临时文件，一律在 .temp/ 路径下进行，使用完这些文件后将之清理干净
- **URL 有消息**：所有提供的 URL 都需要验证有效性，即 URL 反问非 404，且该 URL 页面内容对引用它的主题具有真实助益作用

### 方法精要

核心理念：能抄不写，能连不造，能复用不原创。

- 道：上下文是 vibe coding 的第一性要素，垃圾进，垃圾出；奥卡姆剃刀定理，如无必要，勿增代码
- 法：借鉴经典，能抄不写，不重复造轮子，先问 AI 有没有合适的仓库，下载下来改
- 术：AI 犯的错误使用提示词整理为经验持久化存储，遇到问题始终无法解决，就让 AI 检索这个收集的问题然后寻找解决方案

Vibe Coding = 规划驱动 + 上下文固定 + AI 结对执行，让「从想法到可维护代码」变成一条可审计的流水线，而不是一团无法迭代的巨石文件。

## Mermaid 作图注意事项

- 为 Mermaid 图中的节点或模块添加合适的颜色（注意我的 IDE 是深色主题）
- 适当使用 subgraph 来组织「过于复杂的 Mermaid 图」，使整体更具逻辑性和可读性

## References 格式

引用文献列表统一采用 IEEE 格式。

> 编号 + 作者首字母缩写 + “文章标题,” + 期刊缩写（斜体）+ 卷, 期, 页码, 年份.

```latex
[1] A. Author, B. Author, and C. Author, "Title of paper," *Abbrev. Title of Journal*, vol. X, no. Y, pp. XX–XX, Year.
```

**示例：**

- 标注引用：

```markdown
内容<sup>[[1]](#ref1)</sup>
```

- 文献列举：

```latex
<a id="ref1"></a>[1] A. Vaswani, N. Shazeer, N. Parmar, et al., "Attention is all you need," Adv. Neural Inf. Process. Syst., vol. 30, pp. 5998–6008, 2017.
```

## 常用导航

- [🗺️ 产品需求与架构](docs/000-prd-architecture.md) - 产品需求与概要设计
- [� 实施计划](docs/001-implementation-plan.md) - Agentic AI 学术研究与工程应用平台实施计划
- [✅ 任务清单](docs/002-task-checklist.md) - 任务执行清单

---

## Cognizes Engine

- [🗺️ Engine 路线图](docs/engine/000-roadmap.md) - 项目整体开发计划和进度
- [📖 Engine 任务清单](docs/engine/001-task-checklist.md) - 任务清单
- [🫀 脉搏系统](docs/engine/010-the-pulse.md) - 脉搏系统
- [🧠 仿生记忆](docs/engine/020-the-hippocampus.md) - 仿生记忆
- [👁️ 神经感知](docs/engine/030-the-perception.md) - 神经感知
- [🔮 心智空间](docs/engine/040-the-realm-of-mind.md) - 心智空间
- [🚀 集成验证](docs/engine/050-integrated-demo.md) - 集成验证
- [🧩 Engine 架构记录](docs/engine/060-agentic-ai-engine.md) - Roadmap & TCO

### 研究

- [🤖 认知增强](docs/research/000-cognitive-enhancement.md) - 认知增强
- [📡 上下文工程](docs/research/010-context-engineering.md) - 上下文工程
- [🤖 Agent Runtime](docs/research/020-agent-runtime-frameworks.md) - Agent Runtime
- [📡 Vector Search Algorithm](docs/research/030-vector-search-algorithm.md) - Vector Search Algorithm
- [📡 Vector Databases Selection](docs/research/031-vector-databases-selection.md) - Vector Databases Selection
- [📡 Vector Databases](docs/research/032-vector-databases.md) - Vector Databases
- [📡 OceanBase](docs/research/033-oceanbase.md) - OceanBase 调研
- [📡 Knowledge Base](docs/research/034-knowledge-base.md) - RAG Pipeline & Hybrid Search
- [📡 Knowledge Base Platform](docs/research/035-knowledge-base-platform.md) - 腾讯 WeKnora 深度调研
- [📡 Cognee](docs/research/040-cognee.md) - Cognee
- [📡 Neo4j](docs/research/050-neo4j.md) - Neo4j
- [📡 Bettafish](docs/research/060-bettafish.md) - Bettafish
- [📡 AG-UI](docs/research/070-ag-ui.md) - AG-UI
- [📡 Agent Sandbox](docs/research/080-agent-sandbox.md) - Agent Sandbox
- [📡 Agent Evaluation](docs/research/090-agent-evaluation.md) - Agent Evaluation
- [📡 Agent Observability](docs/research/100-agent-obser.md) - Jaeger vs Langfuse
