"""WebSocket service for real-time communication."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class WebSocketService:
    """WebSocket 服务."""

    def __init__(self, connection_manager: Any) -> None:
        """初始化 WebSocketService.

        Args:
            connection_manager: 连接管理器实例
        """
        self.manager = connection_manager

    async def send_task_update(
        self,
        task_id: str,
        status: str,
        progress: float | None = None,
        message: str | None = None,
    ) -> None:
        """发送任务更新.

        Args:
            task_id: 任务ID
            status: 状态
            progress: 进度
            message: 消息
        """
        from ..routes.websocket import send_task_update

        await send_task_update(
            task_id,
            status,
            progress if progress is not None else 0.0,
            message if message is not None else "",
        )

    async def send_task_completion(
        self,
        task_id: str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        """发送任务完成通知.

        Args:
            task_id: 任务ID
            result: 结果
            error: 错误
        """
        from ..routes.websocket import send_task_completion

        await send_task_completion(
            task_id,
            result if result is not None else {},
            error if error is not None else "",
        )

    async def send_batch_progress(
        self,
        batch_id: str,
        total_or_progress: int | dict,
        processed: int | None = None,
        current_file: str | None = None,
    ) -> None:
        """发送批处理进度.

        Args:
            batch_id: 批次ID
            total_or_progress: 总数（当processed不为None时）或进度字典（旧API兼容）
            processed: 已处理数
            current_file: 当前文件
        """
        # Support both old and new API
        if isinstance(total_or_progress, dict) and processed is None:
            # Old API: send_batch_progress(batch_id, progress_dict)
            progress_dict = total_or_progress
            message = {
                "type": "batch_progress",
                "batch_id": batch_id,
                "completed": progress_dict.get("completed", 0),
                "total": progress_dict.get("total", 0),
                "current": progress_dict.get("current", ""),
            }
            await self.manager.broadcast_to_subscribers(message, batch_id)
        else:
            # New API: Use route function
            from ..routes.websocket import send_batch_progress

            total = total_or_progress
            await send_batch_progress(
                batch_id,
                total,
                processed if processed is not None else 0,
                current_file if current_file is not None else "",
            )

    async def send_paper_analysis(
        self, paper_id: str, analysis_data: dict[str, Any]
    ) -> None:
        """发送论文分析结果.

        Args:
            paper_id: 论文ID
            analysis_data: 分析数据
        """
        message = {
            "type": "paper_analysis",
            "paper_id": paper_id,
            "analysis": analysis_data,
        }
        await self.manager.broadcast_to_subscribers(message, paper_id)
