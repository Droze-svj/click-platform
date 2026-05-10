'use client'

/**
 * SchedulePublishDrawer — pre-publish edit surface.
 *
 * The user clicks "Publish & Learn" on a clip; instead of posting
 * immediately we open this drawer with the AI-suggested caption per
 * platform and a recommended publish slot. The user reviews / edits /
 * picks a different time. On Schedule we POST the FINAL caption and time
 * to /api/video/clips/:contentId/:clipId/publish along with the
 * ORIGINALS, so the learning loop can record any delta as a signal.
 *
 * Reads:
 *   - clip.recommendedCaptions[platform] — AI-drafted caption (3 angles
 *     are stored, but the drawer surfaces only the top one for the v1 UX
 *     since editing 3 captions per platform is overload). Fallback chain:
 *     clip.recommendedCaptions[platform] → clip.caption → ''.
 *   - clip.recommendedSlots — top-N best publish slots per platform.
 *   - clip.publishRationale — one-line "why this time?" explanation.
 *
 * Posts:
 *   { platform, caption, scheduledTime, originalCaption, originalTime }
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Clock, Send, X, Sparkles, CheckCircle2, Info, Loader2 } from 'lucide-react'
import type { Clip } from './ClipCard'
import { apiPost } from '../../lib/api'

interface Props {
  open: boolean
  clip: Clip
  onClose: () => void
  onPublished?: (next: Clip) => void
}

const PLATFORMS = [
  { id: 'tiktok',  label: 'TikTok' },
  { id: 'shorts',  label: 'YouTube Shorts' },
  { id: 'reels',   label: 'Instagram Reels' },
] as const

type PlatformId = typeof PLATFORMS[number]['id']

/** ISO local datetime → "<input type=datetime-local>"-shaped string. */
function toLocalInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  // Trim seconds + timezone for the input's expected format
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Pretty-print a publish slot for the quick-pick chip label. */
function slotLabel(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  const hour = d.getHours()
  const ap = hour < 12 ? 'am' : 'pm'
  const h12 = ((hour + 11) % 12) + 1
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  if (isToday) return `Today ${h12}${ap}`
  if (isTomorrow) return `Tomorrow ${h12}${ap}`
  return `${day} ${h12}${ap}`
}

export default function SchedulePublishDrawer({ open, clip, onClose, onPublished }: Props) {
  const [platform, setPlatform] = useState<PlatformId>('tiktok')
  const [caption, setCaption] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showRationale, setShowRationale] = useState(false)
  // Snapshot the AI-suggested values at open time so we can submit them
  // as `originalCaption` / `originalTime` for delta capture.
  const [originalCaption, setOriginalCaption] = useState('')
  const [originalTime, setOriginalTime] = useState('')

  // Slot quick-picks scoped to the active platform. Falls back to ALL
  // slots if no platform-specific predictions exist.
  const slotsForPlatform = (clip.recommendedSlots || []).filter((s) => s.platform === platform)
  const allSlots = slotsForPlatform.length > 0 ? slotsForPlatform : (clip.recommendedSlots || [])

  // When platform changes (or drawer opens), seed caption + time from
  // the suggestion. Stash the originals so we can submit deltas.
  useEffect(() => {
    if (!open) return
    const suggestedCaption =
      (clip.recommendedCaptions && (clip.recommendedCaptions as any)[platform]) ||
      clip.caption || ''
    setCaption(suggestedCaption)
    setOriginalCaption(suggestedCaption)
    const topSlot = allSlots[0]
    const seedIso = topSlot?.isoTime || new Date(Date.now() + 60 * 60 * 1000).toISOString()
    setScheduledTime(toLocalInput(seedIso))
    setOriginalTime(seedIso)
    setError(null)
    setSuccess(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platform, clip.id])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleSchedule = async () => {
    if (!clip.contentId || !clip.id) {
      setError('Missing clip id — refresh and try again.')
      return
    }
    if (!caption.trim()) {
      setError('Caption is empty.')
      return
    }
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      // Submit the FINAL values + the AI-suggested ORIGINALS so the
      // learn hook can record the delta. If user kept everything as-is
      // that itself is a positive signal (preset + slot get +1).
      const finalIso = scheduledTime ? new Date(scheduledTime).toISOString() : originalTime
      const payload = {
        platform,
        caption: caption.trim(),
        scheduledTime: finalIso,
        originalCaption,
        originalTime,
      }
      const res: any = await apiPost(`/video/clips/${clip.contentId}/${clip.id}/publish`, payload)
      const learned = res?.data?.learned || res?.learned
      const preferredPresetId = res?.data?.preferredPresetId || res?.preferredPresetId
      setSuccess(
        learned
          ? `Scheduled ✓ — Click learned${preferredPresetId ? ` (top preset now: ${preferredPresetId})` : ''}.`
          : 'Scheduled ✓'
      )
      onPublished?.({ ...clip, published: true, publishedAt: finalIso })
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to schedule.')
    } finally {
      setBusy(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const captionEdited = caption.trim() !== originalCaption.trim()
  const timeEdited = !!scheduledTime && !!originalTime &&
    Math.abs(new Date(scheduledTime).getTime() - new Date(originalTime).getTime()) > 60_000

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sched-publish-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#0d0d10] border border-white/10 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Schedule & Publish</p>
            <h2 id="sched-publish-title" className="text-lg font-black text-white tracking-tight">Review your AI suggestion</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Platform tabs */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Platform</p>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${
                    platform === p.id
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Caption {captionEdited && <span className="text-amber-400">· edited</span>}
              </p>
              <span className="text-[10px] text-slate-500 tabular-nums">{caption.length} chars</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 resize-none"
              placeholder="Write a caption…"
            />
            {clip.recommendedHashtags && (clip.recommendedHashtags as any)[platform]?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(clip.recommendedHashtags as any)[platform].slice(0, 8).map((tag: string) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCaption((c) => c.includes(tag) ? c : (c.trim() + ' ' + tag).trim())}
                    className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[11px] font-bold text-slate-300 hover:bg-indigo-500/20 hover:border-indigo-500/30"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick-pick slots */}
          {allSlots.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Best slots</p>
              <div className="flex gap-2 flex-wrap">
                {allSlots.slice(0, 4).map((s) => {
                  const isPicked = scheduledTime === toLocalInput(s.isoTime)
                  return (
                    <button
                      key={s.isoTime + s.platform}
                      type="button"
                      onClick={() => setScheduledTime(toLocalInput(s.isoTime))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        isPicked
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                      title={s.reason}
                    >
                      <span className="flex items-center gap-1.5">
                        {isPicked && <CheckCircle2 className="w-3 h-3" />}
                        {slotLabel(s.isoTime)}
                        <span className="text-[10px] text-slate-500">· {s.score}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom datetime */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Scheduled time {timeEdited && <span className="text-amber-400">· edited</span>}
            </p>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Why this time? collapsible */}
          {clip.publishRationale && (
            <div>
              <button
                type="button"
                onClick={() => setShowRationale((v) => !v)}
                className="flex items-center gap-2 text-[11px] font-bold text-indigo-300 hover:text-indigo-200"
              >
                <Info className="w-3 h-3" />
                {showRationale ? 'Hide rationale' : 'Why this time?'}
              </button>
              {showRationale && (
                <div className="mt-2 rounded-xl bg-indigo-500/5 border border-indigo-500/20 px-4 py-3 text-xs text-slate-300 leading-relaxed">
                  <Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" />
                  {clip.publishRationale}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-200">{error}</div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200">{success}</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <Clock className="w-3 h-3" />
            <span>{captionEdited || timeEdited ? 'Click learns from your edits' : 'Click confirms this is your style'}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-white/5">Cancel</button>
            <button
              type="button"
              onClick={handleSchedule}
              disabled={busy || !caption.trim()}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {busy ? 'Scheduling…' : 'Schedule & Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
