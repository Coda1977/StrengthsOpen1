
import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Wifi, Shield } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });

    // Report to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // Could integrate with error tracking service here
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  private getErrorType(error: Error): 'network' | 'auth' | 'query' | 'component' {
    const message = error.message.toLowerCase();
    
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'auth';
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('query') || message.includes('500') || message.includes('400')) {
      return 'query';
    }
    return 'component';
  }

  private getErrorIcon(type: string) {
    switch (type) {
      case 'network': return <Wifi className="h-8 w-8 text-orange-500" />;
      case 'auth': return <Shield className="h-8 w-8 text-red-500" />;
      case 'query': return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      default: return <AlertTriangle className="h-8 w-8 text-red-500" />;
    }
  }

  private getErrorMessage(type: string, error: Error) {
    switch (type) {
      case 'network':
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to the server. Please check your internet connection.',
          suggestions: ['Check your internet connection', 'Try refreshing the page', 'Contact support if the problem persists']
        };
      case 'auth':
        return {
          title: 'Authentication Error',
          message: 'Your session has expired or you lack permission for this action.',
          suggestions: ['Try logging in again', 'Contact your administrator if you believe this is an error']
        };
      case 'query':
        return {
          title: 'Data Loading Error',
          message: 'There was a problem loading the requested data.',
          suggestions: ['Try refreshing the page', 'Check if the service is available', 'Contact support if the error persists']
        };
      default:
        return {
          title: 'Application Error',
          message: 'Something unexpected happened in the application.',
          suggestions: ['Try refreshing the page', 'Clear your browser cache', 'Contact support with details about what you were doing']
        };
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const errorType = this.getErrorType(this.state.error);
      const errorDetails = this.getErrorMessage(errorType, this.state.error);

      if (this.props.fallback) {
        return <this.props.fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {this.getErrorIcon(errorType)}
              </div>
              <CardTitle className="text-xl text-text-primary">
                {errorDetails.title}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-text-secondary text-center">
                {errorDetails.message}
              </p>

              <div className="bg-gray-50 p-3 rounded-md">
                <h4 className="font-medium text-sm text-gray-700 mb-2">What you can try:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {errorDetails.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-gray-400 mr-2">•</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="bg-red-50 p-3 rounded-md">
                  <summary className="cursor-pointer text-sm font-medium text-red-700">
                    Development Details
                  </summary>
                  <div className="mt-2 text-xs text-red-600">
                    <p><strong>Error:</strong> {this.state.error.message}</p>
                    <p><strong>Stack:</strong></p>
                    <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button 
                  onClick={this.handleRetry}
                  className="flex items-center gap-2"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                <Button 
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
                
                <Button 
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced wrapper that integrates with React Query
export function EnhancedErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary fallback={({ error, retry }) => (
          <div className="min-h-screen bg-primary-bg flex items-center justify-center p-4">
            <Card className="w-full max-w-lg">
              <CardHeader className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <CardTitle className="text-xl font-bold text-text-primary">
                  Application Error
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-text-secondary">
                  {error?.message?.includes('fetch') || error?.message?.includes('network') 
                    ? 'Unable to connect to the server. Please check your internet connection.'
                    : 'An unexpected error occurred. Please try again.'}
                </p>
                
                {error && process.env.NODE_ENV === 'development' && (
                  <details className="text-left text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">{error.message}</pre>
                  </details>
                )}
                
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={() => { reset(); retry(); }} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Reload Page
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}>
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

export default ErrorBoundary;
