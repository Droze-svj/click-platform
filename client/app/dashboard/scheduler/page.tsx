'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Calendar, Clock, Image as ImageIcon,
  CheckCircle, AlertCircle, RefreshCw, ArrowLeft,
  Layout, Globe, Radio, Sparkles, Hash, X, Plus,
  ChevronRight, Timer, Target, Zap, Activity
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useUserSocket } from '../../../hooks/useUserSocket'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import ClickLoadingState from '@/components/click/ClickLoadingState'

interface ScheduledPost {
  _id: string
  platform: string
  content: { text: string; hashtags?: string[]; mediaUrl?: string }
  scheduledTime: string
  status: 'scheduled' | 'posted' | 'failed' | 'draft'
}

const PLATFORMS = [
  { id: 'tiktok',    label: 'TikTok',      icon: '♪',  gradient: 'from-slate-800 to-black' },
  { id: 'instagram', label: 'Instagram',   icon: '◎',  gradient: 'from-pink-500 to-purple-600' },
  { id: 'youtube',   label: 'YouTube',     icon: '▶', gradient: 'from-red-600 to-red-800' },
  { id: 'twitter',   label: 'X (Twitter)', icon: '𝕏',  gradient: 'from-slate-700 to-slate-900' },
  { id: 'linkedin',  label: 'LinkedIn',    icon: 'in', gradient: 'from-blue-600 to-blue-800' },
]

export default function SchedulerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()

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
    // Which connected account on the selected platform to post from. Null
    // resolves to the user's primary account server-side. Surfaces as a
    // dropdown only when the platform has 2+ accounts linked.
    accountId: null as string | null,
  })

  // Per-platform connected accounts, keyed by platform id. Loaded once on
  // mount and refreshed when the user pivots platforms in the composer.
  type PlatformAccount = {
    accountId: string
    platformUserId?: string
    platformUsername?: string | null
    avatar?: string | null
    isPrimary?: boolean
  }
  const [accountsByPlatform, setAccountsByPlatform] = useState<Record<string, PlatformAccount[]>>({})

  // When arriving from the clips hub with ?clipIds=... pre-fill the form
  // so the user can hit "Inject" without retyping. This is the autonomous
  // handoff the workflow chain depends on.
  useEffect(() => {
    if (!searchParams) return
    const idsParam = searchParams.get('clipIds')
    if (!idsParam) return
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) return
    setQueuedClipIds(ids)
    // Fetch the first clip's metadata to seed caption/media. Best-effort —
    // if the fetch fails the user just gets an empty form to fill in.
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
    showToast(`✓ ${ids.length} clip${ids.length === 1 ? '' : 's'} pre-loaded from forge`, 'success')
  }, [searchParams, showToast])

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
      showToast('TRANSLATE_ERR: Translation service unavailable', 'error')
    } finally {
      setTranslating(false)
    }
  }

  // Load every platform's connected accounts up-front so the platform tiles
  // can show a "connected" dot and the composer can decide whether to show
  // the per-platform account dropdown. One call, not seven.
  useEffect(() => {
    apiGet<any>('/oauth/connections')
      .then((res: any) => {
        const data = res?.accounts || res?.data?.accounts || res?.data || {}
        setAccountsByPlatform(data || {})
      })
      .catch(() => { /* best-effort */ })
  }, [])

  // Default `accountId` to the primary of the newly-picked platform whenever
  // the user pivots. Without this, the dropdown defaulted to whatever the
  // previous platform's account id was, which the server then rejected.
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
      showToast("Could not load your scheduled posts. Retry in a moment.", 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) router.push('/login')
    else loadPosts()
  }, [user, router, loadPosts])

  // Subscribe to live post status changes so the scheduler queue updates
  // without a manual refresh when the worker publishes (or fails) a post.
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
            ? `✓ Live on ${payload.platform || 'platform'} — ${payload.url}`
            : `✓ Posted to ${payload.platform || 'platform'}`,
          'success'
        )
      } else if (payload.status === 'failed') {
        showToast(`✗ ${payload.platform || 'Post'} failed: ${payload.error || 'unknown error'}`, 'error')
      }
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.text.trim() || !form.scheduledTime) {
      showToast('PARAM_ERR: CONTENT_&_TIME_REQUIRED', 'error')
      return
    }

    setScheduling(true)
    try {
      const hashtags = form.hashtags.split(/[\s,]+/).filter(Boolean)
      const baseTime = new Date(form.scheduledTime).getTime()

      // If the user arrived from the clips hub with multiple clipIds queued,
      // fan out: one ScheduledPost per clip, staggered 5 minutes apart so
      // they don't all hit the platform at once.
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
        showToast(`Scheduled ${queuedClipIds.length} post${queuedClipIds.length === 1 ? '' : 's'} — track them in Posts.`, 'success')
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
        showToast('Post scheduled.', 'success')
      }
      setForm({ platform: 'instagram', text: '', hashtags: '', scheduledTime: '', mediaUrl: '', accountId: null })
      setQueuedClipIds([])
      loadPosts()
    } catch {
      showToast("Could not schedule that post. Try again.", 'error')
    } finally {
      setTimeout(() => setScheduling(false), 800)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-48 bg-surface-page min-h-screen transition-colors duration-500">
       <ClickLoadingState intent="loading" />
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-8 lg:px-12 pt-8 max-w-[1800px] mx-auto space-y-16 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        <ToastContainer />

        {/* Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 pb-12 border-b border-surface-100 dark:border-surface-800 relative z-50">
           <div className="flex items-center gap-8 w-full lg:w-auto">
              <button type="button" onClick={() => router.push('/dashboard')} title="Back to Dashboard" aria-label="Back to Dashboard"
                className="w-16 h-16 rounded-2xl bg-surface-card border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90 group">
                <ArrowLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg flex-shrink-0 group hover:rotate-12 transition-transform duration-500">
                <Send size={40} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em] border-2 border-primary-500/20 italic leading-none">
                      Scheduler
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-card text-surface-500 border-2 border-surface-100 dark:border-surface-800 text-[10px] font-black italic shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        {posts.filter(p => p.status === 'scheduled').length} scheduled
                    </div>
                 </div>
                 <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none mt-3 truncate uppercase italic">Scheduler</h1>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <button type="button" onClick={() => router.push('/dashboard/calendar')}
                className="px-8 py-4 bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] italic shadow-xl hover:border-primary-500/40 hover:text-primary-500 transition-all flex items-center gap-4 active:scale-95"
              >
                <Calendar size={20} /> Open Calendar
              </button>
              <button type="button" onClick={() => loadPosts()} title="Refresh Sequences" aria-label="Refresh Sequences"
                className="w-14 h-14 bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 rounded-2xl flex items-center justify-center text-surface-400 hover:text-primary-500 transition-all shadow-xl active:scale-90"
              >
                <RefreshCw size={24} className={loading ? 'animate-spin text-primary-500' : ''} />
              </button>
           </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10">
           {/* Scheduling Terminal */}
           <section className="lg:col-span-5 bg-surface-card backdrop-blur-3xl rounded-[4rem] border-2 border-surface-100 dark:border-primary-500/10 overflow-hidden shadow-2xl group transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)] flex flex-col">
              <div className="px-10 py-12 border-b-2 border-surface-100 dark:border-surface-800 flex items-center gap-8 bg-primary-500/5">
                 <div className="w-14 h-14 bg-primary-600 rounded-[1.2rem] flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform">
                   <Zap size={28} className="text-white animate-pulse" />
                 </div>
                 <div>
                    <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tighter italic uppercase leading-none mb-2">New post</h2>
                    <p className="text-[10px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.5em] italic leading-none">Pick a platform, write your caption, choose when to publish</p>
                 </div>
              </div>

              <form onSubmit={handleSubmit} className="p-10 sm:p-14 space-y-12 flex-1">
                 <div className="space-y-6">
                    <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Platform</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                       {PLATFORMS.map(p => {
                         const active = form.platform === p.id
                         const isTikTok = p.id === 'tiktok'
                         if (isTikTok) {
                           // Render as a real button that explains the "soon" state
                           // on click — silent no-ops on cards make the UI feel broken.
                           return (
                             <button
                               type="button"
                               key={p.id}
                               onClick={() => showToast('TikTok publishing is coming soon — you can already connect the account.', 'info')}
                               title="TikTok publishing coming soon — connect your account now to be ready"
                               aria-label="TikTok (coming soon)"
                               className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 text-amber-500/70 opacity-80 relative hover:opacity-100 hover:border-amber-500/50 transition-all"
                             >
                               <span className="text-2xl sm:text-3xl opacity-50 grayscale" aria-hidden="true">{p.icon}</span>
                               <span className="text-[8px] font-black uppercase tracking-widest italic">{p.id}</span>
                               <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[7px] font-black uppercase tracking-wider leading-none">SOON</span>
                             </button>
                           )
                         }
                         return (
                           <button type="button" key={p.id} onClick={() => setForm(f => ({ ...f, platform: p.id }))}
                             title={`Select ${p.label}`} aria-label={`Select ${p.label}`}
                             className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-300 group/node ${active ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-transparent shadow-2xl scale-110 z-10' : 'bg-surface-page dark:bg-surface-950 border-surface-100 dark:border-surface-800 text-surface-400 hover:border-primary-500/40'}`}
                           >
                              <span className={`text-2xl sm:text-3xl transition-transform duration-500 ${active ? 'scale-125 rotate-12' : 'opacity-40 grayscale group-hover/node:grayscale-0 group-hover/node:opacity-100 group-hover/node:scale-110'}`} aria-hidden="true">{p.icon}</span>
                              <span className="text-[8px] font-black uppercase tracking-widest italic">{p.id}</span>
                           </button>
                         )
                       })}
                    </div>
                    {/* Per-platform connected-account picker. Shows the
                        active account at all times so the user can see
                        WHICH account they're posting from; expands to a
                        dropdown only when 2+ accounts are linked. When 0
                        accounts are linked the strip becomes a "Connect"
                        prompt that deep-links into the social dashboard. */}
                    {(() => {
                      const accs = accountsByPlatform[form.platform] || []
                      if (accs.length === 0) {
                        return (
                          <a
                            href={`/dashboard/social?platform=${form.platform}`}
                            className="mt-4 flex items-center justify-between px-6 py-4 rounded-2xl border-2 border-rose-500/30 bg-rose-500/5 text-rose-500 hover:border-rose-500/60 hover:bg-rose-500/10 transition-all text-xs font-black uppercase tracking-widest italic"
                          >
                            <span>No {form.platform} account connected</span>
                            <span className="text-[10px]">Connect →</span>
                          </a>
                        )
                      }
                      if (accs.length === 1) {
                        const only = accs[0]
                        return (
                          <div className="mt-4 flex items-center gap-4 px-6 py-3 rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 text-xs font-black uppercase tracking-widest italic text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="truncate">Posting as {only.platformUsername || only.accountId}</span>
                          </div>
                        )
                      }
                      return (
                        <div className="mt-4 space-y-2">
                          <label className="text-[10px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Account</label>
                          <select
                            aria-label={`Select ${form.platform} account to post from`}
                            title={`Select ${form.platform} account to post from`}
                            value={form.accountId || ''}
                            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value || null }))}
                            className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest italic text-surface-900 dark:text-white focus:outline-none focus:border-primary-500 transition-all"
                          >
                            {accs.map((a) => (
                              <option key={a.accountId} value={a.accountId}>
                                {a.platformUsername || a.accountId}{a.isPrimary ? ' (primary)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}
                 </div>

                 <div className="space-y-6">
                    <div className="flex items-center justify-between pl-2">
                      <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic leading-none">Caption</label>
                      {userLang !== 'en' && form.text.trim().length > 0 && (
                        <button type="button" onClick={translateCaption} disabled={translating}
                          className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-500 text-[9px] font-black uppercase tracking-widest italic hover:bg-primary-500 hover:text-white transition-all disabled:opacity-40"
                        >
                          {translating ? <RefreshCw size={10} className="animate-spin" /> : <Globe size={10} />}
                          {translating ? 'Translating…' : `Generate in ${userLang.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                    <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                      placeholder="Write your caption…"
                      className="w-full h-64 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-[2.5rem] p-10 text-lg font-black text-surface-900 dark:text-white uppercase tracking-tight italic focus:outline-none focus:border-primary-500 transition-all shadow-inner resize-none backdrop-blur-xl custom-scrollbar"
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic pl-2 leading-none">Hashtags</label>
                       <div className="relative group/tag">
                          <input type="text" value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
                            placeholder="VIRAL, GROWTH, TECH..."
                            className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl pl-12 pr-6 py-5 text-xs font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:outline-none focus:border-primary-500 transition-all shadow-inner"
                          />
                          <Hash size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-300 group-focus-within/tag:text-primary-500 transition-colors" />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between pl-2">
                         <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.4em] italic leading-none">Temporal Anchor (Time)</label>
                         {optimalTimes.length > 0 && (
                           <span className="text-[9px] font-black text-primary-500 uppercase tracking-widest italic">Best times</span>
                         )}
                       </div>
                       {optimalTimes.length > 0 && (
                         <div className="flex flex-wrap gap-2">
                           {optimalTimes.map((iso, i) => {
                             const d = new Date(iso)
                             const label = d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                             const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                             return (
                               <button key={i} type="button"
                                 onClick={() => setForm(f => ({ ...f, scheduledTime: localIso }))}
                                 className="px-4 py-2 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 text-primary-500 text-[9px] font-black uppercase tracking-widest italic hover:bg-primary-500 hover:text-white transition-all active:scale-95"
                               >{label}</button>
                             )
                           })}
                         </div>
                       )}
                       <div className="relative group/time">
                          <input type="datetime-local" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                            aria-label="Scheduled time"
                            title="Scheduled time"
                            className="w-full bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-2xl pl-12 pr-6 py-5 text-xs font-black text-surface-900 dark:text-white uppercase italic tracking-widest focus:outline-none focus:border-primary-500 transition-all shadow-inner appearance-none cursor-pointer"
                          />
                          <Clock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-surface-300 group-focus-within/time:text-primary-500 transition-colors" />
                       </div>
                       <p className="text-[9px] font-black text-surface-300 dark:text-slate-700 uppercase tracking-[0.3em] italic pl-2 flex items-center gap-2">
                         <Globe size={10} />
                         {Intl.DateTimeFormat().resolvedOptions().timeZone} (your local time)
                       </p>
                    </div>
                 </div>

                 <button type="submit" disabled={scheduling}
                   className="w-full py-10 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] text-sm font-black uppercase tracking-[1em] italic shadow-[0_40px_100px_rgba(0,0,0,0.4)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all duration-500 hover:-translate-y-2 active:scale-95 border-none flex items-center justify-center gap-10 group/submit"
                 >
                   {scheduling ? <RefreshCw className="animate-spin" size={32} /> : <Target size={32} className="group-hover/submit:scale-125 group-hover/submit:rotate-12 transition-all duration-700 text-primary-500" />}
                   {scheduling ? 'QUEUEING_SEQUENCE...' : 'INJECT_INTO_QUEUE'}
                 </button>
              </form>
           </section>

           {/* Deployment Queue */}
           <section className="lg:col-span-7 space-y-10">
              <div className="flex items-center justify-between gap-10">
                 <div className="flex items-center gap-4 p-2 bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] shadow-xl">
                    <button type="button" onClick={() => setActiveTab('queue')}
                      className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest italic transition-all ${activeTab === 'queue' ? 'bg-primary-600 text-white shadow-2xl' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}
                    >
                      ACTIVE_QUEUE
                    </button>
                    <button type="button" onClick={() => setActiveTab('history')}
                      className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest italic transition-all ${activeTab === 'history' ? 'bg-primary-600 text-white shadow-2xl' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white'}`}
                    >
                      ARCHIVE_LOGS
                    </button>
                 </div>
                 <div className="hidden sm:flex items-center gap-6 text-[10px] font-black text-surface-400 uppercase tracking-[0.5em] italic opacity-60">
                    <Activity size={16} className="text-emerald-500 animate-pulse" /> LIVE_QUEUE_MONITOR
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                 <AnimatePresence mode="popLayout">
                    {posts.filter(p => activeTab === 'queue' ? (p.status === 'scheduled' || p.status === 'draft') : (p.status === 'posted' || p.status === 'failed')).length === 0 ? (
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-48 flex flex-col items-center justify-center bg-surface-card dark:bg-surface-950/30 border-4 border-dashed border-surface-100 dark:border-surface-800 rounded-[4rem] opacity-20 group/empty hover:opacity-40 transition-all duration-1000">
                          <Layout size={100} className="mb-10 text-surface-400 group-hover/empty:scale-125 transition-transform duration-1000" />
                          <p className="text-3xl font-black uppercase tracking-[0.8em] italic">NULL_PAYLOAD_DETECTED</p>
                       </motion.div>
                    ) : (
                       posts
                        .filter(p => activeTab === 'queue' ? (p.status === 'scheduled' || p.status === 'draft') : (p.status === 'posted' || p.status === 'failed'))
                        .map((p, idx) => {
                           const pCfg = PLATFORMS.find(pl => pl.id === p.platform) || PLATFORMS[0]
                           const statusCfg = {
                             scheduled: { label: 'SCHEDULED', icon: Clock, color: 'text-primary-500 bg-primary-500/10 border-primary-500/20' },
                             posted:    { label: 'PUBLISHED', icon: CheckCircle, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                             failed:    { label: 'FAILED',    icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
                             draft:     { label: 'DRAFT',     icon: Timer, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                           }[p.status]
                           const StatusIcon = statusCfg.icon

                           return (
                             <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={p._id}
                               className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-10 hover:border-primary-500/30 transition-all duration-500 group/item shadow-xl relative overflow-hidden"
                             >
                                <div className="absolute top-0 right-0 p-12 opacity-[0.01] pointer-events-none group-hover/item:opacity-[0.05] transition-opacity duration-1000"><StatusIcon size={200} /></div>
                                
                                <div className={`w-24 h-24 bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 rounded-3xl flex items-center justify-center text-3xl sm:text-5xl group-hover/item:rotate-12 group-hover/item:scale-110 transition-all duration-700 shadow-inner shrink-0 relative overflow-hidden`}>
                                   <div className={`absolute inset-0 bg-gradient-to-br ${pCfg.gradient} opacity-0 group-hover/item:opacity-20 transition-opacity duration-700`} />
                                   <span className="relative z-10">{pCfg.icon}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                   <div className="flex flex-wrap items-center gap-4 mb-4">
                                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 italic leading-none flex items-center gap-2 ${statusCfg.color}`}>
                                         <StatusIcon size={12} /> {statusCfg.label}
                                      </span>
                                      <span className="text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-widest italic leading-none flex items-center gap-2">
                                         <Clock size={12} /> {new Date(p.scheduledTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }).toUpperCase()}
                                      </span>
                                   </div>
                                   <h4 className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white tracking-tighter truncate italic uppercase group-hover/item:text-primary-500 transition-colors duration-500 leading-none mb-6">{p.content.text}</h4>
                                   <div className="flex flex-wrap gap-3">
                                      {p.content.hashtags?.map(h => <span key={h} className="text-[9px] font-black text-primary-500 bg-primary-500/10 px-3 py-1 rounded-lg border-2 border-primary-500/20 italic tracking-widest uppercase shadow-sm">#{h.toUpperCase()}</span>)}
                                   </div>
                                </div>

                                <div className="flex items-center gap-3 relative z-10">
                                   <button type="button" title="View Sequence Details" aria-label="View Sequence Details" className="w-14 h-14 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center text-surface-300 hover:text-primary-500 transition-all shadow-xl active:scale-90 group/act border-none">
                                      <ChevronRight size={24} className="group-hover/act:translate-x-1 transition-transform" />
                                   </button>
                                </div>
                             </motion.div>
                           )
                        })
                    )}
                 </AnimatePresence>
              </div>
           </section>
        </main>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
