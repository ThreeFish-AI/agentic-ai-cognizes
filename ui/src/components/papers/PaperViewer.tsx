import React, { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { usePaperStore, useUIStore } from '@/store';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Paper } from '@/types';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PaperViewerProps {
  paper: Paper;
  className?: string;
}

export function PaperViewer({ paper, className = '' }: PaperViewerProps) {
  const [activeTab, setActiveTab] = useState<'original' | 'translation' | 'analysis'>('original');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);

  const { updatePaper, processPaper } = usePaperStore();
  const { addNotification } = useUIStore();

  // Ref for PDF container
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // PDF load success handler
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  }, []);

  // Change page
  const changePage = useCallback((offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      return Math.max(1, Math.min(newPageNumber || 1, numPages || 1));
    });
  }, [numPages]);

  // Handle process action
  const handleProcess = async (workflow: string) => {
    if (paper.status === 'processing') {
      addNotification({
        type: 'warning',
        title: '提示',
        message: '论文正在处理中，请稍候',
        duration: 3000,
      });
      return;
    }

    try {
      await processPaper(paper.id, workflow);
      addNotification({
        type: 'success',
        title: '处理已启动',
        message: `${workflow === 'translate' ? '翻译' : '分析'}任务已添加到队列`,
        duration: 5000,
      });

      // Update paper status in store
      updatePaper(paper.id, { status: 'processing' });
    } catch (error) {
      addNotification({
        type: 'error',
        title: '处理失败',
        message: error instanceof Error ? error.message : '未知错误',
        duration: 5000,
      });
    }
  };

  // Zoom controls
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  // Markdown components
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-lg"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-medium mt-4 mb-2">{children}</h3>
    ),
    p: ({ children }: any) => (
      <p className="mb-4 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4">
        {children}
      </blockquote>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
        {children}
      </td>
    ),
  };

  return (
    <div className={`paper-viewer ${className}`}>
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        {/* Title and Authors */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {activeTab === 'translation' && paper.translation?.title
            ? paper.translation.title
            : paper.title}
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
          {paper.authors.join(', ')}
        </p>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
          {paper.metadata?.year && (
            <span>发表年份: {paper.metadata.year}</span>
          )}
          {paper.metadata?.journal && (
            <span>期刊: {paper.metadata.journal}</span>
          )}
          {paper.metadata?.pages && (
            <span>页码: {paper.metadata.pages}</span>
          )}
          <span>上传时间: {format(new Date(paper.uploadedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
          <span>文件大小: {(paper.fileSize / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('original')}
            className={`
              py-2 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'original'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            原文
          </button>
          <button
            onClick={() => setActiveTab('translation')}
            disabled={!paper.translation}
            className={`
              py-2 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'translation'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
              ${!paper.translation ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            翻译
            {!paper.translation && paper.status !== 'processing' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleProcess('translate');
                }}
                className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
              >
                生成
              </button>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            disabled={!paper.analysis}
            className={`
              py-2 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
              ${!paper.analysis ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            分析
            {!paper.analysis && paper.status !== 'processing' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleProcess('analyze');
                }}
                className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600"
              >
                生成
              </button>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-screen">
        {activeTab === 'original' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                PDF 原文
              </h2>
              {paper.filePath && (
                <a
                  href={paper.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 text-sm"
                >
                  在新窗口打开
                </a>
              )}
            </div>

            {/* PDF Viewer Controls */}
            <div className="mb-4 flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => changePage(-1)}
                  disabled={pageNumber <= 1}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-sm">
                  第 {pageNumber} 页，共 {numPages || 0} 页
                </span>
                <button
                  onClick={() => changePage(1)}
                  disabled={pageNumber >= (numPages || 0)}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={zoomOut}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  缩小
                </button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <button
                  onClick={zoomIn}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  放大
                </button>
              </div>
            </div>

            {/* PDF Document */}
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto">
              {isLoading && (
                <div className="flex items-center justify-center h-96">
                  <div className="text-gray-500">加载 PDF 中...</div>
                </div>
              )}
              <Document
                file={paper.filePath}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="text-center p-8">加载 PDF 中...</div>}
                error={<div className="text-center p-8 text-red-500">PDF 加载失败</div>}
                renderMode="canvas"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  className="mx-auto"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
          </div>
        )}

        {activeTab === 'translation' && paper.translation && (
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              中文翻译
            </h2>
            {paper.translation.abstract && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">摘要</h3>
                <ReactMarkdown components={markdownComponents}>
                  {paper.translation.abstract}
                </ReactMarkdown>
              </div>
            )}
            <ReactMarkdown components={markdownComponents}>
              {paper.translation.content}
            </ReactMarkdown>
          </div>
        )}

        {activeTab === 'analysis' && paper.analysis && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              论文分析
            </h2>

            {/* Summary */}
            {paper.analysis.summary && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">内容摘要</h3>
                <ReactMarkdown components={markdownComponents}>
                  {paper.analysis.summary}
                </ReactMarkdown>
              </div>
            )}

            {/* Key Points */}
            {paper.analysis.keyPoints && paper.analysis.keyPoints.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">关键要点</h3>
                <ul className="space-y-2">
                  {paper.analysis.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start">
                      <span className="inline-block w-6 h-6 bg-green-500 text-white rounded-full text-sm text-center mr-2 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Insights */}
            {paper.analysis.insights && paper.analysis.insights.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">深入洞察</h3>
                <ul className="space-y-2">
                  {paper.analysis.insights.map((insight, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty States */}
        {activeTab === 'translation' && !paper.translation && (
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
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              暂无翻译内容
            </p>
            <button
              onClick={() => handleProcess('translate')}
              disabled={paper.status === 'processing'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              生成翻译
            </button>
          </div>
        )}

        {activeTab === 'analysis' && !paper.analysis && (
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              暂无分析内容
            </p>
            <button
              onClick={() => handleProcess('analyze')}
              disabled={paper.status === 'processing'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              生成分析
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaperViewer;