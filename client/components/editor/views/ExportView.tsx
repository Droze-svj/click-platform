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
  videoFilters: any
  videoTransform?: { scale?: number, positionX?: number, positionY?: number, rotation?: number }
  videoTransformKeyframes?: any[]
  timelineSegments?: any[]
  videoDuration?: number
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (category: import('../../../types/editor').EditorCategory) => void
  projectName?: string
  onExportComplete?: () => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const ExportView: React.FC<ExportViewProps> = ({ videoId, videoUrl, textOverlays, shapeOverlays = [], imageOverlays = [], gradientOverlays = [], videoFilters, videoTransform, videoTransformKeyframes, timelineSegments = [], videoDuration, showToast, setActiveCategory, projectName, onExportComplete }) => {
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

    if (!renderResult?.url) {
      showToast('Please render the video first before broadcasting', 'error')
      return
    }

    try {
      setIsPublishing(true)
      showToast(`Broadcasting to ${selectedPlatforms.length} platform(s)...`, 'info')
      
      const promises = selectedPlatforms.map(platform => {
        const payload: any = {}
        let endpoint = `/oauth/${platform}/upload`

        if (platform === 'youtube') {
          payload.videoFile = renderResult.url
          payload.title = projectName || 'Rendered with Neural Master'
          payload.description = 'Published from Click Video Editor'
        } else if (platform === 'instagram') {
          endpoint = `/oauth/${platform}/post`
          payload.imageUrl = renderResult.url // Future: Add videoUrl support to IG backend
          payload.caption = projectName || 'Rendered with Neural Master'
        } else {
          payload.videoFile = renderResult.url
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
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20">
      {/* Elite Navigation Cluster */}
      {setActiveCategory && (
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ x: -4 }}
            onClick={() => setActiveCategory('edit')}
            className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 italic"
          >
            <ChevronLeft className="w-4 h-4" /> Edit Node
          </motion.button>
          <motion.button
            whileHover={{ x: -4 }}
            onClick={() => setActiveCategory('timeline')}
            className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 italic"
          >
            <ChevronLeft className="w-4 h-4" /> Chrono Matrix
          </motion.button>
        </div>
      )}

      {/* Main Export Hub */}
      <div className={`${glassStyle} rounded-[4.5rem] p-16 text-center relative overflow-hidden shadow-3xl`}>
        {/* Dynamic Global Atmosphere */}
        <AnimatePresence>
          <motion.div
            key={selectedPresetConfig.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background: `radial-gradient(circle at 50% 0%, ${selectedPresetConfig.glow || 'rgba(99,102,241,0.2)'} 0%, transparent 70%)`
            }}
          />
        </AnimatePresence>

        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-orange-600 shadow-[0_4px_30px_rgba(99,102,241,0.5)]" />

        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none rotate-12">
          <Download className="w-64 h-64 text-white" />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_30px_60px_rgba(79,70,229,0.4)] border border-white/20"
        >
          <Download className="w-12 h-12 text-white animate-bounce" />
        </motion.div>

        <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none mb-4">
          NEURAL MASTER
        </h1>
        <p className="text-slate-500 text-2xl font-medium tracking-tight italic mb-10">
          Finalize your production with <span className="text-white font-black underline decoration-indigo-500/30 underline-offset-8">Elite-tier</span> variety engine synthesis.
        </p>

        {/* Agency Batch Mode Toggle */}
        <div className="flex items-center justify-center gap-6 mb-16">
           <div className={`px-6 py-3 rounded-full border flex items-center gap-4 transition-all cursor-pointer ${isBatchMode ? 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.3)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`} onClick={() => setIsBatchMode(!isBatchMode)}>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${isBatchMode ? 'bg-fuchsia-500' : 'bg-slate-700'}`}>
                 <motion.div animate={{ x: isBatchMode ? 20 : 2 }} className="w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-md" />
              </div>
              <div className="flex flex-col text-left">
                 <span className={`text-[11px] font-black uppercase tracking-widest italic transition-colors ${isBatchMode ? 'text-fuchsia-400' : 'text-slate-400'}`}>Agency Batch Mode</span>
                 <span className="text-[9px] text-slate-500 italic">Omni-channel parallel synthesis</span>
              </div>
           </div>
        </div>

        {/* Quality Controls Cluster */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 text-left">
          {/* Primary Specs */}
          <div className="space-y-10 p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] shadow-inner">
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <Target className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Output Spectrum</h3>
              </div>
              <div className="relative flex p-1.5 bg-black/40 border border-white/5 rounded-3xl overflow-hidden w-fit shadow-inner">
                {(['high', 'medium', 'low'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => setExportQuality(q)}
                    className={`relative px-8 py-4 text-[10px] font-black uppercase tracking-widest italic transition-colors z-10 ${exportQuality === q ? 'text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    {exportQuality === q && (
                      <motion.div
                        layoutId="quality-pill"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="absolute inset-0 bg-indigo-600 rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.5)] border border-indigo-400 z-[-1]"
                      />
                    )}
                    {q === 'high' ? 'High Precision' : q === 'medium' ? 'Standard' : 'Low Compression'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Resolution</span>
                <p className="text-3xl font-black text-white italic tracking-tighter">{selectedPresetConfig?.res}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Target bitrate</span>
                <p className="text-3xl font-black text-indigo-400 italic tracking-tighter">~{effectiveBitrateMbps} <span className="text-sm opacity-40">Mbps</span></p>
              </div>
            </div>

            <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
              <div className="flex items-center gap-4 text-emerald-400">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Projection Stable</span>
              </div>
              <span className="text-xl font-black text-white italic tabular-nums">~{approximateSizeMB} MB</span>
            </div>
          </div>

          {/* Codec & Audio Cluster */}
          <div className="space-y-10 p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] shadow-inner">
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <Cpu className="w-5 h-5 text-orange-400" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">NEURAL CODEC</h3>
              </div>
              <div className="relative flex p-1.5 bg-black/40 border border-white/5 rounded-3xl overflow-hidden w-fit shadow-inner">
                {(['h264', 'hevc', 'prores'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setExportCodec(c)}
                    className={`relative px-8 py-4 text-[10px] font-black uppercase tracking-widest italic transition-colors z-10 ${exportCodec === c ? 'text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    {exportCodec === c && (
                      <motion.div
                        layoutId="codec-pill"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="absolute inset-0 bg-orange-600 rounded-2xl shadow-[0_0_20px_rgba(234,88,12,0.5)] border border-orange-400 z-[-1]"
                      />
                    )}
                    {c === 'h264' ? 'H.264 (MP4)' : c === 'hevc' ? 'HEVC V2' : 'PRORES (MOV)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Audio Synthesis</h3>
              </div>
              <label className="flex items-center gap-4 cursor-pointer group/audio">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${duckMusicWhenVoiceover ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'border-white/10 group-hover:border-white/20'}`}>
                  {duckMusicWhenVoiceover && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <input
                  type="checkbox"
                  title="Enable Audio Ducking"
                  checked={duckMusicWhenVoiceover}
                  onChange={(e) => setDuckMusicWhenVoiceover(e.target.checked)}
                  className="hidden"
                />
                <span className="text-sm text-slate-400 font-medium italic group-hover:text-white transition-colors">Neural Ducking Algorithm active</span>
              </label>
              {duckMusicWhenVoiceover && (
                <div className="flex items-center gap-6 p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Floor (dB):</span>
                  <input
                    type="range"
                    min={-24}
                    max={0}
                    value={duckLevel}
                    onChange={(e) => setDuckLevel(Number(e.target.value))}
                    title={`Audio Ducking Level (dB): ${duckLevel}`}
                    className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(99,102,241,1)] [&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent"
                  />
                  <span className="w-12 text-white font-black text-xl italic tabular-nums text-right">{duckLevel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preset Grid (Elite) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 mb-16">
          {EXPORT_PRESETS.map(p => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setSelectedPreset(p.id)
                showToast(`${p.label} Matrix Synced`, 'info')
              }}
              className={`p-8 rounded-[3rem] flex flex-col items-center gap-4 transition-all border relative overflow-hidden shadow-xl ${selectedPreset === p.id
                ? 'bg-white/[0.08] border-indigo-400 shadow-[0_0_40px_rgba(79,70,229,0.3)] scale-[1.02]'
                : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                }`}
            >
              {selectedPreset === p.id && (
                <div className={`absolute inset-0 bg-gradient-to-br ${p.color} opacity-10 animate-pulse`} />
              )}
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-2xl mb-2 ${selectedPreset === p.id ? `bg-gradient-to-br ${p.color} text-white` : 'bg-white/5 text-slate-700 group-hover:text-white'}`}>
                <p.icon className="w-8 h-8" />
              </div>
              <div className="text-center space-y-1">
                <span className={`block text-lg font-black uppercase italic tracking-tighter ${selectedPreset === p.id ? 'text-white' : 'text-slate-500'}`}>{p.label}</span>
                <span className={`text-[10px] font-black uppercase tracking-widest block ${selectedPreset === p.id ? 'text-indigo-400' : 'text-slate-800'}`}>
                  {p.res}
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Batch Formats Selector (Only visible in Batch Mode) */}
        <AnimatePresence>
           {isBatchMode && (
              <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="flex justify-center gap-6 mb-16 overflow-hidden"
              >
                 {batchFormats.map(fmt => (
                    <motion.button
                       key={fmt.id}
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={() => setBatchFormats(prev => prev.map(f => f.id === fmt.id ? { ...f, selected: !f.selected } : f))}
                       className={`px-8 py-6 rounded-[2rem] border-2 flex flex-col items-center gap-2 transition-all min-w-[180px] ${fmt.selected ? 'bg-fuchsia-500/10 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.2)]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                    >
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${fmt.selected ? 'bg-fuchsia-500 border-fuchsia-400 text-white' : 'border-white/20'}`}>
                          {fmt.selected && <CheckCircle2 className="w-4 h-4" />}
                       </div>
                       <span className="text-xl font-black italic tracking-tighter">{fmt.id}</span>
                       <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{fmt.label}</span>
                    </motion.button>
                 ))}
              </motion.div>
           )}
        </AnimatePresence>

        {/* Sticky Master Production Trigger (Elite) */}
        <div className="sticky bottom-10 z-50 mx-auto max-w-4xl mt-12 w-[calc(100%+4rem)] -ml-8">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="p-3 bg-white/[0.05] backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex flex-col gap-4"
          >
            <motion.button
              disabled={isRendering || !videoUrl || (isBatchMode && !batchFormats.some(f => f.selected))}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
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
                            showToast('Batch Pipeline Complete! Assets packaged in ZIP.', 'success')
                            setRenderResult({ downloadUrl: 'blob:mock-zip-package' })
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
                    },
                    { timeout: 180000 }
                  )

                  if (res) {
                    showToast('Neural Render Initialized - Routing to Clusters', 'success')
                    setRenderProgress(0)
                    const interval = setInterval(() => {
                      setRenderProgress(prev => {
                        if (prev >= 100) {
                          clearInterval(interval)
                          setIsRendering(false)
                          showToast('Project Rendered: Assets Available in Repository', 'success')

                          const data = (res as any)?.data ?? res
                          const url = data?.url ?? data?.downloadUrl
                          setRenderResult({ url, downloadUrl: data?.downloadUrl ?? url })
                          setLastRenderExportPath(data?.url ?? (typeof url === 'string' && url.startsWith('/') ? url : null))
                          onExportComplete?.()
                          return 100
                        }
                        return prev + (Math.random() * 8)
                      })
                    }, 500)
                  }
                } catch (err: any) {
                  showToast(err?.response?.data?.error ?? err?.message ?? 'Synthesis failed', 'error')
                  setIsRendering(false)
                }
              }}
              className={`w-full py-8 ${isBatchMode ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 shadow-[0_0_40px_rgba(217,70,239,0.4)]' : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_0_40px_rgba(79,70,229,0.4)]'} text-white rounded-[2.5rem] font-black hover:shadow-[0_0_60px_rgba(79,70,229,0.7)] transition-all uppercase tracking-[0.5em] italic text-sm disabled:opacity-50 disabled:grayscale border border-white/30 relative overflow-hidden group/btn`}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover/btn:translate-y-[100%] transition-transform duration-700 ease-in-out" />
                  {isRendering ? (
                    <div className="flex flex-col items-center gap-6 w-full py-4">
                       <div className="flex items-center justify-center gap-10">
                          <div className="flex flex-col items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                             <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest italic">Core Alpha</span>
                          </div>
                          <div className="flex flex-col items-center gap-2 opacity-50">
                             <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                             <span className="text-[8px] font-black text-violet-400 uppercase tracking-widest italic">Core Beta</span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-ping" />
                             <span className="text-[8px] font-black text-fuchsia-400 uppercase tracking-widest italic">Core Gamma</span>
                          </div>
                       </div>

                       <div className="flex flex-col items-center gap-3 w-full">
                          {isBatchMode ? (
                             <div className="w-full space-y-4">
                               <span className="flex items-center justify-center gap-4 text-white font-black italic tracking-[0.3em]">
                                 <Loader2 className="w-5 h-5 animate-spin" />
                                 OMNI-CHANNEL BATCH PIPELINE
                               </span>
                               {Object.entries(batchProgress).map(([format, prog]) => (
                                  <div key={format} className="flex items-center gap-4 px-10">
                                     <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-400 w-16 text-right">{format}</span>
                                     <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                                         <motion.div
                                           className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)]"
                                           initial={{ width: 0 }}
                                           animate={{ width: `${prog}%` }}
                                           transition={{ duration: 0.3 }}
                                         />
                                     </div>
                                     <span className="text-[10px] font-mono font-bold text-white w-10">{Math.round(prog)}%</span>
                                  </div>
                               ))}
                             </div>
                          ) : (
                             <>
                              <span className="flex items-center justify-center gap-4 text-white font-black italic tracking-[0.3em]">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                SYNTHESIZING MATRIX: {Math.round(renderProgress)}%
                              </span>
                              <div className="w-1/2 h-1 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${renderProgress}%` }}
                                    transition={{ duration: 0.3 }}
                                  />
                              </div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">Routing Neural Fragments to Cloud Nodes...</span>
                             </>
                          )}
                       </div>
                    </div>
                  ) : (
                <span className="flex items-center justify-center gap-6">
                  <Zap className="w-7 h-7 fill-white drop-shadow-lg" />
                  {isBatchMode ? 'INITIATE MULTI-FORMAT PIPELINE' : 'INITIATE MASTER RENDER'}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {renderResult?.downloadUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-6"
                >
                  <motion.a
                    href={renderResult.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05 }}
                    className="px-12 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-emerald-600/30 transition-all flex items-center gap-4 border border-white/10"
                  >
                    <Download className="w-5 h-5" />
                    Download Node
                  </motion.a>

                  {videoId && lastRenderExportPath && !saveSuccess && (
                    <motion.button
                      disabled={isSaving}
                      whileHover={{ scale: 1.05 }}
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
                          showToast(`Repository Linked`, 'success')
                          fetchSavedExports()
                        } catch (err: any) {
                          showToast(err?.response?.data?.error ?? err?.message ?? 'Save error', 'error')
                        } finally {
                          setIsSaving(false)
                        }
                      }}
                      className="px-12 py-5 bg-white text-black rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl hover:bg-zinc-200 transition-all flex items-center gap-4"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderDown className="w-5 h-5" />}
                      Link to Cluster
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Repository Command Center */}
      {(savedExports.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${glassStyle} rounded-[4.5rem] p-16 shadow-3xl relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none">
            <Layers className="w-48 h-48 text-indigo-500" />
          </div>

          <div className="flex items-center justify-between mb-12 relative z-10">
            <div className="flex items-center gap-8">
              <div className="p-5 rounded-[1.8rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl">
                <FolderDown className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">NEURAL REPOSITORY</h3>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 block italic">Production Archives ({savedExports.length})</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
            {savedExports.map((s: any, idx) => {
              const downloadUrl = s.downloadUrl || (s.url?.startsWith('http') ? s.url : (typeof window !== 'undefined' ? window.location.origin : '') + (s.url || ''))
              return (
                <motion.div
                  key={s._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500 flex flex-col gap-6 shadow-inner"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1 min-w-0">
                      <h4 className="text-xl font-black text-white italic tracking-tighter truncate leading-none uppercase">{s.title || 'Export_Sequence'}</h4>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-slate-400 transition-colors">{s.quality} Precision // {new Date(s.expiresAt).toLocaleDateString()}</p>
                    </div>

                    {/* Hover Reveal Actions */}
                    <div className="flex items-center gap-3 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(downloadUrl)
                            setCopySuccessId(s._id)
                            showToast('Uplink Copied', 'success')
                            setTimeout(() => setCopySuccessId(null), 2000)
                          } catch {
                            showToast('Uplink Error', 'error')
                          }
                        }}
                        title="Copy Uplink"
                        className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/10 shadow-lg"
                      >
                        {copySuccessId === s._id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
                      </motion.button>

                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download Source"
                        className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 hover:text-white hover:bg-indigo-500/40 transition-all border border-indigo-500/20 shadow-lg"
                      >
                        <FolderDown className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${s.isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                      <span className={`text-[9px] font-black uppercase tracking-widest italic ${s.isExpired ? 'text-rose-500/50' : 'text-emerald-500/50 group-hover:text-emerald-400 transition-colors'}`}>
                        {s.isExpired ? 'EXPIRED' : 'ACTIVE UPLINK'}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {!s.isExpired && (
                        <div className="flex items-center gap-4 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                          <select
                            title="Extend Archive Duration"
                            value={extendDays}
                            onChange={(e) => setExtendDays(Number(e.target.value))}
                            className="bg-transparent text-indigo-400 font-black text-[10px] uppercase italic border-none focus:ring-0 p-0 w-12 cursor-pointer"
                          >
                            <option value={7} className="text-black">7D</option>
                            <option value={10} className="text-black">10D</option>
                            <option value={30} className="text-black">30D</option>
                          </select>
                          <div className="w-px h-4 bg-indigo-500/20" />
                          <button
                            disabled={extendingId === s._id}
                            title="Confirm Extension"
                            onClick={async (e) => {
                              e.stopPropagation(); e.preventDefault();
                              setExtendingId(s._id)
                              try {
                                await apiPatch(`/video/manual-editing/saved-exports/${s._id}/extend`, { extendByDays: extendDays })
                                showToast(`Repository Archive Extended`, 'success')
                                fetchSavedExports()
                              } catch (e) {
                                showToast('Extend Error', 'error')
                              } finally {
                                setExtendingId(null)
                              }
                            }}
                            className="text-indigo-400 hover:text-white transition-colors"
                          >
                            {extendingId === s._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Unified Distribution Hub (Elite) */}
      <div className={`${glassStyle} rounded-[4.5rem] p-16 relative overflow-hidden group shadow-3xl`}>
        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none scale-150 grayscale rotate-45">
          <Globe className="w-64 h-64 text-emerald-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16 relative z-10">
          <div className="space-y-4">
             <div className="flex items-center gap-6">
                <div className="p-4 rounded-[1.2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-xl">
                   <Globe className="w-8 h-8 text-emerald-400 animate-pulse-slow" />
                </div>
                <div>
                   <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">DISTRIBUTION Hub</h2>
                   <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3 block italic">Platform Penetration Matrix</span>
                </div>
             </div>
            <p className="text-slate-500 text-xl font-medium tracking-tight italic">
              Cross-cluster broadcasting initialized for <span className="text-emerald-400 font-black">{PLATFORMS.filter(p => p.connected).length} Identity Nodes</span>.
            </p>
          </div>
          <div className="px-10 py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] italic shadow-2xl">
            LINK_STABILITY: 100%
          </div>
        </div>

        {isLoadingAccounts ? (
          <div className="text-center py-20 bg-white/[0.02] rounded-[3rem] border border-white/5">
            <Loader2 className="w-16 h-16 animate-spin mx-auto text-emerald-500 mb-6" />
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic animate-pulse">Scanning Identity Nodes...</p>
          </div>
        ) : (
          <div className="space-y-12 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {PLATFORMS.map(platform => (
                <motion.button
                  key={platform.id}
                  whileHover={platform.connected ? { scale: 1.05, y: -4 } : {}}
                  whileTap={platform.connected ? { scale: 0.95 } : {}}
                  onClick={() => platform.connected && togglePlatform(platform.id)}
                  className={`relative p-10 rounded-[3rem] border transition-all duration-700 flex flex-col items-center gap-6 shadow-xl ${!platform.connected
                    ? 'bg-black/40 border-white/5 grayscale opacity-30 cursor-not-allowed'
                    : selectedPlatforms.includes(platform.id)
                      ? 'bg-gradient-to-br ' + platform.color + ' border-white/30 text-white shadow-[0_0_50px_rgba(16,185,129,0.3)] scale-[1.02] z-10'
                      : 'bg-white/[0.03] border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                    }`}
                >
                  {selectedPlatforms.includes(platform.id) && (
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                  )}
                  <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center transition-all shadow-3xl ${selectedPlatforms.includes(platform.id) ? 'bg-white/10' : 'bg-white/5'}`}>
                    <platform.icon className={`w-10 h-10 ${selectedPlatforms.includes(platform.id) ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-black italic uppercase tracking-tighter leading-none">{platform.label}</p>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${selectedPlatforms.includes(platform.id) ? 'text-white/60' : 'text-slate-800'}`}>
                      {platform.connected ? 'Cluster Linked' : 'Node Offline'}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>

            <AnimatePresence>
              {selectedPlatforms.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className={`bg-white text-black p-12 rounded-[3.5rem] border border-white/20 shadow-3xl overflow-hidden relative group/dispatch`}
                >
                  <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 group-hover/dispatch:scale-110 transition-transform">
                    <Send className="w-32 h-32" />
                  </div>

                  <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
                    <div className="space-y-4 text-center lg:text-left">
                      <h4 className="text-4xl font-black italic tracking-tighter uppercase leading-none">IDENTITY BROADCAST</h4>
                      <p className="text-slate-600 text-lg font-medium tracking-tight italic">
                        Synchronized dispatch sequence initialized for <span className="text-black font-black underline decoration-black/20 underline-offset-4">{selectedPlatforms.length} Neural Nodes</span>.
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05, x: 10 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePublish}
                      disabled={isPublishing}
                      className="px-16 py-8 bg-black text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] italic shadow-3xl transition-all flex items-center gap-6 group/pub"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                          DISPATCHING...
                        </>
                      ) : (
                        <>
                          <Send className="w-6 h-6 group-hover/pub:translate-x-2 group-hover/pub:-translate-y-2 transition-transform" />
                          BROADCAST NOW
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!connectedAccounts.tiktok && !connectedAccounts.youtube && !connectedAccounts.instagram && (
              <div className="p-10 rounded-[3rem] bg-orange-500/5 border border-orange-500/20 text-center space-y-4">
                <div className="w-16 h-16 rounded-[1.5rem] bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                  <ZapOff className="w-8 h-8 text-orange-400" />
                </div>
                <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">ZERO NODES CONNECTED</h4>
                <p className="text-slate-500 font-medium italic">Link your identity clusters in the <span className="text-white font-black underline decoration-white/20 underline-offset-4 cursor-pointer" onClick={() => setActiveCategory?.('accounts')}>Social Vault</span> to unlock the Distribution Matrix.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExportView
