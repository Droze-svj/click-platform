'use client'

import React, { useState, useEffect } from 'react'
import { Sparkles, Music, Target, TrendingUp, Layers, Wand2, Loader2, Zap, ArrowRight } from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Creative tools tab.
 *
 * Everything here is real: the niche signals come from
 * GET /marketing-intelligence/trend-report (AI-composed or playbook-based,
 * labelled as such), and the actions run the editor's own tools.
 *
 * It used to also show hardcoded "AI hook" candidates (0–3.2s scored 94/88/81
 * for every video), B-roll "auto-insert" suggestions that only toasted,
 * invented trending sounds ("1.2M videos"), niche templates promising
 * "+31% completion", a "Predict" button that waited 900ms and returned 42/65,
 * and a BPM slider whose "Apply beat cuts" only showed a toast. Those are gone.
 */
interface Trends2026ViewProps {
  /** Real beat cut: detects the audio's beats and re-cuts the video on them. */
  onBeatCut?: () => void | Promise<void>
  onOpenStockLibrary?: () => void
  onOpenEffects?: () => void
}

// Niche ids accepted by the trend-report endpoint (server/services/marketingKnowledge.js).
const NICHES = ['health', 'finance', 'education', 'technology', 'lifestyle', 'entertainment', 'beauty', 'gaming', 'business'] as const

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]'

export default function Trends2026View({ onBeatCut, onOpenStockLibrary, onOpenEffects }: Trends2026ViewProps) {
  const { t } = useTranslation()
  const { state: workflow } = useWorkflow()
  // null = follow the workflow's niche until the user picks one here.
  const [pickedNiche, setPickedNiche] = useState<string | null>(null)
  const niche = pickedNiche || workflow.niche || 'other'
  const platform = workflow.platform || 'tiktok'

  const [liveTrends, setLiveTrends] = useState<any | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState(false)
  const [beatCutting, setBeatCutting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLiveLoading(true)
    setLiveError(false)
    apiGet<{ data: any }>(`/marketing-intelligence/trend-report?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)
      .then((res: any) => { if (!cancelled) setLiveTrends(res?.data || null) })
      .catch(() => { if (!cancelled) { setLiveTrends(null); setLiveError(true) } })
      .finally(() => { if (!cancelled) setLiveLoading(false) })
    return () => { cancelled = true }
  }, [niche, platform])

  const handleBeatCut = async () => {
    if (!onBeatCut || beatCutting) return
    setBeatCutting(true)
    try {
      // handleBeatCut reports its own outcome (cut / no beats found / failed).
      await onBeatCut()
    } finally {
      setBeatCutting(false)
    }
  }

  const hasLiveContent = !!(liveTrends && (liveTrends.hooks?.length || liveTrends.formats?.length))

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-gradient-to-br from-[#0a0a14] via-[#0d0d18] to-[#080812]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center shadow-[0_20px_60px_rgba(217,70,239,0.3)]">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight leading-tight">{t('trends2026View.title')}</h2>
          <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">{t('trends2026View.subtitle')}</p>
        </div>
      </div>

      {/* Niche selector — drives the trend report below */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <Target className="w-4 h-4 text-fuchsia-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">{t('trends2026View.pickNiche')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {NICHES.map(n => (
            <button type="button"
              key={n}
              onClick={() => setPickedNiche(n)}
              aria-pressed={niche === n}
              className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors border ${
                niche === n
                  ? 'bg-fuchsia-600 text-white border-transparent shadow-[0_8px_30px_rgba(217,70,239,0.35)]'
                  : 'bg-white/[0.02] text-slate-300 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              {t(`trends2026View.niches.${n}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Niche signals from the trend report */}
      {hasLiveContent ? (
        <div className="rounded-2xl p-5 border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/[0.04] to-violet-500/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-fuchsia-400" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-300">{t('trends2026View.nicheIdeas')}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                {liveTrends.source === 'ai' ? t('trends2026View.sourceAi') : t('trends2026View.sourcePlaybook')}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">
              {liveTrends.niche?.toUpperCase()} · {liveTrends.platform?.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {liveTrends.hooks?.slice(0, 4).map((h: any) => (
              <div key={h.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-fuchsia-300 mb-1">{t('trends2026View.hookLabel', { framework: h.framework || '—' })}</p>
                <p className="text-[11px] text-white font-bold mb-1 leading-snug">{h.label}</p>
                <p className="text-[9px] text-slate-500 leading-relaxed">{h.example}</p>
              </div>
            ))}
            {liveTrends.formats?.slice(0, 2).map((f: any) => (
              <div key={f.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-300 mb-1">{t('trends2026View.formatLabel')}</p>
                <p className="text-[11px] text-white font-bold mb-1">{f.label}</p>
                <p className="text-[9px] text-slate-500">{[f.length, f.structure].filter(Boolean).join(' · ')}</p>
              </div>
            ))}
          </div>
          {liveTrends.hashtags?.primary?.length ? (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5">
              {[...liveTrends.hashtags.primary, ...(liveTrends.hashtags.niche || [])].slice(0, 8).map((h: string, i: number) => (
                <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-300">{h}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : liveLoading ? (
        <div role="status" aria-live="polite" className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
          <span className="text-[11px] text-slate-400 font-bold">{t('trends2026View.loadingIdeas')}</span>
        </div>
      ) : (
        <div className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02]">
          <span className="text-[11px] text-slate-400">{liveError ? t('trends2026View.ideasFailed') : t('trends2026View.noIdeas')}</span>
        </div>
      )}

      {/* Editing tools — each one runs a real editor feature */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {onBeatCut && (
          <div className={`${glassStyle} rounded-2xl p-5 flex flex-col`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Music className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('trends2026View.beatCutTitle')}</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{t('trends2026View.beatCutHint')}</p>
            <button type="button" onClick={handleBeatCut} disabled={beatCutting} className="mt-auto w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[12px] font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {beatCutting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {beatCutting ? t('trends2026View.beatCutWorking') : t('trends2026View.beatCutAction')}
            </button>
          </div>
        )}

        {onOpenStockLibrary && (
          <div className={`${glassStyle} rounded-2xl p-5 flex flex-col`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                <Layers className="w-4 h-4 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('trends2026View.brollTitle')}</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{t('trends2026View.brollHint')}</p>
            <button type="button" onClick={onOpenStockLibrary} className="mt-auto w-full py-2.5 rounded-xl border border-violet-500/30 hover:bg-violet-500/10 text-violet-300 text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
              {t('trends2026View.brollAction')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {onOpenEffects && (
          <div className={`${glassStyle} rounded-2xl p-5 flex flex-col`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('trends2026View.effectsTitle')}</h3>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{t('trends2026View.effectsHint')}</p>
            <button type="button" onClick={onOpenEffects} className="mt-auto w-full py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
              {t('trends2026View.effectsAction')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
