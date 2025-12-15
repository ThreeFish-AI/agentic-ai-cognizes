'use client';

import { useEffect, ReactNode } from 'react';
import { useAppStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const { theme, addNotification, clearNotifications } = useAppStore();
  const { connected } = useWebSocket();

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;

    // Remove previous theme classes
    root.classList.remove('light', 'dark');

    // Apply new theme
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Auto-clear old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      useAppStore.setState((state) => ({
        notifications: state.notifications.filter(
          (n) => n.timestamp > fiveMinutesAgo
        ),
      }));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Show connection status notification
  useEffect(() => {
    if (!connected) {
      addNotification({
        type: 'warning',
        message: 'WebSocket disconnected. Real-time updates unavailable.',
      });
    } else {
      addNotification({
        type: 'success',
        message: 'WebSocket connected. Real-time updates enabled.',
      });
    }
  }, [connected, addNotification]);

  return <>{children}</>;
}