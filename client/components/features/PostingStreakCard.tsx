'use client'

import type { Streak } from '@/lib/featuresApi'
import { useTranslation } from '@/hooks/useTranslation'

const STATUS_TONE: Record<Streak['status'], string> = {
  active: 'text-green-600 dark:text-green-400',
  'at-risk': 'text-yellow-400',
  broken: 'text-gray-400',
  new: 'text-blue-600 dark:text-blue-400',
}

/**
 * Pure presentational streak card — takes a Streak (from featuresApi.getStreak)
 * and renders it. No data fetching, so a container can supply/refresh the data.
 */
export default function PostingStreakCard({ streak }: { streak: Streak }) {
  const { t } = useTranslation()
  const statusLabels: Record<Streak['status'], string> = {
    active: t('creatorTools.streak.statusActive'),
    'at-risk': t('creatorTools.streak.statusAtRisk'),
    broken: t('creatorTools.streak.statusBroken'),
    new: t('creatorTools.streak.statusNew'),
  }
  const statusKey: Streak['status'] = streak.status in STATUS_TONE ? streak.status : 'new'
  const status = { label: statusLabels[statusKey], tone: STATUS_TONE[statusKey] }
  const isDay = streak.unit === 'day'
  const one = streak.currentStreak === 1
  const inARow = isDay
    ? (one ? t('creatorTools.streak.dayInARow') : t('creatorTools.streak.daysInARow'))
    : (one ? t('creatorTools.streak.weekInARow') : t('creatorTools.streak.weeksInARow'))

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4" data-testid="streak-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-theme-muted">{t('creatorTools.streak.title')}</span>
        <span className={`text-xs font-medium ${status.tone}`} data-testid="streak-status">
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-theme-primary" data-testid="streak-current">
          {streak.currentStreak}
        </span>
        <span className="text-sm text-theme-secondary">{inARow}</span>
      </div>

      <div className="mt-2 flex gap-4 text-xs text-theme-muted">
        <span>{t('creatorTools.streak.longest')} <span className="text-theme-secondary">{streak.longestStreak}</span></span>
        <span>{isDay ? t('creatorTools.streak.thisDay') : t('creatorTools.streak.thisWeek')} <span className="text-theme-secondary">{streak.thisPeriodCount}</span></span>
      </div>
    </div>
  )
}
