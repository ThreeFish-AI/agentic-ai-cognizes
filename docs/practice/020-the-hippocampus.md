---
id: the-hippocampus-implementation
sidebar_position: 1.3
title: Phase 2：The Hippocampus 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-08
  updated_at: 2026-01-08
  version: 1.0
  status: Draft
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

创建 `docs/practice/schema/hippocampus_schema.sql`：

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
    WHERE valid_until IS NULL OR valid_until > NOW();

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
psql -d agent_db -f docs/practice/schema/hippocampus_schema.sql

# 验证表创建
psql -d agent_db -c "\dt"
# 应显示: memories, facts, consolidation_jobs, instructions

# 验证索引
psql -d agent_db -c "\di"

# 验证函数
psql -d agent_db -c "\df calculate_retention_score"
psql -d agent_db -c "\df cleanup_low_value_memories"

# 测试衰减函数
psql -d agent_db -c "SELECT calculate_retention_score(5, NOW() - INTERVAL '3 days');"
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

创建 `docs/practice/engine/hippocampus/consolidation_worker.py`：

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
````

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
        "postgresql://user:pass@localhost/agent_db"
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
````

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

创建 `docs/practice/engine/hippocampus/retention_manager.py`：

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

创建 `docs/practice/engine/hippocampus/context_assembler.py`：

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

创建 `docs/practice/engine/hippocampus/memory_service.py`：

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

---

## 6. 交付物清单

### 6.1 Schema 文件

| 文件路径                                      | 描述                    | 状态      |
| :-------------------------------------------- | :---------------------- | :-------- |
| `docs/practice/schema/hippocampus_schema.sql` | Hippocampus 扩展 Schema | 🔲 待开始 |

### 6.2 代码文件

| 文件路径                                                   | 描述            | 状态      |
| :--------------------------------------------------------- | :-------------- | :-------- |
| `docs/practice/engine/hippocampus/__init__.py`             | 模块初始化      | 🔲 待开始 |
| `docs/practice/engine/hippocampus/consolidation_worker.py` | 记忆巩固 Worker | 🔲 待开始 |
| `docs/practice/engine/hippocampus/retention_manager.py`    | 记忆保持管理器  | 🔲 待开始 |
| `docs/practice/engine/hippocampus/context_assembler.py`    | 上下文组装器    | 🔲 待开始 |
| `docs/practice/engine/hippocampus/memory_service.py`       | ADK 适配器      | 🔲 待开始 |

### 6.3 测试文件

| 文件路径                                                       | 描述                       | 状态      |
| :------------------------------------------------------------- | :------------------------- | :-------- |
| `docs/practice/tests/hippocampus/test_consolidation_worker.py` | Worker 单元测试            | 🔲 待开始 |
| `docs/practice/tests/hippocampus/test_retention_manager.py`    | 保持管理器单元测试         | 🔲 待开始 |
| `docs/practice/tests/hippocampus/test_context_assembler.py`    | 上下文组装器单元测试       | 🔲 待开始 |
| `docs/practice/tests/hippocampus/test_memory_service.py`       | OpenMemoryService 集成测试 | 🔲 待开始 |

### 6.4 目录结构

```
docs/practice/
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
└── tests/
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

## References

<a id="ref1"></a>[1] Psychology Today, "Types of Memory," _Psychology Today_, 2024. [Online]. Available: https://www.psychologytoday.com/us/basics/memory/types-of-memory

<a id="ref2"></a>[2] LangChain, "LangGraph Memory Overview," _LangChain Documentation_, 2025. [Online]. Available: https://docs.langchain.com/oss/python/langgraph/memory

<a id="ref3"></a>[3] Google, "ADK Memory Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/memory/

<a id="ref4"></a>[4] Google, "ADK Sessions Documentation," _Google ADK Docs_, 2025. [Online]. Available: https://google.github.io/adk-docs/sessions/

<a id="ref5"></a>[5] LangChain, "LangGraph Memory Agent," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-agent

<a id="ref6"></a>[6] LangChain, "LangGraph Memory Template," _GitHub Repository_, 2024. [Online]. Available: https://github.com/langchain-ai/memory-template

<a id="ref7"></a>[7] SII-GAIR, "Context Engineering 2.0: The Context of Context Engineering," _SII-GAIR Technical Report_, 2025.

<a id="ref8"></a>[8] H. Ebbinghaus, "Memory: A Contribution to Experimental Psychology," _Teachers College, Columbia University_, 1913.
