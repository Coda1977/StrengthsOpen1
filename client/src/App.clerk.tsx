import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth.clerk";
import { ClerkProvider } from "@/components/ClerkProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import React, { Suspense, lazy } from "react";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Encyclopedia = lazy(() => import("@/pages/Encyclopedia"));
const ChatCoach = lazy(() => import("@/pages/ChatCoach"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Logout = lazy(() => import("@/pages/Logout"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const hasCompletedOnboarding = user?.hasCompletedOnboarding;

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
        {/* Auth routes */}
        <Route path="/sign-in">
          <PublicRoute>
            <SignIn />
          </PublicRoute>
        </Route>

        <Route path="/sign-up">
          <PublicRoute>
            <SignUp />
          </PublicRoute>
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
          <ProtectedRoute routeName="Coach" requireOnboarding>
            <ChatCoach />
          </ProtectedRoute>
        </Route>

        <Route path="/admin">
          <ProtectedRoute routeName="Admin" requireOnboarding requireAdmin>
            <Admin />
          </ProtectedRoute>
        </Route>

        {/* Onboarding route - requires auth but not completed onboarding */}
        <Route path="/onboarding">
          <ProtectedRoute routeName="Onboarding" requireOnboarding={false}>
            <Onboarding />
          </ProtectedRoute>
        </Route>

        {/* Public routes */}
        <Route path="/">
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        </Route>

        <Route path="/admin-login">
          <PublicRoute>
            <AdminLogin />
          </PublicRoute>
        </Route>

        <Route path="/logout">
          <Logout />
        </Route>

        {/* 404 route */}
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <Router />
            <Toaster />
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;