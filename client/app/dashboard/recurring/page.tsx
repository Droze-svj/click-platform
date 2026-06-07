'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from '../../../lib/api'
import { Calendar, Plus, Pause, Play, Trash2, Repeat } from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import ToastContainer from '../../../components/ToastContainer'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { FormField, Input, Textarea } from '../../../components/ui/form-field'
import { EmptyState } from '../../../components/ui/empty-state'
import { SectionHeader } from '../../../components/ui/section-header'
import { Badge } from '../../../components/ui/badge'

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

const PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function RecurringPostsPage() {
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
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1400px] mx-auto space-y-8">
        <ToastContainer />

        <header className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
            <Repeat size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="ds-text-h1 text-theme-primary leading-none">{t('recurringPage.title')}</h1>
            <p className="ds-text-caption mt-1">{t('recurringPage.subtitle')}</p>
          </div>
        </header>

        <section className="ds-surface-card p-5 sm:p-6">
          <h2 className="ds-text-h3 text-theme-primary mb-5">{t('recurringPage.createHeading')}</h2>
          <form onSubmit={submit} className="space-y-5">
            <FormField label={t('recurringPage.platform')}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {PLATFORMS.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => setForm((f) => ({ ...f, platform: p.id }))}
                    aria-pressed={form.platform === p.id ? 'true' : 'false'}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                      form.platform === p.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input text-theme-secondary hover:bg-accent'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label={t('recurringPage.caption')} htmlFor="rec-caption">
              <Textarea id="rec-caption" value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={t('recurringPage.captionPlaceholder')}
                className="min-h-[120px]" />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label={t('recurringPage.mediaUrl')} htmlFor="rec-media">
                <Input id="rec-media" type="url" value={form.mediaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder={t('recurringPage.mediaUrlPlaceholder')} />
              </FormField>
              <FormField label={t('recurringPage.hashtags')} htmlFor="rec-tags">
                <Input id="rec-tags" type="text" value={form.hashtags}
                  onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                  placeholder={t('recurringPage.hashtagsPlaceholder')} />
              </FormField>
            </div>

            <FormField label={t('recurringPage.daysOfWeek')}>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    aria-pressed={form.daysOfWeek.includes(i) ? 'true' : 'false'}
                    className={cn(
                      'rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                      form.daysOfWeek.includes(i)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input text-theme-secondary hover:bg-accent'
                    )}
                  >{t(`recurringPage.day_${i}`) || label}</button>
                ))}
              </div>
            </FormField>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField label={t('recurringPage.timeOfDay')} htmlFor="rec-time">
                <Input id="rec-time" type="time" value={form.timeOfDay}
                  onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))} />
              </FormField>
              <FormField label={t('recurringPage.timezone')} htmlFor="rec-tz" hint={t('recurringPage.timezoneHint')}>
                <Input id="rec-tz" type="text" value={form.timezone}
                  onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
              </FormField>
            </div>

            <Button type="submit" variant="primary" loading={creating}
              leftIcon={!creating ? <Plus size={16} /> : undefined}>
              {creating ? t('recurringPage.creating') : t('recurringPage.createButton')}
            </Button>
          </form>
        </section>

        <section className="space-y-4">
          <SectionHeader as="h2" title={t('recurringPage.yourSchedules')} />
          {loading ? (
            <p className="ds-text-caption">{t('recurringPage.loading')}</p>
          ) : templates.length === 0 ? (
            <EmptyState
              className="ds-surface-card"
              icon={Calendar}
              title={t('recurringPage.emptyState')}
            />
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div key={tpl._id} className="ds-surface-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="secondary">{platformLabel(tpl.platform)}</Badge>
                      <Badge
                        variant="secondary"
                        className={tpl.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : undefined}
                      >
                        {tpl.active ? t('recurringPage.active') : t('recurringPage.paused')}
                      </Badge>
                    </div>
                    <p className="text-sm truncate font-medium text-theme-primary">{tpl.content.text || tpl.content.mediaUrl || t('recurringPage.noContent')}</p>
                    <div className="flex items-center gap-4 ds-text-caption mt-2 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar size={12} />{t('recurringPage.cadenceSummary', { days: tpl.cadence.daysOfWeek.map((d) => t(`recurringPage.day_${d}`) || DAY_LABELS[d]).join('/'), time: tpl.cadence.timeOfDay, timezone: tpl.cadence.timezone })}</span>
                      <span>{t('recurringPage.next', { value: formatNext(tpl.nextFireAt) })}</span>
                      <span>{t('recurringPage.firedCount', { count: tpl.fireCount })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => togglePause(tpl)}
                      aria-label={tpl.active ? t('recurringPage.pause') : t('recurringPage.resume')}
                      title={tpl.active ? t('recurringPage.pause') : t('recurringPage.resume')}>
                      {tpl.active ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(tpl)}
                      aria-label={t('recurringPage.delete')} title={t('recurringPage.delete')}
                      className="text-rose-500 hover:text-rose-600">
                      <Trash2 size={16} />
                    </Button>
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
