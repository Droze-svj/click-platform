'use client'

import React, { useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Brain, Quote, Lightbulb, AlertCircle } from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * AI insight card. Shows the insight GET /api/analytics/overview returns
 * (only present once the account has real analytics). There is no live
 * "engine" telemetry to show, so none is shown.
 */
const IntelligenceEngine = () => {
  const { t } = useTranslation()
  const [insight, setInsight] = useState<{ quote: string, tip: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const res = await apiGet<any>('/analytics/overview')
        if (!cancelled && res?.aiInsight) setInsight(res.aiInsight)
      } catch (err) {
        console.error('Failed to fetch intelligence:', err)
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="ds-surface-card p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
          <Brain size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 className="ds-text-h3 text-theme-primary">{t('intelligenceEngine.neuralCommandCenter')}</h2>
          <p className="ds-text-caption text-theme-muted">{t('intelligenceEngine.neuralEngineVersion')}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {insight ? (
          <m.div
            key="insight"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-3"
          >
            <div className="ds-surface-subtle relative p-4 pl-10">
              <Quote className="absolute left-3 top-4 text-indigo-500 opacity-60" size={18} aria-hidden="true" />
              <p className="text-base font-medium text-theme-primary leading-snug">{insight.quote}</p>
            </div>
            {insight.tip && (
              <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <Lightbulb size={18} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                <p className="text-sm text-theme-secondary leading-relaxed">
                  <span className="block ds-text-label text-indigo-500 mb-0.5">{t('intelligenceEngine.strategicCalibration')}</span>
                  {insight.tip}
                </p>
              </div>
            )}
          </m.div>
        ) : failed ? (
          <p key="failed" role="alert" className="flex items-center gap-2 text-sm text-rose-500">
            <AlertCircle size={16} className="shrink-0" aria-hidden="true" /> {t('intelligenceEngine.loadFailed')}
          </p>
        ) : (
          <p key="empty" className="ds-surface-subtle p-4 text-sm text-theme-muted">
            {loading ? t('intelligenceEngine.loading') : t('intelligenceEngine.noInsightYet')}
          </p>
        )}
      </AnimatePresence>
    </div>
  )
}

export default IntelligenceEngine
