'use client'

import { useState, useEffect } from 'react'
import { Star, Download, Share2, Trash2, Play, Sparkles, Check, Send, Crop, Loader2 } from 'lucide-react'
import { apiPost, apiDelete } from '../../lib/api'

function CheckIcon() {
  return <Check className="w-3.5 h-3.5 text-white" />
}

/**
 * Pretty-print a recommended publish slot ISO timestamp into the compact
 * "Today 7pm" / "Tomorrow 8am" / "Tue 7pm" form used on the card preview.
 * Mirrors slotLabel() in SchedulePublishDrawer so both surfaces speak the
 * same language. Returns the raw iso if it's unparseable.
 */
function formatSlot(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const hour = d.getHours()
  const ap = hour < 12 ? 'am' : 'pm'
  const h12 = ((hour + 11) % 12) + 1
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `Today ${h12}${ap}`
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${h12}${ap}`
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  return `${day} ${h12}${ap}`
}

export interface Clip {
  id: string
  contentId: string
  url: string
  thumbnail: string | null
  duration: number
  caption: string
  platform: string
  highlight?: string | null
  style?: string
  viralScore?: number | null
  hookScore?: number | null
  hookText?: string | null
  sentimentEnergy?: number | null
  viralMomentCount?: number | null
  rating?: number | null
  editsApplied?: string[]
  createdAt?: string | null
  parentTitle?: string
  stylePresetId?: string | null
  stylePresetLabel?: string | null
  variationId?: string | null
  variationLabel?: string | null
  variationIndex?: number | null
  variationsInPreset?: number | null
  published?: boolean
  publishedAt?: string | null
  folder?: { id: string; name: string; color: string } | null
  captions?: Array<{
    start: number;
    end: number;
    text: string;
    /** Optional per-word timings + emphasis hints — when present the
     *  lightbox renders kinetic / animated captions where each word
     *  pops in on its `start` boundary instead of a static block. */
    words?: Array<{ word: string; start: number; end: number; emphasis?: 'pop' | null }>;
    style?: string | null;
  }>
  // Smart Publish suggestions written by smartPublishService at edit time.
  // The drawer uses these as editable defaults; deltas feed the learning loop.
  recommendedCaptions?: { tiktok?: string; shorts?: string; reels?: string; x?: string } | null
  // Up to 3 distinct caption angles per platform — drawer surfaces an
  // A/B/C picker so the user can choose between curiosity-gap, value,
  // and contrarian framings instead of being locked into [0].
  recommendedCaptionVariants?: { tiktok?: string[]; shorts?: string[]; reels?: string[]; x?: string[] } | null
  recommendedHashtags?: { tiktok?: string[]; shorts?: string[]; reels?: string[]; x?: string[] } | null
  recommendedSlots?: Array<{ platform: string; isoTime: string; score: number; confidence: string; reason: string }>
  publishRationale?: string | null
}

interface Props {
  clip: Clip
  onChange?: (next: Clip) => void
  onRemoved?: (id: string) => void
  /** When provided, clicking the card body opens the lightbox at this index. */
  onOpen?: () => void
  /** Multi-select state — when undefined, the checkbox is hidden. */
  selected?: boolean
  onToggleSelect?: () => void
}

const STYLE_LABELS: Record<string, string> = {
  modern: 'Modern',
  bold: 'Bold',
  minimal: 'Minimal',
  tiktok: 'TikTok',
  neon: 'Neon',
}

function scoreColor(s: number | null | undefined) {
  if (s == null) return 'text-slate-400 bg-white/5 border-white/10'
  if (s >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  if (s >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (s >= 50) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
}

function scoreLabel(s: number | null | undefined) {
  if (s == null) return 'Unrated'
  if (s >= 85) return 'A+ Viral'
  if (s >= 70) return 'A — Strong'
  if (s >= 50) return 'B — Solid'
  return 'C — Below'
}

function formatDuration(s: number) {
  if (!Number.isFinite(s) || s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function ClipCard({ clip, onChange, onRemoved, onOpen, selected, onToggleSelect }: Props) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Track image-load failures so a broken thumbnail URL collapses to the
  // Sparkles placeholder instead of rendering the <img>'s alt text on top
  // of the score chip. Reset whenever the URL changes.
  const [thumbBroken, setThumbBroken] = useState(false)
  useEffect(() => { setThumbBroken(false) }, [clip.thumbnail])

  // Multi-aspect-ratio export state. `aspectExports` holds the result the
  // server returns (array of { ratio, url, label, resolution, size }) so we
  // can render a per-ratio download list once the export completes.
  const [aspectBusy, setAspectBusy] = useState(false)
  const [aspectOpen, setAspectOpen] = useState(false)
  const [aspectExports, setAspectExports] = useState<Array<{ ratio: string; url: string; label: string; resolution: string; size: number }>>([])

  const runAspectExport = async () => {
    if (aspectBusy) return
    setAspectBusy(true)
    setAspectOpen(true)
    setAspectExports([])
    try {
      const res: any = await apiPost('/video/ai-editing/export-aspect-ratios', {
        videoId: clip.contentId,
        aspectRatios: ['9:16', '1:1', '16:9'],
      })
      const data = res?.data || res
      const exports = data?.exports || data?.data?.exports || []
      setAspectExports(Array.isArray(exports) ? exports : [])
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toast', { detail: {
          message: `Generated ${exports.length} aspect-ratio version${exports.length === 1 ? '' : 's'}`,
          type: 'success',
        }}))
      }
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toast', { detail: {
          message: `Multi-ratio export failed: ${err?.message || 'unknown error'}`,
          type: 'error',
        }}))
      }
      setAspectOpen(false)
    } finally {
      setAspectBusy(false)
    }
  }

  const setRating = async (value: number) => {
    if (busy) return
    setBusy(true)
    const previous = clip.rating
    onChange?.({ ...clip, rating: value })
    try {
      await apiPost(`/video/clips/${clip.contentId}/${clip.id}/rate`, { rating: value })
    } catch (_) {
      onChange?.({ ...clip, rating: previous ?? null })
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (busy || clip.published) return
    setBusy(true)
    onChange?.({ ...clip, published: true, publishedAt: new Date().toISOString() })
    try {
      const res: any = await apiPost(`/video/clips/${clip.contentId}/${clip.id}/publish`, {})
      const data = res?.data || res
      if (data?.learned && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toast', { detail: {
          message: `Published. Click learned this style is yours.`,
          type: 'success',
        }}))
      }
    } catch (_) {
      onChange?.({ ...clip, published: false, publishedAt: null })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    setBusy(true)
    try {
      await apiDelete(`/video/clips/${clip.contentId}/${clip.id}`)
      onRemoved?.(clip.id)
    } catch (_) {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const share = async () => {
    if (typeof navigator === 'undefined') return
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.parentTitle || 'Click clip', url: clip.url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(clip.url)
      }
    } catch (_) { /* user cancelled */ }
  }

  return (
    <article className={`group rounded-3xl border transition-all overflow-hidden flex flex-col ${selected ? 'border-indigo-500 bg-indigo-500/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/30'}`}>
      {/* Preview */}
      <div className="relative aspect-[9/16] bg-black overflow-hidden">
        {clip.thumbnail && !thumbBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail}
            alt=""
            onError={() => setThumbBroken(true)}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          // Either no thumbnail URL was set OR the URL failed to load — show
          // the gradient + Sparkles placeholder instead of the broken-image
          // icon (which leaks the alt text on top of the score chip).
          <div className="w-full h-full bg-gradient-to-br from-indigo-900/40 to-fuchsia-900/40 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white/30" />
          </div>
        )}
        {/* Selection checkbox — only renders when selection is enabled by
             the parent (multi-select mode). Sits in the corner so it doesn't
             interfere with playback affordance. */}
        {onToggleSelect && (
          <button
           type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
            title={selected ? 'Deselect' : 'Select'}
            aria-label={selected ? 'Deselect clip' : 'Select clip'}
            className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-500 border-indigo-300' : 'bg-black/40 border-white/40 hover:border-white opacity-0 group-hover:opacity-100'}`}
          >
            {selected && <CheckIcon />}
          </button>
        )}
        <button
         type="button"
          onClick={onOpen}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors"
          aria-label="Open clip"
        >
          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-2xl" fill="currentColor" />
        </button>

        {/* Score chip */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full border backdrop-blur-md text-[10px] font-black uppercase tracking-widest tabular-nums ${scoreColor(clip.viralScore)}`}>
          {scoreLabel(clip.viralScore)}{clip.viralScore != null ? ` · ${clip.viralScore}` : ''}
        </div>

        {/* Duration chip */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-black text-white tabular-nums">
          {formatDuration(clip.duration)}
        </div>

        {/* Style chip — preset label takes priority over caption style.
             When the clip has a variation tag we append it ("MrBeast Energy
             · Big Stakes"), and show the position within the variation set
             (e.g. 2/3) so users see they're getting distinct angles. */}
        {(clip.stylePresetLabel || clip.style) && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-[9px] font-black text-white uppercase tracking-widest max-w-[calc(100%-1rem)] truncate">
            {clip.stylePresetLabel || STYLE_LABELS[clip.style!] || clip.style}
            {clip.variationLabel && (
              <span className="text-white/70"> · {clip.variationLabel}</span>
            )}
          </div>
        )}
        {/* Folder badge — shown when not grouped by source, so the user
             can see which folder/project this clip belongs to in the flat list. */}
        {clip.folder && (
          <div className="absolute bottom-9 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[8px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[120px]">
            {clip.folder.name}
          </div>
        )}
        {/* Variation chip — sits just below the score chip in the top-left
             stack so the two never overlap. Only renders when the preset
             actually emitted multiple angles. */}
        {typeof clip.variationIndex === 'number' && typeof clip.variationsInPreset === 'number' && clip.variationsInPreset > 1 && (
          <div className="absolute top-9 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-[9px] font-black text-white tabular-nums">
            Angle {clip.variationIndex + 1}/{clip.variationsInPreset}
          </div>
        )}

        {/* Picked / Published badge — surfaces the pick-and-learn signal so
             the user can see at a glance which clips trained their style. */}
        {clip.published && (
          <div className="absolute top-2 right-9 px-2 py-0.5 rounded-md bg-emerald-500/85 backdrop-blur-md border border-emerald-300 text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1">
            <Check className="w-3 h-3" /> Picked
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <p className="text-sm font-bold text-white leading-snug line-clamp-3 break-words">
          {clip.caption || clip.highlight || 'Untitled clip'}
        </p>

        {/* Smart Publish suggestion preview — when smartPublishService has
             populated this clip with a recommended slot or caption, surface
             a quiet hint so users see the AI's plan without opening the
             lightbox. Hides cleanly when no suggestion exists. */}
        {(() => {
          const topSlot = Array.isArray(clip.recommendedSlots) && clip.recommendedSlots.length > 0
            ? clip.recommendedSlots[0]
            : null
          if (!topSlot && !clip.recommendedCaptions) return null
          const slotLabel = topSlot ? formatSlot(topSlot.isoTime) : null
          const platform = topSlot?.platform || 'tiktok'
          const suggestedCaption = clip.recommendedCaptions?.[platform as keyof typeof clip.recommendedCaptions]
          return (
            <div className="rounded-lg bg-indigo-500/[0.08] border border-indigo-500/20 px-2.5 py-2 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-2.5 h-2.5" />
                AI plan{slotLabel ? ` · ${slotLabel}` : ''}
              </p>
              {suggestedCaption && (
                <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 italic break-words">
                  "{suggestedCaption}"
                </p>
              )}
            </div>
          )
        })()}

        {clip.editsApplied && clip.editsApplied.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.editsApplied.slice(0, 3).map((edit, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {edit}
              </span>
            ))}
          </div>
        )}

        {/* Rating row */}
        <div className="flex items-center gap-1 mt-auto pt-2 border-t border-white/5">
          {[1, 2, 3, 4, 5].map(n => {
            const filled = (clip.rating || 0) >= n
            return (
              <button type="button"
                key={n}
                onClick={() => setRating(n)}
                disabled={busy}
                title={filled ? `Currently rated ${n} star${n === 1 ? '' : 's'}` : `Rate ${n} star${n === 1 ? '' : 's'}`}
                aria-label={filled ? `Currently rated ${n} star${n === 1 ? '' : 's'} — click to re-rate` : `Rate ${n} star${n === 1 ? '' : 's'}`}
                className="p-0.5 hover:scale-125 transition-transform disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded"
              >
                <Star className={`w-3.5 h-3.5 ${filled ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
              </button>
            )
          })}
          <div className="flex-1" />
          <button
           type="button"
            onClick={publish}
            disabled={busy || clip.published}
            title={clip.published ? 'Already picked — Click is learning from it' : 'Pick as best (publishes + trains your style)'}
            aria-label={clip.published ? 'Already picked as best' : 'Pick as best clip'}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${clip.published ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10'}`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <a
            href={clip.url}
            download
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Download"
            aria-label="Download clip"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
          <button
           type="button"
            onClick={share}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Share"
            aria-label="Share clip"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {/* One-tap multi-aspect-ratio export. Re-renders the source into
              9:16 + 1:1 + 16:9 so the creator can post the same clip
              everywhere without re-uploading. The competitive moat
              competitors (Opus Clip, Klap) charge for. */}
          <div className="relative">
            <button
              type="button"
              onClick={runAspectExport}
              disabled={aspectBusy}
              className="p-1.5 rounded-lg hover:bg-fuchsia-500/10 text-slate-400 hover:text-fuchsia-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 disabled:opacity-50"
              title="Export to 9:16 + 1:1 + 16:9"
              aria-label="Export in multiple aspect ratios"
            >
              {aspectBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crop className="w-3.5 h-3.5" />}
            </button>
            {aspectOpen && (
              <div
                role="dialog"
                aria-label="Aspect ratio exports"
                className="absolute right-0 top-full mt-2 z-30 w-[260px] rounded-2xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur-2xl shadow-2xl p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400">Aspect Ratios</span>
                  <button
                    type="button"
                    onClick={() => setAspectOpen(false)}
                    aria-label="Close"
                    className="w-5 h-5 rounded text-slate-500 hover:text-white text-xs"
                  >✕</button>
                </div>
                {aspectBusy && (
                  <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />
                    Generating 3 ratios… ~30s
                  </div>
                )}
                {!aspectBusy && aspectExports.length === 0 && (
                  <div className="px-2 py-3 text-[11px] text-slate-500">
                    No exports yet. Click <Crop className="inline w-3 h-3" /> to start.
                  </div>
                )}
                {!aspectBusy && aspectExports.length > 0 && (
                  <div className="space-y-1.5">
                    {aspectExports.map((ex) => (
                      <a
                        key={ex.ratio}
                        href={ex.url}
                        download
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/[0.04] hover:bg-fuchsia-500/10 border border-white/5 hover:border-fuchsia-500/30 transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-white truncate">{ex.ratio}</div>
                          <div className="text-[9px] text-slate-500 truncate">{ex.label}</div>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-fuchsia-300" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
           type="button"
            onClick={() => confirmDelete ? remove() : setConfirmDelete(true)}
            onMouseLeave={() => setConfirmDelete(false)}
            disabled={busy}
            className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 ${confirmDelete ? 'bg-rose-500/20 text-rose-400' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
            title={confirmDelete ? 'Click again to delete' : 'Delete'}
            aria-label={confirmDelete ? 'Confirm delete clip' : 'Delete clip'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}
