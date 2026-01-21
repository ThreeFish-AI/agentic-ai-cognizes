---
id: the-hippocampus-implementation
sidebar_position: 2.0
title: Phase 2：The Hippocampus 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-08
  updated_at: 2026-01-12
  version: 1.1
  status: Pending Review
tags:
  - The Hippocampus
  - Memory System
  - Implementation Plan
  - PostgreSQL
  - Zero-ETL
---

> [!NOTE]
>
> **文档定位**：本文档是 [000-roadmap.md](./000-roadmap.md) Phase 2 的详细工程实施方案，用于指导「**The Hippocampus (仿生记忆)**」的完整落地验证工作。涵盖技术调研、架构设计、代码实现、测试验证等全流程。
>
> **前置依赖**：本阶段依赖 [010-the-pulse.md](./010-the-pulse.md) Phase 1 的完成，需复用其统一存储基座 (Unified Schema) 和会话管理能力。

---

## 1. 执行概览

### 1.1 Phase 2 定位与目标

**Phase 2: The Hippocampus** 是整个验证计划的记忆核心阶段，对标人类大脑的**海马体 (Hippocampus)** —— 负责将短期记忆转化为长期记忆的关键脑区。核心目标是：

1. **实现 Zero-ETL 记忆架构**：摒弃传统 `Redis (App)` + `VectorDB (Mem)` 的割裂架构，Session Log 与 Semantic Memory 同库存储
2. **验证记忆巩固机制**：实现从 Short-term 到 Long-term 的无缝流转（Fast Replay + Deep Reflection）
3. **验证生物遗忘机制**：实现艾宾浩斯衰减算法，自动清理低价值记忆
4. **验证 Context Budgeting**：实现动态上下文组装，精准控制 Token 预算

```mermaid
graph LR
    subgraph "Phase 2: The Hippocampus"
        F[Phase 1 基座<br>Session Engine] --> H1[Memory Consolidation<br>记忆巩固]
        F --> H2[Biological Retention<br>遗忘与保持]
        F --> H3[Context Budgeting<br>上下文预算]
    end

    H1 & H2 & H3 --> V[Verification<br>验收通过]
    V --> Phase3[Phase 3: Perception]

    style F fill:#065f46,stroke:#34d399,color:#fff
    style H1 fill:#7c2d12,stroke:#fb923c,color:#fff
    style H2 fill:#7c2d12,stroke:#fb923c,color:#fff
    style H3 fill:#7c2d12,stroke:#fb923c,color:#fff
```

### 1.2 核心概念解析

#### 1.2.1 记忆类型与生物学类比

基于认知科学研究<sup>[[1]](#ref1)</sup>和 LangGraph Memory 设计<sup>[[2]](#ref2)</sup>，我们将 Agent 记忆系统对标人类记忆的三种类型：

| 记忆类型              | 生物学定义                     | Agent 等价物             | 存储策略                | 对应表            |
| :-------------------- | :----------------------------- | :----------------------- | :---------------------- | :---------------- |
| **Semantic Memory**   | 事实性知识（"巴黎是法国首都"） | 用户偏好、业务规则       | 结构化 Key-Value + 向量 | `facts` 表        |
| **Episodic Memory**   | 情景记忆（"昨天我去了哪里"）   | 对话历史、交互上下文     | 时序分块 + 向量嵌入     | `memories` 表     |
| **Procedural Memory** | 程序性知识（"如何骑自行车"）   | 工具使用规则、Agent 指令 | 指令模板 + 版本控制     | `instructions` 表 |

#### 1.2.2 记忆生命周期

```mermaid
graph TB
    subgraph "记忆形成 (Memory Formation)"
        E[Events 事件流] --> FR[Fast Replay<br>快回放]
        FR --> S[Summary 摘要]
        E --> DR[Deep Reflection<br>深反思]
        DR --> F[Facts 语义记忆]
    end

    subgraph "记忆存储 (Memory Storage)"
        S --> M[Memories 表<br>情景记忆]
        F --> M
    end

    subgraph "记忆保持 (Memory Retention)"
        M --> D[Decay 衰减计算]
        D --> C{Retention Score}
        C -->|高分| K[保留]
        C -->|低分| R[清理]
    end

    subgraph "记忆使用 (Memory Usage)"
        K --> CW[Context Window<br>上下文组装]
        CW --> P[Prompt 输出]
    end

    style E fill:#065f46,stroke:#34d399,color:#fff
    style M fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style CW fill:#7c2d12,stroke:#fb923c,color:#fff
```

### 1.3 对标分析：Google ADK MemoryService

基于 Google ADK 官方文档<sup>[[3]](#ref3)</sup>的分析，我们需要复刻以下核心能力：

| ADK 核心概念                  | 定义                                                 | PostgreSQL 复刻策略             |
| :---------------------------- | :--------------------------------------------------- | :------------------------------ |
| **MemoryService**             | 跨会话的可搜索知识库管理接口                         | `OpenMemoryService` 类实现      |
| **Memory**                    | 从对话中提取的结构化知识片段                         | `memories` 表 + `facts` 表      |
| **add_session_to_memory()**   | 将 Session 转化为可搜索的记忆                        | `consolidate()` 函数 (LLM 提取) |
| **search_memory()**           | 基于 Query 检索相关记忆                              | PGVector 向量检索 + JSONB 过滤  |
| **VertexAiMemoryBankService** | Google 托管的 Memory Bank 实现 (Vector Search + LLM) | PostgreSQL 自建等价实现         |

#### 1.3.1 ADK MemoryService 接口契约

```python
class BaseMemoryService(ABC):
    """Memory 管理服务抽象基类"""

    @abstractmethod
    async def add_session_to_memory(
        self,
        session: Session
    ) -> None:
        """将 Session 中的对话转化为可搜索的记忆"""
        ...

    @abstractmethod
    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str
    ) -> SearchMemoryResponse:
        """基于 Query 检索相关记忆"""
        ...
```

#### 1.3.2 对标 LangGraph Memory 机制

LangGraph 提供两套互补的持久化机制<sup>[[2]](#ref2)</sup>：

| 机制             | 范围        | 用途                            | 我们的复刻策略                       |
| :--------------- | :---------- | :------------------------------ | :----------------------------------- |
| **Checkpointer** | 单个 Thread | 对话历史、状态快照 (Short-term) | Phase 1 已实现 (`threads`, `events`) |
| **Store**        | 跨 Thread   | 用户偏好、学习知识 (Long-term)  | Phase 2 实现 (`memories`, `facts`)   |

### 1.4 任务-章节对照表

> [!NOTE]
>
> 以下表格将 [001-task-checklist.md](./001-task-checklist.md) 的任务 ID 与本文档章节进行对照，便于追踪执行进度。

| 任务模块             | 任务 ID 范围     | 对应章节                                                        |
| :------------------- | :--------------- | :-------------------------------------------------------------- |
| 记忆机制调研         | P2-1-1 ~ P2-1-5  | [2. 技术调研](#2-技术调研记忆机制深度分析)                      |
| Memory Consolidation | P2-2-1 ~ P2-2-14 | [4.2 记忆巩固实现](#42-step-2-memory-consolidation-worker-实现) |
| Biological Retention | P2-3-1 ~ P2-3-11 | [4.3 遗忘与保持实现](#43-step-3-biological-retention-实现)      |
| 验收与文档           | P2-4-1 ~ P2-4-4  | [5. 验收标准](#5-验收标准) + [6. 交付物](#6-交付物清单)         |

### 1.5 工期规划

| 阶段 | 任务模块             | 任务 ID          | 预估工期 | 交付物                         |
| :--- | :------------------- | :--------------- | :------- | :----------------------------- |
| 2.1  | 记忆机制调研         | P2-1-1 ~ P2-1-5  | 0.25 Day | 调研笔记 + 对比分析表          |
| 2.2  | Schema 扩展          | P2-2-1 ~ P2-2-2  | 0.25 Day | `memories` 表, `facts` 表 DDL  |
| 2.3  | Consolidation Worker | P2-2-3 ~ P2-2-14 | 0.75 Day | `consolidation_worker.py`      |
| 2.4  | Biological Retention | P2-3-1 ~ P2-3-11 | 0.5 Day  | 衰减算法 + Context Window 函数 |
| 2.5  | 测试与验收           | P2-4-1 ~ P2-4-4  | 0.25 Day | 测试报告 + 技术文档            |

---

## 2. 技术调研：记忆机制深度分析

### 2.1 Google ADK Memory Bank 工作流程

基于 ADK 文档分析<sup>[[3]](#ref3)</sup>，Memory Bank 的核心工作流程如下：

```mermaid
sequenceDiagram
    participant User
    participant Agent
    participant Session as SessionService
    participant Memory as MemoryService
    participant LLM

    User->>Agent: 用户消息
    Agent->>Session: append_event()
    Agent->>Memory: search_memory(query)
    Memory-->>Agent: 相关记忆列表

    Agent->>LLM: 组装 Prompt (Context + Memories)
    LLM-->>Agent: 生成回复
    Agent->>User: 返回回复

    Note over Memory: 异步巩固流程
    Session->>Memory: add_session_to_memory()
    Memory->>LLM: 提取 Facts/Insights
    LLM-->>Memory: 结构化记忆
    Memory->>Memory: 向量化 + 存储
```

**关键洞察**：

1. **异步巩固**：Memory 的生成与主对话流程解耦，不阻塞用户响应
2. **双向流动**：Session → Memory (写入)，Memory → Agent (读取)
3. **LLM 驱动**：Facts 提取依赖 LLM 的理解能力，而非规则匹配

### 2.2 LangGraph Memory 设计模式

LangGraph 的 Memory 设计采用了更灵活的**三层记忆模型**<sup>[[2]](#ref2)</sup>：

#### 2.2.1 Semantic Memory (语义记忆)

存储用户的**偏好、规则、Profile** 等结构化信息：

```python
# LangGraph Store 示例
store.put(
    namespace=(user_id, "preferences"),
    key="food",
    value={"likes": ["pizza", "sushi"], "dislikes": ["spicy"]}
)
```

**设计决策**：

- **Profile Style**: 单一 JSON 对象，适合用户画像
- **Collection Style**: 多个独立记录，适合持续积累的偏好

#### 2.2.2 Episodic Memory (情景记忆)

存储**过去的对话片段**，用于 Few-shot 引导：

```python
# 情景记忆用于动态 Few-shot
memories = store.search(
    namespace=(user_id, "episodes"),
    query="similar task"
)
prompt = f"Here are some similar interactions:\n{memories}"
```

**设计决策**：

- 保留**完整的对话切片**而非摘要，便于上下文重建
- 支持**按时间**和**按语义**双重检索

#### 2.2.3 Procedural Memory (程序性记忆)

存储**Agent 的行为规则和指令**，支持自我进化：

```python
# 程序性记忆：Agent 自我调整
def update_instructions(state, store):
    # 根据反馈更新 Agent 指令
    new_instructions = llm.invoke(f"Based on feedback: {state['feedback']}, update: {current_instructions}")
    store.put(("agent_instructions",), "main", {"instructions": new_instructions})
```

### 2.3 记忆写入时机：Hot Path vs Background

LangGraph 明确区分了两种记忆写入模式<sup>[[2]](#ref2)</sup>：

| 模式                  | 描述                    | 优势                     | 劣势                     |
| :-------------------- | :---------------------- | :----------------------- | :----------------------- |
| **Hot Path (同步)**   | 在 Agent 响应前写入记忆 | 立即生效，无延迟         | 增加响应延迟，复杂度高   |
| **Background (异步)** | 对话结束后异步处理      | 不影响响应速度，批量高效 | 存在短暂的记忆不可见窗口 |

**我们的策略**：

1. **Fast Replay (快回放)** → Hot Path：摘要生成在对话中实时触发
2. **Deep Reflection (深反思)** → Background：Facts 提取由异步 Worker 处理

### 2.4 对比分析：ADK vs LangGraph vs 我们的方案

| 维度         | Google ADK MemoryService       | LangGraph Store                  | Open Memory Engine (我们)        |
| :----------- | :----------------------------- | :------------------------------- | :------------------------------- |
| **存储后端** | Vertex AI Vector Search        | InMemory / Postgres / Redis      | PostgreSQL + PGVector            |
| **记忆类型** | 单一 Memory 类型               | Semantic / Episodic / Procedural | 三种记忆类型 + 统一存储          |
| **写入机制** | 异步 `add_session_to_memory()` | Hot Path / Background 可选       | Fast Replay + Async Worker       |
| **检索方式** | `search_memory()` 向量检索     | `store.search()` 语义检索        | 混合检索 (Vector + JSONB + Time) |
| **巩固策略** | LLM 提取 → 自动向量化          | 应用层控制                       | 两阶段巩固 + 艾宾浩斯衰减        |
| **开放程度** | 黑盒 (依赖 Vertex AI)          | 白盒 (完全可控)                  | 白盒 (PostgreSQL 原生)           |

### 2.5 调研交付物摘要

> [!NOTE]
>
> 本节对应任务 **P2-1-1 ~ P2-1-5** 的调研交付物，提供结构化的接口清单和对比分析。

#### 2.5.1 ADK MemoryService 接口方法清单 (P2-1-1)

基于 ADK 源码分析，`BaseMemoryService` 抽象接口包含以下核心方法：

| 方法签名                                  | 语义                              | 返回类型               |
| :---------------------------------------- | :-------------------------------- | :--------------------- |
| `add_session_to_memory(session: Session)` | 将 Session 对话转化为可搜索的记忆 | `None`                 |
| `search_memory(app_name, user_id, query)` | 基于 Query 检索相关记忆           | `SearchMemoryResponse` |

**SearchMemoryResponse 结构**：

```python
@dataclass
class SearchMemoryResponse:
    memories: list[Memory]  # 检索到的记忆列表

@dataclass
class Memory:
    content: str           # 记忆内容
    metadata: dict         # 元数据 (来源 Session, 时间等)
```

#### 2.5.2 VertexAiMemoryBankService 工作流程 (P2-1-2)

```mermaid
sequenceDiagram
    participant App as Application
    participant MBS as MemoryBankService
    participant VS as Vertex Vector Search
    participant LLM as LLM (Gemini)

    Note over App,LLM: 写入流程 (add_session_to_memory)
    App->>MBS: add_session_to_memory(session)
    MBS->>LLM: 提取 Facts/Insights
    LLM-->>MBS: 结构化 Memory 对象
    MBS->>VS: 向量化 + 存储

    Note over App,LLM: 读取流程 (search_memory)
    App->>MBS: search_memory(query)
    MBS->>LLM: 生成 Query Embedding
    LLM-->>MBS: Query Vector
    MBS->>VS: 向量检索 (Top-K)
    VS-->>MBS: 相似记忆列表
    MBS-->>App: SearchMemoryResponse
```

**关键实现细节**：

| 组件           | Google 实现             | 我们的复刻                  |
| :------------- | :---------------------- | :-------------------------- |
| 向量存储       | Vertex AI Vector Search | PostgreSQL + PGVector       |
| Embedding 模型 | `textembedding-gecko`   | Gemini `text-embedding-004` |
| LLM 提取       | Gemini Pro              | Gemini 3.0 Flash            |
| 索引算法       | ScaNN (未公开)          | HNSW (IVFFlat 备选)         |

#### 2.5.3 LangGraph Checkpointer vs Store 对比 (P2-1-3, P2-1-4)

| 维度         | Checkpointer                 | Store                           |
| :----------- | :--------------------------- | :------------------------------ |
| **作用域**   | 单个 Thread 内               | 跨 Thread (全局)                |
| **存储内容** | 完整 State Snapshot          | Key-Value 记忆 (Namespace 隔离) |
| **生命周期** | 随 Thread 存在               | 持久化，手动管理                |
| **检索方式** | 按 Checkpoint ID / Thread ID | `store.search()` 语义检索       |
| **典型用途** | 对话历史恢复、状态回滚       | 用户偏好、长期记忆、跨会话知识  |

#### 2.5.4 综合对比分析表 (P2-1-5)

| 评估维度         | Google ADK MemoryService | LangGraph Store | Open Memory Engine |
| :--------------- | :----------------------- | :-------------- | :----------------- |
| **架构复杂度**   | ⭐⭐⭐ (多组件)          | ⭐⭐ (较灵活)   | ⭐ (统一)          |
| **开箱即用**     | ⭐⭐⭐ (托管服务)        | ⭐⭐ (需配置)   | ⭐⭐ (需部署 PG)   |
| **白盒透明度**   | ⭐ (黑盒)                | ⭐⭐⭐ (全开源) | ⭐⭐⭐ (SQL 可见)  |
| **成本可控性**   | ⭐ (按调用计费)          | ⭐⭐⭐ (自托管) | ⭐⭐⭐ (自托管)    |
| **记忆类型支持** | ⭐⭐ (单一)              | ⭐⭐⭐ (三类型) | ⭐⭐⭐ (三类型)    |
| **遗忘机制**     | ❌ (无内建)              | ❌ (需自实现)   | ✅ (艾宾浩斯)      |
| **Context 预算** | ❌ (需应用层)            | ⭐⭐ (部分支持) | ✅ (内建)          |

---

## 3. 架构设计：Hippocampus Schema 扩展

### 3.1 Schema 扩展设计

在 Phase 1 的 Unified Schema 基础上，新增以下记忆相关表：

```mermaid
erDiagram
    threads ||--o{ events : contains
    threads ||--o{ memories : generates
    threads ||--o{ facts : extracts

    memories {
        uuid id PK "记忆唯一标识"
        uuid thread_id FK "来源会话"
        varchar user_id "用户标识"
        varchar app_name "应用名称"
        varchar memory_type "记忆类型: episodic/semantic"
        text content "记忆内容"
        vector embedding "向量嵌入 (1536维)"
        jsonb metadata "元数据"
        float retention_score "保留分数"
        integer access_count "访问次数"
        timestamp last_accessed_at "最后访问时间"
        timestamp created_at "创建时间"
    }

    facts {
        uuid id PK "事实唯一标识"
        uuid thread_id FK "来源会话"
        varchar user_id "用户标识"
        varchar app_name "应用名称"
        varchar fact_type "事实类型: preference/rule/profile"
        varchar key "事实键"
        jsonb value "事实值"
        vector embedding "向量嵌入"
        float confidence "置信度"
        timestamp valid_from "生效时间"
        timestamp valid_until "失效时间"
        timestamp created_at "创建时间"
    }

    consolidation_jobs {
        uuid id PK "任务唯一标识"
        uuid thread_id FK "目标会话"
        varchar status "状态: pending/running/completed/failed"
        varchar job_type "任务类型: fast_replay/deep_reflection"
        jsonb result "处理结果"
        text error "错误信息"
        timestamp started_at "开始时间"
        timestamp completed_at "完成时间"
        timestamp created_at "创建时间"
    }

    instructions {
        uuid id PK "指令唯一标识"
        varchar app_name "应用名称"
        varchar instruction_key "指令键"
        text content "指令内容"
        integer version "版本号"
        jsonb metadata "元数据"
        timestamp created_at "创建时间"
    }
```

### 3.2 表职责说明

| 表名                   | 职责                           | 对标概念                  | 生命周期      |
| :--------------------- | :----------------------------- | :------------------------ | :------------ |
| **memories**           | 情景记忆存储 (Episodic Memory) | LangGraph Store           | 按衰减清理    |
| **facts**              | 语义记忆存储 (Semantic Memory) | ADK Memory + User Profile | 持久 (可覆盖) |
| **consolidation_jobs** | 记忆巩固任务队列               | 异步 Worker 任务追踪      | 完成后归档    |
| **instructions**       | 程序性记忆 (Procedural Memory) | Agent 指令模板            | 版本控制      |

### 3.3 核心表 DDL 设计

#### 3.3.1 memories 表 (情景记忆)

```sql
-- memories: 情景记忆存储 (Episodic Memory)
CREATE TABLE IF NOT EXISTS memories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,

    -- 记忆类型
    memory_type         VARCHAR(50) NOT NULL DEFAULT 'episodic',
    -- CHECK (memory_type IN ('episodic', 'semantic', 'summary'))

    -- 记忆内容
    content             TEXT NOT NULL,

    -- 向量嵌入 (用于语义检索)
    embedding           vector(1536),

    -- 元数据 (时间切片、来源事件等)
    metadata            JSONB DEFAULT '{}',

    -- 记忆保持机制 (艾宾浩斯衰减)
    retention_score     FLOAT NOT NULL DEFAULT 1.0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 时间戳
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX IF NOT EXISTS idx_memories_user_app ON memories(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_memories_thread ON memories(thread_id);
CREATE INDEX IF NOT EXISTS idx_memories_retention ON memories(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);

-- HNSW 向量索引 (用于语义检索)
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 复合索引 (情景分块检索)
CREATE INDEX IF NOT EXISTS idx_memories_time_bucket
    ON memories(user_id, app_name, created_at DESC);
```

#### 3.3.2 facts 表 (语义记忆/事实)

```sql
-- facts: 语义记忆存储 (Semantic Memory / Key-Value Facts)
CREATE TABLE IF NOT EXISTS facts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,

    -- 事实类型与键
    fact_type           VARCHAR(50) NOT NULL DEFAULT 'preference',
    -- CHECK (fact_type IN ('preference', 'rule', 'profile', 'custom'))
    key                 VARCHAR(255) NOT NULL,

    -- 事实值 (结构化 JSON)
    value               JSONB NOT NULL,

    -- 向量嵌入 (可选，用于语义检索)
    embedding           vector(1536),

    -- 置信度与有效期
    confidence          FLOAT NOT NULL DEFAULT 1.0,
    valid_from          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until         TIMESTAMP WITH TIME ZONE,

    -- 时间戳
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 每个用户的每个 key 只有一个有效值 (可更新)
    CONSTRAINT facts_user_key_unique UNIQUE (user_id, app_name, fact_type, key)
);

-- 索引策略
CREATE INDEX IF NOT EXISTS idx_facts_user_app ON facts(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_facts_type_key ON facts(fact_type, key);
CREATE INDEX IF NOT EXISTS idx_facts_value ON facts USING GIN (value);

-- 有效期过滤索引
CREATE INDEX IF NOT EXISTS idx_facts_validity
    ON facts(user_id, app_name)
    WHERE valid_until IS NULL OR valid_until > NOW();
```

#### 3.3.3 consolidation_jobs 表 (巩固任务队列)

```sql
-- consolidation_jobs: 记忆巩固任务队列
CREATE TABLE IF NOT EXISTS consolidation_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

    -- 任务状态
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))

    -- 任务类型
    job_type            VARCHAR(50) NOT NULL,
    -- CHECK (job_type IN ('fast_replay', 'deep_reflection', 'full_consolidation'))

    -- 处理结果
    result              JSONB DEFAULT '{}',
    error               TEXT,

    -- 时间戳
    started_at          TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_status ON consolidation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_thread ON consolidation_jobs(thread_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_pending
    ON consolidation_jobs(created_at)
    WHERE status = 'pending';
```

### 3.4 关键 SQL 函数设计

#### 3.4.1 艾宾浩斯衰减计算函数

```sql
-- 计算记忆保留分数 (Ebbinghaus Decay)
-- 公式: retention_score = access_frequency * time_decay
-- time_decay = exp(-λ * days_since_last_access)
CREATE OR REPLACE FUNCTION calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT 0.1  -- λ 衰减系数
)
RETURNS FLOAT AS $$
DECLARE
    days_elapsed FLOAT;
    time_decay FLOAT;
    frequency_boost FLOAT;
BEGIN
    -- 计算距离上次访问的天数
    days_elapsed := EXTRACT(EPOCH FROM (NOW() - p_last_accessed_at)) / 86400.0;

    -- 时间衰减 (指数衰减)
    time_decay := EXP(-p_decay_rate * days_elapsed);

    -- 频率加成 (对数平滑)
    frequency_boost := 1.0 + LN(1.0 + p_access_count);

    -- 综合保留分数 (归一化到 0-1)
    RETURN LEAST(1.0, time_decay * frequency_boost / 5.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### 3.4.2 记忆清理函数

```sql
-- 清理低价值记忆
CREATE OR REPLACE FUNCTION cleanup_low_value_memories(
    p_threshold FLOAT DEFAULT 0.1,  -- 保留分数阈值
    p_min_age_days INTEGER DEFAULT 7  -- 最小保留天数
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 先更新所有记忆的保留分数
    UPDATE memories
    SET retention_score = calculate_retention_score(access_count, last_accessed_at);

    -- 删除低于阈值且超过最小保留期的记忆
    DELETE FROM memories
    WHERE retention_score < p_threshold
      AND created_at < NOW() - INTERVAL '1 day' * p_min_age_days;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

#### 3.4.3 Context Window 组装函数

```sql
-- 获取上下文窗口内容 (根据 Token 预算动态组装)
CREATE OR REPLACE FUNCTION get_context_window(
    p_user_id VARCHAR(255),
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_max_tokens INTEGER DEFAULT 4000,
    p_memory_ratio FLOAT DEFAULT 0.3,  -- 记忆占比
    p_history_ratio FLOAT DEFAULT 0.5   -- 历史占比
)
RETURNS TABLE (
    context_type VARCHAR(50),
    content TEXT,
    relevance_score FLOAT,
    token_estimate INTEGER
) AS $$
DECLARE
    memory_budget INTEGER;
    history_budget INTEGER;
BEGIN
    -- 计算各部分 Token 预算
    memory_budget := (p_max_tokens * p_memory_ratio)::INTEGER;
    history_budget := (p_max_tokens * p_history_ratio)::INTEGER;

    -- 返回相关记忆 (按相似度 + 保留分数排序)
    RETURN QUERY
    SELECT
        'memory'::VARCHAR(50) AS context_type,
        m.content,
        (1 - (m.embedding <=> p_query_embedding)) * m.retention_score AS relevance_score,
        (LENGTH(m.content) / 4)::INTEGER AS token_estimate  -- 粗略估算
    FROM memories m
    WHERE m.user_id = p_user_id
      AND m.app_name = p_app_name
    ORDER BY relevance_score DESC
    LIMIT 10;

    -- 返回最近历史 (来自 events 表)
    RETURN QUERY
    SELECT
        'history'::VARCHAR(50) AS context_type,
        e.content::TEXT,
        1.0::FLOAT AS relevance_score,  -- 历史按时间排序
        (LENGTH(e.content::TEXT) / 4)::INTEGER AS token_estimate
    FROM events e
    JOIN threads t ON e.thread_id = t.id
    WHERE t.user_id = p_user_id
      AND t.app_name = p_app_name
    ORDER BY e.created_at DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 实施计划：分步执行指南

### 4.1 Step 1: 记忆 Schema 扩展部署

#### 4.1.1 Schema 部署脚本

创建 `src/cognizes/engine/schema/hippocampus_schema.sql`：

```sql
-- ============================================
-- Agentic AI Engine - Hippocampus Schema Extension
-- Version: 1.0
-- Target: PostgreSQL 16+ with pgvector
-- Prerequisite: Phase 1 agent_schema.sql 已部署
-- ============================================

-- 确保依赖的扩展已启用
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. memories 表 (情景记忆)
-- ============================================
CREATE TABLE IF NOT EXISTS memories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,
    memory_type         VARCHAR(50) NOT NULL DEFAULT 'episodic',
    content             TEXT NOT NULL,
    embedding           vector(1536),
    metadata            JSONB DEFAULT '{}',
    retention_score     FLOAT NOT NULL DEFAULT 1.0,
    access_count        INTEGER NOT NULL DEFAULT 0,
    last_accessed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_app ON memories(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_memories_thread ON memories(thread_id);
CREATE INDEX IF NOT EXISTS idx_memories_retention ON memories(retention_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_embedding
    ON memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_memories_time_bucket
    ON memories(user_id, app_name, created_at DESC);

-- ============================================
-- 2. facts 表 (语义记忆)
-- ============================================
CREATE TABLE IF NOT EXISTS facts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID REFERENCES threads(id) ON DELETE SET NULL,
    user_id             VARCHAR(255) NOT NULL,
    app_name            VARCHAR(255) NOT NULL,
    fact_type           VARCHAR(50) NOT NULL DEFAULT 'preference',
    key                 VARCHAR(255) NOT NULL,
    value               JSONB NOT NULL,
    embedding           vector(1536),
    confidence          FLOAT NOT NULL DEFAULT 1.0,
    valid_from          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until         TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT facts_user_key_unique UNIQUE (user_id, app_name, fact_type, key)
);

CREATE INDEX IF NOT EXISTS idx_facts_user_app ON facts(user_id, app_name);
CREATE INDEX IF NOT EXISTS idx_facts_type_key ON facts(fact_type, key);
CREATE INDEX IF NOT EXISTS idx_facts_value ON facts USING GIN (value);
CREATE INDEX IF NOT EXISTS idx_facts_validity
    ON facts(user_id, app_name)
    WHERE valid_until IS NULL;

-- ============================================
-- 3. consolidation_jobs 表 (巩固任务队列)
-- ============================================
CREATE TABLE IF NOT EXISTS consolidation_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id           UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    job_type            VARCHAR(50) NOT NULL,
    result              JSONB DEFAULT '{}',
    error               TEXT,
    started_at          TIMESTAMP WITH TIME ZONE,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_status ON consolidation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_thread ON consolidation_jobs(thread_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_pending
    ON consolidation_jobs(created_at)
    WHERE status = 'pending';

-- ============================================
-- 4. instructions 表 (程序性记忆)
-- ============================================
CREATE TABLE IF NOT EXISTS instructions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name            VARCHAR(255) NOT NULL,
    instruction_key     VARCHAR(255) NOT NULL,
    content             TEXT NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT instructions_app_key_version_unique UNIQUE (app_name, instruction_key, version)
);

CREATE INDEX IF NOT EXISTS idx_instructions_app ON instructions(app_name);
CREATE INDEX IF NOT EXISTS idx_instructions_key ON instructions(instruction_key);

-- ============================================
-- 5. SQL 函数: 艾宾浩斯衰减计算
-- ============================================
CREATE OR REPLACE FUNCTION calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT 0.1
)
RETURNS FLOAT AS $$
DECLARE
    days_elapsed FLOAT;
    time_decay FLOAT;
    frequency_boost FLOAT;
BEGIN
    days_elapsed := EXTRACT(EPOCH FROM (NOW() - p_last_accessed_at)) / 86400.0;
    time_decay := EXP(-p_decay_rate * days_elapsed);
    frequency_boost := 1.0 + LN(1.0 + p_access_count);
    RETURN LEAST(1.0, time_decay * frequency_boost / 5.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 6. SQL 函数: 清理低价值记忆
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_low_value_memories(
    p_threshold FLOAT DEFAULT 0.1,
    p_min_age_days INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE memories
    SET retention_score = calculate_retention_score(access_count, last_accessed_at);

    DELETE FROM memories
    WHERE retention_score < p_threshold
      AND created_at < NOW() - INTERVAL '1 day' * p_min_age_days;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. pg_cron 定时任务 (可选)
-- ============================================
-- 每天凌晨 2 点执行记忆清理
-- SELECT cron.schedule('cleanup_memories', '0 2 * * *', $$SELECT cleanup_low_value_memories(0.1, 7)$$);
```

#### 4.1.2 部署验证

```bash
# 部署 Hippocampus Schema
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/hippocampus_schema.sql

# 验证表创建
psql -d 'cognizes-engine' -c "\dt"
# 应显示: memories, facts, consolidation_jobs, instructions

# 验证索引
psql -d 'cognizes-engine' -c "\di"

# 验证函数
psql -d 'cognizes-engine' -c "\df calculate_retention_score"
psql -d 'cognizes-engine' -c "\df cleanup_low_value_memories"

# 测试衰减函数
psql -d 'cognizes-engine' -c "SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days');"
```

#### 4.1.3 pg_cron 定时任务配置 (P2-2-8)

> [!NOTE]
>
> pg_cron 是 PostgreSQL 的定时任务扩展，用于实现自动记忆清理和巩固触发。

**Step 1: 安装 pg_cron**

参见 Phase 1。

**Step 2: 配置 postgresql.conf**

参见 Phase 1。

**Step 3: 重启 PostgreSQL 并启用扩展**

参见 Phase 1。

**Step 4: 配置定时任务**

```sql
-- 查看现有任务
SELECT * FROM cron.job;

-- 每天凌晨 2 点执行记忆清理 (P2-3-4)
SELECT cron.schedule(
    'cleanup_memories',
    '0 2 * * *',
    $$SELECT cleanup_low_value_memories(0.1, 7)$$
);

-- 每小时触发一次记忆巩固检查 (可选)
SELECT cron.schedule(
    'trigger_consolidation',
    '0 * * * *',
    $$
    INSERT INTO consolidation_jobs (thread_id, job_type, status)
    SELECT id, 'full_consolidation', 'pending'
    FROM threads
    WHERE updated_at > NOW() - INTERVAL '1 hour'
      AND id NOT IN (
          SELECT thread_id FROM consolidation_jobs
          WHERE created_at > NOW() - INTERVAL '1 hour'
      )
    $$
);

-- 删除任务
-- SELECT cron.unschedule('cleanup_memories');

-- 查看任务执行日志
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**验证 pg_cron 安装**：

```bash
# 检查扩展是否启用
psql -d 'cognizes-engine' -c "SELECT * FROM pg_extension WHERE extname = 'pg_cron';"

# 检查定时任务列表
psql -d 'cognizes-engine' -c "SELECT jobid, schedule, command FROM cron.job;"
```

### 4.2 Step 2: Memory Consolidation Worker 实现

#### 4.2.1 核心架构设计

Memory Consolidation Worker 采用**两阶段巩固**策略，模拟人类大脑的记忆巩固过程：

```mermaid
graph TB
    subgraph "阶段 1: Fast Replay (快回放)"
        E[Events 事件流] --> ER[extract_recent_events]
        ER --> GS[generate_summary]
        GS --> SS[store_summary]
    end

    subgraph "阶段 2: Deep Reflection (深反思)"
        E --> EF[extract_facts]
        EF --> VI[vectorize_insights]
        VI --> SM[store_to_memories]
    end

    SS --> M[(memories 表)]
    SM --> F[(facts 表)]

    style E fill:#065f46,stroke:#34d399,color:#fff
    style M fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style F fill:#7c2d12,stroke:#fb923c,color:#fff
```

#### 4.2.2 Consolidation Worker 完整实现

创建 `src/cognizes/engine/hippocampus/consolidation_worker.py`：

````python
"""
MemoryConsolidationWorker: 记忆巩固 Worker

实现对标 Google ADK MemoryBankService 的记忆巩固能力：
- Fast Replay: 快速摘要最近对话
- Deep Reflection: 深度提取 Facts 和 Insights
- Vectorization: 向量化并存入 memories/facts 表

参考:
- Google ADK MemoryService: https://google.github.io/adk-docs/sessions/memory/
- LangGraph Memory: https://docs.langchain.com/oss/python/langgraph/memory
"""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

import asyncpg
import google.generativeai as genai

# ========================================
# 数据类型定义
# ========================================

class JobType(str, Enum):
    FAST_REPLAY = "fast_replay"
    DEEP_REFLECTION = "deep_reflection"
    FULL_CONSOLIDATION = "full_consolidation"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ConsolidationJob:
    """记忆巩固任务"""
    id: str
    thread_id: str
    job_type: JobType
    status: JobStatus = JobStatus.PENDING
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


@dataclass
class Memory:
    """记忆对象"""
    id: str
    thread_id: str | None
    user_id: str
    app_name: str
    memory_type: str  # 'episodic', 'semantic', 'summary'
    content: str
    embedding: list[float] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    retention_score: float = 1.0
    access_count: int = 0


@dataclass
class Fact:
    """事实对象"""
    id: str
    thread_id: str | None
    user_id: str
    app_name: str
    fact_type: str  # 'preference', 'rule', 'profile'
    key: str
    value: dict[str, Any]
    confidence: float = 1.0


# ========================================
# Prompt 模板
# ========================================

FAST_REPLAY_PROMPT = """你是一个对话摘要专家。请将以下对话历史压缩为一个简洁的摘要，保留关键信息。

对话历史:
{conversation}

要求:
1. 摘要长度不超过 200 字
2. 保留用户的关键问题和 Agent 的核心回答
3. 保留任何重要的决策或结论
4. 使用第三人称描述

请直接输出摘要，不要添加任何前缀或解释。"""

DEEP_REFLECTION_PROMPT = """你是一个用户画像分析专家。请从以下对话中提取用户的关键信息，包括偏好、规则和事实。

对话历史:
{conversation}

请以 JSON 格式输出，格式如下:
```json
{{
    "facts": [
        {{
            "type": "preference|rule|profile",
            "key": "偏好/规则的唯一标识，如 food_preference",
            "value": {{"具体的偏好内容"}},
            "confidence": 0.0-1.0 的置信度分数
        }}
    ],
    "insights": [
        {{
            "content": "从对话中提炼的深层洞察",
            "importance": "high|medium|low"
        }}
    ]
}}
```

要求:

1. 只提取明确表达或可靠推断的信息
2. preference: 用户的喜好（如饮食、风格偏好）
3. rule: 用户设定的规则（如"每周五不开会"）
4. profile: 用户的基本信息（如职业、位置）
5. 如果没有可提取的信息，返回空数组

请只输出 JSON，不要添加任何其他内容。"""

# ========================================

# Memory Consolidation Worker

# ========================================

class MemoryConsolidationWorker:
    """
    记忆巩固 Worker

    负责将 Session 中的对话转化为持久化的记忆：
    1. Fast Replay: 生成对话摘要
    2. Deep Reflection: 提取 Facts 和 Insights
    3. Vectorization: 向量化并写入数据库
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        model_name: str = "gemini-2.0-flash",
        embedding_model: str = "text-embedding-004",
    ):
        self.pool = pool
        self.model_name = model_name
        self.embedding_model = embedding_model
        self.model = genai.GenerativeModel(model_name)

    # ========================================
    # 主入口函数
    # ========================================

    async def consolidate(
        self,
        thread_id: str,
        job_type: JobType = JobType.FULL_CONSOLIDATION,
    ) -> ConsolidationJob:
        """
        执行记忆巩固任务

        Args:
            thread_id: 要巩固的会话 ID
            job_type: 任务类型
                - FAST_REPLAY: 仅生成摘要
                - DEEP_REFLECTION: 仅提取 Facts
                - FULL_CONSOLIDATION: 两者都执行

        Returns:
            ConsolidationJob: 任务执行结果
        """
        # 创建任务记录
        job = await self._create_job(thread_id, job_type)

        try:
            # 更新任务状态为运行中
            await self._update_job_status(job.id, JobStatus.RUNNING)
            job.started_at = datetime.now()

            # 获取会话信息
            thread_info = await self._get_thread_info(thread_id)
            if not thread_info:
                raise ValueError(f"Thread {thread_id} not found")

            user_id = thread_info["user_id"]
            app_name = thread_info["app_name"]

            # 提取最近事件
            events = await self._extract_recent_events(thread_id)
            if not events:
                job.result = {"message": "No events to consolidate"}
                await self._update_job_status(job.id, JobStatus.COMPLETED, job.result)
                return job

            # 构建对话文本
            conversation = self._format_conversation(events)

            result = {}

            # 阶段 1: Fast Replay (快回放)
            if job_type in [JobType.FAST_REPLAY, JobType.FULL_CONSOLIDATION]:
                summary = await self._generate_summary(conversation)
                memory = await self._store_summary(
                    thread_id=thread_id,
                    user_id=user_id,
                    app_name=app_name,
                    content=summary,
                )
                result["summary"] = {
                    "memory_id": memory.id,
                    "content": summary[:100] + "..." if len(summary) > 100 else summary,
                }

            # 阶段 2: Deep Reflection (深反思)
            if job_type in [JobType.DEEP_REFLECTION, JobType.FULL_CONSOLIDATION]:
                extraction = await self._extract_facts(conversation)
                facts_stored = []
                insights_stored = []

                # 存储 Facts
                for fact_data in extraction.get("facts", []):
                    fact = await self._store_fact(
                        thread_id=thread_id,
                        user_id=user_id,
                        app_name=app_name,
                        fact_data=fact_data,
                    )
                    facts_stored.append({
                        "fact_id": fact.id,
                        "key": fact.key,
                    })

                # 存储 Insights 作为语义记忆
                for insight_data in extraction.get("insights", []):
                    memory = await self._store_insight(
                        thread_id=thread_id,
                        user_id=user_id,
                        app_name=app_name,
                        insight_data=insight_data,
                    )
                    insights_stored.append({
                        "memory_id": memory.id,
                        "importance": insight_data.get("importance", "medium"),
                    })

                result["facts"] = facts_stored
                result["insights"] = insights_stored

            # 任务完成
            job.result = result
            job.completed_at = datetime.now()
            await self._update_job_status(job.id, JobStatus.COMPLETED, result)

            return job

        except Exception as e:
            # 任务失败
            job.error = str(e)
            job.status = JobStatus.FAILED
            await self._update_job_status(job.id, JobStatus.FAILED, error=str(e))
            raise

    # ========================================
    # 阶段 1: Fast Replay (快回放)
    # ========================================

    async def _extract_recent_events(
        self,
        thread_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """提取最近的事件"""
        query = """
            SELECT id, author, event_type, content, created_at
            FROM events
            WHERE thread_id = $1
            ORDER BY sequence_num DESC
            LIMIT $2
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, uuid.UUID(thread_id), limit)
            # 反转顺序使其按时间正序
            return [dict(row) for row in reversed(rows)]

    def _format_conversation(self, events: list[dict[str, Any]]) -> str:
        """格式化对话历史"""
        lines = []
        for event in events:
            author = event["author"]
            content = event.get("content", {})

            # 提取消息文本
            if isinstance(content, dict):
                text = content.get("text", content.get("message", str(content)))
            else:
                text = str(content)

            role_label = {
                "user": "用户",
                "agent": "助手",
                "tool": "工具",
            }.get(author, author)

            lines.append(f"{role_label}: {text}")

        return "\n".join(lines)

    async def _generate_summary(self, conversation: str) -> str:
        """生成对话摘要 (Fast Replay)"""
        prompt = FAST_REPLAY_PROMPT.format(conversation=conversation)
        response = await asyncio.to_thread(
            self.model.generate_content, prompt
        )
        return response.text.strip()

    async def _store_summary(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        content: str,
    ) -> Memory:
        """存储摘要作为记忆"""
        # 生成向量嵌入
        embedding = await self._generate_embedding(content)

        memory_id = str(uuid.uuid4())

        query = """
            INSERT INTO memories (id, thread_id, user_id, app_name, memory_type, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, created_at
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                query,
                uuid.UUID(memory_id),
                uuid.UUID(thread_id),
                user_id,
                app_name,
                "summary",
                content,
                embedding,
                json.dumps({"source": "fast_replay"}),
            )

        return Memory(
            id=memory_id,
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            memory_type="summary",
            content=content,
            embedding=embedding,
        )

    # ========================================
    # 阶段 2: Deep Reflection (深反思)
    # ========================================

    async def _extract_facts(self, conversation: str) -> dict[str, Any]:
        """从对话中提取 Facts 和 Insights"""
        prompt = DEEP_REFLECTION_PROMPT.format(conversation=conversation)
        response = await asyncio.to_thread(
            self.model.generate_content, prompt
        )

        # 解析 JSON 响应
        text = response.text.strip()
        # 移除 markdown 代码块标记
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return {"facts": [], "insights": []}

    async def _store_fact(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        fact_data: dict[str, Any],
    ) -> Fact:
        """存储提取的事实 (Upsert 逻辑)"""
        fact_id = str(uuid.uuid4())
        fact_type = fact_data.get("type", "preference")
        key = fact_data.get("key", "unknown")
        value = fact_data.get("value", {})
        confidence = fact_data.get("confidence", 1.0)

        # 生成向量嵌入 (用于语义检索)
        content_for_embedding = f"{key}: {json.dumps(value)}"
        embedding = await self._generate_embedding(content_for_embedding)

        # Upsert: 如果已存在相同 key 则更新
        query = """
            INSERT INTO facts (id, thread_id, user_id, app_name, fact_type, key, value, embedding, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, app_name, fact_type, key)
            DO UPDATE SET
                value = EXCLUDED.value,
                embedding = EXCLUDED.embedding,
                confidence = EXCLUDED.confidence,
                thread_id = EXCLUDED.thread_id
            RETURNING id
        """
        async with self.pool.acquire() as conn:
            result = await conn.fetchrow(
                query,
                uuid.UUID(fact_id),
                uuid.UUID(thread_id),
                user_id,
                app_name,
                fact_type,
                key,
                json.dumps(value),
                embedding,
                confidence,
            )
            actual_id = str(result["id"])

        return Fact(
            id=actual_id,
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            fact_type=fact_type,
            key=key,
            value=value,
            confidence=confidence,
        )

    async def _store_insight(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        insight_data: dict[str, Any],
    ) -> Memory:
        """存储 Insight 作为语义记忆"""
        content = insight_data.get("content", "")
        importance = insight_data.get("importance", "medium")

        # 生成向量嵌入
        embedding = await self._generate_embedding(content)

        # 根据重要性设置初始保留分数
        retention_score = {
            "high": 1.0,
            "medium": 0.7,
            "low": 0.4,
        }.get(importance, 0.7)

        memory_id = str(uuid.uuid4())

        query = """
            INSERT INTO memories (id, thread_id, user_id, app_name, memory_type, content, embedding, metadata, retention_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                query,
                uuid.UUID(memory_id),
                uuid.UUID(thread_id),
                user_id,
                app_name,
                "semantic",
                content,
                embedding,
                json.dumps({"source": "deep_reflection", "importance": importance}),
                retention_score,
            )

        return Memory(
            id=memory_id,
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            memory_type="semantic",
            content=content,
            embedding=embedding,
            retention_score=retention_score,
        )

    # ========================================
    # 向量化
    # ========================================

    async def _generate_embedding(self, text: str) -> list[float]:
        """生成文本的向量嵌入"""
        result = await asyncio.to_thread(
            genai.embed_content,
            model=f"models/{self.embedding_model}",
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    # ========================================
    # 任务管理
    # ========================================

    async def _create_job(self, thread_id: str, job_type: JobType) -> ConsolidationJob:
        """创建巩固任务"""
        job_id = str(uuid.uuid4())
        query = """
            INSERT INTO consolidation_jobs (id, thread_id, job_type, status, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING created_at
        """
        async with self.pool.acquire() as conn:
            result = await conn.fetchrow(
                query,
                uuid.UUID(job_id),
                uuid.UUID(thread_id),
                job_type.value,
                JobStatus.PENDING.value,
            )

        return ConsolidationJob(
            id=job_id,
            thread_id=thread_id,
            job_type=job_type,
            status=JobStatus.PENDING,
            created_at=result["created_at"],
        )

    async def _update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        result: dict | None = None,
        error: str | None = None,
    ) -> None:
        """更新任务状态"""
        query = """
            UPDATE consolidation_jobs
            SET status = $2,
                result = COALESCE($3, result),
                error = COALESCE($4, error),
                started_at = CASE WHEN $2 = 'running' THEN NOW() ELSE started_at END,
                completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                query,
                uuid.UUID(job_id),
                status.value,
                json.dumps(result) if result else None,
                error,
            )

    async def _get_thread_info(self, thread_id: str) -> dict[str, Any] | None:
        """获取会话信息"""
        query = """
            SELECT id, user_id, app_name, state, version
            FROM threads
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, uuid.UUID(thread_id))
            return dict(row) if row else None

# ========================================

# 便捷函数

# ========================================

async def consolidate_thread(
    pool: asyncpg.Pool,
    thread_id: str,
    job_type: JobType = JobType.FULL_CONSOLIDATION,
) -> ConsolidationJob:
    """便捷函数：巩固指定会话的记忆"""
    worker = MemoryConsolidationWorker(pool)
    return await worker.consolidate(thread_id, job_type)
````

#### 4.2.3 使用示例

```python
# 使用示例
import asyncio
import asyncpg

async def main():
    # 创建数据库连接池
    pool = await asyncpg.create_pool(
        "postgresql://aigc:@localhost/cognizes-engine"
    )

    # 创建 Worker
    worker = MemoryConsolidationWorker(pool)

    # 执行完整巩固
    job = await worker.consolidate(
        thread_id="your-thread-id",
        job_type=JobType.FULL_CONSOLIDATION
    )

    print(f"Job completed: {job.result}")

    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### 4.3 Step 3: Biological Retention 实现

#### 4.3.1 艾宾浩斯遗忘曲线原理

艾宾浩斯遗忘曲线描述了记忆随时间衰减的规律。我们将其应用于 Agent 记忆系统：

```mermaid
graph LR
    subgraph "遗忘曲线模型"
        T[Time 时间] --> D[Decay 衰减]
        F[Frequency 访问频率] --> B[Boost 加成]
        D & B --> R[Retention Score 保留分数]
    end

    R --> C{Score 阈值}
    C -->|>= 0.1| K[保留]
    C -->|< 0.1| DEL[清理]

    style R fill:#7c2d12,stroke:#fb923c,color:#fff
```

**公式**：

$$
\text{retention\_score} = \min(1.0, \frac{\text{time\_decay} \times \text{frequency\_boost}}{5.0})
$$

其中：

- $\text{time\_decay} = e^{-\lambda \times \text{days\_elapsed}}$ (指数衰减)
- $\text{frequency\_boost} = 1 + \ln(1 + \text{access\_count})$ (对数加成)
- $\lambda = 0.1$ (默认衰减系数)

#### 4.3.2 Memory Retention Manager 实现

创建 `src/cognizes/engine/hippocampus/retention_manager.py`：

```python
"""
MemoryRetentionManager: 记忆保持管理器

实现艾宾浩斯遗忘曲线算法，自动管理记忆的保持与清理：
- 计算记忆保留分数
- 定期清理低价值记忆
- 记录访问历史，提升高频记忆的保留分数
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import asyncpg


@dataclass
class MemoryStats:
    """记忆统计信息"""
    total_memories: int
    high_value_count: int  # retention_score >= 0.7
    medium_value_count: int  # 0.3 <= retention_score < 0.7
    low_value_count: int  # retention_score < 0.3
    avg_retention_score: float
    cleaned_count: int


class MemoryRetentionManager:
    """
    记忆保持管理器

    职责:
    1. 计算和更新记忆的保留分数
    2. 清理低价值记忆
    3. 记录访问，提升高频记忆的权重
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        decay_rate: float = 0.1,
        cleanup_threshold: float = 0.1,
        min_age_days: int = 7,
    ):
        """
        Args:
            pool: 数据库连接池
            decay_rate: 衰减系数 λ (默认 0.1)
            cleanup_threshold: 清理阈值 (默认 0.1)
            min_age_days: 最小保留天数 (默认 7 天)
        """
        self.pool = pool
        self.decay_rate = decay_rate
        self.cleanup_threshold = cleanup_threshold
        self.min_age_days = min_age_days

    # ========================================
    # 访问记录
    # ========================================

    async def record_access(self, memory_id: str) -> None:
        """
        记录记忆被访问，增加 access_count 并更新 last_accessed_at

        Args:
            memory_id: 记忆 ID
        """
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW(),
                retention_score = calculate_retention_score(access_count + 1, NOW(), $2)
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, uuid.UUID(memory_id), self.decay_rate)

    async def record_batch_access(self, memory_ids: list[str]) -> None:
        """批量记录访问"""
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW(),
                retention_score = calculate_retention_score(access_count + 1, NOW(), $2)
            WHERE id = ANY($1::uuid[])
        """
        async with self.pool.acquire() as conn:
            uuid_list = [uuid.UUID(mid) for mid in memory_ids]
            await conn.execute(query, uuid_list, self.decay_rate)

    # ========================================
    # 保留分数计算
    # ========================================

    async def update_all_retention_scores(self) -> int:
        """
        更新所有记忆的保留分数

        Returns:
            更新的记忆数量
        """
        query = """
            UPDATE memories
            SET retention_score = calculate_retention_score(access_count, last_accessed_at, $1)
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute(query, self.decay_rate)
            # 解析 UPDATE 返回的行数
            return int(result.split()[-1])

    async def get_retention_distribution(
        self,
        user_id: str | None = None,
        app_name: str | None = None,
    ) -> dict[str, int]:
        """
        获取记忆保留分数分布

        Returns:
            {"high": count, "medium": count, "low": count}
        """
        conditions = ["1=1"]
        params = []
        param_idx = 1

        if user_id:
            conditions.append(f"user_id = ${param_idx}")
            params.append(user_id)
            param_idx += 1

        if app_name:
            conditions.append(f"app_name = ${param_idx}")
            params.append(app_name)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT
                COUNT(*) FILTER (WHERE retention_score >= 0.7) AS high,
                COUNT(*) FILTER (WHERE retention_score >= 0.3 AND retention_score < 0.7) AS medium,
                COUNT(*) FILTER (WHERE retention_score < 0.3) AS low
            FROM memories
            WHERE {where_clause}
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return {
                "high": row["high"],
                "medium": row["medium"],
                "low": row["low"],
            }

    # ========================================
    # 记忆清理
    # ========================================

    async def cleanup_low_value_memories(
        self,
        threshold: float | None = None,
        min_age_days: int | None = None,
        dry_run: bool = False,
    ) -> MemoryStats:
        """
        清理低价值记忆

        Args:
            threshold: 保留分数阈值 (低于此分数的记忆将被清理)
            min_age_days: 最小保留天数 (创建时间早于此天数的记忆才会被清理)
            dry_run: 如果为 True，只返回统计信息，不实际删除

        Returns:
            MemoryStats: 清理统计信息
        """
        threshold = threshold or self.cleanup_threshold
        min_age_days = min_age_days or self.min_age_days

        # 先更新所有分数
        await self.update_all_retention_scores()

        # 获取清理前统计
        distribution = await self.get_retention_distribution()

        if dry_run:
            # 只统计将被清理的数量
            query = """
                SELECT COUNT(*) FROM memories
                WHERE retention_score < $1
                  AND created_at < NOW() - INTERVAL '1 day' * $2
            """
            async with self.pool.acquire() as conn:
                count = await conn.fetchval(query, threshold, min_age_days)

            return MemoryStats(
                total_memories=sum(distribution.values()),
                high_value_count=distribution["high"],
                medium_value_count=distribution["medium"],
                low_value_count=distribution["low"],
                avg_retention_score=0,  # 需要额外计算
                cleaned_count=count,
            )

        # 实际清理
        query = """
            DELETE FROM memories
            WHERE retention_score < $1
              AND created_at < NOW() - INTERVAL '1 day' * $2
        """
        async with self.pool.acquire() as conn:
            result = await conn.execute(query, threshold, min_age_days)
            cleaned_count = int(result.split()[-1])

        # 获取清理后统计
        distribution_after = await self.get_retention_distribution()

        # 计算平均保留分数
        avg_query = "SELECT AVG(retention_score) FROM memories"
        async with self.pool.acquire() as conn:
            avg_score = await conn.fetchval(avg_query) or 0

        return MemoryStats(
            total_memories=sum(distribution_after.values()),
            high_value_count=distribution_after["high"],
            medium_value_count=distribution_after["medium"],
            low_value_count=distribution_after["low"],
            avg_retention_score=float(avg_score),
            cleaned_count=cleaned_count,
        )

    # ========================================
    # 情景分块检索
    # ========================================

    async def get_episodic_memories_by_time_slice(
        self,
        user_id: str,
        app_name: str,
        start_time: datetime,
        end_time: datetime,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        按时间切片检索情景记忆

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            start_time: 开始时间
            end_time: 结束时间
            limit: 最大返回数量

        Returns:
            记忆列表
        """
        query = """
            SELECT id, content, memory_type, metadata, retention_score, created_at
            FROM memories
            WHERE user_id = $1
              AND app_name = $2
              AND created_at >= $3
              AND created_at <= $4
            ORDER BY created_at DESC
            LIMIT $5
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                query, user_id, app_name, start_time, end_time, limit
            )
            return [dict(row) for row in rows]


# ========================================
# 定时清理任务
# ========================================

async def scheduled_cleanup_task(
    pool: asyncpg.Pool,
    interval_hours: int = 24,
    decay_rate: float = 0.1,
    cleanup_threshold: float = 0.1,
    min_age_days: int = 7,
) -> None:
    """
    后台定时清理任务

    Args:
        pool: 数据库连接池
        interval_hours: 清理间隔 (小时)
    """
    manager = MemoryRetentionManager(
        pool=pool,
        decay_rate=decay_rate,
        cleanup_threshold=cleanup_threshold,
        min_age_days=min_age_days,
    )

    while True:
        try:
            stats = await manager.cleanup_low_value_memories()
            print(
                f"Memory cleanup completed: "
                f"cleaned={stats.cleaned_count}, "
                f"remaining={stats.total_memories}, "
                f"avg_score={stats.avg_retention_score:.2f}"
            )
        except Exception as e:
            print(f"Memory cleanup failed: {e}")

        await asyncio.sleep(interval_hours * 3600)
```

#### 4.3.3 Context Window 组装器实现

创建 `src/cognizes/engine/hippocampus/context_assembler.py`：

```python
"""
ContextAssembler: 上下文组装器

负责根据 Token 预算动态组装上下文窗口：
- System Prompt
- Top-K Memories (按相关性)
- Recent History (最近对话)
- Facts (用户偏好)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import asyncpg


@dataclass
class ContextItem:
    """上下文项"""
    context_type: str  # 'system', 'memory', 'history', 'fact'
    content: str
    relevance_score: float = 1.0
    token_estimate: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextWindow:
    """组装后的上下文窗口"""
    items: list[ContextItem]
    total_tokens: int
    budget_used: float  # 使用的预算比例


class ContextAssembler:
    """
    上下文组装器

    职责:
    1. 根据 Token 预算分配各部分上下文
    2. 按相关性和重要性排序
    3. 动态截断以适应预算
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        max_tokens: int = 8000,
        system_ratio: float = 0.1,    # System Prompt 占比
        memory_ratio: float = 0.3,    # 记忆占比
        history_ratio: float = 0.4,   # 历史占比
        fact_ratio: float = 0.2,      # 事实占比
    ):
        self.pool = pool
        self.max_tokens = max_tokens
        self.system_ratio = system_ratio
        self.memory_ratio = memory_ratio
        self.history_ratio = history_ratio
        self.fact_ratio = fact_ratio

    async def assemble(
        self,
        user_id: str,
        app_name: str,
        thread_id: str,
        query: str,
        query_embedding: list[float],
        system_prompt: str | None = None,
    ) -> ContextWindow:
        """
        组装上下文窗口

        Args:
            user_id: 用户 ID
            app_name: 应用名称
            thread_id: 当前会话 ID
            query: 用户查询
            query_embedding: 查询的向量嵌入
            system_prompt: 系统提示词

        Returns:
            ContextWindow: 组装后的上下文
        """
        items: list[ContextItem] = []
        total_tokens = 0

        # 1. 添加 System Prompt
        if system_prompt:
            system_tokens = self._estimate_tokens(system_prompt)
            system_budget = int(self.max_tokens * self.system_ratio)

            if system_tokens <= system_budget:
                items.append(ContextItem(
                    context_type="system",
                    content=system_prompt,
                    relevance_score=1.0,
                    token_estimate=system_tokens,
                ))
                total_tokens += system_tokens

        # 2. 检索相关记忆
        memory_budget = int(self.max_tokens * self.memory_ratio)
        memories = await self._retrieve_memories(
            user_id, app_name, query_embedding, memory_budget
        )
        for mem in memories:
            if total_tokens + mem.token_estimate <= self.max_tokens:
                items.append(mem)
                total_tokens += mem.token_estimate

        # 3. 获取最近历史
        history_budget = int(self.max_tokens * self.history_ratio)
        history = await self._retrieve_history(
            thread_id, history_budget
        )
        for hist in history:
            if total_tokens + hist.token_estimate <= self.max_tokens:
                items.append(hist)
                total_tokens += hist.token_estimate

        # 4. 获取用户 Facts
        fact_budget = int(self.max_tokens * self.fact_ratio)
        facts = await self._retrieve_facts(
            user_id, app_name, query_embedding, fact_budget
        )
        for fact in facts:
            if total_tokens + fact.token_estimate <= self.max_tokens:
                items.append(fact)
                total_tokens += fact.token_estimate

        return ContextWindow(
            items=items,
            total_tokens=total_tokens,
            budget_used=total_tokens / self.max_tokens,
        )

    async def _retrieve_memories(
        self,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
        budget: int,
    ) -> list[ContextItem]:
        """检索相关记忆"""
        query = """
            SELECT
                id, content, retention_score,
                1 - (embedding <=> $3::vector) AS similarity
            FROM memories
            WHERE user_id = $1
              AND app_name = $2
              AND embedding IS NOT NULL
            ORDER BY similarity * retention_score DESC
            LIMIT 10
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, app_name, query_embedding)

        items = []
        tokens_used = 0
        for row in rows:
            token_est = self._estimate_tokens(row["content"])
            if tokens_used + token_est > budget:
                break
            items.append(ContextItem(
                context_type="memory",
                content=row["content"],
                relevance_score=float(row["similarity"]) * float(row["retention_score"]),
                token_estimate=token_est,
                metadata={"memory_id": str(row["id"])},
            ))
            tokens_used += token_est
            # 更新访问记录
            await self._record_memory_access(str(row["id"]))

        return items

    async def _retrieve_history(
        self,
        thread_id: str,
        budget: int,
    ) -> list[ContextItem]:
        """检索最近历史"""
        query = """
            SELECT id, author, content, created_at
            FROM events
            WHERE thread_id = $1
              AND event_type = 'message'
            ORDER BY sequence_num DESC
            LIMIT 30
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, uuid.UUID(thread_id))

        items = []
        tokens_used = 0
        # 反转以按时间正序
        for row in reversed(rows):
            content = row["content"]
            if isinstance(content, dict):
                text = content.get("text", str(content))
            else:
                text = str(content)

            formatted = f"[{row['author']}]: {text}"
            token_est = self._estimate_tokens(formatted)

            if tokens_used + token_est > budget:
                break
            items.append(ContextItem(
                context_type="history",
                content=formatted,
                relevance_score=1.0,  # 历史按时间排序
                token_estimate=token_est,
            ))
            tokens_used += token_est

        return items

    async def _retrieve_facts(
        self,
        user_id: str,
        app_name: str,
        query_embedding: list[float],
        budget: int,
    ) -> list[ContextItem]:
        """检索用户 Facts"""
        query = """
            SELECT
                id, fact_type, key, value, confidence,
                1 - (embedding <=> $3::vector) AS similarity
            FROM facts
            WHERE user_id = $1
              AND app_name = $2
              AND (valid_until IS NULL OR valid_until > NOW())
            ORDER BY COALESCE(1 - (embedding <=> $3::vector), confidence) DESC
            LIMIT 10
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, user_id, app_name, query_embedding)

        items = []
        tokens_used = 0
        for row in rows:
            content = f"[{row['fact_type']}] {row['key']}: {row['value']}"
            token_est = self._estimate_tokens(content)

            if tokens_used + token_est > budget:
                break
            items.append(ContextItem(
                context_type="fact",
                content=content,
                relevance_score=float(row.get("similarity") or row["confidence"]),
                token_estimate=token_est,
                metadata={"fact_id": str(row["id"])},
            ))
            tokens_used += token_est

        return items

    async def _record_memory_access(self, memory_id: str) -> None:
        """记录记忆访问"""
        query = """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed_at = NOW()
            WHERE id = $1
        """
        async with self.pool.acquire() as conn:
            await conn.execute(query, uuid.UUID(memory_id))

    def _estimate_tokens(self, text: str) -> int:
        """估算 Token 数量 (简化: 4 字符 ≈ 1 token)"""
        return len(text) // 4 + 1

    def format_context(self, window: ContextWindow) -> str:
        """将上下文窗口格式化为 Prompt"""
        sections = {
            "system": [],
            "fact": [],
            "memory": [],
            "history": [],
        }

        for item in window.items:
            sections[item.context_type].append(item.content)

        parts = []

        if sections["system"]:
            parts.append("\n".join(sections["system"]))

        if sections["fact"]:
            parts.append("## 用户偏好")
            parts.extend(sections["fact"])

        if sections["memory"]:
            parts.append("## 相关记忆")
            parts.extend(sections["memory"])

        if sections["history"]:
            parts.append("## 对话历史")
            parts.extend(sections["history"])

        return "\n\n".join(parts)
```

### 4.4 Step 4: OpenMemoryService 实现 (ADK 适配器)

#### 4.4.1 接口设计

创建 `src/cognizes/engine/hippocampus/memory_service.py`：

```python
"""
OpenMemoryService: ADK MemoryService 适配器

实现对标 Google ADK MemoryService 的接口契约，
使用 PostgreSQL + PGVector 作为后端存储。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import asyncpg

from .consolidation_worker import MemoryConsolidationWorker, JobType
from .retention_manager import MemoryRetentionManager
from .context_assembler import ContextAssembler, ContextWindow


@dataclass
class SearchMemoryResult:
    """记忆检索结果"""
    memory_id: str
    content: str
    memory_type: str
    relevance_score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchMemoryResponse:
    """检索响应"""
    memories: list[SearchMemoryResult]
    total_count: int
    query: str


class OpenMemoryService:
    """
    OpenMemoryService: 对标 ADK MemoryService

    核心能力:
    1. add_session_to_memory(): 将 Session 转化为可检索的记忆
    2. search_memory(): 基于 Query 检索相关记忆
    3. list_memories(): 列出用户的所有记忆
    """

    def __init__(
        self,
        pool: asyncpg.Pool,
        embedding_model: str = "text-embedding-004",
        max_search_results: int = 10,
    ):
        self.pool = pool
        self.embedding_model = embedding_model
        self.max_search_results = max_search_results

        # 内部组件
        self._consolidation_worker = MemoryConsolidationWorker(pool)
        self._retention_manager = MemoryRetentionManager(pool)
        self._context_assembler = ContextAssembler(pool)

    # ========================================
    # 核心接口: add_session_to_memory
    # ========================================

    async def add_session_to_memory(
        self,
        session_id: str,
        consolidation_type: str = "full",
    ) -> dict[str, Any]:
        """
        将 Session 中的对话转化为可搜索的记忆

        Args:
            session_id: 会话 ID (对应 threads.id)
            consolidation_type: 巩固类型
                - "fast": 仅快速摘要
                - "deep": 仅深度提取
                - "full": 完整巩固

        Returns:
            巩固结果 (生成的记忆 ID 列表)
        """
        job_type = {
            "fast": JobType.FAST_REPLAY,
            "deep": JobType.DEEP_REFLECTION,
            "full": JobType.FULL_CONSOLIDATION,
        }.get(consolidation_type, JobType.FULL_CONSOLIDATION)

        job = await self._consolidation_worker.consolidate(
            thread_id=session_id,
            job_type=job_type,
        )

        return {
            "job_id": job.id,
            "status": job.status.value,
            "result": job.result,
        }

    # ========================================
    # 核心接口: search_memory
    # ========================================

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
        limit: int | None = None,
        memory_type: str | None = None,
        min_relevance: float = 0.0,
    ) -> SearchMemoryResponse:
        """
        基于 Query 检索相关记忆

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            query: 查询文本
            limit: 最大返回数量
            memory_type: 过滤记忆类型 ('episodic', 'semantic', 'summary')
            min_relevance: 最小相关度阈值

        Returns:
            SearchMemoryResponse: 检索结果
        """
        import google.generativeai as genai

        limit = limit or self.max_search_results

        # 生成查询向量
        embedding_result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=query,
            task_type="retrieval_query",
        )
        query_embedding = embedding_result["embedding"]

        # 构建查询
        conditions = ["user_id = $1", "app_name = $2", "embedding IS NOT NULL"]
        params = [user_id, app_name]
        param_idx = 3

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                id, content, memory_type, metadata, retention_score,
                1 - (embedding <=> ${param_idx}::vector) AS relevance
            FROM memories
            WHERE {where_clause}
              AND (1 - (embedding <=> ${param_idx}::vector)) >= ${param_idx + 1}
            ORDER BY relevance * retention_score DESC
            LIMIT ${param_idx + 2}
        """
        params.extend([query_embedding, min_relevance, limit])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        # 记录访问
        memory_ids = [str(row["id"]) for row in rows]
        if memory_ids:
            await self._retention_manager.record_batch_access(memory_ids)

        # 构建响应
        memories = [
            SearchMemoryResult(
                memory_id=str(row["id"]),
                content=row["content"],
                memory_type=row["memory_type"],
                relevance_score=float(row["relevance"]),
                metadata=row["metadata"] if isinstance(row["metadata"], dict) else {},
            )
            for row in rows
        ]

        return SearchMemoryResponse(
            memories=memories,
            total_count=len(memories),
            query=query,
        )

    # ========================================
    # 辅助接口: list_memories
    # ========================================

    async def list_memories(
        self,
        *,
        app_name: str,
        user_id: str,
        memory_type: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        列出用户的所有记忆

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            memory_type: 过滤记忆类型
            limit: 最大返回数量
            offset: 分页偏移

        Returns:
            记忆列表
        """
        conditions = ["user_id = $1", "app_name = $2"]
        params = [user_id, app_name]
        param_idx = 3

        if memory_type:
            conditions.append(f"memory_type = ${param_idx}")
            params.append(memory_type)
            param_idx += 1

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT id, content, memory_type, metadata, retention_score, created_at
            FROM memories
            WHERE {where_clause}
            ORDER BY retention_score DESC, created_at DESC
            LIMIT ${param_idx}
            OFFSET ${param_idx + 1}
        """
        params.extend([limit, offset])

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        return [dict(row) for row in rows]

    # ========================================
    # 辅助接口: get_context_window
    # ========================================

    async def get_context_window(
        self,
        *,
        app_name: str,
        user_id: str,
        thread_id: str,
        query: str,
        system_prompt: str | None = None,
        max_tokens: int = 8000,
    ) -> ContextWindow:
        """
        获取组装好的上下文窗口

        Args:
            app_name: 应用名称
            user_id: 用户 ID
            thread_id: 当前会话 ID
            query: 用户查询
            system_prompt: 系统提示词
            max_tokens: 最大 Token 预算

        Returns:
            ContextWindow: 组装后的上下文
        """
        import google.generativeai as genai

        # 生成查询向量
        embedding_result = genai.embed_content(
            model=f"models/{self.embedding_model}",
            content=query,
            task_type="retrieval_query",
        )
        query_embedding = embedding_result["embedding"]

        # 重新配置 Token 预算
        self._context_assembler.max_tokens = max_tokens

        return await self._context_assembler.assemble(
            user_id=user_id,
            app_name=app_name,
            thread_id=thread_id,
            query=query,
            query_embedding=query_embedding,
            system_prompt=system_prompt,
        )

    # ========================================
    # 维护接口
    # ========================================

    async def cleanup_memories(
        self,
        threshold: float = 0.1,
        min_age_days: int = 7,
    ) -> dict[str, Any]:
        """
        清理低价值记忆

        Returns:
            清理统计信息
        """
        stats = await self._retention_manager.cleanup_low_value_memories(
            threshold=threshold,
            min_age_days=min_age_days,
        )
        return {
            "total_memories": stats.total_memories,
            "cleaned_count": stats.cleaned_count,
            "avg_retention_score": stats.avg_retention_score,
        }
```

---

### 4.6 Step 6: AG-UI 记忆系统可视化接口

> [!NOTE]
>
> **对标 AG-UI 协议**：本节实现 The Hippocampus 与 AG-UI 可视化层的集成，提供记忆巩固状态、记忆召回来源和记忆健康度的可视化能力。
>
> **参考资源**：
>
> - [AG-UI 协议调研](../research/070-ag-ui.md)
> - [AG-UI 官方文档](https://docs.ag-ui.com/)

#### 4.6.1 记忆可视化架构

```mermaid
graph TB
    subgraph "Hippocampus 存储层"
        MEM[memories 表]
        FACTS[facts 表]
        CONS[consolidation_jobs 表]
    end

    subgraph "可视化接口层"
        CS[ConsolidationStatus]
        MH[MemoryHit]
        MD[MemoryDashboard]
    end

    subgraph "AG-UI 事件"
        ACT[ACTIVITY_SNAPSHOT]
        CUST[CUSTOM Events]
    end

    CONS -->|巩固状态| CS
    MEM -->|召回来源| MH
    MEM & FACTS -->|健康度| MD

    CS --> ACT
    MH --> CUST
    MD --> CUST

    style CS fill:#a78bfa,stroke:#7c3aed,color:#000
    style MH fill:#4ade80,stroke:#16a34a,color:#000
    style MD fill:#fbbf24,stroke:#d97706,color:#000
```

#### 4.6.2 AG-UI 事件映射表

| Hippocampus 功能 | 触发条件                  | AG-UI 事件类型          | 展示组件     |
| :--------------- | :------------------------ | :---------------------- | :----------- |
| 记忆巩固进度     | Consolidation Worker 执行 | `ACTIVITY_SNAPSHOT`     | 巩固进度条   |
| 记忆召回         | search_memory() 返回结果  | `CUSTOM (memory_hit)`   | 来源标注卡片 |
| 遗忘曲线更新     | retention_score 衰减      | `CUSTOM (decay_update)` | 记忆热力图   |
| 上下文预算       | Context Budgeting 执行    | `STATE_DELTA`           | Token 仪表盘 |

#### 4.6.3 MemoryVisualizer 实现

创建 `src/cognizes/engine/hippocampus/memory_visualizer.py`：

```python
"""
Hippocampus MemoryVisualizer: 记忆系统可视化接口

职责:
1. 提供记忆巩固状态可视化
2. 实现记忆召回来源标注
3. 展示记忆健康度仪表盘数据
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime, timedelta
from enum import Enum


class MemoryEventType(str, Enum):
    """记忆相关 AG-UI 事件类型"""
    CONSOLIDATION_PROGRESS = "memory_consolidation_progress"
    MEMORY_HIT = "memory_hit"
    DECAY_UPDATE = "memory_decay_update"
    CONTEXT_BUDGET = "memory_context_budget"


@dataclass
class ConsolidationProgress:
    """记忆巩固进度"""
    job_id: str
    status: str  # pending, running, completed, failed
    total_events: int
    processed_events: int
    extracted_facts: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    @property
    def progress_percent(self) -> float:
        if self.total_events == 0:
            return 0.0
        return (self.processed_events / self.total_events) * 100


@dataclass
class MemoryHit:
    """记忆召回命中"""
    memory_id: str
    memory_type: str  # episodic, semantic, procedural
    content_preview: str
    relevance_score: float
    source_session_id: Optional[str] = None
    created_at: Optional[datetime] = None
    retention_score: float = 1.0


@dataclass
class MemoryHealthMetrics:
    """记忆健康度指标"""
    total_memories: int
    episodic_count: int
    semantic_count: int
    procedural_count: int
    avg_retention_score: float
    low_retention_count: int  # retention_score < 0.3
    decay_rate_7d: float  # 7 天内衰减率
    top_accessed_memories: list[str]


class MemoryVisualizer:
    """记忆系统可视化器"""

    def __init__(self, pool, event_emitter=None):
        """
        Args:
            pool: asyncpg 连接池
            event_emitter: AG-UI 事件发射器 (可选)
        """
        self._pool = pool
        self._event_emitter = event_emitter

    async def emit_consolidation_progress(
        self,
        run_id: str,
        job_id: str
    ) -> ConsolidationProgress:
        """
        发射记忆巩固进度事件

        Args:
            run_id: 当前运行 ID
            job_id: 巩固任务 ID

        Returns:
            巩固进度信息
        """
        async with self._pool.acquire() as conn:
            job = await conn.fetchrow("""
                SELECT
                    id, status,
                    (input_data->>'total_events')::int as total_events,
                    (input_data->>'processed_events')::int as processed_events,
                    (output_data->>'extracted_facts')::int as extracted_facts,
                    started_at, completed_at
                FROM consolidation_jobs
                WHERE id = $1
            """, job_id)

            if not job:
                return None

            progress = ConsolidationProgress(
                job_id=str(job["id"]),
                status=job["status"],
                total_events=job["total_events"] or 0,
                processed_events=job["processed_events"] or 0,
                extracted_facts=job["extracted_facts"] or 0,
                start_time=job["started_at"],
                end_time=job["completed_at"]
            )

            # 发射 AG-UI 事件
            if self._event_emitter:
                await self._event_emitter.emit_activity_snapshot(
                    run_id=run_id,
                    activity_type="memory_consolidation",
                    data={
                        "jobId": progress.job_id,
                        "status": progress.status,
                        "progressPercent": progress.progress_percent,
                        "extractedFacts": progress.extracted_facts
                    }
                )

            return progress

    async def emit_memory_hits(
        self,
        run_id: str,
        query: str,
        hits: list[dict]
    ) -> list[MemoryHit]:
        """
        发射记忆召回命中事件

        用于在 Agent 响应中标注记忆来源

        Args:
            run_id: 当前运行 ID
            query: 搜索查询
            hits: 召回结果列表

        Returns:
            记忆命中列表
        """
        memory_hits = []

        for hit in hits:
            memory_hit = MemoryHit(
                memory_id=hit["id"],
                memory_type=hit.get("memory_type", "episodic"),
                content_preview=hit.get("content", "")[:200],
                relevance_score=hit.get("score", 0.0),
                source_session_id=hit.get("session_id"),
                created_at=hit.get("created_at"),
                retention_score=hit.get("retention_score", 1.0)
            )
            memory_hits.append(memory_hit)

        # 发射 AG-UI CUSTOM 事件
        if self._event_emitter:
            await self._event_emitter.emit_custom(
                run_id=run_id,
                event_name=MemoryEventType.MEMORY_HIT.value,
                data={
                    "query": query,
                    "hits": [
                        {
                            "memoryId": h.memory_id,
                            "memoryType": h.memory_type,
                            "preview": h.content_preview,
                            "score": h.relevance_score,
                            "retentionScore": h.retention_score
                        }
                        for h in memory_hits
                    ]
                }
            )

        return memory_hits

    async def get_health_metrics(
        self,
        user_id: str,
        app_name: str
    ) -> MemoryHealthMetrics:
        """
        获取记忆健康度指标

        用于渲染记忆健康度仪表盘

        Args:
            user_id: 用户 ID
            app_name: 应用名称

        Returns:
            记忆健康度指标
        """
        async with self._pool.acquire() as conn:
            # 基础统计
            stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE memory_type = 'episodic') as episodic,
                    COUNT(*) FILTER (WHERE memory_type = 'semantic') as semantic,
                    COUNT(*) FILTER (WHERE memory_type = 'procedural') as procedural,
                    AVG(retention_score) as avg_retention,
                    COUNT(*) FILTER (WHERE retention_score < 0.3) as low_retention
                FROM memories
                WHERE user_id = $1 AND app_name = $2
            """, user_id, app_name)

            # 7 天衰减率
            decay_stats = await conn.fetchrow("""
                WITH old_scores AS (
                    SELECT AVG(retention_score) as avg_score
                    FROM memories
                    WHERE user_id = $1 AND app_name = $2
                      AND created_at < NOW() - INTERVAL '7 days'
                ),
                new_scores AS (
                    SELECT AVG(retention_score) as avg_score
                    FROM memories
                    WHERE user_id = $1 AND app_name = $2
                )
                SELECT
                    COALESCE(
                        (old_scores.avg_score - new_scores.avg_score) /
                        NULLIF(old_scores.avg_score, 0) * 100,
                        0
                    ) as decay_rate
                FROM old_scores, new_scores
            """, user_id, app_name)

            # 最常访问的记忆
            top_accessed = await conn.fetch("""
                SELECT id
                FROM memories
                WHERE user_id = $1 AND app_name = $2
                ORDER BY access_count DESC, retention_score DESC
                LIMIT 5
            """, user_id, app_name)

            return MemoryHealthMetrics(
                total_memories=stats["total"] or 0,
                episodic_count=stats["episodic"] or 0,
                semantic_count=stats["semantic"] or 0,
                procedural_count=stats["procedural"] or 0,
                avg_retention_score=float(stats["avg_retention"] or 0),
                low_retention_count=stats["low_retention"] or 0,
                decay_rate_7d=float(decay_stats["decay_rate"] or 0),
                top_accessed_memories=[str(r["id"]) for r in top_accessed]
            )

    async def emit_context_budget_status(
        self,
        run_id: str,
        budget_info: dict
    ) -> None:
        """
        发射上下文预算状态事件

        Args:
            run_id: 当前运行 ID
            budget_info: 预算信息
        """
        if self._event_emitter:
            await self._event_emitter.emit_state_delta(
                run_id=run_id,
                delta=[{
                    "op": "replace",
                    "path": "/contextBudget",
                    "value": {
                        "totalTokens": budget_info.get("total_tokens", 0),
                        "usedTokens": budget_info.get("used_tokens", 0),
                        "memoriesIncluded": budget_info.get("memories_count", 0),
                        "memoryTokens": budget_info.get("memory_tokens", 0)
                    }
                }]
            )
```

#### 4.6.4 前端展示组件规范

| 组件名称                   | 数据源              | 展示内容                           |
| :------------------------- | :------------------ | :--------------------------------- |
| `ConsolidationProgressBar` | ACTIVITY_SNAPSHOT   | 进度百分比、提取事实数             |
| `MemorySourceCard`         | CUSTOM (memory_hit) | 记忆类型图标、内容预览、相关性分数 |
| `MemoryHealthDashboard`    | API 轮询            | 总数、类型分布、衰减曲线           |
| `TokenBudgetMeter`         | STATE_DELTA         | 已用/总量进度条                    |

#### 4.6.5 任务清单

| 任务 ID | 任务描述                   | 状态      | 验收标准         |
| :------ | :------------------------- | :-------- | :--------------- |
| P2-6-1  | 实现 `MemoryVisualizer` 类 | 🔲 待开始 | 4 种事件类型支持 |
| P2-6-2  | 实现巩固进度事件发射       | 🔲 待开始 | 进度实时更新     |
| P2-6-3  | 实现记忆召回来源标注       | 🔲 待开始 | 来源可追溯       |
| P2-6-4  | 实现健康度指标接口         | 🔲 待开始 | 指标计算正确     |
| P2-6-5  | 编写可视化接口测试         | 🔲 待开始 | 覆盖率 > 80%     |

#### 4.6.6 验收标准

| 验收项     | 验收标准                    | 验证方法 |
| :--------- | :-------------------------- | :------- |
| 巩固进度   | 实时展示巩固进度百分比      | 集成测试 |
| 来源标注   | 召回的记忆显示来源会话      | E2E 测试 |
| 健康度     | 正确计算衰减率和分类统计    | 单元测试 |
| Token 预算 | 实时更新上下文 Token 使用量 | 集成测试 |

---

## 5. 验收标准

### 5.1 功能验收矩阵

| 验收项                | 任务 ID           | 验收标准                                                 | 验证方法                |
| :-------------------- | :---------------- | :------------------------------------------------------- | :---------------------- |
| **Schema 部署**       | P2-2-1 ~ P2-2-2   | `memories`, `facts`, `consolidation_jobs` 表创建成功     | `\dt` 查看表列表        |
| **Fast Replay**       | P2-2-5 ~ P2-2-8   | 对话摘要生成成功，存入 `memories` 表                     | 单元测试                |
| **Deep Reflection**   | P2-2-9 ~ P2-2-12  | Facts 提取成功，存入 `facts` 表 (Upsert 逻辑正确)        | 单元测试 + 重复插入测试 |
| **Read-Your-Writes**  | P2-2-13 ~ P2-2-14 | 新记忆在下一 Turn 立即可检索                             | 延迟测试 (< 100ms)      |
| **艾宾浩斯衰减**      | P2-3-1 ~ P2-3-4   | `retention_score` 随时间衰减，高频访问提升分数           | 衰减曲线验证            |
| **情景分块**          | P2-3-5 ~ P2-3-7   | 按时间切片检索 P99 < 100ms (10 万记忆规模)               | 性能测试                |
| **Context Window**    | P2-3-8 ~ P2-3-11  | 动态组装 Context 不超出 Token 预算，超限时自动截断       | Token 统计测试          |
| **OpenMemoryService** | Phase 2 综合      | 实现 `add_session_to_memory()` 和 `search_memory()` 接口 | 接口兼容性测试          |

### 5.2 性能验收指标

| 指标                 | 目标值    | 测试条件                      |
| :------------------- | :-------- | :---------------------------- |
| **记忆写入延迟**     | < 500ms   | 单次 `consolidate()` 调用     |
| **记忆检索延迟**     | < 50ms    | `search_memory()` Top-10 结果 |
| **向量索引 QPS**     | > 100 QPS | 10 万向量规模                 |
| **Read-Your-Writes** | < 100ms   | 新记忆可见延迟                |
| **Context 组装延迟** | < 100ms   | 8000 Token 预算               |

### 5.3 兼容性验收

| 验收项                     | 验收标准                                                |
| :------------------------- | :------------------------------------------------------ |
| **ADK MemoryService 兼容** | `OpenMemoryService` 可作为 ADK `MemoryService` 替代使用 |
| **Phase 1 兼容**           | 与 `threads`/`events` 表无缝关联                        |
| **向量格式兼容**           | 使用与 Phase 1 相同的 1536 维向量 (Gemini embedding)    |

### 5.4 验证测试代码

> [!NOTE]
>
> 本节提供关键验证测试的代码实现，对应任务 P2-2-13~14, P2-3-7, P2-4-3。

#### 5.4.1 Read-Your-Writes 延迟测试 (P2-2-13, P2-2-14)

创建 `tests/hippocampus/test_read_your_writes.py`：

```python
"""
Read-Your-Writes 延迟测试

验证新写入的记忆能否在下一个 Turn 立即可见，
确保我们的 Zero-ETL 架构比 Google 方案更快。

验收标准: 延迟 < 100ms
"""

import asyncio
import time
import uuid
from statistics import mean, stdev

import asyncpg
import pytest

from hippocampus.consolidation_worker import MemoryConsolidationWorker, JobType
from hippocampus.memory_service import OpenMemoryService


class TestReadYourWrites:
    """Read-Your-Writes 延迟测试套件"""

    @pytest.fixture
    async def pool(self):
        """创建数据库连接池"""
        pool = await asyncpg.create_pool(
            "postgresql://user:pass@localhost/agent_db_test"
        )
        yield pool
        await pool.close()

    @pytest.fixture
    async def memory_service(self, pool):
        """创建 MemoryService 实例"""
        return OpenMemoryService(pool)

    @pytest.fixture
    async def setup_test_thread(self, pool):
        """创建测试用的 Thread 和 Events"""
        thread_id = str(uuid.uuid4())
        user_id = "test_user"
        app_name = "test_app"

        async with pool.acquire() as conn:
            # 创建 Thread
            await conn.execute("""
                INSERT INTO threads (id, user_id, app_name, state)
                VALUES ($1, $2, $3, '{}')
            """, uuid.UUID(thread_id), user_id, app_name)

            # 创建测试 Events
            for i in range(5):
                await conn.execute("""
                    INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                    VALUES ($1, $2, 'message', $3, $4)
                """, uuid.UUID(thread_id),
                    'user' if i % 2 == 0 else 'agent',
                    f'{{"text": "测试消息 {i}"}}',
                    i)

        yield {"thread_id": thread_id, "user_id": user_id, "app_name": app_name}

        # 清理
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM threads WHERE id = $1", uuid.UUID(thread_id))

    async def test_read_your_writes_latency(
        self, pool, memory_service, setup_test_thread
    ):
        """
        验证 Read-Your-Writes 延迟 < 100ms

        流程:
        1. 执行记忆巩固 (写入)
        2. 立即执行记忆检索 (读取)
        3. 测量从写入完成到读取成功的延迟
        """
        thread_info = setup_test_thread
        latencies = []

        for _ in range(10):  # 执行 10 次测量
            # Step 1: 执行巩固 (写入)
            result = await memory_service.add_session_to_memory(
                session_id=thread_info["thread_id"],
                consolidation_type="fast"
            )
            assert result["status"] == "completed"

            # Step 2: 立即检索 (读取) 并测量延迟
            start = time.perf_counter()
            search_result = await memory_service.search_memory(
                app_name=thread_info["app_name"],
                user_id=thread_info["user_id"],
                query="测试消息",
            )
            end = time.perf_counter()

            latency_ms = (end - start) * 1000
            latencies.append(latency_ms)

            # 验证记忆可见
            assert search_result.total_count > 0, "新记忆应立即可见"

        # 统计结果
        avg_latency = mean(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]

        print(f"\n=== Read-Your-Writes 延迟测试结果 ===")
        print(f"平均延迟: {avg_latency:.2f} ms")
        print(f"P99 延迟: {p99_latency:.2f} ms")
        print(f"标准差: {stdev(latencies):.2f} ms")

        # 验收标准: P99 < 100ms
        assert p99_latency < 100, f"P99 延迟 {p99_latency:.2f}ms 超过 100ms 阈值"


# 运行: pytest -v tests/hippocampus/test_read_your_writes.py
```

#### 5.4.2 情景分块检索性能测试 (P2-3-7)

创建 `tests/hippocampus/test_episodic_performance.py`：

```python
"""
情景分块检索性能测试

验证在 10 万记忆规模下，按时间切片检索的 P99 < 100ms。
"""

import asyncio
import random
import time
import uuid
from datetime import datetime, timedelta
from statistics import mean

import asyncpg
import pytest


class TestEpisodicPerformance:
    """情景分块性能测试套件"""

    MEMORY_COUNT = 100_000  # 10 万记忆
    TEST_RUNS = 50

    @pytest.fixture(scope="class")
    async def pool(self):
        """创建数据库连接池"""
        pool = await asyncpg.create_pool(
            "postgresql://user:pass@localhost/agent_db_test",
            min_size=5,
            max_size=20,
        )
        yield pool
        await pool.close()

    @pytest.fixture(scope="class")
    async def seed_memories(self, pool):
        """
        预先填充 10 万条测试记忆

        注意: 此 fixture 仅在测试类首次运行时执行
        """
        user_id = "perf_test_user"
        app_name = "perf_test_app"

        async with pool.acquire() as conn:
            # 检查是否已有测试数据
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM memories WHERE user_id = $1",
                user_id
            )
            if count >= self.MEMORY_COUNT:
                print(f"\n已存在 {count} 条测试记忆，跳过种子数据生成")
                return {"user_id": user_id, "app_name": app_name}

            print(f"\n开始生成 {self.MEMORY_COUNT} 条测试记忆...")

            # 批量插入 (每批 1000 条)
            batch_size = 1000
            base_time = datetime.now() - timedelta(days=365)

            for batch in range(self.MEMORY_COUNT // batch_size):
                rows = []
                for i in range(batch_size):
                    created_at = base_time + timedelta(
                        minutes=random.randint(0, 525600)  # 一年内随机
                    )
                    rows.append((
                        uuid.uuid4(),
                        user_id,
                        app_name,
                        'episodic',
                        f'测试记忆内容 {batch * batch_size + i}',
                        random.random(),  # retention_score
                        random.randint(0, 100),  # access_count
                        created_at,
                    ))

                await conn.executemany("""
                    INSERT INTO memories (id, user_id, app_name, memory_type, content,
                                         retention_score, access_count, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """, rows)

                if (batch + 1) % 10 == 0:
                    print(f"  已插入 {(batch + 1) * batch_size} 条记忆")

            print(f"测试数据生成完成")

        return {"user_id": user_id, "app_name": app_name}

    async def test_time_slice_query_performance(self, pool, seed_memories):
        """
        测试按时间切片查询性能

        验收标准: P99 < 100ms
        """
        user_id = seed_memories["user_id"]
        app_name = seed_memories["app_name"]

        latencies = []

        for _ in range(self.TEST_RUNS):
            # 随机选择一个 7 天的时间窗口
            start_offset = random.randint(0, 358)
            start_time = datetime.now() - timedelta(days=365 - start_offset)
            end_time = start_time + timedelta(days=7)

            # 执行时间切片查询
            start = time.perf_counter()

            async with pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT id, content, retention_score, created_at
                    FROM memories
                    WHERE user_id = $1
                      AND app_name = $2
                      AND created_at >= $3
                      AND created_at <= $4
                    ORDER BY created_at DESC
                    LIMIT 50
                """, user_id, app_name, start_time, end_time)

            end = time.perf_counter()
            latency_ms = (end - start) * 1000
            latencies.append(latency_ms)

        # 统计结果
        avg_latency = mean(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]
        max_latency = max(latencies)

        print(f"\n=== 情景分块检索性能测试结果 ({self.MEMORY_COUNT:,} 条记忆) ===")
        print(f"平均延迟: {avg_latency:.2f} ms")
        print(f"P99 延迟: {p99_latency:.2f} ms")
        print(f"最大延迟: {max_latency:.2f} ms")
        print(f"测试次数: {self.TEST_RUNS}")

        # 验收标准: P99 < 100ms
        assert p99_latency < 100, f"P99 延迟 {p99_latency:.2f}ms 超过 100ms 阈值"

    async def test_composite_index_usage(self, pool, seed_memories):
        """验证复合索引 (user_id, app_name, created_at) 被正确使用"""
        user_id = seed_memories["user_id"]
        app_name = seed_memories["app_name"]
        start_time = datetime.now() - timedelta(days=30)
        end_time = datetime.now()

        async with pool.acquire() as conn:
            # 使用 EXPLAIN ANALYZE 检查查询计划
            plan = await conn.fetch("""
                EXPLAIN ANALYZE
                SELECT id, content, retention_score, created_at
                FROM memories
                WHERE user_id = $1
                  AND app_name = $2
                  AND created_at >= $3
                  AND created_at <= $4
                ORDER BY created_at DESC
                LIMIT 50
            """, user_id, app_name, start_time, end_time)

            plan_text = "\n".join(row[0] for row in plan)
            print(f"\n=== 查询执行计划 ===\n{plan_text}")

            # 验证使用了索引扫描
            assert "Index" in plan_text, "查询应使用索引扫描"
            assert "Seq Scan" not in plan_text, "不应使用全表扫描"


# 运行: pytest -v tests/hippocampus/test_episodic_performance.py
```

#### 5.4.3 单元测试框架 (P2-4-3)

创建 `tests/hippocampus/conftest.py` (pytest 配置):

```python
"""
Hippocampus 测试配置

提供测试 fixtures 和共享配置
"""

import asyncio
import os

import asyncpg
import pytest


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db_pool():
    """
    创建测试数据库连接池

    环境变量:
    - TEST_DATABASE_URL: 测试数据库连接字符串
    """
    database_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql://user:pass@localhost/agent_db_test"
    )
    pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
    yield pool
    await pool.close()


@pytest.fixture
async def clean_test_data(test_db_pool):
    """
    测试后清理数据

    在每个测试结束后删除测试期间创建的数据
    """
    created_ids = {"threads": [], "memories": [], "facts": []}

    yield created_ids

    # 清理
    async with test_db_pool.acquire() as conn:
        if created_ids["facts"]:
            await conn.execute(
                "DELETE FROM facts WHERE id = ANY($1::uuid[])",
                created_ids["facts"]
            )
        if created_ids["memories"]:
            await conn.execute(
                "DELETE FROM memories WHERE id = ANY($1::uuid[])",
                created_ids["memories"]
            )
        if created_ids["threads"]:
            await conn.execute(
                "DELETE FROM threads WHERE id = ANY($1::uuid[])",
                created_ids["threads"]
            )
```

创建 `tests/hippocampus/test_consolidation_worker.py`:

```python
"""
MemoryConsolidationWorker 单元测试
"""

import uuid
import pytest

from hippocampus.consolidation_worker import (
    MemoryConsolidationWorker,
    JobType,
    JobStatus,
)


class TestConsolidationWorker:
    """Consolidation Worker 单元测试"""

    @pytest.fixture
    async def worker(self, test_db_pool):
        return MemoryConsolidationWorker(test_db_pool)

    async def test_fast_replay_generates_summary(self, worker, test_db_pool, clean_test_data):
        """Fast Replay 应生成对话摘要"""
        # Setup: 创建测试 Thread 和 Events
        thread_id = str(uuid.uuid4())
        async with test_db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO threads (id, user_id, app_name, state)
                VALUES ($1, 'test_user', 'test_app', '{}')
            """, uuid.UUID(thread_id))
            clean_test_data["threads"].append(uuid.UUID(thread_id))

            for i in range(3):
                await conn.execute("""
                    INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                    VALUES ($1, $2, 'message', $3, $4)
                """, uuid.UUID(thread_id),
                    'user' if i % 2 == 0 else 'agent',
                    f'{{"text": "对话内容 {i}"}}', i)

        # Act
        job = await worker.consolidate(thread_id, JobType.FAST_REPLAY)

        # Assert
        assert job.status == JobStatus.COMPLETED
        assert "summary" in job.result
        assert job.result["summary"]["memory_id"]

    async def test_deep_reflection_extracts_facts(self, worker, test_db_pool, clean_test_data):
        """Deep Reflection 应提取 Facts"""
        thread_id = str(uuid.uuid4())
        async with test_db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO threads (id, user_id, app_name, state)
                VALUES ($1, 'test_user', 'test_app', '{}')
            """, uuid.UUID(thread_id))
            clean_test_data["threads"].append(uuid.UUID(thread_id))

            # 创建包含偏好信息的对话
            await conn.execute("""
                INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                VALUES ($1, 'user', 'message', '{"text": "我喜欢吃寿司和意大利面"}', 0)
            """, uuid.UUID(thread_id))

        # Act
        job = await worker.consolidate(thread_id, JobType.DEEP_REFLECTION)

        # Assert
        assert job.status == JobStatus.COMPLETED
        # Facts 可能为空 (取决于 LLM 提取结果)，但任务应成功完成

    async def test_full_consolidation_runs_both_phases(self, worker, test_db_pool, clean_test_data):
        """Full Consolidation 应执行两个阶段"""
        thread_id = str(uuid.uuid4())
        async with test_db_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO threads (id, user_id, app_name, state)
                VALUES ($1, 'test_user', 'test_app', '{}')
            """, uuid.UUID(thread_id))
            clean_test_data["threads"].append(uuid.UUID(thread_id))

            await conn.execute("""
                INSERT INTO events (thread_id, author, event_type, content, sequence_num)
                VALUES ($1, 'user', 'message', '{"text": "测试消息"}', 0)
            """, uuid.UUID(thread_id))

        # Act
        job = await worker.consolidate(thread_id, JobType.FULL_CONSOLIDATION)

        # Assert
        assert job.status == JobStatus.COMPLETED
        assert "summary" in job.result  # Fast Replay 结果
        assert "facts" in job.result or "insights" in job.result  # Deep Reflection 结果
```

---

## 6. 交付物清单

### 6.1 Schema 文件

| 文件路径                                            | 描述                    | 状态      |
| :-------------------------------------------------- | :---------------------- | :-------- |
| `src/cognizes/engine/schema/hippocampus_schema.sql` | Hippocampus 扩展 Schema | 🔲 待开始 |

### 6.2 代码文件

| 文件路径                                                  | 描述            | 状态      |
| :-------------------------------------------------------- | :-------------- | :-------- |
| `src/cognizes/engine/hippocampus/__init__.py`             | 模块初始化      | 🔲 待开始 |
| `src/cognizes/engine/hippocampus/consolidation_worker.py` | 记忆巩固 Worker | 🔲 待开始 |
| `src/cognizes/engine/hippocampus/retention_manager.py`    | 记忆保持管理器  | 🔲 待开始 |
| `src/cognizes/engine/hippocampus/context_assembler.py`    | 上下文组装器    | 🔲 待开始 |
| `src/cognizes/engine/hippocampus/memory_service.py`       | ADK 适配器      | 🔲 待开始 |

### 6.3 测试文件

| 文件路径                                                     | 描述                       | 状态      |
| :----------------------------------------------------------- | :------------------------- | :-------- |
| `tests/integration/hippocampus/test_consolidation_worker.py` | Worker 单元测试            | 🔲 待开始 |
| `tests/integration/hippocampus/test_retention_manager.py`    | 保持管理器单元测试         | 🔲 待开始 |
| `tests/integration/hippocampus/test_context_assembler.py`    | 上下文组装器单元测试       | 🔲 待开始 |
| `tests/integration/hippocampus/test_memory_service.py`       | OpenMemoryService 集成测试 | 🔲 待开始 |

### 6.4 目录结构

```
src/cognizes/engine/
├── schema/
│   ├── agent_schema.sql           # Phase 1 基础 Schema
│   └── hippocampus_schema.sql     # Phase 2 扩展 Schema
├── engine/
│   ├── pulse/                     # Phase 1: The Pulse
│   │   ├── __init__.py
│   │   ├── state_manager.py
│   │   └── pg_notify_listener.py
│   └── hippocampus/               # Phase 2: The Hippocampus
│       ├── __init__.py
│       ├── consolidation_worker.py
│       ├── retention_manager.py
│       ├── context_assembler.py
│       └── memory_service.py
tests/
├── pulse/
│   └── test_state_manager.py
└── hippocampus/
    ├── test_consolidation_worker.py
    ├── test_retention_manager.py
    ├── test_context_assembler.py
    └── test_memory_service.py
```

---

## 7. 风险与缓解策略

### 7.1 技术风险

| 风险                        | 影响 | 概率 | 缓解策略                                |
| :-------------------------- | :--- | :--- | :-------------------------------------- |
| **LLM 提取不稳定**          | 中   | 中   | 设计健壮的 JSON 解析逻辑，容错处理      |
| **向量检索精度不足**        | 高   | 低   | 引入 Reranker (Phase 3)，调优 HNSW 参数 |
| **艾宾浩斯衰减参数不合理**  | 中   | 中   | 提供可配置参数，通过 A/B 测试调优       |
| **Context Window 组装偏差** | 中   | 低   | 实现精确 Token 统计 (使用 tiktoken)     |

### 7.2 工程风险

| 风险                        | 影响 | 概率 | 缓解策略                               |
| :-------------------------- | :--- | :--- | :------------------------------------- |
| **Gemini API 限流**         | 高   | 中   | 实现指数退避重试，批量处理减少调用次数 |
| **大规模记忆清理阻塞**      | 中   | 低   | 使用 `pg_cron` 定时任务，分批删除      |
| **Phase 1 Schema 变更影响** | 低   | 低   | 使用外键约束，确保数据一致性           |

---

## 8. 附录

### 8.1 Prompt 模板参考

#### Fast Replay Prompt

```
你是一个对话摘要专家。请将以下对话历史压缩为一个简洁的摘要，保留关键信息。

对话历史:
{conversation}

要求:
1. 摘要长度不超过 200 字
2. 保留用户的关键问题和 Agent 的核心回答
3. 保留任何重要的决策或结论
4. 使用第三人称描述

请直接输出摘要，不要添加任何前缀或解释。
```

#### Deep Reflection Prompt

```
你是一个用户画像分析专家。请从以下对话中提取用户的关键信息，包括偏好、规则和事实。

对话历史:
{conversation}

请以 JSON 格式输出，格式如下:
{
    "facts": [
        {
            "type": "preference|rule|profile",
            "key": "偏好/规则的唯一标识，如 food_preference",
            "value": {"具体的偏好内容"},
            "confidence": 0.0-1.0 的置信度分数
        }
    ],
    "insights": [
        {
            "content": "从对话中提炼的深层洞察",
            "importance": "high|medium|low"
        }
    ]
}

要求:
1. 只提取明确表达或可靠推断的信息
2. preference: 用户的喜好（如饮食、风格偏好）
3. rule: 用户设定的规则（如"每周五不开会"）
4. profile: 用户的基本信息（如职业、位置）
5. 如果没有可提取的信息，返回空数组

请只输出 JSON，不要添加任何其他内容。
```

### 8.2 衰减算法参数调优指南

| 场景               | 推荐 λ (decay_rate) | 推荐阈值 (threshold) | 说明                       |
| :----------------- | :------------------ | :------------------- | :------------------------- |
| **高交互频率 App** | 0.15                | 0.15                 | 加速遗忘，保持记忆新鲜度   |
| **低交互频率 App** | 0.05                | 0.05                 | 减缓遗忘，保留更多历史记忆 |
| **敏感信息场景**   | 0.3                 | 0.2                  | 快速清理，减少隐私风险     |
| **知识积累场景**   | 0.02                | 0.02                 | 长期保留，构建知识图谱     |

---

## 9. Phase 2 验证 SOP

> [!IMPORTANT]
>
> 本节提供 Phase 2: The Hippocampus 完整验收流程，请按顺序逐步执行。

### 9.1 Step 1: Schema 部署验证

```bash
# 1.1 确保 Phase 1 Schema 已部署
psql -d 'cognizes-engine' -c "\dt threads"
# 应显示 threads 表

# 1.2 部署 Hippocampus Schema
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/hippocampus_schema.sql

# 1.3 验证表创建
psql -d 'cognizes-engine' -c "\dt"
# 应显示: memories, facts, consolidation_jobs, instructions

# 1.4 验证索引
psql -d 'cognizes-engine' -c "\di" | grep -E "(memories|facts)"

# 1.5 验证函数
psql -d 'cognizes-engine' -c "\df calculate_retention_score"
psql -d 'cognizes-engine' -c "\df cleanup_low_value_memories"

# 1.6 测试衰减函数
psql -d 'cognizes-engine' -c "SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days', 0.1);"
# 应返回 0.x 的浮点数
```

**验收标准**：

- [ ] `memories`, `facts`, `consolidation_jobs`, `instructions` 表存在
- [ ] HNSW 向量索引已创建
- [ ] `calculate_retention_score` 函数可正常调用
- [ ] `cleanup_low_value_memories` 函数存在

---

### 9.1.1 Step 1.1: pg_cron 定时任务配置 (P2-2-8, P2-3-4)

> [!IMPORTANT]
>
> pg_cron 定时任务用于自动触发记忆巩固和低价值记忆清理，需配置后 Phase 2 验收才能完整通过。

```bash
# 1.1 检查 pg_cron 扩展是否已安装 (Phase 1 已完成)
psql -d 'cognizes-engine' -c "SELECT * FROM pg_extension WHERE extname = 'pg_cron';"
# 应返回 1 行记录

# 1.2 配置定时任务 - 每天凌晨 2 点清理低价值记忆 (P2-3-4)
psql -d 'cognizes-engine' -c "
SELECT cron.schedule(
    'cleanup_memories',
    '0 2 * * *',
    \$\$SELECT cleanup_low_value_memories(0.1, 7)\$\$
);
"
# 应返回任务 ID (如 1)

# 1.3 配置定时任务 - 每小时触发记忆巩固检查 (P2-2-8)
psql -d 'cognizes-engine' -c "
SELECT cron.schedule(
    'trigger_consolidation',
    '0 * * * *',
    \$\$
    INSERT INTO consolidation_jobs (thread_id, job_type, status)
    SELECT id, 'full_consolidation', 'pending'
    FROM threads
    WHERE updated_at > NOW() - INTERVAL '1 hour'
      AND id NOT IN (
          SELECT thread_id FROM consolidation_jobs
          WHERE created_at > NOW() - INTERVAL '1 hour'
      )
    \$\$
);
"
# 应返回任务 ID (如 2)

# 1.4 验证定时任务创建成功
psql -d 'cognizes-engine' -c "SELECT jobid, jobname, schedule, command FROM cron.job;"
# 应显示 cleanup_memories 和 trigger_consolidation 两个任务

# 1.5 查看任务执行日志 (首次配置后可能为空)
psql -d 'cognizes-engine' -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;"

# 1.6 手动测试清理函数 (可选)
psql -d 'cognizes-engine' -c "SELECT cleanup_low_value_memories(0.1, 7);"
# 应返回清理的记录数 (可能为 0)
```

**验收标准**：

- [ ] pg_cron 扩展已安装
- [ ] `cleanup_memories` 定时任务已创建 (每天 02:00)
- [ ] `trigger_consolidation` 定时任务已创建 (每小时)
- [ ] `cron.job` 表显示 2 个任务

**删除任务 (如需重新配置)**：

```bash
# 删除指定任务
psql -d 'cognizes-engine' -c "SELECT cron.unschedule('cleanup_memories');"
psql -d 'cognizes-engine' -c "SELECT cron.unschedule('trigger_consolidation');"
```

---

### 9.2 Step 2: 单元测试验证

```bash
# 2.1 运行 Hippocampus 单元测试
uv run pytest tests/unittests/hippocampus/ -v --tb=short

# 2.2 查看测试覆盖率 (可选，需先安装 pytest-cov)
# uv add pytest-cov --dev
uv run pytest tests/unittests/hippocampus/ -v --cov=src/cognizes/engine/hippocampus --cov-report=term-missing
```

**验收标准**：

- [ ] 35 个单元测试全部通过
- [ ] 覆盖以下模块:
  - `consolidation_worker.py` (数据类、枚举、格式化逻辑)
  - `retention_manager.py` (保留分数分布)
  - `context_assembler.py` (Token 估算、上下文格式化)
  - `memory_service.py` (服务参数验证)
  - `memory_visualizer.py` (事件类型、进度计算)

---

### 9.3 Step 3: 集成测试验证

```bash
# 3.1 运行 Hippocampus 集成测试
uv run pytest tests/integration/hippocampus/ -v -s --tb=short

# 3.2 查看详细输出 (含性能指标)
uv run pytest tests/integration/hippocampus/ -v -s
```

**验收标准**：

- [ ] 16 个集成测试全部通过
- [ ] Schema 测试通过: 表结构、索引、函数、约束
- [ ] Read-Your-Writes 延迟 < 100ms
- [ ] 情景分块检索性能 P99 < 50ms (1K 规模)
- [ ] 保留分数分布统计正确
- [ ] 访问计数递增正确
- [ ] Fact Upsert 约束生效

---

### 9.4 Step 4: 性能测试 (可选, 10 万规模)

```bash
# 4.0 清理历史性能测试数据 (避免存量数据影响结果)
uv run python -c "
import asyncio
import asyncpg

async def cleanup():
    pool = await asyncpg.create_pool('postgresql://aigc:@localhost/cognizes-engine')
    user_id = 'perf_test_user'

    async with pool.acquire() as conn:
        # 统计现有数据
        count = await conn.fetchval(
            'SELECT COUNT(*) FROM memories WHERE user_id = \$1', user_id
        )
        if count == 0:
            print('✓ 无历史测试数据，无需清理')
            return

        # 清理性能测试数据
        deleted = await conn.fetchval('''
            DELETE FROM memories WHERE user_id = \$1 RETURNING COUNT(*)
        ''', user_id)
        print(f'✓ 已清理 {count} 条历史测试数据')
    await pool.close()

asyncio.run(cleanup())
"

# 4.1 生成大规模测试数据
uv run python -c "
import asyncio
import asyncpg
import uuid
import random
from datetime import datetime, timedelta

async def seed():
    pool = await asyncpg.create_pool('postgresql://aigc:@localhost/cognizes-engine')
    user_id = 'perf_test_user'
    app_name = 'perf_test_app'

    async with pool.acquire() as conn:
        count = await conn.fetchval(
            'SELECT COUNT(*) FROM memories WHERE user_id = \$1', user_id
        )
        if count >= 100000:
            print(f'已有 {count} 条数据，跳过')
            return

        print('开始生成 100K 测试数据...')
        batch_size = 1000
        base_time = datetime.now() - timedelta(days=365)

        for batch in range(100):
            rows = []
            for i in range(batch_size):
                created_at = base_time + timedelta(minutes=random.randint(0, 525600))
                rows.append((
                    uuid.uuid4(), user_id, app_name, 'episodic',
                    f'测试记忆 {batch * batch_size + i}',
                    random.random(), random.randint(0, 100), created_at
                ))
            await conn.executemany('''
                INSERT INTO memories (id, user_id, app_name, memory_type, content,
                                     retention_score, access_count, created_at)
                VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8)
            ''', rows)
            if (batch + 1) % 10 == 0:
                print(f'  已插入 {(batch + 1) * batch_size}')
    await pool.close()

asyncio.run(seed())
"

# 4.2 运行性能测试
uv run pytest tests/integration/hippocampus/test_episodic_performance.py -v -s -k "full"
# === 完整性能测试 (100,000 条) ===
# 平均延迟: 1.01 ms
# P99 延迟: 2.38 ms
```

**验收标准**：

- [ ] 10 万规模时间切片查询 P99 < 100ms
- [ ] 查询使用索引扫描 (非全表扫描)

---

### 9.5 Step 5: 模块导入验证

```bash
# 5.1 验证模块可导入
uv run python -c "
from cognizes.engine.hippocampus.consolidation_worker import (
    MemoryConsolidationWorker, JobType, JobStatus
)
from cognizes.engine.hippocampus.retention_manager import MemoryRetentionManager
from cognizes.engine.hippocampus.context_assembler import ContextAssembler
from cognizes.engine.hippocampus.memory_service import OpenMemoryService
from cognizes.engine.hippocampus.memory_visualizer import MemoryVisualizer

print('✅ 所有模块导入成功')
"
```

**验收标准**：

- [ ] 所有 5 个模块可正常导入
- [ ] 无循环依赖错误

---

### 9.6 Step 6: 全量测试验证

```bash
# 6.1 运行所有测试 (包括 Phase 1)
uv run pytest tests/ -v --tb=line

# 6.2 查看测试统计
uv run pytest tests/ -v --tb=line 2>&1 | tail -5
```

**验收标准**：

- [ ] Phase 1 测试: 61 passed
- [ ] Phase 2 单元测试: 35 passed
- [ ] Phase 2 集成测试: 16 passed
- [ ] **总计: 112+ passed**

---

### 9.7 验收总结清单

| 验收项           | 状态 | 说明                          |
| :--------------- | :--: | :---------------------------- |
| Schema 部署      |  ⬜  | 4 张表 + 2 个函数 + HNSW 索引 |
| pg_cron 定时任务 |  ⬜  | 2 个任务 (清理 + 巩固)        |
| 单元测试         |  ⬜  | 35 tests passed               |
| 集成测试         |  ⬜  | 17 tests passed               |
| Read-Your-Writes |  ⬜  | P99 < 100ms                   |
| 模块导入         |  ⬜  | 5 模块无错误                  |
| 全量回归         |  ⬜  | 113+ tests passed             |

> [!TIP]
>
> 完成上述所有验收项后，勾选状态为 ✅，Phase 2: The Hippocampus 验收通过，可进入 Phase 3: The Perception。

---

## References

<a id="ref1"></a>[1] Psychology Today, "Types of Memory," _Psychology Today_, 2024. [Online]. Available: https://www.psychologytoday.com/us/basics/memory/types-of-memory

<a id="ref2"></a>[2] LangChain, "LangGraph Memory Overview," _LangChain Documentation_, 2025. [Online]. Available: https://docs.langchain.com/oss/python/langgraph/memory

<a id="ref3"></a>[3] Google, "ADK Memory Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref4"></a>[4] Google, "ADK Sessions Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/

<a id="ref5"></a>[5] LangChain, "LangGraph Memory Agent," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-agent

<a id="ref6"></a>[6] LangChain, "LangGraph Memory Template," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-template

<a id="ref7"></a>[7] SII-GAIR, "Context Engineering 2.0: The Context of Context Engineering," _SII-GAIR Technical Report_, 2025.

<a id="ref8"></a>[8] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1913.
