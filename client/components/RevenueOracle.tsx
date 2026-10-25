'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Activity, ShieldCheck, RefreshCw } from 'lucide-react'
import { apiGet, handleApiError } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { Button } from './ui/button'

interface OracleInsight {
  type: string
  text: string
  score: number | null
  expectedImpact?: string
}

export default function RevenueOracle() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<OracleInsight[]>([])
  const [meta, setMeta] = useState<{ status?: string; niche?: string; analyzedVideos?: number }>({})
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Loaded once, refreshed on demand. Each uncached answer is one AI call from
  // a shared daily quota — the old 15-second poll spent it for everyone. The
  // server caches per user for 6 hours; "refresh" asks it to recompute.
  const fetchInsights = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      // Real, authenticated insights derived from the user's own published-post
      // performance (GET /api/sovereign/insights). No fabricated numbers.
      const res: any = await apiGet(`/sovereign/insights${refresh ? '?refresh=1' : ''}`, undefined, false)
      const payload = res?.data ?? res
      setInsights(Array.isArray(payload?.insights) ? payload.insights : [])
      setMeta({ status: payload?.status, niche: payload?.niche, analyzedVideos: payload?.analyzedVideos })
    } catch (err) {
      setError(handleApiError(err) || t('revenueOracle.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => { fetchInsights(false) }, [fetchInsights])

  if (loading) {
    return (
      <div className="ds-surface-card p-6 flex flex-col items-center justify-center gap-3 min-h-[240px] text-theme-muted">
        <RefreshCw className="animate-spin text-indigo-500" size={24} aria-hidden />
        <p className="ds-text-label">{t('revenueOracle.synchronizing')}</p>
      </div>
    )
  }

  return (
    <div className="ds-surface-card p-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <TrendingUp size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="ds-text-h3 text-theme-primary">{t('revenueOracle.title')}</h2>
            <p className="ds-text-caption text-theme-muted">{t('revenueOracle.subtitle')}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchInsights(true)} disabled={refreshing} leftIcon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden />}>
          {t('common.refresh')}
        </Button>
      </header>

      <dl className="grid grid-cols-2 gap-3">
        <div className="ds-surface-subtle p-4">
          <dt className="ds-text-caption text-theme-muted">{t('revenueOracle.postsAnalyzed')}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-theme-primary">{typeof meta.analyzedVideos === 'number' ? meta.analyzedVideos : '—'}</dd>
        </div>
        <div className="ds-surface-subtle p-4">
          <dt className="ds-text-caption text-theme-muted inline-flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden /> {t('revenueOracle.niche')}</dt>
          <dd className="mt-1 text-base font-semibold text-theme-primary capitalize truncate">{meta.niche || '—'}</dd>
        </div>
      </dl>

      {error && <p className="text-sm text-rose-500" role="alert">{error}</p>}

      <div>
        <h3 className="ds-text-label text-theme-primary mb-2 inline-flex items-center gap-2">
          <Activity className="text-emerald-500" size={16} aria-hidden /> {t('revenueOracle.strategicInsightFeed')}
        </h3>
        {insights.length === 0 ? (
          <p className="ds-surface-subtle p-4 text-sm text-theme-muted">
            {meta.status === 'cold_start' || meta.status === 'manual'
              ? t('revenueOracle.emptyInsightsHint')
              : t('revenueOracle.noInsightsYet')}
          </p>
        ) : (
          <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {insights.map((insight, i) => (
              <li key={i} className="ds-surface-subtle p-4 flex items-start gap-3">
                <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                  {insight.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-theme-primary leading-relaxed">{insight.text}</p>
                  {insight.expectedImpact && (
                    <p className="ds-text-caption text-emerald-600 dark:text-emerald-400 mt-1">{t('revenueOracle.impact', { impact: insight.expectedImpact })}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
