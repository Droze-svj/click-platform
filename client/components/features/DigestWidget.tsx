'use client'

import { useEffect, useState } from 'react'
import { getLatestDigest } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'
import WeeklyDigestCard, { type Digest } from './WeeklyDigestCard'

/** Fetching container for WeeklyDigestCard — loads the caller's latest digest. */
export default function DigestWidget() {
  const { t } = useTranslation()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getLatestDigest()
      .then((res) => { if (alive) { setDigest((res?.digest ?? null) as Digest | null); setLoaded(true) } })
      .catch((e) => { if (alive) setError((e as Error)?.message || t('creatorTools.weeklyDigest.loadFailed')) })
    return () => { alive = false }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <div data-testid="digest-error" className="text-sm text-red-600 dark:text-red-400">{error}</div>
  if (!loaded) return <div data-testid="digest-loading" className="text-sm text-theme-muted">{t('creatorTools.weeklyDigest.loading')}</div>
  return <WeeklyDigestCard digest={digest} />
}
