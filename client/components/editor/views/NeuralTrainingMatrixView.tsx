'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Lock,
} from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'

interface NeuralTrainingMatrixViewProps {
  onCancel: () => void
  onComplete: (data: any) => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

interface Counter { key: string; count: number; lastUsedAt?: string }
interface Performer { key: string; performanceScore?: number; sampleSize?: number }

interface RealProfile {
  fonts: Counter[]
  captionStyles: Counter[]
  animations: Counter[]
  motions: Counter[]
  colorGrades: Counter[]
  transitions: Counter[]
  niches: Counter[]
  platforms: Counter[]
  totalPicks: number
}

const EMPTY_PROFILE: RealProfile = {
  fonts: [], captionStyles: [], animations: [], motions: [],
  colorGrades: [], transitions: [], niches: [], platforms: [],
  totalPicks: 0,
}

// Facets we surface in the matrix, with their i18n labels.
const FACETS: { key: keyof RealProfile; labelKey: string }[] = [
  { key: 'fonts', labelKey: 'neuralTraining.facetFonts' },
  { key: 'captionStyles', labelKey: 'neuralTraining.facetCaptionStyles' },
  { key: 'animations', labelKey: 'neuralTraining.facetAnimations' },
  { key: 'motions', labelKey: 'neuralTraining.facetMotions' },
  { key: 'colorGrades', labelKey: 'neuralTraining.facetColorGrades' },
  { key: 'transitions', labelKey: 'neuralTraining.facetTransitions' },
]

// A profile is considered "warmed up" once it has this many real picks.
// Progress is a HONEST ratio of actual picks toward that threshold — it is
// not an animated/simulated bar. Once reached it simply reads 100%.
const WARMUP_TARGET = 25

export const NeuralTrainingMatrixView: React.FC<NeuralTrainingMatrixViewProps> = ({
  onCancel,
  onComplete,
}) => {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<RealProfile>(EMPTY_PROFILE)
  const [performers, setPerformers] = useState<Record<string, Performer[]>>({})
  const [lastIngestedAt, setLastIngestedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Real reads — the same endpoints PerformanceRail / useStyleProfile use.
      const [profRes, insRes] = await Promise.all([
        apiGet<{ data: RealProfile }>('/style-profile').catch(() => null),
        apiGet<{ data: { topPerformers: Record<string, Performer[]>; lastIngestedAt: string | null } }>(
          '/style-profile/insights',
        ).catch(() => null),
      ])
      const prof = (profRes as any)?.data
      if (prof) setProfile({ ...EMPTY_PROFILE, ...prof })
      const ins = (insRes as any)?.data
      if (ins?.topPerformers) setPerformers(ins.topPerformers)
      setLastIngestedAt(ins?.lastIngestedAt ?? null)
      if (!profRes && !insRes) setError('unreachable')
    } catch {
      setError('unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalPicks = profile.totalPicks || 0
  const learnedFacetCount = useMemo(
    () => FACETS.filter((f) => (profile[f.key] as Counter[])?.length > 0).length,
    [profile],
  )
  const progressPct = Math.min(100, Math.round((totalPicks / WARMUP_TARGET) * 100))
  const hasAnyData = totalPicks > 0 || learnedFacetCount > 0

  // Flatten real top performers (sampleSize ≥ 1) for the "what's working" list.
  const flatPerformers = useMemo(() => {
    const out: { facet: string; key: string; score: number; samples: number }[] = []
    for (const f of FACETS) {
      for (const p of performers[f.key] || []) {
        if (!p?.key || !(p.sampleSize && p.sampleSize > 0)) continue
        out.push({ facet: t(f.labelKey), key: p.key, score: p.performanceScore || 0, samples: p.sampleSize })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6)
  }, [performers, t])

  const lastSyncLabel = lastIngestedAt
    ? new Date(lastIngestedAt).toLocaleString()
    : t('neuralTraining.never')

  return (
    <div className="flex h-full gap-10 p-10 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[200px] rounded-full pointer-events-none" />

      {/* Main column — real progress + learned facets */}
      <div className="flex-1 flex flex-col gap-8 relative z-10 overflow-y-auto custom-scrollbar pr-2">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">
              {t('neuralTraining.title')}
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-3 max-w-md">{t('neuralTraining.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {t('neuralTraining.refresh')}
            </button>
            <button
              type="button"
              onClick={() => onComplete({ totalPicks, learnedFacetCount })}
              className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              {t('neuralTraining.done')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className={`${glassStyle} rounded-[2rem] p-8 flex items-center gap-4 text-amber-300`}>
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">{t('neuralTraining.coldStartBody')}</p>
          </div>
        ) : !hasAnyData ? (
          /* Honest cold-start — NO fake progress, NO simulated logs. */
          <div className={`${glassStyle} rounded-[2.5rem] p-12 flex flex-col items-center text-center gap-6`}>
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 text-slate-400">
              <Cpu className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">
              {t('neuralTraining.coldStartTitle')}
            </h3>
            <p className="text-slate-500 text-sm font-medium max-w-lg leading-relaxed">
              {t('neuralTraining.coldStartBody')}
            </p>
          </div>
        ) : (
          <>
            {/* Real progress — derived from actual pick count */}
            <div className={`${glassStyle} rounded-[2rem] p-8`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">
                  {t('neuralTraining.learningProgress')}
                </span>
                <span className="text-xl font-black text-white italic tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8">
                <Stat label={t('neuralTraining.totalPicks')} value={String(totalPicks)} />
                <Stat label={t('neuralTraining.learnedFacets')} value={String(learnedFacetCount)} />
                <Stat label={t('neuralTraining.lastIngested')} value={lastSyncLabel} small />
              </div>
            </div>

            {/* Real learned facets */}
            <div className={`${glassStyle} rounded-[2rem] p-8`}>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic mb-6">
                {t('neuralTraining.learnedFacets')}
              </h4>
              <div className="space-y-4">
                {FACETS.map((f) => {
                  const items = (profile[f.key] as Counter[]) || []
                  const top = items.slice().sort((a, b) => b.count - a.count).slice(0, 3)
                  return (
                    <div key={f.key} className="flex items-center gap-4">
                      <div className="w-32 shrink-0 flex items-center gap-2">
                        {items.length > 0
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          : <div className="w-3.5 h-3.5 rounded-full border border-white/10" />}
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider italic">
                          {t(f.labelKey)}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2">
                        {top.length > 0 ? top.map((c) => (
                          <span key={c.key} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 truncate max-w-[180px]">
                            {c.key} <span className="text-indigo-400">×{c.count}</span>
                          </span>
                        )) : (
                          <span className="text-[10px] text-slate-600 italic">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right sidebar — real top performers + honest import-unavailable notice */}
      <div className="w-[420px] flex flex-col gap-6 relative z-10">
        <div className={`${glassStyle} rounded-[2rem] p-7 flex-1 flex flex-col min-h-0`}>
          <div className="flex items-center gap-3 border-b border-white/10 pb-5 mb-5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest italic">
              {t('neuralTraining.topPerformers')}
            </h4>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {flatPerformers.length > 0 ? flatPerformers.map((p, i) => (
              <div key={`${p.facet}-${p.key}-${i}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="min-w-0">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.facet}</div>
                  <div className="text-[12px] font-bold text-white truncate">{p.key}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-black text-emerald-400 tabular-nums">
                    {p.score >= 0 ? '+' : ''}{(p.score * 100).toFixed(1)}%
                  </div>
                  <div className="text-[8px] text-slate-600 uppercase">{t('neuralTraining.samples', { count: p.samples })}</div>
                </div>
              </div>
            )) : (
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                {t('neuralTraining.noPerformersYet')}
              </p>
            )}
          </div>
        </div>

        {/* Honest "not available yet" — style-file import has no live backend */}
        <div className="rounded-[2rem] p-6 bg-white/[0.02] border border-dashed border-white/10">
          <div className="flex items-center gap-2 text-slate-500 mb-3">
            <Lock className="w-4 h-4" />
            <span className="text-[9px] font-black uppercase tracking-widest italic">
              {t('neuralTraining.importUnavailableTitle')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">{t('neuralTraining.importUnavailableBody')}</p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.4em] transition-colors italic self-center"
        >
          [ {t('common.close') || 'Close'} ]
        </button>
      </div>
    </div>
  )
}

const Stat: React.FC<{ label: string; value: string; small?: boolean }> = ({ label, value, small }) => (
  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
    <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none mb-2">{label}</div>
    <div className={`font-black text-white italic ${small ? 'text-[11px]' : 'text-2xl'} truncate`}>{value}</div>
  </div>
)
