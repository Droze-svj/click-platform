'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, ArrowLeft, ArrowRight, TrendingUp, Music, Hash, Eye,
  Sparkles, Activity, Search, X, Target, Zap, Globe, Radio,
  ChevronRight, BarChart3, Clock
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

type TrendCategory = 'hooks' | 'sounds' | 'formats' | 'hashtags'

interface TrendItem {
  id: string
  category: TrendCategory
  title: string
  detail: string
  niche: string
  platform: string
  score: number
  velocity: number
  uses: string
}

const NICHES = ['All', 'Fitness', 'Finance', 'Tech', 'Lifestyle', 'Education', 'Comedy', 'Beauty']
const PLATFORMS = ['All', 'TikTok', 'Instagram', 'YouTube Shorts', 'X']

const SAMPLE: TrendItem[] = [
  // Hooks
  { id: 'h1', category: 'hooks', title: 'POV: nobody told you that…', detail: 'Open with the secret nobody warned the viewer about, then deliver the lesson.', niche: 'Lifestyle',  platform: 'TikTok',           score: 94, velocity: 22, uses: '184K creators' },
  { id: 'h2', category: 'hooks', title: 'Three things I wish I knew at 22', detail: 'Numbered hindsight list. Works on YouTube Shorts and Reels.',                  niche: 'Education',  platform: 'YouTube Shorts',   score: 91, velocity: 14, uses: '92K creators' },
  { id: 'h3', category: 'hooks', title: 'I tried [X] for 30 days, here\'s what happened', detail: 'Time-bound experiment hook. Best with on-screen timer overlay.',  niche: 'Fitness',    platform: 'Instagram',        score: 88, velocity: 9,  uses: '47K creators' },
  { id: 'h4', category: 'hooks', title: 'Stop doing [common mistake]', detail: 'Pattern interrupt. Strong opener for finance and productivity niches.',                niche: 'Finance',    platform: 'TikTok',           score: 86, velocity: 11, uses: '63K creators' },
  // Sounds
  { id: 's1', category: 'sounds', title: 'Lush ambient · pulse 88bpm',         detail: 'Soft synth pad. High retention on calm, story-driven clips.',         niche: 'Lifestyle',  platform: 'TikTok',         score: 92, velocity: 18, uses: '521K videos' },
  { id: 's2', category: 'sounds', title: 'Trap remix · viral cut #4719',       detail: 'Bass drop at 0:08. Pair with reveal-style edits.',                     niche: 'Comedy',     platform: 'Instagram',      score: 90, velocity: 31, uses: '1.2M videos' },
  { id: 's3', category: 'sounds', title: 'Original · "wait for it" voiceover', detail: 'Audio meme used for cliff-hanger reveals. Watch closely for IP risk.', niche: 'Comedy',     platform: 'TikTok',         score: 87, velocity: 7,  uses: '340K videos' },
  // Formats
  { id: 'f1', category: 'formats', title: '3-clip stitch (problem → solution → CTA)', detail: 'Three vertical clips chained. ~12s total. Highest completion rate this week.', niche: 'Education', platform: 'TikTok',     score: 95, velocity: 12, uses: '—' },
  { id: 'f2', category: 'formats', title: 'Talking head + B-roll overlay',     detail: 'Center-cropped speaker, top corner B-roll. Strong for tutorials.',     niche: 'Tech',       platform: 'YouTube Shorts', score: 89, velocity: 5,  uses: '—' },
  { id: 'f3', category: 'formats', title: 'Split-screen reaction',             detail: 'Top half source, bottom half reaction face. Drives shareability.',     niche: 'Comedy',     platform: 'Instagram',      score: 84, velocity: 8,  uses: '—' },
  // Hashtags
  { id: 't1', category: 'hashtags', title: '#shadowwork',   detail: 'Personal-development tag with 3.4B views. Use sparingly.',           niche: 'Lifestyle',  platform: 'TikTok',     score: 88, velocity: 14, uses: '3.4B views' },
  { id: 't2', category: 'hashtags', title: '#valueinvesting', detail: 'Finance education tag. Lower volume but high purchase intent.',      niche: 'Finance',    platform: 'Instagram',  score: 81, velocity: 6,  uses: '180M views' },
  { id: 't3', category: 'hashtags', title: '#airefactor',   detail: 'Emerging tech tag. Velocity rising 38% week-over-week.',              niche: 'Tech',       platform: 'X',          score: 79, velocity: 38, uses: '24M views' },
]

const CATEGORY_CFG: Record<TrendCategory, { label: string; icon: any; color: string; bg: string }> = {
  hooks:    { label: 'Hooks',    icon: Sparkles,    color: 'text-amber-400',    bg: 'bg-amber-500/10 border-amber-500/30' },
  sounds:   { label: 'Sounds',   icon: Music,       color: 'text-fuchsia-400',  bg: 'bg-fuchsia-500/10 border-fuchsia-500/30' },
  formats:  { label: 'Formats',  icon: BarChart3,   color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/30' },
  hashtags: { label: 'Hashtags', icon: Hash,        color: 'text-indigo-400',   bg: 'bg-indigo-500/10 border-indigo-500/30' },
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.6)] transition-all duration-300'

export default function TrendsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()

  const [activeCategory, setActiveCategory] = useState<'all' | TrendCategory>('all')
  const [niche, setNiche] = useState('All')
  const [platform, setPlatform] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/login')
  }, [user, authLoading, router])

  const visible = useMemo(() => SAMPLE.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false
    if (niche !== 'All' && t.niche !== niche) return false
    if (platform !== 'All' && t.platform !== platform) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(t.title.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q))) return false
    }
    return true
  }), [activeCategory, niche, platform, search])

  const handleUse = (t: TrendItem) => {
    showToast(`✓ ${t.title.toUpperCase()} → DRAFTED_TO_FORGE`, 'success')
    router.push('/dashboard/forge')
  }

  if (authLoading || !user) return null

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-12 bg-[#020205]">
        <ToastContainer />

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back" className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:border-rose-500/50">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-rose-500/10 border-2 border-rose-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl">
              <Flame size={40} className="text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-rose-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-rose-400 italic leading-none">Trend Radar</span>
              </div>
              <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Discover</h1>
              <p className="text-slate-500 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">Trending hooks · sounds · formats · hashtags. Tuned to your niche signal.</p>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          {(['all', 'hooks', 'sounds', 'formats', 'hashtags'] as const).map(cat => {
            const cfg = cat === 'all' ? null : CATEGORY_CFG[cat]
            const Icon = cfg?.icon || Globe
            const count = cat === 'all' ? SAMPLE.length : SAMPLE.filter(t => t.category === cat).length
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3.5 rounded-full text-[11px] font-black uppercase tracking-[0.4em] italic flex items-center gap-3 transition-colors border-2 ${
                  active
                    ? 'bg-white text-black border-transparent'
                    : `bg-white/[0.02] border-white/10 ${cfg?.color || 'text-slate-300'} hover:bg-white/[0.05]`
                }`}
              >
                <Icon size={14} />
                {cat === 'all' ? 'ALL_SIGNALS' : cfg!.label}
                <span className={active ? 'text-black/60' : 'opacity-60'}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Filters bar */}
        <div className={`${glassStyle} rounded-[2rem] p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3`}>
          <div className="relative flex-1">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="QUERY_TREND_LATTICE..." className="w-full bg-black/60 border-2 border-white/5 rounded-full pl-12 pr-10 py-3 text-[12px] font-black text-white uppercase tracking-[0.4em] italic focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600" />
            {search && <button type="button" onClick={() => setSearch('')} title="Clear" className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center"><X size={12} /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
            <select value={niche} onChange={e => setNiche(e.target.value)} title="Filter by niche" className="bg-black/60 border-2 border-white/5 rounded-full px-5 py-3 text-[11px] font-black text-white uppercase tracking-[0.3em] italic focus:outline-none focus:border-rose-500/50 cursor-pointer">
              {NICHES.map(n => <option key={n} value={n} className="bg-[#020205]">{n}</option>)}
            </select>
            <select value={platform} onChange={e => setPlatform(e.target.value)} title="Filter by platform" className="bg-black/60 border-2 border-white/5 rounded-full px-5 py-3 text-[11px] font-black text-white uppercase tracking-[0.3em] italic focus:outline-none focus:border-rose-500/50 cursor-pointer">
              {PLATFORMS.map(p => <option key={p} value={p} className="bg-[#020205]">{p}</option>)}
            </select>
          </div>
        </div>

        {/* Trends Grid */}
        {visible.length === 0 ? (
          <div className={`${glassStyle} rounded-[3rem] p-20 flex flex-col items-center text-center gap-6`}>
            <Target size={48} className="text-slate-500" />
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">No Signals Match</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic max-w-md">Adjust niche, platform, or category. Sample data is small — connect your account for live trends.</p>
            <button type="button" onClick={() => { setActiveCategory('all'); setNiche('All'); setPlatform('All'); setSearch('') }} className="px-7 py-3 bg-white/5 border-2 border-white/10 text-slate-300 rounded-full text-[11px] font-black uppercase tracking-[0.4em] hover:text-white italic">RESET_FILTERS</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {visible.map((t, i) => {
                const cfg = CATEGORY_CFG[t.category]
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    className={`${glassStyle} rounded-[2rem] p-7 flex flex-col gap-5 hover:border-rose-500/30 group`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-12 h-12 rounded-[1rem] ${cfg.bg} border flex items-center justify-center`}>
                        <cfg.icon size={22} className={cfg.color} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-300 text-[8px] font-black uppercase tracking-[0.3em] italic flex items-center gap-1.5">
                          <TrendingUp size={10} className="text-emerald-400" /> +{t.velocity}%
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[8px] font-black uppercase tracking-[0.3em] italic flex items-center gap-1.5">
                          <Zap size={10} /> {t.score}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-black text-white italic leading-tight tracking-tight mb-3 group-hover:text-rose-400 transition-colors">{t.title}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium line-clamp-3">{t.detail}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[9px] font-black uppercase tracking-[0.3em] italic">
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-300 flex items-center gap-1.5"><Radio size={10} className="text-indigo-400" /> {t.platform}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-300">{t.niche}</span>
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-slate-300 flex items-center gap-1.5"><Eye size={10} /> {t.uses}</span>
                    </div>
                    <button type="button" onClick={() => handleUse(t)} className="mt-2 py-3 bg-white/5 border-2 border-white/10 text-slate-200 rounded-full text-[11px] font-black uppercase tracking-[0.4em] italic hover:bg-rose-500 hover:text-white hover:border-transparent transition-colors flex items-center justify-center gap-3">
                      USE_IN_FORGE <ArrowRight size={14} />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Footer note */}
        <div className={`${glassStyle} rounded-[2rem] p-7 flex items-center gap-5 border-rose-500/10`}>
          <div className="w-12 h-12 rounded-[1rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.5em] italic mb-1.5 leading-none">SIGNAL_SOURCE</p>
            <p className="text-[12px] text-slate-300 leading-relaxed font-medium">Showing seeded sample trends. <Link href="/dashboard/integrations" className="text-rose-400 hover:text-rose-300 underline decoration-rose-500/40 underline-offset-4">Connect a social account</Link> to receive live trend data tuned to your audience.</p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
