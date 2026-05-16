'use client'

/**
 * /dashboard/click-learning — the read-only "what has Click learned about me"
 * page. Reads two endpoints:
 *   - GET /api/style-profile             — the raw taste-graph facet counts
 *   - GET /api/video/clips/style-insight — the resolved top picks per facet
 *
 * The page makes the "Click grows with users" promise visible: the user
 * sees concrete picks Click has recorded from their published work, plus
 * the resolved top-of-mind preset/hook/caption-style/etc. As they publish
 * more, the numbers climb, so the page itself becomes a progress bar for
 * Click's understanding of them.
 *
 * This is intentionally read-only. Editing the profile happens implicitly
 * by publishing clips (the learning loop in styleLearningService).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Sparkles,
  ArrowLeft,
  TrendingUp,
  Brain,
  Layers,
  Clock,
  Hash,
  Music,
  Type,
  Palette,
} from 'lucide-react'
import { apiGet } from '@/lib/api'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import ClickEmptyState from '@/components/click/ClickEmptyState'
import { clickVoice } from '@/lib/clickVoice'

interface Counter {
  key: string
  count: number
  lastUsedAt?: string
}

interface StyleProfile {
  fonts?: Counter[]
  captionStyles?: Counter[]
  animations?: Counter[]
  presets?: Counter[]
  hookStyles?: Counter[]
  transitions?: Counter[]
  colorGrades?: Counter[]
  musicGenres?: Counter[]
  platforms?: Counter[]
  niches?: Counter[]
  publishHours?: Counter[]
  publishDays?: Counter[]
  averages?: { avgCaptionLength?: number | null }
}

interface StyleInsight {
  source?: string
  totalPicks?: number
  topPicks?: Record<string, string | null>
}

const FACET_META: Record<
  string,
  { label: string; icon: React.ReactNode; intent: string }
> = {
  presets: { label: 'Preset', icon: <Sparkles className="w-4 h-4" />, intent: 'preset' },
  hookStyles: { label: 'Hook', icon: <TrendingUp className="w-4 h-4" />, intent: 'hook' },
  captionStyles: { label: 'Caption Style', icon: <Type className="w-4 h-4" />, intent: 'caption' },
  transitions: { label: 'Transition', icon: <Layers className="w-4 h-4" />, intent: 'transition' },
  colorGrades: { label: 'Color Grade', icon: <Palette className="w-4 h-4" />, intent: 'colorgrade' },
  musicGenres: { label: 'Music', icon: <Music className="w-4 h-4" />, intent: 'music' },
  platforms: { label: 'Platform', icon: <Hash className="w-4 h-4" />, intent: 'platform' },
  niches: { label: 'Niche', icon: <Brain className="w-4 h-4" />, intent: 'niche' },
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function totalCount(counters?: Counter[]): number {
  if (!Array.isArray(counters)) return 0
  return counters.reduce((sum, c) => sum + (c.count || 0), 0)
}

function topThree(counters?: Counter[]): Counter[] {
  if (!Array.isArray(counters)) return []
  return [...counters].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 3)
}

export default function ClickLearningPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [insight, setInsight] = useState<StyleInsight | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Run both in parallel — they're independent. Either one failing
        // doesn't sink the page; we render whatever came back.
        const [profileRes, insightRes] = await Promise.allSettled([
          apiGet<{ data?: StyleProfile } & StyleProfile>('/style-profile'),
          apiGet<{ data?: StyleInsight } & StyleInsight>('/video/clips/style-insight'),
        ])
        if (cancelled) return
        if (profileRes.status === 'fulfilled') {
          const p = (profileRes.value as any)?.data ?? profileRes.value
          setProfile(p ?? null)
        }
        if (insightRes.status === 'fulfilled') {
          const i = (insightRes.value as any)?.data ?? insightRes.value
          setInsight(i ?? null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
        <ClickLoadingState intent="loading.analyzing" />
      </div>
    )
  }

  const totalPicks =
    insight?.totalPicks ??
    Object.keys(FACET_META).reduce(
      (sum, facet) => sum + totalCount((profile as any)?.[facet]),
      0
    )

  // Cold start — nothing learned yet. Show the warm "Click is ready"
  // empty state so the user knows where this page WILL fill in once
  // they start publishing.
  if (totalPicks === 0) {
    return (
      <div className="min-h-screen bg-[#07070f] text-white pb-32">
        <PageHeader />
        <div className="max-w-4xl mx-auto px-6 py-12">
          <ClickEmptyState
            intent="empty.analytics"
            title="Click is ready to learn"
            icon={<Brain className="w-7 h-7 text-indigo-400" />}
            action={
              <Link
                href="/dashboard/clips/hub"
                className="px-6 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Publish your first clip
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  // Resolve a list of populated facets so the page only renders cards
  // for things the user has actually picked at least once.
  const populatedFacets = Object.entries(FACET_META).filter(
    ([key]) => totalCount((profile as any)?.[key]) > 0
  )

  return (
    <div className="min-h-screen bg-[#07070f] text-white pb-32">
      <PageHeader />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest text-indigo-300">
            <Sparkles className="w-3 h-3" /> Click&apos;s Taste Graph
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter">
            Click has learned <span className="text-indigo-400">{totalPicks}</span> picks
            from you
          </h1>
          <p className="text-slate-400 max-w-2xl">
            {clickVoice('success.learned')} Every clip you publish refines the
            recommendations below. The more you ship, the sharper Click&apos;s
            suggestions get.
          </p>
        </motion.div>

        {/* Top picks by facet */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {populatedFacets.map(([facet, meta]) => {
            const counters = (profile as any)?.[facet] as Counter[] | undefined
            const top = topThree(counters)
            const facetTotal = totalCount(counters)
            const resolved = insight?.topPicks?.[facet] || null
            return (
              <motion.div
                key={facet}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-white/[0.03] border border-white/[0.08] p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    {meta.icon}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {meta.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    {facetTotal} picks
                  </span>
                </div>
                <ul className="space-y-2">
                  {top.map((c) => {
                    const isResolvedTop = resolved === c.key
                    const pct = facetTotal > 0 ? Math.round((c.count / facetTotal) * 100) : 0
                    return (
                      <li
                        key={c.key}
                        className="flex items-center justify-between gap-3"
                      >
                        <span
                          className={`text-sm ${
                            isResolvedTop ? 'text-indigo-300 font-bold' : 'text-slate-300'
                          }`}
                        >
                          {c.key}
                          {isResolvedTop && (
                            <span className="ml-1.5 text-[8px] font-black uppercase tracking-widest text-indigo-400">
                              · top
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {c.count} ({pct}%)
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </motion.div>
            )
          })}
        </section>

        {/* Publish timing pattern */}
        {totalCount(profile?.publishHours) > 0 && (
          <PublishTiming
            hours={profile?.publishHours}
            days={profile?.publishDays}
          />
        )}

        {/* Caption length signal */}
        {profile?.averages?.avgCaptionLength != null && (
          <div className="rounded-3xl bg-white/[0.03] border border-white/[0.08] p-5">
            <div className="flex items-center gap-2 mb-2 text-slate-300">
              <Type className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Average caption length
              </span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums">
              {Math.round(profile.averages.avgCaptionLength)} chars
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Click drafts future captions around this length when it can.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <header className="border-b border-white/[0.05] bg-[#07070f]/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Click Learning
          </span>
        </div>
      </div>
    </header>
  )
}

function PublishTiming({
  hours,
  days,
}: {
  hours?: Counter[]
  days?: Counter[]
}) {
  const topHour = (hours || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  const topDay = (days || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]
  const hourLabel = topHour ? `${topHour.key}:00` : null
  const dayLabel = topDay ? DAY_LABELS[Number(topDay.key) % 7] : null

  return (
    <section className="rounded-3xl bg-white/[0.03] border border-white/[0.08] p-5">
      <div className="flex items-center gap-2 mb-4 text-slate-300">
        <Clock className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">
          Your publishing rhythm
        </span>
      </div>
      <p className="text-slate-300 leading-relaxed">
        You ship most often on <span className="font-bold text-white">{dayLabel}</span>{' '}
        around <span className="font-bold text-white">{hourLabel}</span>. Click
        prioritises scheduling around that window.
      </p>
    </section>
  )
}
