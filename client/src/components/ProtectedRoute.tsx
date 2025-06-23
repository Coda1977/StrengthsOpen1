import { useAuth } from '@/hooks/useAuth';
import LandingPage from '@/pages/LandingPage';
import React from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  routeName: string;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, routeName, requireOnboarding = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasCompletedOnboarding } = useAuth();

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

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    return <LandingPage />;
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
  routeName: string;
}

export function PublicRoute({ children, routeName }: PublicRouteProps) {
  return <>{children}</>;
}