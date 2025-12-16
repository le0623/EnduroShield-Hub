"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { formatFileSize } from "@/lib/s3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, History, Check, Clock, X as XIcon } from "lucide-react";

interface AccessTag {
  id: string;
  name: string;
}

interface Version {
  id: string;
  versionNumber: number;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  changeNotes?: string;
  uploadedBy: {
    id: string;
    name?: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    name?: string;
    email: string;
  };
  createdAt: string;
  approvedAt?: string;
  isActive: boolean;
}

interface Document {
  id: string;
  name: string;
  description?: string;
  accessTags: AccessTag[];
  originalName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  latestVersionNumber: number;
  activeVersionNumber: number | null;
  hasActiveVersion: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: {
    id: string;
    name?: string;
    email: string;
    profileImageUrl?: string;
  };
  approvedBy?: {
    id: string;
    name?: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export default function DocumentPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, approved: 0, pending: 0, rejected: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedAccessTagIds, setSelectedAccessTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<AccessTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  
  // Version management state
  const [versionDialogDoc, setVersionDialogDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [versionError, setVersionError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter]);

  useEffect(() => {
    if (isEditDialogOpen) {
      fetchTags();
    }
  }, [isEditDialogOpen]);

  useEffect(() => {
    if (versionDialogDoc) {
      fetchVersions(versionDialogDoc.id);
    }
  }, [versionDialogDoc]);

  const fetchTags = async () => {
    try {
      setIsLoadingTags(true);
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);

      const response = await fetch(`/api/documents?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);

        // Calculate stats
        const total = data.documents?.length || 0;
        const approved = data.documents?.filter((doc: Document) => doc.status === 'APPROVED').length || 0;
        const pending = data.documents?.filter((doc: Document) => doc.status === 'PENDING').length || 0;
        const rejected = data.documents?.filter((doc: Document) => doc.status === 'REJECTED').length || 0;
        setStats({ total, approved, pending, rejected });
      } else {
        setError('Failed to load documents');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVersions = async (documentId: string) => {
    try {
      setIsLoadingVersions(true);
      setVersionError("");
      const response = await fetch(`/api/documents/${documentId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      } else {
        setVersionError("Failed to load versions");
      }
    } catch (err) {
      setVersionError("An error occurred loading versions");
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleSearch = () => {
    fetchDocuments();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc);
    setEditName(doc.name);
    setEditDescription(doc.description || "");
    setSelectedAccessTagIds(doc.accessTags.map(tag => tag.id));
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDocument || !editName.trim()) {
      setEditError("Document name is required");
      return;
    }

    setIsSaving(true);
    setEditError("");

    try {
      // Update document metadata
      const updateResponse = await fetch(`/api/documents/${editingDocument.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update document");
      }

      // Update access tags
      const tagsResponse = await fetch(`/api/documents/${editingDocument.id}/tags`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tagIds: selectedAccessTagIds,
        }),
      });

      if (!tagsResponse.ok) {
        const errorData = await tagsResponse.json();
        throw new Error(errorData.error || "Failed to update access tags");
      }

      // Refresh documents list
      await fetchDocuments();
      setIsEditDialogOpen(false);
      setEditingDocument(null);
      setEditError("");
      alert("Document updated successfully!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update document";
      setEditError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmDoc) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/documents/${deleteConfirmDoc.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete document");
      }

      // Refresh documents list
      await fetchDocuments();
      setDeleteConfirmDoc(null);
      setDeleteError("");
      alert("Document deleted successfully!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete document";
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAccessTag = (tagId: string) => {
    setSelectedAccessTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Version management functions
  const handleVersionDialog = (doc: Document) => {
    setVersionDialogDoc(doc);
    setNewVersionFile(null);
    setChangeNotes("");
    setVersionError("");
  };

  const handleUploadNewVersion = async () => {
    if (!versionDialogDoc || !newVersionFile) {
      setVersionError("Please select a file");
      return;
    }

    setIsUploadingVersion(true);
    setVersionError("");

    try {
      const formData = new FormData();
      formData.append("file", newVersionFile);
      if (changeNotes.trim()) {
        formData.append("changeNotes", changeNotes.trim());
      }

      const response = await fetch(`/api/documents/${versionDialogDoc.id}/versions`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload new version");
      }

      // Refresh versions and documents
      await fetchVersions(versionDialogDoc.id);
      await fetchDocuments();
      setNewVersionFile(null);
      setChangeNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      alert("New version uploaded successfully!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload version";
      setVersionError(errorMessage);
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    if (!versionDialogDoc) return;

    try {
      const response = await fetch(
        `/api/documents/${versionDialogDoc.id}/versions/${versionId}/activate`,
        { method: "POST" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to activate version");
      }

      // Refresh versions and documents
      await fetchVersions(versionDialogDoc.id);
      await fetchDocuments();
      alert("Version activated successfully!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to activate version";
      setVersionError(errorMessage);
    }
  };

  const handleApproveVersion = async (versionId: string) => {
    if (!versionDialogDoc) return;

    try {
      const response = await fetch(
        `/api/documents/${versionDialogDoc.id}/versions/${versionId}/approve`,
        { method: "POST" }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve version");
      }

      // Refresh versions and documents
      await fetchVersions(versionDialogDoc.id);
      await fetchDocuments();
      alert("Version approved successfully!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to approve version";
      setVersionError(errorMessage);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-y-6">
        <div className="flex lg:flex-row flex-col gap-6 w-full">
          {/* Left Section */}
          <div className="lg:w-3/5 w-full">
            <div className="h-full p-5 lg:pb-0 relative">
              <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
                <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
                <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
                <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
              </div>
              <div className="relative">
                <div className="flex flex-wrap gap-y-5">
                  <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                    <Image
                      src="/images/doc-folder.png"
                      alt="Document Folder"
                      width={400}
                      height={400}
                      className="max-w-full inline-block"
                    />
                  </div>
                  <div className="flex flex-col items-start justify-center space-y-5 md:w-1/2 md:order-first [&_strong]:text-primary-500">
                    <div>
                      <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                        Document Library
                      </h2>
                      <p>Browse, search, and manage all your documents with version control</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="lg:w-2/5 w-full">
            <div className="rounded-xl border light-border bg-white h-full p-4">
              <ul className="flex flex-wrap justify-between items-center sm:[&>*:nth-of-type(2n+1)]:border-r sm:[&>*:not(:nth-last-child(-n+2))]:border-b [&>*]:border-gray-200">
                {[
                  { label: "Total Documents", value: stats.total, change: "0%", type: "up" },
                  { label: "Approved", value: stats.approved, change: "0%", type: "up" },
                  { label: "Pending Review", value: stats.pending, change: "0%", type: "up" },
                  { label: "Rejected", value: stats.rejected, change: "0%", type: "down" },
                ].map((item, index) => (
                  <li
                    key={index}
                    className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start"
                  >
                    <span className="text-gray-500 text-sm font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                        {item.value}
                      </span>
                      <span
                        className={`text-sm font-bold flex ${item.type === "up" ? "text-green-600 [&_img]:icon-theme-green-500" : "text-red-600 [&_img]:icon-red-500"
                          }`}
                      >
                        <Image
                          src={`/images/icons/arrow-${item.type}ward.svg`}
                          alt={item.type === "up" ? "Up" : "Down"}
                          width={16}
                          height={16}
                        />
                        {item.change}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        {/* Search & Filters */}
        <div className="w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
              <h3 className="mb-0 text-lg font-semibold text-gray-950">Search & Filters</h3>
            </div>
            <ul className="flex flex-wrap items-center -mx-1 gap-y-2 sticky top-16 z-10 w-full">
              <li className="xl:w-3/8 lg:w-2/8 md:w-2/6 w-2/4 px-1">
                <div className="flex items-center light-dark-icon relative">
                  <input
                    type="text"
                    placeholder="Search documents, conversations ..."
                    className="form-control !pr-10 !bg-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    className="w-8 h-8 !p-0 flex-none !flex justify-center items-center rounded-lg hover:bg-gray-100 absolute right-1 cursor-pointer"
                  >
                    <Image
                      src="/images/icons/search.svg"
                      alt="Search"
                      width={16}
                      height={16}
                    />
                  </button>
                </div>
              </li>

              {/* Status Filter */}
              <li className="xl:flex-1 lg:w-2/8 md:w-2/6 w-2/4 px-1">
                <select
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </li>

              <li className="px-1">
                <button
                  onClick={fetchDocuments}
                  className="btn btn-secondary"
                >
                  Refresh
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Documents Table */}
        <div className="w-full">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            <div className="flex flex-col items-center gap-3">
              <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="mb-0 text-lg font-semibold text-gray-950">Documents</h3>
                  <span className="text-sm text-secondary-400">
                    Showing {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                  </span>
                </div>
              </div>
              <div className="panel-body w-full overflow-x-auto">
                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : error ? (
                  <div className="text-center py-10 text-red-600">{error}</div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">No documents found</div>
                ) : (
                  <table className="table table-row-hover w-full">
                    <thead className="border-b border-gray-200">
                      <tr>
                        <th></th>
                        <th>Document</th>
                        <th>Author</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Access Tags</th>
                        <th>Last Modified</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                          <td width="24">
                            <button className="bg-transparent size-6 cursor-pointer [&_img]:icon-yellow-500">
                              <Image src="/images/icons/star-fill.svg" alt="Star" width={16} height={16} />
                            </button>
                          </td>
                          <td>
                            <div className="flex items-start gap-2">
                              <div className="size-10 flex justify-center items-center rounded-full border border-gray-200 bg-gray-100">
                                <Image src="/images/icons/doc.svg" alt="Document" width={24} height={24} />
                              </div>
                              <div className="flex flex-col flex-start gap-y-1">
                                <span className="text-sm font-semibold text-wrap break-all">
                                  {doc.name}
                                </span>
                                <span className="text-xs font-medium text-nowrap">{formatFileSize(doc.fileSize)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-nowrap">
                            <div className="flex items-center gap-1">
                              <div className="size-8 rounded-full overflow-hidden flex justify-center items-center bg-gray-100">
                                {doc.submittedBy.profileImageUrl ? (
                                  <Image
                                    src={doc.submittedBy.profileImageUrl}
                                    alt="Author"
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">
                                    {doc.submittedBy.name ? doc.submittedBy.name[0] : doc.submittedBy.email[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <span className="font-semibold">{doc.submittedBy.name || doc.submittedBy.email}</span>
                            </div>
                          </td>
                          <td className="text-nowrap">
                            <div className="flex gap-1 items-center">
                              <span className="px-3 py-0.5 text-xs font-semibold rounded-full border border-gray-200 bg-gray-50">
                                V{doc.latestVersionNumber}
                              </span>
                              {doc.hasActiveVersion && doc.activeVersionNumber !== doc.latestVersionNumber && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700" title="Active version for AI search">
                                  Active: V{doc.activeVersionNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {getStatusBadge(doc.status)}
                          </td>
                          <td>
                            {doc.accessTags && doc.accessTags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {doc.accessTags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-2 py-0.5 text-xs font-semibold rounded-full border border-blue-200 bg-blue-50 text-blue-700"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No access tags</span>
                            )}
                          </td>
                          <td className="text-nowrap">
                            <span className="font-medium">{formatDate(doc.updatedAt)}</span>
                          </td>
                          <td>
                            <div className="flex justify-center items-center gap-1">
                              <button
                                className="btn btn-primary-light !size-8 !p-0 !rounded-full !flex justify-center items-center"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                                title="View"
                              >
                                <Image src="/images/icons/eye.svg" alt="View" width={16} height={16} />
                              </button>
                              <button
                                className="btn btn-primary-light !size-8 !p-0 !rounded-full !flex justify-center items-center"
                                onClick={() => handleVersionDialog(doc)}
                                title="Version History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              {doc.status === 'APPROVED' && (
                                <>
                                  <button
                                    className="btn btn-primary-light !size-8 !p-0 !rounded-full !flex justify-center items-center"
                                    onClick={() => handleEdit(doc)}
                                    title="Edit"
                                  >
                                    <Image src="/images/icons/pencil.svg" alt="Edit" width={16} height={16} />
                                  </button>
                                  <button
                                    className="btn btn-primary-light !size-8 !p-0 !rounded-full !flex justify-center items-center text-red-600 hover:text-red-700"
                                    onClick={() => setDeleteConfirmDoc(doc)}
                                    title="Delete"
                                  >
                                    <Image src="/images/icons/trash.svg" alt="Delete" width={16} height={16} />
                                  </button>
                                </>
                              )}
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

      {/* Edit Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document information and access tags.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editError && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {editError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editName">Document Name *</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError("");
                }}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Access Tags</Label>
              {isLoadingTags ? (
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-500">Loading tags...</p>
                </div>
              ) : availableTags.length === 0 ? (
                <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-500">
                    No access tags available.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-4 bg-white">
                  {availableTags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-tag-${tag.id}`}
                        checked={selectedAccessTagIds.includes(tag.id)}
                        onCheckedChange={() => toggleAccessTag(tag.id)}
                        disabled={isSaving}
                      />
                      <Label
                        htmlFor={`edit-tag-${tag.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Select one or more tags to control who can access this document. Leave empty to make it accessible to all users.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingDocument(null);
                setEditError("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editName.trim()}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmDoc} onOpenChange={(open) => !open && setDeleteConfirmDoc(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmDoc?.name}&quot;? This action cannot be undone and will delete all versions.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {deleteError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmDoc(null);
                setDeleteError("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Management Dialog */}
      <Dialog open={!!versionDialogDoc} onOpenChange={(open) => !open && setVersionDialogDoc(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Version History - {versionDialogDoc?.name}</DialogTitle>
            <DialogDescription>
              Manage document versions. Upload new versions or switch between existing ones.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {versionError && (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {versionError}
              </div>
            )}

            {/* Upload New Version Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Version
              </h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="newVersionFile">Select File</Label>
                  <Input
                    ref={fileInputRef}
                    id="newVersionFile"
                    type="file"
                    onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                    disabled={isUploadingVersion}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="changeNotes">Change Notes (optional)</Label>
                  <textarea
                    id="changeNotes"
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    disabled={isUploadingVersion}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary mt-1"
                    rows={2}
                    placeholder="Describe what changed in this version..."
                  />
                </div>
                <Button
                  onClick={handleUploadNewVersion}
                  disabled={isUploadingVersion || !newVersionFile}
                  className="w-full"
                >
                  {isUploadingVersion ? "Uploading..." : "Upload New Version"}
                </Button>
              </div>
            </div>

            {/* Version List */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                All Versions
              </h4>
              {isLoadingVersions ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">No versions found</div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`border rounded-lg p-4 ${version.isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">Version {version.versionNumber}</span>
                            {version.isActive && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500 text-white">
                                Active
                              </span>
                            )}
                            {version.status === 'APPROVED' && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {version.status === 'PENDING' && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {version.status === 'REJECTED' && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                <XIcon className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 truncate mt-1">
                            {version.originalName} ({formatFileSize(version.fileSize)})
                          </p>
                          {version.changeNotes && (
                            <p className="text-sm text-gray-500 mt-1 italic">
                              &quot;{version.changeNotes}&quot;
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Uploaded by {version.uploadedBy.name || version.uploadedBy.email} on {formatDate(version.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(version.fileUrl, '_blank')}
                          >
                            View
                          </Button>
                          {version.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveVersion(version.id)}
                            >
                              Approve
                            </Button>
                          )}
                          {version.status === 'APPROVED' && !version.isActive && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleActivateVersion(version.id)}
                            >
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionDialogDoc(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
