import React from 'react';
import { useDashboardStats } from '@/hooks/useApi';
import StatsCard, { PaperIcon, TaskIcon, TranslatedIcon, ProcessingIcon } from './StatsCard';

export function DashboardStats() {
  const { data: stats, error, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="ml-4 flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">加载统计数据失败</p>
      </div>
    );
  }

  // Calculate stats
  const papersTotal = stats?.papers?.total || 0;
  const translatedPapers = stats?.papers?.byStatus?.translated || 0;
  const analyzedPapers = stats?.papers?.byStatus?.analyzed || 0;
  const tasksRunning = stats?.tasks?.running || 0;
  const tasksCompleted = stats?.tasks?.completed || 0;
  const recentlyAdded = stats?.papers?.recentlyAdded || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Papers */}
      <StatsCard
        title="论文总数"
        value={papersTotal}
        change={recentlyAdded > 0 ? { value: recentlyAdded, type: 'increase' } : undefined}
        icon={<PaperIcon />}
        href="/papers"
        color="blue"
      />

      {/* Translated Papers */}
      <StatsCard
        title="已翻译"
        value={translatedPapers}
        change={papersTotal > 0 ? {
          value: Math.round((translatedPapers / papersTotal) * 100),
          type: 'increase'
        } : undefined}
        icon={<TranslatedIcon />}
        href="/papers?status=translated"
        color="green"
      />

      {/* Analyzed Papers */}
      <StatsCard
        title="已分析"
        value={analyzedPapers}
        change={papersTotal > 0 ? {
          value: Math.round((analyzedPapers / papersTotal) * 100),
          type: 'increase'
        } : undefined}
        icon={<ProcessingIcon />}
        href="/papers?status=analyzed"
        color="purple"
      />

      {/* Running Tasks */}
      <StatsCard
        title="运行中任务"
        value={tasksRunning}
        icon={<TaskIcon />}
        href="/tasks"
        color="yellow"
      />
    </div>
  );
}

export default DashboardStats;