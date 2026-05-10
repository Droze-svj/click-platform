'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, ChevronLeft, ChevronRight, Download, Share2, Trash2, Star,
  Edit3, Zap, Flame, TrendingUp, Sparkles, Send, Check
} from 'lucide-react'
import type { Clip } from './ClipCard'
import { apiPost, apiDelete } from '../../lib/api'

interface Props {
  clips: Clip[]
  index: number
  onIndexChange: (next: number) => void
  onClose: () => void
  onClipChange?: (clip: Clip) => void
  onClipRemoved?: (id: string) => void
  onOpenInEditor?: (clip: Clip) => void
}

function scoreLabel(s: number | null | undefined) {
  if (s == null) return 'Unrated'
  if (s >= 85) return 'A+ Viral'
  if (s >= 70) return 'A — Strong'
  if (s >= 50) return 'B — Solid'
  return 'C — Below'
}

function scoreColor(s: number | null | undefined) {
  if (s == null) return 'text-slate-300'
  if (s >= 85) return 'text-emerald-400'
  if (s >= 70) return 'text-amber-400'
  if (s >= 50) return 'text-indigo-400'
  return 'text-rose-400'
}

function MetricRow({ icon: Icon, label, value, max = 100, color }: { icon: any; label: string; value: number | null | undefined; max?: number; color: string }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(max, value)) : null
  const pct = v == null ? 0 : (v / max) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Icon className={`w-3 h-3 ${color}`} />
          {label}
        </span>
        <span className={`text-sm font-black tabular-nums ${color}`}>{v == null ? '—' : v}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full transition-all ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ClipLightbox({ clips, index, onIndexChange, onClose, onClipChange, onClipRemoved, onOpenInEditor }: Props) {
  const clip = clips[index]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [busy, setBusy] = useState(false)
  // Time-synced caption layer. Backed by clip.captions (server pulls these
  // from keyMoments). Active when the current playhead is inside [start,end].
  // Renders even when the exported MP4 has no burn-in text — useful for the
  // pre-libfreetype clips and for in-app preview parity.
  const [currentTime, setCurrentTime] = useState(0)
  const activeCaption = useMemo(() => {
    const list = clip?.captions
    if (!Array.isArray(list) || list.length === 0) return null
    return list.find((c) => currentTime >= c.start && currentTime <= c.end) || null
  }, [clip, currentTime])

  // Keyboard shortcuts: ←/→ navigate, Esc close, Space play/pause.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft' && index > 0) {
        onIndexChange(index - 1)
      } else if (e.key === 'ArrowRight' && index < clips.length - 1) {
        onIndexChange(index + 1)
      } else if (e.key === ' ') {
        e.preventDefault()
        const v = videoRef.current
        if (v) v.paused ? v.play().catch(() => {}) : v.pause()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [clips.length, index, onClose, onIndexChange])

  // Reset when the clip changes — pause + seek to 0, then let the
  // onLoadedMetadata handler on the <video> kick off play() once the new
  // src has actually loaded. Calling play() here directly races the src
  // change and reliably rejects with NotSupportedError on slow setups.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    try { v.pause() } catch (_) { /* ignore */ }
    try { v.currentTime = 0 } catch (_) { /* pre-metadata */ }
  }, [clip?.id])

  const setRating = async (value: number) => {
    if (busy || !clip) return
    setBusy(true)
    const previous = clip.rating
    onClipChange?.({ ...clip, rating: value })
    try {
      await apiPost(`/video/clips/${clip.contentId}/${clip.id}/rate`, { rating: value })
    } catch (_) {
      onClipChange?.({ ...clip, rating: previous ?? null })
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (busy || !clip || clip.published) return
    setBusy(true)
    onClipChange?.({ ...clip, published: true, publishedAt: new Date().toISOString() })
    try {
      const res: any = await apiPost(`/video/clips/${clip.contentId}/${clip.id}/publish`, {})
      const data = res?.data || res
      if (data?.learned && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toast', { detail: {
          message: 'Published. Click learned this style is yours.',
          type: 'success',
        }}))
      }
    } catch (_) {
      onClipChange?.({ ...clip, published: false, publishedAt: null })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || !clip) return
    setBusy(true)
    try {
      await apiDelete(`/video/clips/${clip.contentId}/${clip.id}`)
      onClipRemoved?.(clip.id)
      // Step to next clip if there is one, otherwise close.
      if (index < clips.length - 1) onIndexChange(index)
      else if (index > 0) onIndexChange(index - 1)
      else onClose()
    } catch (_) {
      setBusy(false)
    }
  }

  const share = async () => {
    if (typeof navigator === 'undefined' || !clip) return
    try {
      if (navigator.share) await navigator.share({ title: clip.parentTitle || 'Click clip', url: clip.url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(clip.url)
    } catch (_) { /* user cancelled */ }
  }

  const reasons = useMemo<string[]>(() => {
    if (!clip) return []
    const out: string[] = []
    if ((clip.hookScore || 0) >= 80) out.push(`Strong hook (${clip.hookScore})`)
    else if ((clip.hookScore || 0) > 0 && (clip.hookScore || 0) < 50) out.push('Hook is weak — first 3s could be sharper')
    if ((clip.viralMomentCount || 0) >= 3) out.push(`${clip.viralMomentCount} viral moments detected`)
    if ((clip.sentimentEnergy || 0) >= 7) out.push('High emotional energy')
    if ((clip.duration || 0) >= 15 && (clip.duration || 0) <= 35) out.push('Ideal short-form length')
    if ((clip.editsApplied || []).includes('Remove silence')) out.push('Silence trimmed')
    return out
  }, [clip])

  if (!clip || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-10"
      onClick={onClose}
    >
      {/* Prev */}
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1) }}
          title="Previous clip"
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {/* Next */}
      {index < clips.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1) }}
          title="Next clip"
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div
        className="relative w-full max-w-5xl bg-[#0a0a0c] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/60 border border-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Video — autoplay muted so the browser autoplay policy lets it
             start without a user gesture. Source is loaded eagerly (preload
             auto) and played from the metadata-loaded event so we don't get
             a stalled black frame on slow networks. */}
        <div className="flex-1 bg-black flex items-center justify-center min-h-0 relative">
          <video
            ref={videoRef}
            src={clip.url || undefined}
            className="max-w-full max-h-[90vh] aspect-[9/16] object-contain bg-black"
            controls
            playsInline
            autoPlay
            muted
            loop
            poster={clip.thumbnail || undefined}
            preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              if (!v.error && v.paused) v.play().catch(() => { /* policy / abort */ })
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onError={() => {
              if (typeof console !== 'undefined') console.warn('[ClipLightbox] video failed to load:', clip.url)
            }}
          />
          {activeCaption && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center px-6">
              <span className="max-w-[88%] text-center text-white font-black uppercase tracking-tight text-xl md:text-2xl leading-tight px-4 py-2 rounded-md bg-black/70 [text-shadow:_0_2px_8px_rgba(0,0,0,0.9)]">
                {activeCaption.text}
              </span>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="w-full md:w-96 flex-shrink-0 flex flex-col bg-[#0a0a0c] border-t md:border-t-0 md:border-l border-white/5 overflow-y-auto">
          <div className="p-5 border-b border-white/5">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 italic mb-2">
              Clip {index + 1} of {clips.length} · {clip.parentTitle || 'Untitled'}
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-black tabular-nums leading-none ${scoreColor(clip.viralScore)}`}>
                {clip.viralScore != null ? clip.viralScore : '—'}
              </span>
              <span className={`text-xs font-black uppercase tracking-widest ${scoreColor(clip.viralScore)}`}>
                {scoreLabel(clip.viralScore)}
              </span>
            </div>
            <p className="text-sm text-white font-bold leading-snug">
              {clip.caption || 'Untitled clip'}
            </p>
            {clip.hookText && (
              <p className="text-[11px] text-slate-400 italic mt-2 leading-relaxed">
                Hook: &ldquo;{clip.hookText}&rdquo;
              </p>
            )}
          </div>

          {/* Score breakdown */}
          <div className="p-5 space-y-3 border-b border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Score breakdown</p>
            <MetricRow icon={Zap} label="Hook" value={clip.hookScore} color="text-amber-400" />
            <MetricRow icon={Flame} label="Sentiment" value={clip.sentimentEnergy != null ? clip.sentimentEnergy * 10 : null} color="text-rose-400" />
            <MetricRow icon={TrendingUp} label="Viral moments" value={clip.viralMomentCount != null ? Math.min(100, clip.viralMomentCount * 25) : null} color="text-emerald-400" />
          </div>

          {/* Why this score */}
          {reasons.length > 0 && (
            <div className="p-5 space-y-2 border-b border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Why this score</p>
              <ul className="space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                    <Sparkles className="w-3 h-3 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Edits applied */}
          {clip.editsApplied && clip.editsApplied.length > 0 && (
            <div className="p-5 space-y-2 border-b border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">AI edits applied</p>
              <div className="flex flex-wrap gap-1">
                {clip.editsApplied.map((edit, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300">
                    {edit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="p-5 space-y-2 border-b border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Your rating</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => {
                const filled = (clip.rating || 0) >= n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    disabled={busy}
                    title={`Rate ${n} star${n === 1 ? '' : 's'}`}
                    className="p-1 hover:scale-125 transition-transform disabled:opacity-50"
                  >
                    <Star className={`w-5 h-5 ${filled ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 grid grid-cols-2 gap-2 mt-auto">
            <button
              type="button"
              onClick={publish}
              disabled={busy || clip.published}
              title={clip.published ? 'Already picked — Click is learning from it' : 'Publish this clip and train Click on the style'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-default ${clip.published ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300' : 'bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-[1.02] active:scale-95'}`}
            >
              {clip.published ? <><Check className="w-3.5 h-3.5" /> Picked</> : <><Send className="w-3.5 h-3.5" /> Publish &amp; Learn</>}
            </button>
            <a
              href={clip.url}
              download
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
            {onOpenInEditor && (
              <button
                type="button"
                onClick={() => onOpenInEditor(clip)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              type="button"
              onClick={share}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
