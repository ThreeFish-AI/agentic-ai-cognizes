'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePaperStore, useUIStore } from '@/store';
import PaperList from '@/components/papers/PaperList';
import UploadZone from '@/components/papers/UploadZone';

export default function PapersPage() {
  const router = useRouter();
  const { fetchPapers, processPaper, deletePaper, batchProcessPapers, batchDeletePapers } = usePaperStore();
  const { setModal, modals, addNotification } = useUIStore();

  // Fetch papers on component mount
  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Handle paper processing
  const handlePaperProcess = async (paperId: string, workflow: string) => {
    await processPaper(paperId, workflow);
  };

  // Handle paper deletion
  const handlePaperDelete = async (paperId: string) => {
    await deletePaper(paperId);
    addNotification({
      type: 'success',
      title: '删除成功',
      message: '论文已成功删除',
      duration: 3000,
    });
  };

  // Handle batch processing
  const handleBatchProcess = async (workflow: string) => {
    // This will be handled by PaperList component
  };

  // Handle paper selection
  const handlePaperSelect = (paperId: string) => {
    // Navigate to paper detail page
    router.push(`/papers/${paperId}`);
  };

  // Handle upload modal
  const handleUploadNew = () => {
    setModal('uploadPaper', true);
  };

  // Handle upload complete
  const handleUploadComplete = (taskIds: string[]) => {
    addNotification({
      type: 'success',
      title: '上传成功',
      message: `${taskIds.length} 个文件已上传，正在处理中...`,
      duration: 5000,
    });
    // Refresh papers list
    fetchPapers();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          论文管理
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          上传、管理和处理您的论文集合
        </p>
      </div>

      {/* Paper List */}
      <PaperList
        onPaperSelect={handlePaperSelect}
        onPaperProcess={handlePaperProcess}
        onPaperDelete={handlePaperDelete}
        onUploadNew={handleUploadNew}
      />

      {/* Upload Modal */}
      {modals.uploadPaper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  上传论文
                </h2>
                <button
                  onClick={() => setModal('uploadPaper', false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <UploadZone onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}