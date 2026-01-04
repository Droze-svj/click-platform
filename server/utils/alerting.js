/**
 * Automated Alerting System
 * Handles alerts from APM, RUM, and other monitoring systems
 */

const nodemailer = require('nodemailer')
const { WebClient } = require('@slack/web-api')

class AlertingSystem {
  constructor() {
    this.transporters = new Map()
    this.alertHistory = []
    this.alertCooldowns = new Map()
    this.isInitialized = false

    // Initialize config step by step to avoid reference issues
    const emailConfig = {
      enabled: !!process.env.SMTP_HOST,
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: process.env.ALERT_FROM_EMAIL || 'alerts@click.com',
      to: process.env.ALERT_TO_EMAILS ? process.env.ALERT_TO_EMAILS.split(',') : []
    }

    const slackConfig = {
      enabled: !!process.env.SLACK_BOT_TOKEN,
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      webhook: process.env.SLACK_WEBHOOK_URL
    }

    const webhookConfig = {
      enabled: !!process.env.ALERT_WEBHOOK_URL,
      url: process.env.ALERT_WEBHOOK_URL,
      headers: process.env.ALERT_WEBHOOK_HEADERS ?
        JSON.parse(process.env.ALERT_WEBHOOK_HEADERS) : {}
    }

    this.config = {
      email: emailConfig,
      slack: slackConfig,
      webhook: webhookConfig,
      console: {
        enabled: process.env.NODE_ENV === 'development' || !emailConfig.enabled && !slackConfig.enabled && !webhookConfig.enabled,
        detailed: process.env.NEXT_PUBLIC_ENABLE_DETAILED_LOGGING === 'true'
      },
      cooldownMinutes: parseInt(process.env.ALERT_COOLDOWN_MINUTES) || 5,
      maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR) || 10
    }

    this.initialize()
  }

  /**
   * Initialize alerting system
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      // Initialize email transporter
      if (this.config.email.enabled) {
        this.transporters.set('email', nodemailer.createTransporter({
          host: this.config.email.host,
          port: this.config.email.port,
          secure: this.config.email.secure,
          auth: this.config.email.auth
        }))

        console.log('✅ Email alerting initialized')
      }

      // Initialize Slack client
      if (this.config.slack.enabled) {
        if (this.config.slack.token) {
          this.transporters.set('slack', new WebClient(this.config.slack.token))
        }
        console.log('✅ Slack alerting initialized')
      }

      this.isInitialized = true
      console.log('✅ Alerting system initialized')

    } catch (error) {
      console.error('❌ Failed to initialize alerting system:', error.message)
    }
  }

  /**
   * Handle alert from monitoring systems
   */
  async handleAlert(alert) {
    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        console.warn('⚠️ Alert rate limit exceeded, skipping alert')
        return
      }

      // Check cooldown for this alert type
      if (this.checkCooldown(alert)) {
        console.log(`⚠️ Alert cooldown active for ${alert.type}, skipping`)
        return
      }

      // Set cooldown
      this.setCooldown(alert)

      // Enhance alert with metadata
      const enhancedAlert = {
        ...alert,
        id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: alert.timestamp || Date.now(),
        environment: process.env.NODE_ENV || 'development',
        hostname: require('os').hostname(),
        version: process.env.npm_package_version || 'unknown'
      }

      // Store in history
      this.alertHistory.push(enhancedAlert)

      // Keep only last 1000 alerts
      if (this.alertHistory.length > 1000) {
        this.alertHistory = this.alertHistory.slice(-1000)
      }

      // Send alerts
      await this.sendAlerts(enhancedAlert)

      console.log(`🚨 Alert sent: ${alert.type} (${alert.severity})`)

    } catch (error) {
      console.error('❌ Alert handling failed:', error.message)
    }
  }

  /**
   * Send alert to all configured channels
   */
  async sendAlerts(alert) {
    const promises = []

    if (this.config.email.enabled && this.transporters.has('email')) {
      promises.push(this.sendEmailAlert(alert))
    }

    if (this.config.slack.enabled) {
      promises.push(this.sendSlackAlert(alert))
    }

    if (this.config.webhook.enabled) {
      promises.push(this.sendWebhookAlert(alert))
    }

    if (this.config.console.enabled) {
      promises.push(this.sendConsoleAlert(alert))
    }

    // Always log to console as fallback
    this.logAlert(alert)

    await Promise.allSettled(promises)
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const transporter = this.transporters.get('email')
      if (!transporter) return

      const subject = `[${alert.severity.toUpperCase()}] ${alert.type} - ${process.env.NODE_ENV || 'production'}`
      const html = this.formatEmailAlert(alert)

      await transporter.sendMail({
        from: this.config.email.from,
        to: this.config.email.to,
        subject,
        html
      })

    } catch (error) {
      console.error('❌ Email alert failed:', error.message)
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const color = this.getSeverityColor(alert.severity)

      const message = {
        channel: this.config.slack.channel,
        text: `🚨 *${alert.type}* (${alert.severity})`,
        attachments: [{
          color,
          fields: [
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: true
            }
          ],
          text: this.formatAlertDescription(alert),
          footer: `Click Alerting System | ${alert.hostname}`,
          ts: alert.timestamp / 1000
        }]
      }

      if (this.config.slack.webhook) {
        // Use webhook
        await fetch(this.config.slack.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        })
      } else if (this.transporters.has('slack')) {
        // Use bot token
        const client = this.transporters.get('slack')
        await client.chat.postMessage(message)
      }

    } catch (error) {
      console.error('❌ Slack alert failed:', error.message)
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    try {
      await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('❌ Webhook alert failed:', error.message)
    }
  }

  /**
   * Send console alert (enhanced logging)
   */
  async sendConsoleAlert(alert) {
    const timestamp = new Date(alert.timestamp).toISOString()
    const severityEmoji = this.getSeverityEmoji(alert.severity)

    console.log(`🚨 ${severityEmoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.type}`)
    console.log(`   📅 Time: ${timestamp}`)
    console.log(`   🏢 Environment: ${alert.environment}`)
    console.log(`   🖥️  Host: ${alert.hostname}`)
    console.log(`   📝 Description: ${this.formatAlertDescription(alert)}`)

    if (this.config.console.detailed && alert.data) {
      console.log('   📊 Details:', JSON.stringify(alert.data, null, 2))
    }

    if (alert.data?.recommendations) {
      console.log('   💡 Recommendations:')
      alert.data.recommendations.forEach((rec, i) => {
        console.log(`      ${i + 1}. ${rec}`)
      })
    }

    console.log('   ──────────────────────────────────────────────────')
  }

  /**
   * Log alert to console (basic)
   */
  logAlert(alert) {
    const color = this.getSeverityColor(alert.severity)
    const timestamp = new Date(alert.timestamp).toISOString()

    console.log(`🚨 [${timestamp}] ${color} ${alert.type} (${alert.severity})`)
    console.log(`   ${this.formatAlertDescription(alert)}`)

    if (alert.data) {
      console.log('   Data:', JSON.stringify(alert.data, null, 2))
    }
  }

  /**
   * Format alert description
   */
  formatAlertDescription(alert) {
    switch (alert.type) {
      case 'high_response_time':
        return `API response time exceeded threshold: ${alert.data.responseTime}ms > ${alert.data.threshold}ms`

      case 'high_error_rate':
        return `Error rate exceeded threshold: ${alert.data.errorRate} > ${alert.data.threshold}`

      case 'high_memory_usage':
        return `Memory usage exceeded threshold: ${(alert.data.utilization * 100).toFixed(1)}% > ${(alert.data.threshold * 100).toFixed(1)}%`

      case 'high_cpu_usage':
        return `CPU usage exceeded threshold: ${(alert.data.utilization * 100).toFixed(1)}% > ${(alert.data.threshold * 100).toFixed(1)}%`

      case 'slow_database_query':
        return `Database query exceeded threshold: ${alert.data.duration}ms > ${alert.data.threshold}ms`

      default:
        return alert.data?.message || 'Alert triggered'
    }
  }

  /**
   * Format email alert
   */
  formatEmailAlert(alert) {
    const color = this.getSeverityColor(alert.severity)
    const timestamp = new Date(alert.timestamp).toISOString()

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${color}; border-bottom: 2px solid ${color}; padding-bottom: 10px;">
          🚨 ${alert.type} (${alert.severity})
        </h1>

        <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <strong>Time:</strong> ${timestamp}<br>
          <strong>Environment:</strong> ${alert.environment}<br>
          <strong>Host:</strong> ${alert.hostname}<br>
          <strong>Version:</strong> ${alert.version}
        </div>

        <div style="background: #fff; padding: 15px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px;">
          <h3>Description:</h3>
          <p>${this.formatAlertDescription(alert)}</p>
        </div>

        ${alert.data ? `
          <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border: 1px solid #ddd; border-radius: 5px;">
            <h3>Details:</h3>
            <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">
${JSON.stringify(alert.data, null, 2)}
            </pre>
          </div>
        ` : ''}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>This alert was generated by the Click monitoring system.</p>
          <p>Please investigate and resolve as soon as possible.</p>
        </div>
      </div>
    `
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return '#dc2626'
      case 'high': return '#ea580c'
      case 'medium': return '#ca8a04'
      case 'low': return '#16a34a'
      default: return '#6b7280'
    }
  }

  /**
   * Get severity emoji
   */
  getSeverityEmoji(severity) {
    switch (severity) {
      case 'critical': return '🚨🚨🚨'
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const recentAlerts = this.alertHistory.filter(alert => alert.timestamp > oneHourAgo)

    return recentAlerts.length < this.config.maxAlertsPerHour
  }

  /**
   * Check cooldown for alert type
   */
  checkCooldown(alert) {
    const key = `${alert.type}_${alert.severity}`
    const lastAlert = this.alertCooldowns.get(key)

    if (!lastAlert) return false

    const cooldownMs = this.config.cooldownMinutes * 60 * 1000
    return (Date.now() - lastAlert) < cooldownMs
  }

  /**
   * Set cooldown for alert type
   */
  setCooldown(alert) {
    const key = `${alert.type}_${alert.severity}`
    this.alertCooldowns.set(key, Date.now())
  }

  /**
   * Get alert statistics
   */
  getStats() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)

    const recentAlerts = this.alertHistory.filter(alert => alert.timestamp > oneHourAgo)
    const dailyAlerts = this.alertHistory.filter(alert => alert.timestamp > oneDayAgo)

    return {
      total: this.alertHistory.length,
      lastHour: recentAlerts.length,
      last24Hours: dailyAlerts.length,
      bySeverity: this.groupBy(this.alertHistory, 'severity'),
      byType: this.groupBy(this.alertHistory, 'type'),
      activeCooldowns: this.alertCooldowns.size,
      config: this.config
    }
  }

  /**
   * Group alerts by key
   */
  groupBy(alerts, key) {
    return alerts.reduce((groups, alert) => {
      const value = alert[key] || 'unknown'
      groups[value] = (groups[value] || 0) + 1
      return groups
    }, {})
  }

  /**
   * Test alerting system
   */
  async test() {
    const testAlert = {
      type: 'test_alert',
      severity: 'low',
      data: {
        message: 'This is a test alert from the Click alerting system',
        timestamp: Date.now()
      }
    }

    console.log('🧪 Testing alerting system...')
    await this.handleAlert(testAlert)
  }

  /**
   * Get alert history
   */
  getHistory(limit = 50) {
    return this.alertHistory.slice(-limit).reverse()
  }
}

// Create singleton instance
const alertingSystem = new AlertingSystem()

// Make available globally for APM and other monitors
global.alertingSystem = alertingSystem

module.exports = alertingSystem
