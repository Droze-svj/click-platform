'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame, ArrowLeft, ArrowRight, TrendingUp, Music, Hash, Eye,
  Sparkles, Activity, Search, X, Target, Zap, Globe, Radio,
  ChevronRight, BarChart3, Clock, Radar, Waves, ActivitySquare
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '../../../hooks/useTranslation'
import { apiGet } from '../../../lib/api'

type TrendCategory = 'hooks' | 'sounds' | 'formats' | 'hashtags'

// Typed shape only — NEVER rendered as fabricated data. Real items are mapped
// from the live /marketing-intelligence/trend-report response below.
interface TrendItem {
  id: string
  category: TrendCategory
  title: string
  detail: string
  niche: string
  platform: string
}

const NICHES = ['All', 'Fitness', 'Finance', 'Tech', 'Lifestyle', 'Education', 'Comedy', 'Beauty']
const PLATFORMS = ['All', 'TikTok', 'Instagram', 'YouTube Shorts', 'X']

// Maps the live trend-report payload (hooks / sounds / formats / hashtags)
// into the flat TrendItem[] the card grid renders. Only fields the backend
// actually returns are surfaced — no scores/velocity/usage are invented.
function mapReportToTrends(report: any): TrendItem[] {
  if (!report || typeof report !== 'object') return []
  const niche = report.niche ? String(report.niche) : '—'
  const platform = report.platform ? String(report.platform) : '—'
  const items: TrendItem[] = []

  for (const h of (report.hooks || [])) {
    items.push({
      id: `hook-${h.id}`,
      category: 'hooks',
      title: String(h.label || h.framework || 'Hook'),
      detail: String(h.example || ''),
      niche,
      platform,
    })
  }
  for (const s of (report.sounds || [])) {
    items.push({
      id: `sound-${s.id}`,
      category: 'sounds',
      title: String(s.label || 'Sound'),
      detail: String(s.useCase || s.energy || ''),
      niche,
      platform,
    })
  }
  for (const f of (report.formats || [])) {
    items.push({
      id: `format-${f.id}`,
      category: 'formats',
      title: String(f.label || 'Format'),
      detail: String(f.structure || f.length || ''),
      niche,
      platform,
    })
  }
  const tags = report.hashtags || {}
  const allTags: string[] = [...(tags.primary || []), ...(tags.niche || []), ...(tags.trending || [])]
  for (const tag of Array.from(new Set(allTags))) {
    items.push({
      id: `hashtag-${tag}`,
      category: 'hashtags',
      title: String(tag),
      detail: '',
      niche,
      platform,
    })
  }
  return items
}

const CATEGORY_CFG: Record<TrendCategory, { label: string; icon: any; color: string; bg: string }> = {
  hooks:    { label: 'Hooks',    icon: Sparkles,    color: 'text-amber-500',    bg: 'bg-amber-500/10 border-amber-500/20' },
  sounds:   { label: 'Sounds',   icon: Music,       color: 'text-fuchsia-500',  bg: 'bg-fuchsia-500/10 border-fuchsia-500/20' },
  formats:  { label: 'Formats',  icon: BarChart3,   color: 'text-emerald-500',  bg: 'bg-emerald-500/10 border-emerald-500/20' },
  hashtags: { label: 'Hashtags', icon: Hash,        color: 'text-indigo-500',   bg: 'bg-indigo-500/10 border-indigo-500/20' },
}

export default function TrendsPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<TrendCategory | 'all'>('all')
  const [selectedNiche, setSelectedNiche] = useState('All')
  const [selectedPlatform, setSelectedPlatform] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [trends, setTrends] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)

  // Pull the REAL trend report. Re-fetches when niche/platform filters change
  // so the cards always reflect live backend data — never seeded samples.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedNiche !== 'All') params.append('niche', selectedNiche.toLowerCase())
    if (selectedPlatform !== 'All') params.append('platform', selectedPlatform.toLowerCase())
    const qs = params.toString()
    apiGet<{ data: any }>(`/marketing-intelligence/trend-report${qs ? `?${qs}` : ''}`)
      .then((res: any) => { if (!cancelled) setTrends(mapReportToTrends(res?.data)) })
      .catch(() => { if (!cancelled) setTrends([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedNiche, selectedPlatform])

  const filtered = useMemo(() => {
    return trends.filter(item => {
      const catMatch = selectedCategory === 'all' || item.category === selectedCategory
      const searchMatch = !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.detail.toLowerCase().includes(searchQuery.toLowerCase())
      return catMatch && searchMatch
    })
  }, [trends, selectedCategory, searchQuery])

  return (
    <div className="min-h-screen bg-[#050505] text-white font-inter selection:bg-primary-500/30">
      <ToastContainer />
      
      {/* Background HUD Graphics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
        {/* Grain texture removed (external host was 404ing). Background gradients above are sufficient. */}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Header Section */}
        <header className="mb-16">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-10 border-b border-white/5 relative z-50">
             <div className="flex items-center gap-6 w-full lg:w-auto min-w-0">
                <button type="button" onClick={() => router.push('/dashboard')} title={t('trendsPage.backToDashboard')} aria-label={t('trendsPage.backToDashboard')} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm active:scale-90 group">
                  <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                  <Radar size={40} className="text-primary-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-4 mb-2 flex-wrap">
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-900/50 text-primary-400 uppercase tracking-[0.2em] border border-primary-800 italic leading-none">
                        {t('trendsPage.liveIntelligence')}
                      </span>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/10 text-[10px] font-black italic shadow-inner">
                          <ActivitySquare size={12} className="text-primary-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                          {t('trendsPage.radarSyncActive')}
                      </div>
                   </div>
                   <h1 className="text-3xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">{t('trendsPage.title')}</h1>
                </div>
             </div>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mt-12 relative z-10">
            <div className="max-w-2xl">
              <p className="text-lg text-slate-400 font-medium leading-relaxed italic uppercase tracking-tight">
                {t('trendsPage.intro')}
              </p>
            </div>
            
            <div className="flex items-center gap-4 p-2 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-inner">
              {['24H', '7D', '30D'].map((range) => (
                <button
                  key={range}
                  title={t('trendsPage.viewTrendsForRange', { range })}
                  aria-label={t('trendsPage.viewTrendsForRange', { range })}
                  className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                    range === '24H' ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-8 mb-12 p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                title={t('trendsPage.searchTrends')}
                aria-label={t('trendsPage.searchTrends')}
                placeholder={t('trendsPage.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm font-medium outline-none focus:border-primary-500/50 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Category Select */}
            <div className="relative group">
              <select 
                value={selectedCategory}
                title={t('trendsPage.filterByCategory')}
                aria-label={t('trendsPage.filterByCategory')}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:border-primary-500/50 transition-all cursor-pointer"
              >
                <option value="all">{t('trendsPage.allCategories')}</option>
                <option value="hooks">{t('trendsPage.categoryHooks')}</option>
                <option value="sounds">{t('trendsPage.categorySounds')}</option>
                <option value="formats">{t('trendsPage.categoryFormats')}</option>
                <option value="hashtags">{t('trendsPage.categoryHashtags')}</option>
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
            </div>

            {/* Niche Select */}
            <div className="relative group">
              <select 
                value={selectedNiche}
                title={t('trendsPage.filterByNiche')}
                aria-label={t('trendsPage.filterByNiche')}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:border-primary-500/50 transition-all cursor-pointer"
              >
                {NICHES.map(n => <option key={n} value={n}>{t('trendsPage.nicheOption', { niche: n })}</option>)}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
            </div>

            {/* Platform Select */}
            <div className="relative group">
              <select 
                value={selectedPlatform}
                title={t('trendsPage.filterByPlatform')}
                aria-label={t('trendsPage.filterByPlatform')}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm font-bold outline-none focus:border-primary-500/50 transition-all cursor-pointer"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
            </div>
          </div>

          {/* Quick Category Tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {(['all', 'hooks', 'sounds', 'formats', 'hashtags'] as const).map((cat) => {
              const active = selectedCategory === cat
              const cfg = cat === 'all' ? null : CATEGORY_CFG[cat]
              const catLabel = cat === 'all' ? t('trendsPage.everything') : t(`trendsPage.categoryLabels.${cat}`)
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  title={t('trendsPage.filterByLabel', { label: catLabel })}
                  aria-label={t('trendsPage.filterByLabel', { label: catLabel })}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-white text-black border-white shadow-xl shadow-white/5'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  {cfg && <cfg.icon className="w-3.5 h-3.5" />}
                  {catLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-[2rem] bg-white/[0.03] border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {/* Trends Grid */}
        {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => {
              const cfg = CATEGORY_CFG[item.category]
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative"
                >
                  <div className="relative h-full p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl hover:bg-white/[0.06] hover:border-white/20 transition-all duration-500">
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className={`p-3 rounded-2xl ${cfg.bg} border`}>
                        <cfg.icon className={`w-6 h-6 ${cfg.color}`} />
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${cfg.color}`}>
                        {CATEGORY_CFG[item.category].label}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-bold leading-tight group-hover:text-primary-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-slate-400 font-medium mt-2 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {item.niche}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {item.platform}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => showToast(t('trendsPage.strategyAdded'), 'success')}
                        title={t('trendsPage.addStrategy')}
                        aria-label={t('trendsPage.addStrategy')}
                        className="p-3 rounded-xl bg-white/5 hover:bg-primary-500 hover:text-white border border-white/10 hover:border-primary-500 transition-all group/btn"
                      >
                        <Zap className="w-5 h-5 group-hover/btn:fill-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="py-32 text-center">
            <div className="inline-flex p-6 rounded-full bg-white/5 border border-white/10 mb-6">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2">{t('trendsPage.noSignalsTitle')}</h2>
            <p className="text-slate-500 font-medium">{t('trendsPage.noSignalsBody')}</p>
          </div>
        )}

        {/* Diagnostic Footer */}
        <footer className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
          <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t('trendsPage.systemOnline')}
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              {t('trendsPage.globalSyncActive')}
            </div>
            <div>Ref: RADAR-TR-09</div>
          </div>
          <div className="text-[10px] font-medium text-slate-500">
            © 2026 CLICK_AI. ALL RIGHTS RESERVED.
          </div>
        </footer>
      </div>
    </div>
  )
}
