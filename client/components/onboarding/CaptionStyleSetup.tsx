'use client'

/**
 * CaptionStyleSetup — a guided onboarding step that lets a new creator set up
 * their captions BEFORE their first edit: pick the platforms they post to, pick a
 * default caption look from a LIVE preview grid, and keep Snap-to-Speech on. The
 * choices persist so the editor opens with captions already styled the way they
 * want — the kind of "ready in one step" start the competitors don't offer.
 *
 * Self-contained (no required props) so it can be hosted by the onboarding route
 * or rendered in isolation. Persistence is best-effort and never blocks the user.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Sparkles, MessageSquare, ArrowRight } from 'lucide-react'
import { PLATFORM_OPTIONS } from '../../lib/nicheCatalog'
import { CAPTION_TEXT_STYLES, type CaptionTextStyle } from '../../types/editor'
import { resolveCaptionTextStyle } from '../../utils/captionStyler'
import { saveEditorContentPreferences } from '../../utils/editorUtils'
import { apiPost } from '../../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

// Matches ResizableTimeline's persisted Snap-to-Speech key so this toggle sets
// the editor default directly.
const SNAP_SPEECH_KEY = 'click-timeline-snap-speech'

export interface CaptionStyleSetupProps {
  /** Called after the user finishes (or skips); defaults to navigating to upload. */
  onComplete?: () => void
}

export default function CaptionStyleSetup({ onComplete }: CaptionStyleSetupProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const [platforms, setPlatforms] = useState<string[]>(['tiktok'])
  const [style, setStyle] = useState<CaptionTextStyle>('bold')
  const [snapToSpeech, setSnapToSpeech] = useState(true)
  const [saving, setSaving] = useState(false)

  const togglePlatform = (value: string) =>
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]))

  // Where to go after finishing — caller can pass ?next=… (e.g. the post-register
  // welcome dashboard); defaults to the upload hub so they can edit right away.
  const nextDest = (): string => {
    if (typeof window === 'undefined') return '/dashboard/video'
    return new URLSearchParams(window.location.search).get('next') || '/dashboard/video'
  }

  const finish = async () => {
    setSaving(true)
    // Persist the caption default for the editor + the Snap-to-Speech default.
    saveEditorContentPreferences({ defaultCaptionStyle: style })
    try {
      if (typeof window !== 'undefined') localStorage.setItem(SNAP_SPEECH_KEY, String(snapToSpeech))
    } catch { /* ignore */ }
    // Best-effort: save platform focus to the profile (no-op if unauthenticated).
    try {
      if (platforms.length) await apiPost('/niche/personalize', { platformFocus: platforms })
    } catch { /* non-blocking */ }
    setSaving(false)
    if (onComplete) onComplete()
    else router.push(nextDest())
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 text-white">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-emerald-400" />
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">{t('captionSetup.stepBadge')}</span>
      </div>
      <h1 className="text-2xl font-extrabold mb-1">{t('captionSetup.title')}</h1>
      <p className="text-sm text-slate-400 mb-8">{t('captionSetup.subtitle')}</p>

      {/* Platforms */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('captionSetup.platformsLabel')}</div>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const on = platforms.includes(p.value)
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePlatform(p.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${on ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
              >
                {on && <Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />}
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Caption style picker (live preview) */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('captionSetup.styleLabel')}</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {CAPTION_TEXT_STYLES.map((s) => {
            const selected = s.id === style
            const css = resolveCaptionTextStyle(s.id, { color: '#FFFFFF', accentColor: '#FFD54A', backgroundColor: 'rgba(0,0,0,0.85)', outlineColor: '#000' })
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                aria-pressed={selected}
                className={`relative rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[92px] border transition-all ${selected ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-white/10 hover:border-white/30'}`}
                style={{ background: 'linear-gradient(135deg,#1b2735,#0f1620)' }}
              >
                {selected && <Check className="w-4 h-4 text-emerald-400 absolute top-2 right-2" />}
                <span style={{ fontSize: 19, fontWeight: 700, textAlign: 'center', ...(css as any) }}>{t('captionSetup.sampleWord')}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-500">{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Snap-to-Speech */}
      <div className="flex items-center justify-between mb-10 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-3">
          <MessageSquare className={`w-5 h-5 ${snapToSpeech ? 'text-emerald-400' : 'text-slate-500'}`} />
          <div>
            <div className="text-sm font-bold">{t('captionSetup.snapTitle')}</div>
            <div className="text-xs text-slate-400">{t('captionSetup.snapDesc')}</div>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={snapToSpeech}
          aria-label={t('captionSetup.snapAria')}
          title={t('captionSetup.snapAria')}
          onClick={() => setSnapToSpeech((v) => !v)}
          className={`w-12 h-6 rounded-full border transition-all relative ${snapToSpeech ? 'bg-emerald-600 border-emerald-400' : 'bg-black/40 border-white/10'}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${snapToSpeech ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={finish}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
        >
          {saving ? t('captionSetup.saving') : t('captionSetup.save')}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => (onComplete ? onComplete() : router.push(nextDest()))} className="text-sm text-slate-400 hover:text-white">
          {t('captionSetup.skip')}
        </button>
      </div>
    </div>
  )
}
