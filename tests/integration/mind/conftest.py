"""
Mind Integration Test Fixtures
"""

import os
import pytest
import pytest_asyncio
import asyncpg


@pytest_asyncio.fixture
async def db_pool():
    """
    Database connection pool for Mind integration tests.
    Connects to local Postgres instance.
    """
    database_url = os.environ.get("DATABASE_URL", "postgresql://aigc:@localhost/cognizes-engine")
    try:
        pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
        yield pool
        await pool.close()
    except Exception as e:
        pytest.skip(f"Database unavailable: {e}")
