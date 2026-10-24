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

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

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

  const platformLabel = (tpl: RecurringTemplateRow) =>
    tpl.platforms && tpl.platforms.length > 0 ? tpl.platforms.join(' + ') : t('advancedSchedulingHub.allPlatforms')

  return (
    <div className="space-y-12 font-inter text-white">
      {/* Stats row — every value comes from GET /api/scheduler/analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <m.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${glassStyle} p-6 rounded-[2.5rem] flex items-center gap-6 group hover:bg-white/[0.05]`}
          >
            <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <stat.icon size={24} className={stat.color} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-3xl font-black tracking-tighter ${stat.color}`}>{stat.val}</p>
            </div>
          </m.div>
        ))}
      </div>

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-4 px-6 py-4 rounded-3xl border text-[13px] font-semibold ${notice.tone === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t('advancedSchedulingHub.dismiss')} className="p-1 rounded-full hover:bg-white/10">
            <XCircle size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        {/* Main Timeline Column */}
        <div className="xl:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black uppercase tracking-tighter flex items-center gap-4">
              <Calendar className="text-indigo-500" size={32} /> {t('advancedSchedulingHub.title')}
            </h2>
            <div className="flex items-center gap-4">
              {selectedPosts.length > 0 && (
                <m.button
                  type="button"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setShowBulkModal(true)}
                  className="px-8 py-3 bg-indigo-500 text-white rounded-full text-[12px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                >
                  {t('advancedSchedulingHub.moveSelected', { count: String(selectedPosts.length) })}
                </m.button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-3xl border border-white/10">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {loadError && (
              <div role="alert" className={`${glassStyle} p-8 rounded-[3rem] flex flex-col sm:flex-row items-center justify-between gap-4 border-rose-500/30`}>
                <p className="text-[13px] font-semibold text-rose-300">{t('advancedSchedulingHub.loadFailed')}</p>
                <button type="button" onClick={loadData} className="px-6 py-2 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all">
                  {t('advancedSchedulingHub.retry')}
                </button>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {activeTab === 'timeline' && !loading && !loadError && posts.length === 0 && (
                <m.div key="timeline-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-slate-500 text-[13px] font-semibold">
                  {t('advancedSchedulingHub.noPosts')}
                </m.div>
              )}

              {activeTab === 'timeline' && posts.map((post, i) => (
                <m.div
                  key={post._id}
                  layout
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className={`${glassStyle} p-6 rounded-[3rem] group relative overflow-hidden flex items-center gap-8 ${selectedPosts.includes(post._id) ? 'border-indigo-500/50 bg-indigo-500/[0.02]' : ''}`}
                >
                  {post.status === 'failed' && <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />}

                  <button
                    type="button"
                    onClick={() => toggleSelect(post._id)}
                    title={selectedPosts.includes(post._id) ? t('advancedSchedulingHub.deselectPost') : t('advancedSchedulingHub.selectPost')}
                    aria-pressed={selectedPosts.includes(post._id)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedPosts.includes(post._id) ? 'bg-indigo-500 border-indigo-500' : 'border-white/10 bg-white/5'}`}
                  >
                    {selectedPosts.includes(post._id) && <CheckCircle size={14} aria-hidden="true" />}
                  </button>

                  <div className="w-20 font-black text-slate-500 tabular-nums text-right">
                    {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>

                  <div className="w-1 bg-white/10 h-12 rounded-full hidden md:block" />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-black uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full border border-white/10 text-indigo-400">
                        {String(post.platform || '').toUpperCase()}
                      </span>
                      {post.status === 'failed' && (
                        <span className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase">
                          <AlertTriangle size={12} /> {t('advancedSchedulingHub.statusFailed')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold truncate pr-10 tracking-tight">{post.content?.text || t('advancedSchedulingHub.untitledPost')}</h3>
                  </div>

                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{t('advancedSchedulingHub.date')}</p>
                    <p className="text-[13px] font-black uppercase">{new Date(post.scheduledTime).toLocaleDateString()}</p>
                  </div>
                </m.div>
              ))}

              {activeTab === 'recurring' && (
                <m.div key="recurring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {templates.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 text-[13px] font-semibold">{t('advancedSchedulingHub.noRecurring')}</div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl._id}
                        className={`${glassStyle} p-6 rounded-[3rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                      >
                        <div className="min-w-0">
                          <p className="text-lg font-black uppercase tracking-tight">{platformLabel(tpl)}</p>
                          <p className="text-[11px] text-slate-500 font-semibold">
                            {tpl.active && tpl.nextFireAt
                              ? t('advancedSchedulingHub.nextRun', { when: new Date(tpl.nextFireAt).toLocaleString() })
                              : t('advancedSchedulingHub.paused')}
                            {' · '}
                            {t('advancedSchedulingHub.postsSent', { count: String(tpl.usageCount ?? 0) })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleTemplate(tpl)}
                          disabled={busyTemplate === tpl._id}
                          className="px-6 py-2 bg-white/[0.05] border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {tpl.active ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
                          {tpl.active ? t('advancedSchedulingHub.pause') : t('advancedSchedulingHub.resume')}
                        </button>
                      </div>
                    ))
                  )}

                  <Link
                    href="/dashboard/recurring"
                    className="w-full py-8 rounded-[3rem] border-2 border-dashed border-white/10 text-slate-500 hover:border-indigo-500 hover:text-white transition-all flex flex-col items-center gap-4 group"
                  >
                    <Plus size={32} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">{t('advancedSchedulingHub.createRecurring')}</span>
                  </Link>
                </m.div>
              )}

              {activeTab === 'export' && (
                <m.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassStyle} p-12 rounded-[4rem] bg-gradient-to-br from-indigo-500/10 to-transparent flex flex-col sm:flex-row items-center gap-8`}>
                  <div className="w-20 h-20 rounded-[2.5rem] bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Download size={32} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">{t('advancedSchedulingHub.exportTitle')}</h3>
                    <p className="text-slate-400 text-[13px] font-medium">{t('advancedSchedulingHub.exportBody')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCalendar}
                    disabled={exporting}
                    className="px-8 py-4 bg-white text-black rounded-[2rem] text-[12px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    {exporting ? t('advancedSchedulingHub.exporting') : t('advancedSchedulingHub.exportButton')}
                  </button>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-12">
          <div className={`${glassStyle} p-8 rounded-[4rem] relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.03] to-transparent`}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><RefreshCw size={150} /></div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-4">
              <Sparkle className="text-indigo-400" size={24} /> {t('advancedSchedulingHub.recurringTitle')}
            </h3>
            <p className="text-slate-400 text-[13px] mb-8 leading-relaxed font-medium">{t('advancedSchedulingHub.recurringBody')}</p>
            <Link
              href="/dashboard/recurring"
              className="w-full py-4 bg-white text-black rounded-[2rem] text-[13px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-indigo-500 hover:text-white transition-all duration-700 group"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform" /> {t('advancedSchedulingHub.manageRecurring')}
            </Link>
          </div>
        </div>
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
               className={`${glassStyle} w-full max-w-xl p-12 rounded-[5rem] bg-black/90 relative`}
             >
                <button type="button" onClick={() => setShowBulkModal(false)} aria-label={t('advancedSchedulingHub.close')} className="absolute top-10 right-10 p-4 hover:bg-white/10 rounded-full transition-all text-slate-500 hover:text-white"><XCircle size={32}/></button>
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">{t('advancedSchedulingHub.moveTitle')}</h2>
                <p className="text-[14px] font-semibold text-slate-400 mb-12">{t('advancedSchedulingHub.moveBody', { count: String(selectedPosts.length) })}</p>

                <div className="grid grid-cols-2 gap-6 mb-12">
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
                       className="py-6 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/5 text-[15px] font-black uppercase tracking-widest hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all group flex items-center justify-center gap-4 disabled:opacity-50"
                     >
                        {opt.label} <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                     </button>
                   ))}
                </div>

                <div className="p-8 bg-amber-500/5 border border-amber-500/20 rounded-3xl flex items-start gap-6">
                  <AlertTriangle className="text-amber-400 mt-1 flex-shrink-0" size={24} />
                  <p className="text-[12px] font-semibold text-slate-400 leading-relaxed">{t('advancedSchedulingHub.moveWarning')}</p>
                </div>
             </m.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
