'use client'

import { useEffect, useState } from 'react'
import { getStreak, type Streak } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'
import PostingStreakCard from './PostingStreakCard'

/** Fetching container for PostingStreakCard — loads the caller's weekly streak. */
export default function StreakWidget() {
  const { t } = useTranslation()
  const [streak, setStreak] = useState<Streak | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getStreak('week')
      .then((s) => { if (alive) setStreak(s) })
      .catch((e) => { if (alive) setError((e as Error)?.message || t('creatorTools.streak.loadFailed')) })
    return () => { alive = false }
    // Mount-only on purpose: t() changes identity once the locale loads, and
    // that must not refetch. It is only used for the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return <div data-testid="streak-error" className="text-sm text-red-600 dark:text-red-400">{error}</div>
  if (!streak) return <div data-testid="streak-loading" className="text-sm text-theme-muted">{t('creatorTools.streak.loading')}</div>
  return <PostingStreakCard streak={streak} />
}
