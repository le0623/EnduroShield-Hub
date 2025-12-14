"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { useUsers, useInvalidateUserManagement } from "@/lib/hooks/useQueries";

export default function UsersTab() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  
  // Use shared React Query hook - data is cached and shared with parent
  const { data, isLoading, isError, error } = useUsers();
  const invalidateUserManagement = useInvalidateUserManagement();
  
  const users = data?.users || [];

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName || "this user"}? This action cannot be undone.`)) {
      return;
    }

    setProcessingUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        alert("User deleted successfully!");
        invalidateUserManagement(); // Refresh the cached data
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete user");
      }
    } catch (err) {
      alert("An error occurred while deleting the user");
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleEdit = (userId: string) => {
    // TODO: Open edit modal or navigate to edit page
    alert(`Edit user ${userId} - Feature coming soon`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return formatDate(dateString);
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: "bg-emerald-500",
      INACTIVE: "bg-gray-500",
      PENDING: "bg-yellow-500",
    };
    return (
      <span
        className={`px-3 py-1 inline-block text-xs font-semibold text-white rounded-full ${
          statusColors[status as keyof typeof statusColors] || "bg-gray-500"
        }`}
      >
        {status}
      </span>
    );
  };

  const getRoleBadge = (role: string | null, isOwner: boolean, tags: Array<{ id: string; name: string }>) => {
    if (isOwner) {
      return (
        <span className="px-3 py-0.5 text-xs font-semibold rounded-full border border-blue-200 bg-blue-50 text-blue-700">
          Owner
        </span>
      );
    }
    if (role === "ADMIN") {
      return (
        <span className="px-3 py-0.5 text-xs font-semibold rounded-full border border-purple-200 bg-purple-50 text-purple-700">
          Admin
        </span>
      );
    }
    return null;
  };

  const getTagsBadges = (tags: Array<{ id: string; name: string }>) => {
    if (!tags || tags.length === 0) {
      return (
        <span className="text-xs text-gray-400">No tags assigned</span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="px-2 py-0.5 text-xs font-semibold rounded-full border border-gray-200 bg-gray-50 text-gray-700"
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 text-red-600">
        {error instanceof Error ? error.message : "Failed to load users"}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        No users found
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table table-row-hover w-full">
        <thead className="border-b border-gray-200">
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
            <th>Joined</th>
            <th className="text-center">Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full overflow-hidden flex justify-center items-center bg-gray-100">
                    {user.profileImageUrl ? (
                      <Image
                        src={user.profileImageUrl}
                        alt={user.name || user.email}
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold">{user.name || "No name"}</span>
                    <span className="text-xs text-gray-500">{user.email}</span>
                  </div>
                </div>
              </td>

              <td className="text-nowrap">
                <div className="flex flex-col gap-1">
                  {getRoleBadge(user.role, user.isOwner, user.tags || [])}
                  {getTagsBadges(user.tags || [])}
                </div>
              </td>

              <td>{getStatusBadge(user.status)}</td>

              <td className="text-nowrap">{formatLastActive(user.lastActive)}</td>

              <td className="text-nowrap font-medium">{formatDate(user.createdAt)}</td>

              <td>
                <div className="flex justify-center items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={processingUserId === user.id || user.isOwner}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleEdit(user.id)}
                        disabled={processingUserId === user.id || user.isOwner}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(user.id, user.name || user.email)}
                        disabled={processingUserId === user.id || user.isOwner}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
