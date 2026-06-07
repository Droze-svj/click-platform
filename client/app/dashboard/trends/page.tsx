'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Music, Hash, Sparkles, Search, Zap,
  ChevronDown, BarChart3,
} from 'lucide-react'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '../../../hooks/useTranslation'
import { apiGet } from '../../../lib/api'
import { cn } from '../../../lib/utils'
import {
  Panel,
  IconButton,
  Input,
  FormField,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../components/ui'

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
  const reduceMotion = useReducedMotion()
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
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
      <SectionHeader
        as="h1"
        title={t('trendsPage.title')}
        description={t('trendsPage.intro')}
        className="mb-6"
      />

      {/* ── Filter Toolbar ── */}
      <Panel variant="bento" className="mb-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            <Input
              type="text"
              title={t('trendsPage.searchTrends')}
              aria-label={t('trendsPage.searchTrends')}
              placeholder={t('trendsPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Select */}
          <FormField className="gap-0">
            <div className="relative">
              <select
                value={selectedCategory}
                title={t('trendsPage.filterByCategory')}
                aria-label={t('trendsPage.filterByCategory')}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="all">{t('trendsPage.allCategories')}</option>
                <option value="hooks">{t('trendsPage.categoryHooks')}</option>
                <option value="sounds">{t('trendsPage.categorySounds')}</option>
                <option value="formats">{t('trendsPage.categoryFormats')}</option>
                <option value="hashtags">{t('trendsPage.categoryHashtags')}</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            </div>
          </FormField>

          {/* Niche Select */}
          <FormField className="gap-0">
            <div className="relative">
              <select
                value={selectedNiche}
                title={t('trendsPage.filterByNiche')}
                aria-label={t('trendsPage.filterByNiche')}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {NICHES.map(n => <option key={n} value={n}>{t('trendsPage.nicheOption', { niche: n })}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            </div>
          </FormField>

          {/* Platform Select */}
          <FormField className="gap-0">
            <div className="relative">
              <select
                value={selectedPlatform}
                title={t('trendsPage.filterByPlatform')}
                aria-label={t('trendsPage.filterByPlatform')}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            </div>
          </FormField>
        </div>

        {/* Quick Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'hooks', 'sounds', 'formats', 'hashtags'] as const).map((cat) => {
            const active = selectedCategory === cat
            const cfg = cat === 'all' ? null : CATEGORY_CFG[cat]
            const catLabel = cat === 'all' ? t('trendsPage.everything') : t(`trendsPage.categoryLabels.${cat}`)
            const CatIcon = cfg?.icon
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                title={t('trendsPage.filterByLabel', { label: catLabel })}
                aria-label={t('trendsPage.filterByLabel', { label: catLabel })}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'ds-surface-subtle text-theme-secondary hover:text-theme-primary'
                )}
              >
                {CatIcon && <CatIcon className="h-3.5 w-3.5" aria-hidden />}
                {catLabel}
              </button>
            )
          })}
        </div>
      </Panel>

      {/* Loading skeleton */}
      {loading && (
        <div className="ds-bento-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ds-surface-card h-56 animate-pulse" aria-hidden />
          ))}
        </div>
      )}

      {/* Trends Grid */}
      {!loading && filtered.length > 0 && (
        <div className="ds-bento-grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, idx) => {
              const cfg = CATEGORY_CFG[item.category]
              const CatIcon = cfg.icon
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                  transition={{ delay: reduceMotion ? 0 : idx * 0.04 }}
                >
                  <Panel variant="bento" className="flex h-full flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', cfg.bg)}>
                        <CatIcon className={cn('h-5 w-5', cfg.color)} aria-hidden />
                      </span>
                      <span className={cn('ds-text-caption font-semibold', cfg.color)}>{cfg.label}</span>
                    </div>

                    <h3 className="ds-text-h3 text-theme-primary leading-tight">{item.title}</h3>
                    {item.detail && <p className="mt-2 text-sm text-theme-muted leading-relaxed">{item.detail}</p>}

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{item.niche}</Badge>
                      <Badge variant="secondary">{item.platform}</Badge>
                    </div>

                    <div className="mt-auto pt-4 flex items-center justify-end">
                      <IconButton
                        variant="ghost" size="sm"
                        onClick={() => showToast(t('trendsPage.strategyAdded'), 'success')}
                        title={t('trendsPage.addStrategy')}
                        aria-label={t('trendsPage.addStrategy')}
                      >
                        <Zap className="h-4 w-4" aria-hidden />
                      </IconButton>
                    </div>
                  </Panel>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title={t('trendsPage.noSignalsTitle')}
          description={t('trendsPage.noSignalsBody')}
          className="ds-surface-card"
        />
      )}
    </div>
  )
}
