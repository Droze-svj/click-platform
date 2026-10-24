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
    <div className="neural-glass-card rounded-[3rem] p-6 sm:p-10 lg:p-14 relative overflow-hidden group border-indigo-500/20 shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)]">
      <div className="absolute top-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/[0.05] rounded-full blur-[120px] pointer-events-none" aria-hidden="true" />

      <div className="space-y-6 sm:space-y-8 max-w-3xl relative z-10">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-center sm:text-left">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-glow-primary flex-shrink-0">
            <Brain size={36} aria-hidden="true" />
          </div>
          <div className="flex flex-col items-center sm:items-start">
            <span className="px-3 py-1 mb-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em]">{t('intelligenceEngine.neuralEngineVersion')}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tighter uppercase italic leading-none">{t('intelligenceEngine.neuralCommandCenter')}</h2>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {insight ? (
            <m.div
              key="insight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="relative p-6 sm:p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 shadow-inner">
                <Quote className="absolute -top-3 -left-3 text-indigo-500 opacity-40" size={32} aria-hidden="true" />
                <p className="text-lg sm:text-xl font-black text-white italic tracking-tight leading-snug">
                  {insight.quote}
                </p>
              </div>

              {insight.tip && (
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Lightbulb size={20} aria-hidden="true" />
                  </div>
                  <p className="text-sm sm:text-base text-indigo-200 font-medium leading-relaxed">
                    <span className="text-indigo-400 font-black uppercase text-[10px] tracking-widest block mb-1">{t('intelligenceEngine.strategicCalibration')}</span>
                    {insight.tip}
                  </p>
                </div>
              )}
            </m.div>
          ) : failed ? (
            <p key="failed" role="alert" className="flex items-center gap-3 text-base sm:text-lg text-rose-300 font-medium leading-relaxed">
              <AlertCircle size={20} className="shrink-0" aria-hidden="true" /> {t('intelligenceEngine.loadFailed')}
            </p>
          ) : (
            <p key="empty" className="text-base sm:text-lg text-[var(--text-dim)] font-medium leading-relaxed italic">
              {loading ? t('intelligenceEngine.loading') : t('intelligenceEngine.noInsightYet')}
            </p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default IntelligenceEngine
