'use client'

import { useEffect, useState } from 'react'
import { getLatestDigest } from '@/lib/featuresApi'
import WeeklyDigestCard, { type Digest } from './WeeklyDigestCard'

/** Fetching container for WeeklyDigestCard — loads the caller's latest digest. */
export default function DigestWidget() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getLatestDigest()
      .then((res) => { if (alive) { setDigest((res?.digest ?? null) as Digest | null); setLoaded(true) } })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Failed to load digest') })
    return () => { alive = false }
  }, [])

  if (error) return <div data-testid="digest-error" className="text-sm text-red-400">{error}</div>
  if (!loaded) return <div data-testid="digest-loading" className="text-sm text-zinc-500">Loading digest…</div>
  return <WeeklyDigestCard digest={digest} />
}
