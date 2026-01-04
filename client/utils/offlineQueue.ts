/**
 * Offline Queue Manager
 * Handles queuing actions when offline and syncing when back online
 */

interface QueuedAction {
  id: string
  type: string
  data: any
  url: string
  method: string
  headers: Record<string, string>
  timestamp: number
  retryCount: number
  maxRetries: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface SyncResult {
  successful: number
  failed: number
  total: number
  errors: string[]
}

class OfflineQueueManager {
  private queue: QueuedAction[] = []
  private isOnline: boolean = navigator.onLine
  private isProcessing: boolean = false
  private syncInProgress: boolean = false

  constructor() {
    this.loadQueueFromStorage()
    this.setupNetworkListeners()
    this.setupVisibilityListeners()
    this.startPeriodicSync()
  }

  /**
   * Add action to offline queue
   */
  addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>): string {
    const queuedAction: QueuedAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      ...action
    }

    this.queue.push(queuedAction)
    this.saveQueueToStorage()

    // Sort by priority (critical first)
    this.sortQueueByPriority()

    // Notify UI
    this.notifyQueueUpdate()

    console.log(`📋 Added to offline queue: ${action.type}`)

    // Try to sync immediately if online
    if (this.isOnline && !this.syncInProgress) {
      this.processQueue()
    }

    return queuedAction.id
  }

  /**
   * Process the offline queue
   */
  async processQueue(): Promise<SyncResult> {
    if (this.isProcessing || this.syncInProgress || this.queue.length === 0) {
      return { successful: 0, failed: 0, total: 0, errors: [] }
    }

    this.isProcessing = true
    this.syncInProgress = true

    console.log(`🔄 Processing offline queue (${this.queue.length} actions)...`)

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      total: this.queue.length,
      errors: []
    }

    // Process high priority actions first
    const criticalActions = this.queue.filter(a => a.priority === 'critical')
    const highPriorityActions = this.queue.filter(a =>
      a.priority === 'high' || a.priority === 'medium'
    )
    const lowPriorityActions = this.queue.filter(a => a.priority === 'low')

    const allActions = [...criticalActions, ...highPriorityActions, ...lowPriorityActions]

    for (const action of allActions) {
      try {
        const success = await this.executeAction(action)

        if (success) {
          result.successful++
          this.removeFromQueue(action.id)
          console.log(`✅ Synced action: ${action.type}`)
        } else {
          result.failed++
          action.retryCount++

          if (action.retryCount >= action.maxRetries) {
            result.errors.push(`Max retries exceeded for ${action.type}`)
            this.removeFromQueue(action.id)
          } else {
            console.warn(`⚠️ Action failed, will retry: ${action.type} (${action.retryCount}/${action.maxRetries})`)
          }
        }
      } catch (error) {
        result.failed++
        action.retryCount++

        const errorMsg = `${action.type}: ${error.message}`
        result.errors.push(errorMsg)

        if (action.retryCount >= action.maxRetries) {
          console.error(`❌ Max retries exceeded, removing action: ${action.type}`)
          this.removeFromQueue(action.id)
        } else {
          console.warn(`⚠️ Action failed with error: ${errorMsg}`)
        }
      }

      // Small delay between actions to avoid overwhelming the server
      await this.delay(100)
    }

    this.isProcessing = false
    this.syncInProgress = false

    // Save updated queue
    this.saveQueueToStorage()

    // Notify UI of sync completion
    this.notifySyncComplete(result)

    console.log(`🔄 Queue processing complete: ${result.successful}/${result.total} successful`)

    return result
  }

  /**
   * Execute a queued action
   */
  private async executeAction(action: QueuedAction): Promise<boolean> {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...action.headers
        },
        body: action.data ? JSON.stringify(action.data) : undefined
      })

      return response.ok
    } catch (error) {
      console.warn(`Failed to execute action ${action.type}:`, error.message)
      return false
    }
  }

  /**
   * Remove action from queue
   */
  private removeFromQueue(actionId: string) {
    const index = this.queue.findIndex(a => a.id === actionId)
    if (index >= 0) {
      this.queue.splice(index, 1)
      this.saveQueueToStorage()
      this.notifyQueueUpdate()
    }
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority() {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

    this.queue.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.timestamp - b.timestamp // FIFO for same priority
    })
  }

  /**
   * Set up network listeners
   */
  private setupNetworkListeners() {
    const updateOnlineStatus = () => {
      const wasOffline = !this.isOnline
      this.isOnline = navigator.onLine

      if (this.isOnline && wasOffline) {
        console.log('🌐 Back online, processing offline queue...')
        this.processQueue()
      } else if (!this.isOnline) {
        console.log('📱 Gone offline, actions will be queued')
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    updateOnlineStatus()
  }

  /**
   * Set up page visibility listeners
   */
  private setupVisibilityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline && this.queue.length > 0) {
        // Page became visible, try to sync
        this.processQueue()
      }
    })
  }

  /**
   * Start periodic sync attempts
   */
  private startPeriodicSync() {
    // Try to sync every 5 minutes when online
    setInterval(() => {
      if (this.isOnline && this.queue.length > 0 && !this.syncInProgress) {
        this.processQueue()
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Load queue from localStorage
   */
  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('offline-queue')
      if (stored) {
        this.queue = JSON.parse(stored)
        this.sortQueueByPriority()
        console.log(`📋 Loaded ${this.queue.length} queued actions from storage`)
      }
    } catch (error) {
      console.warn('Failed to load offline queue from storage:', error.message)
      this.queue = []
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueueToStorage() {
    try {
      localStorage.setItem('offline-queue', JSON.stringify(this.queue))
    } catch (error) {
      console.warn('Failed to save offline queue to storage:', error.message)
    }
  }

  /**
   * Notify UI of queue updates
   */
  private notifyQueueUpdate() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-queue-update', {
        detail: {
          queueLength: this.queue.length,
          isProcessing: this.isProcessing,
          isOnline: this.isOnline
        }
      }))
    }
  }

  /**
   * Notify UI of sync completion
   */
  private notifySyncComplete(result: SyncResult) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sync-complete', {
        detail: result
      }))
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      syncInProgress: this.syncInProgress,
      byPriority: this.queue.reduce((acc, action) => {
        acc[action.priority] = (acc[action.priority] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byType: this.queue.reduce((acc, action) => {
        acc[action.type] = (acc[action.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      oldestAction: this.queue.length > 0 ? Math.min(...this.queue.map(a => a.timestamp)) : null,
      newestAction: this.queue.length > 0 ? Math.max(...this.queue.map(a => a.timestamp)) : null
    }
  }

  /**
   * Clear the queue (removes all pending actions)
   */
  clearQueue() {
    this.queue = []
    this.saveQueueToStorage()
    this.notifyQueueUpdate()
    console.log('🧹 Offline queue cleared')
  }

  /**
   * Force sync attempt
   */
  async forceSync(): Promise<SyncResult> {
    console.log('🔄 Forcing offline queue sync...')
    return this.processQueue()
  }

  /**
   * Add common action types as convenience methods
   */
  addContentSave(contentData: any, contentId?: string) {
    return this.addToQueue({
      type: 'save_content',
      data: { content: contentData, contentId },
      url: contentId ? `/api/content/${contentId}` : '/api/content',
      method: contentId ? 'PUT' : 'POST',
      headers: {},
      priority: 'high',
      maxRetries: 5
    })
  }

  addAnalyticsEvent(eventData: any) {
    return this.addToQueue({
      type: 'analytics_event',
      data: eventData,
      url: '/api/analytics/events',
      method: 'POST',
      headers: {},
      priority: 'low',
      maxRetries: 2
    })
  }

  addUserAction(actionData: any) {
    return this.addToQueue({
      type: 'user_action',
      data: actionData,
      url: '/api/user/actions',
      method: 'POST',
      headers: {},
      priority: 'medium',
      maxRetries: 3
    })
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create singleton instance
const offlineQueue = new OfflineQueueManager()

// Global offline queue functions for components
if (typeof window !== 'undefined') {
  (window as any).offlineQueue = {
    addToQueue: (action: any) => offlineQueue.addToQueue(action),
    getStats: () => offlineQueue.getStats(),
    clearQueue: () => offlineQueue.clearQueue(),
    forceSync: () => offlineQueue.forceSync(),
    addContentSave: (contentData: any, contentId?: string) =>
      offlineQueue.addContentSave(contentData, contentId),
    addAnalyticsEvent: (eventData: any) =>
      offlineQueue.addAnalyticsEvent(eventData),
    addUserAction: (actionData: any) =>
      offlineQueue.addUserAction(actionData)
  }
}

export default offlineQueue


