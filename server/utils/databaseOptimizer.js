/**
 * Database Optimization Utilities
 * Connection pooling, indexing, and query optimization
 */

const mongoose = require('mongoose')

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
    console.log('🔧 Optimizing database connection...')

    const options = {
      // Connection pool settings
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10, // Maximum connection pool size
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,  // Minimum connection pool size
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

      console.log('✅ Database connection optimized')

      // Set up connection event handlers
      this.setupConnectionMonitoring()

      // Optimize indexes
      await this.optimizeIndexes()

      return mongoose.connection

    } catch (error) {
      console.error('❌ Database optimization failed:', error)
      throw error
    }
  }

  /**
   * Set up connection monitoring and health checks
   */
  setupConnectionMonitoring() {
    const conn = mongoose.connection

    conn.on('connected', () => {
      console.log('📊 Database connected')
      this.updateConnectionMetrics()
    })

    conn.on('disconnected', () => {
      console.warn('⚠️ Database disconnected')
      this.updateConnectionMetrics()
    })

    conn.on('reconnected', () => {
      console.log('🔄 Database reconnected')
      this.updateConnectionMetrics()
    })

    conn.on('error', (err) => {
      console.error('❌ Database error:', err)
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
      const collection = this.model.collection.name
      const operation = this.op || 'find'

      return originalExec.call(this, (err, result) => {
        const duration = Date.now() - startTime

        // Track query performance
        global.databaseOptimizer?.trackQuery(operation, collection, duration)

        // Log slow queries
        if (duration > 1000) { // Queries taking more than 1 second
          console.warn(`🐌 Slow query: ${operation} on ${collection} took ${duration}ms`)

          global.databaseOptimizer?.performanceMetrics.slowQueries.push({
            operation,
            collection,
            duration,
            timestamp: new Date(),
            query: this.getQuery()
          })

          // Keep only last 50 slow queries
          if (global.databaseOptimizer.performanceMetrics.slowQueries.length > 50) {
            global.databaseOptimizer.performanceMetrics.slowQueries.shift()
          }
        }

        if (callback) {
          callback(err, result)
        }
      })
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
      console.warn('⚠️ Failed to update connection metrics:', error.message)
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
        console.warn(`⚠️ Slow database ping: ${pingTime}ms`)
      }

      return { status: 'healthy', pingTime }
    } catch (error) {
      console.error('❌ Database health check failed:', error.message)
      return { status: 'unhealthy', error: error.message }
    }
  }

  /**
   * Optimize database indexes
   */
  async optimizeIndexes() {
    console.log('📊 Optimizing database indexes...')

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
          console.warn(`⚠️ Failed to analyze indexes for ${collectionName}:`, error.message)
        }
      }

      console.log('✅ Database index optimization completed')

    } catch (error) {
      console.error('❌ Index optimization failed:', error)
    }
  }

  /**
   * Analyze collection indexes and suggest optimizations
   */
  async analyzeCollectionIndexes(collection, collectionName, existingIndexes) {
    // Get collection stats
    const stats = await collection.stats()

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
        console.log(`📊 Created index: ${collectionName}_${suggestion.field}`)

      } catch (error) {
        console.warn(`⚠️ Failed to create index for ${collectionName}.${suggestion.field}:`, error.message)
      }
    }
  }

  /**
   * Create compound indexes for common query patterns
   */
  async createCompoundIndexes() {
    console.log('🔗 Creating compound indexes...')

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

        console.log(`🔗 Created compound index for ${indexDef.collection}`)
        this.performanceMetrics.indexesCreated++

      } catch (error) {
        console.warn(`⚠️ Failed to create compound index for ${indexDef.collection}:`, error.message)
      }
    }
  }

  /**
   * Optimize read/write concerns for performance
   */
  async optimizeReadWriteConcerns() {
    console.log('⚡ Optimizing read/write concerns...')

    try {
      // Set default read preference
      mongoose.set('readPreference', 'primaryPreferred')

      // Set write concern for data durability
      mongoose.set('writeConcern', {
        w: 'majority',
        wtimeout: 5000,
        j: true // Wait for journal write
      })

      console.log('✅ Read/write concerns optimized')
    } catch (error) {
      console.warn('⚠️ Failed to optimize read/write concerns:', error.message)
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
    console.log('🧹 Running database maintenance...')

    try {
      const db = mongoose.connection.db

      // Compact collections (if supported)
      if (db.admin) {
        const collections = await db.listCollections().toArray()

        for (const collection of collections) {
          if (!collection.name.startsWith('system.')) {
            try {
              await db.command({ compact: collection.name })
              console.log(`🧹 Compacted collection: ${collection.name}`)
            } catch (error) {
              // Compact may not be supported on all MongoDB deployments
            }
          }
        }
      }

      // Rebuild indexes (selective)
      const stats = await db.stats()
      if (stats.indexSize > 1024 * 1024 * 100) { // If indexes > 100MB
        console.log('📊 Large index size detected, consider rebuilding indexes')
      }

      console.log('✅ Database maintenance completed')

    } catch (error) {
      console.warn('⚠️ Database maintenance failed:', error.message)
    }
  }

  /**
   * Close database connection gracefully
   */
  async close() {
    console.log('🔌 Closing database connection...')

    try {
      await mongoose.connection.close()
      console.log('✅ Database connection closed')
    } catch (error) {
      console.error('❌ Error closing database connection:', error)
    }
  }
}

// Create singleton instance
const databaseOptimizer = new DatabaseOptimizer()

// Make available globally
global.databaseOptimizer = databaseOptimizer

module.exports = databaseOptimizer



