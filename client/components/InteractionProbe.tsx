'use client'

import { useEffect } from 'react'
import { sendDebugLogNow } from '../utils/debugLog'

declare global {
  interface Window {
    __interactionProbeInstalled?: boolean
    __interactionProbeMounts?: number
    __interactionProbeHandlers?: {
      pointerdown?: (ev: PointerEvent) => void
      pointerup?: (ev: PointerEvent) => void
      click?: (ev: MouseEvent) => void
      pointerdown_bubble?: (ev: PointerEvent) => void
      pointerup_bubble?: (ev: PointerEvent) => void
      click_bubble?: (ev: MouseEvent) => void
      keydown?: (ev: KeyboardEvent) => void
      submit?: (ev: SubmitEvent) => void
      probeTest?: (ev: Event) => void
    }
    __interactionProbeState?: {
      installed?: boolean
      origStopPropagation?: ((this: Event) => void) | null
      origStopImmediatePropagation?: ((this: Event) => void) | null
    }
    __interactionProbeV50?: {
      counts?: Record<string, number>
      lastLogTime?: Record<string, number>
    }
  }
}

function isElement(x: any): x is Element {
  return x && typeof x === 'object' && x.nodeType === 1
}

// Removed external agent ingest - now using local debug API

function describeTarget(t: EventTarget | null) {
  if (!isElement(t)) return { kind: typeof t }
  const el = t as Element
  const tag = el.tagName?.toLowerCase?.() || ''
  const id = (el as any).id ? String((el as any).id) : ''
  const cls = (el as any).className ? String((el as any).className).slice(0, 120) : ''
  const text = (el as any).innerText ? String((el as any).innerText).trim().slice(0, 80) : ''
  const href = (el as any).href ? String((el as any).href) : ''
  const role = (el as any).getAttribute?.('role') ? String((el as any).getAttribute('role')) : ''
  const ariaLabel = (el as any).getAttribute?.('aria-label') ? String((el as any).getAttribute('aria-label')) : ''
  const agentOverlay = (el as any).getAttribute?.('data-agent-overlay')
    ? String((el as any).getAttribute('data-agent-overlay'))
    : ''
  return { tag, id, cls, text, href, role, ariaLabel, agentOverlay }
}

function safePath(ev: any) {
  try {
    const p = typeof ev?.composedPath === 'function' ? ev.composedPath() : []
    const out: any[] = []
    for (const n of (p || []).slice(0, 6)) {
      if (isElement(n)) out.push(describeTarget(n))
      else if (n === window) out.push({ kind: 'window' })
      else if (n === document) out.push({ kind: 'document' })
      else out.push({ kind: typeof n })
    }
    return out
  } catch {
    return []
  }
}

function atPointInfo(x: any, y: any) {
  let atPoint: any = null
  try {
    if (typeof x === 'number' && typeof y === 'number' && document?.elementFromPoint) {
      const el = document.elementFromPoint(x, y)
      atPoint = el ? describeTarget(el) : null
      ;(atPoint as any).__xy = { x, y }
      try {
        const cs = el ? window.getComputedStyle(el as Element) : null
        if (cs) {
          ;(atPoint as any).__style = {
            pointerEvents: cs.pointerEvents,
            position: cs.position,
            zIndex: cs.zIndex,
          }
        }
      } catch {}
    }
  } catch {}
  return atPoint
}

export default function InteractionProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // React StrictMode runs effects twice (mount -> cleanup -> mount).
    // If we "install once" and then cleanup removes listeners, the second mount will bail out
    // and we end up with no listeners at all. Use a simple ref-count + stable handlers instead.
    window.__interactionProbeMounts = (window.__interactionProbeMounts || 0) + 1
    window.__interactionProbeInstalled = true

    // Batch debug logs to reduce spam and improve performance
    let logQueue: Array<{ message: string; data: Record<string, any> }> = []
    let logTimeout: ReturnType<typeof setTimeout> | null = null
    
    const flushLogs = () => {
      if (logQueue.length === 0) return
      const logs = [...logQueue]
      logQueue = []
      logTimeout = null
      sendDebugLogNow('InteractionProbe', 'interaction_batch', { logs, timestamp: Date.now(), count: logs.length })
    }
    
    const send = (message: string, data: Record<string, any>) => {
      try {
        // Only log important events in development to reduce console spam
        if (process.env.NODE_ENV === 'development' && (message.includes('error') || message.includes('fail') || message === 'interaction_probe_installed')) {
          console.log('InteractionProbe:', message, data)
        }
        
        // Add to queue
        logQueue.push({
          message: `interaction_${message}`,
          data: {
            ...data,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-interaction-debug'
          }
        })
        
        // Flush immediately for important messages, or batch for others
        if (message.includes('error') || message.includes('fail') || message === 'interaction_probe_installed') {
          // Flush immediately for errors and installation
          if (logTimeout) {
            clearTimeout(logTimeout)
            logTimeout = null
          }
          flushLogs()
        } else {
          // Batch other messages - flush after 3 seconds of inactivity or when queue reaches 10 items
          if (logQueue.length >= 10) {
            if (logTimeout) {
              clearTimeout(logTimeout)
              logTimeout = null
            }
            flushLogs()
          } else {
            if (logTimeout) {
              clearTimeout(logTimeout)
            }
            logTimeout = setTimeout(flushLogs, 3000)
          }
        }
      } catch (err) {
        // Silently handle any errors in the send function itself
        if (process.env.NODE_ENV === 'development') {
          console.warn('InteractionProbe: Error in send function:', err)
        }
      }
    }

    const send50 = (message: string, data: Record<string, any>) => {
      try {
        // Send only every 50 events to reduce noise
        if (Math.random() < 0.02) { // ~2% sampling rate
          send(message, { ...data, sampled: true })
        }
      } catch (err) {
        // Silently handle errors in send50
        console.warn('InteractionProbe: Error in send50 function:', err)
      }
    }

    // Component lifecycle tracking
    const trackComponentLifecycle = (componentName: string, action: 'mount' | 'unmount' | 'update', data?: any) => {
      try {
        send('component_lifecycle', {
          componentName,
          action,
          timestamp: Date.now(),
          data: data || {},
          memoryUsage: (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize
          } : null
        })
      } catch (err) {
        // Silently handle errors in lifecycle tracking
        console.warn('InteractionProbe: Error in trackComponentLifecycle:', err)
      }
    }

    // Page visibility tracking (reduced frequency)
    let lastVisibilityLog = 0
    const handleVisibilityChange = () => {
      try {
        const now = Date.now()
        // Only log visibility changes every 5 seconds to reduce spam
        if (now - lastVisibilityLog > 5000) {
          send('page_visibility_change', {
            hidden: document.hidden,
            visibilityState: document.visibilityState,
            timestamp: now
          })
          lastVisibilityLog = now
        }
      } catch (err) {
        // Silently handle errors in visibility handler
        console.warn('InteractionProbe: Error in visibility handler:', err)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Online/offline tracking
    const handleOnlineStatus = (status: 'online' | 'offline') => {
      try {
        send('network_status_change', {
          status,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        })
      } catch (err) {
        // Silently handle errors in network status handler
        console.warn('InteractionProbe: Error in network status handler:', err)
      }
    }

    window.addEventListener('online', () => handleOnlineStatus('online'))
    window.addEventListener('offline', () => handleOnlineStatus('offline'))

    // Expose tracking function globally for other components
    ;(window as any).__trackComponentLifecycle = trackComponentLifecycle

    // Baseline environment snapshot
    try {
      const nav = (performance.getEntriesByType('navigation')?.[0] as any) || null
      const connection = (navigator as any).connection
      send('interaction_probe_installed', {
        probeVersion: 'run39_comprehensive_debug',
        href: window.location.href,
        pathname: window.location.pathname,
        navType: nav?.type || null,
        hasToken: !!localStorage.getItem('token'),
        tokenLength: (localStorage.getItem('token') || '').length,
        swControlled: 'serviceWorker' in navigator ? !!navigator.serviceWorker.controller : false,
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        connectionType: connection?.effectiveType || 'unknown',
        connectionDownlink: connection?.downlink || null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform
      })
    } catch (error) {
      // Try to send error, but don't fail if that also errors
      try {
        send('interaction_probe_installed_error', {
          error: error instanceof Error ? error.message : String(error),
          probeVersion: 'run39_comprehensive_debug',
          href: window.location.href
        })
      } catch (sendError) {
        // Silently handle errors in error reporting
        console.warn('InteractionProbe: Failed to send installation error:', sendError)
      }
    }


    // Disabled Event.prototype patching due to browser compatibility issues
    // This was causing "Illegal invocation" errors with React synthetic events

    if (!window.__interactionProbeV50) window.__interactionProbeV50 = {}
    if (!window.__interactionProbeV50.counts) window.__interactionProbeV50.counts = {}
    if (!window.__interactionProbeV50.lastLogTime) window.__interactionProbeV50.lastLogTime = {}

    const shouldLog50 = (key: string, ev: any, atPoint: any) => {
      try {
        const counts = window.__interactionProbeV50?.counts || {}
        const lastLogTimes = window.__interactionProbeV50?.lastLogTime || {}
        const n = (counts[key] || 0) + 1
        const now = Date.now()
        const timeSinceLastLog = now - (lastLogTimes[key] || 0)

        counts[key] = n
        if (window.__interactionProbeV50) {
          window.__interactionProbeV50.counts = counts
          window.__interactionProbeV50.lastLogTime = lastLogTimes
        }

        const overlayHit =
          !!(describeTarget(ev?.target || null) as any)?.agentOverlay || !!(atPoint as any)?.agentOverlay

        // Log overlays immediately, otherwise limit to every 2 seconds and max 50 per session
        const shouldLog = overlayHit || (timeSinceLastLog > 2000 && n <= 50)
        if (shouldLog) {
          lastLogTimes[key] = now
        }
        return shouldLog
      } catch (err) {
        // If shouldLog50 fails, default to not logging to prevent errors
        console.warn('InteractionProbe: Error in shouldLog50 function:', err)
        return false
      }
    }

    // Install stable handlers once so add/remove is reliable across StrictMode mounts.
    if (!window.__interactionProbeHandlers) window.__interactionProbeHandlers = {}
    if (!window.__interactionProbeHandlers.pointerdown) {
      window.__interactionProbeHandlers.pointerdown = (ev: PointerEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          send('pointerdown', {
            href: window.location.href,
            pathname: window.location.pathname,
            isTrusted: (ev as any).isTrusted ?? null,
            target: tgt,
            atPoint,
            button: (ev as any).button ?? null,
          })
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in pointerdown handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.pointerup) {
      window.__interactionProbeHandlers.pointerup = (ev: PointerEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          // Only log pointerup if it's part of a click sequence (reduced frequency)
          if (shouldLog50('pointerup', ev, atPoint)) {
            send50('pointerup', {
              href: window.location.href,
              pathname: window.location.pathname,
              isTrusted: (ev as any).isTrusted ?? null,
              target: tgt,
              atPoint,
              button: (ev as any).button ?? null,
            })
          }
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in pointerup handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.click) {
      window.__interactionProbeHandlers.click = (ev: MouseEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const href = String((tgt as any).href || '')
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          send('click', {
            href: window.location.href,
            pathname: window.location.pathname,
            isTrusted: (ev as any).isTrusted ?? null,
            target: tgt,
            atPoint,
            isLoginishClick: href.includes('/login') || String((tgt as any).text || '').toLowerCase().includes('login'),
          })
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in click handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.pointerdown_bubble) {
      window.__interactionProbeHandlers.pointerdown_bubble = (ev: PointerEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          // Bubble phase handlers - only log sampled events to reduce noise
          if (shouldLog50('pointerdown_bubble', ev, atPoint)) {
            send50('pointerdown_bubble', {
              href: window.location.href,
              pathname: window.location.pathname,
              isTrusted: (ev as any).isTrusted ?? null,
              target: tgt,
              atPoint,
            })
          }
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in pointerdown_bubble handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.pointerup_bubble) {
      window.__interactionProbeHandlers.pointerup_bubble = (ev: PointerEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          // Bubble phase handlers - only log sampled events to reduce noise
          if (shouldLog50('pointerup_bubble', ev, atPoint)) {
            send50('pointerup_bubble', {
              href: window.location.href,
              pathname: window.location.pathname,
              isTrusted: (ev as any).isTrusted ?? null,
              target: tgt,
              atPoint,
            })
          }
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in pointerup_bubble handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.click_bubble) {
      window.__interactionProbeHandlers.click_bubble = (ev: MouseEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          const x = (ev as any).clientX
          const y = (ev as any).clientY
          const atPoint = atPointInfo(x, y)
          // Bubble phase handlers - only log sampled events to reduce noise
          if (shouldLog50('click_bubble', ev, atPoint)) {
            send50('click_bubble', {
              href: window.location.href,
              pathname: window.location.pathname,
              isTrusted: (ev as any).isTrusted ?? null,
              target: tgt,
              atPoint,
            })
          }
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in click_bubble handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.keydown) {
      window.__interactionProbeHandlers.keydown = (ev: KeyboardEvent) => {
        try {
          // Track keyboard-driven navigation (Enter/Space on focused links/buttons).
          if (ev.key !== 'Enter' && ev.key !== ' ') return
          const tgt = describeTarget(ev.target)
          send('keydown', {
            href: window.location.href,
            pathname: window.location.pathname,
            isTrusted: (ev as any).isTrusted ?? null,
            key: ev.key,
            target: tgt,
          })
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in keydown handler:', err)
        }
      }
    }
    if (!window.__interactionProbeHandlers.submit) {
      window.__interactionProbeHandlers.submit = (ev: SubmitEvent) => {
        try {
          const tgt = describeTarget(ev.target)
          send('submit', {
            href: window.location.href,
            pathname: window.location.pathname,
            isTrusted: (ev as any).isTrusted ?? null,
            target: tgt,
          })
        } catch (err) {
          // Silently handle errors in event handlers to prevent breaking the app
          console.warn('InteractionProbe: Error in submit handler:', err)
        }
      }
    }

    // Use document capture; window capture can be defeated if another window-level listener stops propagation early.
    document.addEventListener('pointerdown', window.__interactionProbeHandlers.pointerdown, true)
    document.addEventListener('pointerup', window.__interactionProbeHandlers.pointerup as any, true)
    document.addEventListener('click', window.__interactionProbeHandlers.click, true)
    document.addEventListener('pointerdown', window.__interactionProbeHandlers.pointerdown_bubble as any, false)
    document.addEventListener('pointerup', window.__interactionProbeHandlers.pointerup_bubble as any, false)
    document.addEventListener('click', window.__interactionProbeHandlers.click_bubble as any, false)
    document.addEventListener('keydown', window.__interactionProbeHandlers.keydown, true)
    document.addEventListener('submit', window.__interactionProbeHandlers.submit, true)


    return () => {
      window.__interactionProbeMounts = Math.max(0, (window.__interactionProbeMounts || 1) - 1)
      // Only remove when no mounts remain (prevents StrictMode cleanup from disabling logging).
      if ((window.__interactionProbeMounts || 0) === 0 && window.__interactionProbeHandlers) {
        if (window.__interactionProbeHandlers.pointerdown) {
          document.removeEventListener('pointerdown', window.__interactionProbeHandlers.pointerdown, true)
        }
        if (window.__interactionProbeHandlers.pointerup) {
          document.removeEventListener('pointerup', window.__interactionProbeHandlers.pointerup as any, true)
        }
        if (window.__interactionProbeHandlers.click) {
          document.removeEventListener('click', window.__interactionProbeHandlers.click, true)
        }
        if (window.__interactionProbeHandlers.pointerdown_bubble) {
          document.removeEventListener('pointerdown', window.__interactionProbeHandlers.pointerdown_bubble as any, false)
        }
        if (window.__interactionProbeHandlers.pointerup_bubble) {
          document.removeEventListener('pointerup', window.__interactionProbeHandlers.pointerup_bubble as any, false)
        }
        if (window.__interactionProbeHandlers.click_bubble) {
          document.removeEventListener('click', window.__interactionProbeHandlers.click_bubble as any, false)
        }
        if (window.__interactionProbeHandlers.keydown) {
          document.removeEventListener('keydown', window.__interactionProbeHandlers.keydown, true)
        }
        if (window.__interactionProbeHandlers.submit) {
          document.removeEventListener('submit', window.__interactionProbeHandlers.submit, true)
        }

        // Event.prototype patching removed due to compatibility issues
      }
      try {
        if ((window.__interactionProbeMounts || 0) === 0 && window.__interactionProbeHandlers?.probeTest) {
          document.removeEventListener('agent_probe_test', window.__interactionProbeHandlers.probeTest as any, true)
        }
      } catch {}
      
      // Cleanup log queue
      if (logTimeout) {
        clearTimeout(logTimeout)
        logTimeout = null
      }
      // Flush any remaining logs
      if (logQueue.length > 0) {
        flushLogs()
      }
    }
  }, [])

  return null
}


