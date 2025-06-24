import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Server, 
  MessageCircle, 
  Database,
  ShieldX,
  Clock
} from 'lucide-react';

export interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
  onReset?: () => void;
  type?: 'network' | 'server' | 'chat' | 'database' | 'auth' | 'timeout' | 'generic';
  title?: string;
  showDetails?: boolean;
  retryLabel?: string;
  resetLabel?: string;
  isRetrying?: boolean;
  attemptCount?: number;
  maxAttempts?: number;
}

export function ErrorState({
  error,
  onRetry,
  onReset,
  type = 'generic',
  title,
  showDetails = false,
  retryLabel = 'Try Again',
  resetLabel = 'Reset',
  isRetrying = false,
  attemptCount = 0,
  maxAttempts = 3
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const getErrorConfig = () => {
    switch (type) {
      case 'network':
        return {
          icon: Wifi,
          title: title || 'Network Error',
          description: 'Unable to connect to the server. Please check your internet connection.',
          color: 'text-blue-500'
        };
      case 'server':
        return {
          icon: Server,
          title: title || 'Server Error',
          description: 'The server is temporarily unavailable. Please try again in a moment.',
          color: 'text-red-500'
        };
      case 'chat':
        return {
          icon: MessageCircle,
          title: title || 'Chat Error',
          description: 'There was an issue with the chat service. Your conversation is safe.',
          color: 'text-orange-500'
        };
      case 'database':
        return {
          icon: Database,
          title: title || 'Data Error',
          description: 'There was an issue accessing your data. Please try again.',
          color: 'text-purple-500'
        };
      case 'auth':
        return {
          icon: ShieldX,
          title: title || 'Authentication Error',
          description: 'Your session may have expired. Please refresh the page.',
          color: 'text-yellow-500'
        };
      case 'timeout':
        return {
          icon: Clock,
          title: title || 'Request Timeout',
          description: 'The request took too long to complete. Please try again.',
          color: 'text-indigo-500'
        };
      default:
        return {
          icon: AlertTriangle,
          title: title || 'Something went wrong',
          description: 'An unexpected error occurred. Please try again.',
          color: 'text-red-500'
        };
    }
  };

  const config = getErrorConfig();
  const Icon = config.icon;

  const getActionSuggestions = () => {
    switch (type) {
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Check if the server is accessible'
        ];
      case 'server':
        return [
          'Wait a moment and try again',
          'Check server status',
          'Contact support if the issue persists'
        ];
      case 'chat':
        return [
          'Try sending the message again',
          'Start a new conversation',
          'Check your connection'
        ];
      case 'database':
        return [
          'Try again in a moment',
          'Check if your data is still there',
          'Contact support if data is missing'
        ];
      case 'auth':
        return [
          'Refresh the page to re-authenticate',
          'Clear browser cache and cookies',
          'Try logging in again'
        ];
      case 'timeout':
        return [
          'Try again with a simpler request',
          'Check your internet connection',
          'Try again in a moment'
        ];
      default:
        return [
          'Try refreshing the page',
          'Check your internet connection',
          'Contact support if the issue persists'
        ];
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className={`${config.color}`}>
        <Icon className="h-12 w-12 mx-auto" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {config.title}
        </h3>
        <p className="text-gray-600 dark:text-gray-300 max-w-md">
          {config.description}
        </p>
      </div>

      {(attemptCount > 0 && maxAttempts > 1) && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Attempt {attemptCount} of {maxAttempts}
        </div>
      )}

      {showDetails && errorMessage && (
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-left text-sm font-mono">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {onRetry && (
            <Button 
              onClick={onRetry} 
              disabled={isRetrying}
              size="sm"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {retryLabel}
                </>
              )}
            </Button>
          )}
          
          {onReset && (
            <Button onClick={onReset} variant="outline" size="sm">
              {resetLabel}
            </Button>
          )}
        </div>

        <details className="text-left max-w-md">
          <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Troubleshooting suggestions
          </summary>
          <ul className="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {getActionSuggestions().map((suggestion, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

// Specific error state components
export function NetworkErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="network" />;
}

export function ServerErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="server" />;
}

export function ChatErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="chat" />;
}

export function DatabaseErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="database" />;
}

export function AuthErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="auth" />;
}

export function TimeoutErrorState(props: Omit<ErrorStateProps, 'type'>) {
  return <ErrorState {...props} type="timeout" />;
}