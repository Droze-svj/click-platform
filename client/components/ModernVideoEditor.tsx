'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Download,
  Video,
  Cpu,
  Smartphone,
  Upload as UploadCloudIcon,
  Edit as EditToolIcon,
  Layers,
  Layers as LayersIcon,
  Search,
  MessageSquare as AiIcon,
  Film,
  List,
  Magnet,
  Sparkles,
  Orbit,
  Zap,
  ShieldCheck,
  Radio,
  Fingerprint,
  BrainCircuit,
  Database,
  Send,
  Scissors,
  Trash2,
  Lock,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Clinical Utilities
import { getStatusColor, loadEditorContentPreferences, pushRecentSection } from '../utils/editorUtils'
import { CATEGORIES } from '../utils/editorConstants'
import { EDITOR_GROUPS, groupForCategory } from '../utils/editorGroups'

// Contextual Components
import { EditorSidebar } from './editor/EditorSidebar'
import { useMultiplayerTimeline } from '../hooks/useMultiplayerTimeline'
import { PropertiesPanel } from './editor/PropertiesPanel'
import RealTimeVideoPreview from './editor/RealTimeVideoPreview'
import ResizableTimeline from './editor/ResizableTimeline'
import AiAssistant from './editor/AiAssistant'
import AiTimelineChat from './editor/AiTimelineChat'
import EngagementHeatMap from './editor/EngagementHeatMap'
import HealthDeltaOverlay from './editor/HealthDeltaOverlay'

// Specialized Views
import EliteAIView from './editor/views/EliteAIView'
import CreativeAIView from './editor/views/CreativeAIView'
import GrowthInsightsView from './editor/views/GrowthInsightsView'
import PredictionEngineView from './editor/views/PredictionEngineView'
import AutomateView from './editor/views/AutomateView'
import ColorGradingView from './editor/views/ColorGradingView'
const AdvancedTimelineView = dynamic(() => import('./editor/views/AdvancedTimelineView'), { ssr: false })
import AssetLibraryView from './editor/views/AssetLibraryView'
import CollaborateView from './editor/views/CollaborateView'
import EffectsView from './editor/views/EffectsView'
import ExportView from './editor/views/ExportView'
import BasicEditorView from './editor/views/BasicEditorView'
import ScriptGeneratorView from './editor/views/ScriptGeneratorView'
import ThumbnailGeneratorView from './editor/views/ThumbnailGeneratorView'
import SchedulingView from './editor/views/SchedulingView'
import ShortClipsView from './editor/views/ShortClipsView'
import { ChromaKeySettings } from './editor/views/ChromakeyView'
import AIAssistView from './editor/views/AIAssistView'
import Inspector, { deriveSelection } from './editor/Inspector'
import PerformanceRail from './editor/PerformanceRail'
import { useCreatorPipeline, type PipelineStage } from '../hooks/useCreatorPipeline'
import DistributionHubView from './editor/views/DistributionHubView'
import { StyleVaultDashboardView } from './editor/views/StyleVaultDashboardView'
import { NeuralTrainingMatrixView } from './editor/views/NeuralTrainingMatrixView'
import { ProfileTuningView } from './editor/views/ProfileTuningView'
import IntelligenceEngineView from './editor/views/IntelligenceEngineView' // Added
import Trends2026View from './editor/views/Trends2026View'
import StockLibraryView from './editor/views/StockLibraryView'
import CreativePacksView from './editor/views/CreativePacksView'
import TextMotionStudioView from './editor/views/TextMotionStudioView'
import { useStyleDNA } from '../hooks/useStyleDNA' // Added
import { useTimelineActions } from '../hooks/useTimelineActions'
import { useStyleProfile } from '../hooks/useStyleProfile'
import { useEditorShortcuts } from '../hooks/useEditorShortcuts'
import { rippleDelete as rippleDeleteOp } from '../utils/timelineOps'
import { PlatformInsights } from '../types/editor' // Added

import AchievementSystem from './AchievementSystem'
import { ErrorBoundary } from './ErrorBoundary'
import { useVideoEditorAutosave } from '../hooks/useVideoEditorAutosave'
import { useToast } from '../contexts/ToastContext'
import { getAssetUrl } from '../utils/url'
import KeyboardShortcutsHelp from './editor/KeyboardShortcutsHelp'
import { InsightsSidebar } from './editor/InsightsSidebar'
import EditorHUD from './editor/EditorHUD'
import QuickActionsBar from './editor/QuickActionsBar'
import SmartCleanupPanel from './editor/SmartCleanupPanel'
import CommandK from './CommandK'
import { calculateEngagementScore } from '../utils/rankingEngine'
import { generateSmartMetadata } from '../utils/metadataGenerator'
import { apiGet, apiPost } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { useBrandKit } from './BrandKit'
import {
  VideoFilter,
  TextOverlay,
  TimelineSegment,
  TimelineEffect,
  TimelineMarker,
  EditorCategory,
  CaptionStyle,
  TemplateLayout,
  TEMPLATE_LAYOUTS,
  ShapeOverlay,
  ImageOverlay,
  GradientOverlay,
  Transcript,
  AIDirectorSuggestion,
  EngagementScore,
  ContentNiche,
  AutoEditClip,
  VideoMetadata,
  EditorLayoutPreferences,
  PreviewSize,
  Asset,
  StyleProfile,
  StyleVault
} from '../types/editor'
import { formatTime } from '../utils/editorUtils'

const NEUTRAL_FILTER: VideoFilter = {
  brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
  noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100,
  exposure: 0,
  lift: { r: 0, g: 0, b: 0 },
  gamma: { r: 0, g: 0, b: 0 },
  gain: { r: 0, g: 0, b: 0 }
}

const LAYOUT_STORAGE_KEY = 'click-editor-layout'
const TRACK_VISIBILITY_KEY = 'click-editor-track-visibility'
const SNAP_TO_KEYFRAMES_KEY = 'click-editor-snap-to-keyframes'

const SNAP_THRESHOLD_SEC = 0.35

function getSnappedTime(
  t: number,
  selectedSegmentId: string | null,
  selectedEffectId: string | null,
  segments: TimelineSegment[],
  effects: TimelineEffect[]
): number {
  const times: number[] = []
  if (selectedSegmentId) {
    const seg = segments.find((s) => s.id === selectedSegmentId)
    if (seg?.transformKeyframes?.length) {
      seg.transformKeyframes.forEach((kf) => times.push(kf.time))
    }
  }
  if (selectedEffectId) {
    const eff = effects.find((e) => e.id === selectedEffectId)
    if (eff?.transformKeyframes?.length && eff.endTime > eff.startTime) {
      eff.transformKeyframes.forEach((kf) => times.push(eff.startTime + kf.time * (eff.endTime - eff.startTime)))
    }
  }
  if (times.length === 0) return t
  const sorted = Array.from(new Set(times)).sort((a, b) => a - b)
  let best = t
  let bestDist = SNAP_THRESHOLD_SEC
  for (const sec of sorted) {
    const d = Math.abs(sec - t)
    if (d < bestDist) {
      bestDist = d
      best = sec
    }
  }
  return best
}

const WORKFLOW_STEPS: { id: EditorCategory; label: string; icon?: React.ElementType; color?: string }[] = [
  { id: 'edit', label: 'Manual Edit', icon: EditToolIcon, color: 'text-surface-900 dark:text-white' },
  { id: 'color', label: 'Color Grading', icon: Video, color: 'text-blue-600 dark:text-blue-400' },
  { id: 'ai', label: 'AI Auto Edit', icon: AiIcon, color: 'text-primary-600 dark:text-primary-400' },
  { id: 'effects', label: 'Visual Effects', icon: LayersIcon, color: 'text-amber-600 dark:text-amber-400' },
  { id: 'remix', label: 'Auto Remix', icon: Sparkles, color: 'text-fuchsia-600 dark:text-fuchsia-400' },
  { id: 'predict', label: 'Performance Forecast', icon: BrainCircuit, color: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'intelligence', label: 'Brand DNA', icon: Database, color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'timeline', label: 'Timeline', icon: List, color: 'text-surface-600 dark:text-surface-400' },
  { id: 'export', label: 'Export', icon: Send, color: 'text-surface-900 dark:text-white' },
  { id: 'style-vault', label: 'Asset Library', icon: Orbit, color: 'text-pink-600 dark:text-pink-400' },
]

const DEFAULT_LAYOUT: EditorLayoutPreferences = {
  previewSize: 'auto',
  timelineDensity: 'comfortable',
  focusMode: 'balanced',
}

function loadLayoutPreferences(): EditorLayoutPreferences {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<EditorLayoutPreferences>
    return {
      previewSize: ['auto', 'small', 'medium', 'large', 'fill'].includes(parsed.previewSize ?? '') ? parsed.previewSize! : DEFAULT_LAYOUT.previewSize,
      timelineDensity: ['compact', 'comfortable', 'expanded'].includes(parsed.timelineDensity ?? '') ? parsed.timelineDensity! : DEFAULT_LAYOUT.timelineDensity,
      focusMode: ['balanced', 'preview', 'timeline'].includes(parsed.focusMode ?? '') ? parsed.focusMode! : DEFAULT_LAYOUT.focusMode,
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

const glassStyle = "bg-black/40 backdrop-blur-3xl border-2 border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 rounded-[3rem]"

const ModernVideoEditor: React.FC<{
  videoUrl?: string;
  videoPath?: string;
  videoId?: string;
  initialState?: any;
  /**
   * Deep-link from /dashboard/tools cards. When set, the SmartCleanup
   * panel auto-opens on mount with this tool pre-selected so the user
   * never sees the "what now?" gap between picking the AI tool and
   * landing in the editor.
   */
  initialAiTool?: 'silence' | 'fillers' | 'edit-by-text' | null;
}> = ({ videoUrl, videoPath, videoId, initialState, initialAiTool }) => {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const brandKit = useBrandKit()
  const actualVideoUrl = getAssetUrl(videoUrl || videoPath || '')

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // ── Consolidated UI & Interaction State ──
  const [activeCategoryState, setActiveCategoryState] = useState<EditorCategory>(() => {
    if (typeof window === 'undefined') return 'edit'
    try {
      const prefs = loadEditorContentPreferences()
      const section = prefs.defaultOpenSection
      return section && CATEGORIES.some(c => c.id === section) ? section : 'edit'
    } catch { return 'edit' }
  })

  const setActiveCategory = useCallback((category: EditorCategory) => {
    setActiveCategoryState(category)
    pushRecentSection(category)
  }, [])
  const activeCategory = activeCategoryState; // Renamed to avoid conflict with the new state variable

  const [projectName, setProjectName] = useState(t('modernVideoEditor.untitledProject'))
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(false)
  const [showPerformanceRail, setShowPerformanceRail] = useState(false)
  const [insightsSidebarCollapsed, setInsightsSidebarCollapsed] = useState(false)

  // Hydration-safe load of workspace insights sidebar preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('click-insights-sidebar-collapsed')
      if (stored !== null) {
        setInsightsSidebarCollapsed(stored === 'true')
      }
    }
  }, [])

  // Persist workspace insights sidebar preference whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('click-insights-sidebar-collapsed', String(insightsSidebarCollapsed))
    }
  }, [insightsSidebarCollapsed])

  const [contentPanelCollapsed, setContentPanelCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandKOpen, setCommandKOpen] = useState(false)
  // Smart cleanup panel — opens an in-editor modal that runs the
  // /video/tools/* AI ops (silence cut, filler removal, edit-by-text)
  // on the currently loaded videoId without leaving the workspace.
  // initialAiTool deep-links from /dashboard/tools cards so the panel
  // opens already focused on the picked tool.
  const [smartCleanupOpen, setSmartCleanupOpen] = useState<boolean>(!!initialAiTool)
  const [smartCleanupInitialTool, setSmartCleanupInitialTool] = useState<'silence' | 'fillers' | 'edit-by-text' | null>(initialAiTool || null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // ── Consolidated Video & Media State ──
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<Transcript | null>({
    fullText: "Welcome to the future of AI video editing. This is the Object-Based Semantic Timeline where words drive your creative flow.",
    words: [
      { text: "Welcome", start: 0.2, end: 0.8 },
      { text: "to", start: 0.8, end: 1.0 },
      { text: "the", start: 1.0, end: 1.2 },
      { text: "future", start: 1.2, end: 1.8 },
      { text: "of", start: 1.8, end: 2.0 },
      { text: "AI", start: 2.0, end: 2.5 },
      { text: "video", start: 2.5, end: 3.0 },
      { text: "editing.", start: 3.0, end: 3.8 },
      { text: "This", start: 4.5, end: 4.8 },
      { text: "is", start: 4.8, end: 5.0 },
      { text: "the", start: 5.0, end: 5.2 },
      { text: "Object-Based", start: 5.2, end: 6.2 },
      { text: "Semantic", start: 6.2, end: 7.0 },
      { text: "Timeline", start: 7.0, end: 7.8 },
      { text: "where", start: 8.0, end: 8.4 },
      { text: "words", start: 8.4, end: 9.0 },
      { text: "drive", start: 9.0, end: 9.5 },
      { text: "your", start: 9.5, end: 9.8 },
      { text: "creative", start: 9.8, end: 10.5 },
      { text: "flow.", start: 10.5, end: 11.2 }
    ],
    scenes: [
      { id: 'scene-1', startTime: 0, endTime: 4, title: 'Introduction', index: 1 },
      { id: 'scene-2', startTime: 4, endTime: 12, title: 'Concept Deep-Dive', index: 2 }
    ]
  })
  const [editingWords, setEditingWords] = useState<any[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [videoState, setVideoState] = useState({ currentTime: 0, duration: 0, isPlaying: false, volume: 1, isMuted: false })
  const [videoFilters, setVideoFilters] = useState<VideoFilter>(NEUTRAL_FILTER)
  const [filterStrength, setFilterStrength] = useState(100)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [videoTransform, setVideoTransform] = useState<{ scale?: number, positionX?: number, positionY?: number, rotation?: number }>({
    scale: 1, positionX: 0, positionY: 0, rotation: 0
  })
  const [videoCrop, setVideoCrop] = useState<{ top?: number, right?: number, bottom?: number, left?: number }>({
    top: 0, right: 0, bottom: 0, left: 0
  })
  const [videoTransformKeyframes, setVideoTransformKeyframes] = useState<any[]>([])
  const [showBeforeAfter, setShowBeforeAfter] = useState(true)
  const [compareMode, setCompareMode] = useState<'after' | 'before' | 'split'>('after')
  const [colorGradeSettings, setColorGradeSettings] = useState<any>({})
  const [chromaKey, setChromaKey] = useState<ChromaKeySettings>({
    enabled: false, color: '#00ff00', tolerance: 40, spill: 50, edge: 25, opacity: 100,
  })

  // ── Consolidated Overlay & Segment State ──
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [shapeOverlays, setShapeOverlays] = useState<ShapeOverlay[]>([])
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([])
  const [svgOverlays, setSvgOverlays] = useState<any[]>([])
  const [gradientOverlays, setGradientOverlays] = useState<GradientOverlay[]>([])
  const roomId = videoId || 'local-draft'
  const { activeSegments: timelineSegments, updateSegments: setTimelineSegments } = useMultiplayerTimeline(roomId, [])
  const [timelineMarkers, setTimelineMarkers] = useState<TimelineMarker[]>([])
  const [timelineEffects, setTimelineEffects] = useState<TimelineEffect[]>([])
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([])
  const selectedSegmentId = selectedSegmentIds[0] ?? null
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const [trackVisibility, setTrackVisibility] = useState<Record<number, boolean>>({})

  // Intelligence & Style DNA — order matters: styleProfile must initialize before
  // styleDNA so the DNA derivation can read the user's persisted picks.
  const styleProfile = useStyleProfile()
  const styleDNA = useStyleDNA(
    timelineSegments,
    [...textOverlays, ...shapeOverlays, ...imageOverlays, ...svgOverlays, ...gradientOverlays],
    styleProfile.profile,
  );
  const creatorPipeline = useCreatorPipeline()
  const [aiProposalSnapshot, setAiProposalSnapshot] = useState<any>(null); // Added
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]); // Added

  // ── Consolidated AI & Strategy State ──
  const [contentNiche, setContentNiche] = useState<ContentNiche>('educational')
  const [targetLanguage, setTargetLanguage] = useState<string>('en')
  const [engagementScore, setEngagementScore] = useState<EngagementScore>({
    overall: 85, viralPotential: 78, hookStrength: 92, sentimentDensity: 70, trendAlignment: 82, retentionHeatmap: Array(20).fill(80).map((v, i) => v - i * 2)
  })
  const [autoEditClips, setAutoEditClips] = useState<AutoEditClip[]>([])
  const [generatedMetadata, setGeneratedMetadata] = useState<VideoMetadata | null>(null)
  const [aiDirectorSuggestions, setAiDirectorSuggestions] = useState<AIDirectorSuggestion[]>([
    { id: 'suggest-1', time: 2.0, type: 'hook', label: 'Hook Alert', description: 'Strong opening statement. Add motion graphic here?', confidence: 0.95, impact: 'high' },
    { id: 'suggest-2', time: 8.5, type: 'broll', label: 'B-Roll Suggestion', description: 'Context: "creative flow". Overlay whiteboard animation?', confidence: 0.88, impact: 'medium' },
    { id: 'suggest-3', time: 4.2, type: 'cut', label: 'Silence Detected', description: '0.7s gap. Auto-cut to improve pacing?', confidence: 0.92, impact: 'medium' }
  ])

  // Fetch Advanced Analytics Insights
  useEffect(() => {
    const fetchEditorInsights = async () => {
      try {
        const res = await apiGet('/analytics/content/editor-insights')
        const insights = (res as any)?.data || res
        
        if (insights) {
          // Update Engagement Score Based on Real Analytics
          setEngagementScore(prev => ({
            ...prev,
            hookStrength: insights.editing.cutFrequencySeconds < 2 ? 95 : 85,
            viralPotential: insights.scheduling.accuracyScore > 0.9 ? 92 : 78
          }))

          // Push data-driven AI suggestions into the pipeline
          setAiDirectorSuggestions(prev => [
            {
              id: 'analytics-pacing',
              time: 0.5,
              type: 'hook',
              label: 'Data-Driven Pacing',
              description: `Analytics show ${insights.editing.recommendedPace} pacing retains ${insights.captions.reason}. Recommend cut frequency: ${insights.editing.cutFrequencySeconds}s.`,
              confidence: 0.98,
              impact: 'high'
            },
            ...prev
          ])
        }
      } catch (err) {
        console.error('Failed to load advanced editor insights:', err)
      }
    }
    fetchEditorInsights()
  }, [])

  const [isMakingViral, setIsMakingViral] = useState(false)

  // POST /api/video/viral/one-click — hits oneClickViralService which
  // chains hook → pattern interrupts → b-roll → beat sync → CTA in one
  // call, then maps the response into AIDirectorSuggestion records and
  // pushes them straight into the AI tab's apply pile via the dispatcher
  // we already own. Single button = full edit recipe.
  const handleMakeItViral = useCallback(async () => {
    if (!videoId) { showToast(t('modernVideoEditor.noVideoLoaded'), 'error'); return }
    if (isMakingViral) return
    setIsMakingViral(true)
    try {
      showToast(t('modernVideoEditor.composingViralRecipe', { language: targetLanguage }), 'info')
      const res = await apiPost<{ data: { suggestions: AIDirectorSuggestion[]; stages: any[] } }>(
        '/video/viral/one-click',
        { contentId: videoId, niche: contentNiche, platform: 'tiktok', targetLanguage },
      )
      const suggestions = (res as any)?.data?.suggestions || (res as any)?.suggestions || []
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        showToast(t('modernVideoEditor.noSuggestionsReturned'), 'info')
        return
      }
      // Replace director suggestions with the fresh batch and route the
      // user to the AI tab so they see the apply pile. New suggestion IDs
      // are distinct from any prior batch, so the apply Set doesn't need
      // to be reset — old applied marks naturally don't overlap.
      setAiDirectorSuggestions(suggestions)
      setActiveCategory('ai-analysis' as any)
      showToast(t('modernVideoEditor.suggestionsReadyApplyAll', { count: suggestions.length }), 'success')
    } catch (err: any) {
      showToast(err?.message || t('modernVideoEditor.makeItViralFailed'), 'error')
    } finally {
      setIsMakingViral(false)
    }
  }, [videoId, isMakingViral, contentNiche, showToast, setActiveCategory, targetLanguage, t])

  // Wired ahead of declaration so the dispatcher passes the freshest
  // segments/overlays into applySuggestion. Defined right after
  // aiDirectorSuggestions so the AI tab's Apply / Apply-All buttons can
  // call apply()/applyAll() directly without prop-drilling state.
  const timelineActions = useTimelineActions({
    segments: timelineSegments,
    setSegments: (next) => {
      if (typeof next === 'function') setTimelineSegments(next as any)
      else setTimelineSegments(next)
    },
    textOverlays,
    setTextOverlays: (next) => {
      if (typeof next === 'function') setTextOverlays(next as any)
      else setTextOverlays(next)
    },
    duration: videoState.duration,
    resetKey: videoId ?? null,
    showToast,
  })

  // ── Consolidated Automation & History State ──
  const [voiceoverText, setVoiceoverText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('alloy')
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)
  const [userAssets, setUserAssets] = useState<Asset[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyIndexRef = useRef(0)
  const isHistoryActionRef = useRef(false)

  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  // Centralized, loop-safe history engine
  const pushHistory = useCallback((segments: TimelineSegment[], texts: TextOverlay[], shapes: ShapeOverlay[], images: ImageOverlay[], filters: VideoFilter) => {
    if (isHistoryActionRef.current) return
    const newState = {
      timelineSegments: JSON.parse(JSON.stringify(segments || [])),
      textOverlays: JSON.parse(JSON.stringify(texts || [])),
      shapeOverlays: JSON.parse(JSON.stringify(shapes || [])),
      imageOverlays: JSON.parse(JSON.stringify(images || [])),
      videoFilters: JSON.parse(JSON.stringify(filters || NEUTRAL_FILTER))
    }
    setHistory(prev => {
      const idx = historyIndexRef.current
      const nextHistory = prev.slice(0, idx + 1)
      if (nextHistory.length > 0) {
        const last = nextHistory[nextHistory.length - 1]
        if (JSON.stringify(last) === JSON.stringify(newState)) return prev
      }
      nextHistory.push(newState)
      if (nextHistory.length > 30) {
        nextHistory.shift()
        setHistoryIndex(29)
      } else {
        setHistoryIndex(nextHistory.length - 1)
      }
      return nextHistory
    })
  }, [])

  // Auto-record timeline changes
  useEffect(() => {
    if (isHistoryActionRef.current) return
    pushHistory(timelineSegments, textOverlays, shapeOverlays, imageOverlays, videoFilters)
  }, [timelineSegments, textOverlays, shapeOverlays, imageOverlays, videoFilters, pushHistory])

  // ── Style Vault State ──
  const [styleVaultView, setStyleVaultView] = useState<'dashboard' | 'train' | 'tune'>('dashboard')
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([
    {
      id: 'style-1',
      name: 'Tech Minimalism',
      lastTrained: Date.now() - 86400000 * 2,
      pacing: { medianClipLength: 4.5, jCutFrequency: 'high', lCutFrequency: 'medium', cutOnSentence: true },
      visuals: { punchInFrequency: 8, punchInAmount: 15, defaultTransition: 'zoom' },
      assets: { fontFamily: 'Inter, sans-serif', fontHex: '#ffffff', dropShadowHex: 'rgba(0,0,0,0.5)', bezierCurve: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      audio: { duckingDb: -18, masterDb: 0, voiceDb: -3 }
    },
    {
      id: 'style-2',
      name: 'Cinematic Vlog',
      lastTrained: Date.now() - 86400000 * 5,
      pacing: { medianClipLength: 8, jCutFrequency: 'low', lCutFrequency: 'high', cutOnSentence: false },
      visuals: { punchInFrequency: 12, punchInAmount: 10, defaultTransition: 'crossfade' },
      assets: { fontFamily: 'Georgia, serif', fontHex: '#fef3c7', dropShadowHex: 'rgba(0,0,0,0.3)', bezierCurve: 'ease-in-out' },
      audio: { duckingDb: -22, masterDb: -1, voiceDb: -4 }
    }
  ])
  const [tuningProfile, setTuningProfile] = useState<StyleProfile | null>(null)

  // Fetch User Assets for Neural Retrieval
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const [videoRes, musicRes] = await Promise.all([
          apiGet('/video'),
          apiGet('/music/user-uploads')
        ])

        const brolls = (videoRes?.data ?? videoRes)?.map((v: any) => ({
          id: v._id,
          url: getAssetUrl(v.originalFile?.url || ''),
          title: v.title || t('modernVideoEditor.uploadedBroll'),
          type: 'broll',
          source: 'upload',
          autoTags: v.metadata?.tags || []
        })) || []

        const music = (musicRes?.data?.tracks ?? musicRes?.tracks ?? [])?.map((m: any) => ({
          id: m._id,
          url: getAssetUrl(m.file?.url || ''),
          title: m.title || t('modernVideoEditor.uploadedMusic'),
          type: 'music',
          source: 'upload',
          autoTags: m.metadata?.tags || []
        })) || []

        setUserAssets([...brolls, ...music])
      } catch (err) {
        console.error('Failed to fetch user assets for neural drafts', err)
      }
    }
    fetchAssets()
  }, [])

  const handleAddVoiceoverSegment = useCallback((url: string, duration: number) => {
    const id = `voiceover-${Date.now()}`
    const startTime = videoState.currentTime

    // 1. Add Audio Segment
    const newSegment: TimelineSegment = {
      id,
      startTime,
      endTime: startTime + duration,
      duration: duration,
      type: 'audio',
      name: t('modernVideoEditor.aiVoiceoverName', { voice: selectedVoice }),
      color: '#f97316', // Orange
      track: 7, // Dialogue track A2
      sourceUrl: url,
    }
    setTimelineSegments((prev: TimelineSegment[]) => [...prev, newSegment])

    // 2. Generate Auto-Captions
    if (voiceoverText.trim()) {
      // Keyword to Emoji Mapping
      const emojiMap: Record<string, string> = {
        'money': '💸', 'cash': '💰', 'profit': '📈', 'win': '🏆', 'success': '🚀',
        'fire': '🔥', 'hot': '🥵', 'cool': '😎', 'love': '❤️', 'amazing': '✨',
        'stop': '🛑', 'alert': '🚨', 'warning': '⚠️', 'new': '🆕', 'best': '💎',
        'growth': '📊', 'future': '🔮', 'fast': '⚡', 'power': '💪', 'easy': '✅',
        'ai': '🤖', 'robot': '🦾', 'code': '💻', 'tech': '📱', 'network': '🌐'
      }

      // Smarter Splitting: Split by punctuation first, then by word count
      const rawChunks = voiceoverText.trim().split(/([,.?!])\s+/)
      const processedChunks: string[] = []

      for (let i = 0; i < rawChunks.length; i++) {
        const text = rawChunks[i]
        if (text.match(/[,.?!]/)) {
          if (processedChunks.length > 0) {
            processedChunks[processedChunks.length - 1] += text
          }
        } else {
          // If chunk is too long, split by words
          const words = text.split(/\s+/)
          if (words.length > 5) {
            for (let j = 0; j < words.length; j += 4) {
              processedChunks.push(words.slice(j, j + 4).join(' '))
            }
          } else {
            processedChunks.push(text)
          }
        }
      }

      const totalChars = voiceoverText.length
      let currentOffset = 0

      const newCaptions: TextOverlay[] = processedChunks.filter(c => c.length > 1).map((chunk, index) => {
        const chunkWeight = chunk.length / totalChars
        const chunkDuration = duration * chunkWeight
        const captionStartTime = startTime + currentOffset
        const captionEndTime = captionStartTime + chunkDuration

        currentOffset += chunkDuration

        // Emoji Injection
        let displayText = String(chunk || '').toUpperCase()
        Object.entries(emojiMap).forEach(([keyword, emoji]) => {
          if (String(chunk || '').toLowerCase().includes(keyword)) {
            displayText = `${displayText} ${emoji}`
          }
        })

        return {
          id: `caption-${id}-${index}`,
          text: displayText,
          x: 50,
          y: 80,
          fontSize: 34,
          color: '#ffffff',
          fontFamily: 'Inter, sans-serif',
          startTime: captionStartTime,
          endTime: captionEndTime,
          style: 'bold-kinetic',
          shadowColor: 'rgba(0,0,0,0.6)',
          animationIn: 'pop',
          animationOut: 'fade',
          animationInDuration: 0.15,
          animationOutDuration: 0.2,
          layer: 10
        }
      })

      setTextOverlays(prev => [...prev, ...newCaptions])
      showToast(t('modernVideoEditor.intelligentCaptionsSynced'), 'success')
    } else {
      showToast(t('modernVideoEditor.voiceoverAddedToTimeline'), 'success')
    }
  }, [videoState.currentTime, selectedVoice, voiceoverText, setTimelineSegments, setTextOverlays, showToast, t])

  // Split the segment under the playhead at the current time. Mirrors the
  // logic in ResizableTimeline.splitSegmentAt so the BasicEditorView Trim tab
  // can drive the same operation.
  const handleSplitAtPlayhead = useCallback(() => {
    const time = videoState.currentTime
    const seg = timelineSegments.find((s: TimelineSegment) => time > s.startTime && time < s.endTime)
    if (!seg) {
      showToast(t('modernVideoEditor.movePlayheadToSplit'), 'info')
      return
    }
    const durLeft = time - seg.startTime
    const durRight = seg.endTime - time
    if (durLeft < 0.25 || durRight < 0.25) {
      showToast(t('modernVideoEditor.cannotSplitTooClose'), 'info')
      return
    }
    const newId = typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const right: TimelineSegment = { ...seg, id: newId, startTime: time, endTime: seg.endTime, duration: durRight }
    setTimelineSegments((prev: TimelineSegment[]) => prev.flatMap((s: TimelineSegment) => {
      if (s.id !== seg.id) return [s]
      const left: TimelineSegment = { ...seg, endTime: time, duration: durLeft }
      return [left, right]
    }))
    showToast(t('modernVideoEditor.splitClipAt', { time: time.toFixed(2) }), 'success')
  }, [videoState.currentTime, timelineSegments, setTimelineSegments, showToast, t])

  // Toggle the `reversed` flag on the currently selected segment. Wired to the
  // segment-aware renderer's reverse,areverse path. Operates on the first
  // selected segment, or on the segment under the playhead if none selected.
  const handleReverseSelected = useCallback(() => {
    const targetId = selectedSegmentId
      || timelineSegments.find((s: TimelineSegment) => videoState.currentTime > s.startTime && videoState.currentTime < s.endTime)?.id
    if (!targetId) {
      showToast(t('modernVideoEditor.selectClipToReverse'), 'info')
      return
    }
    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) =>
      s.id === targetId ? { ...s, reversed: !s.reversed } : s
    ))
    const seg = timelineSegments.find((s: TimelineSegment) => s.id === targetId)
    showToast(seg?.reversed ? t('modernVideoEditor.reverseRemoved') : t('modernVideoEditor.reverseApplied'), 'success')
  }, [selectedSegmentId, timelineSegments, setTimelineSegments, videoState.currentTime, showToast, t])

  // Insert a freeze-frame segment at the playhead. The host segment is split
  // around the playhead, and a freeze segment of `freezeDurationSec` is
  // inserted between the two halves. The renderer turns this into a tpad
  // clone with silent audio.
  const handleFreezeAtPlayhead = useCallback((freezeDurationSec: number = 1.0) => {
    const time = videoState.currentTime
    const host = timelineSegments.find((s: TimelineSegment) => time > s.startTime && time < s.endTime)
    if (!host) {
      showToast(t('modernVideoEditor.movePlayheadToFreeze'), 'info')
      return
    }
    const durLeft = time - host.startTime
    const durRight = host.endTime - time
    if (durLeft < 0.05 || durRight < 0.05) {
      showToast(t('modernVideoEditor.cannotFreezeTooClose'), 'info')
      return
    }
    const freezeId = typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID() : `freeze-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const rightId = typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID() : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const sourceStartLeft = host.sourceStartTime ?? host.startTime
    const sourceCutPoint = sourceStartLeft + durLeft
    const sourceEndRight = host.sourceEndTime ?? host.endTime

    const left: TimelineSegment = {
      ...host,
      endTime: time,
      duration: durLeft,
      sourceStartTime: sourceStartLeft,
      sourceEndTime: sourceCutPoint,
    }
    const freeze: TimelineSegment = {
      ...host,
      id: freezeId,
      startTime: time,
      endTime: time + freezeDurationSec,
      duration: freezeDurationSec,
      sourceStartTime: sourceCutPoint,
      sourceEndTime: sourceCutPoint + 0.05,
      freezeFrame: true,
      reversed: false,
      audioLeadInSec: 0,
      audioTailOutSec: 0,
    }
    const right: TimelineSegment = {
      ...host,
      id: rightId,
      startTime: time + freezeDurationSec,
      endTime: host.endTime + freezeDurationSec,
      duration: durRight,
      sourceStartTime: sourceCutPoint,
      sourceEndTime: sourceEndRight,
    }
    setTimelineSegments((prev: TimelineSegment[]) => prev.flatMap((s: TimelineSegment) => {
      if (s.id !== host.id) {
        // Push later segments by freezeDurationSec to make room for the freeze.
        if (s.startTime >= host.endTime) {
          return [{ ...s, startTime: s.startTime + freezeDurationSec, endTime: s.endTime + freezeDurationSec }]
        }
        return [s]
      }
      return [left, freeze, right]
    }))
    showToast(t('modernVideoEditor.freezeFrameInserted', { duration: freezeDurationSec.toFixed(1) }), 'success')
  }, [videoState.currentTime, timelineSegments, setTimelineSegments, showToast, t])

  // Trim the selected segment's source range to [inTime, outTime] (timeline
  // coordinates). Adjusts both the timeline range and the source range so the
  // segment-aware renderer plays only the requested slice.
  const handleTrimSelectedToRange = useCallback((inTime: number, outTime: number) => {
    if (!selectedSegmentId) {
      showToast(t('modernVideoEditor.selectClipToTrim'), 'info')
      return
    }
    if (!(outTime > inTime)) {
      showToast(t('modernVideoEditor.outPointAfterInPoint'), 'error')
      return
    }
    const seg = timelineSegments.find((s: TimelineSegment) => s.id === selectedSegmentId)
    if (!seg) return
    const segIn = Math.max(seg.startTime, inTime)
    const segOut = Math.min(seg.endTime, outTime)
    if (!(segOut - segIn >= 0.1)) {
      showToast(t('modernVideoEditor.trimRangeMustOverlap'), 'error')
      return
    }
    const sourceStart = seg.sourceStartTime ?? seg.startTime
    const offsetIntoSeg = segIn - seg.startTime
    const newDuration = segOut - segIn
    const newSourceStart = sourceStart + offsetIntoSeg
    const newSourceEnd = newSourceStart + newDuration

    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) =>
      s.id !== selectedSegmentId ? s
        : {
            ...s,
            startTime: segIn,
            endTime: segOut,
            duration: newDuration,
            sourceStartTime: newSourceStart,
            sourceEndTime: newSourceEnd,
          }
    ))
    showToast(t('modernVideoEditor.trimmedClipTo', { duration: newDuration.toFixed(2) }), 'success')
  }, [selectedSegmentId, timelineSegments, setTimelineSegments, showToast, t])

  // J-Cut on the selected segment: audio leads video by N seconds. Toggles
  // between off and 0.5s for v1 — the renderer uses adelay to slide the
  // segment's audio earlier on the final timeline.
  const handleJCutSelected = useCallback((leadSec: number = 0.5) => {
    if (!selectedSegmentId) {
      showToast(t('modernVideoEditor.selectClipForJCut'), 'info')
      return
    }
    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) => {
      if (s.id !== selectedSegmentId) return s
      const next = s.audioLeadInSec && s.audioLeadInSec > 0 ? 0 : leadSec
      return { ...s, audioLeadInSec: next }
    }))
    showToast(t('modernVideoEditor.jCutToggled'), 'success')
  }, [selectedSegmentId, setTimelineSegments, showToast, t])

  // L-Cut on the selected segment: audio tail extends past the visual cut
  // by N seconds (audioTailOutSec). Renderer uses an extended atrim range.
  const handleLCutSelected = useCallback((tailSec: number = 0.5) => {
    if (!selectedSegmentId) {
      showToast(t('modernVideoEditor.selectClipForLCut'), 'info')
      return
    }
    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) => {
      if (s.id !== selectedSegmentId) return s
      const next = s.audioTailOutSec && s.audioTailOutSec > 0 ? 0 : tailSec
      return { ...s, audioTailOutSec: next }
    }))
    showToast(t('modernVideoEditor.lCutToggled'), 'success')
  }, [selectedSegmentId, setTimelineSegments, showToast, t])

  // ── Pro keyboard shortcuts (J/K/L, [, ], S, X, arrows, Cmd+/-/0) ──
  // Wires the keyboard hook to the editor's existing actions. JKL transport
  // scaffolding is included but only seeks (no playbackRate change yet — the
  // <video> element lives inside RealTimeVideoPreview and isn't directly
  // reachable here without a ref-passing refactor).
  const handleRippleDeleteSelected = useCallback(() => {
    if (selectedSegmentIds.length === 0) return
    setTimelineSegments((prev: TimelineSegment[]) => rippleDeleteOp(prev, selectedSegmentIds))
    setSelectedSegmentIds([])
    showToast(t('modernVideoEditor.rippleDeleted', { count: selectedSegmentIds.length }), 'success')
  }, [selectedSegmentIds, setTimelineSegments, showToast, t])

  useEditorShortcuts({
    getCurrentTime: () => videoState.currentTime,
    getDuration:    () => videoState.duration,
    seek:           (time) => setVideoState(prev => ({ ...prev, currentTime: time })),
    togglePlay:     () => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying })),
    setPlaybackRate: () => { /* preview owns the <video> ref — no-op for now */ },
    splitAtPlayhead: handleSplitAtPlayhead,
    rippleDeleteSelected: handleRippleDeleteSelected,
  })

  // ── Consolidated UI Preference State ──
  const [layoutPrefs, setLayoutPrefs] = useState<EditorLayoutPreferences>(loadLayoutPreferences)
  const [previewQuality, setPreviewQuality] = useState<'draft' | 'full'>('full')
  const [reduceMotion, setReduceMotion] = useState(false)
  const [tipDismissed, setTipDismissed] = useState(false)
  const [timelineHintDismissed, setTimelineHintDismissed] = useState(false)
  const [snapToKeyframes, setSnapToKeyframes] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(SNAP_TO_KEYFRAMES_KEY) === '1' } catch { return false }
  })
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle | null>({
    enabled: true, size: 'medium', font: 'Inter, sans-serif', layout: 'bottom-center', textStyle: 'default'
  })
  const [templateLayout, setTemplateLayout] = useState<TemplateLayout>('standard')
  const [useProfessionalTimeline, setUseProfessionalTimeline] = useState(true)
  const [visitedWorkflowSteps, setVisitedWorkflowSteps] = useState<Set<EditorCategory>>(new Set())

  // ── Refs ──
  const contentPanelScrollRef = useRef<HTMLDivElement>(null)
  const timeUpdatePendingRef = useRef<number | null>(null)
  const timeUpdateLastApplyRef = useRef(0)
  const timeUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasIntegratedInitialVideoRef = useRef(false)

  // ── Computed Values (useMemo) ──
  const editorState: any = useMemo(() => ({
    videoFilters, textOverlays, timelineSegments, timelineMarkers, timelineEffects, colorGradeSettings, captionStyle, templateLayout,
    filterStrength, projectName, videoId: videoId || 'temp-id'
  }), [videoFilters, textOverlays, timelineSegments, timelineMarkers, timelineEffects, colorGradeSettings, captionStyle, templateLayout, filterStrength, projectName, videoId])

  const effectiveFilters = useMemo(() => videoFilters, [videoFilters])

  const { autosaveStatus, loadSavedState, getStatusIcon, retrySave, manualSave } = useVideoEditorAutosave({
    state: editorState,
    videoId: videoId || 'temp-id',
    name: projectName,
    enabled: true,
    debounceMs: 2500
  })

  // ── Initialization Logic ──
  useEffect(() => {
    // 1. Try to load saved state from server (initialState) or localStorage/backups
    const savedState = loadSavedState()
    const stateToLoad = initialState || savedState

    if (stateToLoad) {
      if (stateToLoad.videoFilters) setVideoFilters(stateToLoad.videoFilters)
      if (stateToLoad.textOverlays) setTextOverlays(stateToLoad.textOverlays)
      if (stateToLoad.timelineSegments) {
        const normalizedSegments = stateToLoad.timelineSegments.map((s: any) => ({
          ...s,
          sourceUrl: s.sourceUrl ? getAssetUrl(s.sourceUrl) : s.sourceUrl
        }))
        setTimelineSegments(normalizedSegments)
      }
      if (stateToLoad.timelineMarkers) setTimelineMarkers(stateToLoad.timelineMarkers)
      if (stateToLoad.timelineEffects) setTimelineEffects(stateToLoad.timelineEffects)
      if (stateToLoad.colorGradeSettings) setColorGradeSettings(stateToLoad.colorGradeSettings)
      if (stateToLoad.captionStyle) setCaptionStyle(stateToLoad.captionStyle)
      if (stateToLoad.templateLayout) setTemplateLayout(stateToLoad.templateLayout)
      if (stateToLoad.projectName) setProjectName(stateToLoad.projectName)
      showToast(t('modernVideoEditor.neuralStateRestored'), 'success')
      return
    }

    // 2. If no saved state, initialize with actualVideoUrl if provided
    if (actualVideoUrl && !hasIntegratedInitialVideoRef.current) {
      // Check to prevent double insertion if it's already in the timeline
      if (!timelineSegments.some(s => s.id === 'initial-video-segment' || s.sourceUrl === actualVideoUrl)) {
        const initialSegment: TimelineSegment = {
          id: 'initial-video-segment',
          startTime: 0,
          endTime: videoState.duration > 0 ? videoState.duration : 60, // Fallback to 60s
          duration: videoState.duration > 0 ? videoState.duration : 60,
          type: 'video',
          name: t('modernVideoEditor.masterVideoSource'),
          color: '#6366F1',
          track: 0,
          sourceUrl: actualVideoUrl
        }
        setTimelineSegments((prev: TimelineSegment[]) => {
           // Double check inside the updater to be absolutely sure
           if (prev.some(s => s.id === 'initial-video-segment')) return prev;
           return [...prev, initialSegment];
        })
      }
      hasIntegratedInitialVideoRef.current = true
      showToast(t('modernVideoEditor.videoIntegratedToTimeline'), 'success')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualVideoUrl, loadSavedState, showToast, videoState.duration, setTimelineSegments]) // Runs on mount or when URL changes

  // ── Effects ──
  useEffect(() => {
    if (WORKFLOW_STEPS.some((s) => s.id === activeCategory)) {
      setVisitedWorkflowSteps((prev) => new Set(prev).add(activeCategory))
    }
  }, [activeCategory])

  useEffect(() => {
    if (transcript) {
      const score = calculateEngagementScore(transcript.fullText, contentNiche, videoState.duration || 60)
      setEngagementScore(score)
      const metadata = generateSmartMetadata(transcript.fullText, transcript.scenes || [])
      setGeneratedMetadata(metadata)
    }
  }, [transcript, contentNiche, videoState.duration])

  useEffect(() => {
    if (videoState.duration > 0) {
      setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) => {
        if (s.id === 'initial-video-segment' && (s.endTime === 60 || s.duration === 60)) {
           return { ...s, endTime: videoState.duration, duration: videoState.duration }
        }
        return s
      }))
    }
  }, [videoState.duration, setTimelineSegments])


  // Active, Loop-Safe Undo/Redo Engine
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) {
      showToast(t('modernVideoEditor.nothingToUndo'), 'info')
      return
    }
    const prevIndex = historyIndex - 1
    const prevState = history[prevIndex]
    if (!prevState) return

    isHistoryActionRef.current = true
    setHistoryIndex(prevIndex)
    if (prevState.timelineSegments) setTimelineSegments(prevState.timelineSegments)
    if (prevState.textOverlays) setTextOverlays(prevState.textOverlays)
    if (prevState.shapeOverlays) setShapeOverlays(prevState.shapeOverlays)
    if (prevState.imageOverlays) setImageOverlays(prevState.imageOverlays)
    if (prevState.videoFilters) setVideoFilters(prevState.videoFilters)
    
    showToast(t('modernVideoEditor.undoSuccessful'), 'success')
    setTimeout(() => {
      isHistoryActionRef.current = false
    }, 80)
  }, [history, historyIndex, setTimelineSegments, setTextOverlays, setShapeOverlays, setImageOverlays, setVideoFilters, showToast, t])

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      showToast(t('modernVideoEditor.nothingToRedo'), 'info')
      return
    }
    const nextIndex = historyIndex + 1
    const nextState = history[nextIndex]
    if (!nextState) return

    isHistoryActionRef.current = true
    setHistoryIndex(nextIndex)
    if (nextState.timelineSegments) setTimelineSegments(nextState.timelineSegments)
    if (nextState.textOverlays) setTextOverlays(nextState.textOverlays)
    if (nextState.shapeOverlays) setShapeOverlays(nextState.shapeOverlays)
    if (nextState.imageOverlays) setImageOverlays(nextState.imageOverlays)
    if (nextState.videoFilters) setVideoFilters(nextState.videoFilters)

    showToast(t('modernVideoEditor.redoSuccessful'), 'success')
    setTimeout(() => {
      isHistoryActionRef.current = false
    }, 80)
  }, [history, historyIndex, setTimelineSegments, setTextOverlays, setShapeOverlays, setImageOverlays, setVideoFilters, showToast, t])

  // ── Callbacks ──
  const handleManualOverride = useCallback((instruction: string) => {
    if (!instruction.trim()) return

    showToast(t('modernVideoEditor.neuralOverrideActive', { instruction }), 'info')

    const textLower = instruction.toLowerCase()
    
    setTimeout(() => {
      // 1. Text Overlay insertion: e.g. Add title "Hello World"
      const titleMatch = instruction.match(/(?:add title|create text|write|insert caption)\s+["']?([^"']+)["']?/i)
      if (titleMatch && titleMatch[1]) {
        const textToInsert = titleMatch[1].toUpperCase()
        const playhead = videoState.currentTime
        const newOverlay: TextOverlay = {
          id: `manual-overlay-${Date.now()}`,
          text: textToInsert,
          x: 50,
          y: 45,
          fontSize: 36,
          color: '#ffffff',
          fontFamily: 'Montserrat, sans-serif',
          startTime: playhead,
          endTime: Math.min(videoState.duration || 10, playhead + 3),
          style: 'bold-kinetic',
          shadowColor: 'rgba(0,0,0,0.8)',
          animationIn: 'pop',
          animationOut: 'fade',
          animationInDuration: 0.2,
          animationOutDuration: 0.25,
          layer: 20
        }
        setTextOverlays(prev => [...prev, newOverlay])
        showToast(t('modernVideoEditor.aiPlacedTextGraphic', { text: textToInsert, time: playhead.toFixed(1) }), 'success')
        return
      }

      // 2. Simplify/pacing instruction
      if (textLower.includes('simplify') || textLower.includes('readability')) {
        setTextOverlays(prev => prev.map(o => ({
          ...o,
          text: o.text.length > 25 ? o.text.slice(0, 20) + '...' : o.text,
          fontSize: Math.min(o.fontSize + 4, 48),
          style: 'minimal'
        })))
        showToast(t('modernVideoEditor.aiReadability'), 'success')
        return
      }

      // 3. Hook optimization
      if (textLower.includes('hook') || textLower.includes('kinetic')) {
        setTimelineSegments((prev: TimelineSegment[]) => prev.map((s, idx) => 
          idx === 0 ? { ...s, transitionOut: 'zoom', transitionDuration: 0.5, name: t('modernVideoEditor.kineticHookName') } : s
        ))
        const hookOverlay: TextOverlay = {
          id: `hook-overlay-${Date.now()}`,
          text: t('modernVideoEditor.waitForItText'),
          x: 50,
          y: 35,
          fontSize: 38,
          color: '#f59e0b',
          fontFamily: 'Impact, sans-serif',
          startTime: 0.2,
          endTime: 2.2,
          style: 'bold-kinetic',
          animationIn: 'bounce',
          animationOut: 'zoom-out',
          animationInDuration: 0.3,
          layer: 25
        }
        setTextOverlays(prev => {
          const filtered = prev.filter(o => !o.id.startsWith('hook-overlay'))
          return [...filtered, hookOverlay]
        })
        showToast(t('modernVideoEditor.aiHook'), 'success')
        return
      }

      // 4. Pacing squeeze / silence removal
      if (textLower.includes('squeeze') || textLower.includes('pacing') || textLower.includes('tighten') || textLower.includes('silence')) {
        setTimelineSegments((prev: TimelineSegment[]) => {
          let runningTime = 0
          return prev.map(s => {
            const newDur = Math.max(0.5, s.duration * 0.9)
            const updated = {
              ...s,
              startTime: runningTime,
              endTime: runningTime + newDur,
              duration: newDur
            }
            runningTime += newDur
            return updated
          })
        })
        showToast(t('modernVideoEditor.aiPacing'), 'success')
        return
      }

      // 5. Trend / music / rhythm sync
      if (textLower.includes('trend') || textLower.includes('rhythm') || textLower.includes('sync')) {
        setTimelineSegments((prev: TimelineSegment[]) => prev.map(s => 
          s.type === 'video' ? { ...s, transitionOut: 'crossfade', transitionDuration: 0.3 } : s
        ))
        setVideoFilters(prev => ({
          ...prev,
          contrast: 110,
          saturation: 115,
          vibrance: 120,
          clarity: 10
        }))
        showToast(t('modernVideoEditor.aiTrends'), 'success')
        return
      }

      showToast(t('modernVideoEditor.neuralOverrideApplied'), 'success')
    }, 800)
  }, [showToast, videoState.currentTime, videoState.duration, setTimelineSegments, setTextOverlays, setVideoFilters, t])

  const handleScheduleUpload = useCallback(() => {
    showToast(t('modernVideoEditor.directingToScheduler'), 'success')
    setActiveCategory('scheduling')
  }, [showToast, setActiveCategory, t])

  const handleExportMode = () => {
    setActiveCategory('export')
    setVideoState(prev => ({ ...prev, isPlaying: false })) // Pause preview during export setup
  }

  // ── Shadow Telemetry Engine ──
  const captureShadowTelemetry = useCallback(() => {
    if (!aiProposalSnapshot) return

    const finalSegments = timelineSegments
    const originalSegments = aiProposalSnapshot.segments

    // Calculate Agentic Acceptance Rate (AAR)
    // Percentage of segments that remained exactly as proposed
    const totalProposed = originalSegments.length
    if (totalProposed === 0) return

    const acceptedCount = originalSegments.filter((orig: any) => 
      finalSegments.some((final) => 
        final.id === orig.id && 
        final.startTime === orig.startTime && 
        final.duration === orig.duration
      )
    ).length

    const aar = Math.round((acceptedCount / totalProposed) * 100)
    
    // Calculate Manual Override Delta (MOD)
    // Average displacement or trim change to AI segments
    const modifiedSegments = finalSegments.filter(f => 
      originalSegments.some((o: any) => o.id === f.id && (o.startTime !== f.startTime || o.duration !== f.duration))
    )
    const mod = modifiedSegments.length > 0 ? (modifiedSegments.length / finalSegments.length) * 100 : 0

    const telemetryEntry = {
      sessionId: `session-${Date.now()}`,
      timestamp: Date.now(),
      aiProposedState: aiProposalSnapshot,
      userExportState: { segments: finalSegments, overlays: [...textOverlays, ...shapeOverlays] },
      kpis: {
        agenticAcceptanceRate: aar,
        manualOverrideDelta: Math.round(mod * 10) / 10,
        reversionRate: Math.max(0, 100 - (finalSegments.length / totalProposed) * 100),
        sessionUtilityScore: Math.round((aar + (100 - mod)) / 2)
      },
      styleDeltas: styleDNA
    }

    setTelemetryHistory(prev => [telemetryEntry, ...prev].slice(0, 10))
    showToast(t('modernVideoEditor.shadowTelemetrySynchronized'), 'success')
  }, [aiProposalSnapshot, timelineSegments, textOverlays, shapeOverlays, styleDNA, showToast, t])

  // Mock taking a snapshot when AI touches the timeline (simulated by non-empty segments)
  useEffect(() => {
    if (!aiProposalSnapshot && timelineSegments.length > 0) {
      setAiProposalSnapshot({
        timestamp: Date.now(),
        segments: JSON.parse(JSON.stringify(timelineSegments))
      })
    }
  }, [timelineSegments, aiProposalSnapshot])

  // ── Style Normalization Engine ──
  const handleStyleNormalize = useCallback(() => {
    if (!styleDNA) return
    
    showToast(t('modernVideoEditor.aligningToDna', { theme: styleDNA.theme || 'Vlog' }), 'info')

    // 1. Normalize Pacing (if CPM is high, suggest/apply split points)
    if (styleDNA.cpm > 10 && timelineSegments.length < 5) {
       showToast(t('modernVideoEditor.pacingOptimization'), 'success')
    }

    // 2. Normalize Typography & Brand Colors
    if (styleDNA.preferredFonts.length > 0 || styleDNA.preferredTransitions.length > 0) {
      const brandFont = styleDNA.preferredFonts[0] || 'Inter, sans-serif'
      setTextOverlays(prev => prev.map(o => ({ ...o, fontFamily: brandFont })))
      showToast(t('modernVideoEditor.stylisticDriftCorrected'), 'success')
    }

    captureShadowTelemetry()
  }, [styleDNA, timelineSegments.length, setTextOverlays, captureShadowTelemetry, showToast, t])

  // Real-time collaborators come from the socket presence system (future feature).
  const mockCollaborators: Array<{ id: string; name: string; role: string; avatar: string; color: string; status: string }> = []

  // --- Handlers ---
  const handleApplyStyleProfile = useCallback((profile: StyleProfile) => {
    // 1. Apply Typography/Captions style from DNA globally
    setCaptionStyle(prev => prev ? {
      ...prev,
      font: profile.assets.fontFamily,
      textStyle: (profile.assets.fontFamily || '').toLowerCase().includes('impact') ? 'bold' : 'default'
    } : {
      enabled: true,
      size: 'medium',
      font: profile.assets.fontFamily,
      layout: 'bottom-center',
      textStyle: 'default'
    })

    // 2. Overwrite all existing text overlays with Brand Font & Brand Colors
    setTextOverlays(prev => prev.map(overlay => ({
      ...overlay,
      fontFamily: profile.assets.fontFamily || overlay.fontFamily,
      color: profile.assets.fontHex || overlay.color,
      shadowColor: profile.assets.dropShadowHex || overlay.shadowColor
    })))

    // 3. Apply Video Filters (Synthetic mapping from DNA visuals)
    setVideoFilters(prev => ({
      ...prev,
      vibrance: 100 + (profile.visuals.punchInAmount || 0),
      contrast: 100 + (profile.visuals.punchInFrequency || 0),
      sharpen: profile.visuals.punchInAmount > 15 ? 20 : 0
    }))

    // 4. Inject preset Brand Watermark/Logo if available (Mocked)
    if (profile.name.includes('Trending') || profile.assets.fontHex) {
       setImageOverlays(prev => {
         const watermarkId = `dna-watermark-${profile.id}`
         if (prev.some(img => img.id.includes('dna-watermark'))) return prev
         return [
           ...prev,
           {
             id: watermarkId,
             url: brandKit.logoUrl || '/icons/icon-192x192.png',
             x: 85, y: 10, width: 10, height: 10,
             opacity: 0.8,
             startTime: 0,
             endTime: videoState.duration || 60,
             layer: 100
           }
         ]
       })
    }

    // 3. Neural Pacing: Adjust Timeline Dynamics based on DNA Sentiment
    // If the profile visual intensity is high, we shorten the median clip length for "Neural Pacing"
    const basePacing = profile.pacing?.medianClipLength || 3.0
    const intensityModifier = (profile.visuals?.punchInAmount || 0) / 100
    const neuralPacing = Math.max(0.8, basePacing - (intensityModifier * 1.5))

    if ((window as any).setMedianClipLength) {
      (window as any).setMedianClipLength(neuralPacing)
    }

    showToast(t('modernVideoEditor.appliedProfilePacing', { name: profile.name, pacing: neuralPacing.toFixed(1) }), 'success')
    // brandKit.logoUrl is read inside the watermark branch — listed in
    // the dep array so the callback regenerates if the user updates
    // their brand kit logo without leaving the editor.
  }, [showToast, setCaptionStyle, setVideoFilters, setTextOverlays, videoState.duration, setImageOverlays, brandKit.logoUrl, t])

  /**
   * One-shot "Apply my learned style" — fed by QuickActionsBar after it
   * fetches /api/video/clips/style-insight. Maps the user's top picks
   * (recorded by learnFromPublishedClip after each Publish & Learn) onto
   * the editor's videoFilters + caption style. Best-effort — any field we
   * don't recognize is skipped silently.
   *
   * Color-grade mapping mirrors server/services/aiVideoEditingService.js
   * so the editor preview lines up with what the auto-edit pipeline
   * would actually render at export time.
   */
  const handleApplyMyStyle = useCallback((insight: { topPicks?: Record<string, string | null | undefined> }) => {
    const top = insight?.topPicks || {}
    const grade = (top.colorGrade || '').toLowerCase()
    const COLOR_GRADES: Record<string, Partial<VideoFilter>> = {
      vivid:     { contrast: 115, brightness: 102, saturation: 125 },
      cinematic: { contrast: 120, brightness: 95, saturation: 90, temperature: 95 },
      natural:   { contrast: 105, brightness: 100, saturation: 100 },
      cool:      { contrast: 110, brightness: 100, saturation: 105, temperature: 80 },
      warm:      { contrast: 110, brightness: 102, saturation: 110, temperature: 120 },
      vintage:   { contrast: 95, brightness: 100, saturation: 75, sepia: 20 },
      bw:        { contrast: 115, brightness: 100, saturation: 0 },
    }
    const applied: string[] = []
    if (grade && COLOR_GRADES[grade]) {
      setVideoFilters((prev) => ({ ...prev, ...COLOR_GRADES[grade] }))
      applied.push(t('modernVideoEditor.gradeLabel', { grade }))
    }
    const cs = (top.captionStyle || '').toString()
    if (cs) {
      setCaptionStyle((prev) => prev ? { ...prev, style: cs as any } : { enabled: true, style: cs as any, font: 'Inter', size: 32, color: '#FFFFFF', position: 'bottom-center' } as any)
      applied.push(t('modernVideoEditor.captionsLabel', { style: cs }))
    }
    showToast(
      applied.length > 0
        ? t('modernVideoEditor.appliedYourStyle', { items: applied.join(' · ') })
        : t('modernVideoEditor.styleNotSpecificEnough'),
      applied.length > 0 ? 'success' : 'info'
    )
  }, [setVideoFilters, setCaptionStyle, showToast, t])



  const handleGenerateClips = useCallback(async () => {
    if (!transcript) {
      showToast(t('modernVideoEditor.neuralTranscriptRequired'), 'error')
      return
    }
    if (!videoId) {
      showToast(t('modernVideoEditor.noVideoLoadedUploadFirst'), 'error')
      return
    }
    showToast(t('modernVideoEditor.synthesizingVariations'), 'info')
    try {
      const res: any = await apiPost('/video/ai-editing/auto-edit', {
        videoId: videoId,
        editingOptions: {
          transcript,
          generateClips: true,
          clipCount: 3,
        }
      })
      const serverClips: AutoEditClip[] = (res?.data?.clips || res?.clips || []).map((c: any, i: number) => ({
        id: c.id || `clip-${Date.now()}-${i}`,
        name: c.name || t('modernVideoEditor.variationName', { number: i + 1 }),
        segments: c.segments || [],
        engagementScore: c.engagementScore || { overall: c.viralScore || 80, viralPotential: 80, hookStrength: 80, sentimentDensity: 80, trendAlignment: 80, retentionHeatmap: [] },
        metadata: c.metadata || { titles: { curiosityGap: c.caption || '', seoWinner: '', minimalist: '' }, description: { summary: '', timestamps: [], hashtags: c.hashtags || [] }, abTestSuggestions: [] },
      }))
      if (serverClips.length > 0) {
        setAutoEditClips(serverClips)
        showToast(
          serverClips.length === 1
            ? t('modernVideoEditor.variationReadyOne', { count: serverClips.length })
            : t('modernVideoEditor.variationReadyOther', { count: serverClips.length }),
          'success'
        )
      } else {
        showToast(t('modernVideoEditor.noClipsGenerated'), 'info')
      }
    } catch {
      showToast(t('modernVideoEditor.clipGenerationFailed'), 'error')
    }
  }, [transcript, videoId, showToast, t])

  const handleForgeMaster = useCallback(async (persona: string) => {
    showToast(t('modernVideoEditor.neuralForgeInitiated', { persona: persona.toUpperCase() }), 'info')

    // Step 1: Sequential Extraction (Simulation)
    await new Promise(r => setTimeout(r, 1500))
    showToast(t('modernVideoEditor.forgeViralExtraction'), 'info')

    // Step 2: Apply Style Profile from DNA Vault
    if (styleProfiles.length > 0) {
      const bestMatch = styleProfiles.find(p => (p.name || '').toLowerCase().includes(persona)) || styleProfiles[0]
      handleApplyStyleProfile(bestMatch)
    }

    // Step 3: Trigger Clip Generation & B-Roll Sync
    handleGenerateClips()

    await new Promise(r => setTimeout(r, 2000))
    showToast(t('modernVideoEditor.agenticForgeComplete'), 'success')
  }, [showToast, styleProfiles, handleApplyStyleProfile, handleGenerateClips, t])

  const handleApplyClip = useCallback((clip: AutoEditClip) => {
    showToast(t('modernVideoEditor.applyingNeuralPattern', { name: clip.name }), 'success')

    // Update timeline segments if the clip has them
    if (clip.segments && clip.segments.length > 0) {
      setTimelineSegments(clip.segments)
    }

    // Update metadata and engagement score
    setGeneratedMetadata(clip.metadata)
    setEngagementScore(clip.engagementScore)

    // Automatically switch to timeline view to see changes
    setActiveCategory('timeline')
  }, [showToast, setTimelineSegments, setGeneratedMetadata, setEngagementScore, setActiveCategory, t])

  const processNeuralCommand = useCallback((instruction: string) => {
    if (!instruction.trim()) return

    showToast(t('modernVideoEditor.neuralCommandReceived'), 'info')
    const lower = String(instruction || '').toLowerCase()

    setTimeout(() => {
      if (lower.includes('title') || lower.includes('metadata')) {
        setGeneratedMetadata(prev => prev ? ({
          ...prev,
          titles: {
            ...prev.titles,
            seoWinner: t('modernVideoEditor.aiOptimizedPrefix', { title: prev.titles.seoWinner })
          }
        }) : null)
        showToast(t('modernVideoEditor.metadataRecalibrated'), 'success')
      } else if (lower.includes('split') || lower.includes('cut')) {
        showToast(t('modernVideoEditor.analyzingCutPoints'), 'info')
        // Mock split action
      } else if (lower.includes('caption') || lower.includes('overlay')) {
        setTextOverlays(prev => [
          ...prev,
          {
            id: `ai-overlay-${Date.now()}`,
            text: t('modernVideoEditor.neuralInsightText'),
            x: 50, y: 50, fontSize: 40, color: '#ffffff',
            fontFamily: 'Inter, sans-serif',
            startTime: videoState.currentTime,
            endTime: videoState.currentTime + 3,
            style: 'shadow'
          }
        ])
        showToast(t('modernVideoEditor.dynamicOverlayIntegrated'), 'success')
      } else {
        showToast(t('modernVideoEditor.neuralLogicSynthesized'), 'success')
      }
    }, 1000)
  }, [showToast, videoState.currentTime, t])

  const handleBeatSync = useCallback(() => {
    if (timelineSegments.length === 0) {
      showToast(t('modernVideoEditor.noSegmentsToSync'), 'error')
      return
    }

    showToast(t('modernVideoEditor.beatSyncAnalyzing'), 'info')

    // Simulation of Transients/Beats (every 2.1s)
    const beats = [0.1, 2.2, 4.3, 6.4, 8.5, 10.6, 12.7, 14.8, 16.9]

    setTimelineSegments((prev: TimelineSegment[]) => {
      let currentTime = 0
      return prev
        .map((seg: TimelineSegment, i: number) => {
        const beatTime = beats[i % beats.length]
        const duration = seg.duration
        const newSeg = {
          ...seg,
          startTime: beatTime,
          endTime: beatTime + duration
        }
        return newSeg
      })
    })

    showToast(t('modernVideoEditor.beatSyncAligned'), 'success')
  }, [timelineSegments, showToast, setTimelineSegments, t])

  const handleUpdateOverlay = useCallback((type: string, id: string, updates: any) => {
    if (type === 'text') {
      setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'image') {
      setImageOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'shape') {
      setShapeOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'svg') {
      setSvgOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'gradient') {
      setGradientOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    }
  }, [])

  const handleSegmentSelect = useCallback((id: string | null, addToSelection?: boolean) => {
    const isTextOverlay = textOverlays.some(o => o.id === id)
    if (isTextOverlay) {
      setSelectedOverlayId(id)
      setSelectedSegmentIds([])
    } else {
      setSelectedOverlayId(null)
      if (addToSelection && id) {
        setSelectedSegmentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
      } else {
        setSelectedSegmentIds(id ? [id] : [])
      }
    }
  }, [textOverlays])

  const handleTimeUpdate = useCallback((time: number) => {
    const snapped = snapToKeyframes
      ? getSnappedTime(time, selectedSegmentId, selectedEffectId, timelineSegments, timelineEffects)
      : time
    timeUpdatePendingRef.current = snapped
    const now = Date.now()
    const elapsed = now - timeUpdateLastApplyRef.current
    const throttleMs = 33
    if (elapsed >= throttleMs || timeUpdateLastApplyRef.current === 0) {
      timeUpdateLastApplyRef.current = now
      setVideoState((prev) => ({ ...prev, currentTime: timeUpdatePendingRef.current ?? prev.currentTime }))
      timeUpdatePendingRef.current = null
    }
  }, [snapToKeyframes, selectedSegmentId, selectedEffectId, timelineSegments, timelineEffects])

  const updateLayout = useCallback((patch: Partial<EditorLayoutPreferences>) => {
    setLayoutPrefs((p) => ({ ...p, ...patch }))
  }, [])

  const SIDEBAR_COLLAPSED_W = 64
  const SIDEBAR_EXPANDED_W = 280

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 340
    try { return parseInt(localStorage.getItem('click-editor-left-panel-w') || '340') || 340 } catch { return 340 }
  })
  const [zenMode, setZenMode] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 320
    try { return parseInt(localStorage.getItem('click-editor-right-panel-w') || '320') || 320 } catch { return 320 }
  })
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  // Persist panel widths
  useEffect(() => {
    try { localStorage.setItem('click-editor-left-panel-w', String(leftPanelWidth)) } catch {}
  }, [leftPanelWidth])
  useEffect(() => {
    try { localStorage.setItem('click-editor-right-panel-w', String(rightPanelWidth)) } catch {}
  }, [rightPanelWidth])

  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => {
      const width = window.innerWidth
      setViewportWidth(width)

      // Auto-adjust panels across all breakpoints
      if (width < 768) {
        // Mobile: collapse everything
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setShowPerformanceRail(false)
        setContentPanelCollapsed(false)
        setLeftPanelWidth(Math.min(width - 32, 300))
      } else if (width < 1024) {
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setShowPerformanceRail(false)
        setLeftPanelWidth(Math.min(width * 0.5, 340))
      } else if (width < 1280) {
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setShowPerformanceRail(false)
        setLeftPanelWidth(Math.min(width * 0.38, 360))
      } else if (width < 1600) {
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setShowPerformanceRail(false)
        setLeftPanelWidth(Math.min(width * 0.32, 400))
      } else {
        setSidebarCollapsed(false)
        setPropertiesPanelOpen(false)
        setShowPerformanceRail(false)
        setLeftPanelWidth(Math.min(width * 0.28, 420))
      }
      // On compact viewports the Insights panel is an opt-in overlay drawer, so
      // start it collapsed. We never force it open on desktop — that stays under
      // the user's saved preference.
      if (width < 1024) setInsightsSidebarCollapsed(true)
    }
    handleResize() // Run on mount
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Clamp left panel width so the video preview never shrinks below 300px
  const sidebarW = sidebarCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W
  const rightPanelEffectiveW = propertiesPanelOpen ? rightPanelWidth : 0
  const maxLeftPanel = Math.max(240, viewportWidth - sidebarW - rightPanelEffectiveW - 300)
  const clampedLeftPanelWidth = Math.min(leftPanelWidth, maxLeftPanel)

  // Below this width the right-hand panels (Inspector / Insights) can't sit as
  // inline columns without crushing the video preview, so they slide in as a
  // single full-height overlay drawer instead. PropertiesPanel + PerformanceRail
  // are already gated to >=1024 / xl, so this only governs Inspector + Insights.
  const isCompactViewport = viewportWidth < 1024
  const rightDrawerOpen = isCompactViewport && (!!(selectedSegmentId || selectedOverlayId) || !insightsSidebarCollapsed)
  const closeRightDrawer = useCallback(() => {
    setSelectedSegmentIds([])
    setSelectedOverlayId(null)
    setInsightsSidebarCollapsed(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(240, Math.min(maxLeftPanel, e.clientX - sidebarW))
        setLeftPanelWidth(newWidth)
      }
      if (isResizingRight) {
        const newWidth = Math.max(260, Math.min(520, window.innerWidth - e.clientX))
        setRightPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
      setIsResizingRight(false)
      document.body.style.cursor = 'default'
    }

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingLeft, isResizingRight, sidebarW, maxLeftPanel])

  const effectivePreviewSize: Exclude<PreviewSize, 'auto'> = layoutPrefs.previewSize === 'auto'
    ? (viewportWidth < 1200 ? 'small' : viewportWidth < 1500 ? 'medium' : viewportWidth < 1800 ? 'large' : 'fill')
    : layoutPrefs.previewSize

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target?.closest?.('input, textarea, [contenteditable="true"]')
      if (inInput) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandKOpen(p => !p); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); setAssistantOpen(p => !p); return }
      if (e.key === '?') { setShowKeyboardHelp(p => !p); return }

      // Workflow Shortcuts
      if (e.altKey) {
        switch (e.key) {
          case '1': e.preventDefault(); setActiveCategory('edit'); break
          case '2': e.preventDefault(); setActiveCategory('color'); break
          case '3': e.preventDefault(); setActiveCategory('effects'); break
          case '4': e.preventDefault(); setActiveCategory('timeline'); break
          case '5': e.preventDefault(); setActiveCategory('export'); break
        }
      }

      // Single-Key Layout Toggles
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        switch (String(e.key || '').toLowerCase()) {
          case 'f':
            e.preventDefault()
            updateLayout({ focusMode: layoutPrefs.focusMode === 'preview' ? 'balanced' : 'preview' })
            break
          case 't':
            e.preventDefault()
            updateLayout({ focusMode: layoutPrefs.focusMode === 'timeline' ? 'balanced' : 'timeline' })
            break
          case 'b':
            e.preventDefault()
            updateLayout({ focusMode: 'balanced' })
            break
          case 'z':
            e.preventDefault()
            setZenMode(p => !p)
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveCategory, layoutPrefs.focusMode, updateLayout])

  const handleAssetDrop = useCallback((asset: any, trackIndex: number, time: number) => {
    const isAudio = asset.type === 'music' || asset.type === 'sfx'
    const duration = isAudio ? asset.duration ?? (asset.type === 'sfx' ? 2 : 30) : (asset.type === 'broll' ? 10 : 5)
    const segment: TimelineSegment = {
      id: `seg-${asset.id}-${Date.now()}`,
      startTime: time,
      endTime: time + duration,
      duration,
      type: isAudio ? 'audio' : asset.type === 'broll' ? 'video' : 'image',
      name: asset.title || asset.name || t('modernVideoEditor.assetFallbackName'),
      color: asset.type === 'music' ? '#10B981' : asset.type === 'sfx' ? '#F97316' : '#F59E0B',
      track: trackIndex,
      sourceUrl: asset.url,
    }
    setTimelineSegments((prev: TimelineSegment[]) => [...prev, segment] as any)
    showToast(t('modernVideoEditor.assetDroppedToTimeline'), 'success')
  }, [setTimelineSegments, showToast, t])

  const getCategoryContent = () => {
    switch (activeCategory) {
      case 'ai': return <CreativeAIView videoId={videoId || ''} showToast={showToast} setShapeOverlays={setShapeOverlays} setVideoFilters={setVideoFilters} transcript={transcript} onUpdateBroll={(brolls) => {
        // Logic to dispatch overlays from Creative AI mapping.
        // For B-Roll, we map the incoming items to our state type.
        // We'll map them as timeline segments for direct editing capabilities!
        const brollSegments = brolls.map(b => ({
          id: b.id || `broll-${Date.now()}-${Math.random()}`,
          startTime: b.startTime,
          endTime: b.endTime,
          duration: b.endTime - b.startTime,
          type: 'video' as const,
          name: t('modernVideoEditor.magicBroll'),
          color: '#8b5cf6',
          track: 2,
          sourceUrl: b.url
        }))
        setTimelineSegments((prev: TimelineSegment[]) => [...prev, ...brollSegments])
      }} />
      case 'ai-edit': return <EliteAIView
        videoId={videoId || ''}
        isTranscribing={isTranscribing}
        setIsTranscribing={setIsTranscribing}
        transcript={transcript}
        setTranscript={setTranscript}
        editingWords={editingWords}
        setEditingWords={setEditingWords}
        aiSuggestions={aiSuggestions}
        setTimelineSegments={setTimelineSegments}
        showToast={showToast}
        setActiveCategory={setActiveCategory}
        setTextOverlays={setTextOverlays}
        autoEditClips={autoEditClips}
        onGenerateClips={handleGenerateClips}
        onApplyClip={handleApplyClip}
        engagementScore={engagementScore}
        userAssets={userAssets}
        onForgeMaster={handleForgeMaster}
        onApplyStyleProfile={handleApplyStyleProfile}
        onBeatSync={handleBeatSync}
      />
      case 'edit': return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} textOverlays={textOverlays} setTextOverlays={setTextOverlays} shapeOverlays={shapeOverlays} setShapeOverlays={setShapeOverlays} imageOverlays={imageOverlays} setImageOverlays={setImageOverlays} svgOverlays={svgOverlays} setSvgOverlays={setSvgOverlays} gradientOverlays={gradientOverlays} setGradientOverlays={setGradientOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} videoState={videoState} filterStrength={filterStrength} setFilterStrength={setFilterStrength} showBeforeAfter={showBeforeAfter} setShowBeforeAfter={setShowBeforeAfter} compareMode={compareMode} setCompareMode={setCompareMode} videoId={videoId ?? undefined} segmentCount={timelineSegments.length} transcript={transcript} onSplitAtPlayhead={handleSplitAtPlayhead} onReverseSelected={handleReverseSelected} onFreezeAtPlayhead={handleFreezeAtPlayhead} onTrimSelectedToRange={handleTrimSelectedToRange} onJCutSelected={handleJCutSelected} onLCutSelected={handleLCutSelected} hasSegmentSelection={!!selectedSegmentId} />
      case 'short-clips': return <ShortClipsView videoState={videoState} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} setActiveCategory={setActiveCategory} showToast={showToast} transcript={transcript} />
      case 'growth': return <GrowthInsightsView isOledTheme={true} />
      case 'predict': return <PredictionEngineView videoId={videoId || ''} timelineSegments={timelineSegments} transcript={transcript} showToast={showToast} />
      case 'automate': return <AutomateView
        voiceoverText={voiceoverText}
        setVoiceoverText={setVoiceoverText}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        isGeneratingVoiceover={isGeneratingVoiceover}
        setIsGeneratingVoiceover={setIsGeneratingVoiceover}
        videoId={videoId || ''}
        videoUrl={actualVideoUrl || ''}
        showToast={showToast}
        onAddVoiceoverSegment={handleAddVoiceoverSegment}
        setTextOverlays={setTextOverlays}
        transcript={transcript}
      />
      case 'color': return <ColorGradingView videoFilters={videoFilters} setVideoFilters={setVideoFilters} colorGradeSettings={colorGradeSettings} setColorGradeSettings={setColorGradeSettings} showToast={showToast} onRecordPick={styleProfile.recordPick} />
      case 'timeline': return <AdvancedTimelineView useProfessionalTimeline={useProfessionalTimeline} setUseProfessionalTimeline={setUseProfessionalTimeline} videoState={videoState} setVideoState={setVideoState} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} selectedSegmentId={selectedSegmentId} onSegmentSelect={(id) => setSelectedSegmentIds(id ? [id] : [])} videoUrl={actualVideoUrl || ''} aiSuggestions={aiSuggestions} showAiPreviews={true} showToast={showToast} setActiveCategory={setActiveCategory} />
      case 'assets': return <AssetLibraryView currentTime={videoState.currentTime} videoDuration={videoState.duration} setTimelineSegments={setTimelineSegments} showToast={showToast} myBroll={userAssets.filter(a => a.type === 'broll')} myMusic={userAssets.filter(a => a.type === 'music')} />
      case 'collaborate': return <CollaborateView videoId={videoId || ''} showToast={showToast} />
      case 'effects': return <EffectsView videoState={videoState} setVideoFilters={setVideoFilters} setTextOverlays={setTextOverlays} setActiveCategory={setActiveCategory} showToast={showToast} timelineEffects={timelineEffects} setTimelineEffects={setTimelineEffects} selectedEffectId={selectedEffectId} setSelectedEffectId={setSelectedEffectId} selectedSegmentId={selectedSegmentId} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} onSeek={(time) => setVideoState(prev => ({ ...prev, currentTime: time }))} />
      case 'export': return <ExportView videoId={videoId || ''} videoUrl={actualVideoUrl || ''} textOverlays={textOverlays} shapeOverlays={shapeOverlays} imageOverlays={imageOverlays} gradientOverlays={gradientOverlays} timelineSegments={timelineSegments} videoFilters={videoFilters} videoDuration={videoState.duration} showToast={showToast} setActiveCategory={setActiveCategory} projectName={projectName} />
      case 'ai-analysis': return <AIAssistView
        videoId={videoId || ''}
        transcript={transcript}
        aiSuggestions={aiSuggestions}
        setAiSuggestions={setAiSuggestions}
        directorSuggestions={aiDirectorSuggestions}
        appliedIds={timelineActions.appliedIds}
        onApplyOne={timelineActions.apply}
        onApplyAll={timelineActions.applyAll}
        onUndoLast={timelineActions.undoLastApply}
        canUndo={timelineActions.canUndo}
        setActiveCategory={setActiveCategory}
        showToast={showToast}
      />
      case 'scripts': return <ScriptGeneratorView
        showToast={showToast}
        onInsertToTimeline={(hookText) => {
          setTextOverlays(prev => [
            ...prev,
            {
              id: `hook-${Date.now()}`,
              text: hookText,
              x: 50, y: 15,
              fontSize: 36,
              color: '#ffffff',
              fontFamily: 'Inter, sans-serif',
              startTime: 0,
              endTime: Math.min(5, videoState.duration || 5),
              style: 'shadow',
            }
          ])
          showToast(t('modernVideoEditor.hookInsertedToTimeline'), 'success')
          setActiveCategory('timeline')
        }}
      />
      case 'thumbnails': return <ThumbnailGeneratorView videoUrl={actualVideoUrl || undefined} videoId={videoId || undefined} showToast={showToast} />
      case 'creative-tools': return <Trends2026View
        videoId={videoId || undefined}
        showToast={showToast}
        onApplyHook={(start, end) => {
          setVideoState(prev => ({ ...prev, currentTime: start }))
          showToast(t('modernVideoEditor.hookLocked', { start: start.toFixed(1), end: end.toFixed(1) }), 'success')
        }}
        onApplyBeatCuts={(bpm) => showToast(t('modernVideoEditor.beatCutsQueued', { bpm }), 'success')}
        onApplyOverlay={() => setActiveCategory('effects')}
        onApplyTrendingSound={() => setActiveCategory('assets')}
      />
      case 'stock-library': return <StockLibraryView
        showToast={showToast}
        currentTime={videoState.currentTime}
        videoDuration={videoState.duration}
        setTimelineSegments={setTimelineSegments}
      />
      case 'creative-packs': return <CreativePacksView
        showToast={showToast}
        onApplyPack={(pack) => {
          // Forward-compatible: when the editor pipeline supports preset bundles, this
          // is where music + transitions + caption style + color grade get queued.
          showToast(t('modernVideoEditor.packReady', { name: pack.name }), 'success')
        }}
      />
      case 'text-motion': return <TextMotionStudioView
        showToast={showToast}
        textOverlays={textOverlays}
        setTextOverlays={setTextOverlays}
        selectedTextOverlayId={selectedOverlayId}
        currentTime={videoState.currentTime}
        videoDuration={videoState.duration}
        recordStylePick={styleProfile.recordPick}
        styleBias={styleProfile.biasComparator}
      />
      case 'scheduling': return <SchedulingView showToast={showToast} />
      case 'distribution': return <DistributionHubView videoId={videoId || ''} videoUrl={actualVideoUrl || ''} showToast={showToast} />
      case 'intelligence': return (
        <IntelligenceEngineView
          dna={styleDNA}
          history={telemetryHistory}
        />
      )

      case 'export': return (
        <ExportView 
          videoId={videoId || ''} 
          videoUrl={actualVideoUrl || ''} 
          showToast={showToast}
          textOverlays={textOverlays}
          shapeOverlays={shapeOverlays}
          videoFilters={videoFilters}
          timelineSegments={timelineSegments}
          videoDuration={videoState.duration}
          projectName={projectName}
          onExportComplete={captureShadowTelemetry}
        />
      )

      case 'style-vault': {
        if (styleVaultView === 'train') {
          return <NeuralTrainingMatrixView
            onCancel={() => setStyleVaultView('dashboard')}
            onComplete={() => setStyleVaultView('tune')}
          />
        }
        if (styleVaultView === 'tune' && tuningProfile) {
          return <ProfileTuningView
            profile={tuningProfile}
            onCancel={() => setStyleVaultView('dashboard')}
            onSave={(updated) => {
              setStyleProfiles(prev => prev.some(p => p.id === updated.id)
                ? prev.map(p => p.id === updated.id ? updated : p)
                : [...prev, updated]
              )
              setStyleVaultView('dashboard')
              showToast(t('modernVideoEditor.dnaNodeCommitted'), 'success')
            }}
            onApply={handleApplyStyleProfile}
          />
        }
        return <StyleVaultDashboardView
          profiles={styleProfiles}
          onTrainNew={() => {
            setTuningProfile({
              id: `style-${Date.now()}`,
              name: t('modernVideoEditor.newNeuralDna'),
              lastTrained: Date.now(),
              pacing: { medianClipLength: 5, jCutFrequency: 'medium', lCutFrequency: 'medium', cutOnSentence: true },
              visuals: { punchInFrequency: 10, punchInAmount: 12, defaultTransition: 'none' },
              assets: { fontFamily: 'Inter, sans-serif', fontHex: '#ffffff', dropShadowHex: 'rgba(0,0,0,0.5)', bezierCurve: 'ease-in-out' },
              audio: { duckingDb: -20, masterDb: 0, voiceDb: -3 }
            })
            setStyleVaultView('train')
          }}
          onSelectProfile={(p) => {
            setTuningProfile(p)
            setStyleVaultView('tune')
          }}
          onApplyProfile={handleApplyStyleProfile}
        />
      }

      default: return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} textOverlays={textOverlays} setTextOverlays={setTextOverlays} shapeOverlays={shapeOverlays} setShapeOverlays={setShapeOverlays} imageOverlays={imageOverlays} setImageOverlays={setImageOverlays} svgOverlays={svgOverlays} setSvgOverlays={setSvgOverlays} gradientOverlays={gradientOverlays} setGradientOverlays={setGradientOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} videoState={videoState} filterStrength={filterStrength} setFilterStrength={setFilterStrength} showBeforeAfter={showBeforeAfter} setShowBeforeAfter={setShowBeforeAfter} compareMode={compareMode} setCompareMode={setCompareMode} videoId={videoId ?? undefined} segmentCount={timelineSegments.length} transcript={transcript} onSplitAtPlayhead={handleSplitAtPlayhead} onReverseSelected={handleReverseSelected} onFreezeAtPlayhead={handleFreezeAtPlayhead} onTrimSelectedToRange={handleTrimSelectedToRange} onJCutSelected={handleJCutSelected} onLCutSelected={handleLCutSelected} hasSegmentSelection={!!selectedSegmentId} />
    }
  }

  return (
    // Mobile: use 100dvh (avoids the iOS/Android 100vh chrome-overlap bug) and
    // w-full + overflow-x-hidden to prevent horizontal scroll. Desktop unchanged
    // via md: (the heavy row layout below stays as-is on >=768px).
    <div className="h-[100dvh] w-full md:h-screen md:w-screen flex flex-col bg-[var(--page-bg)] text-white overflow-hidden overflow-x-hidden font-['Outfit'] selection:bg-indigo-500/30 editor-auto">

      {/* Background nebula */}
      <motion.div
        animate={{ x: mousePos.x / 100, y: mousePos.y / 100 }}
        className="fixed inset-0 pointer-events-none opacity-30 mix-blend-screen z-0"
      >
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-indigo-500/[0.08] blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[1000px] h-[1000px] bg-indigo-600/[0.05] blur-[200px] rounded-full animate-pulse animation-delay-3000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-screen bg-[var(--page-bg)]" />
      </motion.div>

      <AchievementSystem />
      <CommandK
        isOpen={commandKOpen}
        onClose={() => setCommandKOpen(false)}
        commands={(() => {
          // Build a dynamic command list:
          //   1) every CATEGORIES entry → "Open <label>" routed via setActiveCategory.
          //   2) selection-aware actions (split / ripple delete / lock) only when something is picked.
          //   3) Style-vault legacy entries kept for backward compat.
          const items: { id: string; label: string; icon: LucideIcon; category: string; shortcut?: string }[] = []
          // Categories grouped under their EDITOR_GROUPS label
          for (const cat of CATEGORIES) {
            const groupId = groupForCategory(cat.id)
            const group = EDITOR_GROUPS.find(g => g.id === groupId)
            items.push({
              id: cat.id,
              label: t('modernVideoEditor.openCategory', { label: cat.label }),
              icon: cat.icon as LucideIcon,
              category: group?.label.toUpperCase() || 'EDITOR',
            })
          }
          // Selection-aware actions
          if (selectedSegmentId) {
            items.unshift(
              { id: '__split-at-playhead', label: t('modernVideoEditor.cmdSplitAtPlayhead'), icon: Scissors, category: t('modernVideoEditor.cmdCategoryAction'), shortcut: 'S' },
              { id: '__ripple-delete', label: t('modernVideoEditor.cmdRippleDelete'), icon: Trash2, category: t('modernVideoEditor.cmdCategoryAction'), shortcut: 'X' },
              { id: '__lock-segment', label: t('modernVideoEditor.cmdToggleLock'), icon: Lock, category: t('modernVideoEditor.cmdCategoryAction') },
            )
          }
          // Always-available editor actions
          items.unshift(
            { id: '__layout-balanced', label: t('modernVideoEditor.cmdLayoutBalanced'), icon: Layers, category: t('modernVideoEditor.cmdCategoryView') },
            { id: '__layout-preview',  label: t('modernVideoEditor.cmdLayoutPreview'), icon: Film, category: t('modernVideoEditor.cmdCategoryView') },
            { id: '__layout-timeline', label: t('modernVideoEditor.cmdLayoutTimeline'), icon: Layers, category: t('modernVideoEditor.cmdCategoryView') },
            { id: 'style-vault',       label: t('modernVideoEditor.cmdOpenStyleVault'), icon: LayersIcon, category: t('modernVideoEditor.cmdCategoryVault') },
            { id: 'apply-style',       label: t('modernVideoEditor.cmdApplyStyleTemplate'), icon: Sparkles, category: t('modernVideoEditor.cmdCategoryVault') },
          )
          return items
        })()}
        onExecute={(id) => {
          // Selection-aware first
          if (id === '__split-at-playhead') { handleSplitAtPlayhead(); return }
          if (id === '__ripple-delete')     { handleRippleDeleteSelected(); return }
          if (id === '__lock-segment') {
            if (selectedSegmentId) {
              setTimelineSegments((prev: TimelineSegment[]) => prev.map((s: TimelineSegment) =>
                s.id === selectedSegmentId ? { ...s, locked: !(s as any).locked } as TimelineSegment : s
              ))
            }
            return
          }
          if (id === '__layout-balanced')  { updateLayout({ focusMode: 'balanced' });  return }
          if (id === '__layout-preview')   { updateLayout({ focusMode: 'preview' });   return }
          if (id === '__layout-timeline')  { updateLayout({ focusMode: 'timeline' });  return }
          if (id === 'style-vault') {
            setActiveCategory('style-vault')
            setStyleVaultView('dashboard')
            return
          }
          if (id === 'apply-style') {
            if (styleProfiles.length > 0) {
              setTuningProfile(styleProfiles[0])
              showToast(t('modernVideoEditor.applyingNeuralTemplate', { name: styleProfiles[0].name }), 'success')
            } else {
              showToast(t('modernVideoEditor.noTrainedDna'), 'info')
              setActiveCategory('style-vault')
              setStyleVaultView('train')
            }
            return
          }
          setActiveCategory(id as EditorCategory)
        }}
      />
      <AiAssistant
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        setTimelineSegments={setTimelineSegments}
        setTextOverlays={setTextOverlays}
        setVideoFilters={setVideoFilters}
        showToast={showToast}
        styleDNA={styleDNA}
        onNormalizeStyle={handleStyleNormalize}
        videoId={videoId ?? undefined}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        onSeek={(time) => setVideoState(prev => ({ ...prev, currentTime: time }))}
      />

      {/* ── Horizontal chrome: sidebar + main ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
        <EditorSidebar
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          isOledTheme={true}
          deviceView={deviceView}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          videoDuration={videoState.duration}
        />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative pt-[60px] editor-auto">

          <EditorHUD
            projectName={projectName}
            setProjectName={setProjectName}
            autosaveStatus={autosaveStatus as any}
            historyIndex={historyIndex}
            historyLength={history.length}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            setShowKeyboardHelp={setShowKeyboardHelp}
            onLayoutChange={updateLayout}
            engagementScore={engagementScore.overall}
            viralPotential={engagementScore.viralPotential}
            hookStrength={engagementScore.hookStrength}
            sentimentDensity={engagementScore.sentimentDensity}
            trendAlignment={engagementScore.trendAlignment}
            retentionHeatmap={engagementScore.retentionHeatmap}
            currentTime={videoState.currentTime}
            duration={videoState.duration}
            activeCategory={activeCategory}
            onCommandK={() => setCommandKOpen(true)}
            styleDNA={styleDNA}
            onNormalizeStyle={handleStyleNormalize}
            zenMode={zenMode}
            setZenMode={setZenMode}
            onMakeItViral={handleMakeItViral}
            isMakingViral={isMakingViral}
            onExport={() => {
              setActiveCategory('export')
              setVideoState(prev => ({ ...prev, isPlaying: false })) // Pause preview during export setup
            }}
          />



          <QuickActionsBar
            setActiveCategory={setActiveCategory}
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onApplyMyStyle={handleApplyMyStyle}
            onOpenSmartCleanup={() => setSmartCleanupOpen(true)}
            showToast={showToast}
          />

          <SmartCleanupPanel
            open={smartCleanupOpen}
            videoId={videoId}
            initialTool={smartCleanupInitialTool}
            onClose={() => { setSmartCleanupOpen(false); setSmartCleanupInitialTool(null) }}
            showToast={showToast}
          />

          <div className="px-4 pt-2 relative z-20">
            <AnimatePresence>
              {(activeCategory === 'insights' || activeCategory === 'ai-edit') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <EngagementHeatMap
                    transcript={transcript}
                    currentTime={videoState.currentTime}
                    duration={videoState.duration}
                  />
                  <div className="h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 gap-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContentPanelCollapsed(p => !p)}
                title={contentPanelCollapsed ? t('modernVideoEditor.showToolPanel') : t('modernVideoEditor.hideToolPanel')}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  contentPanelCollapsed
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:text-white hover:border-white/20'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:block">{contentPanelCollapsed ? t('modernVideoEditor.showPanel') : t('modernVideoEditor.hidePanel')}</span>
              </button>

              <div className="flex items-center gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                {(['balanced', 'preview', 'timeline'] as const).map((mode) => (
                  <button
                   type="button"
                    key={mode}
                    onClick={() => updateLayout({ focusMode: mode })}
                    title={t('modernVideoEditor.focusModeLayoutTitle', { mode: t(`modernVideoEditor.focusMode_${mode}`) })}
                    className={`px-2.5 h-5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                      layoutPrefs.focusMode === mode
                        ? 'bg-white text-black'
                        : 'text-slate-600 hover:text-white'
                    }`}
                  >
                    {mode === 'balanced' ? '⚖' : mode === 'preview' ? '🎬' : '🎵'}
                    <span className="hidden lg:inline ml-1">{t(`modernVideoEditor.focusMode_${mode}`)}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                {(['compact', 'comfortable', 'expanded'] as const).map((d) => (
                  <button
                   type="button"
                    key={d}
                    onClick={() => updateLayout({ timelineDensity: d })}
                    title={t('modernVideoEditor.densityTitle', { density: t(`modernVideoEditor.density_${d}`) })}
                    className={`px-2 h-5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                      layoutPrefs.timelineDensity === d
                        ? 'bg-white text-black'
                        : 'text-slate-600 hover:text-white'
                    }`}
                  >
                    {d === 'compact' ? '═' : d === 'comfortable' ? '≡' : '☰'}
                    <span className="hidden xl:inline ml-1">{t(`modernVideoEditor.densityShort_${d}`)}</span>
                  </button>
                ))}
              </div>

              <button
               type="button"
                disabled={creatorPipeline.running || !videoId}
                onClick={() => {
                  if (!videoId) return
                  creatorPipeline.run({ videoId, withAutoEdit: false })
                    .then(r => {
                      if (r.suggestions?.suggestions?.length) {
                        showToast?.(t('modernVideoEditor.clickComposedMoves', { count: r.suggestions.suggestions.length }), 'success')
                        setAssistantOpen(true)
                      }
                    })
                    .catch((e: any) => showToast?.(t('modernVideoEditor.pipelineFailed', { error: e?.message || 'unknown' }), 'error'))
                }}
                title={t('modernVideoEditor.runPipelineTitle')}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  creatorPipeline.running
                    ? 'bg-violet-500/30 border-violet-500/50 text-violet-200 animate-pulse'
                    : 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white border-white/20 hover:shadow-lg hover:shadow-fuchsia-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:block">{creatorPipeline.running ? t('modernVideoEditor.working') : t('modernVideoEditor.makeItGreat')}</span>
              </button>

              {creatorPipeline.running && creatorPipeline.stages.length > 0 && (
                <div className="hidden md:flex items-center gap-1 text-[8px] font-mono text-slate-500 ml-1">
                  {creatorPipeline.stages.map((s: PipelineStage) => (
                    <span
                      key={s.id}
                      title={`${s.label}: ${s.status}${s.error ? ` — ${s.error}` : ''}`}
                      className={`px-1.5 py-0.5 rounded uppercase tracking-widest ${
                        s.status === 'done' ? 'bg-emerald-500/15 text-emerald-300' :
                        s.status === 'running' ? 'bg-violet-500/15 text-violet-300' :
                        s.status === 'failed' ? 'bg-rose-500/15 text-rose-300' :
                        'bg-white/[0.04] text-slate-600'
                      }`}
                    >
                      {s.id.slice(0, 4)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVideoState(prev => ({ ...prev, currentTime: Math.max(0, prev.currentTime - 5) }))}
                title={t('modernVideoEditor.back5s')}
                className="w-7 h-7 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all text-[9px] font-black"
              >
                ‹5
              </button>
              <button
                type="button"
                onClick={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                title={videoState.isPlaying ? t('modernVideoEditor.pause') : t('modernVideoEditor.play')}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 transition-all"
              >
                {videoState.isPlaying
                  ? <div className="flex gap-0.5"><div className="w-1 h-3 bg-white rounded-sm" /><div className="w-1 h-3 bg-white rounded-sm" /></div>
                  : <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => setVideoState(prev => ({ ...prev, currentTime: Math.min(prev.duration, prev.currentTime + 5) }))}
                title={t('modernVideoEditor.forward5s')}
                className="w-7 h-7 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all text-[9px] font-black"
              >
                5›
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPropertiesPanelOpen(p => !p)}
                title={propertiesPanelOpen ? t('modernVideoEditor.hideProperties') : t('modernVideoEditor.showProperties')}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  propertiesPanelOpen
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <span className="hidden sm:block">{propertiesPanelOpen ? t('modernVideoEditor.hideProps') : t('modernVideoEditor.showProps')}</span>
                <Layers className="w-3 h-3 rotate-90" />
              </button>

              <button
                type="button"
                onClick={() => setShowPerformanceRail(p => !p)}
                title={showPerformanceRail ? t('modernVideoEditor.hideInsights') : t('modernVideoEditor.showInsights')}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  showPerformanceRail
                    ? 'bg-fuchsia-600/20 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-600/40'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <span className="hidden sm:block">{showPerformanceRail ? t('modernVideoEditor.hideInsights') : t('modernVideoEditor.showInsights')}</span>
                <TrendingUp className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => setInsightsSidebarCollapsed(p => !p)}
                title={insightsSidebarCollapsed ? t('modernVideoEditor.showExpert') : t('modernVideoEditor.hideExpert')}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  !insightsSidebarCollapsed
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <span className="hidden sm:block">{insightsSidebarCollapsed ? t('modernVideoEditor.showExpert') : t('modernVideoEditor.hideExpert')}</span>
                <BrainCircuit className="w-3 h-3 text-indigo-400" />
              </button>

              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{t('modernVideoEditor.uplinkLive')}</span>
            </div>
          </div>
        </div>

        {/* ── Neural Command Input (Center) ── */}

          <div className="flex-1 min-h-0 flex flex-row overflow-hidden gap-4 px-4 pb-4">

            <div
              className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ${
                contentPanelCollapsed || layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline' || zenMode
                  ? 'opacity-0 pointer-events-none translate-y-full md:translate-y-0 md:w-0'
                  : 'opacity-100 translate-y-0'
              } ${
                viewportWidth < 768
                  ? 'fixed inset-x-0 bottom-0 z-50 h-[70vh] bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]'
                  : 'relative'
              }`}
              style={{
                width: viewportWidth < 768 ? '100%' : (contentPanelCollapsed || layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline' || zenMode ? 0 : clampedLeftPanelWidth),
                minWidth: 0,
                paddingBottom: viewportWidth < 768 ? 'env(safe-area-inset-bottom)' : 0
              }}
            >
              {viewportWidth < 768 && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t('modernVideoEditor.closePanel')}
                  className="w-full h-11 flex items-center justify-center cursor-pointer shrink-0 touch-none active:bg-white/[0.03]"
                  onClick={() => setContentPanelCollapsed(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setContentPanelCollapsed(true) } }}
                >
                  <div className="w-12 h-1.5 bg-white/30 rounded-full" />
                </div>
              )}
              <div className={`overflow-hidden flex flex-col h-full bg-surface-900 border border-surface-800 ${viewportWidth < 768 ? 'rounded-none border-none bg-transparent' : 'rounded-xl shadow-lg'}`}>
                <div className="flex-shrink-0 px-6 py-4 border-b border-surface-200 dark:border-surface-800 bg-surface-100 dark:bg-surface-900">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shadow-inner">
                      {(() => {
                        const isAiCategory = ['ai', 'ai-edit', 'ai-analysis', 'predict', 'automate', 'scripts', 'dub', 'thumbnails', 'creative-tools', 'intelligence'].includes(activeCategory)
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveCategory('edit')}
                              className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${!isAiCategory ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                              {t('modernVideoEditor.manualEdit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCategory('ai')}
                              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${isAiCategory ? 'bg-fuchsia-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {t('modernVideoEditor.neuralEngine')}
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  

                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.4, ease: 'circOut' }}
                    >
                      {getCategoryContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Resize Handle Left — only show when panel is visible */}
            {!contentPanelCollapsed && layoutPrefs.focusMode === 'balanced' && (
              <div
                onMouseDown={() => setIsResizingLeft(true)}
                className="w-1.5 flex-shrink-0 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-20 group flex items-center justify-center"
              >
                <div className="w-0.5 h-8 bg-white/10 group-hover:bg-indigo-500/50 rounded-full" />
              </div>
            )}

            {/* Video preview — flex-1 fills all remaining space */}
            <div
              className={`relative overflow-hidden rounded-xl bg-surface-900 border border-surface-800 shadow-lg ${
                layoutPrefs.focusMode === 'timeline' ? 'min-h-[120px] flex-1' : 'flex-1 min-h-0'
              }`}
            >


              {/* Video — full bleed */}
              <div className="absolute inset-0 bg-black/60">
                <RealTimeVideoPreview
                  videoUrl={actualVideoUrl || ''}
                  currentTime={videoState.currentTime}
                  isPlaying={videoState.isPlaying}
                  volume={videoState.volume}
                  isMuted={videoState.isMuted}
                  playbackSpeed={playbackSpeed}
                  filters={effectiveFilters}
                  textOverlays={textOverlays}
                  shapeOverlays={shapeOverlays}
                  imageOverlays={imageOverlays}
                  svgOverlays={svgOverlays}
                  gradientOverlays={gradientOverlays}
                  editingWords={editingWords}
                  captionStyle={captionStyle}
                  templateLayout={templateLayout}
                  onTimeUpdate={(time: number) => setVideoState(prev => ({ ...prev, currentTime: time }))}
                  onDurationChange={(d: number) => setVideoState(prev => ({ ...prev, duration: d }))}
                  onPlayPause={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                  showBeforeAfter={showBeforeAfter}
                  onBeforeAfterChange={setShowBeforeAfter}
                  compareMode={compareMode}
                  timelineEffects={timelineEffects}
                  timelineSegments={timelineSegments}
                  trackVisibility={trackVisibility}
                  previewQuality={previewQuality}
                  chromaKey={chromaKey}
                  onUpdateOverlay={handleUpdateOverlay}
                  selectedOverlayId={selectedOverlayId}
                  onSelectOverlay={setSelectedOverlayId}
                  isNeuralActive={!!tuningProfile && (activeCategory !== 'style-vault' || styleVaultView === 'tune')}
                  videoTransform={videoTransform}
                  videoTransformKeyframes={videoTransformKeyframes}
                  videoCrop={videoCrop}
                  isTransformMode={propertiesPanelOpen}
                  onUpdateVideoTransform={setVideoTransform}
                />
              </div>

              {/* Floating bottom controls inside video preview */}
              <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-center gap-3 pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2 bg-surface-100 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 pointer-events-auto shadow-sm">
                  {/* Volume */}
                  <button
                    type="button"
                    onClick={() => setVideoState(prev => ({ ...prev, isMuted: !prev.isMuted }))}
                    title={videoState.isMuted ? t('modernVideoEditor.unmute') : t('modernVideoEditor.mute')}
                    className="text-slate-400 hover:text-white transition-colors text-[11px]"
                  >
                    {videoState.isMuted ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    value={videoState.isMuted ? 0 : videoState.volume}
                    onChange={e => setVideoState(prev => ({ ...prev, volume: parseFloat(e.target.value), isMuted: false }))}
                    className="w-16 h-1 accent-indigo-500 cursor-pointer"
                    title={t('modernVideoEditor.volume')}
                  />
                  <div className="w-px h-4 bg-white/10" />
                  {/* Playback speed */}
                  <div className="flex items-center gap-1">
                    {[0.5, 1, 1.5, 2].map(s => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all ${
                          playbackSpeed === s ? 'text-white bg-white/20' : 'text-slate-600 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>{/* end content row */}

          {/* ── Timeline — adaptive height below the content row ── */}
          <div className={`flex-shrink-0 flex flex-col gap-2 px-4 pb-4 ${
            layoutPrefs.timelineDensity === 'compact' ? 'h-[160px] min-h-[140px]'
            : layoutPrefs.timelineDensity === 'expanded' ? 'h-[280px] min-h-[200px]'
            : 'h-[220px] min-h-[160px]'
          } ${
            layoutPrefs.focusMode === 'timeline' ? '!h-[400px] !min-h-[300px]' : ''
          }`}>
            <div className="bg-surface-900 flex-1 min-h-0 rounded-xl border border-surface-800 p-3 flex flex-col gap-2 overflow-hidden shadow-lg relative">
              <div className="flex items-center justify-between gap-4 relative z-10 px-2 flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">{t('modernVideoEditor.neuralEngine')}</span>
                  </div>
                  <div className="h-4 w-px bg-white/10 mx-2" />
                  <span className="text-xl font-black font-mono text-indigo-400 tabular-nums tracking-tighter">
                    {formatTime(videoState.currentTime)} <span className="text-slate-700 mx-1">/</span> {formatTime(videoState.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSnapToKeyframes((prev) => !prev)}
                    title={t('modernVideoEditor.toggleNeuralSnapping')}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${snapToKeyframes ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 border border-white/5 text-slate-500 hover:text-white'}`}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                    {t('modernVideoEditor.neuralSnap')}
                  </button>
                  <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-2xl border border-white/5">
                    {[0.5, 1, 2].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        title={t('modernVideoEditor.setPlaybackSpeed', { speed: s })}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${playbackSpeed === s ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
                      >
                        {s}X
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 relative flex gap-2">
                <div className="flex-1 relative min-w-0">
                  <div className="absolute inset-0 bg-black/20 rounded-[1.5rem] border border-white/5" />
                  <div className="relative h-full">
                    <ResizableTimeline
                      duration={videoState.duration}
                      currentTime={videoState.currentTime}
                      isPlaying={videoState.isPlaying}
                      onPlayPause={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                      density={layoutPrefs.timelineDensity}
                      segments={timelineSegments}
                      onTimeUpdate={handleTimeUpdate}
                      onSegmentsChange={setTimelineSegments}
                      markers={timelineMarkers}
                      onMarkersChange={setTimelineMarkers}
                      selectedSegmentId={selectedSegmentId}
                      selectedSegmentIds={selectedSegmentIds}
                      onSegmentSelect={handleSegmentSelect}
                      onSegmentDeleted={() => showToast(t('modernVideoEditor.segmentPurged'), 'info')}
                      trackVisibility={trackVisibility}
                      onTrackVisibilityChange={(trackIndex, visible) => setTrackVisibility((prev) => ({ ...prev, [trackIndex]: visible }))}
                      effects={timelineEffects}
                      onEffectsChange={setTimelineEffects}
                      selectedEffectId={selectedEffectId}
                      onEffectSelect={setSelectedEffectId}
                      onEffectDeleted={() => showToast(t('modernVideoEditor.effectPurged'), 'info')}
                      textOverlays={textOverlays}
                      onTextOverlaysChange={setTextOverlays}
                      imageOverlays={imageOverlays}
                      onAssetDrop={handleAssetDrop}
                      transcript={transcript}
                      aiDirectorSuggestions={aiDirectorSuggestions}
                      engagementScore={engagementScore}
                    />
                  </div>
                </div>
                {/* Prompt-Based Timeline Chat Docked to Timeline */}
                {assistantOpen && (
                  <AiTimelineChat 
                    onApplyLUT={(name) => setVideoFilters(prev => ({...prev, contrast: 120, saturation: 110, temperature: 95, vignette: 20}))}
                    onChangeAspectRatio={() => showToast(t('modernVideoEditor.aspectRatioUpdated'), 'success')}
                    onAddText={(text) => setTextOverlays(prev => [...prev, {
                      id: `ai-text-${Date.now()}`,
                      text, x: 50, y: 50, fontSize: 64, color: '#ffffff', fontFamily: 'Inter, sans-serif', startTime: videoState.currentTime, endTime: videoState.currentTime + 3, style: 'bold-kinetic', shadowColor: 'rgba(0,0,0,0.5)', animationIn: 'pop', animationOut: 'fade', animationInDuration: 0.15, animationOutDuration: 0.2, layer: 10
                    }])}
                  />
                )}
              </div>
            </div>
          </div>

        </main>

          {/* Resize Handle Right — only when panel is open */}
          {propertiesPanelOpen && layoutPrefs.focusMode === 'balanced' && (
            <div
              onMouseDown={() => setIsResizingRight(true)}
              className="w-1.5 flex-shrink-0 h-full cursor-col-resize hover:bg-indigo-500/30 transition-colors z-20 group flex items-center justify-center"
            >
              <div className="w-0.5 h-8 bg-white/10 group-hover:bg-indigo-500/50 rounded-full" />
            </div>
          )}

          {/* Properties Panel (Right) */}
          <PropertiesPanel
            isOpen={propertiesPanelOpen && viewportWidth >= 1024}
            setIsOpen={setPropertiesPanelOpen}
            videoFilters={videoFilters}
            setVideoFilters={setVideoFilters}
            textOverlays={textOverlays}
            setTextOverlays={setTextOverlays}
            imageOverlays={imageOverlays}
            setImageOverlays={setImageOverlays}
            gradientOverlays={gradientOverlays}
            setGradientOverlays={setGradientOverlays}
            captionStyle={captionStyle}
            setCaptionStyle={setCaptionStyle}
            isOledTheme={true}
            style={{ width: rightPanelWidth, transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)' }}
            videoTransform={videoTransform}
            setVideoTransform={setVideoTransform}
            videoTransformKeyframes={videoTransformKeyframes}
            setVideoTransformKeyframes={setVideoTransformKeyframes}
            currentTime={videoState.currentTime}
            onTimeUpdate={(time: number) => setVideoState(prev => ({ ...prev, currentTime: time }))}
            timelineSegments={timelineSegments}
            setTimelineSegments={setTimelineSegments}
            selectedSegmentId={selectedSegmentId}
            transcript={transcript}
            zenMode={zenMode}
          />

          {/* Backdrop for the compact-viewport right drawer (Inspector + Insights). */}
          {rightDrawerOpen && (
            <div
              className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm"
              onClick={closeRightDrawer}
              aria-hidden="true"
            />
          )}

          {/* On desktop these panels are inline flex columns (display:contents makes
               this wrapper transparent to layout). On compact viewports they collapse
               into one full-height slide-in drawer so they never crush the preview. */}
          <div
            className={
              isCompactViewport
                ? `fixed inset-y-0 right-0 z-[70] w-80 max-w-[90vw] overflow-y-auto overscroll-contain bg-surface-950 shadow-2xl transition-transform duration-300 ${rightDrawerOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`
                : 'contents'
            }
            style={isCompactViewport ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
          >

          {/* Inspector — quick-edit panel for the active selection. Renders to the
               left of PropertiesPanel only when a clip or text overlay is selected,
               so when nothing's picked the layout is unchanged. */}
          {(selectedSegmentId || selectedOverlayId) && (
            <Inspector
              selection={deriveSelection(selectedSegmentId, selectedOverlayId)}
              segments={timelineSegments}
              textOverlays={textOverlays}
              onUpdateSegment={(id, updates) =>
                setTimelineSegments((prev: TimelineSegment[]) =>
                  prev.map((s: TimelineSegment) => (s.id === id ? { ...s, ...updates } : s))
                )}
              onUpdateText={(id, updates) =>
                setTextOverlays(prev =>
                  prev.map(o => (o.id === id ? { ...o, ...updates } : o))
                )}
              onDeleteSegment={(id) => {
                setTimelineSegments((prev: TimelineSegment[]) => prev.filter((s: TimelineSegment) => s.id !== id))
                setSelectedSegmentIds([])
                showToast(t('modernVideoEditor.clipRemoved'), 'info')
              }}
              onDeleteText={(id) => {
                setTextOverlays(prev => prev.filter(o => o.id !== id))
                setSelectedOverlayId(null)
                showToast(t('modernVideoEditor.textRemoved'), 'info')
              }}
              onClose={() => { setSelectedSegmentIds([]); setSelectedOverlayId(null) }}
            />
          )}

          {/* Performance Rail — shows the creator's top-performing fonts /
               captions / motions / hooks ordered by retention delta. Gated behind showPerformanceRail to keep layout clean by default. */}
          {showPerformanceRail && (
            <div className="w-72 flex-shrink-0 px-3 py-3 hidden xl:block">
              <PerformanceRail
                onApplyFont={(fontKey) => {
                  if (textOverlays.length === 0) return
                  setTextOverlays(prev => prev.map((o, i) =>
                    i === prev.length - 1 ? { ...o, fontFamily: fontKey } : o
                  ))
                  showToast?.(t('modernVideoEditor.appliedTopPerformingFont'), 'success')
                }}
                onApplyCaptionStyle={(styleKey) => {
                  if (textOverlays.length === 0) return
                  setTextOverlays(prev => prev.map((o, i) =>
                    i === prev.length - 1 ? { ...o, style: styleKey as any } : o
                  ))
                  showToast?.(t('modernVideoEditor.appliedTopPerformingCaptionStyle'), 'success')
                }}
                onApplyMotion={(motionKey) => {
                  if (textOverlays.length === 0) return
                  setTextOverlays(prev => prev.map((o, i) =>
                    i === prev.length - 1 ? { ...o, motionGraphic: motionKey as any } : o
                  ))
                  showToast?.(t('modernVideoEditor.appliedTopPerformingMotion'), 'success')
                }}
              />
            </div>
          )}

          {/* Insights Sidebar (New) */}
          {!insightsSidebarCollapsed && (
            <InsightsSidebar
              score={engagementScore}
              niche={contentNiche}
              onNicheChange={setContentNiche}
              onCaptionStyleChange={(style) => setCaptionStyle(prev => prev ? { ...prev, textStyle: style } : prev)}
              onLanguageChange={setTargetLanguage}
              onManualOverride={handleManualOverride}
              onScheduleUpload={handleScheduleUpload}
              targetLanguage={targetLanguage}
              selectedCaptionStyle={captionStyle?.textStyle || 'bold'}
              showToast={showToast}
              onCollapse={() => setInsightsSidebarCollapsed(true)}
            />
          )}

          </div>{/* end right-panel wrapper (inline columns / compact drawer) */}

      </div>

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
        />
      )}
    </div>
  )
}

export default ModernVideoEditor

