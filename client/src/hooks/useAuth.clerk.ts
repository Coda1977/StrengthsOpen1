import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  hasCompletedOnboarding?: boolean;
  isAdmin?: boolean;
}

export function useAuth() {
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { isSignedIn, signOut } = useClerkAuth();
  const queryClient = useQueryClient();

  // Fetch user data from our database
  const { data: user, isLoading: isUserLoading, error } = useQuery({
    queryKey: ['user', clerkUser?.id],
    queryFn: async (): Promise<User | null> => {
      if (!clerkUser?.id) return null;
      
      const response = await fetch('/api/me', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user data');
      }
      
      return response.json();
    },
    enabled: !!clerkUser?.id && isSignedIn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update user onboarding
  const updateOnboardingMutation = useMutation({
    mutationFn: async (data: { hasCompletedOnboarding: boolean; topStrengths?: string[] }) => {
      const response = await fetch('/api/me/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update onboarding');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate user query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['user', clerkUser?.id] });
    },
  });

  // Login function (redirects to Clerk sign-in)
  const login = () => {
    window.location.href = '/sign-in';
  };

  // Logout function
  const logout = async () => {
    try {
      // Clear our backend session
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Backend logout error:', error);
    } finally {
      // Sign out from Clerk
      await signOut();
      // Clear all queries
      queryClient.clear();
      // Redirect to home
      window.location.href = '/';
    }
  };

  // Admin login function
  const adminLogin = async (email: string) => {
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Admin login failed');
    }

    const result = await response.json();
    
    // If admin login redirects to sign-in, follow it
    if (result.redirectTo === '/sign-in') {
      window.location.href = '/sign-in';
      return;
    }

    // Invalidate queries and redirect
    queryClient.invalidateQueries({ queryKey: ['user'] });
    
    if (result.redirectTo) {
      window.location.href = result.redirectTo;
    }
  };

  const isLoading = !isUserLoaded || isUserLoading;
  const isAuthenticated = isSignedIn && !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    logout,
    adminLogin,
    updateOnboarding: updateOnboardingMutation.mutate,
    isUpdatingOnboarding: updateOnboardingMutation.isPending,
    // Clerk-specific properties
    clerkUser,
    isSignedIn,
  };
}

// Helper hook for checking if user is admin
export function useIsAdmin() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated && user?.isAdmin === true;
}

// Helper hook for checking if user has completed onboarding
export function useHasCompletedOnboarding() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated && user?.hasCompletedOnboarding === true;
}

export default useAuth;