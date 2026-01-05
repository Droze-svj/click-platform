'use client'

import { useEffect } from 'react'

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
    }
  }
}

function isElement(x: any): x is Element {
  return x && typeof x === 'object' && x.nodeType === 1
}

const AGENT_INGEST =
  'http://127.0.0.1:1025/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a'

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

    const send = (message: string, data: Record<string, any>) => {
      // Enhanced debug logging
      // #region agent log
      fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'InteractionProbe.tsx',
          message: `interaction_${message}`,
          data: {
            ...data,
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run-interaction-debug'
          }
        }),
      }).catch(() => {})
      // #endregion
    }

    const send50 = (message: string, data: Record<string, any>) => {
      // Send only every 50 events to reduce noise
      if (Math.random() < 0.02) { // ~2% sampling rate
        send(message, { ...data, sampled: true })
      }
    }

    // Component lifecycle tracking
    const trackComponentLifecycle = (componentName: string, action: 'mount' | 'unmount' | 'update', data?: any) => {
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
    }

    // Page visibility tracking
    const handleVisibilityChange = () => {
      send('page_visibility_change', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        timestamp: Date.now()
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Online/offline tracking
    const handleOnlineStatus = (status: 'online' | 'offline') => {
      send('network_status_change', {
        status,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
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
      send('interaction_probe_installed_error', {
        error: error instanceof Error ? error.message : String(error),
        probeVersion: 'run39_comprehensive_debug',
        href: window.location.href
      })
    }


    // If clicks are being swallowed, this will tell us who is calling stopPropagation().
    // Install once, remove only when no mounts remain.
    if (!window.__interactionProbeState) window.__interactionProbeState = {}
    if (!window.__interactionProbeState.installed) {
      try {
        const proto: any = (window as any).Event?.prototype
        if (proto) {
          window.__interactionProbeState.origStopPropagation = proto.stopPropagation?.bind(proto) || null
          window.__interactionProbeState.origStopImmediatePropagation = proto.stopImmediatePropagation?.bind(proto) || null

          const safeStack = () => {
            try {
              return String(new Error().stack || '').split('\n').slice(0, 8).join('\n')
            } catch {
              return ''
            }
          }

          proto.stopPropagation = function () {
            try {
              const ev: any = this
              const t = ev?.target || null
              send('event_stopPropagation', {
                type: String(ev?.type || ''),
                target: describeTarget(t),
                href: window.location.href,
                pathname: window.location.pathname,
                stack: safeStack(),
              })
            } catch {}
            // Call the original method to maintain functionality
            if (window.__interactionProbeState?.origStopPropagation) {
              window.__interactionProbeState.origStopPropagation.call(this)
            }
          }

          proto.stopImmediatePropagation = function () {
            try {
              const ev: any = this
              const t = ev?.target || null
              send('event_stopImmediatePropagation', {
                type: String(ev?.type || ''),
                target: describeTarget(t),
                href: window.location.href,
                pathname: window.location.pathname,
                stack: safeStack(),
              })
            } catch {}
            // Call the original method to maintain functionality
            if (window.__interactionProbeState?.origStopImmediatePropagation) {
              window.__interactionProbeState.origStopImmediatePropagation.call(this)
            }
          }
        }
      } catch {}
      window.__interactionProbeState.installed = true
    }

    if (!window.__interactionProbeV50) window.__interactionProbeV50 = {}
    if (!window.__interactionProbeV50.counts) window.__interactionProbeV50.counts = {}

    const shouldLog50 = (key: string, ev: any, atPoint: any) => {
      const counts = window.__interactionProbeV50?.counts || {}
      const n = (counts[key] || 0) + 1
      counts[key] = n
      if (window.__interactionProbeV50) window.__interactionProbeV50.counts = counts
      const overlayHit =
        !!(describeTarget(ev?.target || null) as any)?.agentOverlay || !!(atPoint as any)?.agentOverlay
      return overlayHit || n <= 25
    }

    // Install stable handlers once so add/remove is reliable across StrictMode mounts.
    if (!window.__interactionProbeHandlers) window.__interactionProbeHandlers = {}
    if (!window.__interactionProbeHandlers.pointerdown) {
      window.__interactionProbeHandlers.pointerdown = (ev: PointerEvent) => {
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

      }
    }
    if (!window.__interactionProbeHandlers.pointerup) {
      window.__interactionProbeHandlers.pointerup = (ev: PointerEvent) => {
        const tgt = describeTarget(ev.target)
        const x = (ev as any).clientX
        const y = (ev as any).clientY
        const atPoint = atPointInfo(x, y)
      }
    }
    if (!window.__interactionProbeHandlers.click) {
      window.__interactionProbeHandlers.click = (ev: MouseEvent) => {
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

      }
    }
    if (!window.__interactionProbeHandlers.pointerdown_bubble) {
      window.__interactionProbeHandlers.pointerdown_bubble = (ev: PointerEvent) => {
        const tgt = describeTarget(ev.target)
        const x = (ev as any).clientX
        const y = (ev as any).clientY
        const atPoint = atPointInfo(x, y)
      }
    }
    if (!window.__interactionProbeHandlers.pointerup_bubble) {
      window.__interactionProbeHandlers.pointerup_bubble = (ev: PointerEvent) => {
        const tgt = describeTarget(ev.target)
        const x = (ev as any).clientX
        const y = (ev as any).clientY
        const atPoint = atPointInfo(x, y)
      }
    }
    if (!window.__interactionProbeHandlers.click_bubble) {
      window.__interactionProbeHandlers.click_bubble = (ev: MouseEvent) => {
        const tgt = describeTarget(ev.target)
        const x = (ev as any).clientX
        const y = (ev as any).clientY
        const atPoint = atPointInfo(x, y)
      }
    }
    if (!window.__interactionProbeHandlers.keydown) {
      window.__interactionProbeHandlers.keydown = (ev: KeyboardEvent) => {
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
      }
    }
    if (!window.__interactionProbeHandlers.submit) {
      window.__interactionProbeHandlers.submit = (ev: SubmitEvent) => {
        const tgt = describeTarget(ev.target)
        send('submit', {
          href: window.location.href,
          pathname: window.location.pathname,
          isTrusted: (ev as any).isTrusted ?? null,
          target: tgt,
        })
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

        // Restore Event.prototype patches
        try {
          const proto: any = (window as any).Event?.prototype
          if (proto && window.__interactionProbeState?.installed) {
            if (window.__interactionProbeState.origStopPropagation) {
              proto.stopPropagation = window.__interactionProbeState.origStopPropagation
            }
            if (window.__interactionProbeState.origStopImmediatePropagation) {
              proto.stopImmediatePropagation = window.__interactionProbeState.origStopImmediatePropagation
            }
            window.__interactionProbeState.installed = false
          }
        } catch {}
      }
      try {
        if ((window.__interactionProbeMounts || 0) === 0 && window.__interactionProbeHandlers?.probeTest) {
          document.removeEventListener('agent_probe_test', window.__interactionProbeHandlers.probeTest as any, true)
        }
      } catch {}
    }
  }, [])

  return null
}


