/**
 * Advanced Cache Manager
 * Handles different caching strategies and cache management
 */

interface CacheConfig {
  name: string
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'cache-only' | 'network-only'
  maxAge?: number // in milliseconds
  maxEntries?: number
  priority?: number // higher priority caches are preferred
}

interface CacheEntry {
  url: string
  response: Response
  timestamp: number
  expires?: number
  priority: number
}

class AdvancedCacheManager {
  private caches: Map<string, CacheConfig> = new Map()
  private entries: Map<string, CacheEntry[]> = new Map()

  constructor() {
    this.initializeDefaultCaches()
    this.setupCacheCleanup()
  }

  /**
   * Initialize default cache configurations
   */
  private initializeDefaultCaches() {
    // Static assets - rarely change
    this.addCache({
      name: 'static-assets',
      strategy: 'cache-first',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxEntries: 100,
      priority: 1
    })

    // API responses - frequently updated
    this.addCache({
      name: 'api-responses',
      strategy: 'network-first',
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxEntries: 50,
      priority: 2
    })

    // User data - personalized content
    this.addCache({
      name: 'user-data',
      strategy: 'network-first',
      maxAge: 10 * 60 * 1000, // 10 minutes
      maxEntries: 20,
      priority: 3
    })

    // Images - large files with expiration
    this.addCache({
      name: 'images',
      strategy: 'cache-first',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxEntries: 200,
      priority: 1
    })

    // Offline content - available without network
    this.addCache({
      name: 'offline-content',
      strategy: 'cache-only',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxEntries: 500,
      priority: 4
    })
  }

  /**
   * Add a cache configuration
   */
  addCache(config: CacheConfig) {
    this.caches.set(config.name, config)
    this.entries.set(config.name, [])
  }

  /**
   * Get cache configuration
   */
  getCache(name: string): CacheConfig | undefined {
    return this.caches.get(name)
  }

  /**
   * Store response in appropriate cache
   */
  async store(url: string, response: Response, cacheName?: string): Promise<void> {
    const config = cacheName ? this.caches.get(cacheName) : this.findCacheForUrl(url)
    if (!config) return

    const entry: CacheEntry = {
      url,
      response: response.clone(),
      timestamp: Date.now(),
      priority: config.priority || 1
    }

    if (config.maxAge) {
      entry.expires = Date.now() + config.maxAge
    }

    const cacheEntries = this.entries.get(config.name) || []

    // Remove existing entry for this URL
    const existingIndex = cacheEntries.findIndex(e => e.url === url)
    if (existingIndex >= 0) {
      cacheEntries.splice(existingIndex, 1)
    }

    // Add new entry
    cacheEntries.push(entry)

    // Enforce max entries limit
    if (config.maxEntries && cacheEntries.length > config.maxEntries) {
      // Remove lowest priority entries first
      cacheEntries.sort((a, b) => a.priority - b.priority)
      cacheEntries.splice(0, cacheEntries.length - config.maxEntries)
    }

    this.entries.set(config.name, cacheEntries)

    // Also store in browser Cache API if available
    if ('caches' in window) {
      try {
        const cache = await caches.open(`click-${config.name}`)
        await cache.put(url, response)
      } catch (error) {
        console.warn('Failed to store in Cache API:', error)
      }
    }
  }

  /**
   * Retrieve response from cache
   */
  async retrieve(url: string, cacheName?: string): Promise<Response | null> {
    const config = cacheName ? this.caches.get(cacheName) : this.findCacheForUrl(url)
    if (!config) return null

    const cacheEntries = this.entries.get(config.name) || []
    const entry = cacheEntries.find(e => e.url === url)

    if (!entry) {
      // Try browser Cache API
      if ('caches' in window) {
        try {
          const cache = await caches.open(`click-${config.name}`)
          const cachedResponse = await cache.match(url)
          if (cachedResponse) return cachedResponse
        } catch (error) {
          console.warn('Failed to retrieve from Cache API:', error)
        }
      }
      return null
    }

    // Check if entry has expired
    if (entry.expires && Date.now() > entry.expires) {
      // Remove expired entry
      const index = cacheEntries.indexOf(entry)
      if (index >= 0) {
        cacheEntries.splice(index, 1)
        this.entries.set(config.name, cacheEntries)
      }
      return null
    }

    // Update access timestamp for LRU
    entry.timestamp = Date.now()

    return entry.response.clone()
  }

  /**
   * Execute cache strategy for a request
   */
  async executeStrategy(request: Request, strategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate'): Promise<Response> {
    const config = this.findCacheForUrl(request.url)
    const actualStrategy = strategy || config?.strategy || 'network-first'

    switch (actualStrategy) {
      case 'cache-first':
        return this.cacheFirstStrategy(request)
      case 'network-first':
        return this.networkFirstStrategy(request)
      case 'stale-while-revalidate':
        return this.staleWhileRevalidateStrategy(request)
      case 'cache-only':
        return this.cacheOnlyStrategy(request)
      case 'network-only':
        return this.networkOnlyStrategy(request)
      default:
        return this.networkFirstStrategy(request)
    }
  }

  /**
   * Cache First Strategy
   */
  private async cacheFirstStrategy(request: Request): Promise<Response> {
    const cached = await this.retrieve(request.url)
    if (cached) {
      return cached
    }

    try {
      const networkResponse = await fetch(request)
      if (networkResponse.ok) {
        await this.store(request.url, networkResponse.clone())
      }
      return networkResponse
    } catch (error) {
      throw new Error(`Network request failed and no cache available: ${(error as Error).message}`)
    }
  }

  /**
   * Network First Strategy
   */
  private async networkFirstStrategy(request: Request): Promise<Response> {
    try {
      const networkResponse = await fetch(request)
      if (networkResponse.ok) {
        await this.store(request.url, networkResponse.clone())
      }
      return networkResponse
    } catch (error) {
      const cached = await this.retrieve(request.url)
      if (cached) {
        return cached
      }
      throw new Error(`Network request failed and no cache available: ${(error as Error).message}`)
    }
  }

  /**
   * Stale While Revalidate Strategy
   */
  private async staleWhileRevalidateStrategy(request: Request): Promise<Response> {
    const cached = await this.retrieve(request.url)

    // Always try to update cache in background
    const networkPromise = fetch(request).then(async (response) => {
      if (response.ok) {
        await this.store(request.url, response.clone())
      }
      return response
    }).catch(error => {
      console.warn('Background revalidation failed:', error.message)
      return null
    })

    // Return cached response immediately if available
    if (cached) {
      return cached
    }

    // Wait for network response
    const networkResponse = await networkPromise
    if (networkResponse) {
      return networkResponse
    }

    throw new Error('No cached or network response available')
  }

  /**
   * Cache Only Strategy
   */
  private async cacheOnlyStrategy(request: Request): Promise<Response> {
    const cached = await this.retrieve(request.url)
    if (cached) {
      return cached
    }
    throw new Error('No cached response available')
  }

  /**
   * Network Only Strategy
   */
  private async networkOnlyStrategy(request: Request): Promise<Response> {
    return fetch(request)
  }

  /**
   * Find appropriate cache for URL
   */
  private findCacheForUrl(url: string): CacheConfig | undefined {
    const urlObj = new URL(url)

    // API endpoints
    if (urlObj.pathname.startsWith('/api/')) {
      if (urlObj.pathname.includes('/user/') || urlObj.pathname.includes('/profile')) {
        return this.caches.get('user-data')
      }
      return this.caches.get('api-responses')
    }

    // Images
    if (urlObj.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
      return this.caches.get('images')
    }

    // Static assets
    if (urlObj.pathname.match(/\.(css|js|woff|woff2|ttf)$/i) ||
        urlObj.pathname.startsWith('/_next/static/')) {
      return this.caches.get('static-assets')
    }

    // Default to API responses for unknown URLs
    return this.caches.get('api-responses')
  }

  /**
   * Set up periodic cache cleanup
   */
  private setupCacheCleanup() {
    // Clean up expired entries every hour
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 60 * 60 * 1000)

    // Clean up least recently used entries when storage is low
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        const usedBytes = estimate.usage || 0
        const availableBytes = estimate.quota || 0
        const usageRatio = usedBytes / availableBytes

        if (usageRatio > 0.8) { // 80% usage
          this.cleanupLRUEntries()
        }
      })
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries() {
    let cleaned = 0

    this.entries.forEach((entries, cacheName) => {
      const validEntries = entries.filter(entry => {
        if (entry.expires && Date.now() > entry.expires) {
          cleaned++
          return false
        }
        return true
      })

      this.entries.set(cacheName, validEntries)
    })

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`)
    }
  }

  /**
   * Clean up least recently used entries when storage is low
   */
  private cleanupLRUEntries() {
    let cleaned = 0
    const maxEntries = 50 // Keep only 50 entries per cache

    this.entries.forEach((entries, cacheName) => {
      if (entries.length > maxEntries) {
        // Sort by last access time and keep most recent
        entries.sort((a, b) => b.timestamp - a.timestamp)
        const keptEntries = entries.slice(0, maxEntries)
        cleaned += entries.length - maxEntries
        this.entries.set(cacheName, keptEntries)
      }
    })

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} LRU cache entries`)
    }
  }

  /**
   * Clear specific cache
   */
  async clearCache(cacheName: string): Promise<void> {
    this.entries.set(cacheName, [])

    // Also clear from browser Cache API
    if ('caches' in window) {
      try {
        await caches.delete(`click-${cacheName}`)
      } catch (error) {
        console.warn('Failed to clear Cache API:', error)
      }
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    const cacheNames = Array.from(this.caches.keys())
    for (const cacheName of cacheNames) {
      await this.clearCache(cacheName)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    this.caches.forEach((config, cacheName) => {
      const entries = this.entries.get(cacheName) || []
      const expired = entries.filter(e => e.expires && Date.now() > e.expires).length

      stats[cacheName] = {
        config,
        entries: entries.length,
        expired,
        valid: entries.length - expired,
        totalSize: this.estimateCacheSize(entries)
      }
    })

    return stats
  }

  /**
   * Estimate cache size (rough approximation)
   */
  private estimateCacheSize(entries: CacheEntry[]): string {
    // Rough estimation: assume average response size of 10KB
    const estimatedBytes = entries.length * 10240
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(estimatedBytes) / Math.log(1024))
    return Math.round(estimatedBytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Predictive prefetching based on user behavior
   */
  async enablePredictivePrefetching(userBehavior: {
    frequentlyVisited?: string[]
    commonTransitions?: Array<{from: string, to: string}>
    popularContent?: string[]
    userPreferences?: Record<string, any>
  }) {
    console.log('🔮 Enabling predictive prefetching...')

    // Prefetch frequently visited pages
    if (userBehavior.frequentlyVisited) {
      for (const url of userBehavior.frequentlyVisited.slice(0, 3)) {
        this.prefetchUrl(url, 'page', 2) // Medium priority
      }
    }

    // Prefetch common transitions
    if (userBehavior.commonTransitions) {
      for (const transition of userBehavior.commonTransitions.slice(0, 2)) {
        this.prefetchUrl(transition.to, 'transition', 1) // Low priority
      }
    }

    // Prefetch popular content
    if (userBehavior.popularContent) {
      for (const contentId of userBehavior.popularContent.slice(0, 5)) {
        this.prefetchUrl(`/api/content/${contentId}`, 'content', 3) // High priority
      }
    }

    console.log('✅ Predictive prefetching enabled')
  }

  /**
   * Prefetch a URL with priority
   */
  private async prefetchUrl(url: string, type: string, priority: number) {
    try {
      const response = await fetch(url, { priority: priority as any })
      if (response.ok) {
        await this.store(url, response, `predictive-${type}`)
        console.log(`🔮 Prefetched ${type}: ${url}`)
      }
    } catch (error) {
      console.warn(`⚠️ Prefetch failed for ${url}:`, (error as Error).message)
    }
  }

  /**
   * Smart cache invalidation based on patterns
   */
  async invalidateByPattern(pattern: RegExp | string, configName?: string) {
    console.log('🧹 Smart cache invalidation:', pattern)

    let invalidationCount = 0

    this.entries.forEach((entries, cacheName) => {
      if (configName && cacheName !== configName) return

      const filteredEntries = entries.filter(entry => {
        const matches = typeof pattern === 'string'
          ? entry.url.includes(pattern)
          : pattern.test(entry.url)

        if (matches) {
          invalidationCount++
          return false // Remove from cache
        }
        return true
      })

      this.entries.set(cacheName, filteredEntries)
    })

    // Also invalidate from browser Cache API
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      for (const cacheName of cacheNames) {
        if (configName && !cacheName.includes(configName)) continue

        const cache = await caches.open(cacheName)
        const requests = await cache.keys()

        for (const request of requests) {
          const matches = typeof pattern === 'string'
            ? request.url.includes(pattern)
            : pattern.test(request.url)

          if (matches) {
            await cache.delete(request)
            invalidationCount++
          }
        }
      }
    }

    console.log(`🧹 Invalidated ${invalidationCount} cache entries matching:`, pattern)
    return invalidationCount
  }

  /**
   * Cache warming for critical resources
   */
  async warmCache(criticalUrls: string[]) {
    console.log('🔥 Warming cache with critical resources...')

    const promises = criticalUrls.map(async (url) => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          await this.store(url, response, 'critical')
          return { url, success: true }
        }
      } catch (error) {
        console.warn(`⚠️ Cache warming failed for ${url}:`, (error as Error).message)
      }
      return { url, success: false }
    })

    const results = await Promise.allSettled(promises)
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length

    console.log(`🔥 Cache warming complete: ${successful}/${criticalUrls.length} resources cached`)
    return successful
  }

  /**
   * Background cache refresh for stale content
   */
  async refreshStaleContent() {
    console.log('🔄 Refreshing stale cache content...')

    let refreshed = 0

    this.caches.forEach(async (config, cacheName) => {
      if (config.strategy === 'stale-while-revalidate') {
        const entries = this.entries.get(cacheName) || []

        for (const entry of entries) {
          // Check if entry is stale (half of max age)
          const age = Date.now() - entry.timestamp
          const staleThreshold = (config.maxAge || 300000) / 2

          if (age > staleThreshold) {
            try {
              const response = await fetch(entry.url)
              if (response.ok) {
                await this.store(entry.url, response, cacheName)
                refreshed++
              }
            } catch (error) {
              console.warn(`⚠️ Background refresh failed for ${entry.url}:`, (error as Error).message)
            }
          }
        }
      }
    })

    console.log(`🔄 Background refresh complete: ${refreshed} entries updated`)
    return refreshed
  }

  /**
   * Cache analytics and insights
   */
  getCacheInsights() {
    const insights = {
      totalEntries: 0,
      totalSize: '0 B',
      hitRate: 0, // Would need to track hits/misses
      cacheEfficiency: 0,
      staleEntries: 0,
      expiringSoon: 0,
      byType: {} as Record<string, any>
    }

    let totalSizeBytes = 0

    this.entries.forEach((entries, cacheName) => {
      insights.byType[cacheName] = {
        entries: entries.length,
        size: this.estimateCacheSize(entries),
        stale: entries.filter(e => e.expires && Date.now() > e.expires).length,
        expiringSoon: entries.filter(e => e.expires && Date.now() > e.expires - 3600000).length // Next hour
      }

      insights.totalEntries += entries.length
      insights.staleEntries += insights.byType[cacheName].stale
      insights.expiringSoon += insights.byType[cacheName].expiringSoon

      // Rough size calculation
      totalSizeBytes += entries.length * 10240 // 10KB per entry
    })

    insights.totalSize = this.formatBytes(totalSizeBytes)
    insights.cacheEfficiency = insights.totalEntries > 0 ?
      ((insights.totalEntries - insights.staleEntries) / insights.totalEntries) * 100 : 0

    return insights
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimizeCache() {
    console.log('⚡ Optimizing cache...')

    const insights = this.getCacheInsights()

    // Remove stale entries
    if (insights.staleEntries > 0) {
      this.entries.forEach((entries, cacheName) => {
        const validEntries = entries.filter(e => !e.expires || Date.now() <= e.expires)
        this.entries.set(cacheName, validEntries)
      })
      console.log(`🗑️ Removed ${insights.staleEntries} stale entries`)
    }

    // Balance cache sizes
    this.caches.forEach((config, cacheName) => {
      if (config.maxEntries) {
        const entries = this.entries.get(cacheName) || []
        if (entries.length > config.maxEntries) {
          // Sort by priority and recency, keep top entries
          entries.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority
            return b.timestamp - a.timestamp
          })

          const keptEntries = entries.slice(0, config.maxEntries)
          this.entries.set(cacheName, keptEntries)

          console.log(`✂️ Trimmed ${cacheName} from ${entries.length} to ${keptEntries.length} entries`)
        }
      }
    })

    console.log('✅ Cache optimization complete')
  }

  /**
   * Export cache data for debugging
   */
  exportCacheData() {
    const data = {
      timestamp: new Date().toISOString(),
      caches: {} as Record<string, any>,
      insights: this.getCacheInsights()
    }

    this.entries.forEach((entries, cacheName) => {
      data.caches[cacheName] = entries.map(entry => ({
        url: entry.url,
        timestamp: entry.timestamp,
        expires: entry.expires,
        priority: entry.priority
      }))
    })

    return data
  }
}

  /**
   * Preload critical resources
   */
  async preloadCriticalResources(): Promise<void> {
    const criticalUrls = [
      '/api/health',
      '/api/user/profile',
      '/offline.html',
      '/manifest.json'
    ]

    console.log('🔄 Preloading critical resources...')

    const promises = criticalUrls.map(async (url) => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          await this.store(url, response, 'offline-content')
        }
      } catch (error) {
        console.warn(`Failed to preload ${url}:`, error.message)
      }
    })

    await Promise.allSettled(promises)
    console.log('✅ Critical resources preloaded')
  }

  /**
   * Enable offline mode
   */
  async enableOfflineMode(): Promise<void> {
    console.log('🔌 Enabling offline mode...')

    // Preload critical resources
    await this.preloadCriticalResources()

    // Notify service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'ENABLE_OFFLINE_MODE'
      })
    }

    console.log('✅ Offline mode enabled')
  }

  /**
   * Disable offline mode
   */
  async disableOfflineMode(): Promise<void> {
    console.log('🔌 Disabling offline mode...')

    // Clear offline cache
    await this.clearCache('offline-content')

    // Notify service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'DISABLE_OFFLINE_MODE'
      })
    }

    console.log('✅ Offline mode disabled')
  }
}

// Create singleton instance
const cacheManager = new AdvancedCacheManager()

// Global cache functions for components
if (typeof window !== 'undefined') {
  (window as any).cacheManager = {
    store: (url: string, response: Response, cacheName?: string) =>
      cacheManager.store(url, response, cacheName),
    retrieve: (url: string, cacheName?: string) =>
      cacheManager.retrieve(url, cacheName),
    executeStrategy: (request: Request, strategy?: string) =>
      cacheManager.executeStrategy(request, strategy as any),
    clearCache: (cacheName: string) =>
      cacheManager.clearCache(cacheName),
    clearAllCaches: () =>
      cacheManager.clearAllCaches(),
    getStats: () =>
      cacheManager.getStats(),
    enableOfflineMode: () =>
      cacheManager.enableOfflineMode(),
    disableOfflineMode: () =>
      cacheManager.disableOfflineMode(),
    preloadCriticalResources: () =>
      cacheManager.preloadCriticalResources()
  }
}

export default cacheManager
