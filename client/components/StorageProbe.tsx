'use client'

import { useEffect } from 'react'
import { sendDebugLog } from '../utils/debugLog'

declare global {
  interface Window {
    __storageProbeInstalled?: boolean
  }
}

export default function StorageProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.__storageProbeInstalled) return
    window.__storageProbeInstalled = true

    const safeStack = () => {
      try {
        const s = String(new Error().stack || '')
        return s.split('\n').slice(0, 6).join('\n')
      } catch {
        return ''
      }
    }

    const send = (message: string, data: Record<string, unknown>) => {
      console.log('StorageProbe:', message, data)
      sendDebugLog('StorageProbe', message, data)
    }

    // Track localStorage changes
    const origLocalSetItem = localStorage.setItem.bind(localStorage)
    const origLocalRemoveItem = localStorage.removeItem.bind(localStorage)
    const origLocalClear = localStorage.clear.bind(localStorage)

    localStorage.setItem = ((key: string, value: string) => {
      send('localStorage_set', {
        key,
        valueLength: value?.length || 0,
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origLocalSetItem(key, value)
    }) as any

    localStorage.removeItem = ((key: string) => {
      send('localStorage_remove', {
        key,
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origLocalRemoveItem(key)
    }) as any

    localStorage.clear = (() => {
      send('localStorage_clear', {
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origLocalClear()
    }) as any

    // Track sessionStorage changes
    const origSessionSetItem = sessionStorage.setItem.bind(sessionStorage)
    const origSessionRemoveItem = sessionStorage.removeItem.bind(sessionStorage)
    const origSessionClear = sessionStorage.clear.bind(sessionStorage)

    sessionStorage.setItem = ((key: string, value: string) => {
      send('sessionStorage_set', {
        key,
        valueLength: value?.length || 0,
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origSessionSetItem(key, value)
    }) as any

    sessionStorage.removeItem = ((key: string) => {
      send('sessionStorage_remove', {
        key,
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origSessionRemoveItem(key)
    }) as any

    sessionStorage.clear = (() => {
      send('sessionStorage_clear', {
        href: window.location.href,
        pathname: window.location.pathname,
        stack: safeStack()
      })
      return origSessionClear()
    }) as any

    // Listen for storage events (changes from other tabs/windows)
    const handleStorage = (event: StorageEvent) => {
      send('storage_event', {
        key: event.key,
        oldValue: event.oldValue ? `${event.oldValue.length} chars` : null,
        newValue: event.newValue ? `${event.newValue.length} chars` : null,
        storageArea: event.storageArea === localStorage ? 'localStorage' : 'sessionStorage',
        href: window.location.href,
        pathname: window.location.pathname
      })
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return null
}
