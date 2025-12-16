import React, { useState, useMemo } from 'react';
import { usePaperStore, useUIStore } from '@/store';
import PaperCard from './PaperCard';
import type { Paper, PaperCategory, PaperStatus, SortOrder } from '@/types';

interface PaperListProps {
  papers?: any[];
  onPaperSelect?: (id: string) => void;
  onPaperProcess?: (id: string, workflow: string) => void;
  onPaperDelete?: (id: string) => void;
  onUploadNew?: () => void;
  className?: string;
}

const categories: { value: PaperCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部分类' },
  { value: 'llm-agents', label: 'LLM Agents' },
  { value: 'context-engineering', label: 'Context Engineering' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'tool-use', label: 'Tool Use' },
  { value: 'planning', label: 'Planning' },
  { value: 'memory', label: 'Memory' },
  { value: 'multi-agent', label: 'Multi-Agent' },
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'other', label: '其他' },
];

const statuses: { value: PaperStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'uploaded', label: '已上传' },
  { value: 'processing', label: '处理中' },
  { value: 'translated', label: '已翻译' },
  { value: 'analyzed', label: '已分析' },
  { value: 'failed', label: '失败' },
];

const sortOptions = [
  { value: 'uploadedAt', label: '上传时间' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'title', label: '标题' },
];

export function PaperList({
  papers: externalPapers,
  onPaperSelect,
  onPaperProcess,
  onPaperDelete,
  onUploadNew,
  className = '',
}: PaperListProps) {
  const {
    papers: storePapers,
    filters,
    selectedPapers,
    loading,
    error,
    setFilters,
    selectAllPapers,
    clearPaperSelection,
    fetchPapers,
    batchProcessPapers,
    batchDeletePapers,
  } = usePaperStore();

  const { addNotification, setModal } = useUIStore();

  // Use external papers if provided, otherwise use store papers
  const papers = externalPapers || storePapers;

  // Local state for filters
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  const [categoryFilter, setCategoryFilter] = useState(filters.category || 'all');
  const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
  const [sortBy, setSortBy] = useState(filters.sortBy || 'uploadedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>(filters.sortOrder || 'desc');

  // Filtered and sorted papers
  const filteredPapers = useMemo(() => {
    let filtered = papers.filter((paper) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = paper.title.toLowerCase();
        const authors = paper.authors.join(' ').toLowerCase();
        const abstract = (paper.abstract || '').toLowerCase();
        const translatedTitle = (paper.translation?.title || '').toLowerCase();
        const translatedAbstract = (paper.translation?.abstract || '').toLowerCase();

        if (
          !title.includes(query) &&
          !translatedTitle.includes(query) &&
          !authors.includes(query) &&
          !abstract.includes(query) &&
          !translatedAbstract.includes(query)
        ) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && paper.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && paper.status !== statusFilter) {
        return false;
      }

      return true;
    });

    // Sort papers
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Paper];
      let bValue: any = b[sortBy as keyof Paper];

      // For translated title sort, use translated title if available
      if (sortBy === 'title' && a.translation?.title) {
        aValue = a.translation.title;
      }
      if (sortBy === 'title' && b.translation?.title) {
        bValue = b.translation.title;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      // Handle date comparison
      if (aValue instanceof Date || bValue instanceof Date) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [papers, searchQuery, categoryFilter, statusFilter, sortBy, sortOrder]);

  // Update filters when they change
  React.useEffect(() => {
    const newFilters = {
      search: searchQuery,
      category: categoryFilter,
      status: statusFilter,
      sortBy,
      sortOrder,
    };

    // Only update if filters actually changed
    const hasChanged = Object.keys(newFilters).some(
      (key) => newFilters[key as keyof typeof newFilters] !== filters[key as keyof typeof filters]
    );

    if (hasChanged) {
      setFilters(newFilters);
    }
  }, [searchQuery, categoryFilter, statusFilter, sortBy, sortOrder, setFilters, filters]);

  // Handle bulk actions
  const handleSelectAll = () => {
    if (selectedPapers.size === filteredPapers.length) {
      clearPaperSelection();
    } else {
      selectAllPapers();
    }
  };

  const handleBulkProcess = async (workflow: string) => {
    if (selectedPapers.size === 0) {
      addNotification({
        type: 'warning',
        title: '提示',
        message: '请先选择要处理的论文',
        duration: 3000,
      });
      return;
    }

    try {
      await batchProcessPapers(Array.from(selectedPapers), workflow);
      addNotification({
        type: 'success',
        title: '批量处理已启动',
        message: `已提交 ${selectedPapers.size} 篇论文进行${workflow === 'translate' ? '翻译' : '分析'}`,
        duration: 5000,
      });
      clearPaperSelection();
    } catch (error) {
      addNotification({
        type: 'error',
        title: '批量处理失败',
        message: error instanceof Error ? error.message : '未知错误',
        duration: 5000,
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPapers.size === 0) {
      addNotification({
        type: 'warning',
        title: '提示',
        message: '请先选择要删除的论文',
        duration: 3000,
      });
      return;
    }

    if (
      window.confirm(
        `确定要删除选中的 ${selectedPapers.size} 篇论文吗？此操作不可恢复。`
      )
    ) {
      try {
        await batchDeletePapers(Array.from(selectedPapers));
        addNotification({
          type: 'success',
          title: '删除成功',
          message: `已删除 ${selectedPapers.size} 篇论文`,
          duration: 5000,
        });
        clearPaperSelection();
      } catch (error) {
        addNotification({
          type: 'error',
          title: '删除失败',
          message: error instanceof Error ? error.message : '未知错误',
          duration: 5000,
        });
      }
    }
  };

  const openUploadModal = () => {
    setModal('uploadPaper', true);
    onUploadNew?.();
  };

  return (
    <div className={`paper-list ${className}`}>
      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索论文标题、作者或摘要..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            onClick={openUploadModal}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            上传论文
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          {/* Sort Controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                按{option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          >
            {sortOrder === 'asc' ? '升序' : '降序'}
          </button>

          {/* Result Count */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            共 {filteredPapers.length} 篇论文
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedPapers.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-blue-800 dark:text-blue-200">
                已选择 {selectedPapers.size} 篇论文
              </span>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {selectedPapers.size === filteredPapers.length ? '取消全选' : '全选当前页'}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkProcess('translate')}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                批量翻译
              </button>
              <button
                onClick={() => handleBulkProcess('analyze')}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                批量分析
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                批量删除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paper Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 h-64 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">加载失败: {error}</p>
          <button
            onClick={() => fetchPapers()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">没有找到匹配的论文</p>
          <button
            onClick={openUploadModal}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            上传第一篇论文
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onSelect={onPaperSelect}
              onProcess={onPaperProcess}
              onDelete={onPaperDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PaperList;