/**
 * Comprehensive error monitoring and alerting system
 */

import { errorHandler } from './errorHandler'
import { extractApiError } from './apiResponse'

interface ErrorThresholds {
  maxErrorsPerMinute: number
  maxErrorsPerSession: number
  alertCooldownMinutes: number
}

interface ErrorPattern {
  pattern: RegExp
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: string[]
}

interface AlertConfig {
  enabled: boolean
  thresholds: ErrorThresholds
  patterns: ErrorPattern[]
  notificationChannels: ('console' | 'debug' | 'toast' | 'localStorage')[]
}

export class ErrorMonitor {
  private static instance: ErrorMonitor
  private errorCounts = {
    lastMinute: 0,
    session: 0,
    byCategory: new Map<string, number>(),
    byComponent: new Map<string, number>()
  }

  private alertCooldowns = new Map<string, number>()
  private sessionStart = Date.now()
  private config: AlertConfig

  private constructor() {
    this.config = {
      enabled: process.env.NODE_ENV === 'development' ||
               (typeof localStorage !== 'undefined' && localStorage.getItem('error_monitoring') === 'enabled'),
      thresholds: {
        maxErrorsPerMinute: 10,
        maxErrorsPerSession: 50,
        alertCooldownMinutes: 5
      },
      patterns: [
        {
          pattern: /network|timeout|connection/i,
          description: 'Network connectivity issues',
          severity: 'medium',
          actions: ['Check internet connection', 'Retry operation', 'Contact support if persistent']
        },
        {
          pattern: /unauthorized|forbidden|401|403/i,
          description: 'Authentication or authorization issues',
          severity: 'high',
          actions: ['Re-authenticate', 'Check permissions', 'Contact administrator']
        },
        {
          pattern: /render|react|component/i,
          description: 'React rendering errors',
          severity: 'high',
          actions: ['Refresh page', 'Clear browser cache', 'Report to developers']
        },
        {
          pattern: /webgl|canvas|graphics/i,
          description: 'Graphics/WebGL errors',
          severity: 'medium',
          actions: ['Check browser compatibility', 'Disable hardware acceleration', 'Update graphics drivers']
        },
        {
          pattern: /quota|limit|429/i,
          description: 'Rate limiting or quota exceeded',
          severity: 'low',
          actions: ['Wait before retrying', 'Reduce request frequency', 'Upgrade plan if applicable']
        }
      ],
      notificationChannels: ['console', 'debug']
    }

    this.initializeMonitoring()
  }

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor()
    }
    return ErrorMonitor.instance
  }

  /**
   * Monitor an error and trigger alerts if thresholds are exceeded
   */
  monitorError(error: any, component?: string, action?: string, data?: any): void {
    if (!this.config.enabled) return

    try {
      // Update error counts
      this.errorCounts.session++
      this.errorCounts.lastMinute++

      if (component) {
        this.errorCounts.byComponent.set(
          component,
          (this.errorCounts.byComponent.get(component) || 0) + 1
        )
      }

      // Extract error information
      const errorInfo = extractApiError(error, { operation: action })
      this.errorCounts.byCategory.set(
        errorInfo.category,
        (this.errorCounts.byCategory.get(errorInfo.category) || 0) + 1
      )

      // Check patterns
      const matchedPattern = this.checkErrorPatterns(errorInfo)
      if (matchedPattern) {
        this.handlePatternMatch(matchedPattern, errorInfo, component, data)
      }

      // Check thresholds
      this.checkThresholds()

      // Reset minute counter periodically
      setTimeout(() => {
        this.errorCounts.lastMinute = Math.max(0, this.errorCounts.lastMinute - 1)
      }, 60000)

    } catch (monitorError) {
      console.error('[ErrorMonitor] Monitoring failed:', monitorError)
    }
  }

  /**
   * Check if error matches any monitored patterns
   */
  private checkErrorPatterns(errorInfo: ReturnType<typeof extractApiError>): ErrorPattern | null {
    const errorText = `${errorInfo.message} ${errorInfo.category}`.toLowerCase()

    for (const pattern of this.config.patterns) {
      if (pattern.pattern.test(errorText)) {
        return pattern
      }
    }

    return null
  }

  /**
   * Handle pattern-matched errors
   */
  private handlePatternMatch(
    pattern: ErrorPattern,
    errorInfo: ReturnType<typeof extractApiError>,
    component?: string,
    data?: any
  ): void {
    const alertKey = `${pattern.description}-${Date.now()}`
    const now = Date.now()
    const cooldownMs = this.config.thresholds.alertCooldownMinutes * 60 * 1000

    // Check cooldown
    const lastAlert = this.alertCooldowns.get(pattern.description)
    if (lastAlert && (now - lastAlert) < cooldownMs) {
      return // Still in cooldown
    }

    this.alertCooldowns.set(pattern.description, now)

    // Create alert
    const alert = {
      type: 'pattern_match',
      pattern: pattern.description,
      severity: pattern.severity,
      errorInfo,
      component,
      data,
      timestamp: new Date().toISOString(),
      actions: pattern.actions,
      sessionErrors: this.errorCounts.session
    }

    // Send to configured channels
    this.sendAlert(alert)
  }

  /**
   * Check if error thresholds are exceeded
   */
  private checkThresholds(): void {
    const now = Date.now()
    const sessionDurationMinutes = (now - this.sessionStart) / (1000 * 60)

    // Per-minute threshold
    if (this.errorCounts.lastMinute >= this.config.thresholds.maxErrorsPerMinute) {
      this.sendThresholdAlert('per_minute', this.errorCounts.lastMinute)
    }

    // Per-session threshold
    if (this.errorCounts.session >= this.config.thresholds.maxErrorsPerSession) {
      this.sendThresholdAlert('per_session', this.errorCounts.session)
    }

    // Per-category thresholds
    this.errorCounts.byCategory.forEach((count, category) => {
      if (count >= 5) { // Category-specific threshold
        this.sendThresholdAlert('per_category', count, category)
      }
    })
  }

  /**
   * Send threshold exceeded alerts
   */
  private sendThresholdAlert(type: string, count: number, category?: string): void {
    const alert = {
      type: 'threshold_exceeded',
      thresholdType: type,
      count,
      category,
      sessionErrors: this.errorCounts.session,
      timestamp: new Date().toISOString(),
      recommendations: [
        'Check application health',
        'Review recent changes',
        'Monitor error patterns',
        'Consider rolling back recent deployments'
      ]
    }

    this.sendAlert(alert)
  }

  /**
   * Send alert to configured channels
   */
  private sendAlert(alert: any): void {
    for (const channel of this.config.notificationChannels) {
      try {
        switch (channel) {
          case 'console':
            this.sendToConsole(alert)
            break
          case 'debug':
            this.sendToDebugLog(alert)
            break
          case 'toast':
            this.sendToToast(alert)
            break
          case 'localStorage':
            this.sendToLocalStorage(alert)
            break
        }
      } catch (channelError) {
        console.error(`[ErrorMonitor] Failed to send alert to ${channel}:`, channelError)
      }
    }
  }

  private sendToConsole(alert: any): void {
    const level = alert.severity === 'critical' ? 'error' :
                  alert.severity === 'high' ? 'error' :
                  alert.severity === 'medium' ? 'warn' : 'info'

    console[level](`[ErrorMonitor] ${alert.type.toUpperCase()}:`, alert)
  }

  private async sendToDebugLog(alert: any): Promise<void> {
    try {
      await fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'errorMonitor.ts',
          message: `error_alert_${alert.type}`,
          data: {
            ...alert,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-error-monitor'
          }
        }),
        signal: AbortSignal.timeout(5000)
      })
    } catch (error) {
      // Silently fail for debug logging
    }
  }

  private sendToToast(alert: any): void {
    // This would integrate with your toast system
    // For now, we'll just log it
    console.log('[ErrorMonitor] Toast alert:', alert)
  }

  private sendToLocalStorage(alert: any): void {
    if (typeof localStorage === 'undefined') return

    try {
      const alerts = JSON.parse(localStorage.getItem('error_alerts') || '[]')
      alerts.push(alert)

      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts.splice(0, alerts.length - 50)
      }

      localStorage.setItem('error_alerts', JSON.stringify(alerts))
    } catch (error) {
      console.warn('[ErrorMonitor] Failed to store alert in localStorage:', error)
    }
  }

  /**
   * Initialize monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return

    // Monitor global errors
    const originalOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      this.monitorError(error || message, 'Global', 'onerror', {
        source, lineno, colno, originalMessage: message
      })
      originalOnError?.(message, source, lineno, colno, error)
    }

    // Monitor unhandled promise rejections
    const originalOnUnhandledRejection = window.onunhandledrejection
    window.onunhandledrejection = (event) => {
      this.monitorError(event.reason, 'Global', 'unhandledrejection', {
        promise: event.promise
      })
      originalOnUnhandledRejection?.(event)
    }

    // Monitor console errors
    const originalConsoleError = console.error
    console.error = (...args) => {
      // Only monitor actual errors, not regular console.error calls
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Error')) {
        this.monitorError(args.join(' '), 'Console', 'console.error')
      }
      originalConsoleError.apply(console, args)
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    sessionErrors: number
    sessionDuration: number
    errorsPerMinute: number
    topCategories: Array<[string, number]>
    topComponents: Array<[string, number]>
  } {
    const sessionDuration = (Date.now() - this.sessionStart) / (1000 * 60) // minutes

    return {
      sessionErrors: this.errorCounts.session,
      sessionDuration,
      errorsPerMinute: sessionDuration > 0 ? this.errorCounts.session / sessionDuration : 0,
      topCategories: Array.from(this.errorCounts.byCategory.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      topComponents: Array.from(this.errorCounts.byComponent.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
    }
  }

  /**
   * Reset monitoring statistics
   */
  resetStats(): void {
    this.errorCounts = {
      lastMinute: 0,
      session: 0,
      byCategory: new Map(),
      byComponent: new Map()
    }
    this.sessionStart = Date.now()
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// Export singleton
export const errorMonitor = ErrorMonitor.getInstance()

// Convenience function to monitor errors
export const monitorError = errorMonitor.monitorError.bind(errorMonitor)



