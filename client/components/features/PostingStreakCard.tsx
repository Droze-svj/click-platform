'use client'

import type { Streak } from '@/lib/featuresApi'

const STATUS: Record<Streak['status'], { label: string; tone: string }> = {
  active: { label: 'On a roll', tone: 'text-green-400' },
  'at-risk': { label: 'Post to keep your streak', tone: 'text-yellow-400' },
  broken: { label: 'Start a new streak', tone: 'text-gray-400' },
  new: { label: 'Post your first this period', tone: 'text-blue-400' },
}

/**
 * Pure presentational streak card — takes a Streak (from featuresApi.getStreak)
 * and renders it. No data fetching, so a container can supply/refresh the data.
 */
export default function PostingStreakCard({ streak }: { streak: Streak }) {
  const period = streak.unit === 'day' ? 'day' : 'week'
  const status = STATUS[streak.status] ?? STATUS.new

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4" data-testid="streak-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Posting streak</span>
        <span className={`text-xs font-medium ${status.tone}`} data-testid="streak-status">
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white" data-testid="streak-current">
          {streak.currentStreak}
        </span>
        <span className="text-sm text-zinc-400">{period}{streak.currentStreak === 1 ? '' : 's'} in a row</span>
      </div>

      <div className="mt-2 flex gap-4 text-xs text-zinc-500">
        <span>Longest: <span className="text-zinc-300">{streak.longestStreak}</span></span>
        <span>This {period}: <span className="text-zinc-300">{streak.thisPeriodCount}</span></span>
      </div>
    </div>
  )
}
