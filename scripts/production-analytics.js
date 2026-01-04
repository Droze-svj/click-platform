#!/usr/bin/env node

/**
 * Production Analytics & Logging System
 * Comprehensive analytics collection and reporting for production
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

class ProductionAnalytics {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs')
    this.analyticsFile = path.join(this.logDir, 'analytics.jsonl')
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      memoryUsage: [],
      activeUsers: 0,
      featuresUsed: {},
      errorsByType: {},
      performanceMetrics: {}
    }

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }

    // Initialize analytics file if it doesn't exist
    if (!fs.existsSync(this.analyticsFile)) {
      fs.writeFileSync(this.analyticsFile, '')
    }
  }

  async startAnalyticsCollection() {
    console.log('📊 Starting Production Analytics Collection...')
    console.log('=============================================')

    // Collect system metrics every minute
    setInterval(() => this.collectSystemMetrics(), 60000)

    // Collect application metrics every 30 seconds
    setInterval(() => this.collectApplicationMetrics(), 30000)

    // Generate reports every hour
    setInterval(() => this.generateHourlyReport(), 3600000)

    // Clean old logs daily
    setInterval(() => this.cleanupOldLogs(), 86400000)

    console.log('✅ Analytics collection started')
    console.log(`📁 Analytics logs: ${this.analyticsFile}`)
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const metrics = {
      timestamp: new Date().toISOString(),
      type: 'system',
      data: {
        memory: {
          used: Math.round(usedMem / 1024 / 1024), // MB
          total: Math.round(totalMem / 1024 / 1024), // MB
          percentage: Math.round((usedMem / totalMem) * 100),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        },
        cpu: {
          usage: this.getCpuUsage(),
          cores: os.cpus().length,
          loadAverage: os.loadavg()
        },
        uptime: Math.round(process.uptime()),
        platform: os.platform(),
        nodeVersion: process.version
      }
    }

    this.logMetrics(metrics)
    this.metrics.memoryUsage.push(metrics.data.memory)
  }

  getCpuUsage() {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    return 100 - ~~(100 * idle / total)
  }

  async collectApplicationMetrics() {
    try {
      // Check application health
      const backendHealth = await this.checkEndpoint('http://localhost:5001/api/health')
      const frontendHealth = await this.checkEndpoint('http://localhost:3000/api/monitoring/health')

      const metrics = {
        timestamp: new Date().toISOString(),
        type: 'application',
        data: {
          backend: {
            healthy: backendHealth,
            responseTime: backendHealth ? await this.measureResponseTime('http://localhost:5001/api/health') : null
          },
          frontend: {
            healthy: frontendHealth,
            responseTime: frontendHealth ? await this.measureResponseTime('http://localhost:3000/api/monitoring/health') : null
          },
          activeConnections: this.getActiveConnections(),
          requestRate: this.metrics.requests,
          errorRate: this.metrics.errors
        }
      }

      this.logMetrics(metrics)

    } catch (error) {
      console.error('Error collecting application metrics:', error.message)
    }
  }

  async checkEndpoint(url) {
    return new Promise(resolve => {
      const http = require('http')
      const req = http.get(url, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200)
      })

      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  async measureResponseTime(url) {
    const start = Date.now()
    try {
      await this.checkEndpoint(url)
      return Date.now() - start
    } catch (error) {
      return null
    }
  }

  getActiveConnections() {
    // This is a simplified implementation
    // In a real production system, you'd get this from your web server
    return Math.floor(Math.random() * 50) + 10 // Mock data
  }

  logMetrics(metrics) {
    const logLine = JSON.stringify(metrics) + '\n'
    fs.appendFileSync(this.analyticsFile, logLine)
  }

  generateHourlyReport() {
    console.log('📊 Generating hourly analytics report...')

    const report = {
      timestamp: new Date().toISOString(),
      period: 'hourly',
      summary: {
        avgMemoryUsage: this.calculateAverage(this.metrics.memoryUsage.map(m => m.percentage)),
        totalRequests: this.metrics.requests,
        totalErrors: this.metrics.errors,
        avgResponseTime: this.calculateAverage(this.metrics.responseTime),
        activeUsers: this.metrics.activeUsers,
        topFeatures: Object.entries(this.metrics.featuresUsed)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
        topErrors: Object.entries(this.metrics.errorsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      },
      performance: this.metrics.performanceMetrics,
      recommendations: this.generateRecommendations()
    }

    const reportPath = path.join(this.logDir, `report-${Date.now()}.json`)
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log(`✅ Hourly report generated: ${reportPath}`)

    // Reset hourly metrics
    this.resetHourlyMetrics()

    // Send report notification if configured
    this.sendReportNotification(report)
  }

  calculateAverage(values) {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  generateRecommendations() {
    const recommendations = []

    const avgMemory = this.calculateAverage(this.metrics.memoryUsage.map(m => m.percentage))
    if (avgMemory > 80) {
      recommendations.push({
        type: 'warning',
        category: 'memory',
        message: 'High memory usage detected. Consider increasing server resources.',
        action: 'Scale up memory or optimize memory usage'
      })
    }

    const errorRate = this.metrics.errors / Math.max(this.metrics.requests, 1)
    if (errorRate > 0.05) {
      recommendations.push({
        type: 'critical',
        category: 'errors',
        message: 'High error rate detected. Immediate investigation required.',
        action: 'Check error logs and fix critical issues'
      })
    }

    const avgResponseTime = this.calculateAverage(this.metrics.responseTime)
    if (avgResponseTime > 2000) {
      recommendations.push({
        type: 'warning',
        category: 'performance',
        message: 'Slow response times detected.',
        action: 'Optimize database queries and caching'
      })
    }

    return recommendations
  }

  resetHourlyMetrics() {
    this.metrics.requests = 0
    this.metrics.errors = 0
    this.metrics.responseTime = []
    this.metrics.memoryUsage = []
    this.metrics.featuresUsed = {}
    this.metrics.errorsByType = {}
  }

  cleanupOldLogs() {
    console.log('🧹 Cleaning up old analytics logs...')

    const files = fs.readdirSync(this.logDir)
      .filter(file => file.startsWith('analytics.jsonl.') || file.startsWith('report-'))
      .map(file => ({
        name: file,
        path: path.join(this.logDir, file),
        stats: fs.statSync(path.join(this.logDir, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime)

    // Keep only last 7 days of logs
    const keepDays = 7
    const maxAge = keepDays * 24 * 60 * 60 * 1000

    for (const file of files.slice(30)) { // Keep at least 30 files
      const age = Date.now() - file.stats.mtime
      if (age > maxAge) {
        fs.unlinkSync(file.path)
        console.log(`  Deleted old log: ${file.name}`)
      }
    }

    console.log('✅ Old logs cleaned up')
  }

  async sendReportNotification(report) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      if (!webhookUrl) return

      const color = report.recommendations.some(r => r.type === 'critical') ? 'danger' :
                   report.recommendations.some(r => r.type === 'warning') ? 'warning' : 'good'

      const payload = {
        text: '📊 Click Hourly Analytics Report',
        attachments: [{
          color: color,
          title: 'Production Analytics Summary',
          fields: [
            {
              title: 'Memory Usage',
              value: `${report.summary.avgMemoryUsage.toFixed(1)}%`,
              short: true
            },
            {
              title: 'Requests',
              value: report.summary.totalRequests.toString(),
              short: true
            },
            {
              title: 'Errors',
              value: report.summary.totalErrors.toString(),
              short: true
            },
            {
              title: 'Avg Response Time',
              value: `${report.summary.avgResponseTime.toFixed(0)}ms`,
              short: true
            }
          ]
        }]
      }

      if (report.recommendations.length > 0) {
        payload.attachments.push({
          color: 'warning',
          title: 'Recommendations',
          text: report.recommendations.map(r => `• ${r.message}`).join('\n')
        })
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.warn('Failed to send analytics report to Slack')
      }

    } catch (error) {
      console.warn('Analytics report notification failed:', error.message)
    }
  }

  // Public API for logging events
  logRequest(endpoint, method, responseTime, statusCode) {
    this.metrics.requests++
    this.metrics.responseTime.push(responseTime)

    this.logMetrics({
      timestamp: new Date().toISOString(),
      type: 'request',
      data: {
        endpoint,
        method,
        responseTime,
        statusCode,
        userAgent: 'production-analytics'
      }
    })
  }

  logError(error, context = {}) {
    this.metrics.errors++

    const errorType = error.name || 'UnknownError'
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1

    this.logMetrics({
      timestamp: new Date().toISOString(),
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        type: errorType,
        context
      }
    })
  }

  logFeatureUsage(feature, userId = null) {
    this.metrics.featuresUsed[feature] = (this.metrics.featuresUsed[feature] || 0) + 1

    this.logMetrics({
      timestamp: new Date().toISOString(),
      type: 'feature_usage',
      data: {
        feature,
        userId,
        count: this.metrics.featuresUsed[feature]
      }
    })
  }

  logPerformanceMetric(metric, value, unit = '') {
    this.metrics.performanceMetrics[metric] = {
      value,
      unit,
      timestamp: new Date().toISOString()
    }

    this.logMetrics({
      timestamp: new Date().toISOString(),
      type: 'performance',
      data: {
        metric,
        value,
        unit
      }
    })
  }
}

// Export for use in other modules
module.exports = ProductionAnalytics

// Start analytics if called directly
if (require.main === module) {
  const analytics = new ProductionAnalytics()
  analytics.startAnalyticsCollection()

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('📊 Shutting down analytics collection...')
    process.exit(0)
  })
}


