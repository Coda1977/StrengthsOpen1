import { createWorker, Worker } from 'tesseract.js';

interface ResourceTracker {
  workers: Set<Worker>;
  buffers: Set<Buffer>;
  timeouts: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Interval>;
}

class ResourceManager {
  private resources: ResourceTracker = {
    workers: new Set(),
    buffers: new Set(),
    timeouts: new Set(),
    intervals: new Set()
  };

  private cleanupTimeout: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_WORKER_LIFETIME = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.startPeriodicCleanup();
    this.setupProcessCleanup();
  }

  async createOCRWorker(): Promise<Worker> {
    try {
      const worker = await createWorker('eng', {
        // Optimize for memory usage
        cacheMethod: 'none',
        gzip: false,
      });

      // Track the worker
      this.resources.workers.add(worker);

      // Set automatic cleanup after max lifetime
      const cleanupTimer = setTimeout(() => {
        this.terminateWorker(worker);
      }, this.MAX_WORKER_LIFETIME);

      this.resources.timeouts.add(cleanupTimer);

      return worker;
    } catch (error) {
      console.error('Failed to create OCR worker:', error);
      throw new Error('OCR worker creation failed');
    }
  }

  async terminateWorker(worker: Worker): Promise<void> {
    try {
      if (this.resources.workers.has(worker)) {
        await worker.terminate();
        this.resources.workers.delete(worker);
      }
    } catch (error) {
      console.error('Error terminating OCR worker:', error);
      // Force remove from tracking even if termination failed
      this.resources.workers.delete(worker);
    }
  }

  trackBuffer(buffer: Buffer): void {
    this.resources.buffers.add(buffer);
    
    // Auto-cleanup buffer after 10 minutes
    const cleanupTimer = setTimeout(() => {
      this.releaseBuffer(buffer);
    }, 10 * 60 * 1000);

    this.resources.timeouts.add(cleanupTimer);
  }

  releaseBuffer(buffer: Buffer): void {
    if (this.resources.buffers.has(buffer)) {
      this.resources.buffers.delete(buffer);
      // Force garbage collection hint
      if (global.gc) {
        global.gc();
      }
    }
  }

  trackTimeout(timeout: NodeJS.Timeout): void {
    this.resources.timeouts.add(timeout);
  }

  clearTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.resources.timeouts.delete(timeout);
  }

  trackInterval(interval: NodeJS.Interval): void {
    this.resources.intervals.add(interval);
  }

  clearInterval(interval: NodeJS.Interval): void {
    clearInterval(interval);
    this.resources.intervals.delete(interval);
  }

  private startPeriodicCleanup(): void {
    this.cleanupTimeout = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private async performCleanup(): Promise<void> {
    console.log('Performing resource cleanup...');

    // Clean up orphaned workers
    const workersToTerminate = Array.from(this.resources.workers);
    for (const worker of workersToTerminate) {
      try {
        await this.terminateWorker(worker);
      } catch (error) {
        console.error('Error during worker cleanup:', error);
      }
    }

    // Clean up expired timeouts
    for (const timeout of this.resources.timeouts) {
      try {
        clearTimeout(timeout);
      } catch (error) {
        console.error('Error clearing timeout:', error);
      }
    }
    this.resources.timeouts.clear();

    // Clean up intervals
    for (const interval of this.resources.intervals) {
      try {
        clearInterval(interval);
      } catch (error) {
        console.error('Error clearing interval:', error);
      }
    }
    this.resources.intervals.clear();

    // Release tracked buffers
    this.resources.buffers.clear();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    console.log(`Cleanup completed. Remaining workers: ${this.resources.workers.size}`);
  }

  private setupProcessCleanup(): void {
    const cleanup = async () => {
      console.log('Process cleanup initiated...');
      await this.performCleanup();
      
      if (this.cleanupTimeout) {
        clearInterval(this.cleanupTimeout);
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('beforeExit', cleanup);
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception, cleaning up resources:', error);
      cleanup();
    });
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection, cleaning up resources:', reason);
      cleanup();
    });
  }

  // Method to get resource usage stats
  getResourceStats() {
    return {
      activeWorkers: this.resources.workers.size,
      trackedBuffers: this.resources.buffers.size,
      activeTimeouts: this.resources.timeouts.size,
      activeIntervals: this.resources.intervals.size,
      memoryUsage: process.memoryUsage()
    };
  }

  // Emergency cleanup method
  async emergencyCleanup(): Promise<void> {
    console.log('Emergency cleanup initiated...');
    await this.performCleanup();
  }
}

// Singleton instance
export const resourceManager = new ResourceManager();

// OCR worker pool for better resource management
class OCRWorkerPool {
  private pool: Worker[] = [];
  private readonly MAX_POOL_SIZE = 2;
  private readonly WORKER_IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes
  private busyWorkers = new Set<Worker>();

  async getWorker(): Promise<Worker> {
    // Try to get an idle worker from pool
    const idleWorker = this.pool.find(worker => !this.busyWorkers.has(worker));
    
    if (idleWorker) {
      this.busyWorkers.add(idleWorker);
      return idleWorker;
    }

    // Create new worker if pool not full
    if (this.pool.length < this.MAX_POOL_SIZE) {
      const worker = await resourceManager.createOCRWorker();
      this.pool.push(worker);
      this.busyWorkers.add(worker);
      
      // Set idle timeout for the worker
      const idleTimeout = setTimeout(() => {
        this.removeWorkerFromPool(worker);
      }, this.WORKER_IDLE_TIMEOUT);
      
      resourceManager.trackTimeout(idleTimeout);
      
      return worker;
    }

    // Wait for a worker to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for OCR worker'));
      }, 30000); // 30 second timeout

      const checkForWorker = () => {
        const availableWorker = this.pool.find(worker => !this.busyWorkers.has(worker));
        if (availableWorker) {
          clearTimeout(timeout);
          this.busyWorkers.add(availableWorker);
          resolve(availableWorker);
        } else {
          setTimeout(checkForWorker, 100);
        }
      };

      checkForWorker();
    });
  }

  releaseWorker(worker: Worker): void {
    this.busyWorkers.delete(worker);
  }

  private async removeWorkerFromPool(worker: Worker): Promise<void> {
    const index = this.pool.indexOf(worker);
    if (index > -1) {
      this.pool.splice(index, 1);
      this.busyWorkers.delete(worker);
      await resourceManager.terminateWorker(worker);
    }
  }

  async cleanup(): Promise<void> {
    for (const worker of this.pool) {
      await resourceManager.terminateWorker(worker);
    }
    this.pool.length = 0;
    this.busyWorkers.clear();
  }
}

export const ocrWorkerPool = new OCRWorkerPool();