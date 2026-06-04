'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { ArrowLeft, Calendar, Plus, Pause, Play, Trash2, Repeat } from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import ToastContainer from '../../../components/ToastContainer'

type PlatformId = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'facebook'

interface RecurringTemplate {
  _id: string
  platform: PlatformId
  accountId: string | null
  content: { text: string; mediaUrl: string; hashtags: string[] }
  cadence: {
    daysOfWeek: number[]
    timeOfDay: string
    timezone: string
    maxFires: number | null
    endsAt: string | null
  }
  active: boolean
  fireCount: number
  lastFiredAt: string | null
  nextFireAt: string | null
  createdAt: string
}

const PLATFORMS: { id: PlatformId; label: string; icon: string }[] = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'youtube', label: 'YouTube', icon: '▶' },
  { id: 'twitter', label: 'X / Twitter', icon: '𝕏' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function RecurringPostsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // New-template form state. Kept simple — power-users can edit details
  // after creating via the edit modal (future iteration).
  const [form, setForm] = useState({
    platform: 'instagram' as PlatformId,
    text: '',
    mediaUrl: '',
    hashtags: '',
    daysOfWeek: [1, 3, 5] as number[], // Mon/Wed/Fri default
    timeOfDay: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  })

  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiGet<{ templates: RecurringTemplate[] }>('/recurring')
      setTemplates(res?.templates || [])
    } catch {
      showToast(t('recurringPage.toastLoadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d)
        ? f.daysOfWeek.filter((x) => x !== d)
        : [...f.daysOfWeek, d].sort(),
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.daysOfWeek.length === 0) {
      showToast(t('recurringPage.toastPickDay'), 'error')
      return
    }
    if (!form.text.trim() && !form.mediaUrl.trim()) {
      showToast(t('recurringPage.toastAddContent'), 'error')
      return
    }
    setCreating(true)
    try {
      await apiPost('/recurring', {
        platform: form.platform,
        content: {
          text: form.text,
          mediaUrl: form.mediaUrl,
          hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean),
        },
        cadence: {
          daysOfWeek: form.daysOfWeek,
          timeOfDay: form.timeOfDay,
          timezone: form.timezone,
        },
      })
      showToast(t('recurringPage.toastCreated'), 'success')
      setForm({
        platform: form.platform,
        text: '',
        mediaUrl: '',
        hashtags: '',
        daysOfWeek: form.daysOfWeek,
        timeOfDay: form.timeOfDay,
        timezone: form.timezone,
      })
      loadTemplates()
    } catch {
      showToast(t('recurringPage.toastCreateFailed'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const togglePause = async (tpl: RecurringTemplate) => {
    try {
      const path = tpl.active ? `/recurring/${tpl._id}/pause` : `/recurring/${tpl._id}/resume`
      await apiPost(path, {})
      showToast(tpl.active ? t('recurringPage.toastPaused') : t('recurringPage.toastResumed'), 'success')
      loadTemplates()
    } catch {
      showToast(t('recurringPage.toastUpdateFailed'), 'error')
    }
  }

  const remove = async (tpl: RecurringTemplate) => {
    if (!window.confirm(t('recurringPage.confirmDelete'))) return
    try {
      await apiDelete(`/recurring/${tpl._id}`)
      showToast(t('recurringPage.toastDeleted'), 'success')
      loadTemplates()
    } catch {
      showToast(t('recurringPage.toastDeleteFailed'), 'error')
    }
  }

  const formatNext = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label || id

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-8 lg:px-12 pt-8 max-w-[1400px] mx-auto space-y-12 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500">
        <ToastContainer />

        <header className="flex items-center justify-between gap-6 pb-8 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-6">
            <button type="button" onClick={() => router.push('/dashboard')}
              title={t('recurringPage.backToDashboard')} aria-label={t('recurringPage.backToDashboard')}
              className="w-14 h-14 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all">
              <ArrowLeft size={24} />
            </button>
            <div className="w-16 h-16 rounded-3xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center">
              <Repeat size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('recurringPage.title')}</h1>
              <p className="text-sm text-surface-500 mt-1">{t('recurringPage.subtitle')}</p>
            </div>
          </div>
        </header>

        <section className="bg-surface-card border-2 border-surface-100 dark:border-surface-800 rounded-3xl p-8 shadow-xl">
          <h2 className="text-xl font-bold mb-6">{t('recurringPage.createHeading')}</h2>
          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.platform')}</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {PLATFORMS.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => setForm((f) => ({ ...f, platform: p.id }))}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${form.platform === p.id ? 'bg-primary-500 text-white border-primary-500' : 'bg-surface-page dark:bg-surface-950 border-surface-100 dark:border-surface-800 text-surface-500 hover:border-primary-500/40'}`}
                  >
                    <span className="text-2xl" aria-hidden>{p.icon}</span>
                    <span className="text-[10px] font-bold">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="rec-caption" className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.caption')}</label>
              <textarea id="rec-caption" value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={t('recurringPage.captionPlaceholder')}
                className="w-full h-32 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl p-4 text-base focus:outline-none focus:border-primary-500 transition-colors" />
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="rec-media" className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.mediaUrl')}</label>
                <input id="rec-media" type="url" value={form.mediaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder={t('recurringPage.mediaUrlPlaceholder')}
                  className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors" />
              </div>
              <div>
                <label htmlFor="rec-tags" className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.hashtags')}</label>
                <input id="rec-tags" type="text" value={form.hashtags}
                  onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                  placeholder={t('recurringPage.hashtagsPlaceholder')}
                  className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.daysOfWeek')}</label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${form.daysOfWeek.includes(i) ? 'bg-primary-500 text-white border-primary-500' : 'bg-surface-page dark:bg-surface-950 border-surface-100 dark:border-surface-800 text-surface-500 hover:border-primary-500/40'}`}
                  >{t(`recurringPage.day_${i}`) || label}</button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="rec-time" className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.timeOfDay')}</label>
                <input id="rec-time" type="time" value={form.timeOfDay}
                  onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))}
                  className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors" />
              </div>
              <div>
                <label htmlFor="rec-tz" className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">{t('recurringPage.timezone')}</label>
                <input id="rec-tz" type="text" value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                  className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 transition-colors" />
                <p className="text-[10px] text-surface-400 mt-2">{t('recurringPage.timezoneHint')}</p>
              </div>
            </div>

            <button type="submit" disabled={creating}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary-500 text-white font-bold hover:bg-primary-600 transition-colors disabled:opacity-50">
              <Plus size={18} />
              {creating ? t('recurringPage.creating') : t('recurringPage.createButton')}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-6">{t('recurringPage.yourSchedules')}</h2>
          {loading ? (
            <div className="text-sm text-surface-400">{t('recurringPage.loading')}</div>
          ) : templates.length === 0 ? (
            <div className="bg-surface-card border-2 border-dashed border-surface-200 dark:border-surface-800 rounded-3xl p-12 text-center text-surface-500">
              {t('recurringPage.emptyState')}
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((tpl) => (
                <div key={tpl._id} className="bg-surface-card border-2 border-surface-100 dark:border-surface-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="px-2 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 text-[10px] font-bold uppercase tracking-wider">{platformLabel(tpl.platform)}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tpl.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-surface-200 dark:bg-surface-800 text-surface-500'}`}>{tpl.active ? t('recurringPage.active') : t('recurringPage.paused')}</span>
                    </div>
                    <p className="text-sm truncate font-medium">{tpl.content.text || tpl.content.mediaUrl || t('recurringPage.noContent')}</p>
                    <div className="flex items-center gap-4 text-xs text-surface-400 mt-2 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={12} />{t('recurringPage.cadenceSummary', { days: tpl.cadence.daysOfWeek.map((d) => t(`recurringPage.day_${d}`) || DAY_LABELS[d]).join('/'), time: tpl.cadence.timeOfDay, timezone: tpl.cadence.timezone })}</span>
                      <span>{t('recurringPage.next', { value: formatNext(tpl.nextFireAt) })}</span>
                      <span>{t('recurringPage.firedCount', { count: tpl.fireCount })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => togglePause(tpl)} title={tpl.active ? t('recurringPage.pause') : t('recurringPage.resume')}
                      className="w-10 h-10 rounded-xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center hover:border-primary-500 transition-colors">
                      {tpl.active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button type="button" onClick={() => remove(tpl)} title={t('recurringPage.delete')}
                      className="w-10 h-10 rounded-xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center hover:border-rose-500 hover:text-rose-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
