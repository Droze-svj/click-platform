'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    __errorRecoverySystem?: ErrorRecoveryManager
    __debugLogs?: any[]
    __socket?: any
    __websocketStatus?: string
    __disableDebugPing?: boolean
    __clearRecoveryHistory?: () => void
    __attemptRecovery?: (error: any) => Promise<any>
    __toggleErrorRecovery?: (enabled: boolean) => void
  }
}

interface ErrorPattern {
  id: string
  name: string
  description: string
  detect: (error: any) => boolean
  canAutoFix: boolean
  autoFix: (error: any) => Promise<boolean>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface RecoveryAction {
  id: string
  timestamp: number
  errorType: string
  action: string
  success: boolean
  details?: any
}

class ErrorRecoveryManager {
  private patterns: ErrorPattern[] = []
  private recoveryHistory: RecoveryAction[] = []
  private maxHistorySize = 50

  constructor() {
    this.initializePatterns()
  }

  private initializePatterns() {
    this.patterns = [
      // Network connectivity errors
      {
        id: 'network_timeout',
        name: 'Network Timeout',
        description: 'Request timed out - could be connectivity issue',
        detect: (error) => {
          return error?.message?.includes('timeout') ||
                 error?.message?.includes('network') ||
                 error?.code === 'NETWORK_ERROR' ||
                 error?.name === 'TimeoutError'
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🔄 Attempting network recovery...')
          // Wait a bit and retry connectivity
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            const response = await fetch('/api/debug/ping', {
              method: 'GET',
              signal: AbortSignal.timeout(5000)
            })
            return response.ok
          } catch {
            return false
          }
        },
        severity: 'medium'
      },

      // API authentication errors
      {
        id: 'auth_expired',
        name: 'Authentication Expired',
        description: 'Token expired - attempting refresh',
        detect: (error) => {
          return error?.status === 401 ||
                 error?.message?.includes('unauthorized') ||
                 error?.message?.includes('token expired') ||
                 error?.message?.includes('jwt expired')
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🔄 Attempting token refresh...')
          try {
            // Try to refresh token via API
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: localStorage.getItem('token') })
            })

            if (response.ok) {
              const data = await response.json()
              if (data.token) {
                localStorage.setItem('token', data.token)
                console.log('✅ Token refreshed successfully')
                return true
              }
            }
            return false
          } catch {
            return false
          }
        },
        severity: 'high'
      },

      // Memory pressure
      {
        id: 'memory_pressure',
        name: 'Memory Pressure',
        description: 'High memory usage detected - cleaning up',
        detect: (error) => {
          if (typeof performance !== 'undefined' && 'memory' in performance) {
            const mem = (performance as any).memory
            const usagePercent = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100
            return usagePercent > 80
          }
          return false
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🧹 Performing memory cleanup...')

          // Clear any cached data
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys()
              await Promise.all(cacheNames.map(name => caches.delete(name)))
            } catch {}
          }

          // Force garbage collection if available
          if ('gc' in window) {
            try {
              (window as any).gc()
            } catch {}
          }

          // Clear any debug data
          if (window.__debugLogs) {
            window.__debugLogs = []
          }

          return true
        },
        severity: 'medium'
      },

      // Component hydration mismatch
      {
        id: 'hydration_mismatch',
        name: 'Hydration Mismatch',
        description: 'Client/server mismatch - refreshing',
        detect: (error) => {
          return error?.message?.includes('hydration') ||
                 error?.message?.includes('mismatch') ||
                 error?.message?.includes('client') && error?.message?.includes('server')
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🔄 Fixing hydration mismatch...')
          // Soft refresh to fix hydration issues
          window.location.reload()
          return true // This won't actually return since we reload
        },
        severity: 'high'
      },

      // API rate limiting
      {
        id: 'rate_limited',
        name: 'Rate Limited',
        description: 'Too many requests - waiting before retry',
        detect: (error) => {
          return error?.status === 429 ||
                 error?.message?.includes('rate limit') ||
                 error?.message?.includes('too many requests')
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('⏱️ Rate limited - waiting before retry...')
          // Wait for rate limit to reset (assume 60 seconds)
          await new Promise(resolve => setTimeout(resolve, 60000))

          // Try a simple ping to see if we're good
          try {
            const response = await fetch('/api/debug/ping')
            return response.ok
          } catch {
            return false
          }
        },
        severity: 'medium'
      },

      // Service worker issues
      {
        id: 'service_worker_error',
        name: 'Service Worker Error',
        description: 'Service worker issue - unregistering',
        detect: (error) => {
          return error?.message?.includes('service worker') ||
                 error?.message?.includes('serviceworker') ||
                 error?.stack?.includes('serviceworker')
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🔧 Fixing service worker issues...')
          if ('serviceWorker' in navigator) {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations()
              await Promise.all(registrations.map(reg => reg.unregister()))
              console.log('✅ Service workers unregistered')
              return true
            } catch {
              return false
            }
          }
          return false
        },
        severity: 'low'
      },

      // WebSocket connection issues
      {
        id: 'websocket_error',
        name: 'WebSocket Error',
        description: 'WebSocket connection failed - attempting reconnect',
        detect: (error) => {
          return error?.message?.includes('websocket') ||
                 error?.message?.includes('socket') ||
                 error?.target instanceof WebSocket
        },
        canAutoFix: true,
        autoFix: async (error) => {
          console.log('🔌 Attempting WebSocket recovery...')
          // This would typically trigger a reconnect in your WebSocket manager
          if ((window as any).__socket && typeof (window as any).__socket.connect === 'function') {
            try {
              (window as any).__socket.connect()
              return true
            } catch {
              return false
            }
          }
          return false
        },
        severity: 'medium'
      }
    ]
  }

  async attemptRecovery(error: any): Promise<{success: boolean, action?: RecoveryAction}> {
    for (const pattern of this.patterns) {
      if (pattern.detect(error)) {
        console.log(`🎯 Detected error pattern: ${pattern.name} (${pattern.severity})`)

        if (pattern.canAutoFix) {
          console.log(`🔧 Attempting auto-fix: ${pattern.description}`)
          try {
            const success = await pattern.autoFix(error)
            const action: RecoveryAction = {
              id: `${pattern.id}_${Date.now()}`,
              timestamp: Date.now(),
              errorType: pattern.name,
              action: pattern.description,
              success,
              details: error
            }

            this.recoveryHistory.unshift(action)
            if (this.recoveryHistory.length > this.maxHistorySize) {
              this.recoveryHistory = this.recoveryHistory.slice(0, this.maxHistorySize)
            }

            if (success) {
              console.log(`✅ Auto-fix successful: ${pattern.name}`)
            } else {
              console.log(`❌ Auto-fix failed: ${pattern.name}`)
            }

            return { success, action }
          } catch (fixError) {
            console.error(`💥 Auto-fix error for ${pattern.name}:`, fixError)
            return {
              success: false,
              action: {
                id: `${pattern.id}_error_${Date.now()}`,
                timestamp: Date.now(),
                errorType: pattern.name,
                action: `Failed: ${fixError}`,
                success: false,
                details: { originalError: error, fixError }
              }
            }
          }
        } else {
          console.log(`⚠️ Error detected but cannot auto-fix: ${pattern.name}`)
          return { success: false }
        }
      }
    }

    console.log('❓ Error not recognized by recovery system')
    return { success: false }
  }

  getRecoveryHistory(): RecoveryAction[] {
    return [...this.recoveryHistory]
  }

  clearHistory(): void {
    this.recoveryHistory = []
  }
}

// React hook for using the error recovery system
export default function ErrorRecoverySystem() {
  const [recoverySystem] = useState(() => new ErrorRecoveryManager())
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryAction[]>([])
  const [isEnabled, setIsEnabled] = useState(true)
  const router = useRouter()

  // Global error handlers
  useEffect(() => {
    if (!isEnabled) return

    const handleGlobalError = async (event: ErrorEvent) => {
      const result = await recoverySystem.attemptRecovery({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'javascript_error'
      })

      if (result.success) {
        event.preventDefault() // Prevent default error handling
      }
    }

    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      const result = await recoverySystem.attemptRecovery({
        reason: event.reason,
        type: 'promise_rejection'
      })

      if (result.success) {
        event.preventDefault()
      }
    }

    // Network error detection
    const originalFetch = window.fetch
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args)
        if (!response.ok && response.status >= 500) {
          // Server error - attempt recovery
          recoverySystem.attemptRecovery({
            status: response.status,
            url: args[0],
            type: 'api_error'
          })
        }
        return response
      } catch (error) {
        // Network error - attempt recovery
        recoverySystem.attemptRecovery({
          message: (error as any)?.message || 'Network error',
          stack: (error as any)?.stack,
          type: 'network_error'
        })
        throw error
      }
    }

    window.addEventListener('error', handleGlobalError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Make system globally available
    window.__errorRecoverySystem = recoverySystem

    return () => {
      window.removeEventListener('error', handleGlobalError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.fetch = originalFetch
    }
  }, [recoverySystem, isEnabled])

  // Update recovery history display
  useEffect(() => {
    const updateHistory = () => setRecoveryHistory(recoverySystem.getRecoveryHistory())
    updateHistory()
    const interval = setInterval(updateHistory, 2000)
    return () => clearInterval(interval)
  }, [recoverySystem])

  // Expose recovery functions globally for manual use
  useEffect(() => {
    (window as any).__attemptRecovery = async (error: any) => await recoverySystem.attemptRecovery(error)
    ;(window as any).__clearRecoveryHistory = () => recoverySystem.clearHistory()
    ;(window as any).__toggleErrorRecovery = (enabled: boolean) => setIsEnabled(enabled)
  }, [recoverySystem])

  return null // This component doesn't render anything
}

// Recovery status display component
export function RecoveryStatusDisplay() {
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryAction[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const updateHistory = () => {
      if (window.__errorRecoverySystem) {
        setRecoveryHistory(window.__errorRecoverySystem.getRecoveryHistory())
      }
    }
    updateHistory()
    const interval = setInterval(updateHistory, 2000)
    return () => clearInterval(interval)
  }, [])

  if (recoveryHistory.length === 0) return null

  const recentRecoveries = recoveryHistory.slice(0, 5)
  const successCount = recoveryHistory.filter(r => r.success).length
  const totalCount = recoveryHistory.length

  return (
    <div style={{
      position: 'fixed',
      right: 8,
      bottom: 8,
      zIndex: 99998,
      background: 'rgba(17, 24, 39, 0.9)',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 6,
      fontSize: 12,
      fontFamily: 'monospace',
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    }}>
      <div style={{ marginBottom: 4, cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
        🔧 Recovery: {successCount}/{totalCount} successful
        <span style={{ marginLeft: 4 }}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {recentRecoveries.map((recovery, index) => (
            <div key={recovery.id} style={{
              marginBottom: 4,
              padding: '4px 6px',
              background: recovery.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              borderRadius: 4,
              fontSize: 10
            }}>
              <div style={{ fontWeight: 'bold' }}>
                {recovery.success ? '✅' : '❌'} {recovery.errorType}
              </div>
              <div style={{ opacity: 0.8 }}>{recovery.action}</div>
              <div style={{ opacity: 0.6, fontSize: 9 }}>
                {new Date(recovery.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
