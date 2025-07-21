import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import React, { Suspense, lazy } from "react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Encyclopedia = lazy(() => import("@/pages/Encyclopedia"));
const ChatCoach = lazy(() => import("@/pages/ChatCoach"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  const { isAuthenticated, isLoading, user, hasCompletedOnboarding } = useAuth();

  // Show loading only for initial load
  if (isLoading && user === undefined) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-yellow mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Switch>
        {/* Protected routes - require authentication */}
        <Route path="/dashboard">
          <ProtectedRoute routeName="Dashboard" requireOnboarding>
            <Dashboard />
          </ProtectedRoute>
        </Route>

        <Route path="/encyclopedia">
          <ProtectedRoute routeName="Encyclopedia" requireOnboarding>
            <Encyclopedia />
          </ProtectedRoute>
        </Route>

        <Route path="/encyclopedia/:strength">
          <ProtectedRoute routeName="Encyclopedia" requireOnboarding>
            <Encyclopedia />
          </ProtectedRoute>
        </Route>

        <Route path="/ai-coach">
          <ProtectedRoute routeName="AI Coach" requireOnboarding>
            <ChatCoach />
          </ProtectedRoute>
        </Route>

        {/* Admin route - only visible to admin user */}
        {user?.email === 'tinymanagerai@gmail.com' && (
          <Route path="/admin">
            <ProtectedRoute routeName="Admin">
              <Admin />
            </ProtectedRoute>
          </Route>
        )}

        {/* Special onboarding route - requires auth but not completed onboarding */}
        <Route path="/onboarding">
          <ProtectedRoute routeName="Onboarding">
            <Onboarding />
          </ProtectedRoute>
        </Route>



        {/* Public landing page route - must come after specific routes */}
        <Route path="/">
          {() => {
            // If authenticated, check onboarding status and redirect accordingly
            if (isAuthenticated) {
              if (!hasCompletedOnboarding) {
                return (
                  <ProtectedRoute routeName="Onboarding">
                    <Onboarding />
                  </ProtectedRoute>
                );
              }
              return (
                <ProtectedRoute routeName="Dashboard" requireOnboarding>
                  <Dashboard />
                </ProtectedRoute>
              );
            }
            // Show public landing page for unauthenticated users
            return (
              <PublicRoute routeName="Landing Page">
                <LandingPage />
              </PublicRoute>
            );
          }}
        </Route>

        {/* 404 route - public */}
        <Route>
          <PublicRoute routeName="404 Page">
            <NotFound />
          </PublicRoute>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;