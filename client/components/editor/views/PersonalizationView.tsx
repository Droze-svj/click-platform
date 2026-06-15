'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, Save, Loader2, Sparkles } from 'lucide-react'
import { apiGet, apiPut } from '../../../lib/api'

interface AiPreferences {
  voice: { tone: string; hookStyle: string; pacing: string; vocab: string[]; banned: string[] }
  brand: { primaryColor: string; accentColor: string; titleFont: string; bodyFont: string; colorGrade: string }
  defaults: { niche: string; platformFocus: string[] }
}

const EMPTY: AiPreferences = {
  voice: { tone: '', hookStyle: '', pacing: 'medium', vocab: [], banned: [] },
  brand: { primaryColor: '', accentColor: '', titleFont: '', bodyFont: '', colorGrade: '' },
  defaults: { niche: '', platformFocus: [] },
}

const toList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)

interface Insights {
  confidence: 'low' | 'medium' | 'high'
  sample: number
  learned: {
    topPlatforms?: string[]
    topHookStyles?: string[]
    topCaptionStyles?: string[]
    topColorGrades?: string[]
    topNiches?: string[]
    provenHooks?: string[]
    avgCutDurationSec?: number | null
  }
}

interface Recommendations {
  hasData: boolean
  performance: { avgRetentionDelta: number; sampleSize: number; hasRealData: boolean } | null
  blueprint: {
    recommendedColorMood: string
    pacingStrategy: string
    captionStyle: string
    recommendedVfx: string[]
    failingPatterns: string[]
    suggestedPivot: string
    contentSeriesWinners: string[]
    rationale: string
  } | null
}

const PersonalizationView: React.FC<{ showToast?: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [prefs, setPrefs] = useState<AiPreferences>(EMPTY)
  const [vocabText, setVocabText] = useState('')
  const [bannedText, setBannedText] = useState('')
  const [insights, setInsights] = useState<Insights | null>(null)
  const [recs, setRecs] = useState<Recommendations | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const toast = useCallback((m: string, t: 'success' | 'error' | 'info' = 'info') => showToast?.(m, t), [showToast])

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<any>('/me/ai-preferences', undefined, false)
        const d = (res?.data ?? res) as AiPreferences
        if (d?.voice) {
          setPrefs({ voice: { ...EMPTY.voice, ...d.voice }, brand: { ...EMPTY.brand, ...d.brand }, defaults: { ...EMPTY.defaults, ...d.defaults } })
          setVocabText((d.voice.vocab || []).join(', '))
          setBannedText((d.voice.banned || []).join(', '))
        }
      } catch { /* defaults */ } finally { setLoading(false) }
      try {
        const ir = await apiGet<any>('/me/personalization/insights', undefined, false)
        setInsights((ir?.data ?? ir) as Insights)
      } catch { /* best-effort */ }
      try {
        const rr = await apiGet<any>('/me/personalization/recommendations', undefined, false)
        setRecs((rr?.data ?? rr) as Recommendations)
      } catch { /* best-effort */ }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiPut('/me/ai-preferences', {
        voice: { tone: prefs.voice.tone, hookStyle: prefs.voice.hookStyle, pacing: prefs.voice.pacing, vocab: toList(vocabText), banned: toList(bannedText) },
        brand: { primaryColor: prefs.brand.primaryColor, accentColor: prefs.brand.accentColor, colorGrade: prefs.brand.colorGrade, titleFont: prefs.brand.titleFont, bodyFont: prefs.brand.bodyFont },
        defaults: { niche: prefs.defaults.niche },
      })
      toast('AI personalization saved — every generation now uses it.', 'success')
    } catch (e: any) {
      toast(e?.response?.data?.error || 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const setVoice = (k: keyof AiPreferences['voice'], v: any) => setPrefs((p) => ({ ...p, voice: { ...p.voice, [k]: v } }))
  const setBrand = (k: keyof AiPreferences['brand'], v: any) => setPrefs((p) => ({ ...p, brand: { ...p.brand, [k]: v } }))
  const setDefault = (k: keyof AiPreferences['defaults'], v: any) => setPrefs((p) => ({ ...p, defaults: { ...p.defaults, [k]: v } }))

  const label = 'text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block'
  const input = 'w-full rounded-xl bg-black/30 border border-white/10 p-2.5 text-sm text-[var(--text-main)] outline-none focus:border-fuchsia-500'

  const chipGroup = (groupLabel: string, items?: string[]) => {
    if (!items || !items.length) return null
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{groupLabel}:</span>
        {items.map((it) => <span key={it} className="text-[10px] font-bold text-fuchsia-300 bg-fuchsia-500/10 px-2 py-0.5 rounded capitalize">{it}</span>)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-7">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400 w-fit">
            <Fingerprint className="w-4 h-4" /> AI Personalization
          </div>
          <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tighter">Teach the AI your style</h1>
          <p className="text-slate-400 text-base">
            These shape <span className="text-fuchsia-400">every</span> AI generation — repurpose copy, captions, images, the autonomous pipeline.
            Click also learns from what you actually use, so it keeps getting more “you” over time.
          </p>
        </div>

        {/* What Click has learned (the adaptive loop, made visible) */}
        {insights && insights.sample > 0 && (
          <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">What Click has learned about you</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400">{insights.confidence} confidence · {insights.sample} signals</span>
            </div>
            {chipGroup('Platforms', insights.learned.topPlatforms)}
            {chipGroup('Proven hooks', insights.learned.provenHooks)}
            {chipGroup('Hook styles', insights.learned.topHookStyles)}
            {chipGroup('Caption styles', insights.learned.topCaptionStyles)}
            {chipGroup('Color grades', insights.learned.topColorGrades)}
            {chipGroup('Niches', insights.learned.topNiches)}
            <p className="text-slate-500 text-[11px]">Click keeps learning from what you generate, download and remix — this gets sharper over time.</p>
          </div>
        )}

        {/* What Click recommends — the blueprint from your REAL post analytics */}
        {recs && recs.hasData && recs.blueprint && (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> What Click recommends for you</span>
              {recs.performance?.hasRealData && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  {recs.performance.avgRetentionDelta >= 0 ? '+' : ''}{Math.round(recs.performance.avgRetentionDelta * 100)}% vs benchmark · {recs.performance.sampleSize} posts
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {recs.blueprint.recommendedColorMood && <div className="rounded-xl bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Color mood</div><div className="text-sm text-emerald-300 capitalize">{recs.blueprint.recommendedColorMood}</div></div>}
              {recs.blueprint.pacingStrategy && <div className="rounded-xl bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pacing</div><div className="text-sm text-emerald-300 capitalize">{recs.blueprint.pacingStrategy}</div></div>}
            </div>
            {chipGroup('Lean into', recs.blueprint.recommendedVfx)}
            {chipGroup('Winning series', recs.blueprint.contentSeriesWinners)}
            {recs.blueprint.failingPatterns.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">Stop doing:</span>
                {recs.blueprint.failingPatterns.map((f) => <span key={f} className="text-[10px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded">{f}</span>)}
              </div>
            )}
            {recs.blueprint.suggestedPivot && <p className="text-emerald-200/90 text-xs"><span className="font-black uppercase tracking-widest text-[9px] text-emerald-400">Pivot:</span> {recs.blueprint.suggestedPivot}</p>}
            {recs.blueprint.rationale && <p className="text-slate-500 text-[11px]">{recs.blueprint.rationale}</p>}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            {/* Voice */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-400" /> Voice</div>
              <div>
                <span className={label}>Tone</span>
                <input className={input} value={prefs.voice.tone} onChange={(e) => setVoice('tone', e.target.value)} placeholder="e.g. blunt operator, calm professorial, hype" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className={label}>Go-to hook style</span>
                  <input className={input} value={prefs.voice.hookStyle} onChange={(e) => setVoice('hookStyle', e.target.value)} placeholder="curiosity-gap" />
                </div>
                <div>
                  <span className={label}>Pacing / intensity</span>
                  <select aria-label="Pacing intensity" className={input} value={prefs.voice.pacing} onChange={(e) => setVoice('pacing', e.target.value)}>
                    <option value="gentle">Gentle</option>
                    <option value="medium">Medium</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
              </div>
              <div>
                <span className={label}>Signature words (comma-separated) — woven into copy</span>
                <textarea className={`${input} h-16 resize-none`} value={vocabText} onChange={(e) => setVocabText(e.target.value)} placeholder="cheat code, unfair advantage, receipts" />
              </div>
              <div>
                <span className={label}>Banned words (never used)</span>
                <textarea className={`${input} h-16 resize-none`} value={bannedText} onChange={(e) => setBannedText(e.target.value)} placeholder="delve, game-changer, unlock" />
              </div>
            </div>

            {/* Brand */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">Brand</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className={label}>Primary color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Primary brand color" value={prefs.brand.primaryColor || '#7C3AED'} onChange={(e) => setBrand('primaryColor', e.target.value)} className="h-10 w-12 rounded-lg bg-transparent border border-white/10" />
                    <input className={input} value={prefs.brand.primaryColor} onChange={(e) => setBrand('primaryColor', e.target.value)} placeholder="#7C3AED" />
                  </div>
                </div>
                <div>
                  <span className={label}>Accent color</span>
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Accent brand color" value={prefs.brand.accentColor || '#00E0FF'} onChange={(e) => setBrand('accentColor', e.target.value)} className="h-10 w-12 rounded-lg bg-transparent border border-white/10" />
                    <input className={input} value={prefs.brand.accentColor} onChange={(e) => setBrand('accentColor', e.target.value)} placeholder="#00E0FF" />
                  </div>
                </div>
              </div>
              <div>
                <span className={label}>Default color grade (used in generated images)</span>
                <input className={input} value={prefs.brand.colorGrade} onChange={(e) => setBrand('colorGrade', e.target.value)} placeholder="cinematic / vibrant / muted" />
              </div>
            </div>

            {/* Defaults */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <span className={label}>Primary niche</span>
              <input className={input} value={prefs.defaults.niche} onChange={(e) => setDefault('niche', e.target.value)} placeholder="finance / fitness / tech…" />
            </div>

            <motion.button whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving} onClick={save}
              className={`h-12 px-6 rounded-2xl inline-flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm ${saving ? 'bg-slate-700 opacity-60' : 'bg-fuchsia-600 hover:bg-fuchsia-500'}`}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save personalization</>}
            </motion.button>
          </>
        )}
      </div>
    </div>
  )
}

export default PersonalizationView
