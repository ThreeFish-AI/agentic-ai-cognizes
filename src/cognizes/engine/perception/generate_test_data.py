"""
测试数据生成器 (generate_test_data.py)

生成向量数据用于验证 High-Selectivity Filtering 场景的 Recall@10。
支持配置不同数据规模：10 万 (快速测试) 和 1000 万 (性能验证)。

用法:
    python generate_test_data.py --scale quick    # 10 万条
    python generate_test_data.py --scale full     # 1000 万条
"""

from __future__ import annotations

import argparse
import asyncio
import random
import time
import uuid

import asyncpg
import numpy as np

# 数据规模配置
SCALE_CONFIG = {
    "quick": {"total_records": 100_000, "batch_size": 5_000, "description": "快速测试 (10 万条)"},
    "full": {"total_records": 10_000_000, "batch_size": 10_000, "description": "性能验证 (1000 万条)"},
}


async def generate_test_data(
    pool: asyncpg.Pool,
    total_records: int,
    batch_size: int,
    rare_user_ratio: float = 0.01,
):
    """
    生成测试数据

    Args:
        pool: 数据库连接池
        total_records: 总记录数
        batch_size: 批量插入大小
        rare_user_ratio: 稀有用户数据占比 (默认 1%)
    """
    rare_user_id = "rare_user_001"
    common_users = [f"common_user_{i:04d}" for i in range(100)]

    print(f"\n📊 数据生成参数:")
    print(f"   - 总记录数: {total_records:,}")
    print(f"   - 稀有用户: {rare_user_id} ({rare_user_ratio:.1%})")
    print(f"   - 预计稀有用户记录: {int(total_records * rare_user_ratio):,}")
    print(f"   - 批次大小: {batch_size:,}")
    print(f"   - 预计批次数: {total_records // batch_size}")

    start_time = time.time()

    for batch_idx, batch_start in enumerate(range(0, total_records, batch_size)):
        batch_end = min(batch_start + batch_size, total_records)
        records = []

        for i in range(batch_start, batch_end):
            # 按比例分配用户
            if random.random() < rare_user_ratio:
                user_id = rare_user_id
            else:
                user_id = random.choice(common_users)

            # 生成随机向量 (1536 维，匹配 OpenAI ada-002)
            embedding = np.random.randn(1536).astype(np.float32).tolist()

            # 生成丰富的元数据用于 Complex Predicates 测试
            metadata = {
                "index": i,
                "batch": batch_idx,
                "priority": random.randint(1, 5),
                "tags": random.sample(["research", "note", "task", "meeting", "important"], k=random.randint(1, 3)),
                "author": {"role": random.choice(["user", "admin", "expert"])},
                "status": random.choice(["draft", "published", "archived"]),
                "access_level": random.randint(1, 5),
            }

            records.append(
                (
                    str(uuid.uuid4()),
                    user_id,
                    "test_app",
                    f"Test content for document {i}. This is sample text for semantic search testing.",
                    embedding,
                    metadata,
                )
            )

        # 批量插入
        await pool.executemany(
            """
            INSERT INTO memories (id, user_id, app_name, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
        """,
            records,
        )

        # 进度显示
        progress = batch_end / total_records * 100
        elapsed = time.time() - start_time
        rate = batch_end / elapsed if elapsed > 0 else 0
        eta = (total_records - batch_end) / rate if rate > 0 else 0

        print(
            f"\r   ⏳ 进度: {progress:5.1f}% ({batch_end:,}/{total_records:,}) | 速率: {rate:,.0f}/s | ETA: {eta:.0f}s",
            end="",
            flush=True,
        )

    elapsed = time.time() - start_time
    print(f"\n\n✅ 数据生成完成! 耗时: {elapsed:.1f}s")


async def verify_data_distribution(pool: asyncpg.Pool):
    """验证数据分布"""
    print("\n📈 数据分布验证:")

    total_count = await pool.fetchval("SELECT COUNT(*) FROM memories WHERE app_name = 'test_app'")
    rare_count = await pool.fetchval("SELECT COUNT(*) FROM memories WHERE user_id = 'rare_user_001'")

    print(f"   - 总记录数: {total_count:,}")
    print(f"   - 稀有用户记录: {rare_count:,} ({rare_count / total_count:.2%})")

    # 验证元数据分布
    admin_count = await pool.fetchval("""
        SELECT COUNT(*) FROM memories
        WHERE metadata @> '{"author": {"role": "admin"}}'
    """)
    print(f"   - admin 角色记录: {admin_count:,} ({admin_count / total_count:.2%})")


async def main():
    parser = argparse.ArgumentParser(description="生成 High-Selectivity 测试数据")
    parser.add_argument("--scale", choices=["quick", "full"], default="quick", help="数据规模: quick=10万, full=1000万")
    parser.add_argument("--db-url", default="postgresql://aigc:@localhost/cognizes-engine", help="数据库连接 URL")
    parser.add_argument("--clean", action="store_true", help="清理现有测试数据后再生成")
    args = parser.parse_args()

    config = SCALE_CONFIG[args.scale]
    print(f"🚀 {config['description']}")

    pool = await asyncpg.create_pool(args.db_url, min_size=2, max_size=10)

    if args.clean:
        print("\n🗑️ 清理现有测试数据...")
        await pool.execute("DELETE FROM memories WHERE app_name = 'test_app'")

    await generate_test_data(pool, total_records=config["total_records"], batch_size=config["batch_size"])

    await verify_data_distribution(pool)

    print("\n💡 下一步: 运行基准测试验证 Recall@10")
    print("   python benchmark.py --user-id rare_user_001")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
