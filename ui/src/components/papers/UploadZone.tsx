import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUIStore } from '@/store';
import { usePaperStore } from '@/store';
import type { PaperCategory } from '@/types';

interface UploadZoneProps {
  onUploadComplete?: (taskIds: string[]) => void;
  className?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = ['application/pdf'];

const categories: { value: PaperCategory; label: string }[] = [
  { value: 'llm-agents', label: 'LLM Agents' },
  { value: 'context-engineering', label: 'Context Engineering' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'tool-use', label: 'Tool Use' },
  { value: 'planning', label: 'Planning' },
  { value: 'memory', label: 'Memory' },
  { value: 'multi-agent', label: 'Multi-Agent' },
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'other', label: 'Other' },
];

export function UploadZone({ onUploadComplete, className = '' }: UploadZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<PaperCategory>('llm-agents');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const { addNotification, setModal } = useUIStore();
  const { uploadPaper } = usePaperStore();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      // 检查文件大小
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );
      if (oversizedFiles.length > 0) {
        addNotification({
          type: 'error',
          title: '文件过大',
          message: `文件大小不能超过 50MB`,
          duration: 5000,
        });
        return;
      }

      // 检查文件格式
      const invalidFiles = rejectedFiles.filter(
        (file) => file.errors.some((e: any) => e.code === 'file-invalid-type')
      );
      if (invalidFiles.length > 0) {
        addNotification({
          type: 'error',
          title: '文件格式不支持',
          message: '仅支持 PDF 格式文件',
          duration: 5000,
        });
        return;
      }

      setFiles(acceptedFiles);
    },
    [addNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    const taskIds: string[] = [];

    try {
      for (const file of files) {
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));

        const taskId = await uploadPaper(file, category, {
          originalName: file.name,
          size: file.size,
        });

        taskIds.push(taskId);
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 100,
        }));
      }

      addNotification({
        type: 'success',
        title: '上传成功',
        message: `成功上传 ${files.length} 个文件，正在处理中...`,
        duration: 5000,
      });

      setFiles([]);
      setModal('uploadPaper', false);

      if (onUploadComplete) {
        onUploadComplete(taskIds);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '上传失败',
        message: error instanceof Error ? error.message : '未知错误',
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`upload-zone p-6 ${className}`}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {isDragActive ? '放开以上传文件' : '拖拽文件到这里，或点击选择文件'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              支持 PDF 格式，单个文件最大 50MB
            </p>
          </div>
        </div>
      </div>

      {/* Category Selection */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          论文分类
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PaperCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        >
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            待上传文件 ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadProgress[file.name] !== undefined && (
                    <div className="flex items-center">
                      <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[file.name]}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {uploadProgress[file.name]}%
                      </span>
                    </div>
                  )}
                  {!isUploading && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => setFiles([])}
            disabled={isUploading}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            清空
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isUploading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span>{isUploading ? '上传中...' : '开始上传'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UploadZone;