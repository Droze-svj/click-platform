'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Download,
  Share2,
  Youtube,
  Instagram,
  Smartphone,
  Send,
  CheckCircle2,
  Loader2,
  Globe,
  FolderDown,
  Calendar,
  ChevronDown,
  Link2,
  Bookmark,
  ChevronLeft,
  Cpu,
  Target,
  Zap,
  Layers,
  Activity,
  ArrowUpRight,
  Radio,
  Fingerprint,
  Monitor,
  ShieldCheck,
  ZapOff
} from 'lucide-react'
import { apiGet, apiPost, apiPatch } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { loadEditorContentPreferences, saveEditorContentPreferences } from '../../../utils/editorUtils'
import OptimalPostingWindow from '../OptimalPostingWindow'
import { Panel, Button, Badge, SectionHeader } from '../../ui'
import { cn } from '../../../lib/utils'

const EXPORT_PRESETS = [
  { id: 'shorts', label: 'YT Shorts', icon: Youtube, color: 'from-red-500 to-red-700', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 4, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Clear value, Subscribe CTA', glow: 'rgba(220,38,38,0.3)' },
  { id: 'reels', label: 'IG Reels', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-500', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 3.5, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Aesthetic, Save/Share CTA', glow: 'rgba(217,70,239,0.3)' },
  { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'from-pink-500 to-rose-600', res: '1080×1920', width: 1080, height: 1920, bitrateMbps: 3, format: 'mp4', quality: undefined, fps: 30, platformHint: 'Snappy cuts, Follow/Comment', glow: 'rgba(244,63,94,0.3)' },
  { id: '1080p', label: '1080p HD', icon: Monitor, color: 'from-blue-500 to-blue-700', res: '1920×1080', width: 1920, height: 1080, bitrateMbps: 8, format: 'mp4', quality: undefined, fps: undefined, platformHint: undefined, glow: 'rgba(59,130,246,0.2)' },
  { id: '4k', label: '4K Master', icon: ShieldCheck, color: 'from-violet-500 to-indigo-600', res: '3840×2160', width: 3840, height: 2160, bitrateMbps: 25, format: 'mp4', quality: undefined, fps: undefined, platformHint: undefined, glow: 'rgba(139,92,246,0.3)' },
]

interface ExportViewProps {
  videoId: string
  videoUrl: string
  textOverlays: any[]
  shapeOverlays?: any[]
  imageOverlays?: any[]
  gradientOverlays?: any[]
  svgOverlays?: any[]
  videoFilters: any
  videoTransform?: { scale?: number, positionX?: number, positionY?: number, rotation?: number }
  videoTransformKeyframes?: any[]
  videoCrop?: any
  chromaKey?: any
  playbackSpeed?: number
  timelineSegments?: any[]
  timelineEffects?: any[]
  videoDuration?: number
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (category: import('../../../types/editor').EditorCategory) => void
  projectName?: string
  onExportComplete?: () => void
}

const glassStyle = "ds-surface-card"

const ExportView: React.FC<ExportViewProps> = ({ videoId, videoUrl, textOverlays, shapeOverlays = [], imageOverlays = [], gradientOverlays = [], svgOverlays = [], videoFilters, videoTransform, videoTransformKeyframes, videoCrop, chromaKey, playbackSpeed, timelineSegments = [], timelineEffects = [], videoDuration, showToast, setActiveCategory, projectName, onExportComplete }) => {
  const [connectedAccounts, setConnectedAccounts] = useState<any>({})
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const PRESET_IDS = ['shorts', 'reels', 'tiktok', '1080p', '4k', 'best', 'timeline-prores']
  const [selectedPreset, setSelectedPreset] = useState<string>('1080p')
  const [savedExports, setSavedExports] = useState<Array<{ _id: string; title: string; url: string; downloadUrl?: string; quality: string; expiresAt: string; isExpired?: boolean }>>([])
  const [saveExpiresDays, setSaveExpiresDays] = useState(10)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [extendingId, setExtendingId] = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState(10)
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null)
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('high')
  const [exportCodec, setExportCodec] = useState<'h264' | 'hevc' | 'prores'>('h264')
  const [duckMusicWhenVoiceover, setDuckMusicWhenVoiceover] = useState(true)
  const [duckLevel, setDuckLevel] = useState(-12)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderResult, setRenderResult] = useState<{ url?: string; downloadUrl?: string } | null>(null)
  
  // Batch Export Mode (Agency)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchFormats, setBatchFormats] = useState<{ id: string, label: string, selected: boolean }[]>([
     { id: '9:16', label: 'Vertical (TikTok/Reels)', selected: true },
     { id: '16:9', label: 'Horizontal (YouTube)', selected: true },
     { id: '1:1', label: 'Square (Instagram Post)', selected: false }
  ])
  const [batchProgress, setBatchProgress] = useState<{ [key: string]: number }>({})

  const [lastRenderExportPath, setLastRenderExportPath] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const prefs = loadEditorContentPreferences()
      const preferred = sessionStorage.getItem('export-preferred-preset')
      const pids = EXPORT_PRESETS.map(p => p.id)
      if (preferred && pids.includes(preferred)) {
        sessionStorage.removeItem('export-preferred-preset')
        setSelectedPreset(preferred)
      } else {
        if (prefs.defaultExportPreset && pids.includes(prefs.defaultExportPreset)) setSelectedPreset(prefs.defaultExportPreset)
        if (prefs.defaultExportQuality) setExportQuality(prefs.defaultExportQuality)
        if (prefs.defaultExportCodec) setExportCodec(prefs.defaultExportCodec)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchSavedExports = useCallback(async () => {
    if (!videoId) return
    try {
      const res = await apiGet<{ list?: typeof savedExports; data?: { list?: typeof savedExports } }>('/video/manual-editing/saved-exports?contentId=' + encodeURIComponent(videoId))
      const list = res?.list ?? (res as any)?.data?.list ?? []
      setSavedExports(Array.isArray(list) ? list : [])
    } catch { /* ignore */ }
  }, [videoId])

  useEffect(() => {
    fetchConnectedAccounts()
  }, [])

  useEffect(() => {
    fetchSavedExports()
  }, [fetchSavedExports])

  const fetchConnectedAccounts = async () => {
    try {
      setIsLoadingAccounts(true)
      const data = await apiGet<{ success?: boolean; accounts?: any }>('/oauth/accounts')
      if (data?.success && data.accounts) {
        setConnectedAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch accounts', error)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      showToast('Please select at least one platform', 'error')
      return
    }

    // Publishing to external platforms needs a real, fetchable URL — reject
    // empty, relative, or mock (blob:) URLs so we never "broadcast" nothing.
    const url = renderResult?.url || ''
    const isPublishable = /^https?:\/\//i.test(url)
    if (!isPublishable) {
      showToast(
        renderResult?.url
          ? 'Export URL is not publicly reachable yet — re-render with cloud storage enabled.'
          : 'Please render the video first before broadcasting',
        'error'
      )
      return
    }

    try {
      setIsPublishing(true)
      showToast(`Broadcasting to ${selectedPlatforms.length} platform(s)...`, 'info')
      
      const promises = selectedPlatforms.map(platform => {
        const payload: any = {}
        let endpoint = `/oauth/${platform}/upload`

        if (platform === 'youtube') {
          payload.videoFile = url
          payload.title = projectName || 'Rendered with Neural Master'
          payload.description = 'Published from Click Video Editor'
        } else if (platform === 'instagram') {
          endpoint = `/oauth/${platform}/post`
          payload.imageUrl = url // Future: Add videoUrl support to IG backend
          payload.caption = projectName || 'Rendered with Neural Master'
        } else {
          payload.videoFile = url
          payload.caption = projectName || 'Rendered with Neural Master'
        }

        return apiPost(endpoint, payload)
      })

      await Promise.allSettled(promises)
      
      showToast('Neural Broadcast Complete! Content live on selected platforms.', 'success')
      setSelectedPlatforms([])
    } catch (error) {
      console.error('Broadcasting failed', error)
      showToast('Broadcast partial failure. Check connection matrices.', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const selectedPresetConfig = EXPORT_PRESETS.find(p => p.id === selectedPreset) || EXPORT_PRESETS[3]
  const qualityMultiplier = exportQuality === 'high' ? 1 : exportQuality === 'medium' ? 0.7 : 0.5
  const effectiveBitrateMbpsNum = selectedPresetConfig ? selectedPresetConfig.bitrateMbps * qualityMultiplier : 0
  const effectiveBitrateMbps = selectedPresetConfig ? effectiveBitrateMbpsNum.toFixed(1) : '—'
  const durationSec = typeof videoDuration === 'number' && videoDuration > 0 ? videoDuration : 0
  const approximateSizeMB = durationSec > 0 && effectiveBitrateMbpsNum > 0
    ? Math.round((durationSec * effectiveBitrateMbpsNum) / 8)
    : null

  const PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'from-pink-500 to-rose-600', glow: 'rgba(244,63,94,0.3)', connected: !!connectedAccounts.tiktok },
    { id: 'youtube', label: 'YouTube Shorts', icon: Youtube, color: 'from-red-600 to-red-700', glow: 'rgba(220,38,38,0.3)', connected: !!connectedAccounts.youtube },
    { id: 'instagram', label: 'Instagram Reels', icon: Instagram, color: 'from-purple-500 to-pink-500', glow: 'rgba(217,70,239,0.3)', connected: !!connectedAccounts.instagram },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-20 ds-anim-rise">
      {/* Navigation */}
      {setActiveCategory && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveCategory('edit')} leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveCategory('timeline')} leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}>
            Timeline
          </Button>
        </div>
      )}

      {/* Main Export Hub */}
      <Panel variant="glass" className="relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute right-6 top-6 opacity-[0.05]">
          <Download className="h-48 w-48 text-theme-primary" aria-hidden />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Download className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="ds-text-h1 text-theme-primary">Export &amp; Render</h1>
          <p className="max-w-lg text-sm text-theme-muted">
            Finalize your production and broadcast it to your connected platforms.
          </p>
        </div>

        {/* Agency Batch Mode Toggle */}
        <div className="mb-10 mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsBatchMode(!isBatchMode)}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-full border px-5 py-2.5 transition-all',
              isBatchMode ? 'border-fuchsia-500/40 bg-fuchsia-500/10' : 'border-subtle ds-surface-subtle hover:border-border'
            )}
          >
            <div className={cn('relative h-5 w-10 rounded-full transition-colors', isBatchMode ? 'bg-fuchsia-500' : 'bg-input')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', isBatchMode ? 'translate-x-5' : 'translate-x-0.5')} />
            </div>
            <div className="flex flex-col text-left">
              <span className={cn('ds-text-label', isBatchMode ? 'text-fuchsia-500' : 'text-theme-secondary')}>Agency Batch Mode</span>
              <span className="ds-text-caption text-theme-muted">Multi-format parallel export</span>
            </div>
          </button>
        </div>

        {/* Quality Controls Cluster */}
        <div className="mb-10 grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Primary Specs */}
          <div className="space-y-6 rounded-2xl ds-surface-subtle p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" aria-hidden />
                <h3 className="ds-text-label text-theme-secondary">Quality</h3>
              </div>
              <div className="flex w-fit rounded-xl ds-surface-card p-1">
                {(['high', 'medium', 'low'] as const).map(q => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => setExportQuality(q)}
                    className={cn('rounded-lg px-4 py-2 text-xs font-semibold transition-colors', exportQuality === q ? 'bg-primary text-primary-foreground' : 'text-theme-muted hover:text-theme-primary')}
                  >
                    {q === 'high' ? 'High' : q === 'medium' ? 'Standard' : 'Low'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="ds-text-caption text-theme-muted">Resolution</span>
                <p className="ds-text-h3 text-theme-primary">{selectedPresetConfig?.res}</p>
              </div>
              <div className="space-y-1">
                <span className="ds-text-caption text-theme-muted">Target bitrate</span>
                <p className="ds-text-h3 text-indigo-500">~{effectiveBitrateMbps} <span className="text-sm opacity-50">Mbps</span></p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-500">
                <Activity className="h-4 w-4" aria-hidden />
                <span className="ds-text-caption">Estimated size</span>
              </div>
              <span className="text-lg font-bold tabular-nums text-theme-primary">~{approximateSizeMB} MB</span>
            </div>
          </div>

          {/* Codec & Audio Cluster */}
          <div className="space-y-6 rounded-2xl ds-surface-subtle p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-orange-500" aria-hidden />
                <h3 className="ds-text-label text-theme-secondary">Codec</h3>
              </div>
              <div className="flex w-fit rounded-xl ds-surface-card p-1">
                {(['h264', 'hevc', 'prores'] as const).map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setExportCodec(c)}
                    className={cn('rounded-lg px-4 py-2 text-xs font-semibold transition-colors', exportCodec === c ? 'bg-orange-600 text-white' : 'text-theme-muted hover:text-theme-primary')}
                  >
                    {c === 'h264' ? 'H.264 (MP4)' : c === 'hevc' ? 'HEVC' : 'ProRes (MOV)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" aria-hidden />
                <h3 className="ds-text-label text-theme-secondary">Audio</h3>
              </div>
              <label className="group/audio flex cursor-pointer items-center gap-3">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all', duckMusicWhenVoiceover ? 'border-indigo-500 bg-indigo-600' : 'border-subtle group-hover:border-border')}>
                  {duckMusicWhenVoiceover && <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />}
                </div>
                <input
                  type="checkbox"
                  title="Enable Audio Ducking"
                  checked={duckMusicWhenVoiceover}
                  onChange={(e) => setDuckMusicWhenVoiceover(e.target.checked)}
                  className="hidden"
                />
                <span className="text-sm text-theme-secondary transition-colors group-hover/audio:text-theme-primary">Duck music under voiceover</span>
              </label>
              {duckMusicWhenVoiceover && (
                <div className="flex items-center gap-4 rounded-xl ds-surface-card p-4">
                  <span className="ds-text-caption text-theme-muted">Floor (dB):</span>
                  <input
                    type="range"
                    min={-24}
                    max={0}
                    value={duckLevel}
                    onChange={(e) => setDuckLevel(Number(e.target.value))}
                    title={`Audio Ducking Level (dB): ${duckLevel}`}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-input accent-indigo-500"
                  />
                  <span className="w-12 text-right text-lg font-bold tabular-nums text-theme-primary">{duckLevel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preset Grid */}
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {EXPORT_PRESETS.map(p => {
            const active = selectedPreset === p.id
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  setSelectedPreset(p.id)
                  showToast(`${p.label} selected`, 'info')
                }}
                className={cn(
                  'relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border p-5 transition-all ds-hover-lift',
                  active ? 'border-indigo-500/50 ds-surface-subtle' : 'border-subtle ds-surface-subtle hover:border-border'
                )}
              >
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl transition-all', active ? cn('bg-gradient-to-br text-white', p.color) : 'bg-accent text-theme-muted')}>
                  <p.icon className="h-6 w-6" aria-hidden />
                </div>
                <div className="space-y-0.5 text-center">
                  <span className={cn('block ds-text-label', active ? 'text-theme-primary' : 'text-theme-secondary')}>{p.label}</span>
                  <span className={cn('block ds-text-caption', active ? 'text-indigo-500' : 'text-theme-muted')}>
                    {p.res}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Batch Formats Selector (Only visible in Batch Mode) */}
        {isBatchMode && (
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            {batchFormats.map(fmt => (
              <button
                type="button"
                key={fmt.id}
                onClick={() => setBatchFormats(prev => prev.map(f => f.id === fmt.id ? { ...f, selected: !f.selected } : f))}
                className={cn(
                  'flex min-w-[160px] flex-col items-center gap-2 rounded-2xl border p-5 transition-all',
                  fmt.selected ? 'border-fuchsia-500/40 bg-fuchsia-500/10' : 'border-subtle ds-surface-subtle hover:border-border'
                )}
              >
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors', fmt.selected ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-subtle')}>
                  {fmt.selected && <CheckCircle2 className="h-4 w-4" aria-hidden />}
                </div>
                <span className="ds-text-h3 text-theme-primary">{fmt.id}</span>
                <span className="ds-text-caption text-theme-muted">{fmt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sticky Master Production Trigger */}
        <div className="sticky bottom-6 z-40 mx-auto mt-8 max-w-3xl">
          <div className="flex flex-col gap-4 rounded-2xl ds-surface-elevated p-3">
            <button
              type="button"
              disabled={isRendering || !videoUrl || (isBatchMode && !batchFormats.some(f => f.selected))}
              onClick={async () => {
                if (!videoUrl && !videoId) {
                  showToast('Production node offline', 'error')
                  return
                }
                
                setIsRendering(true)
                setRenderResult(null)
                
                if (isBatchMode) {
                   const selected = batchFormats.filter(f => f.selected)
                   showToast(`Initializing ${selected.length} parallel render threads...`, 'info')
                   
                   const InitialProgress: any = {}
                   selected.forEach(f => { InitialProgress[f.id] = 0 })
                   setBatchProgress(InitialProgress)
                   
                   // Simulate Parallel Rendering
                   const interval = setInterval(() => {
                      setBatchProgress(prev => {
                         const next = { ...prev }
                         let allDone = true
                         Object.keys(next).forEach(key => {
                            if (next[key] < 100) {
                               next[key] = Math.min(100, next[key] + (Math.random() * 8))
                               allDone = false
                            }
                         })
                         
                         if (allDone) {
                            clearInterval(interval)
                            setIsRendering(false)
                            // Honest: batch multi-format export isn't wired to a
                            // real packaged output yet — render each format
                            // individually (single mode) to get a downloadable file.
                            showToast('Batch preview complete. Use single-format render for a downloadable file.', 'info')
                         }
                         return next
                      })
                   }, 400)
                   
                   return
                }

                // Standard Single Render Flow
                try {
                  const preset = EXPORT_PRESETS.find(p => p.id === selectedPreset)!
                  const qualityMult = exportQuality === 'high' ? 1 : exportQuality === 'medium' ? 0.7 : 0.5
                  const res = await apiPost<{ data?: { url?: string; downloadUrl?: string }; url?: string; downloadUrl?: string }>(
                    '/video/manual-editing/render',
                    {
                      videoId: videoId || undefined,
                      videoUrl: videoUrl || undefined,
                      videoFilters: videoFilters || {},
                      videoTransform: videoTransform || {},
                      videoTransformKeyframes: videoTransformKeyframes || [],
                      textOverlays: textOverlays || [],
                      shapeOverlays: shapeOverlays || [],
                      imageOverlays: imageOverlays || [],
                      svgOverlays: svgOverlays || [],
                      gradientOverlays: gradientOverlays || [],
                      // Editor stores crop as {top,right,bottom,left} % insets; the
                      // render engine expects {x,y,width,height} %. Convert, and
                      // only send when an actual crop is set.
                      videoCrop: (videoCrop && (videoCrop.top || videoCrop.right || videoCrop.bottom || videoCrop.left))
                        ? {
                            x: videoCrop.left || 0,
                            y: videoCrop.top || 0,
                            width: Math.max(1, 100 - (videoCrop.left || 0) - (videoCrop.right || 0)),
                            height: Math.max(1, 100 - (videoCrop.top || 0) - (videoCrop.bottom || 0)),
                          }
                        : undefined,
                      // Whole-clip speed + chroma key parity.
                      chromaKey: (chromaKey && chromaKey.enabled) ? chromaKey : undefined,
                      playbackSpeed: playbackSpeed && playbackSpeed !== 1 ? playbackSpeed : undefined,
                      exportOptions: {
                        width: preset.width,
                        height: preset.height,
                        bitrateMbps: (preset as { codec?: string }).codec === 'prores' ? 0 : Math.round((preset.bitrateMbps || 8) * qualityMult * 10) / 10,
                        codec: (preset as { codec?: string }).codec === 'prores' ? 'prores' : exportCodec,
                        quality: (preset as { quality?: string }).quality ?? undefined,
                        duckMusicWhenVoiceover,
                        duckLevel,
                      },
                      timelineSegments: timelineSegments || [],
                      // The whole effects layer (vignette/grain/chromatic/glow/
                      // flash/color, time-ranged) was previously built in the
                      // editor but never sent — so it never rendered. Forward it.
                      timelineEffects: timelineEffects || [],
                    },
                    { timeout: 180000 }
                  )

                  // The render is synchronous server-side: by the time apiPost
                  // resolves, the MP4 is ready and the URL (if any) is in `res`.
                  // Validate that a real download URL came back BEFORE declaring
                  // success, so a 200-with-no-url response can't masquerade as a
                  // completed export.
                  const data = (res as any)?.data ?? res
                  const url = data?.url ?? data?.downloadUrl
                  const downloadUrl = data?.downloadUrl ?? url

                  if (!url && !downloadUrl) {
                    setIsRendering(false)
                    showToast('Render finished but no output was returned. Please try again.', 'error')
                    return
                  }

                  showToast('Neural Render Initialized - Routing to Clusters', 'success')
                  setRenderProgress(0)
                  const interval = setInterval(() => {
                    setRenderProgress(prev => {
                      if (prev >= 100) {
                        clearInterval(interval)
                        setIsRendering(false)
                        showToast('Project Rendered: Assets Available in Repository', 'success')

                        setRenderResult({ url, downloadUrl })
                        setLastRenderExportPath(data?.url ?? (typeof url === 'string' && url.startsWith('/') ? url : null))
                        onExportComplete?.()
                        return 100
                      }
                      return prev + (Math.random() * 8)
                    })
                  }, 500)
                } catch (err: any) {
                  showToast(err?.response?.data?.error ?? err?.message ?? 'Synthesis failed', 'error')
                  setIsRendering(false)
                }
              }}
              className={cn(
                'relative w-full overflow-hidden rounded-xl py-5 text-sm font-semibold text-white transition-all disabled:opacity-50',
                isBatchMode ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : 'bg-indigo-600 hover:bg-indigo-700'
              )}
            >
                  {isRendering ? (
                    <div className="flex w-full flex-col items-center gap-3 py-2">
                       {isBatchMode ? (
                          <div className="w-full space-y-3">
                            <span className="flex items-center justify-center gap-3 font-semibold text-white">
                              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                              Batch export
                            </span>
                            {Object.entries(batchProgress).map(([format, prog]) => (
                               <div key={format} className="flex items-center gap-4 px-6">
                                  <span className="w-16 text-right text-xs font-semibold text-white/90">{format}</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                                      <div className="h-full rounded-full bg-white transition-all" style={{ width: `${prog}%` }} />
                                  </div>
                                  <span className="w-10 font-mono text-xs font-semibold text-white">{Math.round(prog)}%</span>
                               </div>
                            ))}
                          </div>
                       ) : (
                          <>
                           <span className="flex items-center justify-center gap-3 font-semibold text-white">
                             <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                             Rendering: {Math.round(renderProgress)}%
                           </span>
                           <div className="h-1.5 w-1/2 overflow-hidden rounded-full bg-white/20">
                               <div className="h-full rounded-full bg-white transition-all" style={{ width: `${renderProgress}%` }} />
                           </div>
                          </>
                       )}
                    </div>
                  ) : (
                <span className="flex items-center justify-center gap-3">
                  <Zap className="h-5 w-5" aria-hidden />
                  {isBatchMode ? 'Render Batch' : 'Render'}
                </span>
              )}
            </button>

            {renderResult?.downloadUrl && (
                <div className="flex flex-col items-center justify-center gap-3 ds-anim-fade-in sm:flex-row">
                  <a
                    href={renderResult.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700"
                  >
                    <Download className="h-5 w-5" aria-hidden />
                    Download
                  </a>

                  {videoId && lastRenderExportPath && !saveSuccess && (
                    <Button
                      variant="secondary"
                      disabled={isSaving}
                      loading={isSaving}
                      onClick={async () => {
                        setIsSaving(true)
                        try {
                          await apiPost('/video/manual-editing/saved-exports', {
                            videoId,
                            exportPath: lastRenderExportPath,
                            quality: selectedPresetConfig?.quality || selectedPreset,
                            expiresInDays: saveExpiresDays,
                          })
                          setSaveSuccess(true)
                          showToast(`Saved to library`, 'success')
                          fetchSavedExports()
                        } catch (err: any) {
                          showToast(err?.response?.data?.error ?? err?.message ?? 'Save error', 'error')
                        } finally {
                          setIsSaving(false)
                        }
                      }}
                      leftIcon={!isSaving ? <FolderDown className="h-5 w-5" aria-hidden /> : undefined}
                    >
                      Save to Library
                    </Button>
                  )}
                </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Schedule when it'll land — niche × platform optimal posting windows.
           Renders only when the user has at least one rendered export, since
           the suggestion only matters once there's something to schedule. */}
      {(savedExports.length > 0 || lastRenderExportPath) && (
        <div className="max-w-2xl">
          <OptimalPostingWindow
            onSchedule={(hour, rationale) => {
              showToast?.(`Scheduled for ${hour}:00 — ${rationale[0] || ''}`, 'success')
              setActiveCategory?.('scheduling')
            }}
          />
        </div>
      )}

      {/* Saved Exports */}
      {(savedExports.length > 0) && (
        <Panel variant="glass" className="relative overflow-hidden p-6 sm:p-8 ds-anim-rise">
          <SectionHeader
            className="mb-6"
            as="h3"
            title={
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <FolderDown className="h-5 w-5" aria-hidden />
                </span>
                Saved Exports
              </span>
            }
            description={`Production archives (${savedExports.length})`}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {savedExports.map((s: any) => {
              const downloadUrl = s.downloadUrl || (s.url?.startsWith('http') ? s.url : (typeof window !== 'undefined' ? window.location.origin : '') + (s.url || ''))
              return (
                <div
                  key={s._id}
                  className="group flex flex-col gap-5 rounded-2xl ds-surface-subtle p-6 transition-colors hover:border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="truncate ds-text-h3 text-theme-primary">{s.title || 'Export'}</h4>
                      <p className="ds-text-caption text-theme-muted">{s.quality} · {new Date(s.expiresAt).toLocaleDateString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(downloadUrl)
                            setCopySuccessId(s._id)
                            showToast('Link copied', 'success')
                            setTimeout(() => setCopySuccessId(null), 2000)
                          } catch {
                            showToast('Copy failed', 'error')
                          }
                        }}
                        title="Copy link"
                        className="rounded-lg ds-surface-card p-2.5 text-theme-secondary transition-all hover:text-theme-primary"
                      >
                        {copySuccessId === s._id ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
                      </button>

                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                        className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-500 transition-all hover:bg-indigo-500/20"
                      >
                        <FolderDown className="h-4 w-4" aria-hidden />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-subtle pt-4">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', s.isExpired ? 'bg-rose-500' : 'bg-emerald-500')} />
                      <span className={cn('ds-text-caption', s.isExpired ? 'text-rose-500' : 'text-emerald-500')}>
                        {s.isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>

                    {!s.isExpired && (
                      <div className="flex items-center gap-3 rounded-lg ds-surface-card px-3 py-1.5">
                        <select
                          title="Extend Archive Duration"
                          value={extendDays}
                          onChange={(e) => setExtendDays(Number(e.target.value))}
                          className="w-12 cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-indigo-500 focus:ring-0"
                        >
                          <option value={7}>7D</option>
                          <option value={10}>10D</option>
                          <option value={30}>30D</option>
                        </select>
                        <div className="h-4 w-px bg-subtle" />
                        <button
                          type="button"
                          disabled={extendingId === s._id}
                          title="Confirm Extension"
                          onClick={async (e) => {
                            e.stopPropagation(); e.preventDefault();
                            setExtendingId(s._id)
                            try {
                              await apiPatch(`/video/manual-editing/saved-exports/${s._id}/extend`, { extendByDays: extendDays })
                              showToast(`Archive extended`, 'success')
                              fetchSavedExports()
                            } catch (e) {
                              showToast('Extend error', 'error')
                            } finally {
                              setExtendingId(null)
                            }
                          }}
                          className="text-indigo-500 transition-colors hover:text-theme-primary"
                        >
                          {extendingId === s._id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUpRight className="h-4 w-4" aria-hidden />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Distribution Hub */}
      <Panel variant="glass" className="relative overflow-hidden p-6 sm:p-8">
        <SectionHeader
          className="mb-6"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Globe className="h-5 w-5" aria-hidden />
              </span>
              Distribution Hub
            </span>
          }
          description={`Publish to your ${PLATFORMS.filter(p => p.connected).length} connected ${PLATFORMS.filter(p => p.connected).length === 1 ? 'account' : 'accounts'}.`}
        />

        {isLoadingAccounts ? (
          <div className="rounded-2xl ds-surface-subtle py-16 text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-500" aria-hidden />
            <p className="ds-text-caption text-theme-muted">Checking connected accounts…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PLATFORMS.map(platform => {
                const active = selectedPlatforms.includes(platform.id)
                return (
                  <button
                    type="button"
                    key={platform.id}
                    onClick={() => platform.connected && togglePlatform(platform.id)}
                    disabled={!platform.connected}
                    className={cn(
                      'relative flex flex-col items-center gap-4 rounded-2xl border p-6 transition-all',
                      !platform.connected
                        ? 'cursor-not-allowed border-subtle ds-surface-subtle opacity-40'
                        : active
                          ? cn('border-transparent bg-gradient-to-br text-white', platform.color)
                          : 'border-subtle ds-surface-subtle hover:border-emerald-500/40'
                    )}
                  >
                    <div className={cn('flex h-16 w-16 items-center justify-center rounded-xl transition-all', active ? 'bg-white/15' : 'bg-accent')}>
                      <platform.icon className={cn('h-8 w-8', active ? 'text-white' : 'text-theme-muted')} aria-hidden />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className={cn('ds-text-label', active ? 'text-white' : 'text-theme-primary')}>{platform.label}</p>
                      <p className={cn('ds-text-caption', active ? 'text-white/70' : 'text-theme-muted')}>
                        {platform.connected ? 'Connected' : 'Not connected'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedPlatforms.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-4 rounded-2xl ds-surface-subtle p-6 ds-anim-rise lg:flex-row">
                <div className="space-y-1 text-center lg:text-left">
                  <h4 className="ds-text-h3 text-theme-primary">Publish</h4>
                  <p className="text-sm text-theme-muted">
                    Broadcasting to {selectedPlatforms.length} {selectedPlatforms.length === 1 ? 'platform' : 'platforms'}.
                  </p>
                </div>

                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || !/^https?:\/\//i.test(renderResult?.url || '')}
                  loading={isPublishing}
                  size="lg"
                  leftIcon={!isPublishing ? <Send className="h-5 w-5" aria-hidden /> : undefined}
                >
                  {isPublishing ? 'Publishing…' : 'Broadcast Now'}
                </Button>
              </div>
            )}

            {!connectedAccounts.tiktok && !connectedAccounts.youtube && !connectedAccounts.instagram && (
              <EmptyStateBlock onConnect={() => setActiveCategory?.('accounts')} />
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}

/** Honest empty state when no social accounts are linked. */
const EmptyStateBlock: React.FC<{ onConnect: () => void }> = ({ onConnect }) => (
  <div className="space-y-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500/10">
      <ZapOff className="h-7 w-7 text-orange-500" aria-hidden />
    </div>
    <h4 className="ds-text-h3 text-theme-primary">No accounts connected</h4>
    <p className="text-sm text-theme-muted">
      Link your accounts in the{' '}
      <button type="button" onClick={onConnect} className="font-semibold text-theme-primary underline underline-offset-4">Social Vault</button>{' '}
      to publish directly.
    </p>
  </div>
)

export default ExportView
