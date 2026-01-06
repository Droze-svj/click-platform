#!/usr/bin/env node

/**
 * Click Production Monitoring Dashboard
 * Real-time monitoring and alerting for production deployments
 */

const http = require('http')
const os = require('os')
const { execSync } = require('child_process')

class ProductionMonitor {
  constructor() {
    this.metrics = {
      uptime: 0,
      memory: {},
      cpu: {},
      requests: 0,
      errors: 0,
      responseTime: 0,
      lastHealthCheck: null,
      alerts: []
    }

    this.alerts = []
    this.thresholds = {
      memoryUsage: 80, // %
      cpuUsage: 70,    // %
      errorRate: 5,    // %
      responseTime: 2000, // ms
      uptime: 99.9     // %
    }
  }

  async startMonitoring() {
    console.log('📊 Starting Click Production Monitoring...')

    // Initial health check
    await this.performHealthCheck()

    // Start monitoring intervals
    setInterval(() => this.collectMetrics(), 30000) // Every 30 seconds
    setInterval(() => this.performHealthCheck(), 60000) // Every minute
    setInterval(() => this.checkThresholds(), 300000) // Every 5 minutes

    // Start HTTP server for monitoring dashboard
    this.startDashboardServer()

    console.log('✅ Production monitoring active')
    console.log('📈 Dashboard: http://localhost:9090')
    console.log('🔍 Health Check: http://localhost:9090/health')
    console.log('📊 Metrics: http://localhost:9090/metrics')
  }

  async collectMetrics() {
    try {
      // System metrics
      const memUsage = process.memoryUsage()
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem

      this.metrics.memory = {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      }

      // CPU metrics
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
      const usage = 100 - ~~(100 * idle / total)

      this.metrics.cpu = {
        usage: usage,
        cores: cpus.length,
        loadAverage: os.loadavg()
      }

      // Application metrics
      this.metrics.uptime = Math.round(process.uptime())

    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message)
      this.logAlert('error', 'Metrics collection failed', error.message)
    }
  }

  async performHealthCheck() {
    try {
      const startTime = Date.now()

      // Check backend health
      const backendHealthy = await this.checkEndpoint('http://localhost:5001/api/health')

      // Check frontend health
      const frontendHealthy = await this.checkEndpoint('http://localhost:3000/api/monitoring/health')

      const responseTime = Date.now() - startTime
      this.metrics.responseTime = responseTime
      this.metrics.lastHealthCheck = new Date().toISOString()

      if (!backendHealthy || !frontendHealthy) {
        this.logAlert('critical', 'Health check failed',
          `Backend: ${backendHealthy ? '✅' : '❌'}, Frontend: ${frontendHealthy ? '✅' : '❌'}`)
      }

      if (responseTime > this.thresholds.responseTime) {
        this.logAlert('warning', 'Slow response time', `${responseTime}ms`)
      }

    } catch (error) {
      this.logAlert('critical', 'Health check error', error.message)
    }
  }

  async checkEndpoint(url) {
    return new Promise(resolve => {
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

  checkThresholds() {
    // Memory threshold
    if (this.metrics.memory.percentage > this.thresholds.memoryUsage) {
      this.logAlert('warning', 'High memory usage',
        `${this.metrics.memory.percentage}% (${this.metrics.memory.used}MB/${this.metrics.memory.total}MB)`)
    }

    // CPU threshold
    if (this.metrics.cpu.usage > this.thresholds.cpuUsage) {
      this.logAlert('warning', 'High CPU usage', `${this.metrics.cpu.usage}%`)
    }

    // Error rate (simplified)
    if (this.alerts.filter(a => a.level === 'error').length > 5) {
      this.logAlert('error', 'High error rate detected', 'Multiple errors in monitoring period')
    }
  }

  logAlert(level, title, message) {
    const alert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      level, // critical, error, warning, info
      title,
      message,
      resolved: false
    }

    this.alerts.unshift(alert)
    this.alerts = this.alerts.slice(0, 100) // Keep last 100 alerts

    console.log(`🚨 [${level.toUpperCase()}] ${title}: ${message}`)

    // Send to external monitoring if configured
    this.sendExternalAlert(alert)
  }

  async sendExternalAlert(alert) {
    // Send to Slack, email, etc.
    try {
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Click Alert: ${alert.title}\n${alert.message}`,
            attachments: [{
              color: alert.level === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Level', value: alert.level, short: true },
                { title: 'Time', value: alert.timestamp, short: true }
              ]
            }]
          })
        })
      }
    } catch (error) {
      console.error('Failed to send external alert:', error.message)
    }
  }

  startDashboardServer() {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: this.metrics.uptime,
          version: process.env.npm_package_version || '1.0.0'
        }))
      } else if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(this.metrics))
      } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(this.generateDashboardHTML())
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    server.listen(9090, () => {
      console.log('📊 Monitoring dashboard: http://localhost:9090')
    })
  }

  generateDashboardHTML() {
    const statusColor = this.alerts.some(a => a.level === 'critical') ? 'red' :
                       this.alerts.some(a => a.level === 'error') ? 'orange' : 'green'

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Click Production Monitor</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-title { font-size: 14px; color: #666; margin-bottom: 8px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .alert-list { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .alert-item { padding: 10px; margin-bottom: 10px; border-radius: 4px; }
        .alert-critical { background: #fee; border-left: 4px solid #e74c3c; }
        .alert-error { background: #fef5e7; border-left: 4px solid #f39c12; }
        .alert-warning { background: #fef9e7; border-left: 4px solid #f1c40f; }
        .status-${statusColor} { color: ${statusColor === 'green' ? '#27ae60' : statusColor === 'orange' ? '#e67e22' : '#e74c3c'}; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Click Production Monitor</h1>
            <p class="status-${statusColor}">Status: ${statusColor === 'green' ? 'All Systems Operational' : 'Issues Detected'}</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">System Uptime</div>
                <div class="metric-value">${Math.floor(this.metrics.uptime / 3600)}h ${Math.floor((this.metrics.uptime % 3600) / 60)}m</div>
            </div>

            <div class="metric-card">
                <div class="metric-title">Memory Usage</div>
                <div class="metric-value">${this.metrics.memory.percentage}%</div>
                <div style="font-size: 12px; color: #666;">${this.metrics.memory.used}MB / ${this.metrics.memory.total}MB</div>
            </div>

            <div class="metric-card">
                <div class="metric-title">CPU Usage</div>
                <div class="metric-value">${this.metrics.cpu.usage}%</div>
                <div style="font-size: 12px; color: #666;">${this.metrics.cpu.cores} cores</div>
            </div>

            <div class="metric-card">
                <div class="metric-title">Response Time</div>
                <div class="metric-value">${this.metrics.responseTime}ms</div>
            </div>
        </div>

        <div class="alert-list">
            <h3>Recent Alerts</h3>
            ${this.alerts.slice(0, 10).map(alert => `
                <div class="alert-item alert-${alert.level}">
                    <strong>${alert.title}</strong>
                    <div style="font-size: 12px; color: #666;">${alert.timestamp}</div>
                    <div>${alert.message}</div>
                </div>
            `).join('')}
            ${this.alerts.length === 0 ? '<p>No recent alerts</p>' : ''}
        </div>
    </div>

    <script>
        setTimeout(() => location.reload(), 30000); // Refresh every 30 seconds
    </script>
</body>
</html>`
  }
}

// Start monitoring
const monitor = new ProductionMonitor()
monitor.startMonitoring().catch(console.error)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('📊 Shutting down production monitoring...')
  process.exit(0)
})

module.exports = ProductionMonitor



