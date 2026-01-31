'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Suppress hydration warnings for this debug component
const SUPPRESS_HYDRATION_WARNING = true

export default function DevDebugBanner() {
  const [pingStatus, setPingStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [pingTs, setPingTs] = useState<number | null>(null)
  const [userClickCount, setUserClickCount] = useState(0)
  const [href, setHref] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [buttonFeedback, setButtonFeedback] = useState<string>('')

  // Enhanced tracking states
  const [memoryUsage, setMemoryUsage] = useState<{ used: number, total: number, limit: number } | null>(null)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('online')
  const [connectionInfo, setConnectionInfo] = useState<any>(null)
  const [pageLoadTime, setPageLoadTime] = useState<number | null>(null)
  const [errorCount, setErrorCount] = useState(0)
  const [routeChangeCount, setRouteChangeCount] = useState(0)
  const [apiCallCount, setApiCallCount] = useState(0)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [scrollDepth, setScrollDepth] = useState(0)
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'unknown' | 'registered' | 'unregistered'>('unknown')
  const [websocketStatus, setWebsocketStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [recoveryStats, setRecoveryStats] = useState<{ attempts: number, successes: number, lastAction?: string }>({ attempts: 0, successes: 0 })

  // App Router signals route changes via these hooks (forces rerender).
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const marker = useMemo(() => 'run39-dev-banner', [])

  // Prevent hydration mismatches by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const send = (message: string, data: Record<string, any>) => {
    // Log debug events but reduce spam for frequent events
    if (message.includes('error') || message.includes('fail') ||
      message === 'dev_banner_ping' ||
      message.includes('dev_banner_user_click') ||
      message.includes('dev_banner_user_pointerdown')) {
      console.log('Debug banner:', message, data)
    }
  }

  // Session start time
  const sessionStartTime = useMemo(() => Date.now(), [])

  // Update session duration (less frequently)
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000))
    }, 5000) // Update every 5 seconds instead of 1
    return () => clearInterval(interval)
  }, [sessionStartTime])

  // Memory usage tracking (reduced frequency to prevent excessive updates)
  useEffect(() => {
    const updateMemoryUsage = () => {
      try {
        if ('memory' in performance) {
          const mem = (performance as any).memory
          setMemoryUsage({
            used: mem.usedJSHeapSize,
            total: mem.totalJSHeapSize,
            limit: mem.jsHeapSizeLimit
          })
        }
      } catch { }
    }

    updateMemoryUsage()
    const interval = setInterval(updateMemoryUsage, 10000) // Update every 10 seconds instead of 5
    return () => clearInterval(interval)
  }, [])

  // Network status tracking
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkStatus(navigator.onLine ? 'online' : 'offline')
      try {
        if ('connection' in navigator) {
          setConnectionInfo((navigator as any).connection)
        }
      } catch { }
    }

    updateNetworkStatus()
    window.addEventListener('online', () => setNetworkStatus('online'))
    window.addEventListener('offline', () => setNetworkStatus('offline'))

    // Connection change listener (throttled to prevent excessive updates)
    let lastUpdate = 0
    try {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        const updateConnection = () => {
          const now = Date.now()
          if (now - lastUpdate > 2000) { // Only update every 2 seconds max
            lastUpdate = now
            setConnectionInfo(connection)
          }
        }
        connection.addEventListener('change', updateConnection)
        return () => connection.removeEventListener('change', updateConnection)
      }
    } catch { }

    return () => {
      window.removeEventListener('online', () => setNetworkStatus('online'))
      window.removeEventListener('offline', () => setNetworkStatus('offline'))
    }
  }, [])

  // Page load time
  useEffect(() => {
    try {
      if ('performance' in window && 'timing' in performance) {
        const timing = performance.timing
        const loadTime = timing.loadEventEnd - timing.navigationStart
        setPageLoadTime(loadTime)
      }
    } catch { }
  }, [])

  // Error tracking with detailed logging
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorCount(prev => prev + 1)
      console.warn('🔴 JavaScript Error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now()
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setErrorCount(prev => prev + 1)
      console.warn('🔴 Unhandled Promise Rejection:', {
        reason: event.reason,
        timestamp: Date.now()
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Route change tracking
  useEffect(() => {
    setRouteChangeCount(prev => prev + 1)
  }, [pathname])

  // Scroll depth tracking
  useEffect(() => {
    const handleScroll = () => {
      try {
        const scrollTop = window.scrollY
        const docHeight = document.documentElement.scrollHeight - window.innerHeight
        const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0
        setScrollDepth(scrollPercent)
      } catch { }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Service Worker status
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        setServiceWorkerStatus(registrations.length > 0 ? 'registered' : 'unregistered')
      }).catch(() => setServiceWorkerStatus('unregistered'))
    }
  }, [])

  // Simplified API call tracking - only track our internal API calls
  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input as Request).url || String(input)
      // Exclude debug log endpoint from tracking to avoid interference
      // Only track our internal API calls to avoid logging external service failures
      if (url && url.startsWith('/api/') && !url.includes('/api/debug/log') && !url.includes('127.0.0.1') && !url.includes('5561') && !url.includes('5557')) {
        setApiCallCount(prev => prev + 1)
      }
      return originalFetch.apply(this, [input, init])
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  // Simplified WebSocket tracking
  useEffect(() => {
    try {
      if ((window as any).__websocketStatus) {
        setWebsocketStatus((window as any).__websocketStatus)
      }
    } catch { }
  }, [])

  // Error recovery system monitoring
  useEffect(() => {
    const updateRecoveryStats = () => {
      try {
        if (window.__errorRecoverySystem) {
          const history = window.__errorRecoverySystem.getRecoveryHistory()
          const attempts = history.length
          const successes = history.filter(h => h.success).length
          const lastAction = history[0]?.action

          setRecoveryStats({ attempts, successes, lastAction })
        }
      } catch { }
    }

    updateRecoveryStats()
    const interval = setInterval(updateRecoveryStats, 3000) // Update every 3 seconds
    return () => clearInterval(interval)
  }, [])

  // Ping server periodically (every 30 seconds) - can be disabled by setting window.__disableDebugPing = true
  useEffect(() => {
    try {
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      if (!isLocal || (window as any).__disableDebugPing) return

      // Initial ping on mount
      const performPing = () => {
        try {
          setHref(window.location.href)
          const url = `/api/debug/ping?nonce=${encodeURIComponent(marker)}&ts=${Date.now()}`

          // Create abort controller for timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

          fetch(url, {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal
          })
            .then(async (r) => {
              clearTimeout(timeoutId)
              if (!r.ok) {
                throw new Error(`HTTP ${r.status}`)
              }
              const j = await r.json().catch(() => ({}))
              setPingStatus('ok')
              setPingTs(j?.timestamp || Date.now())
              send('dev_banner_ping', {
                marker,
                ok: true,
                href: window.location.href,
                pathname: window.location.pathname,
                timestamp: Date.now(),
                stats: {
                  sessionDuration,
                  errorCount,
                  routeChangeCount,
                  apiCallCount,
                  scrollDepth,
                  hasToken: !!(localStorage.getItem('token')),
                  networkStatus,
                  serviceWorkerStatus,
                  pingStatus: 'ok'
                }
              })
            })
            .catch((error: any) => {
              clearTimeout(timeoutId)
              // Only log non-abort errors
              if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
                setPingStatus('fail')
                console.warn('🔴 Ping failed:', error.message)
                send('dev_banner_ping_failed', {
                  marker,
                  error: error.message,
                  href: window.location.href,
                  timestamp: Date.now()
                })
              } else {
                // Timeout/abort - set status but don't spam console
                setPingStatus('fail')
              }
            })
        } catch {
          setPingStatus('fail')
        }
      }

      // Ping immediately on mount
      performPing()

      // Then ping every 30 seconds
      const interval = setInterval(performPing, 30000)
      return () => clearInterval(interval)

    } catch {
      setPingStatus('fail')
    }
  }, [marker]) // Only depend on marker, not all the changing state


  // Only show in local dev contexts - DISABLED for cleaner UI
  const shouldShow = false
  // Uncomment below to re-enable debug banner:
  // typeof window !== 'undefined' &&
  // (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')


  if (!shouldShow || !mounted) return null

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      onPointerDownCapture={(ev) => {
        try {
          setUserClickCount((c) => c + 1)
          const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
          send('dev_banner_user_pointerdown', {
            marker,
            href: window.location.href,
            pathname: window.location.pathname,
            isTrusted: (ev as any).isTrusted ?? null,
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            userClickCount: userClickCount + 1,
            memoryUsage,
            networkStatus,
            connectionInfo,
            sessionDuration,
            scrollDepth,
            errorCount,
            apiCallCount,
            routeChangeCount
          })
        } catch { }
      }}
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 99999,
        background: 'rgba(17, 24, 39, 0.95)',
        color: '#fff',
        padding: '12px 14px',
        borderRadius: 8,
        fontSize: 11,
        maxWidth: 600,
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
        🔍 DEBUG ACTIVE • {marker}
        {/* Add client-only indicator to prevent hydration mismatch */}
        {typeof window !== 'undefined' && <span style={{ opacity: 0.7 }}> (client)</span>}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.9, marginBottom: 2 }}>
          📍 <strong>URL:</strong>{' '}
          <span style={{ fontFamily: 'inherit', wordBreak: 'break-all' }}>
            {href || (typeof window !== 'undefined' ? window.location.href : '')}
          </span>
        </div>

        <div style={{ opacity: 0.9, marginBottom: 2 }}>
          🏓 <strong>Ping:</strong> <span style={{ color: pingStatus === 'ok' ? '#10b981' : pingStatus === 'fail' ? '#ef4444' : '#f59e0b' }}>{pingStatus}</span>
          {pingTs && <span> ({new Date(pingTs).toLocaleTimeString()})</span>}
          {(window as any).__disableDebugPing && <span style={{ color: '#f59e0b', fontSize: '10px' }}> (disabled)</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 8 }}>
        <div>⏱️ <strong>Session:</strong> {formatTime(sessionDuration)}</div>
        <div>📜 <strong>Scroll:</strong> {scrollDepth}%</div>

        <div>🖱️ <strong>Clicks:</strong> {userClickCount}</div>
        <div>🔄 <strong>Routes:</strong> {routeChangeCount}</div>

        <div>📡 <strong>API:</strong> {apiCallCount}</div>
        <div style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => {
          console.log('🔄 Error count reset clicked')
          setErrorCount(0)
        }} title="Click to reset error count">
          ❌ <strong>Errors:</strong> <span style={{ color: errorCount > 0 ? '#ef4444' : '#10b981' }}>{errorCount}</span>
          {errorCount > 0 && <span style={{ fontSize: '10px', marginLeft: '4px' }}>↻</span>}
        </div>
        <div title={`Recovery attempts: ${recoveryStats.attempts}, Successes: ${recoveryStats.successes}`}>
          🔧 <strong>Recovery:</strong> <span style={{ color: recoveryStats.successes > 0 ? '#10b981' : '#6b7280' }}>{recoveryStats.successes}/{recoveryStats.attempts}</span>
        </div>

        <div>🌐 <strong>Net:</strong> <span style={{ color: networkStatus === 'online' ? '#10b981' : '#ef4444' }}>{networkStatus}</span></div>
        <div>🔌 <strong>SW:</strong> <span style={{ color: serviceWorkerStatus === 'registered' ? '#10b981' : serviceWorkerStatus === 'unregistered' ? '#f59e0b' : '#6b7280' }}>{serviceWorkerStatus}</span></div>

        {memoryUsage && (
          <>
            <div>🧠 <strong>Mem:</strong> {formatMemory(memoryUsage.used)}</div>
            <div>📊 <strong>Heap:</strong> {((memoryUsage.used / memoryUsage.total) * 100).toFixed(0)}%</div>
          </>
        )}

        {connectionInfo && (
          <div>⚡ <strong>Conn:</strong> {connectionInfo.effectiveType || 'unknown'}</div>
        )}

        {pageLoadTime && (
          <div>⚡ <strong>Load:</strong> {pageLoadTime}ms</div>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={(ev) => {
              console.log('📊 Log snapshot button clicked')
              setButtonFeedback('snapshot')
              setTimeout(() => setButtonFeedback(''), 200)
              try {
                setUserClickCount((c) => c + 1)
                const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
                send('dev_banner_user_click', {
                  marker,
                  href: window.location.href,
                  pathname: window.location.pathname,
                  isTrusted: (ev as any).isTrusted ?? null,
                  hasToken: !!token,
                  tokenLength: token ? token.length : 0,
                  userClickCount: userClickCount + 1,
                  memoryUsage,
                  networkStatus,
                  connectionInfo,
                  sessionDuration,
                  scrollDepth,
                  errorCount,
                  apiCallCount,
                  routeChangeCount,
                  pageLoadTime,
                  serviceWorkerStatus,
                  websocketStatus
                })
              } catch (error) {
                console.error('❌ Error in snapshot button:', error)
              }
            }}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: buttonFeedback === 'snapshot' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            📊 Log Snapshot
          </button>

          <button
            type="button"
            onClick={async (ev) => {
              console.log('📋 View logs button clicked')
              setButtonFeedback('logs')
              setTimeout(() => setButtonFeedback(''), 200)
              try {
                // Safe stopPropagation - wrap in try-catch to prevent Illegal invocation errors
                try {
                  ev.stopPropagation()
                } catch (e) {
                  // Ignore stopPropagation errors
                }
                const response = await fetch('/api/debug/log')
                const data = await response.json()
                console.log('📊 Debug Logs:', data)
                alert(`Debug logs loaded! Check console for ${data.logs?.length || 0} entries.`)
              } catch (error) {
                console.error('❌ Error loading debug logs:', error)
                alert('Failed to load debug logs')
              }
            }}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: buttonFeedback === 'logs' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            📋 View Logs
          </button>

          <button
            type="button"
            onClick={(ev) => {
              // Safe stopPropagation - wrap in try-catch to prevent Illegal invocation errors
              try {
                ev.stopPropagation()
              } catch (e) {
                // Ignore stopPropagation errors
              }
              const disable = !(window as any).__disableDebugPing
                ; (window as any).__disableDebugPing = disable
              alert(`Debug ping ${disable ? 'disabled' : 'enabled'}. Refresh page to apply.`)
            }}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {(window as any).__disableDebugPing ? '🔄 Enable Ping' : '⏸️ Disable Ping'}
          </button>

          <button
            type="button"
            onClick={(ev) => {
              console.log('🧹 Reset All button clicked')
              setButtonFeedback('reset')
              setTimeout(() => setButtonFeedback(''), 200)
              // Safe stopPropagation - wrap in try-catch to prevent Illegal invocation errors
              try {
                ev.stopPropagation()
              } catch (e) {
                // Ignore stopPropagation errors
              }
              setErrorCount(0)
              setUserClickCount(0)
              setApiCallCount(0)
              setRouteChangeCount(0)
              setScrollDepth(0)
              // Clear recovery history
              if ((window as any).__clearRecoveryHistory) {
                (window as any).__clearRecoveryHistory()
              }
              alert('Debug counters and recovery history reset!')
            }}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: buttonFeedback === 'reset' ? 'rgba(245, 101, 101, 0.3)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            🧹 Reset All
          </button>

          <button
            type="button"
            onClick={(ev) => {
              console.log('🧪 Test Recovery button clicked')
              setButtonFeedback('recovery')
              setTimeout(() => setButtonFeedback(''), 200)
              // Safe stopPropagation - wrap in try-catch to prevent Illegal invocation errors
              try {
                ev.stopPropagation()
              } catch (e) {
                // Ignore stopPropagation errors
              }
              // Test recovery system with a fake error
              if ((window as any).__attemptRecovery) {
                (window as any).__attemptRecovery({
                  message: 'Test network error',
                  type: 'network_error'
                }).then((result: any) => {
                  console.log('Recovery test result:', result)
                  alert(`Recovery test: ${result.success ? 'SUCCESS' : 'FAILED'}`)
                }).catch((error: any) => {
                  console.error('❌ Recovery test error:', error)
                  alert('Recovery test failed - check console')
                })
              } else {
                console.warn('⚠️ Recovery system not available')
                alert('Recovery system not available')
              }
            }}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.25)',
              background: buttonFeedback === 'recovery' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
          >
            🧪 Test Recovery
          </button>
        </div>
      </div>

      <div style={{ opacity: 0.7, fontSize: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
        <a
          href="/debug-dashboard"
          target="_blank"
          style={{ color: '#60a5fa', textDecoration: 'underline' }}
          onClick={(e) => {
            console.log('🔗 Debug dashboard link clicked')
            // Safe stopPropagation - wrap in try-catch to prevent Illegal invocation errors
            try {
              e.stopPropagation()
            } catch (err) {
              // Ignore stopPropagation errors
            }
          }}
        >
          📊 Open Debug Dashboard
        </a>
        {' • '}
        <span
          style={{ cursor: 'pointer', color: '#fbbf24', textDecoration: 'underline' }}
          onClick={() => {
            console.log('🧪 Click test triggered - all handlers working!')
            setButtonFeedback('test')
            setTimeout(() => setButtonFeedback(''), 500)
          }}
        >
          Test Clicks
        </span>
        {' • '}
        Comprehensive client-side metrics
      </div>
    </div>
  )
}


