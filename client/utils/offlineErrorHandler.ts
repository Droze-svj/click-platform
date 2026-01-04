// Offline Error Handler

interface QueuedRequest {
  url: string;
  body?: any;
  headers?: Record<string, string>;
  retryCount: number;
}

class OfflineErrorHandler {
  private queue: QueuedRequest[] = [];
  private maxRetries = 3;
  private retryDelay = 5000; // 5 seconds

  /**
   * Check if browser is online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  /**
   * Queue request for retry when online
   */
  queueRequest(request: Omit<QueuedRequest, 'timestamp' | 'retryCount'>): void {
    if (this.isOnline()) {
      return; // Don't queue if online
    }

    this.queue.push({
      ...request,
      retryCount: 0,
    });

    this.saveQueue();
  }

  /**
   * Process queued requests when back online
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline() || this.queue.length === 0) {
      return;
    }

    const requests = [...this.queue];
    this.queue = [];

    for (const request of requests) {
      try {
        await this.retryRequest(request);
      } catch (error) {
        // Re-queue if retries not exhausted
        if (request.retryCount < this.maxRetries) {
          request.retryCount++;
          this.queue.push(request);
        }
      }
    }

    this.saveQueue();
  }

  /**
   * Retry a queued request
   */
  private async retryRequest(request: QueuedRequest): Promise<void> {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers || {},
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('offlineRequestQueue', JSON.stringify(this.queue));
      } catch (error) {
        console.error('Failed to save offline queue', error);
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  loadQueue(): void {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('offlineRequestQueue');
        if (saved) {
          this.queue = JSON.parse(saved);
        }
      } catch (error) {
        console.error('Failed to load offline queue', error);
      }
    }
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Initialize offline handler
   */
  init(): void {
    this.loadQueue();

    // Listen for online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });

      // Process queue on load if online
      if (this.isOnline()) {
        this.processQueue();
      }
    }
  }
}

export const offlineErrorHandler = new OfflineErrorHandler();

// Initialize on import
if (typeof window !== 'undefined') {
  offlineErrorHandler.init();
}





