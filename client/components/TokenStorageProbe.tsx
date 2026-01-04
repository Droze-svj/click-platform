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


    const origSetItem = localStorage.setItem.bind(localStorage)
    const origRemoveItem = localStorage.removeItem.bind(localStorage)
    const origClear = localStorage.clear.bind(localStorage)

    localStorage.setItem = ((key: string, value: string) => {
      if (key === 'token') {
      }
      return origSetItem(key, value)
    }) as any

    localStorage.removeItem = ((key: string) => {
      if (key === 'token') {
      }
      return origRemoveItem(key)
    }) as any

    localStorage.clear = (() => {
      return origClear()
    }) as any
  }, [])

  return null
}


