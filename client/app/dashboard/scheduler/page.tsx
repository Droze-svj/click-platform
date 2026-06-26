'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost } from '../../../lib/api'
import {
  Send, Calendar, Clock,
  CheckCircle, AlertCircle, RefreshCw,
  Globe, Hash, ChevronRight, Timer, Target,
  Music, Instagram, Youtube, Twitter, Linkedin,
  type LucideIcon,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useUserSocket } from '../../../hooks/useUserSocket'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Textarea,
  FormField,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

interface ScheduledPost {
  _id: string
  platform: string
  content: { text: string; hashtags?: string[]; mediaUrl?: string }
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'draft'
}

// Verified lucide@0.294.0 icons per platform (replaces emoji-as-icon).
const PLATFORMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'tiktok',    label: 'TikTok',      icon: Music },
  { id: 'instagram', label: 'Instagram',   icon: Instagram },
  { id: 'youtube',   label: 'YouTube',     icon: Youtube },
  { id: 'twitter',   label: 'X (Twitter)', icon: Twitter },
  { id: 'linkedin',  label: 'LinkedIn',    icon: Linkedin },
]

export default function SchedulerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [queuedClipIds, setQueuedClipIds] = useState<string[]>([])

  const [form, setForm] = useState({
    platform: 'instagram',
    text: '',
    hashtags: '',
    scheduledTime: '',
    mediaUrl: '',
    accountId: null as string | null,
  })

  type PlatformAccount = {
    accountId: string
    platformUserId?: string
    platformUsername?: string | null
    avatar?: string | null
    isPrimary?: boolean
  }
  const [accountsByPlatform, setAccountsByPlatform] = useState<Record<string, PlatformAccount[]>>({})

  useEffect(() => {
    if (!searchParams) return
    const idsParam = searchParams.get('clipIds')
    if (!idsParam) return
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) return
    setQueuedClipIds(ids)
    apiGet<any>(`/video/clips/${ids[0]}`)
      .then((res: any) => {
        const c = res?.data || res
        if (!c) return
        setForm(f => ({
          ...f,
          text: c.caption || c.hookText || f.text,
          mediaUrl: c.url || c.signedUrl || f.mediaUrl,
        }))
      })
      .catch(() => { /* best-effort prefill */ })
    showToast(t(ids.length === 1 ? 'schedulerPage.toastClipPreloaded' : 'schedulerPage.toastClipsPreloaded', { count: ids.length }), 'success')
  }, [searchParams, showToast, t])

  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
  const [optimalTimes, setOptimalTimes] = useState<string[]>([])
  const [translating, setTranslating] = useState(false)
  const [userLang, setUserLang] = useState<string>('en')

  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('click-user-preferences') || '{}')
      if (prefs?.language && prefs.language !== 'en') setUserLang(prefs.language)
    } catch { /* ignore */ }
  }, [])

  const translateCaption = async () => {
    if (!form.text.trim() || userLang === 'en') return
    setTranslating(true)
    try {
      const res: any = await apiPost('/translation/translate', {
        text: form.text,
        targetLanguage: userLang,
        context: 'social_media_caption',
      })
      const translated = res?.data?.translatedText || res?.translatedText
      if (translated) setForm(f => ({ ...f, text: translated }))
    } catch {
      showToast(t('schedulerPage.toastTranslateFailed'), 'error')
    } finally {
      setTranslating(false)
    }
  }

  useEffect(() => {
    apiGet<any>('/oauth/connections')
      .then((res: any) => {
        const data = res?.accounts || res?.data?.accounts || res?.data || {}
        setAccountsByPlatform(data || {})
      })
      .catch(() => { /* best-effort */ })
  }, [])

  useEffect(() => {
    const accs = accountsByPlatform[form.platform] || []
    if (accs.length === 0) {
      if (form.accountId !== null) setForm((f) => ({ ...f, accountId: null }))
      return
    }
    const primary = accs.find((a) => a.isPrimary) || accs[0]
    if (form.accountId !== primary.accountId) {
      setForm((f) => ({ ...f, accountId: primary.accountId }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platform, accountsByPlatform])

  useEffect(() => {
    if (!form.platform) return
    apiGet<any>(`/scheduler/optimal-times?platform=${form.platform}`)
      .then((res: any) => {
        const data = res?.data || res
        const slots: string[] = []
        const wins = data?.windows?.[form.platform] || []
        wins.slice(0, 3).forEach((w: any) => {
          const iso = data?.nextSuggested?.[form.platform] || null
          if (iso && slots.length === 0) slots.push(iso)
          if (w.label && slots.length < 3) {
            const d = new Date()
            const daysAhead = (w.dayOfWeek - d.getDay() + 7) % 7 || 7
            d.setDate(d.getDate() + daysAhead)
            d.setHours(w.hour, 0, 0, 0)
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
              .toISOString().slice(0, 16)
            if (!slots.includes(local)) slots.push(local)
          }
        })
        setOptimalTimes(slots.slice(0, 3))
      })
      .catch(() => { /* best-effort */ })
  }, [form.platform])

  const loadPosts = useCallback(async () => {
    try {
      const res: any = await apiGet('/scheduler')
      setPosts(res?.data || res || [])
    } catch {
      showToast(t('schedulerPage.toastLoadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (!user) router.push('/login')
    else loadPosts()
  }, [user, router, loadPosts])

  useUserSocket((user as any)?._id || (user as any)?.id, {
    onPostStatus: (payload) => {
      setPosts(prev => prev.map(p => (
        p._id === payload.postId
          ? { ...p, status: payload.status === 'published' ? 'posted' : (payload.status === 'failed' ? 'failed' : p.status) }
          : p
      )))
      if (payload.status === 'published') {
        showToast(
          payload.url
            ? t('schedulerPage.toastLiveWithUrl', { platform: payload.platform || t('schedulerPage.platformFallback'), url: payload.url })
            : t('schedulerPage.toastPosted', { platform: payload.platform || t('schedulerPage.platformFallback') }),
          'success'
        )
      } else if (payload.status === 'failed') {
        showToast(t('schedulerPage.toastPostFailed', { platform: payload.platform || t('schedulerPage.postFallback'), error: payload.error || t('schedulerPage.unknownError') }), 'error')
      }
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.text.trim() || !form.scheduledTime) {
      showToast(t('schedulerPage.toastContentTimeRequired'), 'error')
      return
    }

    setScheduling(true)
    try {
      const hashtags = form.hashtags.split(/[\s,]+/).filter(Boolean)
      const baseTime = new Date(form.scheduledTime).getTime()

      if (queuedClipIds.length > 1) {
        await Promise.all(queuedClipIds.map((clipId, i) =>
          apiPost('/scheduler/schedule', {
            platform: form.platform,
            accountId: form.accountId || undefined,
            content: {
              text: form.text,
              hashtags,
              mediaUrl: form.mediaUrl || undefined,
            },
            contentId: clipId,
            scheduledTime: new Date(baseTime + i * 5 * 60 * 1000).toISOString(),
          })
        ))
        showToast(t('schedulerPage.toastScheduledMany', { count: queuedClipIds.length }), 'success')
      } else {
        await apiPost('/scheduler/schedule', {
          platform: form.platform,
          accountId: form.accountId || undefined,
          content: {
            text: form.text,
            hashtags,
            mediaUrl: form.mediaUrl || undefined
          },
          contentId: queuedClipIds[0] || undefined,
          scheduledTime: new Date(form.scheduledTime).toISOString()
        })
        showToast(t('schedulerPage.toastScheduled'), 'success')
      }
      setForm({ platform: 'instagram', text: '', hashtags: '', scheduledTime: '', mediaUrl: '', accountId: null })
      setQueuedClipIds([])
      loadPosts()
    } catch {
      showToast(t('schedulerPage.toastScheduleFailed'), 'error')
    } finally {
      setTimeout(() => setScheduling(false), 800)
    }
  }

  const scheduledCount = posts.filter(p => p.status === 'scheduled').length

  if (loading) return (
    <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto" aria-busy="true" aria-label={t('schedulerPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  )

  const visiblePosts = posts.filter(p =>
    activeTab === 'queue'
      ? (p.status === 'scheduled' || p.status === 'draft')
      : (p.status === 'posted' || p.status === 'failed')
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* Header (global DashboardHeader provides breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('schedulerPage.title')}
          description={t('schedulerPage.scheduledCount', { count: scheduledCount })}
          className="mb-6"
          actions={
            <>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Calendar size={16} aria-hidden />}
                onClick={() => router.push('/dashboard/calendar')}
              >
                {t('schedulerPage.openCalendar')}
              </Button>
              <IconButton
                variant="secondary"
                size="md"
                aria-label={t('schedulerPage.refreshSequences')}
                onClick={() => loadPosts()}
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden />
              </IconButton>
            </>
          }
        />

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Composer */}
          <section className="lg:col-span-5 min-w-0">
            <Panel variant="bento" className="flex flex-col">
              <div className="flex items-center gap-3 pb-5 mb-5 border-b border-[var(--border-subtle)]">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Send size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="ds-text-h3 text-theme-primary">{t('schedulerPage.newPost')}</h2>
                  <p className="ds-text-caption">{t('schedulerPage.newPostSubtitle')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                {/* Platform picker */}
                <FormField label={t('schedulerPage.platform')}>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PLATFORMS.map(p => {
                      const active = form.platform === p.id
                      const PIcon = p.icon
                      return (
                        <button type="button" key={p.id} onClick={() => setForm(f => ({ ...f, platform: p.id }))}
                          aria-label={t('schedulerPage.selectPlatform', { platform: p.label })}
                          aria-pressed={active ? true : false}
                          className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors',
                            active ? 'border-primary bg-primary/10 text-primary' : 'border-input text-theme-muted hover:bg-accent hover:text-theme-primary')}
                        >
                          <PIcon size={20} aria-hidden />
                          <span className="text-[9px] font-semibold capitalize">{p.id}</span>
                        </button>
                      )
                    })}
                  </div>
                </FormField>

                {/* Account picker */}
                {(() => {
                  const accs = accountsByPlatform[form.platform] || []
                  if (accs.length === 0) {
                    return (
                      <a
                        href={`/dashboard/social?platform=${form.platform}`}
                        className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/10"
                      >
                        <span className="capitalize">{t('schedulerPage.noAccountConnected', { platform: form.platform })}</span>
                        <span className="ds-text-label">{t('schedulerPage.connect')}</span>
                      </a>
                    )
                  }
                  if (accs.length === 1) {
                    const only = accs[0]
                    return (
                      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm font-medium text-emerald-500">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
                        <span className="truncate">{t('schedulerPage.postingAs', { account: only.platformUsername || only.accountId })}</span>
                      </div>
                    )
                  }
                  return (
                    <FormField label={t('schedulerPage.account')}>
                      <select
                        aria-label={t('schedulerPage.selectAccount', { platform: form.platform })}
                        value={form.accountId || ''}
                        onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value || null }))}
                        className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {accs.map((a) => (
                          <option key={a.accountId} value={a.accountId}>
                            {a.platformUsername || a.accountId}{a.isPrimary ? t('schedulerPage.primarySuffix') : ''}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )
                })()}

                {/* Caption */}
                <FormField
                  label={
                    <span className="flex items-center justify-between w-full">
                      {t('schedulerPage.caption')}
                      {userLang !== 'en' && form.text.trim().length > 0 && (
                        <button type="button" onClick={translateCaption} disabled={translating}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                        >
                          {translating ? <RefreshCw size={10} className="animate-spin" aria-hidden /> : <Globe size={10} aria-hidden />}
                          {translating ? t('schedulerPage.translating') : t('schedulerPage.generateIn', { lang: userLang.toUpperCase() })}
                        </button>
                      )}
                    </span>
                  }
                >
                  <Textarea
                    value={form.text}
                    onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                    placeholder={t('schedulerPage.captionPlaceholder')}
                    className="min-h-[160px]"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hashtags */}
                  <FormField label={t('schedulerPage.hashtags')}>
                    <div className="relative">
                      <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                      <Input
                        type="text" value={form.hashtags}
                        onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
                        placeholder={t('schedulerPage.hashtagsPlaceholder')}
                        className="pl-9"
                      />
                    </div>
                  </FormField>

                  {/* Scheduled time */}
                  <FormField
                    label={
                      <span className="flex items-center justify-between w-full">
                        {t('schedulerPage.temporalAnchor')}
                        {optimalTimes.length > 0 && (
                          <span className="ds-text-caption text-primary normal-case">{t('schedulerPage.bestTimes')}</span>
                        )}
                      </span>
                    }
                  >
                    {optimalTimes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {optimalTimes.map((iso, i) => {
                          const d = new Date(iso)
                          const label = d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                          const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                          return (
                            <button key={i} type="button"
                              onClick={() => setForm(f => ({ ...f, scheduledTime: localIso }))}
                              className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                            >{label}</button>
                          )
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                      <Input
                        type="datetime-local" value={form.scheduledTime}
                        onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                        aria-label={t('schedulerPage.scheduledTime')}
                        className="pl-9"
                      />
                    </div>
                    <p className="ds-text-caption flex items-center gap-1.5 mt-1.5">
                      <Globe size={11} aria-hidden />
                      {t('schedulerPage.localTimeHint', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                    </p>
                  </FormField>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  loading={scheduling}
                  leftIcon={!scheduling ? <Target size={18} aria-hidden /> : undefined}
                >
                  {scheduling ? t('schedulerPage.queueing') : t('schedulerPage.injectIntoQueue')}
                </Button>
              </form>
            </Panel>
          </section>

          {/* Queue */}
          <section className="lg:col-span-7 min-w-0 space-y-5">
            <div className="flex items-center gap-1.5 ds-surface-subtle p-1.5 w-fit">
              <button type="button" onClick={() => setActiveTab('queue')}
                className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'queue' ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary')}
              >
                {t('schedulerPage.activeQueue')}
              </button>
              <button type="button" onClick={() => setActiveTab('history')}
                className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary')}
              >
                {t('schedulerPage.archiveLogs')}
              </button>
            </div>

            {visiblePosts.length === 0 ? (
              <Panel variant="subtle" className="ds-anim-fade-in">
                <EmptyState
                  icon={Send}
                  title={t('schedulerPage.nullPayloadDetected')}
                  className="py-16"
                />
              </Panel>
            ) : (
              <div className="space-y-3">
                {visiblePosts.map((p) => {
                  const pCfg = PLATFORMS.find(pl => pl.id === p.platform) || PLATFORMS[0]
                  const PIcon = pCfg.icon
                  const statusCfg = {
                    scheduled: { label: t('schedulerPage.statusScheduled'), icon: Clock, color: 'text-indigo-500 bg-indigo-500/10' },
                    posted:    { label: t('schedulerPage.statusPublished'), icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10' },
                    failed:    { label: t('schedulerPage.statusFailed'),    icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10' },
                    draft:     { label: t('schedulerPage.statusDraft'),     icon: Timer, color: 'text-amber-500 bg-amber-500/10' },
                  }[p.status]
                  const StatusIcon = statusCfg.icon

                  return (
                    <Panel key={p._id} variant="bento" className="ds-anim-rise flex items-center gap-4">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                        <PIcon size={20} aria-hidden />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', statusCfg.color)}>
                            <StatusIcon size={11} aria-hidden /> {statusCfg.label}
                          </span>
                          <span className="ds-text-caption inline-flex items-center gap-1">
                            <Clock size={11} aria-hidden /> {new Date(p.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <h4 className="ds-text-label text-theme-primary truncate">{p.content.text}</h4>
                        {p.content.hashtags && p.content.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.content.hashtags.map(h => (
                              <span key={h} className="ds-text-caption rounded-md bg-primary/10 px-2 py-0.5 text-primary">#{h}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <IconButton variant="ghost" size="md" aria-label={t('schedulerPage.viewSequenceDetails')} className="flex-shrink-0">
                        <ChevronRight size={20} aria-hidden />
                      </IconButton>
                    </Panel>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </ErrorBoundary>
  )
}
