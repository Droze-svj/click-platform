'use client'

import type { Streak } from '@/lib/featuresApi'

const STATUS: Record<Streak['status'], { label: string; tone: string }> = {
  active: { label: 'On a roll', tone: 'text-green-600 dark:text-green-400' },
  'at-risk': { label: 'Post to keep your streak', tone: 'text-yellow-400' },
  broken: { label: 'Start a new streak', tone: 'text-gray-400' },
  new: { label: 'Post your first this period', tone: 'text-blue-600 dark:text-blue-400' },
}

/**
 * Pure presentational streak card — takes a Streak (from featuresApi.getStreak)
 * and renders it. No data fetching, so a container can supply/refresh the data.
 */
export default function PostingStreakCard({ streak }: { streak: Streak }) {
  const period = streak.unit === 'day' ? 'day' : 'week'
  const status = STATUS[streak.status] ?? STATUS.new

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4" data-testid="streak-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-theme-muted">Posting streak</span>
        <span className={`text-xs font-medium ${status.tone}`} data-testid="streak-status">
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-theme-primary" data-testid="streak-current">
          {streak.currentStreak}
        </span>
        <span className="text-sm text-theme-secondary">{period}{streak.currentStreak === 1 ? '' : 's'} in a row</span>
      </div>

      <div className="mt-2 flex gap-4 text-xs text-theme-muted">
        <span>Longest: <span className="text-theme-secondary">{streak.longestStreak}</span></span>
        <span>This {period}: <span className="text-theme-secondary">{streak.thisPeriodCount}</span></span>
      </div>
    </div>
  )
}
