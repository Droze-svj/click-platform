'use client'

import { trendMeta, compactNumber, type DigestTrend } from '@/lib/featureViewModels'
import { useTranslation } from '@/hooks/useTranslation'

export interface Digest {
  summary: {
    trend: DigestTrend
    changePct: number | null
    totalEngagement: number
    totalReach: number
    avgEngagementRate: number
    postCount: number
  }
  wins: { platform: string; engagement: number }[]
  nextActions: { title: string; detail: string }[]
  hasData: boolean
}

/**
 * Pure presentational weekly-digest card. A container supplies `digest` from
 * featuresApi.getLatestDigest(); this renders the trend, headline numbers, and
 * the first next-best action.
 */
export default function WeeklyDigestCard({ digest }: { digest: Digest | null }) {
  const { t } = useTranslation()
  if (!digest || !digest.hasData) {
    return (
      <div className="rounded-xl bg-surface-card border border-default p-4" data-testid="digest-empty">
        <p className="text-sm text-theme-secondary">{t('creatorTools.weeklyDigest.empty')}</p>
      </div>
    )
  }

  const { summary } = digest
  const trend = trendMeta(summary.trend, summary.changePct)
  const changePct = summary.changePct
  const pct = changePct == null ? null : `${changePct > 0 ? '+' : ''}${changePct}%`
  const trendLabel =
    summary.trend === 'up' ? (pct ? t('creatorTools.weeklyDigest.trendUpBy', { pct }) : t('creatorTools.weeklyDigest.trendUp'))
      : summary.trend === 'down' ? (pct ? t('creatorTools.weeklyDigest.trendDownBy', { pct }) : t('creatorTools.weeklyDigest.trendDown'))
        : summary.trend === 'stable' ? (pct ? t('creatorTools.weeklyDigest.trendFlatBy', { pct }) : t('creatorTools.weeklyDigest.trendFlat'))
          : t('creatorTools.weeklyDigest.trendNew')
  const action = digest.nextActions?.[0]

  return (
    <div className="rounded-xl bg-surface-card border border-default p-4 space-y-3" data-testid="digest-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-theme-muted">{t('creatorTools.weeklyDigest.thisWeek')}</span>
        <span className={`text-xs font-medium ${trend.tone}`} data-testid="digest-trend">
          {trend.arrow} {trendLabel}
        </span>
      </div>

      <div className="flex gap-6">
        <Stat label={t('creatorTools.weeklyDigest.engagement')} value={compactNumber(summary.totalEngagement)} testid="digest-engagement" />
        <Stat label={t('creatorTools.weeklyDigest.reach')} value={compactNumber(summary.totalReach)} />
        <Stat label={t('creatorTools.weeklyDigest.posts')} value={String(summary.postCount)} />
      </div>

      {action && (
        <div className="rounded-lg bg-background border border-default p-2" data-testid="digest-action">
          <p className="text-xs font-medium text-theme-primary">{action.title}</p>
          <p className="text-xs text-theme-muted">{action.detail}</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-theme-primary" data-testid={testid}>{value}</div>
      <div className="text-xs text-theme-muted">{label}</div>
    </div>
  )
}
