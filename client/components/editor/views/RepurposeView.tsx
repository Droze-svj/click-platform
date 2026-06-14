'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone,
  Monitor,
  Square,
  RectangleVertical,
  Zap,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  Copy,
  Play,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'

// One source → many platform-native cuts. Each target is smart-reframed
// (subject-aware crop, not a blind center crop), re-hooked with platform copy,
// and rendered through the real /api/video/repurpose pipeline.
interface FormatProfile {
  id: string
  label: string
  icon: React.ElementType
  aspect: string
  description: string
  color: string
}

const FORMATS: FormatProfile[] = [
  { id: '9:16', label: 'Vertical', icon: Smartphone, aspect: '9:16', description: 'TikTok · Reels · Shorts', color: 'from-fuchsia-500 to-rose-500' },
  { id: '1:1', label: 'Square', icon: Square, aspect: '1:1', description: 'Instagram feed', color: 'from-blue-500 to-indigo-500' },
  { id: '16:9', label: 'Wide', icon: Monitor, aspect: '16:9', description: 'YouTube landscape', color: 'from-emerald-500 to-teal-500' },
  { id: '4:5', label: 'Portrait', icon: RectangleVertical, aspect: '4:5', description: 'IG portrait · LinkedIn', color: 'from-amber-500 to-orange-500' },
]

type VariantStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'unknown'

interface Variant {
  jobId: string
  ratio: string
  platform: string
  platformLabel: string
  hook: string
  title: string
  description: string
  hashtags: string[]
  status: VariantStatus
}

interface RepurposeViewProps {
  videoUrl: string
  videoId?: string
  videoFilters?: any
  textOverlays?: any[]
  shapeOverlays?: any[]
  imageOverlays?: any[]
  gradientOverlays?: any[]
  svgOverlays?: any[]
  timelineSegments?: any[]
  videoDuration?: number
  projectName?: string
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// Renders are served from the static uploads mount (auth is Bearer-only, so a
// plain download link must use the public path, not the authed API route).
const variantFileUrl = (jobId: string) => `/uploads/renders/${jobId}.mp4`

const RepurposeView: React.FC<RepurposeViewProps> = (props) => {
  const { videoUrl, videoId, projectName, showToast } = props
  const [selected, setSelected] = useState<string[]>(['9:16', '1:1', '16:9', '4:5'])
  const [isBusy, setIsBusy] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const pollingRef = useRef(false)

  const toast = useCallback((m: string, t: 'success' | 'error' | 'info' = 'info') => {
    showToast?.(m, t)
  }, [showToast])

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))

  const start = async () => {
    if (!videoUrl) { toast('No source video loaded to repurpose.', 'error'); return }
    if (selected.length === 0) { toast('Select at least one format.', 'error'); return }

    setIsBusy(true)
    setVariants([])
    try {
      const res = await apiPost<any>('/video/repurpose', {
        videoUrl,
        videoId: videoId || undefined,
        videoFilters: props.videoFilters || {},
        textOverlays: props.textOverlays || [],
        shapeOverlays: props.shapeOverlays || [],
        imageOverlays: props.imageOverlays || [],
        gradientOverlays: props.gradientOverlays || [],
        svgOverlays: props.svgOverlays || [],
        timelineSegments: props.timelineSegments || [],
        duration: props.videoDuration,
        metadata: { contentId: videoId, title: projectName },
        targets: selected,
      })
      const data = res?.data ?? res
      const got: Variant[] = (data?.variants || []).map((v: any) => ({ ...v, status: 'processing' as VariantStatus }))
      if (!got.length) {
        toast('No variants could be created for the selected formats.', 'error')
        setIsBusy(false)
        return
      }
      setVariants(got)
      if (typeof data?.variantsRequested === 'number' && data.variantsRequested > got.length) {
        toast(`Your plan allows ${got.length} of ${data.variantsRequested} formats. Upgrade for more.`, 'info')
      }
      toast(`Repurposing into ${got.length} format${got.length > 1 ? 's' : ''}…`, 'success')
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Repurpose failed'
      toast(msg, 'error')
      setIsBusy(false)
    }
  }

  // Poll each variant's render status until every one is terminal. The renders
  // run sequentially server-side, so jobs complete in order.
  useEffect(() => {
    if (!variants.length) return
    const pending = variants.some((v) => v.status === 'processing' || v.status === 'queued')
    if (!pending) { setIsBusy(false); return }

    const id = setInterval(async () => {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        const updated = await Promise.all(
          variants.map(async (v) => {
            if (v.status === 'completed' || v.status === 'failed') return v
            try {
              const r = await apiGet<any>(`/video/render/${v.jobId}/status`, undefined, false)
              const d = r?.data ?? r
              const s = d?.status
              if (s === 'completed') return { ...v, status: 'completed' as VariantStatus }
              if (s === 'failed') return { ...v, status: 'failed' as VariantStatus }
              return v
            } catch {
              return v
            }
          })
        )
        setVariants(updated)
      } finally {
        pollingRef.current = false
      }
    }, 2500)

    return () => clearInterval(id)
  }, [variants])

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'success') }
    catch { toast('Could not copy', 'error') }
  }

  return (
    <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 w-fit">
            <Zap className="w-4 h-4" /> Repurpose Studio
          </div>
          <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tighter">
            One video. Every platform.
          </h1>
          <p className="text-slate-400 text-base max-w-2xl leading-relaxed">
            Auto-generate platform-native cuts — each <span className="text-indigo-400 font-semibold">smart-reframed</span> to keep your
            subject in frame, with a tailored hook, title and description per platform.
          </p>
        </div>

        {/* Format selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FORMATS.map((f) => {
            const isSel = selected.includes(f.id)
            const Icon = f.icon
            return (
              <button
                key={f.id}
                onClick={() => !isBusy && toggle(f.id)}
                disabled={isBusy}
                className={`relative overflow-hidden rounded-3xl border-2 p-5 text-left transition-all ${
                  isSel ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/[0.03] hover:border-white/20'
                } ${isBusy ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${f.color} mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{f.label}</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{f.aspect}</p>
                <p className="text-slate-400 text-xs mt-1">{f.description}</p>
                {isSel && <CheckCircle2 className="w-5 h-5 text-indigo-500 absolute top-4 right-4" />}
              </button>
            )
          })}
        </div>

        {/* Action */}
        <div className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.03] border border-white/10">
          <div className="flex flex-col">
            <span className="text-[var(--text-main)] text-lg font-black tracking-tight">
              {selected.length} format{selected.length === 1 ? '' : 's'} selected
            </span>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
              Subject-aware reframe · per-platform copy
            </span>
          </div>
          <motion.button
            whileHover={{ scale: isBusy ? 1 : 1.04 }}
            whileTap={{ scale: isBusy ? 1 : 0.96 }}
            disabled={isBusy || selected.length === 0}
            onClick={start}
            className={`h-14 px-8 rounded-2xl flex items-center gap-3 text-white font-black uppercase tracking-[0.15em] transition-all ${
              isBusy ? 'bg-slate-700 opacity-60 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30'
            }`}
          >
            {isBusy ? (<><Loader2 className="w-5 h-5 animate-spin" /> Working…</>) : (<><Play className="w-5 h-5 fill-current" /> Repurpose</>)}
          </motion.button>
        </div>

        {/* Variant results */}
        <AnimatePresence>
          {variants.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {variants.map((v) => (
                <div key={v.jobId} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[var(--text-main)] uppercase tracking-tight">{v.platformLabel}</span>
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{v.ratio}</span>
                      </div>
                      <p className="text-slate-300 text-sm mt-2 font-semibold">“{v.hook}”</p>
                      <p className="text-slate-400 text-xs mt-1">{v.title}</p>
                      <p className="text-slate-500 text-xs mt-1">{v.description}</p>
                      {!!(v.hashtags && v.hashtags.length) && (
                        <p className="text-indigo-400/80 text-xs mt-1">{v.hashtags.join(' ')}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {v.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 className="w-4 h-4" /> Ready</span>
                      ) : v.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-400 text-[10px] font-black uppercase tracking-widest"><AlertCircle className="w-4 h-4" /> Failed</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-indigo-400 text-[10px] font-black uppercase tracking-widest"><Loader2 className="w-4 h-4 animate-spin" /> Rendering</span>
                      )}
                      <button
                        onClick={() => copy(`${v.hook}\n\n${v.title}\n\n${v.description}\n${(v.hashtags || []).join(' ')}`)}
                        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy caption
                      </button>
                    </div>
                  </div>
                  {v.status === 'completed' && (
                    <div className="mt-4 flex items-center gap-4">
                      <video src={variantFileUrl(v.jobId)} controls preload="metadata" className="h-40 rounded-xl border border-white/10 bg-black" />
                      <a
                        href={variantFileUrl(v.jobId)}
                        download={`click-${v.platform}-${v.ratio.replace(':', 'x')}.mp4`}
                        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default RepurposeView
