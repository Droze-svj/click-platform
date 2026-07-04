'use client'

import { useEffect, useState } from 'react'
import { getStreak, type Streak } from '@/lib/featuresApi'
import PostingStreakCard from './PostingStreakCard'

/** Fetching container for PostingStreakCard — loads the caller's weekly streak. */
export default function StreakWidget() {
  const [streak, setStreak] = useState<Streak | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getStreak('week')
      .then((s) => { if (alive) setStreak(s) })
      .catch((e) => { if (alive) setError((e as Error)?.message || 'Failed to load streak') })
    return () => { alive = false }
  }, [])

  if (error) return <div data-testid="streak-error" className="text-sm text-red-400">{error}</div>
  if (!streak) return <div data-testid="streak-loading" className="text-sm text-zinc-500">Loading streak…</div>
  return <PostingStreakCard streak={streak} />
}
