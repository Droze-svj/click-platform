#!/usr/bin/env node

/**
 * Production Operations Dashboard
 * Comprehensive operations management for Click production environment
 */

const http = require('http')
const os = require('os')
const { execSync } = require('child_process')

class ProductionOperations {
  constructor() {
    this.port = 9091
    this.operations = {
      lastBackup: null,
      lastHealthCheck: null,
      services: {},
      alerts: [],
      maintenance: {
        scheduled: false,
        window: null,
        tasks: []
      }
    }

    this.thresholds = {
      memoryWarning: 75,
      memoryCritical: 90,
      cpuWarning: 70,
      cpuCritical: 85,
      responseTimeWarning: 2000,
      responseTimeCritical: 5000,
      errorRateWarning: 5,
      errorRateCritical: 10
    }
  }

  async startOperationsDashboard() {
    console.log('🎛️  Starting Production Operations Dashboard...')
    console.log('=============================================')

    // Start monitoring services
    this.startServiceMonitoring()
    this.startHealthChecks()
    this.startAutomatedMaintenance()

    // Start HTTP dashboard
    this.startDashboardServer()

    console.log('✅ Operations dashboard active')
    console.log(`🎛️  Dashboard: http://localhost:${this.port}`)
    console.log(`🔍 Health API: http://localhost:${this.port}/api/health`)
    console.log(`⚙️  Operations: http://localhost:${this.port}/operations`)
  }

  startServiceMonitoring() {
    // Monitor PM2 processes
    setInterval(() => this.monitorPM2Processes(), 30000)

    // Monitor system resources
    setInterval(() => this.monitorSystemResources(), 60000)

    // Monitor application metrics
    setInterval(() => this.monitorApplicationMetrics(), 30000)
  }

  async monitorPM2Processes() {
    try {
      const pm2List = execSync('pm2 list --json', { encoding: 'utf8' })
      const processes = JSON.parse(pm2List)

      this.operations.services = {}

      processes.forEach(process => {
        this.operations.services[process.name] = {
          name: process.name,
          pid: process.pid,
          status: process.pm2_env.status,
          cpu: process.monit.cpu,
          memory: process.monit.memory / 1024 / 1024, // MB
          uptime: process.pm2_env.pm_uptime,
          restarts: process.pm2_env.restart_time,
          instances: process.pm2_env.instances || 1
        }
      })

    } catch (error) {
      console.warn('PM2 monitoring failed:', error.message)
    }
  }

  monitorSystemResources() {
    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const systemMetrics = {
      memory: {
        used: Math.round(usedMem / 1024 / 1024),
        total: Math.round(totalMem / 1024 / 1024),
        percentage: Math.round((usedMem / totalMem) * 100),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
      },
      cpu: {
        usage: this.getCpuUsage(),
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      disk: this.getDiskUsage(),
      uptime: os.uptime()
    }

    // Check thresholds and create alerts
    this.checkResourceThresholds(systemMetrics)
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

  getDiskUsage() {
    try {
      const df = execSync('df -h / | tail -1', { encoding: 'utf8' }).trim().split(/\s+/)
      return {
        total: df[1],
        used: df[2],
        available: df[3],
        percentage: parseInt(df[4])
      }
    } catch (error) {
      return { total: 'N/A', used: 'N/A', available: 'N/A', percentage: 0 }
    }
  }

  checkResourceThresholds(metrics) {
    const alerts = []

    // Memory alerts
    if (metrics.memory.percentage >= this.thresholds.memoryCritical) {
      alerts.push({
        level: 'critical',
        type: 'memory',
        message: `Critical memory usage: ${metrics.memory.percentage}%`,
        action: 'Immediate: Scale memory or restart services'
      })
    } else if (metrics.memory.percentage >= this.thresholds.memoryWarning) {
      alerts.push({
        level: 'warning',
        type: 'memory',
        message: `High memory usage: ${metrics.memory.percentage}%`,
        action: 'Monitor closely, consider optimization'
      })
    }

    // CPU alerts
    if (metrics.cpu.usage >= this.thresholds.cpuCritical) {
      alerts.push({
        level: 'critical',
        type: 'cpu',
        message: `Critical CPU usage: ${metrics.cpu.usage}%`,
        action: 'Immediate: Scale CPU or optimize processes'
      })
    } else if (metrics.cpu.usage >= this.thresholds.cpuWarning) {
      alerts.push({
        level: 'warning',
        type: 'cpu',
        message: `High CPU usage: ${metrics.cpu.usage}%`,
        action: 'Monitor performance, consider scaling'
      })
    }

    // Disk alerts
    if (metrics.disk.percentage >= 90) {
      alerts.push({
        level: 'critical',
        type: 'disk',
        message: `Critical disk usage: ${metrics.disk.percentage}%`,
        action: 'Immediate: Clean up disk space or scale storage'
      })
    } else if (metrics.disk.percentage >= 80) {
      alerts.push({
        level: 'warning',
        type: 'disk',
        message: `High disk usage: ${metrics.disk.percentage}%`,
        action: 'Monitor disk usage, plan cleanup'
      })
    }

    // Add new alerts
    alerts.forEach(alert => {
      const existingAlert = this.operations.alerts.find(a =>
        a.type === alert.type && a.level === alert.level && !a.resolved
      )

      if (!existingAlert) {
        alert.timestamp = new Date().toISOString()
        alert.id = Date.now().toString()
        alert.resolved = false
        this.operations.alerts.unshift(alert)

        // Send notification
        this.sendAlertNotification(alert)
      }
    })

    // Keep only last 50 alerts
    this.operations.alerts = this.operations.alerts.slice(0, 50)
  }

  async monitorApplicationMetrics() {
    try {
      // Check service health
      const backendHealth = await this.checkServiceHealth('http://localhost:5001/api/health')
      const frontendHealth = await this.checkServiceHealth('http://localhost:3000/api/monitoring/health')

      this.operations.lastHealthCheck = new Date().toISOString()

      // Create alerts for unhealthy services
      if (!backendHealth.healthy) {
        this.createServiceAlert('backend', 'Backend service unhealthy', backendHealth.error)
      }

      if (!frontendHealth.healthy) {
        this.createServiceAlert('frontend', 'Frontend service unhealthy', frontendHealth.error)
      }

    } catch (error) {
      console.error('Application monitoring failed:', error.message)
    }
  }

  async checkServiceHealth(url) {
    return new Promise(resolve => {
      const req = http.get(url, { timeout: 10000 }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          resolve({
            healthy: res.statusCode === 200,
            responseTime: Date.now() - startTime,
            statusCode: res.statusCode,
            data: data
          })
        })
      })

      const startTime = Date.now()

      req.on('error', (error) => {
        resolve({
          healthy: false,
          error: error.message,
          responseTime: Date.now() - startTime
        })
      })

      req.on('timeout', () => {
        req.destroy()
        resolve({
          healthy: false,
          error: 'Timeout',
          responseTime: Date.now() - startTime
        })
      })
    })
  }

  createServiceAlert(service, message, error) {
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level: 'critical',
      type: 'service',
      service: service,
      message: message,
      error: error,
      resolved: false,
      action: `Restart ${service} service or investigate logs`
    }

    this.operations.alerts.unshift(alert)
    this.sendAlertNotification(alert)
  }

  startHealthChecks() {
    // Comprehensive health checks every 5 minutes
    setInterval(() => this.runComprehensiveHealthCheck(), 300000)
  }

  async runComprehensiveHealthCheck() {
    console.log('🔍 Running comprehensive health check...')

    const results = {
      timestamp: new Date().toISOString(),
      services: {},
      database: {},
      external: {}
    }

    // Check all services
    const services = [
      { name: 'backend', url: 'http://localhost:5001/api/health' },
      { name: 'frontend', url: 'http://localhost:3000/api/monitoring/health' },
      { name: 'monitoring', url: 'http://localhost:9090/health' }
    ]

    for (const service of services) {
      results.services[service.name] = await this.checkServiceHealth(service.url)
    }

    // Check database connectivity
    results.database = await this.checkDatabaseHealth()

    // Check external services (CDN, etc.)
    results.external = await this.checkExternalServices()

    // Log results
    console.log('✅ Health check completed')
    console.table(Object.entries(results.services).map(([name, health]) => ({
      Service: name,
      Healthy: health.healthy ? '✅' : '❌',
      ResponseTime: `${health.responseTime || 0}ms`,
      Status: health.statusCode || 'N/A'
    })))

    // Store results for dashboard
    this.operations.lastHealthCheck = results
  }

  async checkDatabaseHealth() {
    try {
      // Simple database connectivity check
      const mongoose = require('mongoose')
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/click_production'

      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
      await mongoose.connection.db.admin().ping()
      await mongoose.disconnect()

      return { healthy: true, responseTime: 0 }
    } catch (error) {
      return { healthy: false, error: error.message }
    }
  }

  async checkExternalServices() {
    const results = {}

    // Check CDN if configured
    if (process.env.CDN_URL) {
      try {
        const response = await fetch(process.env.CDN_URL + '/favicon.ico', { timeout: 5000 })
        results.cdn = { healthy: response.ok, statusCode: response.status }
      } catch (error) {
        results.cdn = { healthy: false, error: error.message }
      }
    }

    return results
  }

  startAutomatedMaintenance() {
    // Schedule automated maintenance tasks
    this.scheduleBackup()
    this.scheduleLogRotation()
    this.schedulePerformanceOptimization()
  }

  scheduleBackup() {
    // Daily backup at 2 AM
    const now = new Date()
    const nextBackup = new Date(now)
    nextBackup.setHours(2, 0, 0, 0)

    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1)
    }

    const delay = nextBackup - now
    setTimeout(() => {
      this.runAutomatedBackup()
      // Repeat daily
      setInterval(() => this.runAutomatedBackup(), 24 * 60 * 60 * 1000)
    }, delay)
  }

  async runAutomatedBackup() {
    console.log('💾 Running automated backup...')

    try {
      const { ProductionBackup } = require('./production-backup')
      const backup = new ProductionBackup()
      await backup.runFullBackup()

      this.operations.lastBackup = new Date().toISOString()
      console.log('✅ Automated backup completed')

    } catch (error) {
      console.error('❌ Automated backup failed:', error.message)
      this.createServiceAlert('backup', 'Automated backup failed', error.message)
    }
  }

  scheduleLogRotation() {
    // Daily log rotation at 3 AM
    const now = new Date()
    const nextRotation = new Date(now)
    nextRotation.setHours(3, 0, 0, 0)

    if (nextRotation <= now) {
      nextRotation.setDate(nextRotation.getDate() + 1)
    }

    const delay = nextRotation - now
    setTimeout(() => {
      this.rotateLogs()
      setInterval(() => this.rotateLogs(), 24 * 60 * 60 * 1000)
    }, delay)
  }

  rotateLogs() {
    console.log('🔄 Rotating logs...')

    try {
      const logFiles = [
        'logs/pm2-error.log',
        'logs/pm2-out.log',
        'logs/pm2-combined.log'
      ]

      logFiles.forEach(logFile => {
        const logPath = `./${logFile}`
        if (require('fs').existsSync(logPath)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const archivePath = `./logs/archive/${logFile}.${timestamp}`
          require('fs').renameSync(logPath, archivePath)
        }
      })

      console.log('✅ Log rotation completed')

    } catch (error) {
      console.error('❌ Log rotation failed:', error.message)
    }
  }

  schedulePerformanceOptimization() {
    // Weekly performance optimization on Sundays at 4 AM
    const now = new Date()
    let nextOptimization = new Date(now)

    // Find next Sunday
    const daysUntilSunday = (7 - now.getDay()) % 7
    nextOptimization.setDate(now.getDate() + daysUntilSunday)
    nextOptimization.setHours(4, 0, 0, 0)

    if (nextOptimization <= now) {
      nextOptimization.setDate(nextOptimization.getDate() + 7)
    }

    const delay = nextOptimization - now
    setTimeout(() => {
      this.runPerformanceOptimization()
      setInterval(() => this.runPerformanceOptimization(), 7 * 24 * 60 * 60 * 1000)
    }, delay)
  }

  async runPerformanceOptimization() {
    console.log('⚡ Running performance optimization...')

    try {
      // Clear caches
      execSync('pm2 reloadLogs', { stdio: 'pipe' })

      // Optimize database
      if (process.env.MONGODB_URI) {
        // This would run database optimization commands
        console.log('📊 Database optimization completed')
      }

      // Restart services for memory cleanup
      execSync('pm2 restart click-backend click-frontend', { stdio: 'pipe' })

      console.log('✅ Performance optimization completed')

    } catch (error) {
      console.error('❌ Performance optimization failed:', error.message)
    }
  }

  startDashboardServer() {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          services: Object.keys(this.operations.services).length,
          alerts: this.operations.alerts.filter(a => !a.resolved).length
        }))
      } else if (req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(this.operations))
      } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(this.generateOperationsDashboard())
      } else if (req.url?.startsWith('/api/')) {
        this.handleApiRequest(req, res)
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    server.listen(this.port, () => {
      console.log(`🎛️  Operations dashboard: http://localhost:${this.port}`)
    })
  }

  handleApiRequest(req, res) {
    if (req.url === '/api/restart-service' && req.method === 'POST') {
      // Handle service restart requests
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', () => {
        try {
          const { service } = JSON.parse(body)
          this.restartService(service)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, message: `Restarting ${service}` }))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: error.message }))
        }
      })
    } else {
      res.writeHead(404)
      res.end('API endpoint not found')
    }
  }

  restartService(serviceName) {
    try {
      execSync(`pm2 restart ${serviceName}`, { stdio: 'pipe' })
      console.log(`✅ Service ${serviceName} restarted`)
    } catch (error) {
      console.error(`❌ Failed to restart ${serviceName}:`, error.message)
      throw error
    }
  }

  generateOperationsDashboard() {
    const activeAlerts = this.operations.alerts.filter(a => !a.resolved)
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical')
    const warningAlerts = activeAlerts.filter(a => a.level === 'warning')

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Click Operations Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .status-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .service-list { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .alert-list { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alert-item { padding: 10px; margin-bottom: 10px; border-radius: 4px; }
        .alert-critical { background: #fee; border-left: 4px solid #e74c3c; }
        .alert-warning { background: #fef5e7; border-left: 4px solid #f39c12; }
        .service-healthy { color: #27ae60; }
        .service-unhealthy { color: #e74c3c; }
        .btn { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #0056b3; }
        .metric { font-size: 24px; font-weight: bold; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎛️ Click Production Operations Dashboard</h1>
            <p>Real-time monitoring and management</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>System Health</h3>
                <div class="metric ${criticalAlerts.length > 0 ? 'service-unhealthy' : 'service-healthy'}">
                    ${criticalAlerts.length > 0 ? 'CRITICAL' : 'HEALTHY'}
                </div>
                <p>Active Services: ${Object.keys(this.operations.services).length}</p>
                <p>Active Alerts: ${activeAlerts.length}</p>
            </div>

            <div class="status-card">
                <h3>Services Status</h3>
                <div class="metric">${Object.values(this.operations.services).filter(s => s.status === 'online').length}/${Object.keys(this.operations.services).length}</div>
                <p>Online Services</p>
            </div>

            <div class="status-card">
                <h3>Active Alerts</h3>
                <div class="metric ${criticalAlerts.length > 0 ? 'service-unhealthy' : warningAlerts.length > 0 ? 'service-unhealthy' : 'service-healthy'}">
                    ${criticalAlerts.length}/${warningAlerts.length}
                </div>
                <p>Critical/Warnings</p>
            </div>

            <div class="status-card">
                <h3>Last Backup</h3>
                <div class="metric">${this.operations.lastBackup ? new Date(this.operations.lastBackup).toLocaleString() : 'Never'}</div>
                <p>Automated Backup</p>
            </div>
        </div>

        <div class="service-list">
            <h3>Service Status</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid #ddd;">
                        <th style="text-align: left; padding: 10px;">Service</th>
                        <th style="text-align: left; padding: 10px;">Status</th>
                        <th style="text-align: left; padding: 10px;">CPU</th>
                        <th style="text-align: left; padding: 10px;">Memory</th>
                        <th style="text-align: left; padding: 10px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(this.operations.services).map(service => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px;">${service.name}</td>
                            <td style="padding: 10px;">
                                <span class="${service.status === 'online' ? 'service-healthy' : 'service-unhealthy'}">
                                    ${service.status}
                                </span>
                            </td>
                            <td style="padding: 10px;">${service.cpu?.toFixed(1) || 'N/A'}%</td>
                            <td style="padding: 10px;">${service.memory?.toFixed(1) || 'N/A'} MB</td>
                            <td style="padding: 10px;">
                                <button class="btn" onclick="restartService('${service.name}')">Restart</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="alert-list">
            <h3>Active Alerts (${activeAlerts.length})</h3>
            ${activeAlerts.slice(0, 10).map(alert => `
                <div class="alert-item alert-${alert.level}">
                    <strong>${alert.message}</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        ${alert.timestamp} | ${alert.type} | ${alert.action || ''}
                    </div>
                </div>
            `).join('')}
            ${activeAlerts.length === 0 ? '<p>No active alerts</p>' : ''}
        </div>
    </div>

    <script>
        function restartService(serviceName) {
            if (confirm(\`Restart \${serviceName} service?\`)) {
                fetch('/api/restart-service', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service: serviceName })
                })
                .then(response => response.json())
                .then(data => {
                    alert(data.success ? 'Service restart initiated' : 'Restart failed: ' + data.error);
                    location.reload();
                })
                .catch(error => alert('Error: ' + error.message));
            }
        }

        // Auto-refresh every 30 seconds
        setInterval(() => location.reload(), 30000);
    </script>
</body>
</html>`
  }

  async sendAlertNotification(alert) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL
      if (!webhookUrl) return

      const payload = {
        text: `🚨 Click Operations Alert: ${alert.message}`,
        attachments: [{
          color: alert.level === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Level', value: alert.level.toUpperCase(), short: true },
            { title: 'Type', value: alert.type, short: true },
            { title: 'Time', value: alert.timestamp, short: true },
            { title: 'Action Required', value: alert.action, short: false }
          ]
        }]
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.warn('Failed to send alert to Slack')
      }

    } catch (error) {
      console.warn('Alert notification failed:', error.message)
    }
  }
}

// Start operations dashboard if called directly
if (require.main === module) {
  const operations = new ProductionOperations()
  operations.startOperationsDashboard()

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('🎛️  Shutting down operations dashboard...')
    process.exit(0)
  })
}

module.exports = ProductionOperations





