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
  Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Clinical Utilities
import { getStatusColor, loadEditorContentPreferences, pushRecentSection } from '../utils/editorUtils'
import { CATEGORIES } from '../utils/editorConstants'

// Contextual Components
import { EditorSidebar } from './editor/EditorSidebar'
import { useMultiplayerTimeline } from '../hooks/useMultiplayerTimeline'
import { PropertiesPanel } from './editor/PropertiesPanel'
import RealTimeVideoPreview from './editor/RealTimeVideoPreview'
import ResizableTimeline from './editor/ResizableTimeline'
import CommandK from './editor/CommandK'
import AiAssistant from './editor/AiAssistant'
import EngagementHeatMap from './editor/EngagementHeatMap'
import HealthDeltaOverlay from './editor/HealthDeltaOverlay'

// Specialized Views
import EliteAIView from './editor/views/EliteAIView'
import CreativeAIView from './editor/views/CreativeAIView'
import GrowthInsightsView from './editor/views/GrowthInsightsView'
import PredictionEngineView from './editor/views/PredictionEngineView'
import SocialVaultView from './editor/views/SocialVaultView'
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
import SettingsView from './editor/views/SettingsView'
import ChromakeyView, { ChromaKeySettings } from './editor/views/ChromakeyView'
import VisualFXView from './editor/views/VisualFXView'
import AIAnalysisView from './editor/views/AIAnalysisView'
import AIAssistView from './editor/views/AIAssistView'
import DistributionHubView from './editor/views/DistributionHubView'
import { StyleVaultDashboardView } from './editor/views/StyleVaultDashboardView'
import { NeuralTrainingMatrixView } from './editor/views/NeuralTrainingMatrixView'
import { ProfileTuningView } from './editor/views/ProfileTuningView'
import IntelligenceEngineView from './editor/views/IntelligenceEngineView' // Added
import { useStyleDNA } from '../hooks/useStyleDNA' // Added
import { PlatformInsights } from '../types/editor' // Added

import AchievementSystem from './AchievementSystem'
import { ErrorBoundary } from './ErrorBoundary'
import { useVideoEditorAutosave } from '../hooks/useVideoEditorAutosave'
import { useToast } from '../contexts/ToastContext'
import KeyboardShortcutsHelp from './editor/KeyboardShortcutsHelp'
import { InsightsSidebar } from './editor/InsightsSidebar'
import EditorHUD from './editor/EditorHUD'
import { calculateEngagementScore } from '../utils/rankingEngine'
import { generateSmartMetadata } from '../utils/metadataGenerator'
import { apiGet } from '../lib/api'
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
  { id: 'edit', label: 'KINETIC_CALIBRATION', icon: EditToolIcon, color: 'text-white' },
  { id: 'color', label: 'SPECTRAL_GRADING', icon: Video, color: 'text-blue-400' },
  { id: 'ai', label: 'NEURAL_SYNTHESIS', icon: AiIcon, color: 'text-purple-400' },
  { id: 'effects', label: 'VISUAL_FX_MATRIX', icon: LayersIcon, color: 'text-yellow-400' },
  { id: 'remix', label: 'SWARM_REMIX', icon: Sparkles, color: 'text-fuchsia-400' },
  { id: 'predict', label: 'RETENTION_FORECAST', icon: BrainCircuit, color: 'text-indigo-400' },
  { id: 'intelligence', label: 'IDENTITY_DNA_LATTICE', icon: Database, color: 'text-emerald-400' },
  { id: 'timeline', label: 'TEMPORAL_SEQUENCE', icon: List, color: 'text-gray-400' },
  { id: 'export', label: 'FINAL_MANIFEST', icon: Send, color: 'text-white' },
  { id: 'style-vault', label: 'DNA_VAULT_CORE', icon: Orbit, color: 'text-pink-400' },
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

const glassStyle = "backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-700 hover:bg-white/[0.05]"

const ModernVideoEditor: React.FC<{ videoUrl?: string; videoPath?: string; videoId?: string; initialState?: any }> = ({ videoUrl, videoPath, videoId, initialState }) => {
  const { showToast } = useToast()
  const actualVideoUrl = videoUrl || videoPath

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
    if (typeof window === 'undefined') return 'ai-edit'
    try {
      const prefs = loadEditorContentPreferences()
      const section = prefs.defaultOpenSection
      return section && CATEGORIES.some(c => c.id === section) ? section : 'ai-edit'
    } catch { return 'ai-edit' }
  })

  const setActiveCategory = useCallback((category: EditorCategory) => {
    setActiveCategoryState(category)
    pushRecentSection(category)
  }, [])
  const activeCategory = activeCategoryState; // Renamed to avoid conflict with the new state variable

  const [projectName, setProjectName] = useState('Untitled Kinetic Sequence')
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true)
  const [contentPanelCollapsed, setContentPanelCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandKOpen, setCommandKOpen] = useState(false)
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

  // Intelligence & Style DNA
  const styleDNA = useStyleDNA(timelineSegments, [...textOverlays, ...shapeOverlays, ...imageOverlays, ...svgOverlays, ...gradientOverlays]); // Initialized useStyleDNA
  const [aiProposalSnapshot, setAiProposalSnapshot] = useState<any>(null); // Added
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]); // Added

  // ── Consolidated AI & Strategy State ──
  const [contentNiche, setContentNiche] = useState<ContentNiche>('educational')
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

  // ── Consolidated Automation & History State ──
  const [voiceoverText, setVoiceoverText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('alloy')
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)
  const [userAssets, setUserAssets] = useState<Asset[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)

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
          url: v.originalFile?.url,
          title: v.title || 'Uploaded B-Roll',
          type: 'broll',
          source: 'upload',
          autoTags: v.metadata?.tags || []
        })) || []

        const music = (musicRes?.data?.tracks ?? musicRes?.tracks ?? [])?.map((m: any) => ({
          id: m._id,
          url: m.file?.url,
          title: m.title || 'Uploaded Music',
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
      name: `AI Voiceover (${selectedVoice})`,
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
      showToast('Intelligent Captions & Voiceover Synced', 'success')
    } else {
      showToast('Voiceover added to timeline', 'success')
    }
  }, [videoState.currentTime, selectedVoice, voiceoverText, setTimelineSegments, setTextOverlays, showToast])

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
      if (stateToLoad.timelineSegments) setTimelineSegments(stateToLoad.timelineSegments)
      if (stateToLoad.timelineMarkers) setTimelineMarkers(stateToLoad.timelineMarkers)
      if (stateToLoad.timelineEffects) setTimelineEffects(stateToLoad.timelineEffects)
      if (stateToLoad.colorGradeSettings) setColorGradeSettings(stateToLoad.colorGradeSettings)
      if (stateToLoad.captionStyle) setCaptionStyle(stateToLoad.captionStyle)
      if (stateToLoad.templateLayout) setTemplateLayout(stateToLoad.templateLayout)
      if (stateToLoad.projectName) setProjectName(stateToLoad.projectName)
      showToast('Neural State Restored', 'success')
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
          name: 'Master Video Source',
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
      showToast('Video Integrated to Timeline', 'success')
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


  const handleUndo = useCallback(() => { /* implementation */ }, [])
  const handleRedo = useCallback(() => { /* implementation */ }, [])

  // ── Callbacks ──
  const handleManualOverride = useCallback((instruction: string) => {
    showToast(`Neural Override: ${instruction}`, 'info')
    // In real app, this would send the instruction + timeline to AI
  }, [showToast])

  const handleScheduleUpload = useCallback(() => {
    showToast('Directing to Neural Scheduler...', 'success')
    setActiveCategory('scheduling')
  }, [showToast, setActiveCategory])

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
    showToast('Shadow Telemetry Synchronized', 'success')
  }, [aiProposalSnapshot, timelineSegments, textOverlays, shapeOverlays, styleDNA, showToast])

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
    
    showToast(`Aligning to ${styleDNA.theme || 'Vlog'} DNA...`, 'info')
    
    // 1. Normalize Pacing (if CPM is high, suggest/apply split points)
    if (styleDNA.cpm > 10 && timelineSegments.length < 5) {
       showToast('Pacing optimization: Incremental cuts applied', 'success')
    }

    // 2. Normalize Typography & Brand Colors
    if (styleDNA.preferredFonts.length > 0 || styleDNA.preferredTransitions.length > 0) {
      const brandFont = styleDNA.preferredFonts[0] || 'Inter, sans-serif'
      setTextOverlays(prev => prev.map(o => ({ ...o, fontFamily: brandFont })))
      showToast('Stylistic drift corrected: Brand fonts applied', 'success')
    }

    captureShadowTelemetry()
  }, [styleDNA, timelineSegments.length, setTextOverlays, captureShadowTelemetry, showToast])

  // --- Mock Multiplayer Presence Data ---
  const mockCollaborators = [
     { id: '1', name: 'Sarah J.', role: 'Lead Editor', avatar: 'SJ', color: 'bg-emerald-500', status: 'Editing A-Roll' },
     { id: '2', name: 'Mike T.', role: 'Sound Design', avatar: 'MT', color: 'bg-orange-500', status: 'Tweaking Audio Levels' },
     { id: '3', name: 'Client_Acme', role: 'Reviewer', avatar: 'A', color: 'bg-indigo-500', status: 'Viewing' }
  ]

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
             url: '/whop-logo-placeholder.png', // Replace with dynamic profile logo URL
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

    showToast(`Neural DNA Protocol Deployed: ${profile.name} (Pacing: ${neuralPacing.toFixed(1)}s)`, 'success')
  }, [showToast, setCaptionStyle, setVideoFilters, setTextOverlays, videoState.duration, setImageOverlays])



  const handleGenerateClips = useCallback(() => {
    if (!transcript) {
      showToast('Neural transcript required for synthesis', 'error')
      return
    }
    showToast('Synthesizing Stylized Variations...', 'info')

    // V4: Enhanced Stylized Mock Clips
    const mockClips: AutoEditClip[] = [
      {
        id: `clip-trending-${Date.now()}`,
        name: 'Trending Hook (Fast-Paced)',
        segments: [
          {
            id: 'seg-ai-hook-1',
            startTime: 0,
            endTime: 3.5,
            duration: 3.5,
            type: 'video',
            name: 'High-Retention Hook',
            color: '#F43F5E',
            track: 0,
            sourceUrl: '/videos/hook_variation_1_v4.mp4'
          }
        ],
        engagementScore: {
          overall: 96,
          viralPotential: 98,
          hookStrength: 99,
          sentimentDensity: 85,
          trendAlignment: 95,
          retentionHeatmap: Array(20).fill(0).map(() => Math.floor(Math.random() * 20) + 80)
        },
        metadata: {
          titles: {
             curiosityGap: 'This One Secret Changes Everything...',
             seoWinner: 'Neural Excellence in Video Editing',
             minimalist: 'Neural Control'
          },
          description: {
             summary: 'Unlock the neural potential of your content with this one-click strategy.',
             timestamps: [],
             hashtags: ['#viral', '#hacks', '#neural']
          },
          abTestSuggestions: []
        }
      },
      {
        id: `clip-insight-${Date.now()}`,
        name: 'Deep Insight (Educational)',
        segments: [
          {
            id: 'seg-ai-insight-1',
            startTime: 10,
            endTime: 25,
            duration: 15,
            type: 'video',
            name: 'Core Value Proposition',
            color: '#6366F1',
            track: 0,
            sourceUrl: '/videos/educational_variation_v4.mp4'
          }
        ],
        engagementScore: {
          overall: 89,
          viralPotential: 75,
          hookStrength: 82,
          sentimentDensity: 94,
          trendAlignment: 80,
          retentionHeatmap: Array(20).fill(0).map(() => Math.floor(Math.random() * 30) + 60)
        },
        metadata: {
          titles: {
             curiosityGap: 'The Science of Semantic Retention',
             seoWinner: 'AI Semantic Video Mastery',
             minimalist: 'Semantic AI'
          },
          description: {
             summary: 'A deep dive into how AI processes high-authority narrative clusters.',
             timestamps: [],
             hashtags: ['#education', '#science', '#ai']
          },
          abTestSuggestions: []
        }
      },
      {
        id: `clip-story-${Date.now()}`,
        name: 'Viral Storyteller (Narrative)',
        segments: [
          {
            id: 'seg-ai-story-1',
            startTime: 5,
            endTime: 20,
            duration: 15,
            type: 'video',
            name: 'Narrative Arc',
            color: '#8B5CF6',
            track: 0,
            sourceUrl: '/videos/story_variation_v4.mp4'
          }
        ],
        engagementScore: {
          overall: 92,
          viralPotential: 88,
          hookStrength: 90,
          sentimentDensity: 95,
          trendAlignment: 85,
          retentionHeatmap: Array(20).fill(0).map(() => Math.floor(Math.random() * 25) + 75)
        },
        metadata: {
          titles: {
             curiosityGap: 'Why Most Creators Fail (The Narrative Loop)',
             seoWinner: 'Mastering Viral Storytelling',
             minimalist: 'Story Loops'
          },
          description: {
             summary: 'Discover the hidden story structure behind every viral hit.',
             timestamps: [],
             hashtags: ['#storytelling', '#creators', '#growth']
          },
          abTestSuggestions: []
        }
      }
    ]

    setTimeout(() => {
      setAutoEditClips(mockClips)
      showToast('3 Neural Variations Synthesized', 'success')
    }, 2000)
  }, [transcript, showToast])

  const handleForgeMaster = useCallback(async (persona: string) => {
    showToast(`Neural Forge Initiated: Persona ${persona.toUpperCase()}`, 'info')

    // Step 1: Sequential Extraction (Simulation)
    await new Promise(r => setTimeout(r, 1500))
    showToast('Forge: Viral Extraction Syncing...', 'info')

    // Step 2: Apply Style Profile from DNA Vault
    if (styleProfiles.length > 0) {
      const bestMatch = styleProfiles.find(p => (p.name || '').toLowerCase().includes(persona)) || styleProfiles[0]
      handleApplyStyleProfile(bestMatch)
    }

    // Step 3: Trigger Clip Generation & B-Roll Sync
    handleGenerateClips()

    await new Promise(r => setTimeout(r, 2000))
    showToast('✦ Agentic Forge Complete: Master Revision Deployed', 'success')
  }, [showToast, styleProfiles, handleApplyStyleProfile, handleGenerateClips])

  const handleApplyClip = useCallback((clip: AutoEditClip) => {
    showToast(`Applying Neural Pattern: ${clip.name}`, 'success')

    // Update timeline segments if the clip has them
    if (clip.segments && clip.segments.length > 0) {
      setTimelineSegments(clip.segments)
    }

    // Update metadata and engagement score
    setGeneratedMetadata(clip.metadata)
    setEngagementScore(clip.engagementScore)

    // Automatically switch to timeline view to see changes
    setActiveCategory('timeline')
  }, [showToast, setTimelineSegments, setGeneratedMetadata, setEngagementScore, setActiveCategory])

  const processNeuralCommand = useCallback((instruction: string) => {
    if (!instruction.trim()) return

    showToast('Neural Command Received', 'info')
    const lower = String(instruction || '').toLowerCase()

    setTimeout(() => {
      if (lower.includes('title') || lower.includes('metadata')) {
        setGeneratedMetadata(prev => prev ? ({
          ...prev,
          titles: {
            ...prev.titles,
            seoWinner: `AI Optimized: ${prev.titles.seoWinner}`
          }
        }) : null)
        showToast('Metadata Recalibrated', 'success')
      } else if (lower.includes('split') || lower.includes('cut')) {
        showToast('Analyzing optimal cut points...', 'info')
        // Mock split action
      } else if (lower.includes('caption') || lower.includes('overlay')) {
        setTextOverlays(prev => [
          ...prev,
          {
            id: `ai-overlay-${Date.now()}`,
            text: 'NEURAL INSIGHT',
            x: 50, y: 50, fontSize: 40, color: '#ffffff',
            fontFamily: 'Inter, sans-serif',
            startTime: videoState.currentTime,
            endTime: videoState.currentTime + 3,
            style: 'shadow'
          }
        ])
        showToast('Dynamic Overlay Integrated', 'success')
      } else {
        showToast('Neural logic synthesized', 'success')
      }
    }, 1000)
  }, [showToast, videoState.currentTime])

  const handleBeatSync = useCallback(() => {
    if (timelineSegments.length === 0) {
      showToast('No segments to sync', 'error')
      return
    }

    showToast('Neural Beat-Sync: Analyzing Audio Transients...', 'info')

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

    showToast('✦ Neural Beat-Sync: Segments Aligned to Peaks', 'success')
  }, [timelineSegments, showToast, setTimelineSegments])

  const handleUpdateOverlay = useCallback((type: 'text' | 'shape' | 'image', id: string, updates: any) => {
    if (type === 'text') {
      setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'image') {
      setImageOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    } else if (type === 'shape') {
      setShapeOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    }
  }, [])

  const handleSegmentSelect = useCallback((id: string | null, addToSelection?: boolean) => {
    if (addToSelection && id) {
      setSelectedSegmentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    } else {
      setSelectedSegmentIds(id ? [id] : [])
    }
  }, [])

  const handleTimeUpdate = useCallback((t: number) => {
    const snapped = snapToKeyframes
      ? getSnappedTime(t, selectedSegmentId, selectedEffectId, timelineSegments, timelineEffects)
      : t
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
        setContentPanelCollapsed(false)
        setLeftPanelWidth(Math.min(width - 32, 300))
      } else if (width < 1024) {
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setLeftPanelWidth(Math.min(width * 0.5, 340))
      } else if (width < 1280) {
        setSidebarCollapsed(true)
        setPropertiesPanelOpen(false)
        setLeftPanelWidth(Math.min(width * 0.38, 360))
      } else if (width < 1600) {
        setSidebarCollapsed(true)
        setLeftPanelWidth(Math.min(width * 0.32, 400))
      } else {
        setSidebarCollapsed(false)
        setLeftPanelWidth(Math.min(width * 0.28, 420))
      }
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
      name: asset.title || asset.name || 'Asset',
      color: asset.type === 'music' ? '#10B981' : asset.type === 'sfx' ? '#F97316' : '#F59E0B',
      track: trackIndex,
      sourceUrl: asset.url,
    }
    setTimelineSegments((prev: TimelineSegment[]) => [...prev, segment] as any)
    showToast('Asset dropped to timeline', 'success')
  }, [setTimelineSegments, showToast])

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
          name: 'Magic B-Roll',
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
      case 'edit': return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} textOverlays={textOverlays} setTextOverlays={setTextOverlays} shapeOverlays={shapeOverlays} setShapeOverlays={setShapeOverlays} imageOverlays={imageOverlays} setImageOverlays={setImageOverlays} svgOverlays={svgOverlays} setSvgOverlays={setSvgOverlays} gradientOverlays={gradientOverlays} setGradientOverlays={setGradientOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} videoState={videoState} filterStrength={filterStrength} setFilterStrength={setFilterStrength} showBeforeAfter={showBeforeAfter} setShowBeforeAfter={setShowBeforeAfter} compareMode={compareMode} setCompareMode={setCompareMode} videoId={videoId ?? undefined} segmentCount={timelineSegments.length} transcript={transcript} />
      case 'short-clips': return <ShortClipsView videoState={videoState} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} setActiveCategory={setActiveCategory} showToast={showToast} transcript={transcript} />
      case 'growth': return <GrowthInsightsView isOledTheme={true} />
      case 'predict': return <PredictionEngineView timelineSegments={timelineSegments} transcript={transcript} showToast={showToast} />
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
      case 'color': return <ColorGradingView videoFilters={videoFilters} setVideoFilters={setVideoFilters} colorGradeSettings={colorGradeSettings} setColorGradeSettings={setColorGradeSettings} showToast={showToast} />
      case 'timeline': return <AdvancedTimelineView useProfessionalTimeline={useProfessionalTimeline} setUseProfessionalTimeline={setUseProfessionalTimeline} videoState={videoState} setVideoState={setVideoState} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} selectedSegmentId={selectedSegmentId} onSegmentSelect={(id) => setSelectedSegmentIds(id ? [id] : [])} videoUrl={actualVideoUrl || ''} aiSuggestions={aiSuggestions} showAiPreviews={true} showToast={showToast} setActiveCategory={setActiveCategory} />
      case 'assets': return <AssetLibraryView currentTime={videoState.currentTime} videoDuration={videoState.duration} setTimelineSegments={setTimelineSegments} showToast={showToast} myBroll={userAssets.filter(a => a.type === 'broll')} myMusic={userAssets.filter(a => a.type === 'music')} />
      case 'collaborate': return <CollaborateView videoId={videoId || ''} showToast={showToast} />
      case 'effects': return <EffectsView videoState={videoState} setVideoFilters={setVideoFilters} setTextOverlays={setTextOverlays} setActiveCategory={setActiveCategory} showToast={showToast} timelineEffects={timelineEffects} setTimelineEffects={setTimelineEffects} selectedEffectId={selectedEffectId} setSelectedEffectId={setSelectedEffectId} selectedSegmentId={selectedSegmentId} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} onSeek={(t) => setVideoState(prev => ({ ...prev, currentTime: t }))} />
      case 'export': return <ExportView videoId={videoId || ''} videoUrl={actualVideoUrl || ''} textOverlays={textOverlays} shapeOverlays={shapeOverlays} imageOverlays={imageOverlays} gradientOverlays={gradientOverlays} timelineSegments={timelineSegments} videoFilters={videoFilters} videoDuration={videoState.duration} showToast={showToast} setActiveCategory={setActiveCategory} projectName={projectName} />
      case 'ai-analysis': return <AIAssistView videoId={videoId || ''} transcript={transcript} aiSuggestions={aiSuggestions} setAiSuggestions={setAiSuggestions} setActiveCategory={setActiveCategory} showToast={showToast} />
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
          showToast('✦ Hook inserted to timeline at 0:00', 'success')
          setActiveCategory('timeline')
        }}
      />
      case 'thumbnails': return <ThumbnailGeneratorView videoUrl={actualVideoUrl || undefined} videoId={videoId || undefined} showToast={showToast} />
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
              showToast('DNA Node Committed', 'success')
            }}
            onApply={handleApplyStyleProfile}
          />
        }
        return <StyleVaultDashboardView
          profiles={styleProfiles}
          onTrainNew={() => {
            setTuningProfile({
              id: `style-${Date.now()}`,
              name: 'New Neural DNA',
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

      default: return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} textOverlays={textOverlays} setTextOverlays={setTextOverlays} shapeOverlays={shapeOverlays} setShapeOverlays={setShapeOverlays} imageOverlays={imageOverlays} setImageOverlays={setImageOverlays} svgOverlays={svgOverlays} setSvgOverlays={setSvgOverlays} gradientOverlays={gradientOverlays} setGradientOverlays={setGradientOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} videoState={videoState} filterStrength={filterStrength} setFilterStrength={setFilterStrength} showBeforeAfter={showBeforeAfter} setShowBeforeAfter={setShowBeforeAfter} compareMode={compareMode} setCompareMode={setCompareMode} videoId={videoId ?? undefined} segmentCount={timelineSegments.length} transcript={transcript} />
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#020205] text-white overflow-hidden font-['Outfit'] selection:bg-indigo-500/30">

      {/* Background nebula */}
      <motion.div
        animate={{ x: mousePos.x / 100, y: mousePos.y / 100 }}
        className="fixed inset-0 pointer-events-none opacity-30 mix-blend-screen z-0"
      >
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-indigo-500/[0.08] blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[1000px] h-[1000px] bg-indigo-600/[0.05] blur-[200px] rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-screen bg-[#020205]" />
      </motion.div>

      <AchievementSystem />
      <CommandK
        isOpen={commandKOpen}
        onClose={() => setCommandKOpen(false)}
        onExecute={(id) => {
          if (id === 'style-vault') {
            setActiveCategory('style-vault')
            setStyleVaultView('dashboard')
          } else if (id === 'apply-style') {
            // Mock apply first profile
            if (styleProfiles.length > 0) {
              setTuningProfile(styleProfiles[0])
              showToast('Applying Neural Template: ' + styleProfiles[0].name, 'success')
            } else {
              showToast('No trained DNA discovered yet', 'info')
              setActiveCategory('style-vault')
              setStyleVaultView('train')
            }
          } else {
            setActiveCategory(id as EditorCategory)
          }
          showToast(`Neural Command Executed: ${id}`, 'info')
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

        {/* ── Main workspace: HUD → content row → timeline ── */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative pt-[60px]">

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
          />

          {/* Real-time Heatmap - Sticky below HUD or float? Let's place it at the top of the content row */}
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

          {/* ─── Quick-Access Control Strip (below HUD, above content) ─── */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 gap-3 border-b border-white/[0.04]">
            {/* Left: Panel toggle + layout mode pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setContentPanelCollapsed(p => !p)}
                title={contentPanelCollapsed ? 'Show tool panel' : 'Hide tool panel'}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  contentPanelCollapsed
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'
                    : 'bg-white/[0.04] border-white/[0.08] text-slate-500 hover:text-white hover:border-white/20'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:block">{contentPanelCollapsed ? 'Show Panel' : 'Hide Panel'}</span>
              </button>

              {/* Layout mode quick-switch */}
              <div className="flex items-center gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                {(['balanced', 'preview', 'timeline'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateLayout({ focusMode: mode })}
                    title={`${mode} layout`}
                    className={`px-2.5 h-5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                      layoutPrefs.focusMode === mode
                        ? 'bg-white text-black'
                        : 'text-slate-600 hover:text-white'
                    }`}
                  >
                    {mode === 'balanced' ? '⚖' : mode === 'preview' ? '🎬' : '🎵'}
                    <span className="hidden lg:inline ml-1">{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Center: Playback controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVideoState(prev => ({ ...prev, currentTime: Math.max(0, prev.currentTime - 5) }))}
                title="Back 5s"
                className="w-7 h-7 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all text-[9px] font-black"
              >
                ‹5
              </button>
              <button
                onClick={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                title={videoState.isPlaying ? 'Pause' : 'Play'}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 transition-all"
              >
                {videoState.isPlaying
                  ? <div className="flex gap-0.5"><div className="w-1 h-3 bg-white rounded-sm" /><div className="w-1 h-3 bg-white rounded-sm" /></div>
                  : <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white ml-0.5" />}
              </button>
              <button
                onClick={() => setVideoState(prev => ({ ...prev, currentTime: Math.min(prev.duration, prev.currentTime + 5) }))}
                title="Forward 5s"
                className="w-7 h-7 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.08] transition-all text-[9px] font-black"
              >
                5›
              </button>
            </div>

            {/* Right: Props panel + zoom */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPropertiesPanelOpen(p => !p)}
                title={propertiesPanelOpen ? 'Hide Properties' : 'Show Properties'}
                className={`flex items-center gap-2 px-3 h-7 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                  propertiesPanelOpen
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:border-white/20'
                    : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/40'
                }`}
              >
                <span className="hidden sm:block">{propertiesPanelOpen ? 'Hide Props' : 'Show Props'}</span>
                <Layers className="w-3 h-3 rotate-90" />
              </button>
            </div>
          </div>

          {/* ── Content row: tool panel LEFT + video preview RIGHT ── */}
          <div className="flex-1 min-h-0 flex flex-row overflow-hidden gap-4 px-4 pb-4">

            {/* Tool panel — resizable, collapsible */}
            <div
              className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ${
                contentPanelCollapsed || layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline'
                  ? 'opacity-0 pointer-events-none translate-y-full md:translate-y-0 md:w-0'
                  : 'opacity-100 translate-y-0'
              } ${
                viewportWidth < 768
                  ? 'fixed inset-x-0 bottom-0 z-50 h-[70vh] bg-[#020202]/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]'
                  : 'relative'
              }`}
              style={{
                width: viewportWidth < 768 ? '100%' : (contentPanelCollapsed || layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline' ? 0 : clampedLeftPanelWidth),
                minWidth: 0,
                paddingBottom: viewportWidth < 768 ? 'env(safe-area-inset-bottom)' : 0
              }}
            >
              {viewportWidth < 768 && (
                <div
                  className="w-full h-8 flex items-center justify-center cursor-pointer shrink-0"
                  onClick={() => setContentPanelCollapsed(true)}
                >
                  <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>
              )}
              <div className={`glass-neural overflow-hidden flex flex-col h-full border-white/5 shadow-2xl ${viewportWidth < 768 ? 'rounded-none border-none bg-transparent shadow-none' : 'rounded-[2.5rem]'}`}>
                <div className="flex-shrink-0 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className={`flex items-center gap-2 ${viewportWidth < 768 ? 'flex-nowrap overflow-x-auto custom-scrollbar pb-1' : 'flex-wrap'}`}>
                    {WORKFLOW_STEPS.map((step) => (
                      <button
                        key={step.id}
                        onClick={() => setActiveCategory(step.id)}
                        title={`Navigate to ${step.label} section`}
                        className={`px-4 py-2 rounded-xl text-[10px] whitespace-nowrap font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                          activeCategory === step.id
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {visitedWorkflowSteps.has(step.id) && <div className="w-1 h-1 rounded-full bg-current" />}
                        {step.label}
                      </button>
                    ))}
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
              className={`relative overflow-hidden rounded-[2.5rem] glass-neural border-white/5 shadow-2xl ${
                layoutPrefs.focusMode === 'timeline' ? 'min-h-[120px] flex-1' : 'flex-1 min-h-0'
              }`}
            >
              {/* Header bar - Floating overlay style */}
              <div className="absolute top-6 inset-x-8 z-10 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                  <Film className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300">Neural Monitoring</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 rounded-full text-emerald-400 text-[9px] font-bold">
                  <Zap className="w-3 h-3 fill-emerald-400 animate-pulse" />
                  REAL-TIME SYNC
                </div>
              </div>

              {/* Predictive Health HUD - Floating */}
              <HealthDeltaOverlay
                score={engagementScore.overall || 88}
                diversityDelta={12}
                engagementPotential={engagementScore.viralPotential || 94}
              />

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
                  onTimeUpdate={(t: number) => setVideoState(prev => ({ ...prev, currentTime: t }))}
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
                <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 pointer-events-auto">
                  {/* Volume */}
                  <button
                    onClick={() => setVideoState(prev => ({ ...prev, isMuted: !prev.isMuted }))}
                    title={videoState.isMuted ? 'Unmute' : 'Mute'}
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
                    title="Volume"
                  />
                  <div className="w-px h-4 bg-white/10" />
                  {/* Playback speed */}
                  <div className="flex items-center gap-1">
                    {[0.5, 1, 1.5, 2].map(s => (
                      <button
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
            <div className="glass-neural flex-1 min-h-0 rounded-[2.5rem] border-white/5 p-4 flex flex-col gap-3 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
              <div className="flex items-center justify-between gap-4 relative z-10 px-2 flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Neural Engine</span>
                  </div>
                  <div className="h-4 w-px bg-white/10 mx-2" />
                  <span className="text-xl font-black font-mono text-indigo-400 tabular-nums tracking-tighter">
                    {formatTime(videoState.currentTime)} <span className="text-slate-700 mx-1">/</span> {formatTime(videoState.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSnapToKeyframes((prev) => !prev)}
                    title="Toggle neural snapping to keyframes"
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${snapToKeyframes ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5 border border-white/5 text-slate-500 hover:text-white'}`}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                    Neural Snap
                  </button>
                  <div className="flex gap-1.5 p-1 bg-white/[0.03] rounded-2xl border border-white/5">
                    {[0.5, 1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setPlaybackSpeed(s)}
                        title={`Set playback speed to ${s}x`}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${playbackSpeed === s ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
                      >
                        {s}X
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
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
                    onSegmentDeleted={() => showToast('Segment purged', 'info')}
                    trackVisibility={trackVisibility}
                    onTrackVisibilityChange={(trackIndex, visible) => setTrackVisibility((prev) => ({ ...prev, [trackIndex]: visible }))}
                    effects={timelineEffects}
                    onEffectsChange={setTimelineEffects}
                    selectedEffectId={selectedEffectId}
                    onEffectSelect={setSelectedEffectId}
                    onEffectDeleted={() => showToast('Effect purged', 'info')}
                    textOverlays={textOverlays}
                    imageOverlays={imageOverlays}
                    onAssetDrop={handleAssetDrop}
                    transcript={transcript}
                    aiDirectorSuggestions={aiDirectorSuggestions}
                    engagementScore={engagementScore}
                  />
                </div>
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
            onTimeUpdate={(t: number) => setVideoState(prev => ({ ...prev, currentTime: t }))}
            timelineSegments={timelineSegments}
            setTimelineSegments={setTimelineSegments}
            selectedSegmentId={selectedSegmentId}
            transcript={transcript}
          />

          {/* Insights Sidebar (New) */}
          <InsightsSidebar
            score={engagementScore}
            niche={contentNiche}
            onNicheChange={setContentNiche}
            onCaptionStyleChange={(style) => setCaptionStyle(prev => prev ? { ...prev, textStyle: style } : prev)}
            onManualOverride={handleManualOverride}
            onScheduleUpload={handleScheduleUpload}
          />

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

