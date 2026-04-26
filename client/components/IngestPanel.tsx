'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Link as LinkIcon, Video as VideoIcon, Camera, Clipboard,
  HardDrive, RefreshCw, Loader2, Check, X, AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { apiGet, apiPost, API_URL } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useWorkflow } from '../contexts/WorkflowContext'
import { useTranslation } from '../hooks/useTranslation'

type Tab = 'file' | 'link' | 'record' | 'cloud' | 'remix'

interface RecentItem { id: string; title: string; fileUrl?: string; createdAt?: string }

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'file',   label: 'Upload',     icon: Upload },
  { id: 'link',   label: 'Paste link', icon: LinkIcon },
  { id: 'record', label: 'Record',     icon: Camera },
  { id: 'cloud',  label: 'Cloud',      icon: HardDrive },
  { id: 'remix',  label: 'Remix',      icon: RefreshCw },
]

const PLATFORM_HINTS = [
  'youtu.be / youtube.com', 'tiktok.com', 'instagram.com', 'x.com / twitter.com',
  'facebook.com', 'vimeo.com', 'or any direct .mp4 / .mov / .webm URL',
]

interface Props {
  /** Optional override route to send users to after a successful ingest. Defaults to the editor for the new contentId. */
  redirectTo?: (contentId: string) => string
  /** Compact mode hides the "Recently ingested" footer. */
  compact?: boolean
}

export default function IngestPanel({ redirectTo, compact = false }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const { setProject, completeStage } = useWorkflow()
  const { t } = useTranslation()
  // Keep `t` in a ref so callbacks captured by `useCallback` always read the
  // current translation. Without this, switching language won't refresh error
  // messages or toasts already bound into a callback's closure.
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

  // ── File upload (multipart) ──────────────────────────────────────────────
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

  // ── URL ingest ───────────────────────────────────────────────────────────
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

  // ── Clipboard auto-detect ─────────────────────────────────────────────────
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

  // ── Webcam record ─────────────────────────────────────────────────────────
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

  // ── Remix recents ────────────────────────────────────────────────────────
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

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      if (!/^video\//.test(f.type)) { setError(tr('ingest.errors.notVideo', 'Drop a video file (.mp4 / .mov / .webm)')); return }
      uploadFile(f)
    }
  }, [uploadFile, tr])

  // ── Render ───────────────────────────────────────────────────────────────
  const platforms = useMemo(() => PLATFORM_HINTS.join(' • '), [])

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-2xl shadow-[0_30px_120px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-white/[0.06] overflow-x-auto custom-scrollbar">
        {TABS.map(tabDef => {
          const active = tabDef.id === tab
          return (
            <button
              key={tabDef.id}
              type="button"
              onClick={() => { setTab(tabDef.id); setError(null) }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-xl text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap transition-all ${
                active
                  ? 'bg-white/[0.06] text-white border-t border-x border-white/10'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <tabDef.icon size={12} className={active ? 'text-fuchsia-300' : ''} />
              {TAB_LABELS[tabDef.id]}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2 pr-2">
          <button type="button" onClick={handlePaste} title={tr('ingest.paste', 'Paste')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[9px] font-bold text-slate-400 hover:text-white hover:border-white/20 transition-all">
            <Clipboard size={10} /> {tr('ingest.paste', 'Paste')}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 lg:p-8 min-h-[280px] relative">
        {busy && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-b-3xl">
            <Loader2 size={28} className="text-fuchsia-400 animate-spin" />
            <p className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
              {progress != null
                ? tr('ingest.uploading', 'Uploading {percent}%', { percent: progress })
                : tr('ingest.processing', 'Processing…')}
            </p>
            {progress != null && (
              <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-violet-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        {tab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed transition-all p-10 lg:p-14 flex flex-col items-center justify-center text-center gap-4 ${
              dragOver
                ? 'border-fuchsia-400/60 bg-fuchsia-500/[0.06]'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Upload size={22} className="text-fuchsia-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{tr('ingest.dropTitle', 'Drop a video here')}</h3>
              <p className="text-[11px] text-slate-400 mt-1">{tr('ingest.dropHint', 'Or pick a file from your computer. MP4, MOV, WebM up to 500MB.')}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              aria-label="Choose a video file to upload"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-full bg-white text-black text-[11px] font-black uppercase tracking-[0.18em] hover:bg-fuchsia-50 transition-colors">
              {tr('ingest.chooseFile', 'Choose file')}
            </button>
          </div>
        )}

        {tab === 'link' && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{tr('ingest.linkLabel', 'Video URL')}</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder={tr('ingest.linkPlaceholder', 'https://www.tiktok.com/@user/video/12345 or https://cdn/clip.mp4')}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-fuchsia-500/40 focus:outline-none"
                />
                <button type="button" onClick={() => ingestUrl(linkValue)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white text-[11px] font-black uppercase tracking-[0.18em] shadow-lg hover:shadow-fuchsia-500/30">
                  {tr('ingest.linkAction', 'Ingest')}
                </button>
              </div>
            </label>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex gap-3 items-start">
              <VideoIcon size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: tr('ingest.linkSupports',
                   'Supports {platforms}. Platform downloads need {ytdlp} on the server.',
                   { platforms: `<span class="text-slate-300">${platforms}</span>`, ytdlp: '<code class="text-fuchsia-300">yt-dlp</code>' }) }}
              />
            </div>
          </div>
        )}

        {tab === 'record' && (
          <div className="space-y-4">
            <video ref={recordVideoRef} className="w-full rounded-2xl border border-white/10 bg-black aspect-video" muted playsInline />
            <div className="flex items-center gap-3">
              {!recording ? (
                <button type="button" onClick={startRecording}
                  className="px-5 py-2.5 rounded-full bg-rose-500 text-white text-[11px] font-black uppercase tracking-[0.18em] hover:bg-rose-600 flex items-center gap-2">
                  <Camera size={13} /> {tr('ingest.recordStart', 'Start recording')}
                </button>
              ) : (
                <button type="button" onClick={stopRecording}
                  className="px-5 py-2.5 rounded-full bg-white text-black text-[11px] font-black uppercase tracking-[0.18em] hover:bg-rose-50 flex items-center gap-2">
                  <Check size={13} /> {tr('ingest.recordStop', 'Stop & upload')}
                </button>
              )}
              <p className="text-[10px] text-slate-500">{tr('ingest.recordHint', 'Camera + mic — saved as WebM, then uploaded to your library.')}</p>
            </div>
          </div>
        )}

        {tab === 'cloud' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed"
               dangerouslySetInnerHTML={{ __html: tr('ingest.cloudHint',
                 'Paste a Google Drive, Dropbox, or S3 share link below. We download the file server-side, so the share must be set to {visibility}.',
                 { visibility: `<span class="text-white">${tr('ingest.cloudVisibility', 'Anyone with the link → can view')}</span>` }) }}
            />
            <div className="flex items-center gap-2">
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder={tr('ingest.cloudPlaceholder', 'https://drive.google.com/file/d/…/view')}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-fuchsia-500/40 focus:outline-none"
              />
              <button type="button" onClick={() => ingestUrl(linkValue, 'cloud')}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.18em]">
                {tr('ingest.cloudAction', 'Pull')}
              </button>
            </div>
          </div>
        )}

        {tab === 'remix' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-400">{tr('ingest.remixHint', 'Pick a previous project to clone into a fresh edit.')}</p>
              <button type="button" onClick={loadRecents}
                className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 hover:text-white flex items-center gap-1">
                <RefreshCw size={10} /> {tr('ingest.remixRefresh', 'Refresh')}
              </button>
            </div>
            {recents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-[11px] text-slate-500">
                {tr('ingest.remixEmpty', 'No previous ingests yet — upload your first video to start a remix-able library.')}
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {recents.map(r => (
                  <li key={r.id}>
                    <button type="button" onClick={() => remix(r.id)}
                      className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.04] transition-all flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 flex items-center justify-center flex-shrink-0">
                        <RefreshCw size={13} className="text-fuchsia-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate">{r.title}</p>
                        <p className="text-[9px] text-slate-500 truncate">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 flex items-start gap-2">
            <AlertCircle size={13} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-200 leading-relaxed flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} title="Dismiss error" aria-label="Dismiss error" className="text-rose-300 hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <div className="px-6 py-3 border-t border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
          <span className="font-black uppercase tracking-[0.22em] text-slate-400">{tr('ingest.tip', 'Tip')}</span>
          <span>{tr('ingest.tipPaste', '⌘V on this page to paste a clipboard URL.')}</span>
          <span className="hidden md:inline">{tr('ingest.tipReversible', 'All ingests appear in your Asset Library and are reversible.')}</span>
        </div>
      )}
    </div>
  )
}
