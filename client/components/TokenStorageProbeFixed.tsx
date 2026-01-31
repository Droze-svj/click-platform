'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __tokenStorageProbeInstalled?: boolean
  }
}

export default function TokenStorageProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__tokenStorageProbeInstalled) return
    window.__tokenStorageProbeInstalled = true

    const safeStack = () => {
      try {
        const s = String(new Error().stack || '')
        // avoid giant payloads
        return s.split('\n').slice(0, 8).join('\n')
      } catch {
        return ''
      }
    }

    const send = (message: string, data: Record<string, any>) => {
      console.log('TokenStorageProbe:', message, data)
      // Send to debug endpoint if available
      fetch(`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010'}/api/debug/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: 'TokenStorageProbe',
          message,
          data: { ...data, timestamp: Date.now() }
        }),
      }).catch(() => {}) // Ignore errors in debug logging
    }

    const origSetItem = localStorage.setItem.bind(localStorage)
    const origRemoveItem = localStorage.removeItem.bind(localStorage)
    const origClear = localStorage.clear.bind(localStorage)

    localStorage.setItem = ((key: string, value: string) => {
      if (key === 'token') {
        send('token_storage_set', {
          key,
          valueLength: value?.length || 0,
          href: window.location.href,
          pathname: window.location.pathname,
          stack: safeStack(),
          timestamp: Date.now()
        })
      }
      return origSetItem(key, value)
    }) as any

    localStorage.removeItem = ((key: string) => {
      if (key === 'token') {
        send('token_storage_remove', {
          key,
          href: window.location.href,
          pathname: window.location.pathname,
          stack: safeStack(),
          timestamp: Date.now()
        })
      }
      return origRemoveItem(key)
    }) as any

    localStorage.clear = (() => {
      return origClear()
    }) as any
  }, [])

  return null
}

