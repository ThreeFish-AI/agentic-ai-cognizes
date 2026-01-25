"""
EventRepository: Event Data Access Layer
"""

from __future__ import annotations

import json
import uuid

import asyncpg

from cognizes.core.repositories.base import BaseRepository


class EventRepository(BaseRepository):
    """Event Data Access Layer"""

    async def insert(
        self,
        event_id: uuid.UUID,
        thread_id: uuid.UUID,
        invocation_id: uuid.UUID,
        author: str,
        event_type: str,
        content: dict,
        actions: dict,
        conn: asyncpg.Connection | None = None,
    ) -> asyncpg.Record:
        """Insert a new event."""
        query = """
            INSERT INTO events (id, thread_id, invocation_id, author, event_type, content, actions)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
        """
        params = (
            event_id,
            thread_id,
            invocation_id,
            author,
            event_type,
            json.dumps(content),
            json.dumps(actions),
        )

        if conn:
            return await conn.fetchrow(query, *params)

        pool = await self.get_pool()
        async with pool.acquire() as conn:
            return await conn.fetchrow(query, *params)

    async def atomic_append(
        self,
        session_id: uuid.UUID,
        current_version: int,
        new_state: dict | None,
        event_data: dict,
    ) -> dict:
        """
        Atomically append event and update state (if needed).
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                new_version = current_version
                # 1. Update State (if needed)
                if new_state is not None:
                    query = """
                        UPDATE threads
                        SET state = $1, version = version + 1, updated_at = NOW()
                        WHERE id = $2 AND version = $3
                        RETURNING version
                    """
                    new_version = await conn.fetchval(query, json.dumps(new_state), session_id, current_version)

                    if new_version is None:
                        # Conflict detected
                        return {"status": "conflict"}

                # 2. Append Event
                event_row = await self.insert(
                    event_data["id"],
                    session_id,
                    event_data["invocation_id"],
                    event_data["author"],
                    event_data["event_type"],
                    event_data["content"],
                    event_data["actions"],
                    conn=conn,
                )

                return {"status": "success", "version": new_version, "event": event_row}
