'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Image as ImageIcon, Mic, AudioWaveform, Loader2, Download, Plus, Lock } from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'

type GenKind = 'image' | 'voiceover' | 'sfx'

interface GenAsset {
  type: 'image' | 'voiceover' | 'sfx'
  url: string
  title: string
  duration?: number
  prompt?: string
}

interface Capabilities {
  voiceover: boolean
  sfx: boolean
  image: boolean
  music?: { available: boolean; endpoint: string; note?: string }
  sfxStyles?: string[]
}

interface GenerateViewProps {
  videoId?: string
  currentTime?: number
  setTimelineSegments?: (updater: (prev: any[]) => any[]) => void
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const KIND_META: { id: GenKind; label: string; icon: React.ElementType; hint: string }[] = [
  { id: 'image', label: 'Image', icon: ImageIcon, hint: 'Text → image (REPLICATE_API_KEY)' },
  { id: 'voiceover', label: 'Voiceover', icon: Mic, hint: 'Text → speech (OPENAI / ELEVENLABS)' },
  { id: 'sfx', label: 'Sound FX', icon: AudioWaveform, hint: 'Generate a sound effect (ELEVENLABS)' },
]

const ASPECTS = ['9:16', '1:1', '16:9', '4:5']

const GenerateView: React.FC<GenerateViewProps> = ({ videoId, currentTime = 0, setTimelineSegments, showToast }) => {
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [kind, setKind] = useState<GenKind>('image')
  const [prompt, setPrompt] = useState('')
  const [text, setText] = useState('')
  const [style, setStyle] = useState('whoosh')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [busy, setBusy] = useState(false)
  const [asset, setAsset] = useState<GenAsset | null>(null)

  const toast = useCallback((m: string, t: 'success' | 'error' | 'info' = 'info') => showToast?.(m, t), [showToast])

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<any>('/ai/generate/capabilities', undefined, false)
        setCaps((res?.data ?? res)?.capabilities ?? null)
      } catch { /* capabilities are best-effort */ }
    })()
  }, [])

  const available = (k: GenKind) => !caps || caps[k] // unknown → allow attempt (server still guards)

  const generate = async () => {
    setBusy(true)
    setAsset(null)
    try {
      const body: any = { kind, videoId }
      if (kind === 'image') body.prompt = prompt, body.aspectRatio = aspectRatio
      if (kind === 'voiceover') body.text = text
      if (kind === 'sfx') body.style = style
      const res = await apiPost<any>('/ai/generate', body)
      const data = res?.data ?? res
      if (data?.asset) { setAsset(data.asset); toast('Generated.', 'success') }
      else toast('Nothing was generated.', 'error')
    } catch (e: any) {
      const r = e?.response
      if (r?.status === 503 || r?.data?.unavailable) {
        toast(r?.data?.error || 'That generator isn’t configured yet.', 'info')
      } else {
        toast(r?.data?.error || e?.message || 'Generation failed', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  // Mirror AssetLibraryView.addToTimeline so generated assets drop onto the
  // timeline exactly like library assets.
  const addToTimeline = (a: GenAsset) => {
    if (!setTimelineSegments) { toast('Open the timeline to add this.', 'info'); return }
    const isAudio = a.type === 'voiceover' || a.type === 'sfx'
    const duration = a.duration ?? (a.type === 'sfx' ? 2 : isAudio ? 8 : 5)
    const segment = {
      id: `seg-gen-${Date.now()}`,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      type: isAudio ? 'audio' : 'image',
      name: a.title || 'Generated asset',
      color: a.type === 'voiceover' ? '#06B6D4' : a.type === 'sfx' ? '#F97316' : '#8B5CF6',
      track: isAudio ? 1 : 2,
      sourceUrl: a.url,
    }
    setTimelineSegments((prev) => [...prev, segment])
    toast('Added to timeline.', 'success')
  }

  const canSubmit = !busy && (kind === 'image' ? prompt.trim() : kind === 'voiceover' ? text.trim() : true)

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-[10px] font-black uppercase tracking-[0.4em] text-violet-400 w-fit">
            <Sparkles className="w-4 h-4" /> Generate
          </div>
          <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tighter">Generate assets with AI</h1>
          <p className="text-slate-400 text-base">Create images, voiceovers and sound effects from a prompt, then drop them on the timeline.</p>
        </div>

        {/* Kind selector */}
        <div className="grid grid-cols-3 gap-3">
          {KIND_META.map((k) => {
            const Icon = k.icon
            const on = kind === k.id
            const ok = available(k.id)
            return (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`relative rounded-2xl border-2 p-4 text-left transition-all ${on ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.03] hover:border-white/20'}`}
              >
                <Icon className="w-6 h-6 text-violet-400 mb-2" />
                <div className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{k.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{k.hint}</div>
                {!ok && <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400"><Lock className="w-3 h-3" /> key</span>}
              </button>
            )
          })}
        </div>

        {/* Inputs */}
        <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          {kind === 'image' && (
            <>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image — e.g. 'a neon city skyline at dusk, cinematic'"
                className="w-full h-24 rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-[var(--text-main)] resize-none outline-none focus:border-violet-500" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aspect</span>
                {ASPECTS.map((a) => (
                  <button key={a} onClick={() => setAspectRatio(a)} className={`px-3 py-1 rounded-lg text-xs font-bold ${aspectRatio === a ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400'}`}>{a}</button>
                ))}
              </div>
            </>
          )}
          {kind === 'voiceover' && (
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type the script to voice…"
              className="w-full h-28 rounded-xl bg-black/30 border border-white/10 p-3 text-sm text-[var(--text-main)] resize-none outline-none focus:border-violet-500" />
          )}
          {kind === 'sfx' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Style</span>
              {(caps?.sfxStyles || ['whoosh', 'riser', 'swipe', 'impact']).map((s) => (
                <button key={s} onClick={() => setStyle(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${style === s ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400'}`}>{s}</button>
              ))}
            </div>
          )}

          <motion.button whileTap={{ scale: canSubmit ? 0.97 : 1 }} disabled={!canSubmit} onClick={generate}
            className={`h-12 px-6 rounded-2xl inline-flex items-center gap-2 text-white font-black uppercase tracking-widest text-sm transition-all ${canSubmit ? 'bg-violet-600 hover:bg-violet-500' : 'bg-slate-700 opacity-60 cursor-not-allowed'}`}>
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate</>}
          </motion.button>
        </div>

        {/* Result */}
        {asset && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div className="text-sm font-black text-[var(--text-main)]">{asset.title}</div>
            {asset.type === 'image'
              ? <img src={asset.url} alt={asset.title} className="max-h-72 rounded-xl border border-white/10" />
              : <audio src={asset.url} controls className="w-full" />}
            <div className="flex items-center gap-3">
              <button onClick={() => addToTimeline(asset)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-widest">
                <Plus className="w-4 h-4" /> Add to timeline
              </button>
              <a href={asset.url} download className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-main)] text-[11px] font-black uppercase tracking-widest">
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default GenerateView
