import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { EnhancedErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Encyclopedia from "@/pages/Encyclopedia";
import ChatCoach from "@/pages/ChatCoach";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/not-found";

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
    <Switch>
      {/* Public landing page route */}
      <Route path="/" nest>
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

      <Route path="/coach">
        <ProtectedRoute routeName="AI Coach" requireOnboarding>
          <ChatCoach />
        </ProtectedRoute>
      </Route>

      {/* Special onboarding route - requires auth but not completed onboarding */}
      <Route path="/onboarding">
        <ProtectedRoute routeName="Onboarding">
          <Onboarding />
        </ProtectedRoute>
      </Route>

      {/* 404 route - public */}
      <Route>
        <PublicRoute routeName="404 Page">
          <NotFound />
        </PublicRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <EnhancedErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </EnhancedErrorBoundary>
  );
}

export default App;