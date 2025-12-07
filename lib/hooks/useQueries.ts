'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, BillingOverview, BillingHistory, Balance } from '@/lib/api';
import { CurrentUser, CurrentTenant } from '@/lib/auth';

// Query Keys
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  currentTenant: ['currentTenant'] as const,
  tenantUsers: ['tenantUsers'] as const,
  userStats: ['userStats'] as const,
  dashboardData: ['dashboardData'] as const,
  billingOverview: ['billingOverview'] as const,
  billingHistory: ['billingHistory'] as const,
  balance: ['balance'] as const,
} as const;

// Custom Query Hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: api.getCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCurrentTenant() {
  return useQuery({
    queryKey: queryKeys.currentTenant,
    queryFn: api.getCurrentTenant,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useTenantUsers() {
  return useQuery({
    queryKey: queryKeys.tenantUsers,
    queryFn: api.getTenantUsers,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.userStats,
    queryFn: api.getUserStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDashboardData() {
  return useQuery({
    queryKey: queryKeys.dashboardData,
    queryFn: api.getDashboardData,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Mutation Hooks
export function useRefreshUserStats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.getUserStats,
    onSuccess: (data) => {
      // Update the user stats cache
      queryClient.setQueryData(queryKeys.userStats, data);
      
      // Also invalidate related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardData });
    },
  });
}

// Utility hooks for common patterns
export function useAuthData() {
  const userQuery = useCurrentUser();
  const tenantQuery = useCurrentTenant();

  return {
    user: userQuery.data,
    tenant: tenantQuery.data,
    isLoading: userQuery.isLoading || tenantQuery.isLoading,
    isError: userQuery.isError || tenantQuery.isError,
    error: userQuery.error || tenantQuery.error,
    refetch: () => {
      userQuery.refetch();
      tenantQuery.refetch();
    },
  };
}

// Billing Query Hooks
export function useBillingOverview() {
  return useQuery<BillingOverview>({
    queryKey: queryKeys.billingOverview,
    queryFn: api.getBillingOverview,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useBillingHistory() {
  return useQuery<BillingHistory>({
    queryKey: queryKeys.billingHistory,
    queryFn: api.getBillingHistory,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useBalance() {
  return useQuery<Balance>({
    queryKey: queryKeys.balance,
    queryFn: api.getBalance,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

// Add credits mutation
export function useAddCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ amount, reference }: { amount: number; reference?: string }) => 
      api.addCredits(amount, reference),
    onSuccess: () => {
      // Invalidate billing queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.balance });
      queryClient.invalidateQueries({ queryKey: queryKeys.billingOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.billingHistory });
    },
  });
}
