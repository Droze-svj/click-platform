'use client'

/**
 * AI Tools Hub — surfaces every advanced editing capability Click ships
 * with as a single discoverable gallery. Each card either:
 *   - links into an existing dashboard surface (editor, forge, captions)
 *   - hits a wrapper endpoint at /api/video/tools/* with a videoId picker
 *   - kicks off the auto-edit pipeline with the right preset
 *
 * Goal: zero clicks of "where do I find this feature" friction.
 */

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Scissors, Music, Zap, Bot, Wand2,
  Subtitles, Type, Sparkles, Video, FileText, Loader2, X
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'

interface Tool {
  id: string
  title: string
  blurb: string
  icon: any
  accent: string
  /** Either a dashboard route OR a backend operation */
  link?: string
  op?: 'remove-silence' | 'remove-fillers' | 'edit-by-text'
  /** What the user will see when they pick a video for this op */
  cta: string
}

const TOOLS: Tool[] = [
  {
    id: 'remove-silence',
    title: 'AI Pause & Silence Remover',
    blurb: 'Detects silent gaps in your recording and tightens the cut. Three pacing levels: gentle / medium / aggressive.',
    icon: Scissors,
    accent: 'from-amber-500/30 to-amber-700/10 text-amber-300 border-amber-500/30',
    op: 'remove-silence',
    cta: 'Pick a video',
  },
  {
    id: 'remove-fillers',
    title: 'Cut Recording Mistakes',
    blurb: 'Strips "um / uh / like / you know" plus dead air. One-click clean-up powered by the auto-edit pipeline.',
    icon: Wand2,
    accent: 'from-rose-500/30 to-rose-700/10 text-rose-300 border-rose-500/30',
    op: 'remove-fillers',
    cta: 'Pick a video',
  },
  {
    id: 'long-to-short',
    title: 'Long → Viral Short Clips',
    blurb: 'Auto-edit converts long-form footage into multiple platform-ready vertical clips, ranked by predicted virality.',
    icon: Zap,
    accent: 'from-indigo-500/30 to-indigo-700/10 text-indigo-300 border-indigo-500/30',
    link: '/dashboard/forge',
    cta: 'Open AI Video Creator',
  },
  {
    id: 'background-music',
    title: 'Add Background Music',
    blurb: 'Auto-pick from a curated music library or generate AI music sized to your clip. Beat-synced cuts and ducking included.',
    icon: Music,
    accent: 'from-emerald-500/30 to-emerald-700/10 text-emerald-300 border-emerald-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'background-removal',
    title: 'AI Background Removal & Effects',
    blurb: 'Chroma key, masking, motion graphics, color curves, EQ + ducking. Full effects suite in the manual editor.',
    icon: Bot,
    accent: 'from-fuchsia-500/30 to-fuchsia-700/10 text-fuchsia-300 border-fuchsia-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'blog-to-reel',
    title: 'Blog / Video → Marketing Reel',
    blurb: 'Paste a blog post or drop a video — Click drafts platform-specific reels, captions, and hashtags in one pass.',
    icon: FileText,
    accent: 'from-cyan-500/30 to-cyan-700/10 text-cyan-300 border-cyan-500/30',
    link: '/dashboard/content',
    cta: 'Open Content AI',
  },
  {
    id: 'captions',
    title: 'Auto Subtitles + Online Editor',
    blurb: 'Whisper-grade transcription, multi-language captions, word-level timing, and an inline editor that syncs to playback.',
    icon: Subtitles,
    accent: 'from-sky-500/30 to-sky-700/10 text-sky-300 border-sky-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
  {
    id: 'edit-by-text',
    title: 'Edit by Editing Text',
    blurb: 'Descript-style. Click words in the transcript to keep or drop them — the video re-cuts to match.',
    icon: Type,
    accent: 'from-violet-500/30 to-violet-700/10 text-violet-300 border-violet-500/30',
    op: 'edit-by-text',
    cta: 'Pick a video',
  },
  {
    id: 'cinematic',
    title: '3D Style & Cinematic Effects',
    blurb: 'Cinematic color grade, film grain, 3D tilt/zoom, motion-blur, beat-synced transitions. Apply per-clip from the editor.',
    icon: Sparkles,
    accent: 'from-orange-500/30 to-orange-700/10 text-orange-300 border-orange-500/30',
    link: '/dashboard/video',
    cta: 'Open Video Editor',
  },
]

interface ContentItem { _id: string; title?: string; originalFile?: { url?: string; duration?: number } }

export default function ToolsHubPage() {
  const router = useRouter()
  const [activeOp, setActiveOp] = useState<Tool | null>(null)
  const [videos, setVideos] = useState<ContentItem[]>([])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keepRanges, setKeepRanges] = useState<string>('')

  useEffect(() => {
    if (!activeOp) return
    setError(null)
    setResultUrl(null)
    apiGet<any>('/video/recent?limit=20')
      .then((res) => {
        const list: ContentItem[] = res?.data?.items || res?.items || res?.videos || []
        setVideos(Array.isArray(list) ? list : [])
      })
      .catch(() => setVideos([]))
  }, [activeOp])

  const closeModal = () => {
    setActiveOp(null)
    setPickedId(null)
    setResultUrl(null)
    setError(null)
    setKeepRanges('')
    setBusy(false)
  }

  const runOp = async () => {
    if (!activeOp || !pickedId) return
    setBusy(true)
    setError(null)
    setResultUrl(null)
    try {
      const body: any = { videoId: pickedId }
      if (activeOp.op === 'edit-by-text') {
        // Parse "0,3.5  6.2,12  20,28" or "0-3.5,6.2-12,20-28" → [[0,3.5],[6.2,12],[20,28]]
        const parsed = keepRanges
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.split(/[\s\-]+/).map(Number))
          .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > p[0])
        if (parsed.length === 0) {
          setError('Enter at least one keep range like "0-3.5" or "10,18"')
          setBusy(false)
          return
        }
        body.keepRanges = parsed
      }
      const res: any = await apiPost(`/video/tools/${activeOp.op}`, body)
      const url = res?.data?.url || res?.url
      if (!url) throw new Error('No output URL returned')
      setResultUrl(url)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen px-8 md:px-16 py-12 max-w-[1500px] mx-auto">
      <header className="mb-12">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 italic mb-3">AI Tools Hub</p>
        <h1 className="text-5xl md:text-6xl font-black text-[var(--text-main)] tracking-tight italic uppercase leading-none mb-4">
          Every advanced tool, one place.
        </h1>
        <p className="text-lg text-[var(--text-dim)] max-w-3xl">
          Silence cutting, filler removal, viral clip extraction, captions, music, background removal, cinematic
          grading, blog-to-reel, and Descript-style text editing. Click ships them all — pick one and run it on
          any of your uploaded videos.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const card = (
            <div className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-7 h-full flex flex-col transition-all hover:border-white/30 hover:-translate-y-1 hover:shadow-2xl`}>
              <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${t.accent} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
              <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${t.accent} border flex items-center justify-center mb-5 shadow-lg`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-black text-[var(--text-main)] tracking-tight mb-2 leading-tight">{t.title}</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-6 flex-1">{t.blurb}</p>
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                {t.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )
          return t.link ? (
            <Link key={t.id} href={t.link}>{card}</Link>
          ) : (
            <button key={t.id} onClick={() => setActiveOp(t)} className="text-left">{card}</button>
          )
        })}
      </div>

      {/* Op runner modal */}
      {activeOp && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="w-full max-w-xl bg-[#0d0d10] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Run tool</p>
                <h2 className="text-lg font-black text-white tracking-tight">{activeOp.title}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={closeModal} className="w-8 h-8 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pick a video</p>
                {videos.length === 0 ? (
                  <p className="text-sm text-slate-500">No videos found. Upload one first from the <Link href="/dashboard/video" className="text-indigo-400 hover:underline">Video Editor</Link>.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                    {videos.map((v) => (
                      <button key={v._id} onClick={() => setPickedId(v._id)} className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${pickedId === v._id ? 'bg-indigo-500/20' : 'hover:bg-white/5'}`}>
                        <Video className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-white truncate flex-1">{v.title || v._id}</span>
                        {pickedId === v._id && <span className="text-[10px] font-black text-indigo-400">SELECTED</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeOp.op === 'edit-by-text' && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Keep ranges (seconds)</p>
                  <textarea
                    value={keepRanges}
                    onChange={(e) => setKeepRanges(e.target.value)}
                    placeholder={'0-3.5\n6.2-12\n20-28'}
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">One range per line. Examples: <code>0-3.5</code> or <code>10,18</code>. Anything outside these ranges is dropped from the output.</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-200">{error}</div>
              )}

              {resultUrl && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200 break-all">
                  ✓ Done. Output: <a href={resultUrl} target="_blank" rel="noreferrer" className="underline">{resultUrl}</a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-white/5">Close</button>
              <button type="button" onClick={runOp} disabled={!pickedId || busy} className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white inline-flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? 'Running…' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
