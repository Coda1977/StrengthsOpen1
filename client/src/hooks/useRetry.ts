import { useState, useCallback } from 'react';

export interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
}

export interface RetryState {
  isRetrying: boolean;
  attemptCount: number;
  lastError: Error | null;
}

const defaultConfig: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: () => true
};

export function useRetry<T>(
  asyncFn: () => Promise<T>,
  config: RetryConfig = {}
) {
  const finalConfig = { ...defaultConfig, ...config };
  
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attemptCount: 0,
    lastError: null
  });

  const calculateDelay = (attempt: number): number => {
    const delay = finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, finalConfig.maxDelay);
  };

  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const executeWithRetry = useCallback(async (): Promise<T> => {
    setState(prev => ({ ...prev, isRetrying: true, attemptCount: 0, lastError: null }));

    let lastError: Error;
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      setState(prev => ({ ...prev, attemptCount: attempt }));
      
      try {
        const result = await asyncFn();
        setState(prev => ({ ...prev, isRetrying: false, lastError: null }));
        return result;
      } catch (error) {
        lastError = error as Error;
        setState(prev => ({ ...prev, lastError }));
        
        const shouldRetry = finalConfig.retryCondition(lastError);
        const isLastAttempt = attempt === finalConfig.maxAttempts;
        
        if (!shouldRetry || isLastAttempt) {
          setState(prev => ({ ...prev, isRetrying: false }));
          throw lastError;
        }
        
        // Wait before next attempt (except for last attempt)
        if (attempt < finalConfig.maxAttempts) {
          const delay = calculateDelay(attempt);
          await sleep(delay);
        }
      }
    }
    
    setState(prev => ({ ...prev, isRetrying: false }));
    throw lastError!;
  }, [asyncFn, finalConfig]);

  const reset = useCallback(() => {
    setState({
      isRetrying: false,
      attemptCount: 0,
      lastError: null
    });
  }, []);

  return {
    execute: executeWithRetry,
    reset,
    ...state
  };
}

// Hook for API calls with common retry logic
export function useApiRetry<T>(
  apiCall: () => Promise<T>,
  config: RetryConfig = {}
) {
  const retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    retryCondition: (error: Error) => {
      // Retry on network errors, timeouts, and 5xx status codes
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('failed to fetch') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      );
    },
    ...config
  };

  return useRetry(apiCall, retryConfig);
}

// Hook for chat-specific operations with retry
export function useChatRetry<T>(
  chatOperation: () => Promise<T>,
  config: RetryConfig = {}
) {
  const retryConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    retryCondition: (error: Error) => {
      const message = error.message.toLowerCase();
      // Don't retry on authentication or permission errors
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return false;
      }
      // Don't retry on validation errors
      if (message.includes('validation') || message.includes('invalid')) {
        return false;
      }
      // Retry on other errors
      return true;
    },
    ...config
  };

  return useRetry(chatOperation, retryConfig);
}