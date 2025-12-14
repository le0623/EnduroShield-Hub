"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Tag {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  documentCount: number;
}

export default function RolesTab() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        // API now returns tags with userCount and documentCount included
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError("Tag name is required");
      return;
    }

    try {
      setError("");
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (response.ok) {
        setSuccess("Tag created successfully");
        setNewTagName("");
        setIsCreateDialogOpen(false);
        fetchTags();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create tag");
      }
    } catch (err) {
      setError("Failed to create tag");
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !editingTag.name.trim()) {
      setError("Tag name is required");
      return;
    }

    try {
      setError("");
      const response = await fetch(`/api/tags/${editingTag.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editingTag.name.trim() }),
      });

      if (response.ok) {
        setSuccess("Tag updated successfully");
        setEditingTag(null);
        fetchTags();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update tag");
      }
    } catch (err) {
      setError("Failed to update tag");
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("Are you sure you want to delete this tag? This will remove it from all users and documents.")) {
      return;
    }

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Tag deleted successfully");
        fetchTags();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete tag");
      }
    } catch (err) {
      alert("Failed to delete tag");
    }
  };

  return (
    <div className="tab-content space-y-5">
      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Top Controls */}
      <div className="w-full flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
            Custom Roles (Tags)
          </h3>
          <p className="text-sm font-medium text-gray-500">
            Create and manage custom roles using tags. Users can be assigned multiple tags, and documents can be tagged to control access.
          </p>
        </div>

        <Button
          className="btn btn-primary btn-sm !inline-flex gap-1 !justify-start"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Image
            src="/images/icons/plus.svg"
            alt="Add"
            width={14}
            height={14}
          />
          Create Custom Role
        </Button>
      </div>

      {/* Tags List */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading tags...</div>
      ) : tags.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-gray-500 mb-4">No custom roles created yet.</p>
          <Button
            variant="outline"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            Create Your First Role
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-4 rounded-lg border border-gray-200 flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{tag.name}</h4>
                  <span className="text-sm text-gray-500">
                    {tag.userCount || 0} user{tag.userCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingTag(tag)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Tag Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription>
              Create a new tag that can be assigned to users and documents for access control.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Role Name</Label>
              <Input
                id="tagName"
                placeholder="e.g., Staff, Leadership Team, Distributors"
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value);
                  setError("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                This tag will be used to control document access. Users with this tag can access documents tagged with the same tag.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewTagName("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Custom Role</DialogTitle>
            <DialogDescription>
              Update the name of this tag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editTagName">Role Name</Label>
              <Input
                id="editTagName"
                value={editingTag?.name || ""}
                onChange={(e) =>
                  setEditingTag(editingTag ? { ...editingTag, name: e.target.value } : null)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingTag(null);
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateTag} disabled={!editingTag?.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
