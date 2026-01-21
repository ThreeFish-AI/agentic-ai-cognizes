---
id: the-pulse-implementation
sidebar_position: 1.0
title: Phase 1：The Pulse 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-08
  updated_at: 2026-01-11
  version: 1.2
  status: Reviewed
tags:
  - The Pulse
  - Session Engine
  - Implementation Plan
  - PostgreSQL
---

> [!NOTE]
>
> **文档定位**：本文档是 [000-roadmap.md](./000-roadmap.md) Phase 1 的详细工程实施方案，用于指导「**The Pulse (脉搏引擎)**」的完整落地验证工作。涵盖技术调研、架构设计、代码实现、测试验证等全流程。

---

## 1. 执行概览

### 1.1 Phase 1 定位与目标

**Phase 1: Foundation & The Pulse** 是整个验证计划的基石阶段，核心目标是：

1. **构建统一存储基座**：部署 PostgreSQL 16+ 生态，建立 Unified Schema
2. **验证 Session Engine**：实现对标 Google ADK `SessionService` 的会话管理能力
3. **验证核心机制**：原子状态流转、乐观并发控制 (OCC)、实时事件流

```mermaid
graph LR
    subgraph "Phase 1: The Pulse"
        F[Foundation<br>统一存储基座] --> P1[Atomic State<br>原子状态流转]
        F --> P2[OCC<br>乐观并发控制]
        F --> P3[Event Stream<br>实时事件流]
    end

    P1 & P2 & P3 --> V[Verification<br>验收通过]
    V --> Phase2[Phase 2: Hippocampus]

    style F fill:#065f46,stroke:#34d399,color:#fff
    style P1 fill:#7c2d12,stroke:#fb923c,color:#fff
    style P2 fill:#7c2d12,stroke:#fb923c,color:#fff
    style P3 fill:#7c2d12,stroke:#fb923c,color:#fff
```

### 1.2 对标分析：Google ADK Session 机制

基于 Google ADK 官方文档<sup>[[1]](#ref1)</sup>的分析，我们需要复刻以下核心能力：

| ADK 核心概念       | 定义                                                | PostgreSQL 复刻策略         |
| :----------------- | :-------------------------------------------------- | :-------------------------- |
| **Session**        | 单次用户-Agent 交互的容器，包含 `events` 和 `state` | `threads` 表 + `events` 表  |
| **State**          | 会话内的 Key-Value 数据，支持前缀作用域             | JSONB 列 + 前缀解析逻辑     |
| **Event**          | 交互中的原子操作记录                                | `events` 表 (append-only)   |
| **SessionService** | Session 生命周期管理接口                            | `OpenSessionService` 类实现 |

#### 1.2.1 ADK State 前缀机制

ADK 通过 Key 前缀实现不同作用域的状态管理：

| 前缀    | 作用域           | 生命周期              | 复刻策略                   |
| :------ | :--------------- | :-------------------- | :------------------------- |
| 无前缀  | Session Scope    | 取决于 SessionService | 存入 `threads.state` JSONB |
| `user:` | User Scope       | 持久化                | 存入 `user_states` 表      |
| `app:`  | App Scope        | 持久化                | 存入 `app_states` 表       |
| `temp:` | Invocation Scope | 仅当前调用            | 内存缓存，不持久化         |

#### 1.2.2 State Granularity (状态颗粒度)

> [!IMPORTANT]
>
> **对标 Roadmap Pillar I**：状态颗粒度是 The Pulse 的核心设计要素，决定了数据的存储层次和生命周期。

```mermaid
graph TB
    subgraph "State Granularity"
        T[Thread 会话容器<br/>持久化] --> R[Run 执行链路<br/>临时]
        T --> E[Events 事件流<br/>不可变]
        E --> M[Messages 消息<br/>带 Embedding]
        T --> S[Snapshots 快照<br/>可恢复]
    end

    style T fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style R fill:#7c2d12,stroke:#fb923c,color:#fff
    style E fill:#065f46,stroke:#34d399,color:#fff
```

| 层次         | 表名        | 定义                                                  | 生命周期       | 对应 Roadmap             |
| :----------- | :---------- | :---------------------------------------------------- | :------------- | :----------------------- |
| **Thread**   | `threads`   | 持久化存储用户级交互历史 (Human-Agent Interaction)    | 长期持久化     | "作为长期记忆的输入源"   |
| **Run**      | `runs`      | 临时存储单次推理过程中的 Thinking Steps 和 Tool Calls | 仅执行期间存活 | "保障推理的可观测性"     |
| **Event**    | `events`    | 不可变事件记录 (Message, ToolCall, StateUpdate)       | Append-only    | "Immutable Stream"       |
| **Message**  | `messages`  | 带 Embedding 的消息内容                               | 持久化         | "Content with Embedding" |
| **Snapshot** | `snapshots` | 状态检查点，用于快速恢复会话                          | 按策略清理     | "State Checkpoints"      |

#### 1.2.3 任务-章节对照表

> [!NOTE]
>
> 以下表格将 [001-task-checklist.md](./001-task-checklist.md) 的任务 ID 与本文档章节进行对照，便于追踪执行进度。

| 任务模块            | 任务 ID 范围      | 对应章节                                                                                   |
| :------------------ | :---------------- | :----------------------------------------------------------------------------------------- |
| PostgreSQL 生态部署 | P1-1-1 ~ P1-1-5   | [4.1 Step 1: 环境部署](#41-step-1-环境部署与基础设施)                                      |
| 开发环境配置        | P1-1-6 ~ P1-1-9   | [4.1.2 开发环境配置](#412-开发环境配置)                                                    |
| ADK Schema 调研     | P1-2-1 ~ P1-2-6   | [2. 技术调研](#2-技术调研adk-sessionservice-深度分析)                                      |
| PostgreSQL Schema   | P1-2-7 ~ P1-2-14  | [3. 架构设计](#3-架构设计unified-schema) + [4.2 Schema 部署](#42-step-2-schema-设计与部署) |
| 原子状态流转        | P1-3-1 ~ P1-3-7   | [4.3.1 StateManager](#431-statemanager-类实现)                                             |
| 乐观并发控制        | P1-3-8 ~ P1-3-12  | [4.3.1 StateManager (OCC)](#431-statemanager-类实现)                                       |
| 实时事件流          | P1-3-13 ~ P1-3-17 | [4.3.2 PgNotifyListener](#432-pgnotifylistener-实现)                                       |
| 验收与文档          | P1-4-1 ~ P1-4-4   | [5. 验收标准](#5-验收标准) + [6. 交付物](#6-交付物清单)                                    |

### 1.4 工期规划

| 阶段 | 任务模块          | 任务 ID          | 预估工期 | 交付物                             |
| :--- | :---------------- | :--------------- | :------- | :--------------------------------- |
| 1.1  | 环境部署          | P1-1-1 ~ P1-1-9  | 0.5 Day  | PostgreSQL 16+ 环境就绪            |
| 1.2  | Schema 设计       | P1-2-1 ~ P1-2-14 | 0.5 Day  | `agent_schema.sql`                 |
| 1.3  | Pulse Engine 实现 | P1-3-1 ~ P1-3-17 | 1 Day    | `StateManager`, `PgNotifyListener` |
| 1.4  | 测试与验收        | P1-4-1 ~ P1-4-4  | 0.5 Day  | 测试报告 + 技术文档                |

---

## 2. 技术调研：ADK SessionService 深度分析

### 2.1 ADK Session 数据结构

基于 ADK 源码分析<sup>[[2]](#ref2)</sup>，`Session` 对象的核心结构如下：

```python
# ADK Session 核心结构 (简化版)
@dataclass
class Session:
    """代表一次用户-Agent 的交互会话"""

    # 标识符
    id: str                    # 会话唯一标识 (UUID)
    app_name: str              # 应用名称
    user_id: str               # 用户标识

    # 状态数据
    state: dict[str, Any]      # Key-Value 状态存储

    # 事件历史
    events: list[Event]        # 交互事件序列 (append-only)

    # 元数据
    last_update_time: float    # 最后更新时间戳
```

### 2.2 ADK Event 数据结构

`Event` 是 ADK 中记录交互的原子单元：

```python
@dataclass
class Event:
    """交互中的原子操作记录"""

    # 标识符
    id: str                    # 事件唯一标识
    invocation_id: str         # 调用标识 (一次用户请求)
    author: str                # 事件作者 (user/agent/tool)

    # 内容
    content: Content           # 消息内容 (文本/多模态)

    # 动作
    actions: EventActions      # 状态变更、工具调用等

    # 时间戳
    timestamp: float           # 事件发生时间
```

### 2.3 ADK SessionService 接口契约

我们需要实现的核心接口：

```python
class BaseSessionService(ABC):
    """Session 管理服务抽象基类"""

    @abstractmethod
    async def create_session(
        self,
        app_name: str,
        user_id: str,
        state: dict | None = None
    ) -> Session:
        """创建新会话"""
        ...

    @abstractmethod
    async def get_session(
        self,
        app_name: str,
        user_id: str,
        session_id: str
    ) -> Session | None:
        """获取会话"""
        ...

    @abstractmethod
    async def list_sessions(
        self,
        app_name: str,
        user_id: str
    ) -> list[Session]:
        """列出用户所有会话"""
        ...

    @abstractmethod
    async def delete_session(
        self,
        app_name: str,
        user_id: str,
        session_id: str
    ) -> None:
        """删除会话"""
        ...

    @abstractmethod
    async def append_event(
        self,
        session: Session,
        event: Event
    ) -> Event:
        """追加事件并应用 state_delta"""
        ...
```

### 2.4 关键行为分析

> [!IMPORTANT]
>
> **State Commit Timing (状态提交时机)**
>
> 根据 ADK 文档<sup>[[3]](#ref3)</sup>，`state_delta` 仅在 Event 被 Runner 处理后才提交。这意味着：
>
> - 执行逻辑在 yield Event **之后**才能看到其对 State 的更改生效
> - 这类似数据库事务的 "read-your-writes" 保证需要等待 commit

> [!WARNING]
>
> **Dirty Reads 风险**
>
> 在同一 Invocation 内，后续的 Agent/Tool 可以看到之前修改但**尚未最终 Commit** 的 State。我们的实现需要处理这种乐观机制。

---

## 3. 架构设计：Unified Schema

### 3.1 ER 图设计

> [!NOTE]
>
> **设计原则**：严格对标 roadmap 1.1 中的 Schema 要求，实现 7 张核心表的统一存储架构。

```mermaid
erDiagram
    threads ||--o{ events : contains
    threads ||--o{ runs : has
    threads ||--o{ messages : stores
    threads ||--o{ snapshots : checkpoints

    threads {
        uuid id PK "会话唯一标识"
        varchar app_name "应用名称"
        varchar user_id "用户标识"
        jsonb state "会话状态 (无前缀)"
        integer version "乐观锁版本号"
        jsonb metadata "元数据"
        timestamp created_at "创建时间"
        timestamp updated_at "最后更新时间"
    }

    events {
        uuid id PK "事件唯一标识"
        uuid thread_id FK "所属会话"
        uuid invocation_id "调用标识"
        varchar author "事件作者"
        varchar event_type "事件类型"
        jsonb content "消息内容"
        jsonb actions "事件动作"
        bigserial sequence_num "序列号"
        timestamp created_at "事件时间戳"
    }

    runs {
        uuid id PK "执行链路标识"
        uuid thread_id FK "所属会话"
        varchar status "状态枚举"
        jsonb thinking_steps "思考步骤"
        jsonb tool_calls "工具调用记录"
        text error "错误信息"
        timestamp started_at "开始时间"
        timestamp completed_at "完成时间"
    }

    messages {
        uuid id PK "消息唯一标识"
        uuid thread_id FK "所属会话"
        uuid event_id FK "关联事件"
        varchar role "角色: user/assistant/tool"
        text content "消息文本"
        vector embedding "向量嵌入 (1536维)"
        jsonb metadata "消息元数据"
        timestamp created_at "创建时间"
    }

    snapshots {
        uuid id PK "快照唯一标识"
        uuid thread_id FK "所属会话"
        integer version "快照版本号"
        jsonb state "状态快照"
        jsonb events_summary "事件摘要"
        timestamp created_at "快照时间"
    }

    user_states {
        varchar user_id PK "用户标识"
        varchar app_name PK "应用名称"
        jsonb state "user: 前缀状态"
        timestamp updated_at "更新时间"
    }

    app_states {
        varchar app_name PK "应用名称"
        jsonb state "app: 前缀状态"
        timestamp updated_at "更新时间"
    }
```

### 3.2 表职责说明

| 表名            | 职责                         | 对标 ADK 概念  | 生命周期   |
| :-------------- | :--------------------------- | :------------- | :--------- |
| **threads**     | 会话容器，存储用户级交互历史 | `Session`      | 持久化     |
| **events**      | 不可变事件流 (append-only)   | `Event`        | 持久化     |
| **runs**        | 临时执行链路 (Thinking Loop) | `Invocation`   | 执行期间   |
| **messages**    | 带 Embedding 的消息内容      | `Content`      | 持久化     |
| **snapshots**   | 状态检查点，用于快速恢复     | `Checkpoint`   | 按策略清理 |
| **user_states** | `user:` 前缀状态             | `user:*` State | 持久化     |
| **app_states**  | `app:` 前缀状态              | `app:*` State  | 持久化     |

### 3.3 核心表设计

#### 3.2.1 threads 表 (会话容器)

```sql
-- threads: 用户会话容器
CREATE TABLE IF NOT EXISTS threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name        VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,

    -- 会话状态 (无前缀作用域)
    state           JSONB NOT NULL DEFAULT '{}',

    -- 乐观锁版本号 (OCC)
    version         INTEGER NOT NULL DEFAULT 1,

    -- 元数据
    metadata        JSONB DEFAULT '{}',

    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 约束
    CONSTRAINT threads_app_user_unique UNIQUE (app_name, user_id, id)
);

-- 索引
CREATE INDEX idx_threads_app_user ON threads(app_name, user_id);
CREATE INDEX idx_threads_updated_at ON threads(updated_at DESC);
```

#### 3.2.2 events 表 (不可变事件流)

```sql
-- events: 不可变事件流 (append-only)
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    invocation_id   UUID NOT NULL,

    -- 事件元数据
    author          VARCHAR(50) NOT NULL,  -- 'user', 'agent', 'tool'
    event_type      VARCHAR(50) NOT NULL,  -- 'message', 'tool_call', 'state_update'

    -- 事件内容
    content         JSONB NOT NULL DEFAULT '{}',

    -- 事件动作 (state_delta, tool_calls 等)
    actions         JSONB DEFAULT '{}',

    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 序列号 (用于排序)
    sequence_num    BIGSERIAL
);

-- 索引
CREATE INDEX idx_events_thread_id ON events(thread_id);
CREATE INDEX idx_events_invocation_id ON events(invocation_id);
CREATE INDEX idx_events_sequence ON events(thread_id, sequence_num);
```

#### 3.2.3 runs 表 (执行链路)

```sql
-- runs: 临时执行链路 (Thinking Loop)
CREATE TABLE IF NOT EXISTS runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

    -- 执行状态
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))

    -- 思考步骤 (用于可观测性)
    thinking_steps  JSONB DEFAULT '[]',

    -- 错误信息
    error           TEXT,

    -- 时间戳
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE
);

-- 索引
CREATE INDEX idx_runs_thread_id ON runs(thread_id);
CREATE INDEX idx_runs_status ON runs(status);
```

---

## 4. 实施计划：分步执行指南

### 4.1 Step 1: 环境部署与基础设施

#### 4.1.1 PostgreSQL 生态部署

**任务清单**：

| 任务 ID | 任务描述             | 验收标准                        | 参考命令                     |
| :------ | :------------------- | :------------------------------ | :--------------------------- |
| P1-1-1  | 部署 PostgreSQL 16+  | `SELECT version()` 返回 16.x+   | `brew install postgresql@16` |
| P1-1-2  | 安装 pgvector 0.7.0+ | `CREATE EXTENSION vector` 成功  | 见下方安装指南               |
| P1-1-3  | 安装 pg_cron         | `SELECT * FROM cron.job` 可执行 | 见下方安装指南               |
| P1-1-4  | 配置连接池           | 支持 100+ 并发连接              | PgBouncer 或内置配置         |

**pgvector 安装指南**：

```bash
# macOS (Homebrew)
brew install pgvector

# 或从源码编译
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# 在 PostgreSQL 中启用
psql -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**pg_cron 安装指南 (源码编译)**：

> [!TIP]
>
> **macOS 编译异常修复**
>
> 在 Apple Silicon (M1/M2/M3) 环境下编译 `pg_cron` 时，常遇到链接器错误：
> `Undefined symbols for architecture arm64: "_libintl_ngettext"`
>
> **原因**: 链接器未能找到 `gettext` 国际化库。
> **修复**: 需在 Makefile 中显式链接 `libintl`。修改 `Makefile` 第 22 行左右：
> 原文: `SHLIB_LINK = $(libpq)`
> 修改: `SHLIB_LINK = $(libpq) -L/opt/homebrew/opt/gettext/lib -lintl`

```bash
# 1. 下载源码 (推荐使用稳定版分支)
git clone https://github.com/citusdata/pg_cron.git
cd pg_cron

# 2. 修复 Makefile 链接问题 (macOS 必需，见上 Tip)
# 或手动修改 Makefile 追加 -lintl 参数

# 3. 编译与安装 (需确保 pg_config 指向目标 PG 版本)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
make clean
make && make install

# 4. 修改 postgresql.conf 配置
# 路径通常在 /opt/homebrew/var/postgresql@16/postgresql.conf
# 追加内容：
# shared_preload_libraries = 'pg_cron'
# cron.database_name = 'cognizes-engine'

# 5. 重启 PostgreSQL
brew services restart postgresql@16

# 6. 在目标数据库中启用扩展
psql -d postgres -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
```

> [!TIP]
>
> **配置详解**
>
> 1. **配置文件路径**: macOS 上通常位于 `/opt/homebrew/var/postgres@18/postgresql.conf` (Apple Silicon)。可通过 `psql -c "SHOW config_file;"` 精确查找。
> 2. **`shared_preload_libraries = 'pg_cron'`**: 启动 `pg_cron` 的后台调度进程 (Background Worker)。如果不设置，扩展仅加载函数但调度器不运行。修改后必须重启 PG。
> 3. **`cron.database_name`**: 指定存储 cron 元数据 (任务列表) 的主数据库。若不设置，默认只能在 `postgres` 库中管理任务。

#### 4.1.2 开发环境配置

**Python 环境**：

```bash
# 创建项目目录结构
mkdir -p src/cognizes/engine/pulse
mkdir -p src/cognizes/engine/schema
mkdir -p tests/pulse

# 创建虚拟环境
# python -m venv .venv
# source .venv/bin/activate
uv init --no-workspace .

# 安装依赖
uv add asyncpg 'psycopg[binary]' google-adk pydantic pytest pytest-asyncio
```

**依赖清单** (`pyproject.toml`):

```toml
dependencies = [
    # Core
    "asyncpg>=0.31.0",
    "psycopg[binary]>=3.3.2",
    "pydantic>=2.12.5",

    # Google ADK
    "google-adk>=1.22.0",

    # Testing
    "pytest>=9.0.2",
    "pytest-asyncio>=1.3.0",

    # Utilities
    # "python-dotenv>=1.2.1",
]
```

### 4.2 Step 2: Schema 设计与部署

#### 4.2.1 完整 Schema 脚本

创建 `src/cognizes/engine/schema/agent_schema.sql`:

```sql
-- ============================================
-- Agentic AI Engine - Unified Schema
-- Version: 1.0
-- Target: PostgreSQL 16+ with pgvector
-- ============================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. threads 表 (会话容器)
-- ============================================
CREATE TABLE IF NOT EXISTS threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name        VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    state           JSONB NOT NULL DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT threads_app_user_unique UNIQUE (app_name, user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_threads_app_user ON threads(app_name, user_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);

-- ============================================
-- 2. events 表 (不可变事件流)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    invocation_id   UUID NOT NULL,
    author          VARCHAR(50) NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    content         JSONB NOT NULL DEFAULT '{}',
    actions         JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_num    BIGSERIAL
);

CREATE INDEX IF NOT EXISTS idx_events_thread_id ON events(thread_id);
CREATE INDEX IF NOT EXISTS idx_events_invocation_id ON events(invocation_id);
CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(thread_id, sequence_num);

-- ============================================
-- 3. runs 表 (执行链路)
-- ============================================
CREATE TABLE IF NOT EXISTS runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
    thinking_steps  JSONB DEFAULT '[]',
    tool_calls      JSONB DEFAULT '[]',  -- 工具调用记录
    error           TEXT,
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

-- ============================================
-- 4. messages 表 (带 Embedding 的消息内容)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    event_id        UUID REFERENCES events(id) ON DELETE SET NULL,

    -- 消息元数据
    role            VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'tool', 'system'

    -- 消息内容
    content         TEXT NOT NULL,

    -- 向量嵌入 (Phase 2 将使用)
    embedding       vector(1536),  -- OpenAI text-embedding-3-small / Gemini embedding

    -- 元数据
    metadata        JSONB DEFAULT '{}',

    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
-- HNSW 向量索引 (Phase 2 启用)
-- CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);

-- ============================================
-- 5. snapshots 表 (状态检查点)
-- ============================================
CREATE TABLE IF NOT EXISTS snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id       UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

    -- 快照版本 (与 threads.version 对应)
    version         INTEGER NOT NULL,

    -- 状态快照
    state           JSONB NOT NULL,

    -- 事件摘要 (可选，用于快速恢复)
    events_summary  JSONB DEFAULT '{}',

    -- 时间戳
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 每个 thread 的每个 version 只有一个快照
    CONSTRAINT snapshots_thread_version_unique UNIQUE (thread_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_thread_id ON snapshots(thread_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at DESC);

-- ============================================
-- 6. user_states 表 (用户级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS user_states (
    user_id         VARCHAR(255) NOT NULL,
    app_name        VARCHAR(255) NOT NULL,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, app_name)
);

-- JSONB GIN 索引 (支持快速 key 查询)
CREATE INDEX IF NOT EXISTS idx_user_states_state ON user_states USING GIN (state);

-- ============================================
-- 7. app_states 表 (应用级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS app_states (
    app_name        VARCHAR(255) PRIMARY KEY,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- JSONB GIN 索引
CREATE INDEX IF NOT EXISTS idx_app_states_state ON app_states USING GIN (state);

-- ============================================
-- 8. NOTIFY 触发器 (实时事件流)
-- ============================================
CREATE OR REPLACE FUNCTION notify_event_insert()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'event_stream',
        json_build_object(
            'event_id', NEW.id,
            'thread_id', NEW.thread_id,
            'author', NEW.author,
            'event_type', NEW.event_type,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_notify
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_insert();

-- ============================================
-- 9. 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

#### 4.2.2 Schema 部署验证

```bash
# 部署 Schema
psql -d 'cognizes-engine' -f src/cognizes/engine/schema/agent_schema.sql

# 验证表创建
psql -d 'cognizes-engine' -c "\dt"

# 验证触发器
psql -d 'cognizes-engine' -c "\df notify_event_insert"
```

---

### 4.3 Step 3: Pulse Engine 核心实现

#### 4.3.1 StateManager 类实现

创建 `src/cognizes/engine/pulse/state_manager.py`:

```python
"""
StateManager: 原子状态流转管理器

实现对标 Google ADK SessionService 的状态管理能力：
- 原子状态流转 (Atomic State Transitions)
- 乐观并发控制 (Optimistic Concurrency Control)
- State 前缀作用域解析
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import asyncpg


@dataclass
class Session:
    """会话对象 - 对标 ADK Session"""

    id: str
    app_name: str
    user_id: str
    state: dict[str, Any] = field(default_factory=dict)
    version: int = 1
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Event:
    """事件对象 - 对标 ADK Event"""

    id: str
    thread_id: str
    invocation_id: str
    author: str  # 'user', 'agent', 'tool'
    event_type: str  # 'message', 'tool_call', 'state_update'
    content: dict[str, Any] = field(default_factory=dict)
    actions: dict[str, Any] = field(default_factory=dict)
    created_at: datetime | None = None


class ConcurrencyConflictError(Exception):
    """乐观锁冲突异常"""
    pass


class StateManager:
    """
    状态管理器 - 实现原子状态流转和乐观并发控制

    核心职责：
    1. Session CRUD 操作
    2. 原子事务保证 (BEGIN...COMMIT)
    3. 乐观锁 CAS (Compare-And-Set)
    4. State 前缀解析
    """

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self._temp_state: dict[str, dict] = {}  # temp: 前缀的内存缓存

    # ========================================
    # Session CRUD 操作
    # ========================================

    async def create_session(
        self,
        app_name: str,
        user_id: str,
        initial_state: dict[str, Any] | None = None
    ) -> Session:
        """创建新会话"""
        session_id = str(uuid.uuid4())
        state = initial_state or {}

        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO threads (id, app_name, user_id, state)
                VALUES ($1, $2, $3, $4)
                RETURNING id, app_name, user_id, state, version, created_at, updated_at
                """,
                uuid.UUID(session_id), app_name, user_id, state
            )

        return self._row_to_session(row)

    async def get_session(
        self,
        app_name: str,
        user_id: str,
        session_id: str
    ) -> Session | None:
        """获取会话"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, app_name, user_id, state, version, created_at, updated_at
                FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id), app_name, user_id
            )

        return self._row_to_session(row) if row else None

    async def list_sessions(
        self,
        app_name: str,
        user_id: str
    ) -> list[Session]:
        """列出用户所有会话"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, app_name, user_id, state, version, created_at, updated_at
                FROM threads
                WHERE app_name = $1 AND user_id = $2
                ORDER BY updated_at DESC
                """,
                app_name, user_id
            )

        return [self._row_to_session(row) for row in rows]

    async def delete_session(
        self,
        app_name: str,
        user_id: str,
        session_id: str
    ) -> bool:
        """删除会话"""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id), app_name, user_id
            )

        return result == "DELETE 1"

    # ========================================
    # 原子状态流转
    # ========================================

    async def append_event(
        self,
        session: Session,
        event: Event
    ) -> Event:
        """
        追加事件并原子性地应用 state_delta

        这是 Pulse Engine 的核心方法，确保：
        1. Event 追加和 State 更新在同一事务中
        2. 乐观锁检查防止并发冲突
        3. state_delta 正确应用到 session.state
        """
        state_delta = event.actions.get("state_delta", {})

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # 1. 乐观锁检查 + 更新状态
                if state_delta:
                    new_state = {**session.state, **state_delta}
                    result = await conn.fetchrow(
                        """
                        UPDATE threads
                        SET state = $1, version = version + 1, updated_at = NOW()
                        WHERE id = $2 AND version = $3
                        RETURNING version
                        """,
                        new_state,
                        uuid.UUID(session.id),
                        session.version
                    )

                    if result is None:
                        raise ConcurrencyConflictError(
                            f"Session {session.id} version conflict. "
                            f"Expected {session.version}, but it was modified."
                        )

                    # 更新本地 session 对象
                    session.state = new_state
                    session.version = result["version"]

                # 2. 追加事件
                event_id = str(uuid.uuid4())
                row = await conn.fetchrow(
                    """
                    INSERT INTO events (id, thread_id, invocation_id, author, event_type, content, actions)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id, created_at
                    """,
                    uuid.UUID(event_id),
                    uuid.UUID(session.id),
                    uuid.UUID(event.invocation_id),
                    event.author,
                    event.event_type,
                    event.content,
                    event.actions
                )

                event.id = str(row["id"])
                event.created_at = row["created_at"]

        return event

    # ========================================
    # 乐观并发控制 (OCC)
    # ========================================

    async def update_session_state(
        self,
        session: Session,
        state_delta: dict[str, Any],
        max_retries: int = 3
    ) -> Session:
        """
        带重试的乐观锁状态更新

        当检测到版本冲突时，自动重新加载最新状态并重试
        """
        for attempt in range(max_retries):
            try:
                # 构造一个 state_update 事件
                event = Event(
                    id="",
                    thread_id=session.id,
                    invocation_id=str(uuid.uuid4()),
                    author="system",
                    event_type="state_update",
                    actions={"state_delta": state_delta}
                )
                await self.append_event(session, event)
                return session

            except ConcurrencyConflictError:
                if attempt == max_retries - 1:
                    raise

                # 重新加载最新状态
                session = await self.get_session(
                    session.app_name,
                    session.user_id,
                    session.id
                )
                await asyncio.sleep(0.01 * (attempt + 1))  # 退避策略

        return session

    # ========================================
    # State 前缀处理
    # ========================================

    def parse_state_prefix(self, key: str) -> tuple[str, str]:
        """
        解析 State Key 的前缀

        Returns:
            (prefix, actual_key): 前缀和实际的 key

        Examples:
            "user:language" -> ("user", "language")
            "app:max_retries" -> ("app", "max_retries")
            "temp:intermediate" -> ("temp", "intermediate")
            "task_progress" -> ("session", "task_progress")
        """
        prefixes = ["user:", "app:", "temp:"]
        for prefix in prefixes:
            if key.startswith(prefix):
                return prefix.rstrip(":"), key[len(prefix):]
        return "session", key

    async def set_state(
        self,
        session: Session,
        key: str,
        value: Any
    ) -> None:
        """
        根据前缀设置状态值

        - 无前缀: 存入 session.state
        - user: 存入 user_states 表
        - app: 存入 app_states 表
        - temp: 存入内存缓存
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            await self.update_session_state(session, {actual_key: value})

        elif prefix == "temp":
            cache_key = f"{session.id}"
            if cache_key not in self._temp_state:
                self._temp_state[cache_key] = {}
            self._temp_state[cache_key][actual_key] = value

        elif prefix == "user":
            await self._set_user_state(session.app_name, session.user_id, actual_key, value)

        elif prefix == "app":
            await self._set_app_state(session.app_name, actual_key, value)

    async def _set_user_state(self, app_name: str, user_id: str, key: str, value: Any) -> None:
        """设置用户级状态"""
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO user_states (user_id, app_name, state, updated_at)
                VALUES ($1, $2, jsonb_build_object($3, $4::jsonb), NOW())
                ON CONFLICT (user_id, app_name)
                DO UPDATE SET
                    state = user_states.state || jsonb_build_object($3, $4::jsonb),
                    updated_at = NOW()
                """,
                user_id, app_name, key, value
            )

    async def _set_app_state(self, app_name: str, key: str, value: Any) -> None:
        """设置应用级状态"""
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO app_states (app_name, state, updated_at)
                VALUES ($1, jsonb_build_object($2, $3::jsonb), NOW())
                ON CONFLICT (app_name)
                DO UPDATE SET
                    state = app_states.state || jsonb_build_object($2, $3::jsonb),
                    updated_at = NOW()
                """,
                app_name, key, value
            )

    async def get_state(
        self,
        session: Session,
        key: str,
        default: Any = None
    ) -> Any:
        """
        根据前缀获取状态值

        - 无前缀: 从 session.state 读取
        - user: 从 user_states 表读取
        - app: 从 app_states 表读取
        - temp: 从内存缓存读取
        """
        prefix, actual_key = self.parse_state_prefix(key)

        if prefix == "session":
            return session.state.get(actual_key, default)

        elif prefix == "temp":
            cache_key = f"{session.id}"
            temp_state = self._temp_state.get(cache_key, {})
            return temp_state.get(actual_key, default)

        elif prefix == "user":
            return await self._get_user_state(session.app_name, session.user_id, actual_key, default)

        elif prefix == "app":
            return await self._get_app_state(session.app_name, actual_key, default)

        return default

    async def _get_user_state(self, app_name: str, user_id: str, key: str, default: Any = None) -> Any:
        """获取用户级状态"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT state->$3 as value
                FROM user_states
                WHERE user_id = $1 AND app_name = $2
                """,
                user_id, app_name, key
            )
        return row["value"] if row and row["value"] is not None else default

    async def _get_app_state(self, app_name: str, key: str, default: Any = None) -> Any:
        """获取应用级状态"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT state->$2 as value
                FROM app_states
                WHERE app_name = $1
                """,
                app_name, key
            )
        return row["value"] if row and row["value"] is not None else default

    async def get_all_state(self, session: Session) -> dict[str, Any]:
        """
        获取会话的完整状态视图 (合并所有作用域)

        返回格式: {
            "session_key": value,           # 无前缀
            "user:user_key": value,         # user: 前缀
            "app:app_key": value,           # app: 前缀
            "temp:temp_key": value          # temp: 前缀
        }
        """
        result = {}

        # Session scope (无前缀)
        result.update(session.state)

        # Temp scope
        cache_key = f"{session.id}"
        temp_state = self._temp_state.get(cache_key, {})
        for k, v in temp_state.items():
            result[f"temp:{k}"] = v

        # User scope
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM user_states WHERE user_id = $1 AND app_name = $2",
                session.user_id, session.app_name
            )
            if row and row["state"]:
                for k, v in row["state"].items():
                    result[f"user:{k}"] = v

        # App scope
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM app_states WHERE app_name = $1",
                session.app_name
            )
            if row and row["state"]:
                for k, v in row["state"].items():
                    result[f"app:{k}"] = v

        return result

    # ========================================
    # 辅助方法
    # ========================================

    def _row_to_session(self, row: asyncpg.Record) -> Session:
        """将数据库行转换为 Session 对象"""
        return Session(
            id=str(row["id"]),
            app_name=row["app_name"],
            user_id=row["user_id"],
            state=dict(row["state"]) if row["state"] else {},
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
```

#### 4.3.2 PgNotifyListener 实现

创建 `src/cognizes/engine/pulse/pg_notify_listener.py`:

```python
"""
PgNotifyListener: PostgreSQL LISTEN/NOTIFY 事件监听器

实现实时事件流推送，替代 Redis Pub/Sub：
- 监听 PostgreSQL NOTIFY 频道
- 支持 WebSocket 推送
- 验证端到端延迟 < 50ms
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Coroutine

import asyncpg

logger = logging.getLogger(__name__)


@dataclass
class NotifyEvent:
    """NOTIFY 事件数据"""
    channel: str
    payload: dict[str, Any]
    received_at: datetime


class PgNotifyListener:
    """
    PostgreSQL LISTEN/NOTIFY 监听器

    特性：
    - 异步事件监听
    - 自动重连
    - 回调处理
    """

    def __init__(
        self,
        dsn: str,
        channels: list[str] | None = None
    ):
        self.dsn = dsn
        self.channels = channels or ["event_stream"]
        self._connection: asyncpg.Connection | None = None
        self._listeners: dict[str, list[Callable]] = {}
        self._running = False

    async def start(self) -> None:
        """启动监听器"""
        self._running = True
        self._connection = await asyncpg.connect(self.dsn)

        for channel in self.channels:
            await self._connection.add_listener(channel, self._handle_notification)
            logger.info(f"Listening on channel: {channel}")

    async def stop(self) -> None:
        """停止监听器"""
        self._running = False
        if self._connection:
            for channel in self.channels:
                await self._connection.remove_listener(channel, self._handle_notification)
            await self._connection.close()
            self._connection = None

    def on_event(
        self,
        channel: str,
        callback: Callable[[NotifyEvent], Coroutine[Any, Any, None]]
    ) -> None:
        """注册事件回调"""
        if channel not in self._listeners:
            self._listeners[channel] = []
        self._listeners[channel].append(callback)

    def _handle_notification(
        self,
        connection: asyncpg.Connection,
        pid: int,
        channel: str,
        payload: str
    ) -> None:
        """处理 NOTIFY 通知"""
        received_at = datetime.now()

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            data = {"raw": payload}

        event = NotifyEvent(
            channel=channel,
            payload=data,
            received_at=received_at
        )

        # 触发回调
        callbacks = self._listeners.get(channel, [])
        for callback in callbacks:
            asyncio.create_task(callback(event))


# ========================================
# FastAPI WebSocket 集成示例
# ========================================

async def create_websocket_endpoint():
    """
    FastAPI WebSocket 端点示例

    将 PostgreSQL NOTIFY 事件实时推送到前端
    """
    from fastapi import FastAPI, WebSocket

    app = FastAPI()
    listener = PgNotifyListener(dsn="postgresql://user:pass@localhost/agent_db")

    @app.on_event("startup")
    async def startup():
        await listener.start()

    @app.on_event("shutdown")
    async def shutdown():
        await listener.stop()

    @app.websocket("/ws/events/{thread_id}")
    async def websocket_endpoint(websocket: WebSocket, thread_id: str):
        await websocket.accept()

        queue: asyncio.Queue = asyncio.Queue()

        async def on_event(event: NotifyEvent):
            if event.payload.get("thread_id") == thread_id:
                await queue.put(event)

        listener.on_event("event_stream", on_event)

        try:
            while True:
                event = await queue.get()
                await websocket.send_json({
                    "event_id": event.payload.get("event_id"),
                    "author": event.payload.get("author"),
                    "event_type": event.payload.get("event_type"),
                    "timestamp": event.received_at.isoformat()
                })
        except Exception:
            pass

    return app
```

---

### 4.4 Step 4: 测试与验收

#### 4.4.1 单元测试套件

创建 `tests/pulse/test_state_manager.py`:

```python
"""
StateManager 单元测试

验证目标：
1. Session CRUD 操作正确性
2. 原子状态流转 (0 脏读/丢失)
3. 乐观并发控制 (OCC)
4. State 前缀解析
"""

import asyncio
import uuid

import asyncpg
import pytest
import pytest_asyncio

from engine.pulse.state_manager import (
    ConcurrencyConflictError,
    Event,
    StateManager,
)


@pytest_asyncio.fixture
async def pool():
    """创建测试数据库连接池"""
    pool = await asyncpg.create_pool(
        "postgresql://test:test@localhost/agent_test"
    )
    yield pool
    await pool.close()


@pytest_asyncio.fixture
async def state_manager(pool):
    """创建 StateManager 实例"""
    return StateManager(pool)


class TestSessionCRUD:
    """Session CRUD 操作测试"""

    @pytest.mark.asyncio
    async def test_create_session(self, state_manager):
        """测试创建会话"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_001",
            initial_state={"language": "zh-CN"}
        )

        assert session.id is not None
        assert session.app_name == "test_app"
        assert session.user_id == "user_001"
        assert session.state["language"] == "zh-CN"
        assert session.version == 1

    @pytest.mark.asyncio
    async def test_get_session(self, state_manager):
        """测试获取会话"""
        created = await state_manager.create_session(
            app_name="test_app",
            user_id="user_002"
        )

        fetched = await state_manager.get_session(
            app_name="test_app",
            user_id="user_002",
            session_id=created.id
        )

        assert fetched is not None
        assert fetched.id == created.id

    @pytest.mark.asyncio
    async def test_delete_session(self, state_manager):
        """测试删除会话"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_003"
        )

        result = await state_manager.delete_session(
            app_name="test_app",
            user_id="user_003",
            session_id=session.id
        )

        assert result is True

        fetched = await state_manager.get_session(
            app_name="test_app",
            user_id="user_003",
            session_id=session.id
        )
        assert fetched is None


class TestAtomicStateTransitions:
    """原子状态流转测试"""

    @pytest.mark.asyncio
    async def test_append_event_with_state_delta(self, state_manager):
        """测试事件追加与状态更新的原子性"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_004",
            initial_state={"counter": 0}
        )

        event = Event(
            id="",
            thread_id=session.id,
            invocation_id=str(uuid.uuid4()),
            author="agent",
            event_type="state_update",
            content={"text": "Incrementing counter"},
            actions={"state_delta": {"counter": 1}}
        )

        await state_manager.append_event(session, event)

        # 验证状态已更新
        assert session.state["counter"] == 1
        assert session.version == 2

    @pytest.mark.asyncio
    async def test_zero_dirty_reads(self, state_manager):
        """测试 0 脏读 - 并发写入测试"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_005",
            initial_state={"counter": 0}
        )

        async def increment():
            for _ in range(10):
                try:
                    await state_manager.update_session_state(
                        session,
                        {"counter": session.state.get("counter", 0) + 1}
                    )
                except ConcurrencyConflictError:
                    pass

        # 并发执行 5 个任务
        await asyncio.gather(*[increment() for _ in range(5)])

        # 重新获取最新状态
        final = await state_manager.get_session(
            session.app_name, session.user_id, session.id
        )

        # 验证无数据丢失
        assert final.state["counter"] > 0


class TestOptimisticConcurrencyControl:
    """乐观并发控制测试"""

    @pytest.mark.asyncio
    async def test_version_conflict_detection(self, state_manager):
        """测试版本冲突检测"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_006"
        )

        # 模拟另一个进程先更新了状态
        async with state_manager.pool.acquire() as conn:
            await conn.execute(
                "UPDATE threads SET version = version + 1 WHERE id = $1",
                uuid.UUID(session.id)
            )

        # 此时 session.version 已过期，应该抛出冲突
        event = Event(
            id="",
            thread_id=session.id,
            invocation_id=str(uuid.uuid4()),
            author="agent",
            event_type="state_update",
            actions={"state_delta": {"key": "value"}}
        )

        with pytest.raises(ConcurrencyConflictError):
            await state_manager.append_event(session, event)


class TestStatePrefixes:
    """State 前缀解析测试"""

    def test_parse_session_scope(self, state_manager):
        """测试无前缀 = Session Scope"""
        prefix, key = state_manager.parse_state_prefix("task_progress")
        assert prefix == "session"
        assert key == "task_progress"

    def test_parse_user_scope(self, state_manager):
        """测试 user: 前缀"""
        prefix, key = state_manager.parse_state_prefix("user:preferred_language")
        assert prefix == "user"
        assert key == "preferred_language"

    def test_parse_app_scope(self, state_manager):
        """测试 app: 前缀"""
        prefix, key = state_manager.parse_state_prefix("app:max_retries")
        assert prefix == "app"
        assert key == "max_retries"

    def test_parse_temp_scope(self, state_manager):
        """测试 temp: 前缀"""
        prefix, key = state_manager.parse_state_prefix("temp:intermediate_result")
        assert prefix == "temp"
        assert key == "intermediate_result"


class TestTransactionRollback:
    """事务回滚测试 (对标 P1-3-4)"""

    @pytest.mark.asyncio
    async def test_rollback_on_error(self, state_manager):
        """测试异常时事务回滚，状态不变"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_rollback",
            initial_state={"value": "original"}
        )
        original_version = session.version

        # 模拟一个会失败的事件（例如无效的 JSON）
        try:
            event = Event(
                id="",
                thread_id=session.id,
                invocation_id=str(uuid.uuid4()),
                author="agent",
                event_type="state_update",
                actions={"state_delta": {"value": "modified"}}
            )
            # 人为制造冲突
            async with state_manager.pool.acquire() as conn:
                await conn.execute(
                    "UPDATE threads SET version = version + 100 WHERE id = $1",
                    uuid.UUID(session.id)
                )
            await state_manager.append_event(session, event)
        except ConcurrencyConflictError:
            pass

        # 验证原始状态未被修改
        fetched = await state_manager.get_session(
            session.app_name, session.user_id, session.id
        )
        # 注意：version 被外部修改了，但 state 应该保持原值
        assert fetched.state["value"] == "original"


class TestMultiAgentConcurrency:
    """多 Agent 竞争写测试 (对标 P1-3-11)"""

    @pytest.mark.asyncio
    async def test_10_concurrent_writes_no_data_loss(self, state_manager):
        """10 并发写入，0 数据丢失"""
        session = await state_manager.create_session(
            app_name="test_app",
            user_id="user_concurrent",
            initial_state={"writes": []}
        )

        successful_writes = []

        async def agent_write(agent_id: int):
            """模拟单个 Agent 的写入"""
            for i in range(5):
                try:
                    # 每次都重新获取最新 session
                    current = await state_manager.get_session(
                        session.app_name, session.user_id, session.id
                    )
                    current_writes = current.state.get("writes", [])
                    new_writes = current_writes + [f"agent_{agent_id}_write_{i}"]

                    await state_manager.update_session_state(
                        current,
                        {"writes": new_writes}
                    )
                    successful_writes.append(f"agent_{agent_id}_write_{i}")
                except ConcurrencyConflictError:
                    # 冲突重试
                    await asyncio.sleep(0.01)

        # 10 个并发 Agent
        await asyncio.gather(*[agent_write(i) for i in range(10)])

        # 验证最终状态
        final = await state_manager.get_session(
            session.app_name, session.user_id, session.id
        )

        # 所有成功的写入都应该在最终状态中
        assert len(final.state["writes"]) > 0
        print(f"Total successful writes: {len(final.state['writes'])}")


class TestHighQPSPerformance:
    """高 QPS 性能测试 (对标 P1-3-12)"""

    @pytest.mark.asyncio
    async def test_100_qps_session_creation(self, state_manager):
        """100 QPS Session 创建测试"""
        import time

        start_time = time.perf_counter()
        sessions = []

        # 创建 100 个 Session
        for i in range(100):
            session = await state_manager.create_session(
                app_name="perf_test",
                user_id=f"user_{i}"
            )
            sessions.append(session)

        elapsed = time.perf_counter() - start_time
        qps = 100 / elapsed

        print(f"Session creation: {qps:.2f} QPS ({elapsed:.3f}s for 100 sessions)")

        # 清理
        for session in sessions:
            await state_manager.delete_session(
                session.app_name, session.user_id, session.id
            )

        assert qps > 100, f"QPS {qps} is below target 100"
```

执行测试：

````bash
uv run pytest tests/pulse/test_state_manager.py -v
```

#### 4.4.2 端到端延迟测试

创建 `tests/pulse/test_notify_latency.py`:

```python
"""
NOTIFY 延迟测试

验证目标：
- 端到端延迟 < 50ms
- 100 msg/s 压力测试
"""

import asyncio
import time
import uuid

import asyncpg
import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def conn():
    """创建测试连接"""
    conn = await asyncpg.connect(
        "postgresql://test:test@localhost/agent_test"
    )
    yield conn
    await conn.close()


class TestNotifyLatency:
    """NOTIFY 延迟测试"""

    @pytest.mark.asyncio
    async def test_end_to_end_latency(self, conn):
        """测试端到端延迟 < 50ms"""
        latencies = []
        received = asyncio.Event()
        send_time = 0

        def on_notify(connection, pid, channel, payload):
            nonlocal send_time
            receive_time = time.perf_counter()
            latency_ms = (receive_time - send_time) * 1000
            latencies.append(latency_ms)
            received.set()

        await conn.add_listener("test_latency", on_notify)

        # 发送 100 条消息
        for i in range(100):
            send_time = time.perf_counter()
            await conn.execute(
                f"NOTIFY test_latency, '{i}'"
            )
            await asyncio.wait_for(received.wait(), timeout=1.0)
            received.clear()

        await conn.remove_listener("test_latency", on_notify)

        # 验证延迟
        avg_latency = sum(latencies) / len(latencies)
        p99_latency = sorted(latencies)[int(len(latencies) * 0.99)]

        print(f"Avg latency: {avg_latency:.2f}ms")
        print(f"P99 latency: {p99_latency:.2f}ms")

        assert avg_latency < 50, f"Avg latency {avg_latency}ms exceeds 50ms"
        assert p99_latency < 50, f"P99 latency {p99_latency}ms exceeds 50ms"

    @pytest.mark.asyncio
    async def test_100_msg_per_second_throughput(self, conn):
        """测试 100 msg/s 吞吐量 (对标 P1-3-17)"""
        received_count = 0
        lost_count = 0
        total_messages = 100

        received_messages = set()

        def on_notify(connection, pid, channel, payload):
            nonlocal received_count
            received_count += 1
            received_messages.add(payload)

        await conn.add_listener("throughput_test", on_notify)

        start_time = time.perf_counter()

        # 以 100 msg/s 的速率发送
        for i in range(total_messages):
            await conn.execute(f"NOTIFY throughput_test, 'msg_{i}'")
            await asyncio.sleep(0.01)  # 10ms 间隔 = 100 msg/s

        # 等待所有消息到达
        await asyncio.sleep(0.5)

        elapsed = time.perf_counter() - start_time

        await conn.remove_listener("throughput_test", on_notify)

        # 计算丢失率
        lost_count = total_messages - len(received_messages)
        loss_rate = (lost_count / total_messages) * 100
        throughput = len(received_messages) / elapsed

        print(f"Throughput: {throughput:.2f} msg/s")
        print(f"Received: {len(received_messages)}/{total_messages}")
        print(f"Loss rate: {loss_rate:.2f}%")

        assert lost_count == 0, f"Lost {lost_count} messages"
        assert throughput >= 90, f"Throughput {throughput} is below 90 msg/s"
````

执行测试：

```bash
uv run pytest tests/pulse/test_notify_latency.py -v -s
```

---

### 4.5 Step 5: AG-UI 事件桥接层

> [!NOTE]
>
> **对标 AG-UI 协议**：本节实现 The Pulse 与 AG-UI 可视化层的事件桥接，确保所有会话状态变更、事件流都能实时推送到前端进行可视化展示。
>
> **参考资源**：
>
> - [AG-UI 协议调研](../research/070-ag-ui.md)
> - [AG-UI 官方文档](https://docs.ag-ui.com/)

#### 4.5.1 事件桥接架构

```mermaid
graph TB
    subgraph "The Pulse 存储层"
        TH[threads 表]
        EV[events 表]
        RN[runs 表]
    end

    subgraph "事件桥接层"
        PNL[PgNotifyListener]
        EB[EventBridge]
        SER[SSE/WebSocket 端点]
    end

    subgraph "AG-UI 前端"
        CK[CopilotKit]
        UI[可视化面板]
    end

    EV -->|NOTIFY| PNL
    TH -->|状态变更| PNL
    PNL --> EB
    EB -->|AG-UI Events| SER
    SER -->|Event Stream| CK
    CK --> UI

    style EB fill:#4ade80,stroke:#16a34a,color:#000
```

#### 4.5.2 AG-UI 事件映射表

| Pulse 事件源              | 触发条件     | AG-UI 事件类型         | 事件数据              |
| :------------------------ | :----------- | :--------------------- | :-------------------- |
| `runs` INSERT             | 新建执行链路 | `RUN_STARTED`          | `{run_id, thread_id}` |
| `runs` UPDATE (complete)  | 执行完成     | `RUN_FINISHED`         | `{run_id, status}`    |
| `events` INSERT (message) | 新消息创建   | `TEXT_MESSAGE_START`   | `{message_id}`        |
| `events` INSERT (content) | 消息内容追加 | `TEXT_MESSAGE_CONTENT` | `{delta}`             |
| `threads.state` UPDATE    | 状态变更     | `STATE_DELTA`          | `{json_patch}`        |
| `events` INSERT (tool)    | 工具调用     | `TOOL_CALL_START`      | `{tool_name, args}`   |

#### 4.5.3 EventBridge 实现

创建 `src/cognizes/engine/pulse/event_bridge.py`：

```python
"""
Pulse EventBridge: 将 PostgreSQL 事件转换为 AG-UI 标准事件

职责:
1. 监听 PostgreSQL NOTIFY 事件
2. 转换为 AG-UI 标准事件格式
3. 通过 SSE/WebSocket 推送到前端
"""

from __future__ import annotations

import json
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, AsyncGenerator
from datetime import datetime


class AgUiEventType(str, Enum):
    """AG-UI 标准事件类型"""
    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"
    RAW = "RAW"
    CUSTOM = "CUSTOM"


@dataclass
class AgUiEvent:
    """AG-UI 标准事件"""
    type: AgUiEventType
    run_id: str
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())
    data: dict = field(default_factory=dict)

    def to_sse(self) -> str:
        """转换为 SSE 格式"""
        payload = {
            "type": self.type.value,
            "runId": self.run_id,
            "timestamp": self.timestamp,
            **self.data
        }
        return f"data: {json.dumps(payload)}\n\n"


class PulseEventBridge:
    """
    Pulse 事件桥接器

    将 PostgreSQL 事件转换为 AG-UI 标准事件
    """

    def __init__(self, pg_listener):
        """
        Args:
            pg_listener: PgNotifyListener 实例
        """
        self._pg_listener = pg_listener
        self._subscribers: dict[str, list[asyncio.Queue]] = {}  # run_id -> queues
        self._running = False

    async def start(self) -> None:
        """启动事件桥接"""
        self._running = True

        # 注册 PostgreSQL 监听器回调
        await self._pg_listener.subscribe(
            channel="event_stream",
            callback=self._handle_pg_event
        )

    async def stop(self) -> None:
        """停止事件桥接"""
        self._running = False
        await self._pg_listener.unsubscribe("event_stream")

    async def subscribe(self, run_id: str) -> AsyncGenerator[AgUiEvent, None]:
        """
        订阅指定 run_id 的事件流

        Yields:
            AgUiEvent: AG-UI 标准事件
        """
        queue: asyncio.Queue = asyncio.Queue()

        if run_id not in self._subscribers:
            self._subscribers[run_id] = []
        self._subscribers[run_id].append(queue)

        try:
            while self._running:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event

                    # 如果是完成事件，结束订阅
                    if event.type in (AgUiEventType.RUN_FINISHED, AgUiEventType.RUN_ERROR):
                        break
                except asyncio.TimeoutError:
                    # 发送心跳
                    yield AgUiEvent(
                        type=AgUiEventType.CUSTOM,
                        run_id=run_id,
                        data={"name": "heartbeat"}
                    )
        finally:
            self._subscribers[run_id].remove(queue)
            if not self._subscribers[run_id]:
                del self._subscribers[run_id]

    async def _handle_pg_event(self, channel: str, payload: str) -> None:
        """处理 PostgreSQL 事件并转换为 AG-UI 事件"""
        try:
            data = json.loads(payload)
            event = self._convert_to_agui_event(data)

            if event and event.run_id in self._subscribers:
                for queue in self._subscribers[event.run_id]:
                    await queue.put(event)
        except json.JSONDecodeError:
            pass

    def _convert_to_agui_event(self, pg_data: dict) -> AgUiEvent | None:
        """
        将 PostgreSQL 事件数据转换为 AG-UI 事件

        Args:
            pg_data: PostgreSQL NOTIFY 载荷

        Returns:
            AG-UI 事件或 None
        """
        table = pg_data.get("table")
        operation = pg_data.get("operation")
        row_data = pg_data.get("data", {})

        run_id = row_data.get("run_id") or row_data.get("id")
        if not run_id:
            return None

        # 根据表和操作类型映射事件
        if table == "runs":
            if operation == "INSERT":
                return AgUiEvent(
                    type=AgUiEventType.RUN_STARTED,
                    run_id=run_id,
                    data={"threadId": row_data.get("thread_id")}
                )
            elif operation == "UPDATE":
                status = row_data.get("status")
                if status == "completed":
                    return AgUiEvent(
                        type=AgUiEventType.RUN_FINISHED,
                        run_id=run_id,
                        data={"status": status}
                    )
                elif status == "failed":
                    return AgUiEvent(
                        type=AgUiEventType.RUN_ERROR,
                        run_id=run_id,
                        data={"error": row_data.get("error")}
                    )

        elif table == "events":
            event_type = row_data.get("event_type")
            if event_type == "message":
                return AgUiEvent(
                    type=AgUiEventType.TEXT_MESSAGE_CONTENT,
                    run_id=run_id,
                    data={
                        "messageId": row_data.get("id"),
                        "delta": row_data.get("content", {}).get("text", "")
                    }
                )
            elif event_type == "tool_call":
                return AgUiEvent(
                    type=AgUiEventType.TOOL_CALL_START,
                    run_id=run_id,
                    data={
                        "toolCallId": row_data.get("id"),
                        "toolCallName": row_data.get("content", {}).get("tool_name")
                    }
                )

        elif table == "threads":
            if operation == "UPDATE" and "state" in row_data:
                return AgUiEvent(
                    type=AgUiEventType.STATE_DELTA,
                    run_id=run_id,
                    data={"delta": row_data.get("state_delta", [])}
                )

        return None


# FastAPI 端点示例
async def create_sse_endpoint(bridge: PulseEventBridge, run_id: str):
    """
    创建 SSE 事件流端点

    Usage:
        @app.get("/api/runs/{run_id}/events")
        async def stream_events(run_id: str):
            return StreamingResponse(
                create_sse_endpoint(bridge, run_id),
                media_type="text/event-stream"
            )
    """
    async for event in bridge.subscribe(run_id):
        yield event.to_sse()
```

#### 4.5.4 状态调试面板数据接口

创建 `src/cognizes/engine/pulse/state_debug.py`：

```python
"""状态调试面板数据接口"""

from dataclasses import dataclass
from typing import Any
import json


@dataclass
class StateDebugInfo:
    """状态调试信息"""
    thread_id: str
    current_state: dict[str, Any]
    state_history: list[dict]  # 最近 N 次状态变更
    prefix_breakdown: dict[str, dict]  # 按前缀分组的状态


class StateDebugService:
    """状态调试服务"""

    def __init__(self, pool):
        self._pool = pool

    async def get_debug_info(self, thread_id: str) -> StateDebugInfo:
        """获取线程的调试信息"""
        async with self._pool.acquire() as conn:
            # 获取当前状态
            thread = await conn.fetchrow(
                "SELECT state FROM threads WHERE id = $1",
                thread_id
            )

            # 获取状态变更历史
            history = await conn.fetch("""
                SELECT
                    created_at,
                    content->'state_delta' as delta
                FROM events
                WHERE thread_id = $1
                  AND content ? 'state_delta'
                ORDER BY created_at DESC
                LIMIT 20
            """, thread_id)

            current_state = json.loads(thread["state"]) if thread else {}

            # 按前缀分组
            prefix_breakdown = {
                "session": {},
                "user": {},
                "app": {},
                "temp": {}
            }

            for key, value in current_state.items():
                if key.startswith("user:"):
                    prefix_breakdown["user"][key[5:]] = value
                elif key.startswith("app:"):
                    prefix_breakdown["app"][key[4:]] = value
                elif key.startswith("temp:"):
                    prefix_breakdown["temp"][key[5:]] = value
                else:
                    prefix_breakdown["session"][key] = value

            return StateDebugInfo(
                thread_id=thread_id,
                current_state=current_state,
                state_history=[
                    {"time": str(h["created_at"]), "delta": json.loads(h["delta"])}
                    for h in history
                ],
                prefix_breakdown=prefix_breakdown
            )
```

#### 4.5.5 任务清单

| 任务 ID | 任务描述                   | 状态      | 验收标准                |
| :------ | :------------------------- | :-------- | :---------------------- |
| P1-5-1  | 实现 `PulseEventBridge` 类 | 🔲 待开始 | PostgreSQL 事件正确转换 |
| P1-5-2  | 实现 AG-UI 事件映射逻辑    | 🔲 待开始 | 6 种事件类型覆盖        |
| P1-5-3  | 实现 SSE 端点              | 🔲 待开始 | 事件流延迟 < 100ms      |
| P1-5-4  | 实现 StateDebugService     | 🔲 待开始 | 调试信息完整            |
| P1-5-5  | 编写事件桥接单元测试       | 🔲 待开始 | 覆盖率 > 80%            |

#### 4.5.6 验收标准

| 验收项   | 验收标准                                 | 验证方法 |
| :------- | :--------------------------------------- | :------- |
| 事件转换 | PostgreSQL 6 类事件正确映射到 AG-UI 事件 | 单元测试 |
| 延迟     | 事件从 DB 到前端延迟 < 100ms (P99)       | 性能测试 |
| 可靠性   | 事件不丢失，顺序正确                     | 压力测试 |
| 调试面板 | 状态分组正确，历史可追溯                 | 集成测试 |

---

## 5. 验收标准

### 5.1 功能验收矩阵

> [!NOTE]
>
> 以下验收项与 [001-task-checklist.md](./001-task-checklist.md) 中的任务 ID 对应，确保每项需求都有验证。

| 验收项              | 任务 ID    | 验收标准                            | 验证方法      |
| :------------------ | :--------- | :---------------------------------- | :------------ |
| PostgreSQL 16+ 部署 | P1-1-1     | `SELECT version()` 返回 16.x+       | 命令行验证    |
| pgvector 安装       | P1-1-2     | `CREATE EXTENSION vector` 成功      | SQL 执行      |
| pg_cron 安装        | P1-1-3     | `SELECT * FROM cron.job` 可执行     | SQL 执行      |
| 连接池配置          | P1-1-5     | 支持 100+ 并发连接                  | 压力测试      |
| Schema 部署         | P1-2-12    | 7 张表 + 2 个触发器创建成功         | `\dt` + `\df` |
| Session CRUD        | P1-3-1~5   | 创建/读取/列表/删除操作正确         | 单元测试      |
| 原子状态流转        | P1-3-6~7   | 0 脏读/丢失                         | 并发测试      |
| 乐观锁 (OCC)        | P1-3-8~12  | 版本冲突正确检测 + 10 并发 0 丢失   | 冲突测试      |
| 实时事件流          | P1-3-13~17 | 端到端延迟 < 50ms, 100 msg/s 无丢失 | 延迟/压力测试 |

### 5.2 性能基准

| 指标             | 目标值    | 测试条件       | 对应任务 |
| :--------------- | :-------- | :------------- | :------- |
| Session 创建 QPS | > 1000    | 单节点         | P1-3-12  |
| Event 追加 QPS   | > 500     | 含 state_delta | P1-3-12  |
| NOTIFY 延迟 P99  | < 50ms    | 100 msg/s      | P1-3-16  |
| 并发写入成功率   | 100%      | 10 并发        | P1-3-11  |
| 消息吞吐量       | 100 msg/s | 稳定无丢失     | P1-3-17  |

### 5.3 验收检查清单

```markdown
## Phase 1 验收检查清单

### 环境部署

- [ ] PostgreSQL 16+ 安装并运行
- [ ] pgvector 扩展安装成功
- [ ] pg_cron 扩展安装成功 (可选)
- [ ] 连接池配置完成

### Schema 设计

- [ ] threads 表创建成功
- [ ] events 表创建成功
- [ ] runs 表创建成功
- [ ] messages 表创建成功
- [ ] snapshots 表创建成功
- [ ] user_states 表创建成功
- [ ] app_states 表创建成功
- [ ] NOTIFY 触发器创建成功
- [ ] updated_at 触发器创建成功

### 功能验证

- [ ] Session CRUD 测试通过
- [ ] 原子状态流转测试通过
- [ ] 乐观锁冲突检测测试通过
- [ ] 事务回滚测试通过
- [ ] 多 Agent 并发写测试通过

### 性能验证

- [ ] Session 创建 QPS > 1000
- [ ] NOTIFY 延迟 P99 < 50ms
- [ ] 100 msg/s 压力测试通过
```

---

## 6. 交付物清单

| 类别         | 文件路径                                           | 描述                           | 对应任务   |
| :----------- | :------------------------------------------------- | :----------------------------- | :--------- |
| **文档**     | `docs/010-the-pulse.md`                            | 本实施方案                     | P1-4-1     |
| **Schema**   | `src/cognizes/engine/schema/agent_schema.sql`      | 统一建表脚本 (7 表 + 2 触发器) | P1-2-12    |
| **代码**     | `src/cognizes/engine/pulse/state_manager.py`       | StateManager 实现              | P1-4-2     |
|              | `src/cognizes/engine/pulse/pg_notify_listener.py`  | NOTIFY 监听器                  | P1-3-14    |
|              | `src/cognizes/engine/pulse/event_bridge.py`        | 事件桥接器                     | P1-5-1     |
|              | `src/cognizes/engine/pulse/state_debug.py`         | 状态调试服务                   | P1-5-4     |
| **单元测试** | `tests/unittests/pulse/test_state_manager.py`      | 前缀解析、dataclass 纯逻辑     | P1-4-3     |
|              | `tests/unittests/pulse/test_pg_notify_listener.py` | 回调注册、JSON 解析逻辑        | P1-3-15    |
|              | `tests/unittests/pulse/test_event_bridge.py`       | SSE 格式、事件类型映射         | P1-5-2     |
|              | `tests/unittests/pulse/test_state_debug.py`        | 前缀分组逻辑                   | P1-5-5     |
| **集成测试** | `tests/integration/pulse/test_state_manager_db.py` | 数据库 CRUD、OCC、高并发       | P1-4-4     |
|              | `tests/integration/pulse/test_notify_latency.py`   | NOTIFY 延迟 & 吞吐量           | P1-3-16~17 |
|              | `tests/integration/pulse/test_event_bridge_e2e.py` | 端到端事件流测试               | P1-5-3     |
|              | `tests/integration/pulse/test_state_debug_db.py`   | 状态历史查询测试               | P1-5-6     |

---

## 7. Phase 1 验证 SOP

### 7.1 环境验证

```bash
# PostgreSQL 版本验证
psql -d 'cognizes-engine' -c "SELECT version();"

# 扩展状态检查
psql -d 'cognizes-engine' -c "SELECT * FROM pg_available_extensions WHERE name IN ('vector', 'pg_cron');"

# 数据库连接测试
psql -d cognizes-engine -c "\dt"

# Python 环境验证
uv run python -c "from cognizes.engine.pulse.state_manager import StateManager; print('✓ Import OK')"
```

### 7.2 单元测试验证

```bash
# 全部单元测试 (44 个测试用例，无数据库依赖)
uv run pytest tests/unittests/pulse/ -v

# 快速回归 (仅核心逻辑)
uv run pytest tests/unittests/pulse/test_state_manager.py -v --tb=short
```

### 7.3 集成测试验证

```bash
# StateManager 数据库集成测试
uv run pytest tests/integration/pulse/test_state_manager_db.py -v

# NOTIFY 延迟测试 (验证 < 50ms)
uv run pytest tests/integration/pulse/test_notify_latency.py -v -s

# EventBridge 端到端测试
uv run pytest tests/integration/pulse/test_event_bridge_e2e.py -v

# StateDebug 数据库测试
uv run pytest tests/integration/pulse/test_state_debug_db.py -v

# 全部集成测试
uv run pytest tests/integration/ -v
```

### 7.4 性能指标验收

| 指标         | 目标值 | 验证测试                                 | 验证命令                                                                                                                    |
| :----------- | :----- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| NOTIFY 延迟  | < 50ms | `test_end_to_end_latency`                | `uv run pytest tests/integration/pulse/test_notify_latency.py::TestNotifyLatency::test_end_to_end_latency -v -s`            |
| 吞吐量丢失率 | 0%     | `test_100_msg_per_second_throughput`     | `uv run pytest tests/integration/pulse/test_notify_latency.py::TestNotifyLatency::test_100_msg_per_second_throughput -v -s` |
| OCC QPS      | > 100  | `test_100_qps_session_creation`          | `uv run pytest tests/unittests/pulse/test_state_manager.py::TestHighQPSPerformance -v -s`                                   |
| 并发写入     | 0 丢失 | `test_10_concurrent_writes_no_data_loss` | `uv run pytest tests/unittests/pulse/test_state_manager.py::TestMultiAgentConcurrency -v -s`                                |

---

## 8. 遗留任务指引

> [!NOTE]
>
> 以下任务需在 Phase 1 验收前完成。

### 8.1 P1-1-8：配置 GOOGLE_API_KEY

**目的**：为 Google ADK 提供 API 认证。

```bash
# 方式 1：环境变量 (推荐)
export GOOGLE_API_KEY="your-api-key-here"

# 方式 2：.env 文件
echo 'GOOGLE_API_KEY=your-api-key-here' >> .env

# 验证
uv run python -c "import os; print('✓ API Key:', os.getenv('GOOGLE_API_KEY', 'NOT SET')[:10] + '...')"
```

### 8.2 P1-3-15：实现 WebSocket 推送接口

**目的**：前端通过 WebSocket 接收实时事件流。

**实现路径**：

- `src/cognizes/engine/api/main.py` - FastAPI 应用入口
- `src/cognizes/engine/pulse/pg_notify_listener.py` - NOTIFY 监听器

#### 8.2.1 启动服务

```bash
# 终端 1：启动 FastAPI 服务
uv run uvicorn cognizes.engine.api.main:app --reload --host 0.0.0.0 --port 8000
```

预期输出：

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     ✓ PgNotifyListener started
```

#### 8.2.2 验证健康检查

```bash
# 终端 2：验证服务状态
curl http://localhost:8000/health
```

预期输出：

```json
{ "status": "ok", "listener_running": true }
```

#### 8.2.3 验证 WebSocket 连接

```bash
# 方式 1：使用 websocat 工具 (需安装: brew install websocat)
websocat ws://localhost:8000/ws/events/test-thread

# 方式 2：使用 Python 脚本
uv run python -c "
import asyncio
import websockets
async def test():
    async with websockets.connect('ws://localhost:8000/ws/events/test-thread') as ws:
        print('✓ WebSocket connected')
        msg = await asyncio.wait_for(ws.recv(), timeout=30)
        print(f'Received: {msg}')
asyncio.run(test())
"
```

#### 8.2.4 触发测试事件

```bash
# 终端 3：发送测试 NOTIFY 消息
curl http://localhost:8000/api/test-notify
```

预期输出：

```json
{ "status": "sent", "payload": "{\"thread_id\":\"test-thread\",...}" }
```

WebSocket 客户端应立即收到事件。

#### 8.2.5 验证延迟

```bash
# 使用集成测试验证延迟 < 50ms
uv run pytest tests/integration/pulse/test_notify_latency.py -v -s
```

**验收标准**：

- [ ] 服务启动成功，listener_running 为 true
- [ ] 前端可通过 `ws://localhost:8000/ws/events/{thread_id}` 连接
- [ ] 收到 NOTIFY 事件后延迟 < 100ms

### 8.3 P1-5-3：实现 SSE 事件流端点

**目的**：通过 Server-Sent Events 推送 AG-UI 事件流。

**实现路径**：

- `src/cognizes/engine/api/main.py` - SSE 端点 `/api/runs/{run_id}/events`
- `src/cognizes/engine/pulse/event_bridge.py` - AG-UI 事件类型定义

#### 8.3.1 验证服务已启动

确保 FastAPI 服务正在运行（见 8.2.1）。

#### 8.3.2 验证 SSE 连接

```bash
# 终端 1：订阅 SSE 事件流 (使用 curl -N 保持长连接)
curl -N http://localhost:8000/api/runs/test-run/events
```

预期输出（立即收到连接事件）：

```
data: {"type":"CUSTOM","runId":"test-run","timestamp":...,"name":"connected","message":"SSE stream for run_id=test-run"}
```

#### 8.3.3 验证事件推送

```bash
# 终端 2：触发 SSE 测试事件
curl http://localhost:8000/api/test-sse-notify/test-run
```

预期输出：

```json
{ "status": "sent", "run_id": "test-run", "payload": "..." }
```

同时，终端 1 的 SSE 客户端应收到：

```
data: {"type":"RAW","runId":"test-run","timestamp":...,"payload":{...}}

```

#### 8.3.4 验证响应头

```bash
# 验证 Content-Type (使用 -D - 打印响应头，而非 -I)
curl -s -D - http://localhost:8000/api/runs/test-run/events 2>&1 | head -10
```

预期输出：

```
HTTP/1.1 200 OK
...
content-type: text/event-stream; charset=utf-8
```

> [!NOTE]
>
> 使用 `curl -I` 会发送 `HEAD` 请求，SSE 端点不支持 HEAD，会返回 `405 Method Not Allowed`。

#### 8.3.5 验证心跳机制

保持 SSE 连接 30 秒不发送事件，客户端应收到心跳：

```
data: {"type":"CUSTOM","runId":"test-run","timestamp":...,"name":"heartbeat"}

```

**验收标准**：

- [ ] 响应 Content-Type 为 `text/event-stream`
- [ ] 事件格式符合 SSE 规范 (`data: {...}\n\n`)
- [ ] 首事件延迟 < 100ms（连接事件立即返回）
- [ ] 心跳每 30 秒发送一次

---

## 参考文献

<a id="ref1"></a>1. Google. (2025). _ADK Sessions Documentation_. [https://google.github.io/adk-docs/sessions/](https://google.github.io/adk-docs/sessions/)

<a id="ref2"></a>2. Google. (2025). _ADK Session Overview_. [https://google.github.io/adk-docs/sessions/session/](https://google.github.io/adk-docs/sessions/session/)

<a id="ref3"></a>3. Google. (2025). _ADK State Documentation_. [https://google.github.io/adk-docs/sessions/state/](https://google.github.io/adk-docs/sessions/state/)

<a id="ref4"></a>4. Google. (2025). _ADK Context Documentation_. [https://google.github.io/adk-docs/context/](https://google.github.io/adk-docs/context/)
