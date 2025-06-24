import { useEffect, useRef, useCallback } from 'react';

// Custom hook for managing component cleanup
export function useCleanup() {
  const cleanupFunctions = useRef<(() => void)[]>([]);
  const timeouts = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervals = useRef<Set<NodeJS.Interval>>(new Set());
  const abortControllers = useRef<Set<AbortController>>(new Set());

  // Add a cleanup function
  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  // Create a timeout that will be automatically cleaned up
  const createTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const timeout = setTimeout(() => {
      timeouts.current.delete(timeout);
      callback();
    }, delay);
    
    timeouts.current.add(timeout);
    return timeout;
  }, []);

  // Create an interval that will be automatically cleaned up
  const createInterval = useCallback((callback: () => void, delay: number): NodeJS.Interval => {
    const interval = setInterval(callback, delay);
    intervals.current.add(interval);
    return interval;
  }, []);

  // Create an AbortController that will be automatically cleaned up
  const createAbortController = useCallback((): AbortController => {
    const controller = new AbortController();
    abortControllers.current.add(controller);
    return controller;
  }, []);

  // Manual cleanup function
  const cleanup = useCallback(() => {
    // Run all cleanup functions
    cleanupFunctions.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    });
    cleanupFunctions.current = [];

    // Clear all timeouts
    timeouts.current.forEach(timeout => {
      try {
        clearTimeout(timeout);
      } catch (error) {
        console.error('Error clearing timeout:', error);
      }
    });
    timeouts.current.clear();

    // Clear all intervals
    intervals.current.forEach(interval => {
      try {
        clearInterval(interval);
      } catch (error) {
        console.error('Error clearing interval:', error);
      }
    });
    intervals.current.clear();

    // Abort all controllers
    abortControllers.current.forEach(controller => {
      try {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      } catch (error) {
        console.error('Error aborting controller:', error);
      }
    });
    abortControllers.current.clear();
  }, []);

  // Cleanup on component unmount - don't include cleanup in dependencies to avoid loops
  useEffect(() => {
    return () => {
      // Run all cleanup functions
      cleanupFunctions.current.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      });
      cleanupFunctions.current = [];

      // Clear all timeouts
      timeouts.current.forEach(timeout => {
        try {
          clearTimeout(timeout);
        } catch (error) {
          console.error('Error clearing timeout:', error);
        }
      });
      timeouts.current.clear();

      // Clear all intervals
      intervals.current.forEach(interval => {
        try {
          clearInterval(interval);
        } catch (error) {
          console.error('Error clearing interval:', error);
        }
      });
      intervals.current.clear();

      // Abort all controllers
      abortControllers.current.forEach(controller => {
        try {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        } catch (error) {
          console.error('Error aborting controller:', error);
        }
      });
      abortControllers.current.clear();
    };
  }, []); // Empty dependency array to prevent recreation

  return {
    addCleanup,
    createTimeout,
    createInterval,
    createAbortController,
    cleanup
  };
}

// Hook for managing file uploads with cleanup
export function useFileUploadCleanup() {
  const { addCleanup, createAbortController } = useCleanup();
  const activeUploads = useRef<Set<string>>(new Set());

  const startUpload = useCallback((uploadId: string): AbortController => {
    const controller = createAbortController();
    activeUploads.current.add(uploadId);
    
    addCleanup(() => {
      if (activeUploads.current.has(uploadId)) {
        activeUploads.current.delete(uploadId);
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }
    });

    return controller;
  }, [addCleanup, createAbortController]);

  const finishUpload = useCallback((uploadId: string) => {
    activeUploads.current.delete(uploadId);
  }, []);

  const getActiveUploadCount = useCallback(() => {
    return activeUploads.current.size;
  }, []);

  return {
    startUpload,
    finishUpload,
    getActiveUploadCount
  };
}

// Hook for managing event listeners with automatic cleanup
export function useEventListener<T extends EventTarget>(
  target: T | null,
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
) {
  const { addCleanup } = useCleanup();
  const savedHandler = useRef<EventListener>();

  // Update saved handler when handler changes
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!target) return;

    // Create event listener that calls current handler
    const eventListener: EventListener = (event) => {
      if (savedHandler.current) {
        savedHandler.current(event);
      }
    };

    // Add event listener
    target.addEventListener(event, eventListener, options);

    // Add cleanup function
    addCleanup(() => {
      target.removeEventListener(event, eventListener, options);
    });
  }, [target, event, options, addCleanup]);
}

// Hook for managing resize observer with cleanup
export function useResizeObserver(
  target: Element | null,
  callback: ResizeObserverCallback
) {
  const { addCleanup } = useCleanup();
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!target) return;

    const resizeObserver = new ResizeObserver((entries, observer) => {
      callbackRef.current(entries, observer);
    });

    resizeObserver.observe(target);

    addCleanup(() => {
      resizeObserver.disconnect();
    });
  }, [target, addCleanup]);
}

// Hook for managing intersection observer with cleanup
export function useIntersectionObserver(
  target: Element | null,
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  const { addCleanup } = useCleanup();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!target) return;

    const intersectionObserver = new IntersectionObserver((entries, observer) => {
      callbackRef.current(entries, observer);
    }, options);

    intersectionObserver.observe(target);

    addCleanup(() => {
      intersectionObserver.disconnect();
    });
  }, [target, options, addCleanup]);
}