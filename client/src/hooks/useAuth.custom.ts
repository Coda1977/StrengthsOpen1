import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  hasCompletedOnboarding?: boolean;
  isAdmin?: boolean;
}

interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  redirectTo?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('auth_token')
  );

  // Store token in localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }, [token]);

  // Fetch user data
  const { data: user, isLoading: isUserLoading, error } = useQuery({
    queryKey: ['user'],
    queryFn: async (): Promise<User | null> => {
      if (!token) return null;
      
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, clear it
          setToken(null);
          return null;
        }
        throw new Error('Failed to fetch user data');
      }
      
      return response.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData): Promise<AuthResponse> => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(['user'], data.user);
      
      // Redirect after successful login
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData): Promise<AuthResponse> => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(['user'], data.user);
      
      // Redirect to onboarding for new users
      window.location.href = '/onboarding';
    },
  });

  // Update user onboarding
  const updateOnboardingMutation = useMutation({
    mutationFn: async (data: { hasCompletedOnboarding: boolean; topStrengths?: string[] }) => {
      const response = await fetch('/api/me/onboarding', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Login function
  const login = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  // Register function
  const register = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      queryClient.clear();
      window.location.href = '/';
    }
  };

  // Admin login function
  const adminLogin = async (email: string) => {
    try {
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
      
      if (result.success && result.token) {
        setToken(result.token);
        queryClient.setQueryData(['user'], result.user);
        
        if (result.redirectTo) {
          window.location.href = result.redirectTo;
        }
      }
    } catch (error) {
      console.error('Admin login error:', error);
      throw error;
    }
  };

  const isLoading = isUserLoading && !!token;
  const isAuthenticated = !!token && !!user;

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    adminLogin,
    updateOnboarding: updateOnboardingMutation.mutate,
    isUpdatingOnboarding: updateOnboardingMutation.isPending,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    // Helper properties
    hasCompletedOnboarding: user?.hasCompletedOnboarding === true,
    isAdmin: user?.isAdmin === true,
  };
}

// Helper hook for checking if user is admin
export function useIsAdmin() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated && (user?.isAdmin === true || user?.email === 'tinymanagerai@gmail.com');
}

// Helper hook for checking if user has completed onboarding
export function useHasCompletedOnboarding() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated && user?.hasCompletedOnboarding === true;
}

export default useAuth;