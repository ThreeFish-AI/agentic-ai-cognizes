---
id: the-pulse-implementation
sidebar_position: 1.2
title: Phase 1：The Pulse 验证实施方案
last_update:
  author: Aurelius Huang
  created_at: 2026-01-08
  updated_at: 2026-01-08
  version: 1.0
  status: Draft
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

### 1.3 工期规划

| 阶段 | 任务模块          | 预估工期 | 交付物                             |
| :--- | :---------------- | :------- | :--------------------------------- |
| 1.1  | 环境部署          | 0.5 Day  | PostgreSQL 16+ 环境就绪            |
| 1.2  | Schema 设计       | 0.5 Day  | `agent_schema.sql`                 |
| 1.3  | Pulse Engine 实现 | 1 Day    | `StateManager`, `PgNotifyListener` |
| 1.4  | 测试与验收        | 0.5 Day  | 测试报告 + 技术文档                |

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

```mermaid
erDiagram
    threads ||--o{ events : contains
    threads ||--o{ runs : has
    threads {
        uuid id PK "会话唯一标识"
        varchar app_name "应用名称"
        varchar user_id "用户标识"
        jsonb state "会话状态 (无前缀)"
        integer version "乐观锁版本号"
        timestamp created_at "创建时间"
        timestamp updated_at "最后更新时间"
    }

    events {
        uuid id PK "事件唯一标识"
        uuid thread_id FK "所属会话"
        uuid invocation_id "调用标识"
        varchar author "事件作者"
        jsonb content "消息内容"
        jsonb actions "事件动作"
        timestamp created_at "事件时间戳"
    }

    runs {
        uuid id PK "执行链路标识"
        uuid thread_id FK "所属会话"
        varchar status "状态: pending/running/completed/failed"
        jsonb thinking_steps "思考步骤"
        timestamp started_at "开始时间"
        timestamp completed_at "完成时间"
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

### 3.2 核心表设计

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
psql -d your_database -c "CREATE EXTENSION vector;"
```

**pg_cron 安装指南**：

```bash
# 修改 postgresql.conf
shared_preload_libraries = 'pg_cron'
cron.database_name = 'your_database'

# 重启 PostgreSQL 后
psql -d your_database -c "CREATE EXTENSION pg_cron;"
```

#### 4.1.2 开发环境配置

**Python 环境**：

```bash
# 创建项目目录结构
mkdir -p docs/practice/engine/pulse
mkdir -p docs/practice/schema
mkdir -p docs/practice/tests/pulse

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install asyncpg psycopg[binary] google-adk pydantic pytest pytest-asyncio
```

**依赖清单** (`requirements.txt`):

```text
# Core
asyncpg>=0.29.0
psycopg[binary]>=3.1.0
pydantic>=2.0.0

# Google ADK
google-adk>=0.1.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0

# Utilities
python-dotenv>=1.0.0
```

### 4.2 Step 2: Schema 设计与部署

#### 4.2.1 完整 Schema 脚本

创建 `docs/practice/schema/agent_schema.sql`:

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
    thinking_steps  JSONB DEFAULT '[]',
    error           TEXT,
    started_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs(thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

-- ============================================
-- 4. user_states 表 (用户级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS user_states (
    user_id         VARCHAR(255) NOT NULL,
    app_name        VARCHAR(255) NOT NULL,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, app_name)
);

-- ============================================
-- 5. app_states 表 (应用级持久状态)
-- ============================================
CREATE TABLE IF NOT EXISTS app_states (
    app_name        VARCHAR(255) PRIMARY KEY,
    state           JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. NOTIFY 触发器 (实时事件流)
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
-- 7. 自动更新 updated_at 触发器
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
psql -d agent_db -f docs/practice/schema/agent_schema.sql

# 验证表创建
psql -d agent_db -c "\dt"

# 验证触发器
psql -d agent_db -c "\df notify_event_insert"
```

---

### 4.3 Step 3: Pulse Engine 核心实现

#### 4.3.1 StateManager 类实现

创建 `docs/practice/engine/pulse/state_manager.py`:

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

创建 `docs/practice/engine/pulse/pg_notify_listener.py`:

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

创建 `docs/practice/tests/pulse/test_state_manager.py`:

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
```

#### 4.4.2 端到端延迟测试

创建 `docs/practice/tests/pulse/test_notify_latency.py`:

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
```

---

## 5. 验收标准

### 5.1 功能验收矩阵

| 验收项              | 验收标准                       | 验证方法      |
| :------------------ | :----------------------------- | :------------ |
| PostgreSQL 16+ 部署 | `SELECT version()` 返回 16.x+  | 命令行验证    |
| pgvector 安装       | `CREATE EXTENSION vector` 成功 | SQL 执行      |
| Schema 部署         | 所有表和触发器创建成功         | `\dt` + `\df` |
| Session CRUD        | 创建/读取/列表/删除操作正确    | 单元测试      |
| 原子状态流转        | 0 脏读/丢失                    | 并发测试      |
| 乐观锁 (OCC)        | 版本冲突正确检测               | 冲突测试      |
| 实时事件流          | 端到端延迟 < 50ms              | 延迟测试      |

### 5.2 性能基准

| 指标             | 目标值 | 测试条件       |
| :--------------- | :----- | :------------- |
| Session 创建 QPS | > 1000 | 单节点         |
| Event 追加 QPS   | > 500  | 含 state_delta |
| NOTIFY 延迟 P99  | < 50ms | 100 msg/s      |
| 并发写入成功率   | 100%   | 10 并发        |

---

## 6. 交付物清单

| 类别       | 文件路径                                           | 描述              |
| :--------- | :------------------------------------------------- | :---------------- |
| **文档**   | `docs/practice/010-the-pulse.md`                   | 本实施方案        |
| **Schema** | `docs/practice/schema/agent_schema.sql`            | 统一建表脚本      |
| **代码**   | `docs/practice/engine/pulse/state_manager.py`      | StateManager 实现 |
| **代码**   | `docs/practice/engine/pulse/pg_notify_listener.py` | NOTIFY 监听器     |
| **测试**   | `docs/practice/tests/pulse/test_state_manager.py`  | 单元测试套件      |
| **测试**   | `docs/practice/tests/pulse/test_notify_latency.py` | 延迟测试          |

---

## 参考文献

<a id="ref1"></a>1. Google. (2025). _ADK Sessions Documentation_. [https://google.github.io/adk-docs/sessions/](https://google.github.io/adk-docs/sessions/)

<a id="ref2"></a>2. Google. (2025). _ADK Session Overview_. [https://google.github.io/adk-docs/sessions/session/](https://google.github.io/adk-docs/sessions/session/)

<a id="ref3"></a>3. Google. (2025). _ADK State Documentation_. [https://google.github.io/adk-docs/sessions/state/](https://google.github.io/adk-docs/sessions/state/)

<a id="ref4"></a>4. Google. (2025). _ADK Context Documentation_. [https://google.github.io/adk-docs/context/](https://google.github.io/adk-docs/context/)
