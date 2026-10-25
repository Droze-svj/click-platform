'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { m, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  AlertTriangle,
  RefreshCw,
  Layers,
  TrendingUp,
  Plus,
  CheckCircle,
  XCircle,
  ArrowRight,
  Sparkle,
  Download,
  Pause,
  Play,
} from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { useDialogBehavior } from '../ui/modal'
import { useTranslation } from '@/hooks/useTranslation'
import { Panel, SectionHeader, StatCard, Button } from '../ui'

const BRAND_NAMES: Record<string, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', twitter: 'X', x: 'X',
  linkedin: 'LinkedIn', facebook: 'Facebook',
}

interface ScheduledPost {
  _id: string;
  platform: string;
  scheduledTime: string;
  content: {
    text: string;
    mediaUrl?: string;
  };
  status: string;
  conflictResolved?: boolean;
}

interface RecurringTemplateRow {
  _id: string;
  name?: string;
  platforms?: string[];
  usageCount?: number;
  active?: boolean;
  nextFireAt?: string | null;
}

interface SchedulerAnalytics {
  total?: number;
  byStatus?: Record<string, number>;
  optimalTimeUsage?: number;
  conflictRate?: number;
}

type Tab = 'timeline' | 'recurring' | 'export'


export default function AdvancedSchedulingHub() {
  const { t } = useTranslation()
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [templates, setTemplates] = useState<RecurringTemplateRow[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)
  const panelRef = useDialogBehavior(showBulkModal, () => setShowBulkModal(false))
  const [activeTab, setActiveTab] = useState<Tab>('timeline')
  const [analytics, setAnalytics] = useState<SchedulerAnalytics | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busyTemplate, setBusyTemplate] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [postsRes, analyticsRes, templatesRes] = await Promise.all([
        apiGet<any>('/scheduler', undefined, false),
        apiGet<any>('/scheduler/analytics', undefined, false),
        apiGet<any>('/scheduler/templates', undefined, false)
      ])
      setPosts(Array.isArray(postsRes?.data) ? postsRes.data : [])
      setAnalytics(analyticsRes || null)
      setTemplates(Array.isArray(templatesRes) ? templatesRes : [])
    } catch (err) {
      console.error('Failed to load scheduling data', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleSelect = (id: string) => {
    setSelectedPosts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleBulkReschedule = async (timeShiftMs: number) => {
    setRescheduling(true)
    try {
      const res = await apiPost<any>('/scheduler/bulk-reschedule', {
        postIds: selectedPosts,
        timeShiftMs
      })
      const updated = Number(res?.updated ?? 0)
      const skipped = Number(res?.skipped ?? 0)
      setNotice({
        tone: 'ok',
        text: skipped > 0
          ? t('advancedSchedulingHub.rescheduledWithSkipped', { updated: String(updated), skipped: String(skipped) })
          : t('advancedSchedulingHub.rescheduled', { updated: String(updated) })
      })
      setSelectedPosts([])
      setShowBulkModal(false)
      loadData()
    } catch (err) {
      console.error('Bulk reschedule failed', err)
      setNotice({ tone: 'error', text: t('advancedSchedulingHub.rescheduleFailed') })
    } finally {
      setRescheduling(false)
    }
  }

  const toggleTemplate = async (tpl: RecurringTemplateRow) => {
    setBusyTemplate(tpl._id)
    try {
      const path = tpl.active ? `/recurring/${tpl._id}/pause` : `/recurring/${tpl._id}/resume`
      await apiPost(path, {})
      setNotice({ tone: 'ok', text: tpl.active ? t('advancedSchedulingHub.templatePaused') : t('advancedSchedulingHub.templateResumed') })
      loadData()
    } catch (err) {
      console.error('Recurring template toggle failed', err)
      setNotice({ tone: 'error', text: t('advancedSchedulingHub.templateUpdateFailed') })
    } finally {
      setBusyTemplate(null)
    }
  }

  // GET /api/scheduling/export-calendar returns a real .ics of the user's
  // upcoming scheduled posts.
  const downloadCalendar = async () => {
    setExporting(true)
    try {
      const ics = await apiGet<string>('/scheduling/export-calendar?format=ics', { responseType: 'text' }, false)
      const blob = new Blob([typeof ics === 'string' ? ics : String(ics ?? '')], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'click-schedule.ics'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Calendar export failed', err)
      setNotice({ tone: 'error', text: t('advancedSchedulingHub.exportFailed') })
    } finally {
      setExporting(false)
    }
  }

  const hasAnalytics = !!analytics && Number(analytics.total) > 0
  const pct = (v?: number) => (hasAnalytics && Number.isFinite(Number(v)) ? `${Math.round(Number(v))}%` : '—')

  const stats = [
    { label: t('advancedSchedulingHub.statScheduled'), val: loading ? '—' : posts.length, icon: Layers, color: 'text-white' },
    { label: t('advancedSchedulingHub.statBestTime'), val: pct(analytics?.optimalTimeUsage), icon: TrendingUp, color: 'text-emerald-400' },
    { label: t('advancedSchedulingHub.statClashes'), val: pct(analytics?.conflictRate), icon: AlertTriangle, color: 'text-rose-400' },
    { label: t('advancedSchedulingHub.statWaiting'), val: hasAnalytics ? (analytics?.byStatus?.active ?? 0) : '—', icon: RefreshCw, color: 'text-indigo-400' },
  ]

  const tabs: { id: Tab; label: string }[] = [
    { id: 'timeline', label: t('advancedSchedulingHub.tabTimeline') },
    { id: 'recurring', label: t('advancedSchedulingHub.tabRecurring') },
    { id: 'export', label: t('advancedSchedulingHub.tabExport') },
  ]

  const brand = (p: string) => BRAND_NAMES[String(p).toLowerCase()] || p
  const platformLabel = (tpl: RecurringTemplateRow) =>
    tpl.platforms && tpl.platforms.length > 0 ? tpl.platforms.map(brand).join(' + ') : t('advancedSchedulingHub.allPlatforms')

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row — every value comes from GET /api/scheduler/analytics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} className="ds-anim-rise" label={stat.label} value={stat.val} icon={stat.icon} />
        ))}
      </div>

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border text-sm font-medium ${notice.tone === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'}`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t('advancedSchedulingHub.dismiss')} className="p-1 rounded-full hover:bg-accent">
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Timeline Column */}
        <Panel className="xl:col-span-2 flex flex-col gap-4">
          <SectionHeader
            as="h2"
            title={<span className="inline-flex items-center gap-2"><Calendar className="text-indigo-500" size={22} aria-hidden /> {t('advancedSchedulingHub.title')}</span>}
            actions={selectedPosts.length > 0 ? (
              <Button variant="primary" size="sm" onClick={() => setShowBulkModal(true)}>
                {t('advancedSchedulingHub.moveSelected', { count: String(selectedPosts.length) })}
              </Button>
            ) : undefined}
          />

          <div role="tablist" className="inline-flex self-start items-center gap-1 rounded-xl ds-surface-subtle p-1">
            {tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-theme-muted hover:text-theme-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {loadError && (
              <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{t('advancedSchedulingHub.loadFailed')}</p>
                <Button variant="secondary" size="sm" onClick={loadData}>{t('advancedSchedulingHub.retry')}</Button>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {activeTab === 'timeline' && !loading && !loadError && posts.length === 0 && (
                <m.div key="timeline-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center text-theme-muted text-sm">
                  {t('advancedSchedulingHub.noPosts')}
                </m.div>
              )}

              {activeTab === 'timeline' && posts.map((post, i) => {
                const selected = selectedPosts.includes(post._id)
                return (
                <m.div
                  key={post._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: i * 0.03 }}
                  className={`ds-surface-subtle p-3 sm:p-4 flex items-center gap-3 sm:gap-4 ${selected ? 'ring-2 ring-indigo-500/50' : ''} ${post.status === 'failed' ? 'border-rose-500/30' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(post._id)}
                    title={selected ? t('advancedSchedulingHub.deselectPost') : t('advancedSchedulingHub.selectPost')}
                    aria-label={selected ? t('advancedSchedulingHub.deselectPost') : t('advancedSchedulingHub.selectPost')}
                    aria-pressed={selected}
                    className={`h-6 w-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-[var(--border-subtle)] hover:border-indigo-500'}`}
                  >
                    {selected && <CheckCircle size={14} aria-hidden="true" />}
                  </button>

                  <div className="w-14 shrink-0 text-sm font-semibold text-theme-muted tabular-nums">
                    {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                        {brand(String(post.platform || ''))}
                      </span>
                      {post.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                          <AlertTriangle size={12} aria-hidden /> {t('advancedSchedulingHub.statusFailed')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-theme-primary truncate">{post.content?.text || t('advancedSchedulingHub.untitledPost')}</h3>
                  </div>

                  <div className="text-right hidden sm:block shrink-0">
                    <p className="ds-text-caption text-theme-muted">{t('advancedSchedulingHub.date')}</p>
                    <p className="text-sm font-medium text-theme-primary">{new Date(post.scheduledTime).toLocaleDateString()}</p>
                  </div>
                </m.div>
                )
              })}

              {activeTab === 'recurring' && (
                <m.div key="recurring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  {templates.length === 0 ? (
                    <div className="py-10 text-center text-theme-muted text-sm">{t('advancedSchedulingHub.noRecurring')}</div>
                  ) : (
                    templates.map((tpl) => (
                      <div key={tpl._id} className="ds-surface-subtle p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-theme-primary">{platformLabel(tpl)}</p>
                          <p className="ds-text-caption text-theme-muted">
                            {tpl.active && tpl.nextFireAt
                              ? t('advancedSchedulingHub.nextRun', { when: new Date(tpl.nextFireAt).toLocaleString() })
                              : t('advancedSchedulingHub.paused')}
                            {' · '}
                            {t('advancedSchedulingHub.postsSent', { count: String(tpl.usageCount ?? 0) })}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleTemplate(tpl)}
                          disabled={busyTemplate === tpl._id}
                          leftIcon={tpl.active ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                        >
                          {tpl.active ? t('advancedSchedulingHub.pause') : t('advancedSchedulingHub.resume')}
                        </Button>
                      </div>
                    ))
                  )}

                  <Link
                    href="/dashboard/recurring"
                    className="w-full py-6 rounded-xl border-2 border-dashed border-[var(--border-subtle)] text-theme-muted hover:border-indigo-500 hover:text-theme-primary transition-colors flex flex-col items-center gap-2"
                  >
                    <Plus size={22} aria-hidden />
                    <span className="text-sm font-medium">{t('advancedSchedulingHub.createRecurring')}</span>
                  </Link>
                </m.div>
              )}

              {activeTab === 'export' && (
                <m.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ds-surface-subtle p-5 flex flex-col sm:flex-row items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                    <Download size={22} aria-hidden />
                  </span>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="ds-text-h3 text-theme-primary">{t('advancedSchedulingHub.exportTitle')}</h3>
                    <p className="text-sm text-theme-muted">{t('advancedSchedulingHub.exportBody')}</p>
                  </div>
                  <Button variant="primary" onClick={downloadCalendar} disabled={exporting} loading={exporting}>
                    {exporting ? t('advancedSchedulingHub.exporting') : t('advancedSchedulingHub.exportButton')}
                  </Button>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>

        {/* Sidebar */}
        <Panel className="self-start flex flex-col gap-3">
          <h3 className="ds-text-h3 text-theme-primary flex items-center gap-2">
            <Sparkle className="text-indigo-500" size={18} aria-hidden /> {t('advancedSchedulingHub.recurringTitle')}
          </h3>
          <p className="text-sm text-theme-muted">{t('advancedSchedulingHub.recurringBody')}</p>
          <Link href="/dashboard/recurring" className="mt-1">
            <Button variant="secondary" className="w-full" leftIcon={<Plus size={16} aria-hidden />}>
              {t('advancedSchedulingHub.manageRecurring')}
            </Button>
          </Link>
        </Panel>
      </div>

      {/* Bulk move modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('advancedSchedulingHub.moveTitle')}>
             <m.div
               ref={panelRef}
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="ds-surface-elevated w-full max-w-xl p-6 sm:p-8 rounded-2xl relative"
             >
                <button type="button" onClick={() => setShowBulkModal(false)} aria-label={t('advancedSchedulingHub.close')} className="absolute top-4 right-4 p-2 hover:bg-accent rounded-lg transition-colors text-theme-muted hover:text-theme-primary"><XCircle size={20}/></button>
                <h2 className="ds-text-h2 text-theme-primary mb-2 pr-10">{t('advancedSchedulingHub.moveTitle')}</h2>
                <p className="text-sm text-theme-muted mb-6">{t('advancedSchedulingHub.moveBody', { count: String(selectedPosts.length) })}</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                   {[
                     { label: t('advancedSchedulingHub.shift1h'), ms: 3600000 },
                     { label: t('advancedSchedulingHub.shift6h'), ms: 21600000 },
                     { label: t('advancedSchedulingHub.shift1d'), ms: 86400000 },
                     { label: t('advancedSchedulingHub.shift1w'), ms: 604800000 },
                   ].map(opt => (
                     <button
                       type="button"
                       key={opt.ms}
                       disabled={rescheduling}
                       onClick={() => handleBulkReschedule(opt.ms)}
                       className="h-12 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold text-theme-primary hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-colors group flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {opt.label} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden />
                     </button>
                   ))}
                </div>

                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={18} aria-hidden />
                  <p className="text-sm text-theme-muted leading-relaxed">{t('advancedSchedulingHub.moveWarning')}</p>
                </div>
             </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
