"""
PostgresMemoryService 单元测试
覆盖 ADK BaseMemoryService 接口所有方法

验收项:
- #9: add_session_to_memory
- #10: search_memory 语义检索
- #11: list_memories 列出记忆
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import dataclass
from types import SimpleNamespace

# pytest-asyncio 配置
pytestmark = pytest.mark.asyncio


# 模拟 Session 对象
@dataclass
class MockSession:
    id: str
    app_name: str
    user_id: str
    events: list


class TestPostgresMemoryService:
    """MemoryService 单元测试套件"""

    @pytest.fixture
    def mock_pool(self):
        """创建模拟数据库连接池"""
        pool = MagicMock()
        conn = AsyncMock()

        # 模拟连接池上下文管理器
        acm = AsyncMock()
        acm.__aenter__.return_value = conn
        acm.__aexit__.return_value = None
        pool.acquire.return_value = acm

        # 模拟 execute 和 fetch
        conn.execute = AsyncMock()
        conn.fetch = AsyncMock(return_value=[])

        return pool, conn

    @pytest.fixture
    def service(self, mock_pool):
        """创建测试服务实例"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, _ = mock_pool
        return PostgresMemoryService(pool=pool)

    # ========== add_session_to_memory 测试 ==========

    async def test_add_session_to_memory(self, mock_pool):
        """验收项 #9: 测试会话转化为可搜索记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, conn = mock_pool
        service = PostgresMemoryService(pool=pool)

        # 创建测试会话
        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_001",
            events=[
                SimpleNamespace(author="user", content=SimpleNamespace(parts=[SimpleNamespace(text="我喜欢喝咖啡")])),
                SimpleNamespace(
                    author="agent", content=SimpleNamespace(parts=[SimpleNamespace(text="好的，我记住了")])
                ),
                SimpleNamespace(author="user", content=SimpleNamespace(parts=[SimpleNamespace(text="我住在北京")])),
            ],
        )

        # 执行
        await service.add_session_to_memory(session)

        # 验证: execute 被调用 (插入 memories 表)
        conn.execute.assert_called_once()
        call_args = conn.execute.call_args
        assert "INSERT INTO memories" in call_args[0][0]

    async def test_add_session_to_memory_empty_events(self, mock_pool):
        """测试空事件不产生记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, conn = mock_pool
        service = PostgresMemoryService(pool=pool)

        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_002",
            events=[],  # 空事件列表
        )

        await service.add_session_to_memory(session)

        # 验证: 无消息时不应插入
        conn.execute.assert_not_called()

    async def test_add_session_with_consolidation_worker(self, mock_pool):
        """测试使用 Phase 2 consolidation_worker"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, _ = mock_pool
        mock_worker = AsyncMock()
        service = PostgresMemoryService(pool=pool, consolidation_worker=mock_worker)

        session = MockSession(
            id=str(uuid.uuid4()),
            app_name="test_app",
            user_id="user_003",
            events=[{"author": "user", "content": {"text": "测试"}}],
        )

        await service.add_session_to_memory(session)

        # 验证: 使用 worker 而非简化实现
        mock_worker.consolidate.assert_called_once()

    # ========== search_memory 测试 ==========

    async def test_search_memory(self, mock_pool):
        """验收项 #10: 测试语义检索"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        pool, conn = mock_pool

        # 模拟数据库返回
        conn.fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "用户喜欢喝咖啡",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.95,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            },
            {
                "id": uuid.uuid4(),
                "content": "用户住在北京",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.85,
                "created_at": datetime(2024, 1, 1, 12, 5, 0),
            },
        ]

        service = PostgresMemoryService(pool=pool)

        # 执行搜索
        response = await service.search_memory(app_name="test_app", user_id="user_001", query="咖啡偏好")

        # 验证
        assert len(response.memories) == 2
        # MemoryEntry does not expose relevance_score attribute directly in ADK
        # assert response.memories[0].relevance_score == 0.95
        assert "咖啡" in response.memories[0].content.parts[0].text

    async def test_search_memory_empty_result(self, mock_pool):
        """测试无匹配结果"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, conn = mock_pool
        conn.fetch.return_value = []

        service = PostgresMemoryService(pool=pool)

        response = await service.search_memory(app_name="test_app", user_id="unknown_user", query="不存在的内容")

        assert len(response.memories) == 0

    async def test_search_memory_with_embedding(self, mock_pool):
        """测试使用向量检索"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        pool, conn = mock_pool

        # 模拟 embedding 函数
        mock_embedding_fn = AsyncMock(return_value=[0.1] * 384)

        conn.fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "向量检索结果",
                "metadata": json.dumps({"source": "session"}),
                "relevance_score": 0.99,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            }
        ]

        service = PostgresMemoryService(pool=pool, embedding_fn=mock_embedding_fn)

        response = await service.search_memory(app_name="test_app", user_id="user_004", query="测试向量")

        # 验证 embedding 被调用
        mock_embedding_fn.assert_called_once_with("测试向量")
        assert len(response.memories) == 1

    # ========== list_memories 测试 ==========

    async def test_list_memories(self, mock_pool):
        """验收项 #11: 测试列出用户所有记忆"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService
        import json

        pool, conn = mock_pool

        # 模拟数据库返回
        conn.fetch.return_value = [
            {
                "id": uuid.uuid4(),
                "content": "记忆1",
                "metadata": json.dumps({"source": "session"}),
                "retention_score": 0.9,
                "created_at": datetime(2024, 1, 1, 12, 0, 0),
            },
            {
                "id": uuid.uuid4(),
                "content": "记忆2",
                "metadata": json.dumps({"source": "session"}),
                "retention_score": 0.8,
                "created_at": datetime(2024, 1, 1, 12, 5, 0),
            },
        ]

        service = PostgresMemoryService(pool=pool)

        memories = await service.list_memories(app_name="test_app", user_id="user_005")

        # 验证
        assert len(memories) == 2
        assert memories[0].content.parts[0].text == "记忆1"
        assert memories[1].content.parts[0].text == "记忆2"

    async def test_list_memories_with_limit(self, mock_pool):
        """测试列出记忆带限制"""
        from cognizes.adapters.postgres.memory_service import PostgresMemoryService

        pool, conn = mock_pool
        conn.fetch.return_value = []

        service = PostgresMemoryService(pool=pool)

        await service.list_memories(app_name="test_app", user_id="user_006", limit=50)

        # 验证 SQL 中包含 LIMIT
        call_args = conn.fetch.call_args
        assert "LIMIT" in call_args[0][0]
