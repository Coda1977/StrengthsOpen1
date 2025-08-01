import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  hasCompletedOnboarding?: boolean;
  topStrengths?: string[];
  // Add any other properties as needed
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: (failureCount, error) => {
      // Don't retry on 401 errors (unauthorized)
      if (error && 'status' in error && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Allow refetch to ensure fresh data
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // 5 minutes (shorter for more responsive auth)
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !isLoading,
    error,
    // Helper to check if user has completed onboarding
    hasCompletedOnboarding: !!user?.hasCompletedOnboarding,
  };
}