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
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    // Helper to check if user has completed onboarding
    hasCompletedOnboarding: !!user?.hasCompletedOnboarding,
  };
}