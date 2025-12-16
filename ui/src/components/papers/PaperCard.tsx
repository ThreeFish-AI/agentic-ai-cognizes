import React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { usePaperStore, useUIStore } from '@/store';
import type { Paper } from '@/types';

interface PaperCardProps {
  paper: Paper;
  onSelect?: (id: string) => void;
  onProcess?: (id: string, workflow: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const statusColors = {
  uploaded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  translated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  analyzed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  deleted: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const statusLabels = {
  uploaded: '已上传',
  processing: '处理中',
  translated: '已翻译',
  analyzed: '已分析',
  failed: '失败',
  deleted: '已删除',
};

const categoryLabels = {
  'llm-agents': 'LLM Agents',
  'context-engineering': 'Context Engineering',
  reasoning: 'Reasoning',
  'tool-use': 'Tool Use',
  planning: 'Planning',
  memory: 'Memory',
  'multi-agent': 'Multi-Agent',
  evaluation: 'Evaluation',
  other: '其他',
};

export function PaperCard({
  paper,
  onSelect,
  onProcess,
  onDelete,
  className = '',
}: PaperCardProps) {
  const { selectedPapers, togglePaperSelection } = usePaperStore();
  const { addNotification } = useUIStore();

  const handleSelect = () => {
    togglePaperSelection(paper.id);
    onSelect?.(paper.id);
  };

  const handleProcess = (workflow: string) => {
    if (paper.status === 'processing') {
      addNotification({
        type: 'warning',
        title: '提示',
        message: '该论文正在处理中，请等待完成',
        duration: 3000,
      });
      return;
    }
    onProcess?.(paper.id, workflow);
  };

  const handleDelete = () => {
    if (paper.status === 'processing') {
      addNotification({
        type: 'error',
        title: '无法删除',
        message: '论文正在处理中，无法删除',
        duration: 3000,
      });
      return;
    }
    if (window.confirm('确定要删除这篇论文吗？此操作不可恢复。')) {
      onDelete?.(paper.id);
    }
  };

  const isSelected = selectedPapers.has(paper.id);

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200
        border ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}
        ${className}
      `}
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Checkbox */}
          <div className="flex items-start space-x-3 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelect}
              className="mt-1 w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div className="flex-1 min-w-0">
              {/* Title */}
              <Link
                href={`/papers/${paper.id}`}
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2"
              >
                {paper.translation?.title || paper.title}
              </Link>

              {/* Authors */}
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {paper.authors.slice(0, 3).join(', ')}
                {paper.authors.length > 3 && ` 等 ${paper.authors.length} 位作者`}
              </p>

              {/* Category and Status */}
              <div className="flex items-center space-x-2 mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {categoryLabels[paper.category]}
                </span>
                <span
                  className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${statusColors[paper.status]}
                  `}
                >
                  {statusLabels[paper.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Abstract */}
        {(paper.abstract || paper.translation?.abstract) && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {paper.translation?.abstract || paper.abstract}
          </p>
        )}

        {/* Metadata */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              {(paper.fileSize / 1024 / 1024).toFixed(2)} MB
            </span>
            {paper.metadata?.year && (
              <span>{paper.metadata.year}</span>
            )}
            {paper.metadata?.journal && (
              <span>{paper.metadata.journal}</span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{format(new Date(paper.uploadedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* View Button */}
            <Link
              href={`/papers/${paper.id}`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              查看
            </Link>

            {/* Process Button */}
            {paper.status !== 'processing' && paper.status !== 'deleted' && (
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-500 border border-transparent rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => document.getElementById(`process-menu-${paper.id}`)?.classList.toggle('hidden')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  处理
                </button>

                {/* Process Dropdown Menu */}
                <div
                  id={`process-menu-${paper.id}`}
                  className="hidden origin-top-right absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10"
                >
                  <div className="py-1">
                    {!paper.translation && (
                      <button
                        onClick={() => handleProcess('translate')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        翻译
                      </button>
                    )}
                    {!paper.analysis && (
                      <button
                        onClick={() => handleProcess('analyze')}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        分析
                      </button>
                    )}
                    <button
                      onClick={() => handleProcess('index')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      建立索引
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delete Button */}
          {paper.status !== 'deleted' && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaperCard;