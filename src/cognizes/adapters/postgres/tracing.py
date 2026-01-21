"""
OpenTelemetry 双路导出集成

架构:
┌─────────────┐     ┌──────────────────┐
│ Agent       │────▶│ TracingManager   │
│ Executor    │     │                  │
└─────────────┘     └─────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ PostgreSQL    │ OTLP/Langfuse │  │ Console     │
    │ (实时调试)    │  │ (开发环境)  │
    └─────────────┘  └─────────────┘
"""

import json
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider, ReadableSpan
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SpanExporter,
    SpanExportResult,
    ConsoleSpanExporter,
)
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.trace import Status, StatusCode


class PostgresSpanExporter(SpanExporter):
    """
    将 Span 持久化到 PostgreSQL traces 表

    注意: BatchSpanProcessor 在后台线程调用 export()，
    因此使用 psycopg (同步驱动) 或独立事件循环执行异步操作。
    """

    def __init__(self, dsn: str | None = None, pool: asyncpg.Pool | None = None):
        """
        Args:
            dsn: PostgreSQL 连接字符串 (推荐)
            pool: 连接池 (仅用于兼容旧代码)
        """
        self._dsn = dsn
        self._pool = pool

    def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
        """同步导出 Spans 到 PostgreSQL"""
        try:
            # 使用 psycopg (同步驱动) 执行插入
            import psycopg

            if not self._dsn:
                raise ValueError("PostgresSpanExporter 需要 dsn 参数")

            with psycopg.connect(self._dsn) as conn:
                with conn.cursor() as cur:
                    for span in spans:
                        cur.execute(
                            """
                            INSERT INTO traces
                            (trace_id, span_id, parent_span_id, operation_name, span_kind,
                             attributes, events, start_time, end_time, duration_ns,
                             status_code, status_message)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                format(span.context.trace_id, "032x"),
                                format(span.context.span_id, "016x"),
                                format(span.parent.span_id, "016x") if span.parent else None,
                                span.name,
                                span.kind.name if span.kind else "INTERNAL",
                                json.dumps(dict(span.attributes or {})),
                                json.dumps([self._event_to_dict(e) for e in (span.events or [])]),
                                datetime.fromtimestamp(span.start_time / 1e9),
                                datetime.fromtimestamp(span.end_time / 1e9) if span.end_time else None,
                                (span.end_time - span.start_time) if span.end_time else None,
                                span.status.status_code.name if span.status else "UNSET",
                                span.status.description if span.status else None,
                            ),
                        )
                conn.commit()

            return SpanExportResult.SUCCESS
        except Exception as e:
            import sys

            print(f"PostgresSpanExporter 导出失败: {e}", file=sys.stderr)
            return SpanExportResult.FAILURE

    def _event_to_dict(self, event) -> dict:
        return {"name": event.name, "timestamp": event.timestamp, "attributes": dict(event.attributes or {})}

    def shutdown(self) -> None:
        pass


class TracingManager:
    """
    Trace 管理器 - 支持双路导出

    使用方式:
        tracing = TracingManager(pg_dsn=DATABASE_URL, otlp_endpoint="localhost:4317")

        @tracing.trace_tool_call("calculator")
        async def calculate(x, y):
            return x + y
    """

    def __init__(
        self,
        service_name: str = "open-agent-engine",
        pg_dsn: str | None = None,
        pg_pool: asyncpg.Pool | None = None,
        otlp_endpoint: str | None = None,
        console_export: bool = False,
        otlp_exporter: SpanExporter | None = None,  # For testing
        # Langfuse 配置
        langfuse_public_key: str | None = None,
        langfuse_secret_key: str | None = None,
        langfuse_host: str | None = None,
    ):
        provider = TracerProvider()

        # 双路导出配置
        if pg_dsn:
            # PostgreSQL (DSN): 使用同步驱动，推荐用于生产环境
            provider.add_span_processor(BatchSpanProcessor(PostgresSpanExporter(dsn=pg_dsn)))
        elif pg_pool:
            # PostgreSQL (Pool): 仅用于旧代码兼容
            provider.add_span_processor(BatchSpanProcessor(PostgresSpanExporter(pool=pg_pool)))

        # OTLP: 实时可视化 (Langfuse)
        if otlp_exporter:
            # 优先使用注入的 Exporter (测试用)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        elif otlp_endpoint:
            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)))

        # Langfuse SDK 集成
        if langfuse_public_key and langfuse_secret_key:
            try:
                from langfuse import Langfuse

                self._langfuse = Langfuse(
                    public_key=langfuse_public_key,
                    secret_key=langfuse_secret_key,
                    host=langfuse_host or "https://cloud.langfuse.com",
                )
                print(f"[TracingManager] Langfuse 已连接: {langfuse_host}")
            except ImportError:
                print("[TracingManager] 警告: langfuse 未安装，跳过 Langfuse 集成")
                self._langfuse = None
            except Exception as e:
                print(f"[TracingManager] 警告: Langfuse 初始化失败: {e}")
                self._langfuse = None
        else:
            self._langfuse = None

        if console_export:
            # Console: 开发调试
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

        trace.set_tracer_provider(provider)
        self.provider = provider
        self._tracer = self.provider.get_tracer(service_name)

    @asynccontextmanager
    async def span(self, name: str, *, attributes: dict[str, Any] | None = None):
        """创建 Span 上下文"""
        with self._tracer.start_as_current_span(name) as span:
            if attributes:
                for k, v in attributes.items():
                    span.set_attribute(k, str(v))
            try:
                yield span
                span.set_status(Status(StatusCode.OK))
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                raise

    def trace_tool_call(self, tool_name: str):
        """工具调用追踪装饰器"""

        def decorator(func):
            async def wrapper(*args, **kwargs):
                async with self.span(f"tool.{tool_name}", attributes={"tool.name": tool_name}) as span:
                    result = await func(*args, **kwargs)
                    span.set_attribute("tool.result_size", len(str(result)))
                    return result

            return wrapper

        return decorator

    def trace_llm_call(self, model: str):
        """LLM 调用追踪装饰器"""

        def decorator(func):
            async def wrapper(*args, **kwargs):
                async with self.span(f"llm.generate", attributes={"llm.model": model}) as span:
                    result = await func(*args, **kwargs)
                    span.set_attribute("llm.response_length", len(str(result)))
                    return result

            return wrapper

        return decorator
