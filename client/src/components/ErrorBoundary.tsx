import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

const isDev = process.env.NODE_ENV === 'development';

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (isDev) console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The chat interface encountered an unexpected error. This has been logged and we're working to fix it.
            </p>

            {this.state.error && isDev && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200 overflow-auto max-h-32">
                  <div className="font-semibold mb-1">Error:</div>
                  <div>{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <>
                      <div className="font-semibold mt-2 mb-1">Stack:</div>
                      <div className="whitespace-pre-wrap">{this.state.error.stack}</div>
                    </>
                  )}
                </div>
              </details>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={this.handleReset} 
                className="flex-1"
                variant="default"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                onClick={this.handleReload} 
                className="flex-1"
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
              
              <Button 
                onClick={this.handleGoHome} 
                className="flex-1"
                variant="ghost"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Chat-specific error boundary with recovery options
interface ChatErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  onClearConversation?: () => void;
}

export function ChatErrorBoundary({ children, onRetry, onClearConversation }: ChatErrorBoundaryProps) {
  const handleReset = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleClearConversation = () => {
    if (onClearConversation) {
      onClearConversation();
    }
  };

  return (
    <ErrorBoundary 
      onReset={handleReset}
      fallback={
        <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-center p-6">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Chat Error
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              The chat interface encountered an error. You can try to recover or start fresh.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleReset} size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              {onClearConversation && (
                <Button onClick={handleClearConversation} variant="outline" size="sm">
                  Clear Chat
                </Button>
              )}
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}