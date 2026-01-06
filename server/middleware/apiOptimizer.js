/**
 * API Optimization Middleware
 * Advanced compression, caching, and performance enhancements
 */

const compression = require('compression')
const zlib = require('zlib')

// Compression middleware with custom settings
const compressionMiddleware = compression({
  level: 6, // Balance between speed and compression
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false
    }

    // Use compression filter function
    return compression.filter(req, res)
  },
  // Custom compression function for better performance
  strategy: zlib.Z_DEFAULT_STRATEGY
})

// Response time tracking middleware
const responseTimeMiddleware = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const method = req.method
    const url = req.originalUrl || req.url
    const status = res.statusCode

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`🐌 Slow API request: ${method} ${url} took ${duration}ms`)
    }

    // Track in APM if available
    if (global.apmMonitor) {
      global.apmMonitor.recordApiCall(method, url, duration, status, req.user?.id)
    }
  })

  next()
}

// Smart caching headers middleware
const cachingMiddleware = (req, res, next) => {
  const method = req.method
  const url = req.originalUrl || req.url

  // Only add caching headers for GET requests
  if (method !== 'GET') {
    return next()
  }

  // Set appropriate cache headers based on endpoint type
  if (url.includes('/health') || url.includes('/status')) {
    // Health endpoints - short cache
    res.set({
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
      'CDN-Cache-Control': 'max-age=30',
      'Vercel-CDN-Cache-Control': 'max-age=30'
    })
  } else if (url.includes('/analytics') || url.includes('/metrics')) {
    // Analytics/metrics - no cache
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
  } else if (url.includes('/content') || url.includes('/library')) {
    // Content endpoints - medium cache
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'max-age=300',
      'Vercel-CDN-Cache-Control': 'max-age=300'
    })
  } else if (url.includes('/uploads') || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    // Static assets - long cache
    res.set({
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
      'CDN-Cache-Control': 'max-age=86400',
      'Vercel-CDN-Cache-Control': 'max-age=86400'
    })
  } else {
    // API endpoints - short cache with revalidation
    res.set({
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      'CDN-Cache-Control': 'max-age=60',
      'Vercel-CDN-Cache-Control': 'max-age=60'
    })
  }

  next()
}

// Request optimization middleware
const requestOptimizationMiddleware = (req, res, next) => {
  // Add request ID for tracing
  req.id = req.headers['x-request-id'] ||
           req.headers['request-id'] ||
           `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  res.set('X-Request-ID', req.id)

  // Add timestamp for performance tracking
  req.startTime = Date.now()

  // Optimize JSON parsing for large payloads
  if (req.headers['content-type']?.includes('application/json') &&
      parseInt(req.headers['content-length'] || '0') > 1024 * 1024) { // > 1MB
    console.warn(`📊 Large JSON payload detected: ${req.headers['content-length']} bytes`)
  }

  // Add ETag support for conditional requests
  if (req.method === 'GET' && !req.headers['if-none-match']) {
    // Could add ETag generation here for better caching
  }

  next()
}

// Response optimization middleware
const responseOptimizationMiddleware = (req, res, next) => {
  const originalJson = res.json
  const originalSend = res.send

  // Enhanced JSON response with metadata
  res.json = function(data) {
    // Add response metadata in development
    if (process.env.NODE_ENV !== 'production') {
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        data._meta = {
          requestId: req.id,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - req.startTime
        }
      }
    }

    return originalJson.call(this, data)
  }

  // Enhanced send with compression hints
  res.send = function(data) {
    // Add compression hints for large responses
    if (typeof data === 'string' && data.length > 10240) { // > 10KB
      res.set('X-Compression-Suitable', 'true')
    }

    return originalSend.call(this, data)
  }

  next()
}

// Rate limiting enhancement middleware
const rateLimitEnhancementMiddleware = (req, res, next) => {
  // Add custom headers for rate limiting feedback
  res.set({
    'X-RateLimit-Policy': 'sliding-window',
    'X-RateLimit-Max': '100',
    'X-RateLimit-Window': '900000' // 15 minutes
  })

  // Track rate limit usage (if available from rate limiter)
  if (res.locals?.rateLimit) {
    const { remaining, resetTime } = res.locals.rateLimit
    res.set({
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': resetTime
    })

    // Warn when approaching limit
    if (remaining < 10) {
      console.warn(`⚠️ Rate limit warning: ${remaining} requests remaining for ${req.ip}`)
    }
  }

  next()
}

// CORS enhancement for API optimization
const corsEnhancementMiddleware = (req, res, next) => {
  // Enhanced CORS for better API performance
  res.set({
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://click-app.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-ID',
    'Access-Control-Max-Age': '86400' // 24 hours
  })

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  next()
}

// Main API optimization middleware
const apiOptimizer = [
  // Security and CORS first
  corsEnhancementMiddleware,

  // Request optimization
  requestOptimizationMiddleware,

  // Compression (should be early)
  compressionMiddleware,

  // Caching headers
  cachingMiddleware,

  // Response optimization
  responseOptimizationMiddleware,

  // Rate limiting enhancements
  rateLimitEnhancementMiddleware,

  // Response time tracking (last)
  responseTimeMiddleware
]

module.exports = apiOptimizer





