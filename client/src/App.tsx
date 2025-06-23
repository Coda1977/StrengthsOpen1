import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { EnhancedErrorBoundary } from "@/components/ErrorBoundary";
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
          if (!isAuthenticated) return <LandingPage />;
          if (user && !(user as any).hasCompletedOnboarding) return <Onboarding />;
          return <Dashboard />;
        }}
      </Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/encyclopedia" component={Encyclopedia} />
      <Route path="/coach" component={ChatCoach} />
      <Route path="/onboarding" component={Onboarding} />
      <Route component={NotFound} />
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