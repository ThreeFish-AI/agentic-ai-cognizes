---
id: agentic-ai-engine-validation-roadmap
sidebar_position: 0
title: Agentic AI Engine Validation Roadmap
last_update:
  author: Aurelius Huang
  created_at: 2025-12-22
  updated_at: 2026-01-07
  version: 1.3
  status: Pending Review
tags:
  - Agentic AI Engine
  - Memory Bank
  - RAG Engine
  - Validation Roadmap
---

> [!NOTE]
>
> **基于调研**: [context-engineering](../research/010-context-engineering.md) | [agent-runtime-frameworks](../research/020-agent-runtime-frameworks.md) | [vector-search-algorithm](../research/030-vector-search-algorithm.md) | [vector-databases](../research/032-vector-databases.md)

## 1. 验证目标

核心验证目标是 **在私有化/自托管环境下，重构并验证「Agentic AI Engine」的完整工程能力**。不仅要"用" Agent，更要"造" Engine。我们致力于脱离 Google Vertex AI 的全托管黑盒服务，基于开源标准技术栈，对标并复刻 **Google Vertex AI Agent Engine** 的核心架构。

### 1.1 两大核心验证命题

1. **Agentic AI Engine Engineering (Agent Engine 工程验证)**：
   验证在脱离 Google Vertex AI Agent Engine 托管服务后，如何通过自建基础设施搭配 **Google ADK (Agent Development Kit)**，构建一套涵盖 **开发 (Dev)**、**测试 (Test)**、**评估 (Eval)** 到 **部署 (Ops)** 等的全链路 Agent 工程体系。

2. **Unified Retrieval Platform (企业级统一检索平台验证)**：
   验证构建一个"多模态、全能型"的 **企业级统一检索平台 (Unified Retrieval Platform)**。它不仅是 RAG Engine，通过 **PostgreSQL + PGVector** 的融合能力，同时实现 **语义检索 (Vector Search)**、**关键字搜索 (Keyword Search)** 与 **元数据过滤 (Metadata Filtering)** 等的统一调度。

### 1.2 现阶段执行目标 (Current Phase)

**"De-Google, but Re-Google"**，基于 **PostgreSQL + PGVector** 存储介质，**1:1 复刻（甚至更优）** Google Vertex AI Agent Engine 的关键原子能力：

- **Session Management**: 会话状态的原子性管理与持久化。
- **Memory Bank**: 长期记忆的"海马体"构建（存储、索引与提取）。
- **Retrieval Engine**: 高性能的混合检索链路。
- **Sandbox**: 安全可控的代码执行环境。

最终，使用这套自建的 **Agent Engine** 搭配 **Google ADK**，走通 Agent 搭建的 **全场景闭环**。

### 1.3 四大核心支柱 (The 4 Pillars of Verification)

我们将 **Agentic AI Engine** 的黑盒能力解构为四个 **正交 (Orthogonal)** 的工程支柱。通过 **"Glass-Box (白盒化)"** 策略，利用 PostgreSQL 生态的原子能力（JSONB, Vectors, Triggers, Notify）实现对 Google Vertex AI 中这 4 个支柱的对标、复刻与机制透明化，从而 **"De-Google, but Re-Google"**。

#### 🫀 Pillar I: The Pulse (脉搏引擎)

> [!NOTE]
>
> - **Definition**: **Session Engine** —— 负责管理 Agent 与环境交互的 **瞬时状态 (Ephemeral State)** 与 **控制流 (Control Flow)**。
> - **Core Value**: **Consistency (一致性：可回溯的会话上下文)** & **Real-time (实时性：高并发、强一致)**。
> - **Align With**: Google `VertexAiSessionService` (Firestore/Redis) + Realtime API。

1. **State Granularity (状态颗粒度)**
   - **Thread (会话容器)**: 持久化存储用户级交互历史（Human-Agent Interaction），作为长期记忆的输入源。
   - **Run (执行链路)**: 临时存储单次推理过程中的 Thinking Steps 和 Tool Calls，仅在执行期间存活，保障推理的可观测性。
2. **Concurrency Control (并发控制)**
   - **Optimistic Locking (乐观锁)**: 利用 PG `xmin` 实现 `CAS (Compare-And-Swap)`，解决多 Agent 或多用户同时操作同一 Thread 时的状态竞争。
   - **Atomic Transitions (原子流转)**: 利用 PG 事务确保 `User Message -> Agent State Update -> Tool Execution` 这一连串动作的原子性。
3. **Event Streaming (事件流)**
   - **Real-time Pub/Sub**: 利用 `LISTEN/NOTIFY` 机制替代 Redis Pub/Sub，实现 Token Streaming 和 Tool Outputs 的毫秒级前端推送。

#### 🧠 Pillar II: The Hippocampus (仿生记忆)

> [!NOTE]
>
> - **Definition**: **Memory System** —— 负责将瞬时状态转化为 **持久记忆 (Persistent Memory)** 的生命周期管理系统。
> - **Core Value**: **Evolution (演化性：短期记忆向长期记忆的动态转化)** & **Relevance (关联性：模拟人类记忆机制)**。
> - **Align With**: Google `VertexAiMemoryBankService` (Vector Search + LLM Extraction)。

1. **Memory Formation (记忆形成)**
   - **Zero-ETL Unified Storage**: 摒弃 `Redis (App)` + `VectorDB (Mem)` 的割裂架构。Session Log (Raw Events) 与 Semantic Memory (Vectors) 存入同一 PG 库，实现 **"写入即记忆"**。
   - **Dual-Process Consolidation (双重巩固)**:
     - **Fast Replay (快回放)**: `pg_cron` 定期重放最近的 Session Events。
     - **Deep Reflection (深反思)**: 异步 Worker 调用 LLM 提炼高阶 Insights (Facts/Preferences)，形成语义记忆。
2. **Memory Retention (记忆保持)**
   - **Ebbinghaus Decay (艾宾浩斯衰减：遗忘曲线)**: 引入 `(Time_Decay * Access_Frequency: 时间衰减 * 访问频率)` 权重算法，自动通过 `pg_cron` 清理低价值记忆（噪音），模拟生物遗忘机制。
   - **Episodic Indexing (情景分块)**: 对原始对话记录进行分块向量化，持原始对话的时序与上下文结构（Episodic Memory：情景记忆），支持按时间切片 (Time-Slicing) 进行精准回溯。
   - **Context Window**: 在数据库层实现 **"滑动窗口"** 查询策略，根据 Token 预算自动组装 `System Prompt` + `Relevant Memories` + `Recent History`，精准控制上下文负载。

#### 👁️ Pillar III: The Perception (神经感知)

> [!NOTE]
>
> - **Definition**: **Unified Search** —— 负责从海量记忆与知识中 **精准定位 (Pinpoint)** 信息的检索中枢。
> - **Core Value**: **Precision (精准度：重排序、精排序)** & **Fusion (融合性：多模态、混合的检索能力)**。
> - **Align With**: Vertex AI RAG Engine + Vector Search + VertexAIMemoryBankService。

1. **Fusion Retrieval (融合检索)**
   - **One-Shot SQL (L0 Rerank)**: 利用 `DBMS_HYBRID_SEARCH` 在单次查询中融合 **Lexical (BM25)** + **Semantic (HNSW)** + **Structural (Metadata)** 三种信号。
   - **Post-Retrieval Reranking**: 引入轻量级 Cross-Encoder 模型 (L1 Rerank) 对 PG 召回的粗排结果进行语义重排，解决向量检索的"语义漂移"问题。
2. **Advanced Filtering (高阶过滤)**
   - **Iterative Indexing**: 利用 PGVector 的 HNSW 迭代扫描特性，彻底解决 "High-Selectivity Filtering" (高过滤比) 场景下向量检索召回率为 0 的痛点。
   - **Complex Predicates**: 支持基于 JSONB 的任意深度的布尔逻辑过滤 (如 `metadata->'author'->>'role' == 'admin'`)。

#### 🔮 Pillar IV: The Realm of Mind (心智空间)

> [!NOTE]
>
> - **Definition**: **Agent Runtime** —— 负责编排思考路径、调度工具与沙箱的 **执行环境 (Execution Environment)**。
> - **Core Value**: **Observability (可观测性：自省性)**、**Safety (安全性：标准化的执行环境、工具管理)**、**"Google's Framework, Flexible Infrastructure"**。
> - **Align With**: Vertex AI Agent Engine (ADK on Agent Engine) + Extensions。

1. **Execution Orchestration (执行编排)**
   - **Standard Interface**: 1:1 实现 Google ADK 的 `SessionService` 与 `MemoryService` 协议，保障上层业务逻辑与下层 Framework (ADK) 及 Runtime (Open Agent Engine) 集成的 **Vendor Agnostic (供应商无关)**。
   - **Dynamic Tool Registry**: 建立数据库驱动的工具注册表，支持 OpenAPI Schema 的动态加载与热更新，而非硬编码。集成权限配置与执行统计等能力。
2. **Glass-Box Tracing (白盒追踪)**
   - **Structured Reasoning**: 将 LLM 的 `Chain-of-Thought` 显式结构化存入 Trace 表，而非仅作为文本日志（1:1 复刻 OpenTelemetry 结构，记录思考过程 (Reasoning Steps)、工具调用 (Tool Inputs/Outputs) 与最终结果，支持全链路可视化调试）。
   - **Sandboxed Execution**: 集成安全沙箱机制（执行环境：如 Docker 容器或 WebAssembly 运行时），确保 Python/Node.js 代码解释器 (Code Interpreter) 与自定义工具（Function Tools）的安全隔离运行。

## 2. 架构对标矩阵

基于上述四支柱，我们将 **"Glass-Box"** 的 **Open Agent Engine** 架构目标与 **Google Vertex AI Agent Engine** 进行全维度对标印证、复刻实践。

### 2.1 架构验证矩阵

| 全景模块                         | 维度          | Google Vertex AI Agent Engine (Align With - Black-Box)                                                                                                                                                            | Open Agent Engine (Target - Glass-Box)                                                                                                                                             | 核心核验指标 (KPI)                                                                                                          |
| :------------------------------- | :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **The Pulse (脉搏引擎)**         | **Session**   | **Composed (组合式)**<br>- Short-term (State): Memorystore (Redis)<br>- Long-term: Vertex Vector Search<br>- Preferneces: Firestore<br/>- Events: Pub/Sub (Stream)<br>**框架集成**<br>- `SessionService` 接口抽象 | **Unified (统一式)**<br>- Transaction Log<br/>- JSONB State/KV<br/>- Vector: Embedding Column<br/>- `NOTIFY` 推送变更<br>**框架集成**<br/>- `OpenSessionService`                   | **架构复杂度 vs 能力完备性**<br/>**并发一致性 (OCC):**<br>- 多 Agent 竞争下的数据正确性或覆盖的概率。                       |
| **The Hippocampus (仿生记忆)**   | **Memory**    | **ETL Pipeline (Memory Bank)**<br>- 异步 ETL 流程 (Log → Insight)：数据需在 Memorystore 与 Vector Search 之间物理搬运，存在同步延迟<br>**框架集成**<br>- `MemoryService` 接口抽象                                 | **Zero-ETL (Unified Memory)**<br>- Session Log (行存) 与 Context Vectors (向存) 同库存储，分析与回写零网络开销<br/>- 事务级强一致 (ACID)<br>**框架集成**<br/>- `OpenMemoryService` | **记忆新鲜度 (Freshness)**<br>- 从"发生"到"可回忆"的时延。                                                                  |
| **The Perception (神经感知)**    | **Retrieval** | **RAG Pipeline**<br>- 需应用层自行拼装 Keyword (Search) 与 Semantic (Vector) 结果。                                                                                                                               | **One-Shot SQL (DBMS Native)**<br>- `DBMS_HYBRID_SEARCH`: 一次查询完成 SQL 过滤、关键词匹配与向量召回。                                                                            | **ADK/LangGraph 兼容性**<br/>**检索延迟 vs 开发效率**<br/>**Recall@10 (with Filters)**<br>- 高过滤比下的召回率与耗时。      |
| **The Realm of Mind (心智空间)** | **Runtime**   | **Opaque (黑盒)**<br/>- 仅可见 Input/Output 与计费 Token，内部推理步骤 (Reasoning Details) 不可见<br>**运维成本**<br/>- Serverless (Managed)                                                                      | **Observable (白盒)**<br>- OpenTelemetry 级全链路追踪<br>- 完整记录 Thought Chain、Tool IO 与 Slot Updates<br/>**运维成本**<br/>- Self-hosted / Cloud<br/> - 多地多活 (Paxos)      | **可调试性 (Debuggability)**<br>- 能否精准定位推理死循环或幻觉，所需时间。**单集群 vs 多组件运维**<br/>- 跨区数据同步延迟。 |

### 2.2 预选型对照

1. **PostgreSQL Ecosystem (Primary Target)**:

   - **定位**: **"The Golden Standard"**。
   - **构成**: PostgreSQL 16+ (Kernel) + `pgvector` (Vector) + `pg_cron` (Scheduler) + `pg_jsonschema` (Validation)。
   - **优势**: 极致的开箱即用体验 (DX) 与全栈一致性，架构熵最低。

2. **Google Agent Engine Stack (Reference)**:

   - **定位**: **"The North Star"**。
   - **构成**: Open Agent Engine (适配 ADK)。
   - **价值**: 提供能力基准线 (Baseline Capabilities) 与 API 设计规范。

3. **Specialized Vector DBs (VectorChord/Weaviate/Milvus)**:

   - **定位**: **"Specific Enhancer"**。
   - **场景**: 仅当 PG 在千万级 (10M+) 向量规模出现显著性能瓶颈，或需要特定多模态索引 (如 DiskANN) 时作为组件引入。

## 3. 验证执行计划

本计划严格依照前述 **四大正交支柱** 进行拆解，确保每个模块的工程实现均能对标并优于 Google Vertex AI 的黑盒方案。

### Phase 1：Foundation & The Pulse (基座与脉搏验证)

> [!NOTE]
>
> **Goal**: 构建 PostgreSQL + PGVector 统一存储基座，并验证 **Session Engine (The Pulse)** 的高并发与强一致性。

- [ ] **1.1: Environment & Unified Schema Design (部署与模型设计)**
  - **Deploy**: 部署 PostgreSQL 16+ (Kernel), `pgvector` (0.7.0+), `pg_cron` (Scheduler)。
  - **Schema**: 设计统一存储模型 `agent_schema.sql`：
    - `threads` (Human-Agent Interaction)
    - `runs` (Ephemeral Thinking Loop)
    - `events` (Immutable Stream)
    - `messages` (Content with Embedding)
- [ ] **1.2: The Pulse Implementation (脉搏机制实现)**
  - **Atomic State Transitions**: 使用 PG 事务 (`BEGIN...COMMIT`) 实现 `User Msg -> State Update -> Tool Call` 的原子流转，验证 `0` 脏读/丢失。
  - **Real-time Streaming**: 开发 `pg_notify_listener.py`，验证基于 `LISTEN/NOTIFY` 的事件流推送延迟 (< 50ms)，替代 Redis Pub/Sub。
  - **Optimistic Concurrency**: 模拟多 Agent 并发更新同一会话状态，验证 `CAS` (Compare-And-Swap) 机制的冲突处理能力。

### Phase 2：The Hippocampus (仿生记忆验证)

> [!NOTE]
>
> **Goal**: 实现 **Zero-ETL** 的记忆生命周期管理，验证从 "Short-term" 到 "Long-term" 的无缝流转。

- [ ] **2.1: Memory Consolidation (记忆巩固机制)**
  - **Async Consolidation**: 开发后台 Worker (`pg_cron` 触发)，执行 `consolidate_memory()`：
    - **Fast Replay**: 将最近 `events` 压缩为 `summary`。
    - **Deep Reflection**: 异步调用 LLM 提取 `Key-Facts` 并写入 `facts` 向量表。
  - **Verification**: 验证 "写入即记忆" (Read-Your-Writes)，对比 Google "Log -> ETL -> Vector DB" 的同步延迟。
- [ ] **2.2: Biological Retention (遗忘与保持)**
  - **Ebbinghaus Decay**: 实现基于时间的权重衰减算法，自动清理低频访问的 Short-term 记忆。
  - **Episodic Indexing**: 验证按 `session_id` + `time_bucket` 的情景分块检索性能。

### Phase 3：The Perception (神经感知验证)

> [!NOTE]
>
> **Goal**: 构建 **One-Shot Integrated** 检索链路，验证 "SQL + Vector" 融合检索的精度与效率。

- [ ] **3.1: Fusion Retrieval (融合检索链路)**
  - **Implementation**: 开发 `hybrid_search()` 存储过程，单次调用实现：
    - **Keyword**: `tsvector` 全文检索 (BM25)。
    - **Semantic**: `vector` 相似度检索 (HNSW)。
    - **Structural**: JSONB Metadata 过滤。
  - **RRF Fusion**: 在数据库内实现倒排秩融合 (Reciprocal Rank Fusion)。
- [ ] **3.2: Advanced Filtering & Reranking**
  - **High-Selectivity**: 构造高过滤比场景 (Filtering 99% data)，验证 HNSW `ef_search` 参数对召回率的影响。
  - **L1 Reranking**: 集成轻量级 Cross-Encoder，对 PG 返回的 Top-20 结果进行精排，评估 `Recall@10` 提升幅度。

### Phase 4：The Realm of Mind (心智与集成验证)

> [!NOTE]
>
> **Goal**: 实现 **Glass-Box Runtime**，并完成与 **Google ADK** 的标准化集成。

- [ ] **4.1: The Realm of Mind Implementation (运行时实现)**
  - **Orchestration Loop**: 开发 Python 驱动的 `AgentExecutor`，管理 `Thought -> Action -> Observation` 循环。
  - **Tool Registry**: 实现数据库驱动的 `tools` 表，支持 OpenAPI Schema 动态加载。
  - **Glass-Box Tracing**: 集成 OpenTelemetry，将思考步骤结构化写入 `traces` 表，实现可视化调试。
- [ ] **4.2: Google ADK Adapter (框架集成)**
  - **Interface Compliance**: 开发 `adk-postgres` 适配器，实现：
    - `PostgresSessionService` (implements `SessionService`)
    - `PostgresMemoryService` (implements `MemoryService`)
  - **E2E Testing**: 使用 Google Vertex AI Agent Builder 的官方 Demo，无缝替换后端存储为 PostgreSQL，验证功能由 Glass-Box 引擎接管。

### Phase 5：Integrated Demo & Final Validation (综合集成验证)

> [!NOTE]
>
> **Goal**: 通过复刻 Google 官方高复杂度 Demo (e.g., Travel Agent)，验证 **Open Agent Engine** 在真实业务场景下的闭环能力与 "Glass-Box" 优势。

- [ ] **5.1: E2E Scenario Replication (全场景复刻)**
  - **Subject**: 选取 Google Cloud ADK 官方仓库中的 `Travel Agent` 或 `E-commerce Support` 示例。
  - **Modification**: 保持其前端与 Prompt 逻辑不变，仅将后端 `Session/Memory/Search` 接口切至 `adk-postgres` 适配器。
  - **Outcome**: 验证 Agent 从"对话开启"到"订单完成"的全流程 0 报错，且响应延迟与原生 Google Stack 相当。
- [ ] **5.2: Holistic Pillar Validation (四支柱协同验证)**
  - **Pulse Check**: 验证在高并发多轮对话中，Session 状态 (State) 无脏读或丢失。
  - **Memory Check**: 验证用户偏好 ("I hate spicy food") 能在后续跨 Session 对话中被 `Hippocampus` 自动召回。
  - **Perception Check**: 验证模糊查询 ("Suggest some chill places") 能正确融合关键词与向量检索结果。
  - **Mind Check**: 使用 OpenTelemetry 可视化工具 (e.g., Jaeger/Signoz) 完整追踪一次复杂推理的 Trace 链路，确认 Step-by-Step 的透明度。

## 4. 交付物汇总

| 阶段        | 交付物模块            | 文件/代码路径                                                                                | 状态      |
| :---------- | :-------------------- | :------------------------------------------------------------------------------------------- | :-------- |
| **Phase 1** | **Foundation**        | `src/schema/agent_schema.sql` (Unified Schema)                                               | 🔲 待开始 |
|             | **The Pulse**         | `src/engine/pulse/transaction_manager.py`<br>`docs/001-pulse-concurrency-report.md`          | 🔲 待开始 |
| **Phase 2** | **The Hippocampus**   | `src/engine/hippocampus/consolidation_worker.py`<br>`docs/002-memory-freshness-benchmark.md` | 🔲 待开始 |
| **Phase 3** | **The Perception**    | `src/engine/perception/retrieval_fusion.sql`<br>`docs/003-hybrid-search-evaluation.md`       | 🔲 待开始 |
| **Phase 4** | **The Realm of Mind** | `src/engine/mind/executor.py`<br>`src/adapters/adk_postgres/` (Adapter Package)              | 🔲 待开始 |
| **Phase 5** | **Integrated Demo**   | `demos/e2e_travel_agent/` (Replicating Google Demo)                                          | 🔲 待开始 |

## 5. 工程验证 Roadmap

### 5.1 Phase 2: Memory Management

**论文指导**：记忆分层架构 + 记忆迁移机制

**行动建议**：

1. **短期记忆 (Session Log)**

   - 使用 PG 表存储 `session_events`（append-only）
   - 利用 PG 事务保证 `state_delta` 的原子应用

2. **长期记忆 (Insights)**

   - 设计 `agent_memories` 表，包含向量列
   - 实现 Memory Transfer 函数：
     ```python
     def consolidate_memory(session: Session) -> List[Memory]:
         # 1. 提取 session.events 中的关键信息
         # 2. 使用 LLM 生成 Insight
         # 3. 向量化 Insight
         # 4. 原子写入 agent_memories 表
     ```

3. **记忆选择策略**
   - 实现基于 Recency + Frequency + Semantic Similarity 的混合检索
   - 利用 `DBMS_HYBRID_SEARCH` 实现 SQL 层面的混合检索

### 5.2 Phase 3: Context Engineering (RAG & Assembler)

**论文指导**：Context Compression + Context Isolation + Proactive Inference

**行动建议**：

1. **统一检索链路**

   - 在单次 SQL 查询中同时检索 Session Context + Long-term Memory
   - 实现 `PGMemoryService.search_memory()` 返回 Fused Context

2. **上下文压缩**

   - 参考 ADK 的 EventsCompactionConfig 设计
   - 在 PG 中可通过 Stored Procedure 或应用层实现滑动窗口摘要

3. **动态上下文组装 (Context Budgeting)**
   - 在数据库层估算 Token 大小
   - 实现 Top-K 截断，确保不超过 Context Window

### 5.3 Phase 4: Framework Integration

**论文指导**：上下文共享 + 跨 Agent 通信

**行动建议**：

1. **ADK Adapter 优先**

   - 实现 `PGSessionService` 和 `PGMemoryService`
   - 遵循 ADK 的 Service 抽象，确保与 Google 生态的兼容性

2. **多框架支持**

   - 为 LangGraph 实现 `Checkpointer` + `VectorStore` 双角色
   - 为 Agno 实现 `Database` 接口

3. **A2A Protocol 预研**
   - 关注 Google 的 Agent-to-Agent 开放协议
   - 考虑 PG 作为 Agent 间上下文共享的中央存储

## 5. 结合 Roadmap 的课题与行动建议

基于上述调研，对 `docs/000-roadmap.md` 的主要课题进行细化：

### 5.1 Phase 2: Memory Management (仿生 Google Memory Bank)

- **Google 做法**:
  1.  `SessionService` 管理 Session 生命周期。
  2.  `MemoryService.add_session_to_memory()` 或 `generate_memories()` 触发异步 Extraction/Consolidation。
  3.  Memory Bank 使用 LLM 提取 Insights，支持 TTL 和 Memory Revisions。
- **Adoption**:
  1.  在 OceanBase 中设计 `agent_sessions` 表存储 Events 和 State。
  2.  设计 `agent_memories` 表存储提炼后的 Insights (包含向量列)。
  3.  实现一个后台 Worker（或 OceanBase Trigger/Scheduled Task），定期从 `sessions` 提取数据，调用 LLM 生成 Insight，写入 `memories`。
- **验证点**: 验证 OceanBase 的 **事务** 能否保证 "Session 更新 + Memory 更新" 的原子性，避免 "记忆分裂"。

### 5.2 Phase 3: Unified Retrieval (Context Engineering)

- **Google 做法**: ADK 的 `MemoryService.search_memory()` 返回相关记忆，开发者需手动拼接到 Prompt。
- **OB 优势**: 可通过 SQL View 或 Stored Procedure 封装 `DBMS_HYBRID_SEARCH`，在单次 SQL 查询中同时检索 Session Context + Long-term Memory。
- **行动**: 在 `OceanBaseMemoryService.search_memory()` 的实现中，直接返回一个包含 Session State 和 Long-term Insights 的 **Fused Context**。

### 5.3 Phase 4: Framework Integration (ADK Adapter)

- **现状**: Google ADK 的 `VertexAiSessionService` 和 `VertexAiMemoryBankService` 强绑定 Vertex AI API。
- **机会**: 社区缺乏 "On-Premises / Private Cloud" 的 ADK Service 实现。
- **行动**:
  1.  开发 `adk-oceanbase` Python 包，提供 `OceanBaseSessionService` 和 `OceanBaseMemoryService`。
  2.  让开发者使用 Google 的 ADK 框架代码（Agent 定义、Tool 定义），仅通过配置切换底层 Storage 到 OceanBase。
  3.  **战略价值**: **"Google's Framework, Your Data"**。

## 7. 结论

1.  **架构可行性**: 尝试使用 PG 的物理架构承载 Google Agent Builder 的逻辑架构（Session + State + Memory 三层抽象，以及 `SessionService` / `MemoryService` 接口）。
2.  **核心差异**: 最大的 gap 在于 **"Async Memory Consolidation"** 的实现。Google 有现成的托管服务 (Memory Bank)，而利用 PG 需要我们在应用层（Python Worker）或数据库层（Scheduled Task）构建这套异步提炼机制。
3.  **下一步行动**:
    - **Phase 2**: 设计 `agent_sessions` 和 `agent_memories` 表，实现 Memory Consolidation Worker。
    - **Phase 4**: 开发 `adk-pg` Python 包，将 ADK 的 `SessionService` 和 `MemoryService` 接口适配到 PG。
