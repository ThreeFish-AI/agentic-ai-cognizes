import React from 'react';
import Link from 'next/link';
import { useUIStore } from '@/store';
import StatsCard from './StatsCard';
import { PaperIcon, TaskIcon, TranslatedIcon, ProcessingIcon } from './StatsCard';

export function QuickActions() {
  const { setModal, addNotification } = useUIStore();

  const handleUploadPaper = () => {
    setModal('uploadPaper', true);
  };

  const handleSearchPapers = () => {
    // Navigate to search page
    window.location.href = '/search';
  };

  const actions = [
    {
      title: '上传论文',
      description: '添加新的论文到库中',
      icon: <PaperIcon className="text-blue-500" />,
      onClick: handleUploadPaper,
      color: 'blue' as const,
    },
    {
      title: '搜索论文',
      description: '在论文库中查找内容',
      icon: <ProcessingIcon className="text-green-500" />,
      onClick: handleSearchPapers,
      color: 'green' as const,
    },
    {
      title: '查看任务',
      description: '监控处理进度',
      icon: <TaskIcon className="text-purple-500" />,
      href: '/tasks',
      color: 'purple' as const,
    },
    {
      title: '管理论文',
      description: '浏览和管理所有论文',
      icon: <TranslatedIcon className="text-yellow-500" />,
      href: '/papers',
      color: 'yellow' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, index) => {
        if (action.href) {
          return (
            <Link
              key={index}
              href={action.href}
              className={`
                bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6
                hover:shadow-md transition-all duration-200
              `}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div
                    className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900"
                  >
                    {action.icon}
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {action.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        }

        return (
          <button
            key={index}
            onClick={action.onClick}
            className={`
              bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6
              hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105 text-left
            `}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900"
                >
                  {action.icon}
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {action.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {action.description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default QuickActions;