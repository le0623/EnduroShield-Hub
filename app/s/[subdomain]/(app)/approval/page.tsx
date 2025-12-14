"use client";

import { useState, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  Check,
  X,
  FileText,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import { formatFileSize } from "@/lib/s3";

interface Document {
  id: string;
  name: string;
  originalName: string;
  description?: string;
  tags: string[];
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: {
    id: string;
    name?: string;
    email: string;
    profileImageUrl?: string;
  };
  createdAt: string;
}

interface Stats {
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
}

export default function DocumentApproval() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, reviewing: 0, approved: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);

        // Calculate stats
        const pending = data.documents?.filter((doc: Document) => doc.status === 'PENDING').length || 0;
        const approved = data.documents?.filter((doc: Document) => doc.status === 'APPROVED').length || 0;
        const rejected = data.documents?.filter((doc: Document) => doc.status === 'REJECTED').length || 0;
        setStats({ pending, reviewing: 0, approved, rejected });
      } else {
        setError('Failed to load documents');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (documentId: string) => {
    try {
      setIsProcessing(documentId);
      const response = await fetch(`/api/documents/${documentId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchDocuments();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to approve document');
      }
    } catch (err) {
      alert('An error occurred while approving the document');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (documentId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      setIsProcessing(documentId);
      const response = await fetch(`/api/documents/${documentId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        fetchDocuments();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to reject document');
      }
    } catch (err) {
      alert('An error occurred while rejecting the document');
    } finally {
      setIsProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      'PENDING': 'bg-yellow-500',
      'APPROVED': 'bg-green-500',
      'REJECTED': 'bg-red-500',
    };
    return (
      <span className={`px-3 py-1 inline-block text-xs font-semibold text-white rounded-full ${classes[status as keyof typeof classes]}`}>
        {status}
      </span>
    );
  };

  // Filter to show only pending documents by default
  const pendingDocuments = documents.filter(doc => doc.status === 'PENDING');

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-y-6">
        <div className="flex lg:flex-row flex-col gap-6 w-full">
          {/* Left Section */}
          <div className="lg:w-3/5 w-full">
            <div className="h-full p-5 lg:pb-0 relative">
              {/* Background gradient blobs */}
              <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
                <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
                <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
                <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
              </div>

              {/* Content */}
              <div className="relative">
                <div className="flex flex-wrap gap-y-5">
                  <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                    <div className="inline-flex items-center justify-center w-40 h-40 bg-gray-100 rounded-full">
                      <FileText className="w-20 h-20 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex flex-col items-start justify-center space-y-5 md:w-1/2 md:order-first">
                    <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                      Document Approval
                    </h2>
                    <p>Review and approve submitted documents</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Stats */}
          <div className="lg:w-2/5 w-full">
            <div className="rounded-xl border light-border bg-white h-full p-4">
              <ul className="flex flex-wrap justify-between items-center sm:[&>*:nth-of-type(2n+1)]:border-r sm:[&>*:not(:nth-last-child(-n+2))]:border-b [&>*]:border-gray-200">
                {/* Pending */}
                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Pending
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {stats.pending}
                    </span>
                    <span className="text-sm text-green-600 font-bold flex items-center gap-1">
                      <ArrowUp size={16} /> 0%
                    </span>
                  </div>
                </li>

                {/* Reviewing */}
                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Approved
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {stats.approved}
                    </span>
                    <span className="text-sm text-green-600 font-bold flex items-center gap-1">
                      <ArrowUp size={16} /> 0%
                    </span>
                  </div>
                </li>

                {/* Approved */}
                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Rejected
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {stats.rejected}
                    </span>
                    <span className="text-sm text-red-600 font-bold flex items-center gap-1">
                      <ArrowDown size={16} /> 0%
                    </span>
                  </div>
                </li>

                {/* Total */}
                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Total
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {stats.pending + stats.approved + stats.rejected}
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="w-full">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="mb-0 text-lg font-semibold text-gray-950">
                    Documents for Review
                  </h3>
                  <span className="text-sm text-secondary-400">
                    Showing {pendingDocuments.length} pending {pendingDocuments.length === 1 ? 'document' : 'documents'}
                  </span>
                </div>
                <button onClick={fetchDocuments} className="btn btn-secondary btn-sm">
                  Refresh
                </button>
              </div>

              <div className="panel-body w-full">
                <div className="overflow-x-auto">
                  {isLoading ? (
                    <div className="flex justify-center py-10">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-10 text-red-600">{error}</div>
                  ) : pendingDocuments.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No pending documents to review</div>
                  ) : (
                    <table className="table table-row-hover w-full">
                      <thead className="border-b border-gray-200">
                        <tr>
                          <th>Document</th>
                          <th>Submitted By</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th className="text-center">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200">
                        {pendingDocuments.map((doc) => (
                          <tr key={doc.id}>
                            <td>
                              <div className="flex items-start gap-2">
                                <div className="size-10 flex justify-center items-center rounded-full border border-gray-200 bg-gray-100">
                                  <FileText size={20} />
                                </div>
                                <div className="flex flex-col flex-start gap-y-1">
                                  <span className="text-sm font-semibold">
                                    {doc.name}
                                  </span>
                                  <span className="text-xs font-medium">
                                    {formatFileSize(doc.fileSize)}
                                  </span>
                                  {doc.tags && doc.tags.length > 0 && (
                                    <ul className="inline-flex flex-wrap items-center gap-2 mt-1">
                                      {doc.tags.slice(0, 3).map((tag) => (
                                        <li key={tag}>
                                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full border border-gray-200 bg-gray-50">
                                            {tag}
                                          </span>
                                        </li>
                                      ))}
                                      {doc.tags.length > 3 && (
                                        <li className="text-xs text-gray-500">+{doc.tags.length - 3}</li>
                                      )}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="text-nowrap">
                              <div className="flex items-center gap-1">
                                {doc.submittedBy.profileImageUrl ? (
                                  <Image
                                    src={doc.submittedBy.profileImageUrl}
                                    alt="Author"
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                  />
                                ) : (
                                  <UserCircle className="w-6 h-6 text-gray-400" />
                                )}
                                <span className="font-semibold">
                                  {doc.submittedBy.name || doc.submittedBy.email}
                                </span>
                              </div>
                            </td>
                            <td className="text-nowrap">
                              <div className="flex gap-1">
                                <span className="px-3 py-0.5 text-xs font-semibold rounded-full border border-gray-200 bg-gray-50">
                                  V{doc.version}
                                </span>
                              </div>
                            </td>
                            <td>
                              {getStatusBadge(doc.status)}
                            </td>
                            <td className="text-nowrap">
                              <span className="font-medium">
                                {formatDate(doc.createdAt)}
                              </span>
                            </td>
                            <td>
                              <div className="flex justify-center items-center gap-1">
                                <button
                                  className="btn btn-primary-light !size-8 !p-0 !rounded-full !flex !justify-center !items-center"
                                  onClick={() => window.open(doc.fileUrl, '_blank')}
                                  disabled={isProcessing === doc.id}
                                >
                                  <Image src="/images/icons/eye.svg" alt="View" width={16} height={16} />
                                </button>
                                <button
                                  className="btn btn-success-light !size-8 !p-0 !rounded-full !flex !justify-center !items-center"
                                  onClick={() => handleApprove(doc.id)}
                                  disabled={isProcessing === doc.id}
                                >
                                  {isProcessing === doc.id ? (
                                    <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Image src="/images/icons/check.svg" alt="Approve" width={12} height={12} />
                                  )}
                                </button>
                                <button
                                  className="btn btn-danger-light !size-8 !p-0 !rounded-full !flex !justify-center !items-center"
                                  onClick={() => handleReject(doc.id)}
                                  disabled={isProcessing === doc.id}
                                >
                                  {isProcessing === doc.id ? (
                                    <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Image src="/images/icons/close.svg" alt="Reject" width={16} height={16} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
