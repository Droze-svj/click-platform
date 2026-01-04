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

  // App Router signals route changes via these hooks (forces rerender).
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const marker = useMemo(() => 'run39-dev-banner', [])

  // Prevent hydration mismatches by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const send = (message: string, data: Record<string, any>) => {
    // Debug send disabled
    console.log('Debug banner:', message, data)
  }

  useEffect(() => {
    try {
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      if (!isLocal) return

      // Keep a stable, stateful href so the banner always reflects the current route,
      // even if some browsers don't repaint the component when window.location changes.
      try {
        setHref(window.location.href)
      } catch {}

      const url = `/api/debug/ping?nonce=${encodeURIComponent(marker)}&ts=${Date.now()}`
      fetch(url)
        .then(async (r) => {
          const j = await r.json().catch(() => null)
          setPingStatus(r.ok ? 'ok' : 'fail')
          setPingTs(j?.ts || Date.now())
          send('dev_banner_ping', { marker, ok: r.ok, href: window.location.href, pathname: window.location.pathname })
        })
        .catch(() => setPingStatus('fail'))
    } catch {
      setPingStatus('fail')
    }
  }, [marker])


  // Only show in local dev contexts.
  const shouldShow =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')


  if (!shouldShow || !mounted) return null

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
          })
        } catch {}
      }}
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 99999,
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#fff',
        padding: '8px 10px',
        borderRadius: 8,
        fontSize: 12,
        maxWidth: 520,
        boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ fontWeight: 700 }}>
        DEBUG ACTIVE • {marker}
        {/* Add client-only indicator to prevent hydration mismatch */}
        {typeof window !== 'undefined' && <span style={{ opacity: 0.7 }}> (client)</span>}
      </div>
      <div style={{ opacity: 0.9, marginTop: 4 }}>
        URL:{' '}
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {href || (typeof window !== 'undefined' ? window.location.href : '')}
        </span>
      </div>
      <div style={{ opacity: 0.9, marginTop: 4 }}>
        /api/debug/ping: <b>{pingStatus}</b>
        {pingTs ? <span> (ts {pingTs})</span> : null}
      </div>
      <div style={{ opacity: 0.9, marginTop: 6 }}>
        <button
          type="button"
          onClick={(ev) => {
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
              })
            } catch {}
          }}
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Log snapshot (click me)
        </button>
        <span style={{ marginLeft: 8, opacity: 0.8 }}>clicks: {userClickCount}</span>
      </div>
      <div style={{ opacity: 0.8, marginTop: 4 }}>
        If you don’t see this banner, you’re not running the instrumented localhost build.
      </div>
    </div>
  )
}


