"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import UsersTab from "./components/user-management-user";
import RolesTab from "./components/user-management-roles";
import PendingInvitesTab from "./components/user-management-pending-invites";
import InviteUserModal from "./components/invite-user-modal";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useUserManagementStats, useInvalidateUserManagement } from "@/lib/hooks/useQueries";

export default function Users() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  // Check admin permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch('/api/user/membership');
        if (response.ok) {
          const data = await response.json();
          if (!data.isAdmin) {
            router.push('/dashboard');
            return;
          }
        } else {
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Failed to check permission:', error);
        router.push('/dashboard');
        return;
      } finally {
        setIsCheckingPermission(false);
      }
    };

    checkPermission();
  }, [router]);

  // Use shared React Query hooks - data is cached and shared across components
  const { stats, isLoading: isLoadingStats } = useUserManagementStats();
  const invalidateUserManagement = useInvalidateUserManagement();

  // Show loading while checking permission
  if (isCheckingPermission) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statsData = [
    {
      label: "Total Users",
      value: isLoadingStats ? "..." : stats.total,
      change: "0%",
      icon: "/images/icons/arrow-upward.svg",
      color: "text-green-600",
    },
    {
      label: "Pending Invites",
      value: isLoadingStats ? "..." : stats.pending,
      change: "0%",
      icon: "/images/icons/arrow-upward.svg",
      color: "text-green-600",
    },
    {
      label: "Active Users",
      value: isLoadingStats ? "..." : stats.active,
      change: "0%",
      icon: "/images/icons/arrow-upward.svg",
      color: "text-green-600",
    },
    {
      label: "Admin Users",
      value: isLoadingStats ? "..." : stats.admin,
      change: "0%",
      icon: "/images/icons/arrow-downward.svg",
      color: "text-red-600",
    },
  ];

  const tabs = [
    { id: "users", label: "Users" },
    { id: "roles", label: "Role and Permission" },
    { id: "invites", label: "Pending Invites" },
  ];

  const handleInviteSuccess = () => {
    // Invalidate queries to refresh data
    invalidateUserManagement();
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-y-4">
        <div className="flex lg:flex-row flex-col gap-6 w-full">
          <div className="lg:w-3/5 w-full">
            <div className="h-full p-5 lg:pb-0 relative">
              {/* Background shapes */}
              <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
                <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
                <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
                <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
              </div>

              {/* Content */}
              <div className="relative">
                <div className="flex flex-wrap gap-y-5">
                  {/* Image */}
                  <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                    {/* <Image src="/images/user-3d.png"  alt="User 3D" className="max-w-full inline-block" /> */}
                  </div>

                  {/* Text and Button */}
                  <div className="flex flex-col items-start justify-center space-y-5 md:w-1/2 md:order-first [&_h1_strong]:text-primary-500 [&_strong]:text-primary-500">
                    <div>
                      <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                        User Management
                      </h2>
                      <p>
                        Manage users, roles, and permissions across your
                        organization
                      </p>
                    </div>
                    <Button
                      className="btn btn-secondary !inline-flex gap-1 !justify-start"
                      onClick={() => setIsInviteModalOpen(true)}
                    >
                      <PlusIcon className="w-4 h-4" />
                      Invite User
                    </Button>
                    
                    <InviteUserModal
                      open={isInviteModalOpen}
                      onOpenChange={setIsInviteModalOpen}
                      onInviteSuccess={handleInviteSuccess}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:w-2/5 w-full">
            <div className="rounded-xl border light-border bg-white h-full p-4">
              <ul className="flex flex-wrap justify-between items-center sm:[&>*:nth-of-type(2n+1)]:border-r sm:[&>*:not(:nth-last-child(-n+2))]:border-b [&>*]:border-gray-200">
                {statsData.map((stat, index) => (
                  <li
                    key={index}
                    className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start"
                  >
                    <span className="text-gray-500 text-sm font-medium">
                      {stat.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                        {stat.value}
                      </span>
                      <span
                        className={`text-sm font-bold flex items-center gap-1 ${stat.color}`}
                      >
                        <Image
                          src={stat.icon}
                          alt={stat.label}
                          width={16}
                          height={16}
                        />
                        {stat.change}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="w-full">
          <div className="flex flex-col items-center gap-3">
            <div className="panel-header w-full flex flex-wrap justify-between items-center gap-3">
              {/* Title + Description */}
              <div className="flex-1">
                <h3 className="mb-0 text-lg font-semibold text-gray-950">
                  User Management
                </h3>
                <p>Manage users, roles, and permissions across your organization</p>
              </div>

              {/* Search Box */}
              <div className="flex-1 flex items-center light-dark-icon relative">
                <input
                  type="text"
                  placeholder="Search user by name, email or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control !pr-10 !bg-transparent w-full"
                />
                <button
                  type="button"
                  className="w-8 h-8 !p-0 flex-none !flex justify-center items-center rounded-lg hover:bg-gray-100 absolute right-1 cursor-pointer"
                >
                  <Image
                    src="/images/icons/search.svg"
                    alt="Search"
                    width={18}
                    height={18}
                    className="icon-img"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="rounded-xl border light-border bg-white h-full">
            {/* Tabs Header */}
            <ul className="mb-3 nav nav-tabs flex border-b light-border [&>*]:flex-1 [&>*]:nav-item [&>*]:inline-flex [&>*]:justify-center [&>*]:items-center [&>*]:gap-1">
              {tabs.map((tab) => (
                <li
                  key={tab.id}
                  className={`nav-item cursor-pointer ${activeTab === tab.id ? "border-b-3 border-primary" : ""
                    }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="py-2">{tab.label}</span>
                </li>
              ))}
            </ul>

            {/* Tab Content */}
            <div className="tab-content p-4">
              {activeTab === "users" && <UsersTab />}
              {activeTab === "roles" && <RolesTab />}
              {activeTab === "invites" && <PendingInvitesTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
