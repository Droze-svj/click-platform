'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Zap, Music, Hash, Eye, Target, Activity, Globe,
  Mic, Volume2, Wand2, Clock, Flame, TrendingUp, Layers,
  CheckCircle2, ArrowRight, Loader2, Info, Lock, ChevronRight
} from 'lucide-react'

interface Trends2026ViewProps {
  videoId?: string
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  onApplyHook?: (start: number, end: number) => void
  onApplyBeatCuts?: (bpm: number) => void
  onApplyOverlay?: (kind: string) => void
  onApplyTrendingSound?: (soundId: string) => void
}

interface HookCandidate { id: string; label: string; start: number; end: number; score: number; reason: string }
interface BrollSuggest    { id: string; label: string; tag: string; reason: string }
interface OverlayKind     { id: string; label: string; preview: string; tag: string }
interface VoicePreset     { id: string; label: string; tone: string }
interface TrendSound      { id: string; title: string; platform: string; bpm: number; mood: string; uses: string }
interface NicheTemplate   { niche: string; pattern: string; expected: string }

// Niche-aware seeded library — replaceable with /api/trends + /api/video/insights once live
const HOOK_CANDIDATES: HookCandidate[] = [
  { id: 'h1', label: '"Wait, watch this..."',          start: 0,    end: 3.2, score: 94, reason: 'Strong pattern interrupt + curiosity gap' },
  { id: 'h2', label: 'Speaker eye contact + question', start: 12.5, end: 15.8, score: 88, reason: 'High face-to-camera retention signal' },
  { id: 'h3', label: 'Visual reveal moment',           start: 27.0, end: 30.4, score: 81, reason: 'Sudden contrast in motion vector' },
]

const BROLL_SUGGESTIONS: BrollSuggest[] = [
  { id: 'b1', label: 'Slow-motion city skyline (4K)', tag: 'LIFESTYLE',  reason: 'Matches segment 0:18 keyword "growth"' },
  { id: 'b2', label: 'Stock chart upward animation',  tag: 'FINANCE',    reason: 'Matches segment 0:42 numeric mention' },
  { id: 'b3', label: 'Macro coffee pour 60fps',       tag: 'PRODUCT',    reason: 'Matches segment 1:05 sensory language' },
  { id: 'b4', label: 'Drone forest reveal',           tag: 'MOOD',       reason: 'Fills 1:18 voice-only gap' },
]

const OVERLAY_LIBRARY: OverlayKind[] = [
  { id: 'zoom-burst',   label: 'Zoom Burst',    preview: '◉ → ⊙ → ●', tag: 'EMPHASIS' },
  { id: 'arrow-pop',    label: 'Arrow Pop',     preview: '→ →→ →→→',   tag: 'POINTER'  },
  { id: 'countdown',    label: '3-2-1 Counter', preview: '3 · 2 · 1',   tag: 'TIMING'   },
  { id: 'glitch',       label: 'Glitch Cut',    preview: '▓▒░▓▒░',     tag: 'ENERGY'   },
  { id: 'caption-pop',  label: 'Caption Pop',   preview: 'AaA · AAA',   tag: 'TEXT'     },
  { id: 'swipe-reveal', label: 'Swipe Reveal',  preview: '◐ → ◑',       tag: 'TRANSITION' },
]

const VOICE_PRESETS: VoicePreset[] = [
  { id: 'natural',     label: 'Your voice — natural',  tone: 'Conversational, balanced energy' },
  { id: 'authoritative', label: 'Your voice — authoritative', tone: 'Lower pitch, slow pacing' },
  { id: 'energetic',   label: 'Your voice — energetic', tone: 'Higher pitch, fast pacing' },
  { id: 'whisper',     label: 'Your voice — whisper',   tone: 'Intimate ASMR for hooks' },
]

const TREND_SOUNDS: TrendSound[] = [
  { id: 's1', title: 'Trap remix · viral cut #4719',       platform: 'TikTok',         bpm: 140, mood: 'Energy',     uses: '1.2M videos' },
  { id: 's2', title: 'Lush ambient · pulse 88bpm',         platform: 'TikTok / Reels', bpm: 88,  mood: 'Calm',       uses: '521K videos' },
  { id: 's3', title: 'Bass drop · "wait for it"',          platform: 'TikTok',         bpm: 128, mood: 'Reveal',     uses: '340K videos' },
  { id: 's4', title: 'Lo-fi piano loop · midnight',        platform: 'Reels',          bpm: 72,  mood: 'Nostalgic',  uses: '180K videos' },
  { id: 's5', title: 'Cinematic builder · score #211',     platform: 'Shorts',         bpm: 95,  mood: 'Epic',       uses: '92K videos' },
]

const NICHE_TEMPLATES: Record<string, NicheTemplate[]> = {
  Fitness:    [{ niche: 'Fitness',    pattern: '3-stage transformation reveal',     expected: '+24% retention' }, { niche: 'Fitness',    pattern: 'POV: form-correction breakdown',         expected: '+18% saves' }],
  Finance:    [{ niche: 'Finance',    pattern: 'Number-anchor → counterintuitive',   expected: '+31% completion' }, { niche: 'Finance',    pattern: 'Day-in-the-life cost ledger',           expected: '+22% shares' }],
  Education:  [{ niche: 'Education',  pattern: '3 things I wish I knew at 22',       expected: '+27% retention' }, { niche: 'Education',  pattern: 'Step-by-step over textbook explainer',  expected: '+19% saves' }],
  Tech:       [{ niche: 'Tech',       pattern: 'Side-by-side spec showdown',         expected: '+28% completion' }, { niche: 'Tech',       pattern: '"Here is what nobody told you about X"', expected: '+33% comments' }],
  Lifestyle:  [{ niche: 'Lifestyle',  pattern: 'POV: routine reveal at 6am',         expected: '+21% saves' },     { niche: 'Lifestyle',  pattern: 'Aesthetic vignettes + voiceover',       expected: '+16% retention' }],
  Comedy:     [{ niche: 'Comedy',     pattern: 'Setup → misdirection → payoff (12s)',expected: '+38% shares' },     { niche: 'Comedy',     pattern: 'Reaction split-screen stitch',          expected: '+29% remixes' }],
  Beauty:     [{ niche: 'Beauty',     pattern: 'Before/after with timestamp',        expected: '+20% saves' },     { niche: 'Beauty',     pattern: 'Mirror-talk product critique',           expected: '+17% completion' }],
}

const NICHES = Object.keys(NICHE_TEMPLATES)

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]'

export default function Trends2026View({
  videoId,
  showToast,
  onApplyHook,
  onApplyBeatCuts,
  onApplyOverlay,
  onApplyTrendingSound,
}: Trends2026ViewProps) {
  const [niche, setNiche] = useState<string>('Fitness')
  const [bpm, setBpm] = useState<number>(120)
  const [voicePreset, setVoicePreset] = useState<string>('natural')
  const [appliedHookId, setAppliedHookId] = useState<string | null>(null)
  const [appliedSoundId, setAppliedSoundId] = useState<string | null>(null)
  const [appliedOverlays, setAppliedOverlays] = useState<Set<string>>(new Set())
  const [predicting, setPredicting] = useState(false)
  const [predictedScore, setPredictedScore] = useState<number | null>(null)

  const templates = useMemo(() => NICHE_TEMPLATES[niche] || [], [niche])

  const handleApplyHook = (h: HookCandidate) => {
    setAppliedHookId(h.id)
    onApplyHook?.(h.start, h.end)
    showToast?.(`✓ Hook locked: ${h.label}`, 'success')
  }

  const handleApplyBeatCuts = () => {
    onApplyBeatCuts?.(bpm)
    showToast?.(`✓ Beat-matched cuts at ${bpm} BPM`, 'success')
  }

  const handleApplyOverlay = (k: OverlayKind) => {
    setAppliedOverlays(prev => {
      const next = new Set(prev)
      if (next.has(k.id)) next.delete(k.id); else next.add(k.id)
      return next
    })
    onApplyOverlay?.(k.id)
  }

  const handleApplyTrendingSound = (s: TrendSound) => {
    setAppliedSoundId(s.id)
    setBpm(s.bpm)
    onApplyTrendingSound?.(s.id)
    showToast?.(`✓ Sound matched: ${s.title} · ${s.bpm} BPM`, 'success')
  }

  const handlePredict = async () => {
    setPredicting(true)
    setPredictedScore(null)
    await new Promise(r => setTimeout(r, 900))
    const baseScore = appliedHookId ? 65 : 42
    const overlayBonus = Math.min(15, appliedOverlays.size * 4)
    const soundBonus = appliedSoundId ? 8 : 0
    const variance = Math.floor(Math.random() * 6)
    setPredictedScore(Math.min(98, baseScore + overlayBonus + soundBonus + variance))
    setPredicting(false)
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-gradient-to-br from-[#0a0a14] via-[#0d0d18] to-[#080812]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-purple-700 flex items-center justify-center shadow-[0_20px_60px_rgba(217,70,239,0.3)]">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">2026</span>
              <span className="w-1 h-1 rounded-full bg-fuchsia-500/60" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">Creative AI Tools</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Manual editor — 2026 toolkit</h2>
            <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">Trend-tuned hooks, beat-matched cuts, B-roll suggestions, viral overlays. Apply selectively.</p>
          </div>
        </div>
        {videoId && <span className="text-[10px] font-mono text-slate-500 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">video · {videoId.slice(0, 8)}…</span>}
      </div>

      {/* Niche selector */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <Target className="w-4 h-4 text-fuchsia-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">Tune to niche</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {NICHES.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setNiche(n)}
              className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors border ${
                niche === n
                  ? 'bg-fuchsia-600 text-white border-transparent shadow-[0_8px_30px_rgba(217,70,239,0.35)]'
                  : 'bg-white/[0.02] text-slate-300 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {templates.map((t, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-white/10 p-3.5 hover:border-fuchsia-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <Flame className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-fuchsia-400">{t.expected}</span>
                </div>
                <p className="text-[13px] text-white font-medium leading-snug">{t.pattern}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hook detector */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">AI Hook Detector</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">Top 3 candidates ranked by retention signal. Click to lock as opener.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {HOOK_CANDIDATES.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => handleApplyHook(h)}
              className={`w-full text-left rounded-xl p-3.5 border transition-colors flex items-center gap-4 ${
                appliedHookId === h.id
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.15)]'
                  : 'bg-white/[0.02] border-white/10 hover:border-amber-500/30'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black tabular-nums text-lg flex-shrink-0 ${
                h.score >= 90 ? 'bg-amber-500 text-black' : h.score >= 80 ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-slate-300'
              }`}>{h.score}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-white truncate">{h.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{h.reason}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-0.5">{h.start.toFixed(1)}s → {h.end.toFixed(1)}s</p>
              </div>
              {appliedHookId === h.id ? <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> : <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Beat-matched cuts */}
        <div className={`${glassStyle} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Music className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Beat-Matched Cuts</h3>
              <p className="text-[11px] text-slate-400">Sync transitions to audio downbeats</p>
            </div>
          </div>
          <label htmlFor="bpm-input" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">BPM target</label>
          <div className="flex items-center gap-3">
            <input
              id="bpm-input"
              type="range"
              min={60}
              max={180}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value, 10))}
              className="flex-1 accent-cyan-500"
            />
            <span className="text-2xl font-black tabular-nums text-cyan-400 min-w-[3.5rem] text-right">{bpm}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Cut every {(60 / bpm).toFixed(2)}s · {(60 / bpm * 4).toFixed(2)}s per bar</p>
          <button type="button" onClick={handleApplyBeatCuts} className="mt-4 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
            <Zap className="w-3.5 h-3.5" /> Apply beat cuts
          </button>
        </div>

        {/* Engagement predictor */}
        <div className={`${glassStyle} rounded-2xl p-5`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Engagement Predictor</h3>
              <p className="text-[11px] text-slate-400">Estimated retention + completion before publish</p>
            </div>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/5 p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Predicted score</p>
              <p className="text-5xl font-black tabular-nums tracking-tight text-white">
                {predictedScore != null ? predictedScore : '—'}
                <span className="text-base text-slate-500 ml-1">/100</span>
              </p>
              {predictedScore != null && (
                <p className={`text-[10px] font-bold ${predictedScore >= 80 ? 'text-emerald-400' : predictedScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {predictedScore >= 80 ? 'STRONG · ship it' : predictedScore >= 60 ? 'OK · iterate' : 'WEAK · rework hook'}
                </p>
              )}
            </div>
            <button type="button" onClick={handlePredict} disabled={predicting} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
              {predicting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {predicting ? 'Scoring…' : 'Re-score'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">Score reflects current hook + overlays + sound match. Replaceable with /api/video/insights/predict once wired.</p>
        </div>
      </div>

      {/* B-roll Auto-Suggest */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">B-roll Auto-Insert</h3>
            <p className="text-[11px] text-slate-400">Contextual stock footage matched to transcript segments</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {BROLL_SUGGESTIONS.map((b) => (
            <div key={b.id} className="rounded-xl bg-white/[0.02] border border-white/10 hover:border-violet-500/30 transition-colors p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                {b.tag.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-violet-400">{b.tag}</span>
                </div>
                <p className="text-[12px] font-semibold text-white truncate">{b.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{b.reason}</p>
              </div>
              <button type="button" onClick={() => showToast?.(`✓ Queued: ${b.label}`, 'success')} className="text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition-colors flex-shrink-0">
                ADD
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pattern-interrupt overlays */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">Pattern-Interrupt FX</h3>
            <p className="text-[11px] text-slate-400">{appliedOverlays.size} of {OVERLAY_LIBRARY.length} active</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {OVERLAY_LIBRARY.map(k => {
            const active = appliedOverlays.has(k.id)
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => handleApplyOverlay(k)}
                className={`rounded-xl p-3 text-left border transition-colors ${
                  active ? 'bg-rose-500/10 border-rose-500/40' : 'bg-white/[0.02] border-white/10 hover:border-rose-500/30'
                }`}
              >
                <p className={`text-[18px] mb-1 ${active ? 'text-rose-300' : 'text-slate-400'}`}>{k.preview}</p>
                <p className="text-[11px] font-bold text-white truncate">{k.label}</p>
                <p className="text-[8px] uppercase tracking-widest text-slate-500 mt-0.5">{k.tag}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Trending sound match */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Trending Sound Match</h3>
            <p className="text-[11px] text-slate-400">Current week&apos;s viral audio · per platform</p>
          </div>
        </div>
        <div className="space-y-2">
          {TREND_SOUNDS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleApplyTrendingSound(s)}
              className={`w-full text-left rounded-xl p-3.5 border transition-colors flex items-center gap-4 ${
                appliedSoundId === s.id
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-white/[0.02] border-white/10 hover:border-emerald-500/30'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white flex-shrink-0">
                <Music className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">{s.platform}</span>
                  <span className="text-[9px] font-mono text-slate-500">{s.bpm} BPM</span>
                  <span className="text-[9px] font-mono text-slate-500">{s.mood}</span>
                  <span className="text-[9px] font-mono text-slate-500">{s.uses}</span>
                </div>
              </div>
              {appliedSoundId === s.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <ArrowRight className="w-4 h-4 text-slate-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Voice clone */}
      <div className={`${glassStyle} rounded-2xl p-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <Mic className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">Voice Clone Narration <Lock className="w-3 h-3 text-amber-400" /></h3>
            <p className="text-[11px] text-slate-400">Fill voiceover gaps with your own cloned voice · Pro tier</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOICE_PRESETS.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => { setVoicePreset(v.id); showToast?.(`Voice preset: ${v.label}`, 'info') }}
              className={`text-left rounded-xl p-3 border transition-colors ${
                voicePreset === v.id ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-white/[0.02] border-white/10 hover:border-indigo-500/30'
              }`}
            >
              <p className="text-[12px] font-semibold text-white">{v.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{v.tone}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold text-fuchsia-300 leading-snug">Most tools use seeded sample data</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Hook scores, B-roll suggestions, and trend sounds will switch to live data once <code className="text-fuchsia-300">/api/video/insights</code> and <code className="text-fuchsia-300">/api/trends</code> are wired. Toggles are forward-compatible with the AI auto-edit pipeline.
          </p>
        </div>
      </div>
    </div>
  )
}
