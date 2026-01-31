'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    __systemStatusProbeInstalled?: boolean
  }
}

export default function SystemStatusProbe() {
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'unknown' | 'registered' | 'unregistered'>('unknown')
  const [cacheStatus, setCacheStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown')
  const [webSocketStatus, setWebSocketStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__systemStatusProbeInstalled) return
    window.__systemStatusProbeInstalled = true

    const send = (message: string, data: Record<string, any>) => {
      console.log('SystemStatusProbe:', message, data)
      fetch('/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: 'SystemStatusProbe',
          message,
          data: { ...data, timestamp: Date.now() }
        }),
      }).catch(() => {})
    }

    // Service Worker status tracking
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          const hasSW = registrations.length > 0
          setServiceWorkerStatus(hasSW ? 'registered' : 'unregistered')

          if (hasSW) {
            // Check SW state
            registrations.forEach(registration => {
              send('service_worker_state', {
                state: registration.active?.state || 'unknown',
                scope: registration.scope,
                href: window.location.href
              })
            })
          }
        } catch (error) {
          setServiceWorkerStatus('unregistered')
          send('service_worker_check_failed', {
            error: error instanceof Error ? error.message : String(error),
            href: window.location.href
          })
        }
      } else {
        setServiceWorkerStatus('unregistered')
      }
    }

    // Cache API availability check
    const checkCacheAPI = async () => {
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          setCacheStatus('available')
          send('cache_api_available', {
            cacheCount: cacheNames.length,
            cacheNames,
            href: window.location.href
          })
        } catch (error) {
          setCacheStatus('unavailable')
          send('cache_api_check_failed', {
            error: error instanceof Error ? error.message : String(error),
            href: window.location.href
          })
        }
      } else {
        setCacheStatus('unavailable')
      }
    }

    // WebSocket connection monitoring (looks for socket.io or native WebSocket connections)
    const checkWebSocketConnections = () => {
      try {
        // Check for socket.io connections
        if ((window as any).io && (window as any).__socket) {
          const socket = (window as any).__socket
          const connected = socket.connected
          setWebSocketStatus(connected ? 'connected' : 'disconnected')

          // Monitor socket events
          if (!socket.__statusProbeAttached) {
            socket.__statusProbeAttached = true

            socket.on('connect', () => {
              setWebSocketStatus('connected')
              send('websocket_connected', {
                href: window.location.href,
                timestamp: Date.now()
              })
            })

            socket.on('disconnect', () => {
              setWebSocketStatus('disconnected')
              send('websocket_disconnected', {
                href: window.location.href,
                timestamp: Date.now()
              })
            })

            socket.on('error', (error: any) => {
              send('websocket_error', {
                error: error instanceof Error ? error.message : String(error),
                href: window.location.href,
                timestamp: Date.now()
              })
            })
          }
        }
      } catch (error) {
        send('websocket_check_failed', {
          error: error instanceof Error ? error.message : String(error),
          href: window.location.href
        })
      }
    }

    // Performance observer for long tasks
    const observeLongTasks = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              send('long_task_detected', {
                duration: entry.duration,
                startTime: entry.startTime,
                href: window.location.href,
                pathname: window.location.pathname
              })
            }
          })
          observer.observe({ entryTypes: ['longtask'] })
        } catch (error) {
          // Long tasks not supported in this browser
        }
      }
    }

    // Battery status tracking (if available)
    const checkBatteryStatus = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery()
          send('battery_status', {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
            href: window.location.href
          })

          // Monitor battery changes
          battery.addEventListener('levelchange', () => {
            send('battery_level_changed', {
              level: battery.level,
              href: window.location.href
            })
          })

          battery.addEventListener('chargingchange', () => {
            send('battery_charging_changed', {
              charging: battery.charging,
              href: window.location.href
            })
          })
        }
      } catch (error) {
        // Battery API not supported
      }
    }

    // Device memory and hardware concurrency
    const checkDeviceCapabilities = () => {
      send('device_capabilities', {
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        href: window.location.href
      })
    }

    // Initialize all checks
    checkServiceWorker()
    checkCacheAPI()
    checkWebSocketConnections()
    observeLongTasks()
    checkBatteryStatus()
    checkDeviceCapabilities()

    // Periodic status checks
    const statusCheckInterval = setInterval(() => {
      checkServiceWorker()
      checkCacheAPI()
      checkWebSocketConnections()
    }, 30000) // Check every 30 seconds

    // Page visibility monitoring
    const handleVisibilityChange = () => {
      send('page_visibility_changed', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        href: window.location.href,
        timestamp: Date.now()
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(statusCheckInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Expose status to window for DevDebugBanner
  useEffect(() => {
    ;(window as any).__serviceWorkerStatus = serviceWorkerStatus
    ;(window as any).__cacheStatus = cacheStatus
    ;(window as any).__websocketStatus = webSocketStatus
  }, [serviceWorkerStatus, cacheStatus, webSocketStatus])

  return null
}
