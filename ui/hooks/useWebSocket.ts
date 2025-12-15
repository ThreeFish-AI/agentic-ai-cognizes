import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';

// WebSocket message types
interface WSMessage {
  type: string;
  data?: any;
  task_id?: string;
  message?: string;
  timestamp?: string;
}

interface TaskUpdateMessage extends WSMessage {
  type: 'task_update';
  task_id: string;
  status: string;
  progress: number;
  message: string;
}

interface TaskCompletedMessage extends WSMessage {
  type: 'task_completed';
  task_id: string;
  result: any;
}

interface BatchProgressMessage extends WSMessage {
  type: 'batch_progress';
  batch_id: string;
  current: number;
  total: number;
  message: string;
}

interface PingMessage extends WSMessage {
  type: 'ping';
}

interface PongMessage extends WSMessage {
  type: 'pong';
}

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const {
    wsConnected,
    setWsConnected,
    updateTask,
    setTaskUpdate,
    clearTaskUpdate,
    addNotification,
  } = useAppStore();

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

  // Generate or retrieve client ID
  const getClientId = useCallback(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return clientIdRef.current;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const clientId = getClientId();
    const url = `${wsUrl}/ws/${clientId}`;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWsConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect
        if (event.code !== 1000) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        addNotification({
          type: 'error',
          message: 'WebSocket connection error',
        });
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      scheduleReconnect();
    }
  }, [wsUrl, setWsConnected, addNotification, getClientId]);

  // Schedule reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;

    console.log(`Scheduling reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  // Handle incoming messages
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'pong':
        // Ping response received
        break;

      case 'task_update':
        const updateMsg = message as TaskUpdateMessage;
        updateTask(updateMsg.task_id, {
          status: updateMsg.status,
          progress: updateMsg.progress,
          message: updateMsg.message,
        });
        setTaskUpdate(updateMsg.task_id, {
          status: updateMsg.status,
          progress: updateMsg.progress,
          message: updateMsg.message,
        });
        break;

      case 'task_completed':
        const completedMsg = message as TaskCompletedMessage;
        updateTask(completedMsg.task_id, {
          status: 'completed',
          progress: 100,
          message: 'Task completed successfully',
        });
        clearTaskUpdate(completedMsg.task_id);
        addNotification({
          type: 'success',
          message: `Task ${completedMsg.task_id} completed successfully`,
        });
        break;

      case 'batch_progress':
        const batchMsg = message as BatchProgressMessage;
        addNotification({
          type: 'info',
          message: `Batch progress: ${batchMsg.current}/${batchMsg.total} - ${batchMsg.message}`,
        });
        break;

      case 'error':
        addNotification({
          type: 'error',
          message: message.message || 'WebSocket error occurred',
        });
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [updateTask, setTaskUpdate, clearTaskUpdate, addNotification]);

  // Subscribe to task updates
  const subscribe = useCallback((taskId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        task_id: taskId,
      }));
    }
  }, []);

  // Unsubscribe from task updates
  const unsubscribe = useCallback((taskId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        task_id: taskId,
      }));
    }
  }, []);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    setWsConnected(false);
  }, [setWsConnected]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected: wsConnected,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
};