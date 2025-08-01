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
  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: (failureCount, error) => {
      // Handle session reconciliation responses
      if (error && 'status' in error) {
        if (error.status === 401) {
          // Check if this is a session reconciliation request
          const errorData = (error as any).data;
          if (errorData?.code === 'SESSION_INVALID') {
            console.log('[AUTH] Session invalid, redirecting to login');
            window.location.href = '/api/login';
            return false;
          }
          return false;
        }
      }
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 2 * 60 * 1000, // Reduced to 2 minutes for faster reconciliation detection
    // Note: onError is deprecated in newer react-query versions
    // Error handling is now done in the retry function above
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !isLoading,
    error,
    refetch, // Expose refetch for manual reconciliation triggers
    // Helper to check if user has completed onboarding
    hasCompletedOnboarding: !!user?.hasCompletedOnboarding,
  };
}