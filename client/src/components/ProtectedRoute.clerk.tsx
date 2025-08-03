import { useAuth } from '@/hooks/useAuth';
import LandingPage from '@/pages/LandingPage';
import React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  routeName: string;
  requireOnboarding?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, routeName, requireOnboarding = false, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasCompletedOnboarding = user?.hasCompletedOnboarding;

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-yellow mx-auto"></div>
          <p className="mt-4 text-text-secondary">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Sign In Required</h2>
          <p className="text-text-secondary mb-6">
            Please sign in to access this feature.
          </p>
          <button 
            onClick={() => window.location.href = '/sign-in'}
            className="primary-button"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Check admin requirement
  if (requireAdmin && !user?.isAdmin && user?.email !== 'tinymanagerai@gmail.com') {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Admin Access Required</h2>
          <p className="text-text-secondary mb-6">
            You don't have permission to access this page.
          </p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="primary-button"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check onboarding requirement
  if (requireOnboarding && !hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Complete Your Setup</h2>
          <p className="text-text-secondary mb-6">
            Please complete your onboarding to access this feature.
          </p>
          <button 
            onClick={() => window.location.href = '/onboarding'}
            className="primary-button"
          >
            Complete Onboarding
          </button>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, user } = useAuth();

  // If user is authenticated and has completed onboarding, redirect to dashboard
  if (isAuthenticated && user?.hasCompletedOnboarding) {
    window.location.href = '/dashboard';
    return null;
  }

  // If user is authenticated but hasn't completed onboarding, redirect to onboarding
  if (isAuthenticated && !user?.hasCompletedOnboarding) {
    window.location.href = '/onboarding';
    return null;
  }

  return <>{children}</>;
}