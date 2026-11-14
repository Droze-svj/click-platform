'use client'

/**
 * LogResultsPanel — the creator tells Click how a video they posted did.
 *
 * Platform syncs only exist for accounts connected through each platform's API.
 * A creator who exports from Click and posts by hand had no way to feed the
 * numbers back, so the learning loop never learned from those videos. This
 * panel writes to POST /api/post-results; the 6-hourly learning pass then
 * weighs that video's hook, captions and pacing by how it did against the
 * creator's own typical views.
 */

import React, { useCallback, useEffect, useId, useState } from 'react'
import { TrendingUp, Trash2, Link as LinkIcon } from 'lucide-react'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '@/lib/utils'
import { Button, FormField, IconButton, Input, Panel, SectionHeader } from '@/components/ui'

interface VideoOption { _id: string; title?: string }

export interface LoggedResult {
  id: string
  contentId: string
  title: string | null
  platform: string
  postedAt: string
  postUrl: string | null
  source: 'manual' | 'platform'
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  avgWatchPercent: number | null
  learnedAt: string | null
  vsTypical: number | null
}

interface Comparison { medianViews: number | null; ratio: number | null; sampleSize: number; needMorePosts: number }

const PLATFORMS: Array<[string, string]> = [
  ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube'],
  ['facebook', 'Facebook'], ['twitter', 'X'], ['linkedin', 'LinkedIn'],
  ['threads', 'Threads'], ['pinterest', 'Pinterest'], ['snapchat', 'Snapchat'],
]
const platformLabel = (p: string) => PLATFORMS.find(([k]) => k === p)?.[1] || p

const fmt = (n: number) => new Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n)

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T

function errorMessage(err: any, fallback: string): string {
  const m = err?.response?.data?.error || err?.response?.data?.message
  return typeof m === 'string' && m ? m : fallback
}

const EMPTY = { contentId: '', platform: 'tiktok', views: '', likes: '', comments: '', shares: '', saves: '', avgWatchPercent: '', postUrl: '' }

export function LogResultsPanel({ onLogged }: { onLogged?: () => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [videos, setVideos] = useState<VideoOption[]>([])
  const [results, setResults] = useState<LoggedResult[]>([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ title: string; platform: string; views: number; comparison: Comparison } | null>(null)

  const load = useCallback(async () => {
    const [v, r] = await Promise.allSettled([
      apiGet<any>('/video?limit=100'),
      apiGet<any>('/post-results'),
    ])
    if (v.status === 'fulfilled') {
      const list = unwrap<VideoOption[]>(v.value)
      setVideos(Array.isArray(list) ? list.filter((x) => x && x._id) : [])
    }
    if (r.status === 'fulfilled') {
      const data = unwrap<{ results?: LoggedResult[] }>(r.value)
      setResults(Array.isArray(data?.results) ? data.results : [])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.contentId) { setError(t('postResults.errorPickVideo')); return }
    if (!(Number(form.views) > 0)) { setError(t('postResults.errorViews')); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = { contentId: form.contentId, platform: form.platform, views: Number(form.views) }
      for (const k of ['likes', 'comments', 'shares', 'saves', 'avgWatchPercent'] as const) {
        if (form[k] !== '') body[k] = Number(form[k])
      }
      if (form.postUrl.trim()) body.postUrl = form.postUrl.trim()
      const res = unwrap<{ result: LoggedResult; comparison: Comparison }>(await apiPost<any>('/post-results', body))
      const title = videos.find((v) => v._id === form.contentId)?.title || t('postResults.untitled')
      setFeedback({ title, platform: form.platform, views: Number(form.views), comparison: res.comparison })
      setForm((f) => ({ ...EMPTY, platform: f.platform }))
      await load()
      onLogged?.()
    } catch (err) {
      setError(errorMessage(err, t('postResults.errorSave')))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: LoggedResult) => {
    try {
      await apiDelete(`/post-results/${encodeURIComponent(r.id)}`)
      setResults((list) => list.filter((x) => x.id !== r.id))
      onLogged?.()
    } catch (err) {
      setError(errorMessage(err, t('postResults.errorDelete')))
    }
  }

  const field = (k: 'likes' | 'comments' | 'shares' | 'saves', label: string) => (
    <FormField label={label} htmlFor={`${id}-${k}`}>
      <Input id={`${id}-${k}`} type="number" inputMode="numeric" min={0} step={1} value={form[k]} onChange={set(k)} />
    </FormField>
  )

  return (
    <Panel variant="bento" className="ds-anim-rise mb-6 p-5 sm:p-6">
      <SectionHeader
        as="h2"
        title={t('postResults.title')}
        description={t('postResults.subtitle')}
        className="mb-5"
      />

      <form onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <FormField label={t('postResults.video')} htmlFor={`${id}-video`} required>
            <select
              id={`${id}-video`}
              value={form.contentId}
              onChange={set('contentId')}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">{videos.length ? t('postResults.pickVideo') : t('postResults.noVideos')}</option>
              {videos.map((v) => (
                <option key={v._id} value={v._id}>{v.title || t('postResults.untitled')}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('postResults.platform')} htmlFor={`${id}-platform`} required>
            <select
              id={`${id}-platform`}
              value={form.platform}
              onChange={set('platform')}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {PLATFORMS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <FormField label={t('postResults.views')} htmlFor={`${id}-views`} required>
            <Input id={`${id}-views`} type="number" inputMode="numeric" min={1} step={1} value={form.views} onChange={set('views')} />
          </FormField>
          {field('likes', t('postResults.likes'))}
          {field('comments', t('postResults.comments'))}
          {field('shares', t('postResults.shares'))}
          {field('saves', t('postResults.saves'))}
          <FormField label={t('postResults.avgWatched')} htmlFor={`${id}-watch`} hint={t('postResults.avgWatchedHint')}>
            <Input id={`${id}-watch`} type="number" inputMode="decimal" min={0} max={100} step={0.1} value={form.avgWatchPercent} onChange={set('avgWatchPercent')} />
          </FormField>
        </div>

        <FormField label={t('postResults.link')} htmlFor={`${id}-url`} hint={t('postResults.linkHint')}>
          <Input id={`${id}-url`} type="url" inputMode="url" placeholder="https://" value={form.postUrl} onChange={set('postUrl')} />
        </FormField>

        {error && <p role="alert" className="text-sm font-medium text-rose-500">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="ds-text-caption text-theme-muted">{t('postResults.whereToFind')}</p>
          <Button type="submit" variant="primary" size="md" loading={saving} className="sm:shrink-0">
            {t('postResults.save')}
          </Button>
        </div>
      </form>

      {feedback && (
        <div role="status" className="mt-5 flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <TrendingUp size={18} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-theme-primary [overflow-wrap:anywhere]">
              {t('postResults.savedFor', { title: feedback.title, platform: platformLabel(feedback.platform) })}
            </p>
            <p className="mt-1 text-theme-secondary">
              {feedback.comparison?.ratio != null && feedback.comparison.medianViews != null
                ? t('postResults.comparedToTypical', {
                    ratio: feedback.comparison.ratio.toFixed(1),
                    typical: fmt(feedback.comparison.medianViews),
                    platform: platformLabel(feedback.platform),
                  })
                : t('postResults.needMore', {
                    count: String(feedback.comparison?.needMorePosts ?? 3),
                    platform: platformLabel(feedback.platform),
                  })}
            </p>
            <p className="mt-1 text-theme-muted">{t('postResults.learningNote')}</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="ds-text-label text-theme-primary mb-2">{t('postResults.recentTitle')}</h3>
          <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {results.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="ds-text-label text-theme-primary truncate">{r.title || t('postResults.untitled')}</p>
                  <p className="ds-text-caption flex flex-wrap items-center gap-x-2">
                    <span>{platformLabel(r.platform)}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{t('postResults.viewsCount', { count: fmt(r.views) })}</span>
                    {r.avgWatchPercent != null && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{t('postResults.watchedCount', { pct: String(r.avgWatchPercent) })}</span>
                      </>
                    )}
                    {r.postUrl && (
                      <a href={r.postUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-500 hover:underline">
                        <LinkIcon size={11} aria-hidden />{t('postResults.openPost')}
                      </a>
                    )}
                  </p>
                </div>
                {r.vsTypical != null && (
                  <span
                    className={cn(
                      'shrink-0 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums',
                      r.vsTypical >= 1.2 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : r.vsTypical <= 0.8 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-surface-100 text-theme-secondary dark:bg-white/5',
                    )}
                    title={t('postResults.vsTypicalHint')}
                  >
                    {t('postResults.vsTypical', { ratio: r.vsTypical.toFixed(1) })}
                  </span>
                )}
                {r.source === 'manual' && (
                  <IconButton variant="ghost" size="sm" aria-label={t('postResults.remove')} onClick={() => remove(r)}>
                    <Trash2 size={14} aria-hidden />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

export default LogResultsPanel
