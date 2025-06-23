import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useLocation } from 'wouter';

interface RouteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  routeName: string;
  fallbackRoute?: string;
}

class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`Error in ${this.props.routeName} route:`, error, errorInfo);
    
    // Log route-specific error details
    console.error('Route Error Details:', {
      route: this.props.routeName,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return <RouteErrorFallback 
        error={this.state.error} 
        routeName={this.props.routeName}
        onRetry={this.handleRetry}
        fallbackRoute={this.props.fallbackRoute}
      />;
    }

    return this.props.children;
  }
}

function RouteErrorFallback({ 
  error, 
  routeName, 
  onRetry, 
  fallbackRoute = '/' 
}: { 
  error?: Error; 
  routeName: string; 
  onRetry: () => void;
  fallbackRoute?: string;
}) {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation(fallbackRoute);
  };

  const isNetworkError = error?.message?.includes('fetch') || error?.message?.includes('network');
  const isAuthError = error?.message?.includes('Unauthorized') || error?.message?.includes('401');

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <CardTitle className="text-xl font-bold text-text-primary">
            {isAuthError ? 'Authentication Error' : 
             isNetworkError ? 'Connection Error' : 
             `Error in ${routeName}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-text-secondary">
            {isAuthError ? 'Please sign in again to continue.' :
             isNetworkError ? 'Check your internet connection and try again.' :
             'Something went wrong loading this page.'}
          </p>
          
          {error && process.env.NODE_ENV === 'development' && (
            <details className="text-left text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{error.message}</pre>
            </details>
          )}
          
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleGoHome} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RouteErrorBoundary;