'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Zap,
  ChevronRight,
  Database,
  Cpu,
  Sparkles,
  Target,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { StyleProfile } from '../../../types/editor'
import { apiGet } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'

interface StyleVaultDashboardViewProps {
  onTrainNew: () => void
  onSelectProfile: (profile: StyleProfile) => void
  profiles: StyleProfile[]
  onApplyProfile: (profile: StyleProfile) => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)]"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } }
}

interface Counter { key: string; count: number }
interface Performer { key: string; performanceScore?: number; sampleSize?: number }

const REAL_FACETS: { key: string; labelKey: string }[] = [
  { key: 'fonts', labelKey: 'neuralTraining.facetFonts' },
  { key: 'captionStyles', labelKey: 'neuralTraining.facetCaptionStyles' },
  { key: 'animations', labelKey: 'neuralTraining.facetAnimations' },
  { key: 'motions', labelKey: 'neuralTraining.facetMotions' },
  { key: 'colorGrades', labelKey: 'neuralTraining.facetColorGrades' },
  { key: 'transitions', labelKey: 'neuralTraining.facetTransitions' },
]

export const StyleVaultDashboardView: React.FC<StyleVaultDashboardViewProps> = ({
  onTrainNew,
  onSelectProfile,
  profiles = [],
  onApplyProfile
}) => {
  const { t } = useTranslation()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // ── Real learned style profile (no fabricated stats) ──
  const [real, setReal] = useState<Record<string, Counter[]> & { totalPicks: number }>({ totalPicks: 0 } as any)
  const [performers, setPerformers] = useState<Record<string, Performer[]>>({})
  const [lastIngestedAt, setLastIngestedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiGet<{ data: any }>('/style-profile').catch(() => null),
      apiGet<{ data: { topPerformers: Record<string, Performer[]>; lastIngestedAt: string | null } }>('/style-profile/insights').catch(() => null),
    ]).then(([profRes, insRes]) => {
      if (cancelled) return
      const prof = (profRes as any)?.data
      if (prof) setReal(prof)
      const ins = (insRes as any)?.data
      if (ins?.topPerformers) setPerformers(ins.topPerformers)
      setLastIngestedAt(ins?.lastIngestedAt ?? null)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const totalPicks = real.totalPicks || 0
  const learnedFacets = useMemo(
    () => REAL_FACETS.filter((f) => ((real as any)[f.key] as Counter[])?.length > 0).length,
    [real],
  )
  const hasProfile = totalPicks > 0 || learnedFacets > 0

  const flatPerformers = useMemo(() => {
    const out: { facet: string; key: string; score: number; samples: number }[] = []
    for (const f of REAL_FACETS) {
      for (const p of performers[f.key] || []) {
        if (!p?.key || !(p.sampleSize && p.sampleSize > 0)) continue
        out.push({ facet: t(f.labelKey), key: p.key, score: p.performanceScore || 0, samples: p.sampleSize })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 5)
  }, [performers, t])

  const lastSyncLabel = lastIngestedAt ? new Date(lastIngestedAt).toLocaleDateString() : t('styleVault.never')

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20 relative px-4 xl:px-8 pt-8 overflow-hidden">
      {/* Ambient backdrop */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center opacity-40">
        <svg width="100%" height="100%" className="absolute inset-0">
          <pattern id="neural-mesh" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(99, 102, 241, 0.2)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(99, 102, 241, 0.05)" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#neural-mesh)" />
        </svg>
      </div>
      <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-blue-600/10 blur-[180px] rounded-full opacity-60 pointer-events-none" />

      {/* Header — real stats only */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/10 pb-12 relative z-10"
      >
        <div className="space-y-8">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em]">
            <Database className="w-4 h-4" />
            {t('styleVault.title')}
          </div>
          <h2 className="text-[5rem] md:text-[7rem] font-black tracking-tighter italic leading-[0.85] bg-gradient-to-br from-white via-indigo-200 to-blue-500 bg-clip-text text-transparent uppercase py-2">
            STYLE<br />ARCHIVE
          </h2>
          <p className="text-slate-500 font-medium max-w-xl text-base italic uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-lg inline-block">
            {t('styleVault.subtitle')}
          </p>
        </div>

        {/* Real profile summary */}
        <div className={`${glassStyle} px-8 py-6 rounded-[2.5rem] flex items-center gap-8`}>
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          ) : (
            <>
              <RealStat label={t('styleVault.totalPicks')} value={String(totalPicks)} />
              <div className="w-px h-10 bg-white/10" />
              <RealStat label={t('styleVault.learnedFacets')} value={String(learnedFacets)} />
              <div className="w-px h-10 bg-white/10" />
              <RealStat label={t('styleVault.lastIngested')} value={lastSyncLabel} small />
            </>
          )}
        </div>
      </motion.div>

      {/* Real learned profile panel */}
      {!loading && (
        hasProfile ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 relative z-10">
            {/* Learned facets */}
            <div className={`${glassStyle} rounded-[2.5rem] p-8`}>
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] italic">{t('styleVault.learnedFacets')}</h3>
              </div>
              <div className="space-y-4">
                {REAL_FACETS.map((f) => {
                  const items = (((real as any)[f.key] as Counter[]) || []).slice().sort((a, b) => b.count - a.count)
                  const top = items[0]
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider italic w-32 shrink-0">{t(f.labelKey)}</span>
                      {top ? (
                        <span className="flex-1 text-right text-[12px] text-white font-bold truncate">
                          {top.key} <span className="text-indigo-400 text-[10px]">{t('styleVault.uses', { count: top.count })}</span>
                        </span>
                      ) : (
                        <span className="flex-1 text-right text-[11px] text-slate-600 italic">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* What's working — real performers */}
            <div className={`${glassStyle} rounded-[2.5rem] p-8`}>
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] italic">{t('styleVault.topPerformersTitle')}</h3>
              </div>
              {flatPerformers.length > 0 ? (
                <div className="space-y-3">
                  {flatPerformers.map((p, i) => (
                    <div key={`${p.facet}-${p.key}-${i}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="min-w-0">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{p.facet}</div>
                        <div className="text-[12px] font-bold text-white truncate">{p.key}</div>
                      </div>
                      <div className="text-[12px] font-black text-emerald-400 tabular-nums shrink-0">
                        {p.score >= 0 ? '+' : ''}{(p.score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic leading-relaxed">{t('styleVault.topPerformersEmpty')}</p>
              )}
            </div>
          </div>
        ) : (
          /* Honest empty state — nothing learned yet */
          <div className={`${glassStyle} rounded-[3rem] p-14 flex flex-col items-center text-center gap-6 relative z-10`}>
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 text-slate-400">
              <Cpu className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{t('styleVault.emptyTitle')}</h3>
            <p className="text-slate-500 text-sm font-medium max-w-lg leading-relaxed">{t('styleVault.emptyBody')}</p>
            <button
              type="button"
              onClick={onTrainNew}
              className="mt-2 px-6 py-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              {t('styleVault.startTraining')}
            </button>
          </div>
        )
      )}

      {/* Saved (user-created) profiles — empty until the user actually saves one */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 relative z-10"
      >
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -8 }}
          whileTap={{ scale: 0.98 }}
          onClick={onTrainNew}
          className={`${glassStyle} p-12 rounded-[4rem] border-white/5 border-dashed border-2 flex flex-col items-center justify-center gap-10 group hover:border-indigo-500/40 transition-all min-h-[420px] relative overflow-hidden`}
        >
          <div className="w-28 h-28 rounded-[3rem] bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-all duration-700">
            <Plus className="w-12 h-12" />
          </div>
          <div className="text-center space-y-4 relative z-10">
            <h3 className="text-3xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">{t('styleVault.startTraining')}</h3>
          </div>
        </motion.button>

        {profiles.map((profile, i) => (
          <motion.div
            key={profile.id}
            variants={itemVariants}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            whileHover={{ y: -12, scale: 1.01 }}
            onClick={() => onSelectProfile(profile)}
            className={`${glassStyle} p-10 rounded-[4rem] border-white/5 overflow-hidden group cursor-pointer flex flex-col justify-between min-h-[420px] relative`}
          >
            <div className="relative z-10 space-y-10">
              <div className="flex items-start justify-between">
                <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center border border-white/10 ${i % 2 === 0 ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>
                  <Cpu className="w-10 h-10" />
                </div>
                <span className="text-white font-black text-lg italic tracking-tighter">{new Date(profile.lastTrained).toLocaleDateString()}</span>
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-[var(--text-main)] italic tracking-tighter uppercase whitespace-nowrap">{profile.name}</h3>
                {profile.description && (
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 italic font-medium">{profile.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3 h-3 text-indigo-400" />
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Pacing</span>
                  </div>
                  <span className="text-xl font-black text-white italic">{profile.pacing.medianClipLength}s</span>
                </div>
                <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Design</span>
                  </div>
                  <span className="text-xl font-black text-white italic truncate">{profile.assets.fontFamily}</span>
                </div>
              </div>
            </div>
            <div className="relative z-10 pt-8 flex items-center justify-between border-t border-white/10">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onApplyProfile(profile) }}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 hover:bg-white hover:text-black transition-all"
              >
                <Zap className={`w-5 h-5 ${i % 2 === 0 ? 'text-blue-400' : 'text-purple-400'}`} />
                <span className="text-[11px] font-black uppercase tracking-widest italic">Deploy</span>
              </button>
              <ChevronRight className="w-8 h-8 text-slate-700 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

const RealStat: React.FC<{ label: string; value: string; small?: boolean }> = ({ label, value, small }) => (
  <div>
    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">{label}</div>
    <div className={`font-black text-white italic tracking-tight ${small ? 'text-sm' : 'text-3xl'}`}>{value}</div>
  </div>
)
