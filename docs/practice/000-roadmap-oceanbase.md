# Agentic AI Engine：记忆子系统研究路线图

> **版本**: 1.1 (Fine-tuned)  
> **更新日期**: 2025-12-22  
> **基于调研**: [research/001-context-engineering.md](../research/001-context-engineering.md) | [research/002-google-agent-builder.md](../research/002-google-agent-builder.md)

## 1. 项目目标

本项目的核心目标是**为「Agentic AI Engine」寻找最佳的统一基础设施基座**，对标 **Google Vertex AI Agent Engine** 架构的 **Context Engineering** 与 **Memory Management** 能力。

本阶段的目标是验证 **OceanBase (SeekDB)** 是否能以 **"Unified Architecture" (单体架构)** 的形式，解决在构建生产级 Agent 平台时面临的 **架构复杂性、运维成本 (TCO)、研发体验 (DX) 以及跨云跨区部署 (Multi-Cloud/Geo-Distribution)** 等核心痛点，并提供等同甚至超越 Google **"Composed Architecture" (组合架构)** 的核心能力。

### 1.1 核心验证命题

1. **Best Core**: OceanBase (V4.5.0+) 是否是目前市场上最适合 Agentic AI 的 "All-in-One" 数据引擎？**一个 HTAP 数据库能否替代 "Redis + Vector DB + Document Store" 三件套？**
2. **Alternatives**: 是否存在架构更优、成本更低或生态更成熟的替代方案？
3. **Trade-offs**: 在一致性、实时性、运维简易度与部署灵活性之间，不同选型的取舍是什么？
4. **Integration**: 是否能与主流 Agent Framework（Google ADK、Agno、LangGraph、LlamaIndex）无缝集成？

### 1.2 Context Engineering 三大支柱（基于调研）

根据《Context Engineering 2.0》论文与主流框架实践，项目需覆盖 Context Engineering 的三大核心维度：

| 支柱                   | 定义                                         | OceanBase 验证点                         |
| :--------------------- | :------------------------------------------- | :--------------------------------------- |
| **Context Collection** | 收集用户输入、系统指令、对话历史、外部数据   | Session Events 高频写入性能              |
| **Context Management** | 分层存储（Short-term/Long-term）、压缩、隔离 | Memory Transfer (Session→Insight) 原子性 |
| **Context Usage**      | 检索与选择、动态组装、Token Budgeting        | Hybrid Search 延迟与召回率               |

## 2. 架构对比与选型维度

基于 Google Agent Architecture（参考 `assets/` 架构图）与调研报告，对标维度如下：

| 维度            | Google Agent Engine (Reference)                                                                                             | OceanBase (Candidate)                                                                                        | 验证核心                     |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **1. 架构模式** | **Composed (组合式)**<br>- Short-term: Memorystore (Redis)<br>- Long-term: Vertex Vector Search<br>- Preferences: Firestore | **Unified (统一式)**<br>- All-in-One: OceanBase (HTAP)<br>- Table: Log/JSON/KV<br>- Vector: Embedding Column | **架构复杂度 vs 能力完备性** |
| **2. 记忆管理** | **Memory Bank**<br>- 异步 ETL 流程 (Log → Insight)<br>- `MemoryService` 接口抽象                                            | **Unified Memory**<br>- 事务级强一致 (ACID)<br>- 原子性 "Consolidation"                                      | **Read-Your-Writes 延迟**    |
| **3. 检索链路** | **RAG Pipeline**<br>- Hybrid Search 需应用层拼装                                                                            | **DBMS Native**<br>- SQL 层面原生混合检索<br>- `DBMS_HYBRID_SEARCH`                                          | **检索延迟 vs 开发效率**     |
| **4. 框架集成** | `SessionService` + `MemoryService` 接口                                                                                     | `OceanBaseSessionService` + `OceanBaseMemoryService`                                                         | **ADK/LangGraph 兼容性**     |
| **5. 运维成本** | Serverless (Managed)                                                                                                        | Self-hosted / Cloud                                                                                          | **单集群 vs 多组件运维**     |
| **6. 跨域能力** | 多云（GCP、AWS、Azure）<br>多区域                                                                                           | 多地多活 (Paxos)                                                                                             | **跨区数据同步延迟**         |

### 2.1 当前预选型对照组

1. **OceanBase (SeekDB)**: 极简架构 (HTAP)，强一致性，多地多活 (Paxos)。(Primary Target)
2. **PostgreSQL Ecosystem**: 插件化架构 (pgvector + pg_cron)。(Baseline)
3. **Specialized Vector DBs**: Milvus / Weaviate / Pinecone。(Feature Comparison)
4. **Google Agent Engine Stack**: 原生 Reference 架构。(Reference)

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
