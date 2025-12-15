'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [...prev, newNotification]);

    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    // Expose the addNotification function globally for easy access
    (window as any).addNotification = addNotification;
    return () => {
      delete (window as any).addNotification;
    };
  }, []);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = (type: NotificationType) => {
    const baseStyles = 'p-4 rounded-lg shadow-lg border transition-all duration-300 ease-in-out';
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800`;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={getStyles(notification.type)}
          style={{
            animation: 'slideInRight 0.3s ease-out',
            minWidth: '300px',
            maxWidth: '500px'
          }}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1">
              {notification.title && (
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {notification.title}
                </h4>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Type declaration for global access
declare global {
  interface Window {
    addNotification?: (notification: Omit<Notification, 'id'>) => void;
  }
}