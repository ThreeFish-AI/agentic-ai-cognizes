---
id: agentic-ai-engine-validation-roadmap
sidebar_position: 0
title: Agentic AI Engine Validation Roadmap
last_update:
  author: Aurelius Huang
  created_at: 2025-12-22
  updated_at: 2026-01-06
  version: 1.2
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

核心验证目标是**在私有化/自托管环境下，重构并验证「Agentic AI Engine」的完整工程能力**。不仅要"用" Agent，更要"造" Engine。我们致力于脱离 Google Vertex AI 的全托管黑盒服务，基于开源标准技术栈，对标并复刻 **Google Vertex AI Agent Engine** 的核心架构。

### 1.1 两大核心验证命题

1. **Agent Platform Engineering (Agent 平台工程验证)**：
   验证在脱离 Google Vertex AI Agent Engine 托管服务后，如何通过自建基础设施搭配 **Google ADK (Agent Development Kit)**，构建一套涵盖 **开发 (Dev)**、**测试 (Test)**、**评估 (Eval)** 到 **部署 (Ops)** 等的全链路 Agent 工程体系。

2. **Unified Search Platform (企业级统一搜索平台验证)**：
   验证构建一个"多模态、全能型"的 **企业级统一搜索平台 (Unified Search Platform)**。它不仅是 RAG Engine，通过 **PostgreSQL + PGVector** 的融合能力，同时实现 **语义检索 (Vector Search)**、**关键字搜索 (Keyword Search)** 与 **元数据过滤 (Metadata Filtering)** 等的统一调度。

### 1.2 现阶段执行目标 (Current Phase)

**"De-Google, but Re-Google"**，基于 **PostgreSQL + PGVector** 介质，**1:1 复刻甚至优化** Google Vertex AI Agent Engine 的关键原子能力：

- **Session Management**: 会话状态的原子性管理与持久化。
- **Memory Bank**: 长期记忆的"海马体"构建（存储、索引与提取）。
- **RAG Engine**: 高性能的混合检索链路。
- **Sandbox**: 安全可控的代码执行环境。

最终，使用这套自建的 **Agent Engine** 搭配 **Google ADK**，走通 Agent 搭建的 **全场景闭环**。

### 1.3 核心能力核验覆盖 (Features Coverage)

基于 **"De-Google, but Re-Google"** 战略，我们将 Google Vertex AI Agent Engine 的黑盒能力解构为以下四大可复刻的工程支柱。我们致力于构建一个更自主、更透明的 **"Glass-Box Engine" (白盒引擎)**，利用 PostgreSQL 生态的原子能力（JSONB, Vectors, Triggers, Notify）实现对标甚至超越原生服务的核心能力（**完整性 (Integrity)** 与 **颗粒度 (Granularity)**）。

#### 1.3.1 Stateful Session Engine (会话状态引擎) —— "The Pulse"

> [!NOTE]
>
> **对标**: Google `VertexAiSessionService` (Firestore/Redis) + Realtime API
> **核心职责**: 提供高并发、强一致、可回溯的会话上下文管理。

不再依赖外部缓存，利用 PostgreSQL 的强一致性构建稳健的会话状态管理：

- **ACID State Transitions**: 利用 PG 事务特性（Transactions）保证 `state_delta` 的原子性应用，并在高并发下通过行级锁（Row-Level Locking）彻底解决状态竞争，告别复杂的分布式锁维护。
- **Thread & Run Separation**: 细化状态颗粒度，区分 **Thread** (长期会话容器) 与 **Run** (单次执行链路)。Thread 负责用户级上下文的持久化，Run 负责推理过程中的中间状态 (Steps/Thoughts) 追踪。
- **Optimistic Concurrency Control (OCC)**: 利用 PG 的 `xmin` 系统列或版本号字段实现乐观并发控制，在无锁情况下解决多 Agent 同时写入同一 Session 的状态冲突难题。
- **JSONB Structured State**: 充分利用 PG 的 JSONB 类型，完整支持 ADK 的多级作用域机制（`user:`, `session:`, `app:`），提供媲美 NoSQL 的 Schema-less 灵活性与毫秒级读写性能。
- **Real-time Event Streaming**: 不仅仅记录状态快照，更记录完整的 `Events` append-only 日志，原生支持 **Time-Travel Debugging**（会话回放）与审计。利用 `LISTEN / NOTIFY` 机制构建轻量级 Pub/Sub，实现 Agent 推理事件 (Token Streaming, Tool Calls) 的毫秒级实时推送，对标 Server-Sent Events (SSE)。

#### 1.3.2 Bionic Memory System (仿生记忆系统) —— "The Hippocampus"

> [!NOTE]
>
> **对标**: Google `VertexAiMemoryBankService` (Vector Search + LLM Extraction)
> **核心职责**: 模拟人类记忆机制，实现短期记忆向长期记忆的动态转化。

构建这一系统的核心在于打破"存"与"算"的物理隔离：

- **Unified Storage ("Zero-ETL")**: 将 Session Log（海马体短期记忆）与 Narrative Memory（长期情景记忆）存储于同一个 PG 实例中。数据无需在 Redis、向量数据库和主库之间搬运，极大降低了 ETL 延迟与一致性风险。
- **Async Dual-Process Consolidation (Memory Sleep)**: 模拟人类大脑的睡眠机制，通过后台 Worker（基于 `pg_cron` 或外部服务）异步从 Session Log 中提炼 Insights，将其转化为向量化记忆而不阻塞主线程。
  - **Replay (回放)**: 基于 `pg_cron` 定期重放最近的 Session Events。
  - **Reflection (反思)**: 调用 LLM 提炼高层 Insights (Facts, Preferences, Summaries)，形成**语义记忆 (Semantic Memory)**。
- **Ebbinghaus Decay**: 引入"遗忘曲线"算法，基于时间衰减（Time Decay）与访问频率（Access Frequency）动态调整记忆权重，自动清理低价值噪音。
- **Episodic Indexing (情景索引)**: 对原始对话记录进行分块向量化，保留时间戳与原始上下文，形成**情景记忆 (Episodic Memory)**，用于具体细节的回溯。
- **Context Window Management**: 在数据库层实现 **"滑动窗口"**查询策略，根据 Token 预算自动组装 `System Prompt` + `Relevant Memories` + `Recent History`，精准控制上下文负载。

#### 1.3.3 Unified Neural Search (统一搜索神经中枢) —— "The Perception"

> [!NOTE]
>
> **对标**: Vertex AI RAG Engine + Vector Search + Enterprise Search
> **核心职责**: 提供多模态、混合与重排序的检索能力。

打造"多模态、全能型"的单一检索入口，拒绝应用层的复杂拼装：

- **One-Shot Retrieval**: 利用 PG 强大的查询优化器，在 **单次 SQL 查询**中同时完成 **语义检索 (HNSW)** + **关键词匹配 (BM25/tsvector)** + **元数据过滤 (Metadata Filtering)**。
- **Hybrid Search + Reranking**: 建立 **"Recall -> Rerank"** 两阶段链路。
  - **L0 (Recall)**: 利用 SQL 结合 `HNSW` (语义) + `BM25` (关键词) + `GIN` (元数据) 进行广度召回。
  - **L1 (Rerank)**: (可选) 集成轻量级 Cross-Encoder 模型 (如 `pgml` 或外部服务) 对召回结果进行重排序，大幅提升 Top-K 准确率。
- **Complex Metadata Filtering**: 不同于专用向量库受限的过滤能力，直接利用 PG 成熟的 B-Tree/GIN 索引处理复杂的业务过滤规则（如"查询最近一周、状态为 Active 且属于 Finance 部门的文档"）。
- **Iterative Filtering**: 利用 PGVector 的 HNSW 索引特性，支持复杂的**Pre-Filtering** (先过滤后检索) 场景，解决传统向量库在强过滤条件下召回率为零的问题。
- **Iterative Scan**: 利用 PGVector 的迭代扫描特性，完美解决"先过滤后检索"场景下的低召回率痛点。

#### 1.3.4 Open Agent Runtime (开放运行时) —— "The Cortex"

> [!NOTE]
>
> **对标**: Vertex AI Agent Engine (ADK on Agent Engine) + Extensions
> **核心职责**: 提供标准化的执行环境、工具管理与可观测性。

实现 **"Google's Framework, Your Infrastructure"** 的战略解耦：

- **Standard Implementation**: 1:1 基于 Google ADK 的 `SessionService` 与 `MemoryService` 接口标准，实现 Open Agent Runtime 与 Google ADK 的适配。
- **Vendor Agnostic**: 确保上层业务代码（基于 Google ADK 开发的 Agent 逻辑、Tool 定义）完全无感知底层是运行在 Vertex AI 上还是自建的 Postgres 集群上，实现零成本迁移。
- **Dynamic Tool Registry**: 不仅仅硬编码工具，而是在 PG 中建立 **Tool Registry** 表，存储 OpenAPI Schema、权限配置与执行统计。Agent 运行时动态加载可用工具集。
- **Execution Tracing Store**: 1:1 复刻 OpenTelemetry 结构，将 Agent 的思考过程 (Reasoning Steps)、工具调用 (Tool Inputs/Outputs) 与最终结果结构化存入 Trace 表，支持全链路可视化调试。
- **Sandboxed Execution**: 集成安全沙箱机制（执行环境：如 Docker 容器或 WebAssembly 运行时），确保 Python/Node.js 代码解释器 (Code Interpreter) 与自定义工具（Function Tools）的安全隔离运行。

## 2. 复刻架构拆解与核验点

基于 "Glass-Box Engine" 的构建目标，我们将 **Open Agent Engine (Target)** 与 **Google Vertex AI Agent Engine (Reference)** 进行全维度复刻对标。这不仅是基础设施选型的参考，更是 **Open Agent Engine** 自建路径的实践与印证。

| 全景模块                              | 维度           | Google Vertex AI Agent Engine (Reference Black-Box)                                                                                                                                       | Open Agent Engine (Target Glass-Box)                                                                                                                                    | 核心核验点                                                                                                         |
| :------------------------------------ | :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **The Pulse(脉搏)**<br>Session        | **架构模式**   | **Composed (组合式)**<br>- Short-term: Memorystore (Redis)<br>- Long-term: Vertex Vector Search<br>- Preferences: Firestore<br/>- Events: Pub/Sub。                                       | **Unified (统一式)**<br>- Transaction Log<br/>- JSONB State/KV<br/>- Vector: Embedding Column<br/>- `NOTIFY` 推送变更                                                   | - **架构复杂度 vs 能力完备性**<br/>- **并发一致性 (OCC):** 多 Agent 竞争下的数据正确性。                           |
| **The Hippocampus(海马体)**<br>Memory | **记忆管理**   | **ETL Pipeline (Memory Bank)**<br>- 异步 ETL 流程 (Log → Insight)：数据需在 Memorystore 与 Vector Search 之间物理搬运，存在同步延迟<br>- `MemoryService` 接口抽象                         | **Zero-ETL (Unified Memory)**<br>- Session Log (行存) 与 Context Vectors (向存) 同库存储，分析与回写零网络开销<br/>- 事务级强一致 (ACID)<br>- 原子性 "Consolidation"    | **记忆新鲜度 (Freshness, Read-Your-Writes)**<br>从"发生"到"可回忆"的时延。                                         |
| **The Perception(感知)**<br>Search    | **检索链路**   | **框架集成**<br/>- `SessionService` + `MemoryService` 接口<br/>**RAG Pipeline**<br>- <br/>**Service Assembly**<br>- 混合检索需要在应用层拼装 Keyword (Search) 与 Semantic (Vector) 结果。 | **框架集成**<br/>- `OpenSessionService` + `OpenMemoryService`<br/>**One-Shot SQL (DBMS Native)**<br>`DBMS_HYBRID_SEARCH`: 一次查询完成 SQL 过滤、关键词匹配与向量召回。 | **ADK/LangGraph 兼容性**<br/>**检索延迟 vs 开发效率**<br/>**复杂过滤性能**<br>高过滤比下的召回率与耗时。           |
| **The Cortex(运行时)**<br>Runtime     | **开放运行时** | **Opaque (黑盒)**<br/>- 仅可见 Input/Output 与计费 Token，内部推理步骤 (Reasoning Details) 不可见<br>**运维成本**<br/>- Serverless (Managed)                                              | **Observable (白盒)**<br>OpenTelemetry 级全链路追踪，完整记录 Thought Chain、Tool IO 与 Slot Updates<br/>**运维成本**<br/>- Self-hosted / Cloud<br/> - 多地多活 (Paxos) | **可调试性 (Debuggability)**<br>能否精准定位推理死循环或幻觉<br/>**单集群 vs 多组件运维**<br/>**跨区数据同步延迟** |

### 2.1 当前预选型对照组

1. **PostgreSQL Ecosystem (Primary Target)**:

   - **定位**: **"The Golden Standard"**。
   - **构成**: PostgreSQL 16+ (Kernel) + `pgvector` (Vector) + `pg_cron` (Scheduler) + `pg_jsonschema` (Validation)。
   - **优势**: 极致的开箱即用体验 (DX) 与全栈一致性，架构熵最低。

2. **Google Agent Engine Stack (Reference)**:

   - **定位**: **"The North Star"**。
   - **构成**: Vertex AI Agent Builder (ADK + Agent Engine)。
   - **价值**: 提供能力基准线 (Baseline Capabilities) 与 API 设计规范。

3. **Specialized Vector DBs (VectorChord/Weaviate/Milvus)**:

   - **定位**: **"Specific Enhancer"**。
   - **场景**: 仅当 PG 在千万级 (10M+) 向量规模出现显著性能瓶颈，或需要特定多模态索引 (如 DiskANN) 时作为组件引入。

## 3. 调研与验证执行计划

### 阶段一：基座部署与 Unified Schema 设计 (Foundation) ✅

- **任务 1.1: 部署与环境准备** ✅
  - 部署 OceanBase V4.5.0+ (Docker/K8s)
  - 验证 `VECTOR` 类型与 HNSW 索引参数 (`ef_construction`, `m`)
- **任务 1.2: "Unified Memory Bank" Schema 设计** ✅
  - 设计三类存储需求的统一 Schema：
    1. **Short-term (Session)**: `session_events` 表，替代 Redis
    2. **Episodic (Experience)**: `agent_memories` 表含向量列，替代 Vector Search
    3. **Semantic (Facts/Prefs)**: `session_state` JSON 列，替代 Firestore
  - 编写 10 个验证场景的 SQL 脚本
  - **产出**: `docs/001-foundation-unified-schema-design.md` ✅

### 阶段二：Memory Management (仿生 Google Memory Bank)

#### ADK Service 抽象适配策略

基于调研，OceanBase 适配层需实现以下 ADK 接口：

| ADK 接口         | 方法                                                                    | OceanBase 实现                                 |
| :--------------- | :---------------------------------------------------------------------- | :--------------------------------------------- |
| `SessionService` | `create_session()`, `get_session()`, `append_event()`, `update_state()` | SQL CRUD on `agent_sessions`, `session_events` |
| `MemoryService`  | `add_session_to_memory()`, `search_memory()`                            | LLM Extraction + Vector Insert + Hybrid Search |

- **任务 2.1: 异步记忆巩固 (Async Consolidation)**
  - **背景**: 实现 Memory Transfer 函数 $f_{transfer}: M_s \rightarrow M_l$
  - **开发**:
    - `src/simulation/memory_worker.py`: 实现 Session → Insight 的异步提炼
    - 核心函数：`consolidate_memory(session) -> List[Memory]`
  - **验证**:
    - 利用 OceanBase 事务实现 CAS 或原子合并，防止"记忆分裂"
    - 自动化 `docs/001` 中的场景 2 (Profiling) 与场景 3 (Summarization)
- **任务 2.2: "Read-Your-Writes" 一致性验证**
  - **开发**: `src/simulation/benchmark_consistency.py`
  - **核心**: 验证 Worker 完成 Insight 写入后，Main Agent 是否能**立即**检索到
  - **指标**: 可见性延迟 (Visibility Latency) 对比：OceanBase vs "PG + Milvus"
  - **产出**: `docs/003-oceanbase-evaluation.md` (实测数据报告)

### 阶段三：Context Engineering (RAG & Assembler)

#### 基于调研的 Context Engineering 策略

| 策略                    | 来源                           | OceanBase 实现方案                     |
| :---------------------- | :----------------------------- | :------------------------------------- |
| **Writing Context**     | LangGraph Scratchpad           | `session_events` append-only 日志      |
| **Selecting Context**   | Semantic + Recency + Frequency | `DBMS_HYBRID_SEARCH` + Time-decay 权重 |
| **Compressing Context** | ADK EventsCompactionConfig     | Stored Procedure 滑动窗口摘要          |
| **Isolating Context**   | Sub-Agent / Subgraph           | 多表隔离 + JOIN 组装                   |

- **任务 3.1: 统一检索链路 (Unified Retrieval)**
  - **背景**: 实现 Context Usage 的"检索与选择"能力
  - **验证**:
    ```sql
    SELECT * FROM memories
    WHERE vec_l2_distance(embedding, ?) < threshold
      AND user_id = ?
      AND created_at > ?
    ORDER BY (0.5 * vec_similarity + 0.3 * recency + 0.2 * frequency)
    LIMIT 10;
    ```
  - **对比**: Unified (SQL+Vector 一步) vs Two-Stage (Vector→SQL) 延迟差异
  - **指标**: Recall@10, Latency P50/P99
- **任务 3.2: 动态上下文组装 (Context Budgeting)**
  - **核心**: 在数据库层估算 Token 大小并执行 Top-K 截断
  - **方案**: 添加 `estimated_tokens` 列或 UDF，减轻应用层负担

### 阶段四：架构运维与框架集成 (Architecture & DX)

- **任务 4.1: TCO 对比分析**
  - 对比对象：
    - Google Stack (Simulated): Redis + Vector Search + Spanner
    - Specialized Stack: MySQL + Milvus + Redis
    - OceanBase Stack: Single Cluster
  - 验证：同等 QPS (1000 TPS) 下的资源消耗与运维工时
  - 验证：单节点故障 RTO
- **任务 4.2: 跨云跨区 (Cross-Region)**
  - 调研 OceanBase "三地五中心" 或 "主备库" 在 Agent 场景的应用
  - 验证 Geo-Replication 延迟
- **任务 4.3: Agent Framework 集成 (DX)**
  - **ADK Adapter (Priority 1)**:
    - 开发 `adk-oceanbase` Python 包
    - 实现 `OceanBaseSessionService` 和 `OceanBaseMemoryService`
    - **战略价值**: "Google's Framework, Your Data"
  - **LangGraph Adapter (Priority 2)**:
    - 实现 `Checkpointer` (State Persistence)
    - 实现 `VectorStore` (Memory Retrieval)
  - **Agno / LlamaIndex Adapter (Priority 3)**:
    - 评估 `Database` / `VectorStoreIndex` 接口复杂度
  - **产出**: `docs/005-dev-experience-report.md`

### 阶段五：Demo 与交付 (Integration)

- **任务 5.1: "Unified Agent Engine" Demo**
  - 实现端到端 Demo，展示从 Session 记录到 Memory 检索的全流程：
    - **Traceability**: 完整的 Session 回放
    - **Memory Scope**: 用户级 vs 会话级记忆隔离
    - **Context Assembly**: 动态上下文组装
  - **产出**: `src/prototype/unified_agent_backend.py`

## 4. 交付物汇总

| 阶段     | 交付物                                                 | 状态      |
| :------- | :----------------------------------------------------- | :-------- |
| Phase 1  | `docs/001-foundation-unified-schema-design.md`         | ✅ 完成   |
| Research | `research/001-context-engineering.md`                  | ✅ 完成   |
| Research | `research/002-google-agent-builder.md`                 | ✅ 完成   |
| Phase 2  | `docs/003-oceanbase-evaluation.md` (一致性延迟实测)    | 🔲 待开始 |
| Phase 3  | `docs/004-context-engineering-benchmark.md` (检索基准) | 🔲 待开始 |
| Phase 4  | `docs/005-dev-experience-report.md` (框架集成)         | 🔲 待开始 |
| Phase 4  | `docs/006-architecture-proposal.md` (架构决策白皮书)   | 🔲 待开始 |
| Phase 5  | `src/prototype/unified_agent_backend.py`               | 🔲 待开始 |
| Phase 5  | `src/adapters/adk-oceanbase/` (ADK 适配层)             | 🔲 待开始 |

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
