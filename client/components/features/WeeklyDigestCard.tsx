'use client'

import { trendMeta, compactNumber, type DigestTrend } from '@/lib/featureViewModels'

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
  if (!digest || !digest.hasData) {
    return (
      <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4" data-testid="digest-empty">
        <p className="text-sm text-zinc-400">No digest yet — post this week to build one.</p>
      </div>
    )
  }

  const { summary } = digest
  const t = trendMeta(summary.trend, summary.changePct)
  const action = digest.nextActions?.[0]

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3" data-testid="digest-card">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">This week</span>
        <span className={`text-xs font-medium ${t.tone}`} data-testid="digest-trend">
          {t.arrow} {t.label}
        </span>
      </div>

      <div className="flex gap-6">
        <Stat label="Engagement" value={compactNumber(summary.totalEngagement)} testid="digest-engagement" />
        <Stat label="Reach" value={compactNumber(summary.totalReach)} />
        <Stat label="Posts" value={String(summary.postCount)} />
      </div>

      {action && (
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2" data-testid="digest-action">
          <p className="text-xs font-medium text-zinc-200">{action.title}</p>
          <p className="text-xs text-zinc-500">{action.detail}</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-white" data-testid={testid}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}
