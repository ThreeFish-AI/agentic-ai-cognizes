"""Unit tests for WebSocketService."""

from unittest.mock import AsyncMock, patch

import pytest

from agents.api.services.websocket_service import WebSocketService


@pytest.mark.unit
class TestWebSocketService:
    """Test cases for WebSocketService."""

    @pytest.fixture
    def mock_connection_manager(self):
        """Create a mock connection manager."""
        manager = AsyncMock()
        return manager

    @pytest.fixture
    def websocket_service(self, mock_connection_manager):
        """Create a WebSocketService instance for testing."""
        return WebSocketService(mock_connection_manager)

    def test_websocket_service_initialization(
        self, websocket_service, mock_connection_manager
    ):
        """Test WebSocketService initialization."""
        assert websocket_service.manager == mock_connection_manager

    @pytest.mark.asyncio
    async def test_send_task_update_minimal(self, websocket_service):
        """Test send_task_update with minimal parameters."""
        task_id = "task_123"
        status = "processing"

        # Test the service method directly - it should use the manager
        await websocket_service.send_task_update(task_id, status)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        message = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert message["type"] == "task_update"
        assert message["task_id"] == task_id
        assert message["status"] == status
        assert message["progress"] == 0.0
        assert message["message"] == ""
        assert "timestamp" in message

    @pytest.mark.asyncio
    async def test_send_task_update_with_all_params(self, websocket_service):
        """Test send_task_update with all parameters."""
        task_id = "task_123"
        status = "processing"
        progress = 75.5
        message = "Processing file..."

        await websocket_service.send_task_update(task_id, status, progress, message)

        # Verify the manager was called with correct message
        websocket_service.manager.broadcast_to_subscribers.assert_called_once()
        call_args = websocket_service.manager.broadcast_to_subscribers.call_args[0]
        msg = call_args[0]
        sent_task_id = call_args[1]

        assert sent_task_id == task_id
        assert msg["type"] == "task_update"
        assert msg["task_id"] == task_id
        assert msg["status"] == status
        assert msg["progress"] == progress
        assert msg["message"] == message
        assert "timestamp" in msg

    @pytest.mark.asyncio
    async def test_send_task_update_with_zero_progress(self, websocket_service):
        """Test send_task_update with explicit zero progress."""
        task_id = "task_123"
        status = "starting"

        with patch("agents.api.routes.websocket.send_task_update") as mock_send:
            await websocket_service.send_task_update(
                task_id, status, 0.0, "Starting..."
            )

            mock_send.assert_called_once_with(task_id, status, 0.0, "Starting...")

    @pytest.mark.asyncio
    async def test_send_task_update_with_none_values(self, websocket_service):
        """Test send_task_update with None values."""
        task_id = "task_123"
        status = "processing"

        with patch("agents.api.routes.websocket.send_task_update") as mock_send:
            await websocket_service.send_task_update(task_id, status, None, None)

            mock_send.assert_called_once_with(task_id, status, 0.0, "")

    @pytest.mark.asyncio
    async def test_send_task_completion_success(self, websocket_service):
        """Test send_task_completion with success result."""
        task_id = "task_123"
        result = {"output_file": "translated.pdf", "word_count": 5000}

        with patch("agents.api.routes.websocket.send_task_completion") as mock_send:
            await websocket_service.send_task_completion(task_id, result)

            mock_send.assert_called_once_with(task_id, result, "")

    @pytest.mark.asyncio
    async def test_send_task_completion_failure(self, websocket_service):
        """Test send_task_completion with error."""
        task_id = "task_123"
        error = "Translation failed: timeout"

        with patch("agents.api.routes.websocket.send_task_completion") as mock_send:
            await websocket_service.send_task_completion(task_id, error=error)

            mock_send.assert_called_once_with(task_id, {}, error)

    @pytest.mark.asyncio
    async def test_send_task_completion_both_result_and_error(self, websocket_service):
        """Test send_task_completion with both result and error."""
        task_id = "task_123"
        result = {"partial_output": "some content"}
        error = "Warning: incomplete translation"

        with patch("agents.api.routes.websocket.send_task_completion") as mock_send:
            await websocket_service.send_task_completion(task_id, result, error)

            mock_send.assert_called_once_with(task_id, result, error)

    @pytest.mark.asyncio
    async def test_send_task_completion_none_values(self, websocket_service):
        """Test send_task_completion with None values."""
        task_id = "task_123"

        with patch("agents.api.routes.websocket.send_task_completion") as mock_send:
            await websocket_service.send_task_completion(task_id, None, None)

            mock_send.assert_called_once_with(task_id, {}, "")

    @pytest.mark.asyncio
    async def test_send_batch_progress_minimal(self, websocket_service):
        """Test send_batch_progress with minimal parameters."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            await websocket_service.send_batch_progress(batch_id, total, processed)

            mock_send.assert_called_once_with(batch_id, total, processed, "")

    @pytest.mark.asyncio
    async def test_send_batch_progress_with_current_file(self, websocket_service):
        """Test send_batch_progress with current file."""
        batch_id = "batch_123"
        total = 10
        processed = 5
        current_file = "paper5.pdf"

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            await websocket_service.send_batch_progress(
                batch_id, total, processed, current_file
            )

            mock_send.assert_called_once_with(batch_id, total, processed, "paper5.pdf")

    @pytest.mark.asyncio
    async def test_send_batch_progress_with_none_current_file(self, websocket_service):
        """Test send_batch_progress with None current file."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            await websocket_service.send_batch_progress(
                batch_id, total, processed, None
            )

            mock_send.assert_called_once_with(batch_id, total, processed, "")

    @pytest.mark.asyncio
    async def test_send_batch_progress_complete(self, websocket_service):
        """Test send_batch_progress when batch is complete."""
        batch_id = "batch_123"
        total = 10
        processed = 10
        current_file = None

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            await websocket_service.send_batch_progress(
                batch_id, total, processed, current_file
            )

            mock_send.assert_called_once_with(batch_id, total, processed, "")

    @pytest.mark.asyncio
    async def test_send_task_update_exception_handling(self, websocket_service):
        """Test send_task_update exception handling."""
        task_id = "task_123"
        status = "processing"

        # Make the manager's broadcast_to_subscribers raise an exception
        websocket_service.manager.broadcast_to_subscribers.side_effect = Exception(
            "WebSocket error"
        )

        # Should not raise exception, just log it
        await websocket_service.send_task_update(task_id, status)

        # Verify the error was handled (method didn't crash)
        assert True

    @pytest.mark.asyncio
    async def test_send_task_completion_exception_handling(self, websocket_service):
        """Test send_task_completion exception handling."""
        task_id = "task_123"

        with patch("agents.api.routes.websocket.send_task_completion") as mock_send:
            mock_send.side_effect = Exception("WebSocket connection lost")

            with pytest.raises(Exception, match="WebSocket connection lost"):
                await websocket_service.send_task_completion(task_id)

    @pytest.mark.asyncio
    async def test_send_batch_progress_exception_handling(self, websocket_service):
        """Test send_batch_progress exception handling."""
        batch_id = "batch_123"
        total = 10
        processed = 5

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            mock_send.side_effect = Exception("Broadcast failed")

            with pytest.raises(Exception, match="Broadcast failed"):
                await websocket_service.send_batch_progress(batch_id, total, processed)

    @pytest.mark.asyncio
    async def test_service_methods_are_async(self, websocket_service):
        """Test that all service methods are async."""
        # Verify methods are coroutines
        import inspect

        assert inspect.iscoroutinefunction(websocket_service.send_task_update)
        assert inspect.iscoroutinefunction(websocket_service.send_task_completion)
        assert inspect.iscoroutinefunction(websocket_service.send_batch_progress)

    @pytest.mark.asyncio
    async def test_send_task_update_with_float_progress(self, websocket_service):
        """Test send_task_update with float progress value."""
        task_id = "task_123"
        status = "processing"
        progress = 33.333333

        with patch("agents.api.routes.websocket.send_task_update") as mock_send:
            await websocket_service.send_task_update(task_id, status, progress)

            mock_send.assert_called_once_with(task_id, status, 33.333333, "")

    @pytest.mark.asyncio
    async def test_send_task_update_with_empty_message(self, websocket_service):
        """Test send_task_update with empty message."""
        task_id = "task_123"
        status = "processing"
        message = ""

        with patch("agents.api.routes.websocket.send_task_update") as mock_send:
            await websocket_service.send_task_update(
                task_id, status, progress=50, message=message
            )

            mock_send.assert_called_once_with(task_id, status, 50, "")

    @pytest.mark.asyncio
    async def test_send_batch_progress_zero_total(self, websocket_service):
        """Test send_batch_progress with zero total."""
        batch_id = "batch_123"
        total = 0
        processed = 0

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            await websocket_service.send_batch_progress(batch_id, total, processed)

            mock_send.assert_called_once_with(batch_id, 0, 0, "")

    @pytest.mark.asyncio
    async def test_send_batch_progress_progress_calculation(self, websocket_service):
        """Test send_batch_progress with various progress states."""
        batch_id = "batch_123"
        total = 100

        test_cases = [
            (0, 0),  # Start
            (25, 25),  # Quarter
            (50, 50),  # Half
            (75, 75),  # Three quarters
            (100, 100),  # Complete
        ]

        with patch("agents.api.routes.websocket.send_batch_progress") as mock_send:
            for processed, expected_processed in test_cases:
                await websocket_service.send_batch_progress(batch_id, total, processed)
                mock_send.assert_called_with(batch_id, total, expected_processed, "")
