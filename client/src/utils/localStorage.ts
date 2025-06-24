// Utility functions for handling localStorage operations with error handling

export interface LocalStorageOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  corrupted?: boolean;
}

export class LocalStorageManager {
  private static readonly CHAT_HISTORY_KEY = 'chat-history';
  private static readonly MIGRATION_STATUS_KEY = 'migration-status';

  // Safe getter for localStorage data
  static safeGet<T>(key: string): LocalStorageOperationResult<T> {
    try {
      const data = localStorage.getItem(key);
      if (data === null) {
        return { success: true, data: undefined };
      }

      const parsed = JSON.parse(data);
      return { success: true, data: parsed };
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        corrupted: true 
      };
    }
  }

  // Safe setter for localStorage data
  static safeSet<T>(key: string, value: T): LocalStorageOperationResult<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { success: true };
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Remove localStorage item safely
  static safeRemove(key: string): LocalStorageOperationResult<void> {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Get chat history with corruption handling
  static getChatHistory(): LocalStorageOperationResult<any[]> {
    const result = this.safeGet<any[]>(this.CHAT_HISTORY_KEY);
    
    if (!result.success) {
      return result;
    }

    // Validate data structure
    if (result.data && !Array.isArray(result.data)) {
      return {
        success: false,
        error: 'Chat history data is not an array',
        corrupted: true
      };
    }

    return {
      success: true,
      data: result.data || []
    };
  }

  // Check if migration has been completed
  static getMigrationStatus(): LocalStorageOperationResult<{ completed: boolean; timestamp?: string }> {
    const result = this.safeGet<{ completed: boolean; timestamp?: string }>(this.MIGRATION_STATUS_KEY);
    
    return {
      success: true,
      data: result.data || { completed: false }
    };
  }

  // Mark migration as completed
  static setMigrationCompleted(): LocalStorageOperationResult<void> {
    return this.safeSet(this.MIGRATION_STATUS_KEY, {
      completed: true,
      timestamp: new Date().toISOString()
    });
  }

  // Clear chat history after successful migration
  static clearChatHistory(): LocalStorageOperationResult<void> {
    return this.safeRemove(this.CHAT_HISTORY_KEY);
  }

  // Attempt to recover corrupted data
  static attemptDataRecovery(): LocalStorageOperationResult<any[]> {
    try {
      // Try to get raw localStorage data
      const rawData = localStorage.getItem(this.CHAT_HISTORY_KEY);
      if (!rawData) {
        return { success: true, data: [] };
      }

      // Try different recovery strategies
      const recoveryStrategies = [
        // Strategy 1: Try parsing as-is (might work if it's just a display issue)
        () => JSON.parse(rawData),
        
        // Strategy 2: Try fixing common JSON issues
        () => {
          let fixedData = rawData;
          // Fix unclosed brackets/braces
          const openBraces = (fixedData.match(/\{/g) || []).length;
          const closeBraces = (fixedData.match(/\}/g) || []).length;
          const openBrackets = (fixedData.match(/\[/g) || []).length;
          const closeBrackets = (fixedData.match(/\]/g) || []).length;
          
          if (openBraces > closeBraces) {
            fixedData += '}';
          }
          if (openBrackets > closeBrackets) {
            fixedData += ']';
          }
          
          return JSON.parse(fixedData);
        },

        // Strategy 3: Extract valid conversation objects
        () => {
          const conversationPattern = /\{[^{}]*"title"[^{}]*"messages"[^{}]*\}/g;
          const matches = rawData.match(conversationPattern);
          if (matches) {
            return matches.map(match => JSON.parse(match)).filter(obj => obj.title && obj.messages);
          }
          return [];
        }
      ];

      for (const strategy of recoveryStrategies) {
        try {
          const recovered = strategy();
          if (Array.isArray(recovered)) {
            return { success: true, data: recovered };
          }
        } catch (error) {
          // Try next strategy
          continue;
        }
      }

      return {
        success: false,
        error: 'Could not recover data using any strategy',
        corrupted: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown recovery error',
        corrupted: true
      };
    }
  }

  // Check localStorage availability and health
  static checkStorageHealth(): {
    available: boolean;
    quotaExceeded: boolean;
    estimatedSize: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let available = false;
    let quotaExceeded = false;
    let estimatedSize = 0;

    try {
      // Test basic availability
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      available = true;

      // Estimate current usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      estimatedSize = totalSize;

      // Test quota
      try {
        const testData = 'x'.repeat(1024 * 1024); // 1MB test
        localStorage.setItem('__quota_test__', testData);
        localStorage.removeItem('__quota_test__');
      } catch (quotaError) {
        quotaExceeded = true;
        errors.push('localStorage quota exceeded or nearly full');
      }

    } catch (error) {
      available = false;
      errors.push(error instanceof Error ? error.message : 'Unknown storage error');
    }

    return {
      available,
      quotaExceeded,
      estimatedSize,
      errors
    };
  }
}