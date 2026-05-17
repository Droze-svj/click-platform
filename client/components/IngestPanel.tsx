'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Link as LinkIcon, Video as VideoIcon, Camera, Clipboard,
  HardDrive, RefreshCw, Loader2, Check, X, AlertCircle, Monitor,
  type LucideIcon,
  Cloud,
  Layers,
  Activity,
  Zap,
  Terminal,
  Database,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  ChevronRight
} from 'lucide-react'
import { apiGet, apiPost, API_URL } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useWorkflow } from '../contexts/WorkflowContext'
import { useTranslation } from '../hooks/useTranslation'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'file' | 'link' | 'record' | 'screen' | 'cloud' | 'remix'

interface RecentItem { id: string; title: string; fileUrl?: string; createdAt?: string }

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'file',   label: 'Upload',     icon: Upload },
  { id: 'link',   label: 'Paste link', icon: LinkIcon },
  { id: 'record', label: 'Record',     icon: Camera },
  { id: 'screen', label: 'Screen',     icon: Monitor },
  { id: 'cloud',  label: 'Cloud',      icon: HardDrive },
  { id: 'remix',  label: 'Remix',      icon: RefreshCw },
]

const PLATFORM_HINTS = [
  'youtu.be / youtube.com', 'tiktok.com', 'instagram.com', 'x.com / twitter.com',
  'facebook.com', 'vimeo.com', 'or any direct .mp4 / .mov / .webm URL',
]

interface Props {
  redirectTo?: (contentId: string) => string
  compact?: boolean
}

export default function IngestPanel({ redirectTo, compact = false }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const { setProject, completeStage } = useWorkflow()
  const { t } = useTranslation()
  const tRef = useRef(t)
  useEffect(() => { tRef.current = t }, [t])
  const tr = useCallback((key: string, fallback: string, vars?: Record<string, string | number>) => {
    let v = tRef.current(key); if (v === key) v = fallback
    if (vars) for (const [k, val] of Object.entries(vars)) v = v.replace(new RegExp(`\\{${k}\\}`, 'g'), String(val))
    return v
  }, [])
  const TAB_LABELS: Record<Tab, string> = {
    file: tr('ingest.tabs.file', 'Upload'),
    link: tr('ingest.tabs.link', 'Paste link'),
    record: tr('ingest.tabs.record', 'Record'),
    screen: tr('ingest.tabs.screen', 'Screen'),
    cloud: tr('ingest.tabs.cloud', 'Cloud'),
    remix: tr('ingest.tabs.remix', 'Remix'),
  }

  const [tab, setTab] = useState<Tab>('file')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [recents, setRecents] = useState<RecentItem[]>([])

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const recordVideoRef = useRef<HTMLVideoElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)

  const goToEditor = useCallback((contentId: string, title?: string) => {
    setProject({ id: contentId, title: title || 'Untitled', updatedAt: Date.now() })
    completeStage('ingest')
    const target = redirectTo ? redirectTo(contentId) : `/dashboard/video/edit/${contentId}`
    router.push(target)
  }, [router, setProject, completeStage, redirectTo])

  const uploadFile = useCallback(async (file: File) => {
    setError(null); setBusy(true); setProgress(0)
    try {
      const fd = new FormData()
      fd.append('video', file)
      fd.append('title', file.name.replace(/\.[^.]+$/, ''))
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const lang = typeof window !== 'undefined'
        ? (() => { try { return JSON.parse(localStorage.getItem('click-user-preferences') || '{}')?.language as string | undefined } catch { return undefined } })()
        : undefined
      const xhr = new XMLHttpRequest()
      const result: { contentId?: string } = await new Promise((resolve, reject) => {
        xhr.open('POST', `${API_URL}/video/upload`)
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        if (lang) xhr.setRequestHeader('X-Click-Language', lang)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && json.success !== false) {
              resolve(json.data || json)
            } else {
              reject(new Error(json.error || json.message || `HTTP ${xhr.status}`))
            }
          } catch (e: any) { reject(e) }
        }
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(fd)
      })
      if (!result.contentId) throw new Error(tr('ingest.errors.noContentId', 'Server did not return a contentId'))
      showToast(`✓ ${file.name}`, 'success')
      goToEditor(result.contentId, file.name)
    } catch (e: any) {
      setError(e?.message || tr('ingest.errors.uploadFailed', 'Upload failed: {message}', { message: '' }))
      showToast(tr('ingest.errors.uploadFailed', 'Upload failed: {message}', { message: e?.message || 'unknown' }), 'error')
    } finally {
      setBusy(false); setProgress(null)
    }
  }, [showToast, goToEditor, tr])

  const ingestUrl = useCallback(async (url: string, channel: 'link' | 'clipboard' | 'cloud' = 'link') => {
    if (!url) { setError(tr('ingest.errors.noUrl', 'Paste a video URL first')); return }
    setError(null); setBusy(true)
    try {
      const endpoint = channel === 'clipboard' ? '/ingest/clipboard' : '/ingest/url'
      const res = await apiPost<{ data: { contentId: string } }>(endpoint, { url })
      const contentId = (res as any)?.data?.contentId || (res as any)?.contentId
      if (!contentId) throw new Error(tr('ingest.errors.noContentId', 'Server did not return a contentId'))
      showToast(`✓ ${new URL(url).host}`, 'success')
      goToEditor(contentId, url)
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || ''
      setError(msg)
      showToast(tr('ingest.errors.ingestFailed', 'Ingest failed: {message}', { message: msg || 'unknown' }), 'error')
    } finally {
      setBusy(false)
    }
  }, [showToast, goToEditor, tr])

  const handlePaste = useCallback(async () => {
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      if (!text) { setError(tr('ingest.errors.clipboardEmpty', 'Clipboard is empty')); return }
      if (/^https?:\/\//i.test(text.trim())) {
        setLinkValue(text.trim())
        await ingestUrl(text.trim(), 'clipboard')
      } else {
        setError(tr('ingest.errors.clipboardNotUrl', 'Clipboard does not contain a URL'))
      }
    } catch {
      setError(tr('ingest.errors.clipboardDenied', 'Clipboard access denied — paste manually instead'))
    }
  }, [ingestUrl, tr])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      if (recordVideoRef.current) {
        recordVideoRef.current.srcObject = stream
        await recordVideoRef.current.play()
      }
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
      recordChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recordChunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'video/webm' })
        await uploadFile(file)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e: any) {
      setError(e?.message || tr('ingest.errors.cameraDenied', 'Could not access camera/mic'))
    }
  }, [uploadFile, tr])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const startScreenRecording = useCallback(async () => {
    setError(null)
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as any,
        audio: true,
      })
      let micStream: MediaStream | null = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
      }
      const tracks: MediaStreamTrack[] = [...display.getVideoTracks()]
      const audioTracks = [...display.getAudioTracks(), ...(micStream?.getAudioTracks() || [])]
      tracks.push(...audioTracks)
      const composite = new MediaStream(tracks)
      if (recordVideoRef.current) {
        recordVideoRef.current.srcObject = composite
        await recordVideoRef.current.play().catch(() => { })
      }
      const mr = new MediaRecorder(composite, { mimeType: 'video/webm;codecs=vp9,opus' })
      recordChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        composite.getTracks().forEach(t => t.stop())
        micStream?.getTracks().forEach(t => t.stop())
        const blob = new Blob(recordChunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `screen-${Date.now()}.webm`, { type: 'video/webm' })
        await uploadFile(file)
      }
      display.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
        setRecording(false)
      })
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e: any) {
      setError(e?.message || tr('ingest.errors.screenDenied', 'Could not start screen share'))
    }
  }, [uploadFile, tr])

  const loadRecents = useCallback(async () => {
    try {
      const res = await apiGet<{ data: RecentItem[] }>('/ingest/recent')
      setRecents((res as any)?.data || [])
    } catch {
      setRecents([])
    }
  }, [])

  const remix = useCallback(async (contentId: string) => {
    setBusy(true); setError(null)
    try {
      const res = await apiPost<{ data: { contentId: string } }>('/ingest/remix', { contentId })
      const newId = (res as any)?.data?.contentId
      if (!newId) throw new Error('Remix failed')
      goToEditor(newId, 'Remix')
    } catch (e: any) {
      setError(e?.message || 'Remix failed')
    } finally { setBusy(false) }
  }, [goToEditor])

  useEffect(() => { if (tab === 'remix') loadRecents() }, [tab, loadRecents])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      if (!/^video\//.test(f.type)) { setError(tr('ingest.errors.notVideo', 'Drop a video file (.mp4 / .mov / .webm)')); return }
      uploadFile(f)
    }
  }, [uploadFile, tr])

  const platforms = useMemo(() => PLATFORM_HINTS.join(' • '), [])

  return (
    <div className="rounded-[3.5rem] bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 shadow-2xl overflow-hidden group transition-all duration-500">
      {/* HUD Tabs */}
      <nav className="flex items-center gap-1 p-3 bg-surface-page dark:bg-surface-950/40 border-b-2 border-surface-100 dark:border-surface-800 overflow-x-auto custom-scrollbar">
        {TABS.map(tabDef => {
          const active = tabDef.id === tab
          return (
            <button type="button" key={tabDef.id} onClick={() => { setTab(tabDef.id); setError(null) }}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-500 relative group/tab ${
                active ? 'bg-primary-500 text-white shadow-lg' : 'text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-page dark:hover:bg-surface-900'
              }`}
            >
              <tabDef.icon size={16} className={active ? 'text-white' : 'text-surface-300 dark:text-slate-800 group-hover/tab:text-primary-500'} />
              {TAB_LABELS[tabDef.id]}
            </button>
          )
        })}
        <div className="ml-auto hidden sm:flex items-center gap-4 pr-4">
          <button type="button" onClick={handlePaste} className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-surface-card dark:bg-surface-900 border-2 border-surface-100 dark:border-surface-800 text-[9px] font-black text-surface-400 dark:text-slate-600 hover:text-primary-500 hover:border-primary-500/30 transition-all uppercase tracking-widest italic shadow-sm active:scale-95">
            <Clipboard size={12} /> {tr('ingest.paste', 'Paste_Uplink')}
          </button>
        </div>
      </nav>

      {/* Operation Chamber */}
      <div className="p-8 lg:p-12 min-h-[350px] relative flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 bg-surface-page/80 dark:bg-surface-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 rounded-b-[3.5rem]">
               <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <Cloud size={32} className="text-primary-500 animate-pulse" />
                  </div>
               </div>
               <div className="text-center space-y-2">
                  <p className="text-sm font-black text-surface-900 dark:text-white uppercase tracking-[0.4em] italic">
                    {progress != null ? tr('ingest.uploading', 'UPLOADING_{percent}%', { percent: progress }) : tr('ingest.processing', 'PROCESSING_PIPELINE...')}
                  </p>
                  <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest italic">NEURAL_SYNC_EN_ROUTE</p>
               </div>
               {progress != null && (
                 <div className="w-64 h-2 bg-surface-card dark:bg-surface-900 rounded-full overflow-hidden shadow-inner border border-surface-100 dark:border-surface-800">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-primary-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-[width] duration-300" />
                 </div>
               )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={tab} className="w-full">
              {tab === 'file' && (
                <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                  className={`rounded-[3rem] border-4 border-dashed transition-all p-12 lg:p-16 flex flex-col items-center justify-center text-center gap-8 shadow-inner ${
                    dragOver ? 'border-primary-500 bg-primary-500/5' : 'border-surface-100 dark:border-surface-800 bg-surface-page/50 dark:bg-surface-950/40 hover:border-primary-500/30'
                  }`}
                >
                  <div className="w-20 h-20 rounded-[2rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-1000">
                    <Upload size={36} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic leading-none mb-4">{tr('ingest.dropTitle', 'Drop Payload')}</h3>
                    <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 uppercase tracking-widest italic leading-relaxed max-w-sm mx-auto">{tr('ingest.dropHint', 'MP4, MOV, WebM up to 500MB. Direct hardware ingestion enabled.')}</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="video/*" title="Choose file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="px-10 py-5 rounded-2xl bg-surface-900 dark:bg-white text-white dark:text-black text-[12px] font-black uppercase tracking-[0.4em] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all shadow-2xl active:scale-95 italic border-none">
                    {tr('ingest.chooseFile', 'Browse_Assets')}
                  </button>
                </div>
              )}

              {tab === 'link' && (
                <div className="space-y-8 p-4">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.6em] text-surface-400 dark:text-slate-600 italic pl-4 flex items-center gap-4">
                       <LinkIcon size={16} className="text-primary-500" /> {tr('ingest.linkLabel', 'TEMPORAL_UPLINK_URL')}
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://tiktok.com/@user/video/..."
                        className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] px-8 py-6 text-sm font-black italic text-surface-900 dark:text-white placeholder:text-surface-200 dark:placeholder:text-slate-900 focus:border-primary-500/40 outline-none shadow-inner transition-all"
                      />
                      <button type="button" onClick={() => ingestUrl(linkValue)}
                        className="w-full sm:w-auto px-12 py-6 rounded-[2rem] bg-primary-600 text-white text-[12px] font-black uppercase tracking-[0.6em] shadow-2xl hover:bg-primary-500 transition-all italic border-none active:scale-95">
                        {tr('ingest.linkAction', 'Sync')}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-[2rem] border-2 border-surface-100 dark:border-surface-800 bg-surface-page/30 dark:bg-surface-950/20 p-8 flex gap-6 items-start shadow-inner backdrop-blur-xl">
                    <VideoIcon size={20} className="text-primary-500 flex-shrink-0 mt-1" />
                    <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 leading-relaxed uppercase tracking-widest italic"
                       dangerouslySetInnerHTML={{ __html: tr('ingest.linkSupports',
                         'Supports {platforms}. Automated lattice extraction enabled.',
                         { platforms: `<span class="text-primary-500 font-black">${platforms}</span>` }) }}
                    />
                  </div>
                </div>
              )}

              {tab === 'record' && (
                <div className="space-y-8 p-4">
                  <div className="relative group/camera overflow-hidden rounded-[2.5rem] border-2 border-surface-100 dark:border-surface-800 bg-black shadow-2xl aspect-video">
                     <video ref={recordVideoRef} className="w-full h-full object-cover" muted playsInline />
                     {!recording && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                           <Camera size={64} className="text-white/20 group-hover/camera:scale-110 group-hover/camera:text-primary-500 transition-all duration-1000" />
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-6 flex-wrap justify-between">
                    <div className="flex gap-4">
                       {!recording ? (
                         <button type="button" onClick={startRecording}
                           className="px-10 py-5 rounded-[1.8rem] bg-rose-600 text-white text-[11px] font-black uppercase tracking-[0.4em] hover:bg-rose-500 transition-all shadow-2xl flex items-center gap-4 italic border-none active:scale-95">
                           <div className="w-3 h-3 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]" /> {tr('ingest.recordStart', 'Initialize_Rec')}
                         </button>
                       ) : (
                         <button type="button" onClick={stopRecording}
                           className="px-10 py-5 rounded-[1.8rem] bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl flex items-center gap-4 italic border-none active:scale-95">
                           <Check size={18} /> {tr('ingest.recordStop', 'Abort_&_Uplink')}
                         </button>
                       )}
                    </div>
                    <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 uppercase tracking-widest italic">{tr('ingest.recordHint', 'Sovereign camera + mic access — encrypted WebM buffer.')}</p>
                  </div>
                </div>
              )}

              {tab === 'screen' && (
                <div className="space-y-8 p-4">
                  <div className="relative group/screen overflow-hidden rounded-[2.5rem] border-2 border-surface-100 dark:border-surface-800 bg-black shadow-2xl aspect-video">
                     <video ref={recordVideoRef} className="w-full h-full object-cover" muted playsInline />
                     {!recording && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                           <Monitor size={64} className="text-white/20 group-hover/screen:scale-110 group-hover/screen:text-primary-500 transition-all duration-1000" />
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-6 flex-wrap justify-between">
                    <div className="flex gap-4">
                       {!recording ? (
                         <button type="button" onClick={startScreenRecording}
                           className="px-10 py-5 rounded-[1.8rem] bg-primary-600 text-white text-[11px] font-black uppercase tracking-[0.4em] hover:bg-primary-500 transition-all shadow-2xl flex items-center gap-4 italic border-none active:scale-95">
                           <Monitor size={18} /> {tr('ingest.screenStart', 'Share_Lattice')}
                         </button>
                       ) : (
                         <button type="button" onClick={stopRecording}
                           className="px-10 py-5 rounded-[1.8rem] bg-white text-black text-[11px] font-black uppercase tracking-[0.4em] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl flex items-center gap-4 italic border-none active:scale-95">
                           <Check size={18} /> {tr('ingest.screenStop', 'Abort_&_Uplink')}
                         </button>
                       )}
                    </div>
                    <p className="text-[11px] font-bold text-surface-400 dark:text-slate-600 uppercase tracking-widest italic max-w-md">{tr('ingest.screenHint', 'Capture tab, window, or full mesh. Multi-track audio support.')}</p>
                  </div>
                </div>
              )}

              {tab === 'cloud' && (
                <div className="space-y-8 p-4">
                  <p className="text-[12px] font-bold text-surface-400 dark:text-slate-600 leading-relaxed uppercase tracking-tight italic pl-4 border-l-4 border-primary-500/20"
                     dangerouslySetInnerHTML={{ __html: tr('ingest.cloudHint',
                       'Google Drive, Dropbox, or S3 share link. High-speed server-side retrieval — ensure {visibility}.',
                       { visibility: `<span class="text-primary-500 font-black">${tr('ingest.cloudVisibility', 'Public Access')}</span>` }) }}
                  />
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://drive.google.com/..."
                      className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[2rem] px-8 py-6 text-sm font-black italic text-surface-900 dark:text-white focus:border-primary-500/40 outline-none shadow-inner transition-all"
                    />
                    <button type="button" onClick={() => ingestUrl(linkValue, 'cloud')}
                      className="w-full sm:w-auto px-12 py-6 rounded-[2rem] bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-[12px] font-black uppercase tracking-[0.6em] shadow-2xl hover:bg-sky-400 transition-all italic border-none active:scale-95">
                      {tr('ingest.cloudAction', 'Fetch')}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'remix' && (
                <div className="space-y-6 p-2">
                  <div className="flex items-center justify-between px-4">
                    <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic">{tr('ingest.remixHint', 'RECLONE_EXISTING_NODE')}</p>
                    <button type="button" onClick={loadRecents}
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 hover:text-primary-400 flex items-center gap-3 transition-all">
                      <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-700" /> {tr('ingest.remixRefresh', 'Sync_Ledger')}
                    </button>
                  </div>
                  {recents.length === 0 ? (
                    <div className="rounded-[2.5rem] border-4 border-dashed border-surface-100 dark:border-surface-800 bg-surface-page/50 dark:bg-surface-950/20 p-16 text-center text-[12px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic shadow-inner">
                      {tr('ingest.remixEmpty', 'NULL_HISTORY_DETECTED')}
                    </div>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-4">
                      {recents.map(r => (
                        <li key={r.id}>
                          <button type="button" onClick={() => remix(r.id)}
                            className="w-full text-left p-6 rounded-2xl border-2 border-surface-100 dark:border-surface-800 bg-surface-card dark:bg-surface-900 hover:border-primary-500/40 hover:bg-surface-page dark:hover:bg-surface-950 transition-all flex items-center gap-6 shadow-md group/item">
                            <div className="w-12 h-12 rounded-xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center flex-shrink-0 group-hover/item:rotate-12 transition-transform">
                              <RefreshCw size={20} className="text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-surface-900 dark:text-white truncate uppercase italic tracking-tighter group-hover/item:text-primary-500 transition-colors">{r.title}</p>
                              <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest mt-1">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase() : '—'}
                              </p>
                            </div>
                            <ChevronRight size={18} className="text-surface-200 dark:text-slate-900 group-hover/item:text-primary-500 transition-all" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 rounded-2xl border-2 border-rose-500/30 bg-rose-500/10 p-6 flex items-start gap-4 shadow-xl backdrop-blur-xl relative overflow-hidden group/error">
             <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
             <AlertCircle size={22} className="text-rose-500 flex-shrink-0 mt-1 relative z-10" />
             <div className="flex-1 relative z-10">
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic mb-1">SYSTEM_FAULT_DETECTED</p>
                <p className="text-sm font-black text-rose-200 leading-relaxed italic uppercase tracking-tighter">{error}</p>
             </div>
             <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" title="Dismiss error" className="text-rose-400 hover:text-white transition-all relative z-10 hover:rotate-90">
               <X size={20} />
             </button>
          </motion.div>
        )}
      </div>

      {!compact && (
        <div className="px-8 py-5 bg-surface-page dark:bg-surface-950/60 border-t-2 border-surface-100 dark:border-surface-800 flex flex-wrap items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              <p className="text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4em] italic leading-none">
                <span className="text-primary-500">TUTORIAL_CORE:</span> {tr('ingest.tipPaste', 'PASTE_URL (⌘V) ON THIS HUD FOR AUTO-SYNC.')}
              </p>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                 <ShieldCheck size={14} className="text-emerald-500" />
                 <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.3em] italic">SECURE_TUNNEL</span>
              </div>
              <div className="flex items-center gap-3">
                 <Zap size={14} className="text-amber-500" />
                 <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.3em] italic">HIGH_VELOCITY</span>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
