'use client'

import { useEffect } from 'react'

export default function AgentClientPing() {
  useEffect(() => {
    try {
      // Best-effort build/version marker so we can prove which client bundle is actually running.
      const anyWin: any = typeof window !== 'undefined' ? (window as any) : null
      const buildId =
        anyWin && anyWin.__NEXT_DATA__ && typeof anyWin.__NEXT_DATA__.buildId === 'string'
          ? anyWin.__NEXT_DATA__.buildId
          : null
      const marker = 'bm_2026-01-01T00:00:00Z_run27' // stable marker string (not secret)

      // Debug ping disabled
      console.log('Agent ping:', {
        path: typeof window !== 'undefined' ? window.location.pathname : null,
        host: typeof window !== 'undefined' ? window.location.host : null,
        href: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        buildId,
        marker,
      })
    } catch {}
  }, [])

  return null
}


