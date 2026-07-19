'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, apiPost, API_URL } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import { useSocket } from '../../../../../hooks/useSocket'
import { Sparkles, Edit3, Play, Loader2, AlertCircle, Settings, CheckCircle2, XCircle, Download, Eye, BarChart3, Award, Edit, Zap, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Palette, Fingerprint, Cpu, RefreshCw, Activity, Brain, Terminal, Globe, LayoutGrid, Layers, ArrowLeft, ArrowRight, Sparkle, Video, Layout, Moon, Sun, Wand2, Scissors, Music, Type, Hash, Flame, Mic, Film, Gauge } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicModernVideoEditor } from '../../../../../components/DynamicImports'
import { getAssetUrl, getMediaUrl } from '../../../../../utils/url'
import VideoProgressTracker from '../../../../../components/VideoProgressTracker'
import { useTheme } from '../../../../../components/ThemeProvider'
import ClickLoadingState from '@/components/click/ClickLoadingState'

interface PageProps {
  params: {
    videoId: string
  }
}

interface Video {
  _id: string
  title: string
  status: string
  originalFile: { url: string }
  createdAt: string
  generatedContent?: {
    shortVideos?: Array<{
      url: string
      thumbnail: string
      caption: string
      duration: number
      platform: string
    }>
  }
}

const STORAGE_KEYS = {
  lastPreset: 'click-ai-edit-last-preset',
  lastCaptionStyle: 'click-ai-edit-last-caption-style',
  preciseScenes: 'click-ai-edit-precise-scenes',
  minSceneLength: 'click-ai-edit-min-scene-length',
  clipTargetLength: 'click-ai-edit-clip-target-length',
  clipCount: 'click-ai-edit-clip-count',
  contentGenre: 'click-ai-edit-content-genre',
  prioritizeHook: 'click-ai-edit-prioritize-hook',
  exportFormats: 'click-ai-edit-export-formats',
  pacingIntensity: 'click-ai-edit-pacing-intensity',
} as const

// Style presets — mirror server/services/clipStylePresets.js (the eight
// presets that drive variation expansion + per-clip overrides). emoji +
// tagline + accent gradient are display-only.
const STYLE_PRESETS = [
  { id: 'mrbeast-energy',     label: 'MrBeast Energy',     emoji: '⚡',  tagline: 'Big stakes · pattern break',   accent: 'from-amber-500 to-orange-700' },
  { id: 'hormozi-bold',       label: 'Hormozi Bold',       emoji: '💎',  tagline: 'Hard stat · contrarian take',  accent: 'from-rose-500 to-rose-800' },
  { id: 'cinematic-doc',      label: 'Cinematic Doc',      emoji: '🎬',  tagline: 'Slow burn · whisper cut',      accent: 'from-indigo-600 to-violet-800' },
  { id: 'educational-clean',  label: 'Educational Clean',  emoji: '📚',  tagline: 'Question frame · fact drop',   accent: 'from-emerald-500 to-emerald-800' },
  { id: 'news-authority',     label: 'News Authority',     emoji: '📰',  tagline: 'Headline · breaking · expert', accent: 'from-slate-600 to-slate-900' },
  { id: 'casual-vlog',        label: 'Casual Vlog',        emoji: '🎙️', tagline: 'Day-in-life · conversational',  accent: 'from-sky-500 to-cyan-700' },
  { id: 'mystery-hook',       label: 'Mystery Hook',       emoji: '🕯️', tagline: 'Curiosity loop · slow reveal',  accent: 'from-fuchsia-600 to-purple-800' },
  { id: 'gym-grit',           label: 'Gym Grit',           emoji: '🔥',  tagline: 'High-intensity · tough love',   accent: 'from-red-600 to-orange-800' },
  { id: 'adhd-overload',     label: 'ADHD Overload',      emoji: '⚡',  tagline: 'Chaos · pop-burst · overstim',  accent: 'from-rose-600 to-rose-800' },
  { id: 'podcast-goldmine',  label: 'Podcast Goldmine',   emoji: '🎙️', tagline: 'Authority · chapters · warm doc', accent: 'from-amber-500 to-amber-700' },
  { id: 'retention-machine', label: 'Retention Machine',  emoji: '🔄',  tagline: 'Open loops · B-roll · chapters', accent: 'from-violet-600 to-violet-800' },
] as const

// Compact select-card used inside the Advanced collapsible. One file-local
// component — keeps the markup of each option-row identical and avoids
// 9 copies of the same JSX.
function SelectCard<T extends string>({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: any
  label: string
  value: T
  onChange: (v: T) => void
  options: readonly T[]
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-primary-500" />
        <p className="text-xs font-bold text-surface-900 dark:text-white">{label}</p>
      </div>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2 text-xs font-bold text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40 capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>{String(o).replace(/-/g, ' ')}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Marketing brief collapsible panel ───────────────────────────────────────
function MarketingBriefPanel({ brief }: { brief: any }) {
  const [open, setOpen] = useState(false)
  if (!brief?.strategy) return null
  const s = brief.strategy
  return (
    <div className="rounded-3xl border border-surface-200 dark:border-surface-800 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-8 bg-white dark:bg-surface-900 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
            <Brain size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-black text-surface-900 dark:text-white">Marketing Brief</p>
            {s.contentArchetype && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-[10px] font-black uppercase tracking-widest border border-primary-200 dark:border-primary-800">
                {s.contentArchetype.replace(/-/g, ' ')}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-surface-400" /> : <ChevronDown size={16} className="text-surface-400" />}
      </button>
      {open && (
        <div className="p-8 space-y-6 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950">
          {s.schedulingMatrix && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-3">Optimal Posting Times</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(s.schedulingMatrix).map(([platform, data]: [string, any]) => (
                  <div key={platform} className="p-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
                    <p className="text-[9px] font-black uppercase text-surface-500 mb-1">{platform.replace(/_/g, ' ')}</p>
                    <p className="text-xs font-black text-surface-900 dark:text-white">{data.optimalDay} · {data.optimalTime}</p>
                    {data.reasoning && <p className="text-[9px] text-surface-500 mt-1 leading-relaxed">{String(data.reasoning).substring(0, 80)}…</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(s.competitiveInsights) && s.competitiveInsights.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-3">Competitive Insights</p>
              <div className="space-y-2">
                {s.competitiveInsights.map((insight: string, i: number) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
                    <Zap size={14} className="text-primary-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-surface-700 dark:text-surface-300">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function VideoEditPage({ params }: PageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?aiTool=silence|fillers|edit-by-text — sent here from the AI Tools
  // hub. We jump straight to manual editing and forward the tool to
  // ModernVideoEditor so it can auto-open the SmartCleanup panel on the
  // requested tool. No mode-picker friction.
  const aiTool = searchParams?.get('aiTool') as ('silence' | 'fillers' | 'edit-by-text' | null) || null
  const modeParam = searchParams?.get('mode') || null
  const clipUrl = searchParams?.get('clipUrl') || null
  // Just-uploaded videos arrive with ?autoCaptions=1 so the editor builds a
  // speech-synced caption track on first open.
  const autoCaptions = searchParams?.get('autoCaptions') === '1'
  const videoId = params.videoId
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const { resolvedTheme, toggle } = useTheme()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState<'selection' | 'manual' | 'ai-auto'>(
    aiTool || modeParam === 'manual' ? 'manual' : 'selection'
  )
  const [processing, setProcessing] = useState(false)
  const [liveProgress, setLiveProgress] = useState<{ stage: string; percent: number; message: string } | null>(null)

  useEffect(() => {
    const loadVideo = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiGet<any>(`/video/${videoId}`)
        const videoData = response?.data || response

        if (!videoData || !videoData._id) {
          throw new Error('Video data not found in response')
        }

        if (videoData.originalFile?.url) {
          videoData.originalFile.url = getAssetUrl(videoData.originalFile.url)
        }
        setVideo(videoData)
      } catch (error: any) {
        console.error('Failed to load video:', error)
        setError(error.message || 'Failed to load video. Please try again.')
        setVideo(null)
      } finally {
        setLoading(false)
      }
    }
    loadVideo()
  }, [videoId])

  const [aiEditResult, setAiEditResult] = useState<any>(null)
  const [processingError, setProcessingError] = useState<string>('')
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [editingOptions, setEditingOptions] = useState({
    removeSilence: true,
    optimizePacing: true,
    enhanceAudio: true,
    generateClips: true,
    addCaptions: false,
    enhanceColor: false,
    stabilizeVideo: false,
    hookDetection: true,
    beatMatchedCuts: false,
    brollAutoInsert: false,
    predictEngagement: true,
    viralOverlays: false,
    voiceCloneNarration: false,
  })
  const [captionStyle, setCaptionStyle] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.lastCaptionStyle) || 'modern' : 'modern'))
  const [outputFormat, setOutputFormat] = useState<'auto' | 'vertical' | 'square' | 'standard'>('auto')
  const [clipTargetLength, setClipTargetLength] = useState<'short' | 'mid-3-5' | 'mid-5-10' | 'full'>('short')
  const [clipCount, setClipCount] = useState(5)
  const [contentGenre, setContentGenre] = useState<string>('auto')
  const [prioritizeHook, setPrioritizeHook] = useState(true)
  const [exportFormats, setExportFormats] = useState<('9:16' | '1:1' | '16:9')[]>(['9:16'])
  const [pacingIntensity, setPacingIntensity] = useState<'gentle' | 'medium' | 'aggressive'>('medium')
  const [editPreset, setEditPreset] = useState<string>('')
  // Richer AI-edit controls. Every value here is consumed by
  // server/services/aiVideoEditingService.js or clipStylePresets.js — no
  // placebo controls. Defaults are chosen so a "do nothing" run still
  // produces a strong creator-grade clip.
  //
  // Multi-preset: backend's variation expansion supports up to 3 presets.
  // Each preset adds 3 variations (Big Stakes / Pattern Break / Reveal
  // Loop on MrBeast Energy, etc.), so picking 2 presets at clipCount=6
  // produces 6 visibly distinct clips (3 from each angle).
  const [stylePresetIds, setStylePresetIds] = useState<string[]>([])
  const [hookStyle, setHookStyle] = useState<'auto' | 'question' | 'stat' | 'mystery' | 'story' | 'bold-claim' | 'pattern-break'>('auto')
  const [musicGenre, setMusicGenre] = useState<'auto' | 'phonk' | 'lofi' | 'cinematic' | 'synthwave' | 'upbeat-pop' | 'chill' | 'dark-ambient'>('auto')
  const [colorGrade, setColorGrade] = useState<'auto' | 'vivid' | 'cinematic' | 'natural' | 'cool' | 'warm' | 'vintage' | 'bw'>('auto')
  const [transitionStyle, setTransitionStyle] = useState<'auto' | 'fast-cut' | 'crossfade' | 'glitch' | 'whip-pan' | 'hard-cut'>('auto')
  const [subtitlePosition, setSubtitlePosition] = useState<'auto' | 'top' | 'middle' | 'bottom' | 'lower-third'>('auto')
  const [ctaStyle, setCtaStyle] = useState<'auto' | 'question' | 'urgency' | 'value' | 'curiosity'>('auto')
  const [speedRamping, setSpeedRamping] = useState<boolean>(false)
  const [brollFrequency, setBrollFrequency] = useState<'off' | 'sparse' | 'balanced' | 'heavy'>('balanced')
  const [voiceTone, setVoiceTone] = useState<'auto' | 'energetic' | 'calm' | 'authoritative' | 'playful' | 'serious'>('auto')
  const [targetPlatform, setTargetPlatform] = useState<'auto' | 'tiktok' | 'instagram' | 'youtube' | 'linkedin'>('auto')
  const [contentTone, setContentTone] = useState<'auto' | 'educational' | 'entertaining' | 'motivational' | 'promotional'>('auto')
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)
  const [customInstructions, setCustomInstructions] = useState<string>('')
  const [editJobId, setEditJobId] = useState<string | null>(null)
  const [marketingBrief, setMarketingBrief] = useState<any>(null)
  // Resolved style insight from the publish→learn loop. When the user
  // has ≥3 publishes, we pre-select their top preset / color grade /
  // hook style so the HUD opens already biased toward their style. The
  // user can still override anything before submitting.
  const [styleInsight, setStyleInsight] = useState<{
    source: 'user' | 'team' | 'defaults'
    totalPicks: number
    topPicks?: {
      preset?: string | null
      colorGrade?: string | null
      hookStyle?: string | null
      musicGenre?: string | null
      transition?: string | null
      captionStyle?: string | null
    }
    topN?: {
      presets?: Array<{ key: string; count: number }>
      captionStyles?: Array<{ key: string; count: number }>
      colorGrades?: Array<{ key: string; count: number }>
      publishHours?: Array<{ key: string; count: number }>
      publishDays?: Array<{ key: string; count: number }>
    }
  } | null>(null)
  const [insightApplied, setInsightApplied] = useState<boolean>(false)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
  }, [])

  // Fetch style insight once on mount. When source==='user' (≥3
  // publishes), bias the AI Director defaults to the user's top picks
  // so the panel feels like Click already knows their style. We mark
  // insightApplied so the bias only runs once — subsequent changes the
  // user makes are sticky.
  useEffect(() => {
    if (insightApplied) return
    const ac = new AbortController()
    apiGet<any>('/video/clips/style-insight', { signal: ac.signal })
      .then((res: any) => {
        if (ac.signal.aborted) return
        const data = res?.data ?? res
        if (!data || typeof data !== 'object') return
        setStyleInsight(data)
        if (data.source !== 'user') return  // only auto-bias when user has real history
        const top = data.topPicks || {}
        if (top.preset && stylePresetIds.length === 0 && STYLE_PRESETS.some(p => p.id === top.preset)) {
          setStylePresetIds([top.preset])
        }
        if (top.colorGrade && colorGrade === 'auto') setColorGrade(top.colorGrade as any)
        if (top.hookStyle && hookStyle === 'auto') setHookStyle(top.hookStyle as any)
        if (top.musicGenre && musicGenre === 'auto') setMusicGenre(top.musicGenre as any)
        if (top.transition && transitionStyle === 'auto') setTransitionStyle(top.transition as any)
        if (top.captionStyle) setCaptionStyle(top.captionStyle)
        setInsightApplied(true)
      })
      .catch(() => { /* aborted or no learned data — defaults stand */ })
    return () => ac.abort()
    // Run once on mount; we deliberately don't track changing values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reorder the preset palette so the user's learned top picks (from the
  // /style-insight loop) float to the top. Falls back to declared order
  // when there's no signal yet. Catalog membership is preserved — every
  // preset still renders, just biased by what the user actually publishes.
  const orderedPresets = useMemo(() => {
    const learned = styleInsight?.topN?.presets
    if (!Array.isArray(learned) || learned.length === 0) return STYLE_PRESETS
    const wanted = learned
      .map(p => STYLE_PRESETS.find(s => s.id === p.key))
      .filter((p): p is typeof STYLE_PRESETS[number] => Boolean(p))
    if (wanted.length === 0) return STYLE_PRESETS
    const seen = new Set(wanted.map(p => p.id))
    const rest = STYLE_PRESETS.filter(p => !seen.has(p.id))
    return [...wanted, ...rest]
  }, [styleInsight])

  useEffect(() => {
    if (!aiEditResult || !videoId) return
    setMarketingBrief(null)
    // Fetch the marketing brief for the finished edit.
    apiPost('/video/ai-editing/marketing-brief', { videoId })
      .then((res: any) => {
        const data = res?.data ?? res
        if (data?.brief) setMarketingBrief(data.brief)
      })
      .catch(() => { })
  }, [aiEditResult, videoId])

  const handleEditModeSelect = useCallback((mode: 'manual' | 'ai-auto') => {
    setEditMode(mode)
    setProcessingError('')
    setAiEditResult(null)
    setEditJobId(null)
  }, [])

  const handleAnalyzeVideo = async () => {
    setAnalyzing(true)
    setShowAnalysis(false)
    try {
      const analysis = await apiPost('/video/ai-editing/analyze', {
        videoId,
        videoMetadata: { url: video?.originalFile.url, title: video?.title }
      })
      setAiAnalysis(analysis.data || analysis)
      setShowAnalysis(true)
    } catch (error: any) {
      console.error(error)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleStartAIEdit = async () => {
    const sourceUrl = video?.originalFile?.url
    if (!sourceUrl) {
      setProcessingError('This video is missing its source file. Re-upload and try again.')
      return
    }
    if (stylePresetIds.length > 3) {
      setProcessingError('You can mix at most 3 style presets per edit.')
      return
    }
    setProcessingError('')
    setProcessing(true)
    setAiEditResult(null)
    setLiveProgress(null)
    try {
      const backendOptions = {
        ...editingOptions,
        captionStyle,
        outputFormat,
        clipTargetLength,
        clipCount,
        contentGenre,
        prioritizeHook,
        aspectFormats: exportFormats,
        pacingIntensity,
        // Style presets (drives variation expansion server-side). When
        // user picks 1 preset, also send `stylePresetId` for back-compat
        // with anywhere the backend still reads the singular form.
        ...(stylePresetIds.length > 0
          ? {
            stylePresetIds,
            ...(stylePresetIds.length === 1 ? { stylePresetId: stylePresetIds[0] } : {}),
          }
          : {}),
        // Granular controls — only forward non-'auto' picks so the
        // backend's intelligent defaults still kick in when the user
        // hasn't overridden a dimension.
        ...(hookStyle !== 'auto' ? { hookStyle } : {}),
        ...(musicGenre !== 'auto' ? { musicGenre } : {}),
        ...(colorGrade !== 'auto' ? { colorGrade } : {}),
        ...(transitionStyle !== 'auto' ? { transitionStyle } : {}),
        ...(subtitlePosition !== 'auto' ? { subtitlePosition } : {}),
        ...(ctaStyle !== 'auto' ? { ctaStyle } : {}),
        ...(voiceTone !== 'auto' ? { voiceTone } : {}),
        speedRamping,
        brollFrequency,
        ...(targetPlatform !== 'auto' ? { platform: targetPlatform } : {}),
        ...(contentTone !== 'auto' ? { contentTone } : {}),
        ...(customInstructions.trim() ? { customInstructions: customInstructions.trim() } : {}),
      }
      const result = await apiPost('/video/ai-editing/auto-edit', { videoId, editingOptions: backendOptions, outputFormat })
      const jobId = result.data?.jobId || result.jobId
      if (jobId) {
        setEditJobId(jobId)
      } else {
        // Synchronous success (no jobId) — capture the result so the
        // success UI renders, then redirect to the clip hub for this
        // video so the user lands on their fresh clips with the AI's
        // recommended captions + slots already populated.
        setAiEditResult(result)
        setProcessing(false)
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null
          router.push(`/dashboard/clips/hub/${videoId}`)
        }, 1200)
      }
    } catch (error: any) {
      setProcessing(false)
      // Surface useful detail when the server returned an error body. axios
      // wraps the server payload at error.response.data, so prefer that over
      // the generic "Request failed with status code 500".
      const status = error?.response?.status
      const serverMsg =
        error?.response?.data?.error
        || error?.response?.data?.message
        || (typeof error?.response?.data === 'string' ? error.response.data : null)

      if (status === 500) {
        setProcessingError(
          serverMsg
            ? `The AI service hit an error: ${serverMsg}`
            : 'The AI service hit an internal error. Check the backend server logs and try again.'
        )
      } else if (status === 401 || status === 403) {
        setProcessingError('Your session expired. Sign in again and retry.')
      } else if (status === 429) {
        setProcessingError('Too many edit requests. Wait a moment and try again.')
      } else if (status >= 400 && status < 500) {
        setProcessingError(serverMsg || `Request was rejected (${status}). Check your inputs and retry.`)
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        setProcessingError('The edit request timed out. The video may be too large or the server is slow to respond.')
      } else if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
        setProcessingError('Cannot reach the backend. Make sure the server is running on port 5001.')
      } else {
        setProcessingError(serverMsg || error?.message || 'Could not start the AI edit. Try again.')
      }
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 bg-surface-50 dark:bg-surface-950 min-h-screen">
      <ClickLoadingState intent="loading.analyzing" />
    </div>
  )

  // Mobile gate — this editor is built around a full timeline, drag-targets,
  // and side-by-side preset gallery that don't yet have a mobile-native
  // layout. Rather than ship a broken touch experience, show an honest
  // "desktop recommended" banner. The user can still scroll past and use
  // the read-only progress / asset views below, but the heavy edit surface
  // is gated. Hidden on md+ so desktop is unaffected.
  const mobileGate = (
    <div className="md:hidden bg-amber-500/10 border-b border-amber-500/30 text-amber-200 px-5 py-4 text-sm">
      <p className="font-bold">Editing on mobile</p>
      <p className="text-amber-200/80 mt-1 text-xs leading-relaxed">
        The full editor works on your phone, but the timeline and multi-clip
        controls have more room on a tablet or laptop (≥ 768px). Rotate to
        landscape or use a larger screen for the most comfortable experience.
      </p>
    </div>
  )

  const videoUrl = video?.originalFile?.url
  const editorVideoUrl = getMediaUrl(clipUrl || (aiEditResult?.data?.editedVideoUrl ?? aiEditResult?.editedVideoUrl) || videoUrl || '')

  const selectionUI = (
    <div className="min-h-screen w-full bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 overflow-x-hidden relative pb-24 transition-colors duration-500">
      {mobileGate}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10">

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-surface-200 dark:border-surface-800 pb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl flex items-center justify-center shadow-sm">
              <Edit3 size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                  Workflow Selection
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Select Edit Mode</h1>
              <p className="text-surface-500 text-sm mt-2 font-medium max-w-lg truncate">{video?.title || 'Untitled Project'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggle} title="Toggle Theme" aria-label="Toggle Theme" className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button type="button" onClick={() => router.push('/dashboard/video')} title="Return to Video Dashboard" aria-label="Return to Video Dashboard" className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
              <ChevronLeft size={16} />
              Return
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <div className="relative w-full aspect-video bg-surface-100 dark:bg-surface-950 rounded-3xl overflow-hidden shadow-sm border border-surface-200 dark:border-surface-800 flex items-center justify-center">
              <video src={getMediaUrl(videoUrl || '')} controls className="w-full h-full object-contain" />
              <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md">
                 <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                 <span className="text-[10px] font-bold text-white uppercase tracking-wider">Preview</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center gap-4">
               <span className="flex h-px flex-1 bg-surface-200 dark:bg-surface-800" />
               <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">Choose Option</span>
               <span className="flex h-px flex-1 bg-surface-200 dark:bg-surface-800" />
            </div>

            <div className="space-y-4">
              <button type="button" onClick={() => handleEditModeSelect('ai-auto')} title="Select AI Auto Edit Mode" aria-label="Select AI Auto Edit Mode" className="w-full group relative flex items-start gap-6 p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all text-left overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 dark:bg-primary-900/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wand2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 relative z-10">
                  <div className="flex items-center gap-3 mb-1">
                     <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">AI Auto Edit</h2>
                     <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 text-[9px] font-bold uppercase tracking-wider border border-primary-200 dark:border-primary-800">RECOMMENDED</span>
                  </div>
                  <p className="text-sm text-surface-500 leading-relaxed font-medium">Use AI to automatically find hooks, remove silence, and generate high-retention clips.</p>
                  <div className="mt-4 flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                    Start Auto Edit <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>

              <button type="button" onClick={() => handleEditModeSelect('manual')} title="Select Manual Editor Mode" aria-label="Select Manual Editor Mode" className="w-full group relative flex items-start gap-6 p-8 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700 hover:shadow-md transition-all text-left overflow-hidden">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scissors className="w-7 h-7 text-surface-600 dark:text-surface-400" />
                </div>
                <div className="flex-1 relative z-10">
                  <h2 className="text-xl font-black text-surface-900 dark:text-white tracking-tight mb-1">Advanced Manual Editor</h2>
                  <p className="text-sm text-surface-500 leading-relaxed font-medium">Access the full timeline editor for precise manual cuts, transitions, and audio mixing.</p>
                  <div className="mt-4 flex items-center gap-2 text-surface-600 dark:text-surface-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                    Open Editor <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (editMode === 'selection') return selectionUI

  if (editMode === 'manual') {
    const urlForEditor = editorVideoUrl || videoUrl
    if (!urlForEditor) return null
    return (
      <div className="fixed inset-0 bg-surface-50 dark:bg-surface-950 overflow-hidden transition-colors duration-500">
        <button type="button" onClick={() => setEditMode('selection')} title="Back to Workflow Selection" aria-label="Back to Workflow Selection" className="absolute top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
          <ChevronLeft size={16} /> Workflow Selection
        </button>
        <DynamicModernVideoEditor videoId={videoId} videoUrl={urlForEditor} initialAiTool={aiTool} autoGenerateCaptions={autoCaptions} />
      </div>
    )
  }

  if (editMode === 'ai-auto') {
    return (
      <div className="min-h-screen w-full bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 overflow-x-hidden relative pb-32 transition-colors duration-500">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-8 relative z-10">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-surface-200 dark:border-surface-800 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl flex items-center justify-center shadow-sm">
                <Sparkles size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                    AI Auto Edit
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-none mt-1">Configure AI Rules</h1>
                <p className="text-surface-500 text-sm mt-2 font-medium max-w-lg truncate">{video?.title || 'Untitled Project'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={toggle} title="Toggle Theme" aria-label="Toggle Theme" className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button type="button" onClick={() => handleAnalyzeVideo()} disabled={analyzing} title="Analyze Video" aria-label="Analyze Video" className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider disabled:opacity-50">
                {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze Video'}
              </button>
              <button type="button" onClick={() => setEditMode('selection')} title="Back to Workflow Selection" aria-label="Back to Workflow Selection" className="px-5 py-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
                <ChevronLeft size={16} /> Return
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {processing ? (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 p-12 sm:p-20 text-center shadow-sm max-w-3xl mx-auto">
                <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-center mx-auto mb-8 shadow-sm">
                  <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                </div>
                <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight mb-4">Processing Video</h2>
                <p className="text-surface-500 font-medium mb-10 text-sm">Our AI is currently analyzing, cutting, and optimizing your video...</p>
                {editJobId ? (
                  <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800">
                     <VideoProgressTracker jobId={editJobId} videoId={videoId} onComplete={(res) => { setAiEditResult(res); setProcessing(false); setTimeout(() => router.push(`/dashboard/clips/hub/${videoId}`), 1200); }} onError={() => { setProcessing(false); }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">{liveProgress?.stage || 'Initializing'}</span>
                       <span className="text-lg font-black text-surface-900 dark:text-white">{liveProgress?.percent || 0}%</span>
                    </div>
                    <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary-500" initial={{ width: 0 }} animate={{ width: `${liveProgress?.percent || 0}%` }} />
                    </div>
                  </div>
                )}
              </motion.div>
            ) : aiEditResult ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-4xl mx-auto">
                <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-10 shadow-sm relative overflow-hidden">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h2 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight mb-2">Processing Complete</h2>
                    <p className="text-surface-500 font-medium text-sm">Your video has been successfully processed and edited by AI.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <button type="button" onClick={() => handleEditModeSelect('manual')} className="px-8 py-4 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-colors shadow-sm flex items-center justify-center gap-3">
                      Open in Editor <ArrowRight size={16} />
                    </button>
                    <button type="button" onClick={() => { setAiEditResult(null); setEditMode('selection'); }} title="Dismiss and return to selection" aria-label="Dismiss and return to selection" className="px-6 py-4 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 font-bold text-xs uppercase tracking-wider hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-sm">
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Marketing Brief */}
                <MarketingBriefPanel brief={marketingBrief} />
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Col: Analysis Results */}
                <div className="lg:col-span-4 space-y-6">
                  {showAnalysis && aiAnalysis && (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 rounded-3xl shadow-sm">
                       <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                            <Activity size={24} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                             <h3 className="text-lg font-black text-surface-900 dark:text-white tracking-tight">Diagnostics</h3>
                             <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1">Analysis Complete</p>
                          </div>
                       </div>
                       <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex justify-between items-center">
                         <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">Suggested Length</p>
                         <p className="text-2xl font-black text-surface-900 dark:text-white tabular-nums">{Math.round(aiAnalysis.suggestedLength || 0)}s</p>
                       </div>
                    </motion.div>
                  )}
                  
                  <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 rounded-3xl shadow-sm">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                          <Brain size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-surface-900 dark:text-white tracking-tight">Content Strategy</h3>
                           <p className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-1">AI Recommendations</p>
                        </div>
                     </div>
                     <div className="space-y-3">
                        {[{ label: 'Hook Focus', val: 'First 3s' }, { label: 'Pacing Target', val: 'Dynamic' }].map((s, i) => (
                          <div key={i} className="flex justify-between items-center p-5 rounded-2xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800">
                            <span className="text-xs font-bold text-surface-500">{s.label}</span>
                            <span className="text-sm font-black text-surface-900 dark:text-white">{s.val}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                </div>

                {/* Right Col: Edit Config — three-zone HUD: Style Preset
                    gallery → core controls → advanced collapsible. Every
                    option here maps to a real backend dimension consumed
                    by aiVideoEditingService.js or clipStylePresets.js. */}
                <div className="lg:col-span-8">
                   <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-8 sm:p-10 rounded-3xl shadow-sm space-y-8">
                      <div className="flex items-center gap-5 pb-6 border-b border-surface-200 dark:border-surface-800">
                         <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/10 border border-primary-200 dark:border-primary-800 flex items-center justify-center">
                           <Wand2 size={28} className="text-primary-600 dark:text-primary-400" />
                         </div>
                         <div className="flex-1">
                            <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">AI Director</h2>
                            <p className="text-sm font-medium text-surface-500 mt-1">
                              Pick up to 3 styles or fine-tune every dimension.
                              {stylePresetIds.length > 0 && (
                                <span className="text-primary-600 dark:text-primary-400 font-bold">
                                  {' · '}{stylePresetIds.length} preset{stylePresetIds.length === 1 ? '' : 's'}: {stylePresetIds.map(id => STYLE_PRESETS.find(p => p.id === id)?.label).filter(Boolean).join(' + ')}
                                </span>
                              )}
                            </p>
                         </div>
                      </div>

                      {/* Platform + Tone — top-level creative intent.
                          Platform drives aspect ratio, caption style, and
                          Gemini niche playbook. Tone biases hook type and
                          CTA framing across the whole edit. */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                            <Globe size={13} className="text-primary-500" /> Target platform
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {([
                              { id: 'auto',      label: 'Auto',      emoji: '✨' },
                              { id: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
                              { id: 'instagram', label: 'Instagram',  emoji: '📸' },
                              { id: 'youtube',   label: 'YouTube',   emoji: '▶️' },
                              { id: 'linkedin',  label: 'LinkedIn',  emoji: '💼' },
                            ] as const).map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setTargetPlatform(p.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  targetPlatform === p.id
                                    ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                    : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700'
                                }`}
                              >
                                <span>{p.emoji}</span>{p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                            <Sparkle size={13} className="text-primary-500" /> Content tone
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {([
                              { id: 'auto',          label: 'Auto' },
                              { id: 'educational',   label: 'Educational' },
                              { id: 'entertaining',  label: 'Entertaining' },
                              { id: 'motivational',  label: 'Motivational' },
                              { id: 'promotional',   label: 'Promotional' },
                            ] as const).map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setContentTone(t.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  contentTone === t.id
                                    ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white shadow-sm'
                                    : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Style Preset Gallery — visual cards for each of
                          the 8 presets. Multi-select up to 3: each
                          selection adds 3 variation angles to the render
                          plan, so 2 presets at clipCount=6 → 6 distinct
                          clips (3 angles × 2 presets). Selection order
                          is shown as a numbered badge. */}
                      <div className="space-y-4">
                         <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-3">
                           <Sparkles size={14} className="text-primary-500" /> Style preset
                           {stylePresetIds.length > 0 && (
                             <span className="ml-auto text-[10px] text-surface-400 font-medium normal-case tracking-normal">
                               {stylePresetIds.length}/3 selected · click again to remove
                             </span>
                           )}
                         </label>
                         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                           {orderedPresets.map(p => {
                             const orderIndex = stylePresetIds.indexOf(p.id)
                             const active = orderIndex !== -1
                             const atCap = stylePresetIds.length >= 3 && !active
                             return (
                               <button
                                type="button"
                                 key={p.id}
                                 disabled={atCap}
                                 onClick={() => {
                                   setStylePresetIds(prev => {
                                     if (prev.includes(p.id)) return prev.filter(id => id !== p.id)
                                     if (prev.length >= 3) return prev
                                     return [...prev, p.id]
                                   })
                                 }}
                                 className={`relative p-4 rounded-2xl border text-left transition-all ${active ? `bg-gradient-to-br ${p.accent} border-transparent shadow-md scale-[1.02]` : atCap ? 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 opacity-40 cursor-not-allowed' : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}
                                 title={atCap ? 'Up to 3 presets — remove one to swap' : active ? `Selected #${orderIndex + 1} — click to remove` : `Select style: ${p.label}`}
                                 aria-label={atCap ? 'Up to 3 presets — remove one to swap' : active ? `Selected style #${orderIndex + 1}: ${p.label}` : `Select style: ${p.label}`}
                               >
                                 {active && (
                                   <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/95 text-surface-900 text-xs font-black flex items-center justify-center shadow-sm tabular-nums">
                                     {orderIndex + 1}
                                   </span>
                                 )}
                                 <div className="text-2xl mb-2">{p.emoji}</div>
                                 <p className={`text-sm font-black tracking-tight ${active ? 'text-white' : 'text-surface-900 dark:text-white'}`}>{p.label}</p>
                                 <p className={`text-[10px] font-medium mt-1 ${active ? 'text-white/80' : 'text-surface-500'}`}>{p.tagline}</p>
                               </button>
                             )
                           })}
                         </div>
                      </div>

                      {/* Two-column core controls */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
                        {/* AI Tasks */}
                        <div className="space-y-4">
                           <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-3">
                             <Scissors size={14} className="text-primary-500" /> AI tasks
                           </label>
                           <div className="space-y-2">
                              {[
                                { id: 'removeSilence', label: 'Remove silence', desc: 'Auto-cut dead air & pauses' },
                                { id: 'optimizePacing', label: 'Optimize pacing', desc: 'Tight cuts for retention' },
                                { id: 'enhanceAudio', label: 'Enhance audio', desc: 'Noise reduction + leveling' },
                                { id: 'generateClips', label: 'Generate short clips', desc: 'Extract viral moments' },
                                { id: 'addCaptions', label: 'Burn-in captions', desc: 'Word-synced dynamic text' },
                                { id: 'enhanceColor', label: 'Color correction', desc: 'Auto LUT + grade' }
                              ].map(node => {
                                const on = !!editingOptions[node.id as keyof typeof editingOptions]
                                return (
                                  <button type="button" key={node.id} onClick={() => setEditingOptions(prev => ({ ...prev, [node.id]: !prev[node.id as keyof typeof prev] }))} className={`w-full px-4 py-3 rounded-xl border transition-all flex items-center justify-between text-left ${on ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700' : 'bg-surface-50 dark:bg-surface-950 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}>
                                    <div>
                                      <p className={`text-sm font-bold ${on ? 'text-primary-900 dark:text-primary-50' : 'text-surface-900 dark:text-white'}`}>{node.label}</p>
                                      <p className={`text-[11px] font-medium mt-0.5 ${on ? 'text-primary-700 dark:text-primary-400' : 'text-surface-500'}`}>{node.desc}</p>
                                    </div>
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-transparent'}`}>
                                      <CheckCircle2 size={12} />
                                    </div>
                                  </button>
                                )
                              })}
                           </div>
                        </div>

                        {/* Output, length, count */}
                        <div className="space-y-5">
                           <label className="text-[10px] font-bold text-surface-500 uppercase tracking-widest flex items-center gap-3">
                             <LayoutGrid size={14} className="text-primary-500" /> Output
                           </label>

                           <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                              <p className="text-xs font-bold text-surface-900 dark:text-white">Aspect ratio</p>
                              <div className="flex flex-wrap gap-2">
                                {[{ id: 'auto', label: 'Auto' }, { id: 'vertical', label: '9:16' }, { id: 'square', label: '1:1' }, { id: 'standard', label: '16:9' }].map(f => (
                                  <button type="button" key={f.id} onClick={() => setOutputFormat(f.id as 'auto' | 'vertical' | 'square' | 'standard')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${outputFormat === f.id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white' : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>{f.label}</button>
                                ))}
                              </div>
                           </div>

                           <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-surface-900 dark:text-white">Clips to generate</p>
                                <span className="text-sm font-black text-primary-600 dark:text-primary-400 tabular-nums">{clipCount}</span>
                              </div>
                              <input type="range" min="1" max="20" step="1" value={clipCount} onChange={(e) => setClipCount(Number(e.target.value))} aria-label="Number of clips to generate" title="Number of clips to generate" className="w-full accent-primary-500" />
                           </div>

                           <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                              <p className="text-xs font-bold text-surface-900 dark:text-white">Target length</p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { id: 'short', label: '< 30s' },
                                  { id: 'mid-3-5', label: '30-60s' },
                                  { id: 'mid-5-10', label: '1-3m' },
                                  { id: 'full', label: 'Full' }
                                ].map(o => (
                                  <button type="button" key={o.id} onClick={() => setClipTargetLength(o.id as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${clipTargetLength === o.id ? 'bg-surface-900 dark:bg-white text-white dark:text-surface-900 border-surface-900 dark:border-white' : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>{o.label}</button>
                                ))}
                              </div>
                           </div>

                           <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-3">
                              <p className="text-xs font-bold text-surface-900 dark:text-white">Pacing</p>
                              <div className="flex gap-2">
                                {(['gentle', 'medium', 'aggressive'] as const).map(p => (
                                  <button type="button" key={p} onClick={() => setPacingIntensity(p)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors border ${pacingIntensity === p ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>{p}</button>
                                ))}
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* Advanced collapsible — six grouped dimensions
                          (mood, captions, transitions, voice, B-roll, CTA)
                          that map 1:1 to backend options. Hidden by default
                          so the basic flow stays simple. */}
                      <div className="border-t border-surface-200 dark:border-surface-800 pt-6">
                         <button type="button" onClick={() => setAdvancedOpen(o => !o)} className="w-full flex items-center justify-between text-left group">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-center group-hover:border-primary-300 dark:group-hover:border-primary-700 transition-colors">
                                  <Settings size={16} className="text-surface-600 dark:text-surface-400" />
                               </div>
                               <div>
                                  <p className="text-sm font-black text-surface-900 dark:text-white tracking-tight">Advanced</p>
                                  <p className="text-[11px] font-medium text-surface-500">Mood, captions, transitions, voice, B-roll, CTA</p>
                               </div>
                            </div>
                            {advancedOpen ? <ChevronUp size={18} className="text-surface-400" /> : <ChevronDown size={18} className="text-surface-400" />}
                         </button>

                         {advancedOpen && (
                           <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <SelectCard icon={Palette} label="Color grade" value={colorGrade} onChange={setColorGrade}
                                options={['auto', 'vivid', 'cinematic', 'natural', 'cool', 'warm', 'vintage', 'bw']} />
                             <SelectCard icon={Music} label="Music genre" value={musicGenre} onChange={setMusicGenre}
                                options={['auto', 'phonk', 'lofi', 'cinematic', 'synthwave', 'upbeat-pop', 'chill', 'dark-ambient']} />
                             <SelectCard icon={Flame} label="Hook style" value={hookStyle} onChange={setHookStyle}
                                options={['auto', 'question', 'stat', 'mystery', 'story', 'bold-claim', 'pattern-break']} />
                             <SelectCard icon={Film} label="Transitions" value={transitionStyle} onChange={setTransitionStyle}
                                options={['auto', 'fast-cut', 'crossfade', 'glitch', 'whip-pan', 'hard-cut']} />
                             <SelectCard icon={Type} label="Caption style" value={captionStyle} onChange={setCaptionStyle}
                                options={['modern', 'bold', 'minimal', 'tiktok', 'youtube', 'neon', 'pill', 'cinematic']} />
                             <SelectCard icon={Layout} label="Subtitle position" value={subtitlePosition} onChange={setSubtitlePosition}
                                options={['auto', 'top', 'middle', 'bottom', 'lower-third']} />
                             <SelectCard icon={Mic} label="Voice tone" value={voiceTone} onChange={setVoiceTone}
                                options={['auto', 'energetic', 'calm', 'authoritative', 'playful', 'serious']} />
                             <SelectCard icon={Hash} label="CTA style" value={ctaStyle} onChange={setCtaStyle}
                                options={['auto', 'question', 'urgency', 'value', 'curiosity']} />
                             <SelectCard icon={Video} label="B-roll frequency" value={brollFrequency} onChange={setBrollFrequency}
                                options={['off', 'sparse', 'balanced', 'heavy']} />

                             <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <Gauge size={14} className="text-primary-500" />
                                   <div>
                                      <p className="text-xs font-bold text-surface-900 dark:text-white">Speed ramping</p>
                                      <p className="text-[10px] font-medium text-surface-500">Sine-modulate clip pace for energy</p>
                                   </div>
                                </div>
                                <button type="button" aria-label={`Toggle speed ramping`} onClick={() => setSpeedRamping(s => !s)} className={`w-10 h-6 rounded-full transition-colors flex items-center ${speedRamping ? 'bg-primary-500 justify-end' : 'bg-surface-300 dark:bg-surface-700 justify-start'}`}>
                                   <span className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                                </button>
                             </div>

                             <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                   <Zap size={14} className="text-primary-500" />
                                   <div>
                                      <p className="text-xs font-bold text-surface-900 dark:text-white">Prioritize hook</p>
                                      <p className="text-[10px] font-medium text-surface-500">Bias the first 3s for retention</p>
                                   </div>
                                </div>
                                <button type="button" aria-label={`Toggle prioritize hook`} onClick={() => setPrioritizeHook(s => !s)} className={`w-10 h-6 rounded-full transition-colors flex items-center ${prioritizeHook ? 'bg-primary-500 justify-end' : 'bg-surface-300 dark:bg-surface-700 justify-start'}`}>
                                   <span className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                                </button>
                             </div>

                             {/* Creative Direction — free-text injected into Gemini pre-flight */}
                             <div className="md:col-span-2 p-4 rounded-xl bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 space-y-2">
                               <div className="flex items-center gap-2">
                                 <Brain size={14} className="text-primary-500" />
                                 <p className="text-xs font-bold text-surface-900 dark:text-white">Creative Direction</p>
                                 <span className="ml-auto text-[10px] font-medium text-surface-500">optional · overrides AI defaults</span>
                               </div>
                               <textarea
                                 value={customInstructions}
                                 onChange={e => setCustomInstructions(e.target.value)}
                                 placeholder="e.g. Make it feel cinematic and dark, no jump cuts, emphasise the emotional pause at 0:42…"
                                 maxLength={400}
                                 rows={3}
                                 className="w-full bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2 text-xs font-medium text-surface-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500/40 resize-none placeholder:text-surface-400"
                               />
                               {customInstructions.length > 0 && (
                                 <p className="text-[10px] text-surface-400 text-right tabular-nums">{customInstructions.length}/400</p>
                               )}
                             </div>
                           </div>
                         )}
                      </div>

                      {/* Live AI Plan — recomposes itself on every state
                          change so the user can see exactly what the
                          AI is about to do before clicking Compose. The
                          processing-time estimate is heuristic but
                          calibrated against real auto-edit jobs:
                          ~25s per clip + 5s per active task + 10s if
                          captions are on (Whisper transcription is the
                          long pole). */}
                      {(() => {
                        const tasksOn = Object.values(editingOptions).filter(Boolean).length
                        const presets = stylePresetIds.map(id => STYLE_PRESETS.find(p => p.id === id)).filter(Boolean) as typeof STYLE_PRESETS[number][]
                        const variations = stylePresetIds.length === 0 ? 1 : Math.min(stylePresetIds.length * 3, 9)
                        const estSeconds = Math.max(15, clipCount * 25 + tasksOn * 5 + ((editingOptions as any).addCaptions ? 10 : 0))
                        const estLabel = estSeconds < 60 ? `~${estSeconds}s` : `~${Math.ceil(estSeconds / 60)}m`
                        const learnedNow = styleInsight?.source === 'user' && insightApplied && stylePresetIds.length > 0
                        const aspectLabel = outputFormat === 'auto' ? 'Auto-fit' : outputFormat === 'vertical' ? '9:16' : outputFormat === 'square' ? '1:1' : '16:9'
                        const lengthLabel = clipTargetLength === 'short' ? '<30s' : clipTargetLength === 'mid-3-5' ? '30-60s' : clipTargetLength === 'mid-5-10' ? '1-3m' : 'Full'
                        return (
                          <div className="rounded-2xl bg-gradient-to-br from-primary-500/[0.06] via-transparent to-primary-500/[0.04] border border-primary-200/50 dark:border-primary-700/30 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-primary-500/15 border border-primary-300/40 dark:border-primary-700/40 flex items-center justify-center">
                                <Sparkle size={13} className="text-primary-600 dark:text-primary-400" />
                              </div>
                              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-primary-700 dark:text-primary-300">AI Plan</p>
                              {learnedNow && (
                                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                                  <Brain size={10} /> Pre-loaded your style
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-surface-800 dark:text-surface-200 leading-relaxed">
                              Compose <span className="font-black">{clipCount}</span> {aspectLabel} clip{clipCount === 1 ? '' : 's'}, target <span className="font-black">{lengthLabel}</span>
                              {targetPlatform !== 'auto' && <> for <span className="font-black capitalize">{targetPlatform}</span></>}
                              {contentTone !== 'auto' && <> · <span className="font-black capitalize">{contentTone}</span> tone</>}
                              {presets.length > 0 ? (
                                <> across <span className="font-black">{presets.map(p => p.label).join(' + ')}</span> ({variations} variation angles)</>
                              ) : (
                                <> with <span className="font-black">auto-detected</span> style</>
                              )}
                              {colorGrade !== 'auto' && <>, <span className="font-black capitalize">{colorGrade.replace('-', ' ')}</span> color grade</>}
                              {hookStyle !== 'auto' && <>, <span className="font-black capitalize">{hookStyle.replace('-', ' ')}</span> hook</>}
                              {pacingIntensity !== 'medium' && <>, <span className="font-black capitalize">{pacingIntensity}</span> pacing</>}
                              {speedRamping && <>, speed-ramping on</>}
                              {brollFrequency !== 'off' && brollFrequency !== 'balanced' && <>, <span className="font-black capitalize">{brollFrequency}</span> B-roll</>}
                              .
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300">
                                <Cpu size={10} /> {tasksOn} task{tasksOn === 1 ? '' : 's'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300">
                                <Activity size={10} /> est {estLabel}
                              </span>
                              {(editingOptions as any).addCaptions && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300">
                                  <Type size={10} /> Captions
                                </span>
                              )}
                              {(editingOptions as any).enhanceColor && colorGrade === 'auto' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300">
                                  <Palette size={10} /> Auto-grade
                                </span>
                              )}
                              {speedRamping && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300">
                                  <Gauge size={10} /> Speed ramp
                                </span>
                              )}
                              {targetPlatform !== 'auto' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300 capitalize">
                                  <Globe size={10} /> {targetPlatform}
                                </span>
                              )}
                              {contentTone !== 'auto' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/60 dark:bg-surface-900/60 border border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-700 dark:text-surface-300 capitalize">
                                  <Sparkle size={10} /> {contentTone}
                                </span>
                              )}
                              {customInstructions.trim() && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-[10px] font-bold text-primary-700 dark:text-primary-300 max-w-xs truncate">
                                  <Brain size={10} /> &ldquo;{customInstructions.trim().substring(0, 40)}{customInstructions.trim().length > 40 ? '…' : ''}&rdquo;
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Submit */}
                      <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
                         <button type="button" onClick={handleStartAIEdit} disabled={processing} className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                           {processing ? <RefreshCw size={20} className="animate-spin" /> : <Wand2 size={20} />}
                           {processing ? 'Composing your edit…' : `Compose ${clipCount} clip${clipCount === 1 ? '' : 's'}`}
                         </button>
                         <p className="text-[10px] text-center text-surface-500 mt-3 font-medium">
                           {stylePresetIds.length > 0
                             ? `Using ${stylePresetIds.map(id => STYLE_PRESETS.find(p => p.id === id)?.label).filter(Boolean).join(' + ')}`
                             : 'Auto-select preset based on your content'}
                           {' · '}
                           {Object.values(editingOptions).filter(Boolean).length} task{Object.values(editingOptions).filter(Boolean).length === 1 ? '' : 's'} on
                         </p>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return null
}
