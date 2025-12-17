"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Calendar, User, Tag } from 'lucide-react';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  description: string | null;
  categories: Array<{ id: string; name: string }>;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  version: number | null;
  submittedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export default function KnowledgeBaseArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params?.articleId as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  const fetchArticle = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`/api/knowledge-base/${articleId}`);
      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to access this article');
        } else if (response.status === 404) {
          setError('Article not found');
        } else {
          setError('Failed to load article');
        }
        return;
      }

      const data = await response.json();
      setArticle(data.article);
    } catch (err) {
      setError('Failed to load article');
      console.error('Error fetching article:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!article?.fileUrl) return;

    try {
      setIsDownloading(true);
      const response = await fetch(`/api/documents/${articleId}/download`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const data = await response.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Article not found'}</p>
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Knowledge Base
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
            {article.description && (
              <p className="text-gray-600 text-lg mb-4">{article.description}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {article.submittedBy && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    {article.submittedBy.name || article.submittedBy.email}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Updated {formatDate(article.updatedAt)}</span>
              </div>
              {article.fileSize && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{formatFileSize(article.fileSize)}</span>
                </div>
              )}
              {article.version && (
                <span className="px-2 py-1 bg-gray-100 rounded">v{article.version}</span>
              )}
            </div>

            {/* Categories */}
            {article.categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Tag className="w-4 h-4 text-gray-600" />
                {article.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/knowledge-base?category=${encodeURIComponent(cat.name)}`}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {article.fileUrl && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
          )}
        </div>
      </div>

      {/* Article Content */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg p-6">
        {article.fileUrl ? (
          <div className="space-y-4">
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{article.fileName || 'Document'}</h3>
              <p className="text-gray-600 mb-4">
                {article.mimeType && (
                  <span className="text-sm">Type: {article.mimeType}</span>
                )}
              </p>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? 'Downloading...' : 'Download Document'}
              </button>
            </div>

            {article.description && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{article.description}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No file available for this article</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex items-center justify-between pt-6 border-t border-gray-200">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <span>Ask AI about this article</span>
        </Link>
        <Link
          href="/knowledge-base"
          className="text-gray-600 hover:text-gray-900"
        >
          Browse more articles
        </Link>
      </div>
    </div>
  );
}
