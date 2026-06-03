/**
 * Database Optimization Utilities
 * Connection pooling, indexing, and query optimization
 */

const mongoose = require('mongoose')
const logger = require('./logger')

class DatabaseOptimizer {
  constructor() {
    
    this.connectionPool = null
    this.performanceMetrics = {
      queryCount: 0,
      slowQueries: [],
      connectionPoolSize: 0,
      activeConnections: 0,
      indexesCreated: 0
    }
    
  }

  /**
   * Optimize MongoDB connection with advanced settings
   */
  async optimizeConnection(connectionString) {
    

    const options = {
      // Connection pool settings
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 10, // Maximum connection pool size
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 2,  // Minimum connection pool size
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering

      // Performance settings
      heartbeatFrequencyMS: 10000, // Check server every 10 seconds
      retryWrites: true, // Retry write operations
      retryReads: true, // Retry read operations

      // Monitoring and logging
      loggerLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'info',

      // Compression
      compressors: ['zlib', 'snappy'], // Enable compression
      zlibCompressionLevel: 6, // Compression level (1-9)
    }

    try {
      // Connect with optimized settings
      await mongoose.connect(connectionString, options)
      logger.info('Database connection optimized and established successfully')

      // Set up connection event handlers
      this.setupConnectionMonitoring()

      // Optimize indexes
      await this.optimizeIndexes()

      return mongoose.connection

    } catch (error) {
      logger.error('Failed to optimize database connection', { error: error.message })
      throw error
    }
  }

  /**
   * Set up connection monitoring and health checks
   */
  setupConnectionMonitoring() {
    const conn = mongoose.connection

    conn.on('connected', () => {
      logger.info('Mongoose connected to DB Cluster')
      this.updateConnectionMetrics()
    })

    conn.on('disconnected', () => {
      logger.warn('Mongoose disconnected from DB Cluster')
      this.updateConnectionMetrics()
    })

    conn.on('reconnected', () => {
      logger.info('Mongoose reconnected to DB Cluster')
      this.updateConnectionMetrics()
    })

    conn.on('error', (err) => {
      logger.error('Mongoose connection error', { error: err.message })
    })

    // Periodic health checks
    setInterval(() => {
      this.performHealthCheck()
    }, 60000) // Every minute

    // Query performance monitoring
    this.enableQueryMonitoring()
  }

  /**
   * Enable MongoDB query performance monitoring
   */
  enableQueryMonitoring() {
    // Monkey patch mongoose for query monitoring
    const originalExec = mongoose.Query.prototype.exec

    mongoose.Query.prototype.exec = function(callback) {
      const startTime = Date.now()
      const collection = this.model?.collection?.name || 'unknown'
      const operation = this.op || 'find'

      const track = (duration) => {
        // Track query performance
        global.databaseOptimizer?.trackQuery(operation, collection, duration)

        // Log slow queries
        if (duration > 1000) { // Queries taking more than 1 second
          logger.warn(`Slow query detected: ${operation} on ${collection} took ${duration}ms`)

          global.databaseOptimizer?.performanceMetrics.slowQueries.push({
            operation,
            collection,
            duration,
            timestamp: new Date(),
            query: typeof this.getQuery === 'function' ? this.getQuery() : {}
          })

          // Keep only last 50 slow queries
          if (global.databaseOptimizer.performanceMetrics.slowQueries.length > 50) {
            global.databaseOptimizer.performanceMetrics.slowQueries.shift()
          }
        }
      }

      if (typeof callback === 'function') {
        return originalExec.call(this, (err, result) => {
          const duration = Date.now() - startTime
          track(duration)
          callback(err, result)
        })
      } else {
        const promise = originalExec.call(this)
        if (promise && typeof promise.then === 'function') {
          return promise.then(
            (result) => {
              const duration = Date.now() - startTime
              track(duration)
              return result
            },
            (err) => {
              const duration = Date.now() - startTime
              track(duration)
              throw err
            }
          )
        }
        return promise
      }
    }
  }

  /**
   * Track query performance
   */
  trackQuery(operation, collection, duration) {
    this.performanceMetrics.queryCount++

    // Track in APM if available
    if (global.apmMonitor) {
      global.apmMonitor.recordDatabaseQuery(operation, collection, duration)
    }
  }

  /**
   * Update connection pool metrics
   */
  updateConnectionMetrics() {
    try {
      const conn = mongoose.connection
      this.performanceMetrics.connectionPoolSize = conn.db?.serverConfig?.poolSize || 0
      this.performanceMetrics.activeConnections = conn.db?.serverConfig?.connections?.length || 0
    } catch (error) {
      logger.warn('Failed to update connection metrics', { error: error.message })
    }
  }

  /**
   * Perform database health check
   */
  async performHealthCheck() {
    try {
      const startTime = Date.now()
      await mongoose.connection.db.admin().ping()
      const pingTime = Date.now() - startTime

      if (pingTime > 500) { // Ping taking more than 500ms
        logger.warn(`High database latency detected: ${pingTime}ms`)
      }

      return { status: 'healthy', pingTime }
    } catch (error) {
      logger.error('Database health check failure', { error: error.message })
      return { status: 'unhealthy', error: error.message }
    }
  }

  /**
   * Optimize database indexes
   */
  async optimizeIndexes() {
    logger.info('Starting database index optimization')

    try {
      const db = mongoose.connection.db
      const collections = await db.listCollections().toArray()

      for (const collection of collections) {
        const collectionName = collection.name

        // Skip system collections
        if (collectionName.startsWith('system.')) continue

        try {
          const collectionObj = db.collection(collectionName)
          const indexes = await collectionObj.indexes()

          // Analyze and suggest index optimizations
          await this.analyzeCollectionIndexes(collectionObj, collectionName, indexes)

        } catch (error) {
          logger.warn(`Failed to analyze indexes for collection ${collectionName}`, { error: error.message })
        }
      }

      logger.info(`Index optimization complete. Created ${this.performanceMetrics.indexesCreated} new indexes`)

    } catch (error) {
      logger.warn('Failed to optimize indexes', { error: error.message })
    }
  }

  /**
   * Analyze collection indexes and suggest optimizations
   */
  async analyzeCollectionIndexes(collection, collectionName, existingIndexes) {
    // Get collection stats
    let stats
    try {
      if (typeof collection.stats === 'function') {
        stats = await collection.stats()
      } else {
        const db = mongoose.connection.db
        stats = await db.command({ collStats: collectionName })
      }
    } catch (err) {
      logger.warn(`Failed to get collection stats for ${collectionName}, using fallback: ${err.message}`)
      stats = { count: 0, size: 0 }
    }

    logger.info(`Analyzing collection ${collectionName} stats`, { count: stats.count, size: stats.size })

    // Analyze query patterns and suggest indexes
    const suggestions = []

    // For user collections, ensure email index
    if (collectionName.includes('user')) {
      const hasEmailIndex = existingIndexes.some(idx =>
        idx.name.includes('email') || JSON.stringify(idx.key).includes('email')
      )
      if (!hasEmailIndex) {
        suggestions.push({ field: 'email', unique: true })
      }
    }

    // For content collections, ensure user and createdAt indexes
    if (collectionName.includes('content') || collectionName.includes('post')) {
      const hasUserIndex = existingIndexes.some(idx =>
        idx.name.includes('userId') || JSON.stringify(idx.key).includes('userId')
      )
      const hasCreatedAtIndex = existingIndexes.some(idx =>
        idx.name.includes('createdAt') || JSON.stringify(idx.key).includes('createdAt')
      )

      if (!hasUserIndex) {
        suggestions.push({ field: 'userId', compound: ['createdAt'] })
      }
      if (!hasCreatedAtIndex) {
        suggestions.push({ field: 'createdAt' })
      }
    }

    // Create suggested indexes
    for (const suggestion of suggestions) {
      try {
        if (suggestion.compound) {
          await collection.createIndex(
            suggestion.compound.reduce((acc, field) => ({ ...acc, [field]: 1 }), {}),
            { name: `${collectionName}_${suggestion.field}_compound` }
          )
        } else {
          await collection.createIndex(
            { [suggestion.field]: 1 },
            {
              name: `${collectionName}_${suggestion.field}`,
              unique: suggestion.unique || false
            }
          )
        }

        this.performanceMetrics.indexesCreated++
        logger.debug(`Created index on ${collectionName} for ${suggestion.field}`)

      } catch (error) {
        logger.warn(`Failed to create index for ${collectionName}`, { error: error.message })
      }
    }
  }

  /**
   * Create compound indexes for common query patterns
   */
  async createCompoundIndexes() {
    logger.info('Starting compound index creation')

    const indexes = [
      // Content queries: user + createdAt
      { collection: 'contents', fields: { userId: 1, createdAt: -1 } },
      { collection: 'posts', fields: { userId: 1, createdAt: -1 } },

      // Analytics queries: user + date
      { collection: 'analytics', fields: { userId: 1, date: -1 } },

      // Notifications: user + read status
      { collection: 'notifications', fields: { userId: 1, read: 1, createdAt: -1 } },

      // Search optimization
      { collection: 'contents', fields: { title: 'text', description: 'text' } },
    ]

    for (const indexDef of indexes) {
      try {
        const collection = mongoose.connection.db.collection(indexDef.collection)

        // Check if collection exists
        const collections = await mongoose.connection.db.listCollections({ name: indexDef.collection }).toArray()
        if (collections.length === 0) continue

        await collection.createIndex(indexDef.fields, {
          name: `${indexDef.collection}_compound_${Object.keys(indexDef.fields).join('_')}`
        })

        logger.debug(`Created compound index for ${indexDef.collection}`)
        this.performanceMetrics.indexesCreated++

      } catch (error) {
        logger.warn(`Failed to create compound index for ${indexDef.collection}`, { error: error.message })
      }
    }
  }

  /**
   * Optimize read/write concerns for performance
   */
  async optimizeReadWriteConcerns() {
    logger.info('Optimizing read/write concerns')

    try {
      // Set default read preference
      mongoose.set('readPreference', 'primaryPreferred')

      // Set write concern for data durability
      mongoose.set('writeConcern', {
        w: 'majority',
        wtimeout: 5000,
        j: true // Wait for journal write
      })

      logger.info('Read/write concerns optimized')
    } catch (error) {
      logger.warn('Failed to optimize read/write concerns', { error: error.message })
    }
  }

  /**
   * Get database performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      connectionHealth: this.getConnectionHealth(),
      slowQueries: this.performanceMetrics.slowQueries.slice(-10), // Last 10 slow queries
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Get connection health status
   */
  getConnectionHealth() {
    try {
      const conn = mongoose.connection
      return {
        state: conn.readyState,
        stateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][conn.readyState] || 'unknown',
        host: conn.host,
        port: conn.port,
        name: conn.name,
        poolSize: this.performanceMetrics.connectionPoolSize,
        activeConnections: this.performanceMetrics.activeConnections
      }
    } catch (error) {
      return { state: 'error', error: error.message }
    }
  }

  /**
   * Run database maintenance tasks
   */
  async runMaintenance() {
    logger.info('Running routine database maintenance')

    try {
      const db = mongoose.connection.db

      // Compact collections (if supported)
      if (db.admin) {
        const collections = await db.listCollections().toArray()

        for (const collection of collections) {
          if (!collection.name.startsWith('system.')) {
            try {
              await db.command({ compact: collection.name })
              logger.debug(`Compacted collection ${collection.name}`)
            } catch (error) {
              // Compact may not be supported on all MongoDB deployments
              logger.debug(`Compact not supported for ${collection.name}`, { error: error.message })
            }
          }
        }
      }

      // Rebuild indexes (selective)
      const stats = await db.stats()
      if (stats.indexSize > 1024 * 1024 * 100) { // If indexes > 100MB
        logger.info('Index size > 100MB, consider scheduling index rebuilds via cron')
      }

      logger.info('Database maintenance complete')

    } catch (error) {
      logger.warn('Failed to run database maintenance', { error: error.message })
    }
  }

  /**
   * Close database connection gracefully
   */
  async close() {
    logger.info('Closing database connection gracefully')

    try {
      await mongoose.connection.close()
      logger.info('Database connection closed')
    } catch (error) {
      logger.warn('Failed to close database connection gracefully', { error: error.message })
    }
  }
}

// Create singleton instance
const databaseOptimizer = new DatabaseOptimizer()

// Make available globally
global.databaseOptimizer = databaseOptimizer

module.exports = databaseOptimizer










