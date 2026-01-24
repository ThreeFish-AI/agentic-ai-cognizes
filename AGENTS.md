本文件旨在规范 AI Agent（Claude Code、Antigravity 等）在本项目中的代码与文档协作行为。

## 项目定位

本项目定位于 **Agentic AI Cognizes（认知增强）** 领域的学术研究与工程实践，核心聚焦于 **Cognizes Engine（认知引擎）** 的基础设施构建。该引擎采用 **仿生架构（Bionic Architecture）** 设计，涵盖：

- **🫀 The Pulse（脉搏系统）**：会话状态管理与实时心跳 (Session/State)
- **🧠 The Hippocampus（仿生记忆）**：记忆整合、衰减与长短期记忆存储 (Memory Bank)
- **👁️ The Perception（神经感知）**：多模态内容摄取、混合检索与 RAG 管道 (Hybrid Search)
- **🔮 The Realm of Mind（心智空间）**：Agent 运行时、工具注册与编排调度 (Runtime/Tools)
- **Infrastructure**：PostgreSQL All-in-One 三位一体存储与全链路可观测性 (O11y)

## 开发总则

- **Context-Driven Development (CDD)**：坚持上下文驱动，任何变更需建立在对相关代码/文档的 Context 充分摄取与深度理解之上，严禁基于关键字匹配的机械式修改。
- **Systemic Integrity (系统完整性)**：具备全局视角的系统思维，评估变更对上下游依赖及整个生态（Engine, Adapter, Agent, UI）的“涟漪效应”，优先保障全局稳定性而非局部最优。
- **Second-Order Thinking (二阶思维)**：不只关注变更的直接结果，更要预测“结果的结果”（如引入缓存导致的陈旧数据、重试机制引发的雪崩），未雨绸缪防范隐性风险。
- **Boundary Management (边界管理)**：清晰定义模块/Agent 间的职责边界与契约，严控跨边界的隐式依赖，确保系统模块的高内聚低耦合。
- **Minimal Effective Intervention (最小有效干预)**：遵循奥卡姆剃刀原则，在确保方案完整性的前提下，仅实施必要的变更，避免过度设计与范围蔓延。
- **Logical Consistency (逻辑自洽)**：维护文档与代码的整体连贯性，确保不仅语法正确，且在业务逻辑与架构设计上保持高度自洽。
- **Feedback Loops (反馈闭环)**：构建“设计-实现-验证”的完整闭环，确保每一项工程行动都能产生可观测的反馈信号（测试、日志、监控），以验证假设并指导迭代。
- **Evidence-Based (循证工程)**：核心设计决策（算法、架构等）需以权威文献（IEEE 格式）为佐证，杜绝主观臆断。
- **Visual Documentation (可视化优先)**：对于复杂逻辑，优先采用 Mermaid 图表（Sequence/Flowchart/Class 等）辅助说明，构建「图文并茂」的直观文档。
- **Operational Excellence (卓越运营)**：
  1. **Git Hygiene**: 如非显性要求，严禁调用 git commit；
  2. **Temp Management**: 临时产物（执行计划等）一律收敛至 `.temp/` 并及时清理；
  3. **Link Validity**: 确保所有引用的 URL 可访问且具备明确的上下文价值。

### 方法精要

**核心理念：Reuse-Driven Development (复用驱动开发)**。优先组合与集成，通过连接成熟组件构建系统，而非重复造轮子。

- **道 (Principles)**：**Context Quality First**。上下文质量决定产出上限 (GIGO)；遵循奥卡姆剃刀与 YAGNI 原则，如无必要，勿增实体。
- **法 (Strategies)**：**Composition over Construction**。优先采用业界成熟的开源方案与最佳实践；通过“拿来主义”站在巨人的肩膀上进行微创新。
- **术 (Tactics)**：**Evolutionary Design (演进式设计)**。将系统视为有机体，通过将 AI 错误转化为经验约束 (Negative Prompts) 和持久化知识，实现系统的自我进化与熵减。

**Vibe Coding 定义**：**Vibe Coding = Specification-Driven (规划驱动) + Context-Anchored (上下文锚定) + AI-Pair Programming (AI 结对)**。
旨在将「从 Idea 到 Code」的过程固化为一条**可审计、可迭代的工程流水线**，避免代码腐化为无法维护的“大泥球 (Big Ball of Mud)”。

## Mermaid 可视化规范

- **色彩语义与兼容性**：为图表节点配置具备语义辨识度的色彩，并确保在深色模式（Dark Mode）下具有极高的对比度与清晰度。
- **逻辑模块化解构**：针对业务跨度较大的架构流程，强制采用 `subgraph` 容器进行层级解构与边界划分，以增强图表的自解说（Self-explaining）能力。

## 参考文献引用规范 (IEEE Style)

为保障工程决策的可追溯性与学术严谨性，核心引用需遵循 **IEEE 标准引用格式**。

> **模版准则**：[编号] 作者缩写. 姓, "文章标题," _刊名/会议名缩写 (斜体)_, 卷号, 期数, 页码, 年份.

```latex
[1] A. Author, B. Author, and C. Author, "Title of paper," *Abbrev. Title of Journal*, vol. X, no. Y, pp. XX–XX, Year.
```

### 引用实践

- **文内锚定**：采用标准上标链接形式：`描述内容<sup>[[1]](#ref1)</sup>`。
- **文献索引**：底层采用 HTML 锚点 `id` 实现跳转稳定性。

```latex
<a id="ref1"></a>[1] A. Vaswani et al., "Attention is all you need," Adv. Neural Inf. Process. Syst., vol. 30, pp. 5998–6008, 2017.
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
