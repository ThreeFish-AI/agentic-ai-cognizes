"""
StateManager: 原子状态流转管理器

实现对标 Google ADK SessionService 的状态管理能力：
- 原子状态流转 (Atomic State Transitions)
- 乐观并发控制 (Optimistic Concurrency Control)
- State 前缀作用域解析
"""

from __future__ import annotations

import asyncio
import json
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

    async def create_session(self, app_name: str, user_id: str, initial_state: dict[str, Any] | None = None) -> Session:
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
                uuid.UUID(session_id),
                app_name,
                user_id,
                json.dumps(state),
            )

        return self._row_to_session(row)

    async def get_session(self, app_name: str, user_id: str, session_id: str) -> Session | None:
        """获取会话"""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, app_name, user_id, state, version, created_at, updated_at
                FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id),
                app_name,
                user_id,
            )

        return self._row_to_session(row) if row else None

    async def list_sessions(self, app_name: str, user_id: str) -> list[Session]:
        """列出用户所有会话"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, app_name, user_id, state, version, created_at, updated_at
                FROM threads
                WHERE app_name = $1 AND user_id = $2
                ORDER BY updated_at DESC
                """,
                app_name,
                user_id,
            )

        return [self._row_to_session(row) for row in rows]

    async def delete_session(self, app_name: str, user_id: str, session_id: str) -> bool:
        """删除会话"""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM threads
                WHERE id = $1 AND app_name = $2 AND user_id = $3
                """,
                uuid.UUID(session_id),
                app_name,
                user_id,
            )

        return result == "DELETE 1"

    # ========================================
    # 原子状态流转
    # ========================================

    async def append_event(self, session: Session, event: Event) -> Event:
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
                        json.dumps(new_state),
                        uuid.UUID(session.id),
                        session.version,
                    )

                    if result is None:
                        raise ConcurrencyConflictError(
                            f"Session {session.id} version conflict. Expected {session.version}, but it was modified."
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
                    json.dumps(event.content),
                    json.dumps(event.actions),
                )

                event.id = str(row["id"])
                event.created_at = row["created_at"]

        return event

    # ========================================
    # 乐观并发控制 (OCC)
    # ========================================

    async def update_session_state(
        self, session: Session, state_delta: dict[str, Any], max_retries: int = 3
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
                    actions={"state_delta": state_delta},
                )
                await self.append_event(session, event)
                return session

            except ConcurrencyConflictError:
                if attempt == max_retries - 1:
                    raise

                # 重新加载最新状态
                session = await self.get_session(session.app_name, session.user_id, session.id)
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
                return prefix.rstrip(":"), key[len(prefix) :]
        return "session", key

    async def set_state(self, session: Session, key: str, value: Any) -> None:
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
                user_id,
                app_name,
                key,
                value,
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
                app_name,
                key,
                value,
            )

    async def get_state(self, session: Session, key: str, default: Any = None) -> Any:
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
                user_id,
                app_name,
                key,
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
                app_name,
                key,
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
                session.user_id,
                session.app_name,
            )
            if row and row["state"]:
                for k, v in row["state"].items():
                    result[f"user:{k}"] = v

        # App scope
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT state FROM app_states WHERE app_name = $1", session.app_name)
            if row and row["state"]:
                for k, v in row["state"].items():
                    result[f"app:{k}"] = v

        return result

    # ========================================
    # 辅助方法
    # ========================================

    def _row_to_session(self, row: asyncpg.Record) -> Session:
        """将数据库行转换为 Session 对象"""
        raw_state = row["state"]
        if isinstance(raw_state, str):
            state = json.loads(raw_state)
        elif isinstance(raw_state, dict):
            state = raw_state
        else:
            state = {}

        return Session(
            id=str(row["id"]),
            app_name=row["app_name"],
            user_id=row["user_id"],
            state=state,
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
