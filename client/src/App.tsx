import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { EnhancedErrorBoundary } from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import Encyclopedia from "@/pages/Encyclopedia";
import ChatCoach from "@/pages/ChatCoach";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading only for initial load, not for auth check
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
      <Route path="/">
        {() => {
          if (!isAuthenticated) {
            return (
              <RouteErrorBoundary routeName="Landing Page">
                <LandingPage />
              </RouteErrorBoundary>
            );
          }
          if (user && !(user as any).hasCompletedOnboarding) {
            return (
              <RouteErrorBoundary routeName="Onboarding">
                <Onboarding />
              </RouteErrorBoundary>
            );
          }
          return (
            <RouteErrorBoundary routeName="Dashboard">
              <Dashboard />
            </RouteErrorBoundary>
          );
        }}
      </Route>
      <Route path="/dashboard">
        {() => {
          if (!isAuthenticated) {
            return (
              <RouteErrorBoundary routeName="Landing Page">
                <LandingPage />
              </RouteErrorBoundary>
            );
          }
          return (
            <RouteErrorBoundary routeName="Dashboard">
              <Dashboard />
            </RouteErrorBoundary>
          );
        }}
      </Route>
      <Route path="/encyclopedia">
        {() => {
          if (!isAuthenticated) {
            return (
              <RouteErrorBoundary routeName="Landing Page">
                <LandingPage />
              </RouteErrorBoundary>
            );
          }
          return (
            <RouteErrorBoundary routeName="Encyclopedia">
              <Encyclopedia />
            </RouteErrorBoundary>
          );
        }}
      </Route>
      <Route path="/coach">
        {() => {
          if (!isAuthenticated) {
            return (
              <RouteErrorBoundary routeName="Landing Page">
                <LandingPage />
              </RouteErrorBoundary>
            );
          }
          return (
            <RouteErrorBoundary routeName="AI Coach">
              <ChatCoach />
            </RouteErrorBoundary>
          );
        }}
      </Route>
      <Route path="/onboarding">
        {() => {
          if (!isAuthenticated) {
            return (
              <RouteErrorBoundary routeName="Landing Page">
                <LandingPage />
              </RouteErrorBoundary>
            );
          }
          return (
            <RouteErrorBoundary routeName="Onboarding">
              <Onboarding />
            </RouteErrorBoundary>
          );
        }}
      </Route>
      <Route>
        {() => (
          <RouteErrorBoundary routeName="404 Page">
            <NotFound />
          </RouteErrorBoundary>
        )}
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