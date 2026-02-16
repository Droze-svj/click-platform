
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Download,
  Video,
  Cpu,
  Smartphone,
  Upload as UploadCloudIcon,
  Edit as EditToolIcon,
  Layers as LayersIcon,
  Search,
  MessageSquare as AiIcon,
  Film,
  List
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Clinical Utilities
import { getStatusColor } from '../utils/editorUtils'
import { CATEGORIES } from '../utils/editorConstants'

// Contextual Components
import { EditorHeader } from './editor/EditorHeader'
import { EditorSidebar } from './editor/EditorSidebar'
import { PropertiesPanel } from './editor/PropertiesPanel'
import RealTimeVideoPreview from './editor/RealTimeVideoPreview'
import ResizableTimeline from './editor/ResizableTimeline'
import CommandK from './editor/CommandK'
import AiAssistant from './editor/AiAssistant'

// Specialized Views
import EliteAIView from './editor/views/EliteAIView'
import GrowthInsightsView from './editor/views/GrowthInsightsView'
import SocialVaultView from './editor/views/SocialVaultView'
import AutomateView from './editor/views/AutomateView'
import ColorGradingView from './editor/views/ColorGradingView'
import AdvancedTimelineView from './editor/views/AdvancedTimelineView'
import AssetLibraryView from './editor/views/AssetLibraryView'
import CollaborateView from './editor/views/CollaborateView'
import EffectsView from './editor/views/EffectsView'
import ExportView from './editor/views/ExportView'
import BasicEditorView from './editor/views/BasicEditorView'
import ScriptGeneratorView from './editor/views/ScriptGeneratorView'
import SchedulingView from './editor/views/SchedulingView'
import ShortClipsView from './editor/views/ShortClipsView'
import SettingsView from './editor/views/SettingsView'
import ChromakeyView, { ChromaKeySettings } from './editor/views/ChromakeyView'
import VisualFXView from './editor/views/VisualFXView'
import AIAnalysisView from './editor/views/AIAnalysisView'
import AIAssistView from './editor/views/AIAssistView'

import AchievementSystem from './AchievementSystem'
import { useVideoEditorAutosave } from '../hooks/useVideoEditorAutosave'
import { useToast } from '../contexts/ToastContext'
import { VideoFilter, TextOverlay, TimelineSegment, TimelineEffect, EditorCategory, CaptionStyle, TemplateLayout, TEMPLATE_LAYOUTS, ShapeOverlay, ImageOverlay, GradientOverlay } from '../types/editor'
import { formatTime } from '../utils/editorUtils'

const NEUTRAL_FILTER: VideoFilter = {
  brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
  noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100
}

const LAYOUT_STORAGE_KEY = 'click-editor-layout'
const TRACK_VISIBILITY_KEY = 'click-editor-track-visibility'
import type { EditorLayoutPreferences, PreviewSize } from '../types/editor'

const DEFAULT_LAYOUT: EditorLayoutPreferences = {
  previewSize: 'auto', // auto-adjust based on viewport so everything stays visible
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

import KeyboardShortcutsHelp from './editor/KeyboardShortcutsHelp'

const ModernVideoEditor: React.FC<{ videoUrl?: string; videoPath?: string; videoId?: string }> = ({ videoUrl, videoPath, videoId }) => {
  const { showToast } = useToast()
  const actualVideoUrl = videoUrl || videoPath

  // High-Level Orchestration State
  const [activeCategory, setActiveCategory] = useState<EditorCategory>('ai-edit')
  const [projectName, setProjectName] = useState('Untitled Project')
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true)
  const [contentPanelCollapsed, setContentPanelCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Elite V3 UI State
  const [commandKOpen, setCommandKOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Clinical State Management
  const [videoFilters, setVideoFilters] = useState<VideoFilter>({
    brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
    noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100
  })
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [shapeOverlays, setShapeOverlays] = useState<ShapeOverlay[]>([])
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([])
  const [gradientOverlays, setGradientOverlays] = useState<GradientOverlay[]>([])
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [timelineEffects, setTimelineEffects] = useState<TimelineEffect[]>([])
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null)
  const [trackVisibility, setTrackVisibility] = useState<Record<number, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(TRACK_VISIBILITY_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, boolean>
      const out: Record<number, boolean> = {}
      Object.keys(parsed).forEach((k) => { out[Number(k)] = parsed[k] })
      return out
    } catch { return {} }
  })
  const [colorGradeSettings, setColorGradeSettings] = useState<any>({})
  const [chromaKey, setChromaKey] = useState<ChromaKeySettings>({
    enabled: false,
    color: '#00ff00',
    tolerance: 40,
    spill: 50,
    edge: 25,
    opacity: 100,
  })
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle | null>({
    enabled: true,
    size: 'medium',
    font: 'Inter, sans-serif',
    layout: 'bottom-center',
    textStyle: 'default'
  })
  const [templateLayout, setTemplateLayout] = useState<TemplateLayout>('standard')
  const [videoState, setVideoState] = useState({ currentTime: 0, duration: 0, isPlaying: false, volume: 1, isMuted: false })
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [filterStrength, setFilterStrength] = useState(100)
  const [showBeforeAfter, setShowBeforeAfter] = useState(true)
  const [compareMode, setCompareMode] = useState<'after' | 'before' | 'split'>('after')

  // Adaptable layout (persisted) — only once; must be before Shortcuts Hub so updateLayout is in scope
  const [layoutPrefs, setLayoutPrefs] = useState<EditorLayoutPreferences>(loadLayoutPreferences)
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutPrefs))
  }, [layoutPrefs])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(TRACK_VISIBILITY_KEY, JSON.stringify(trackVisibility))
  }, [trackVisibility])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const fn = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  const updateLayout = useCallback((patch: Partial<EditorLayoutPreferences>) => {
    setLayoutPrefs((p) => ({ ...p, ...patch }))
  }, [])

  // Auto-adjust preview size based on viewport when layoutPrefs.previewSize === 'auto'
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = () => setViewportWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const effectivePreviewSize: Exclude<PreviewSize, 'auto'> = layoutPrefs.previewSize === 'auto'
    ? (viewportWidth < 1200 ? 'small' : viewportWidth < 1500 ? 'medium' : viewportWidth < 1800 ? 'large' : 'fill')
    : layoutPrefs.previewSize

  // Shortcuts Hub (after all state used in handlers)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target?.closest?.('input, textarea, [contenteditable="true"]')
      if (!inInput && (e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        updateLayout({ focusMode: 'preview' })
        return
      }
      if (!inInput && (e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        updateLayout({ focusMode: 'timeline' })
        return
      }
      if (!inInput && (e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        updateLayout({ focusMode: 'balanced' })
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandKOpen(prev => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setAssistantOpen(prev => !prev)
      }
      if (e.key === '?') {
        setShowKeyboardHelp(prev => !prev)
      }
      if (activeCategory === 'edit') {
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
          e.preventDefault()
          setVideoFilters(NEUTRAL_FILTER)
          setFilterStrength(100)
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
          e.preventDefault()
          const idx = TEMPLATE_LAYOUTS.findIndex((l) => l.id === templateLayout)
          if (idx > 0) setTemplateLayout(TEMPLATE_LAYOUTS[idx - 1].id)
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
          e.preventDefault()
          const nextIdx = TEMPLATE_LAYOUTS.findIndex((l) => l.id === templateLayout)
          if (nextIdx >= 0 && nextIdx < TEMPLATE_LAYOUTS.length - 1) setTemplateLayout(TEMPLATE_LAYOUTS[nextIdx + 1].id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeCategory, templateLayout, updateLayout])

  // AI Feature State
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<any>(null)
  const [editingWords, setEditingWords] = useState<any[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [showAiPreviews, setShowAiPreviews] = useState(true)
  const [voiceoverText, setVoiceoverText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('alloy')
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)

  // System Preferences (layout state is above — do not duplicate layoutPrefs/updateLayout here)
  const [preferences] = useState({ isOledTheme: true })

  // History Orchestration
  const [history, setHistory] = useState<any[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedoRef = useRef(false)

  const neutralFilter: VideoFilter = useMemo(() => ({
    brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
    noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100
  }), [])

  const effectiveFilters: VideoFilter = useMemo(() => {
    const s = filterStrength / 100
    const out = { ...videoFilters }
      ; (Object.keys(neutralFilter) as (keyof VideoFilter)[]).forEach((k) => {
        const n = neutralFilter[k] as number
        const v = videoFilters[k] as number
        if (typeof n === 'number' && typeof v === 'number') (out as any)[k] = Math.round(n + (v - n) * s)
      })
    return out
  }, [videoFilters, filterStrength, neutralFilter])

  const editorState: any = useMemo(() => ({
    videoFilters, textOverlays, timelineSegments, colorGradeSettings, captionStyle, templateLayout,
    playbackSpeed: 1, filterStrength, showBeforeAfter, projectName, videoId: videoId || 'temp-id'
  }), [videoFilters, textOverlays, timelineSegments, colorGradeSettings, captionStyle, templateLayout, filterStrength, showBeforeAfter, projectName, videoId])

  const { autosaveStatus, loadSavedState, getStatusIcon, retrySave, manualSave } = useVideoEditorAutosave({
    state: editorState,
    videoId,
    name: projectName,
    enabled: true,
    debounceMs: 2500
  })

  // Clinical Logic Layer
  useEffect(() => {
    if (!videoId) return
    try {
      const saved = loadSavedState()
      if (saved && saved.videoId === videoId) {
        if (saved.videoFilters) setVideoFilters((prev) => ({ ...prev, ...saved.videoFilters }))
        if (saved.textOverlays) setTextOverlays(saved.textOverlays)
        if (saved.timelineSegments) setTimelineSegments(saved.timelineSegments)
        if (saved.projectName) setProjectName(saved.projectName)
        if (saved.colorGradeSettings) setColorGradeSettings(saved.colorGradeSettings)
        if (saved.captionStyle && typeof saved.captionStyle === 'object') setCaptionStyle(saved.captionStyle)
        if (saved.templateLayout && TEMPLATE_LAYOUTS.some((t) => t.id === saved.templateLayout)) setTemplateLayout(saved.templateLayout)
        showToast('Work restored', 'success')
      }
    } catch (e) {
      console.error('Restoration failed', e)
    }
  }, [videoId, loadSavedState, showToast])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const target = e.target as HTMLElement
        if (target.closest('input, textarea, [contenteditable="true"]')) return
        manualSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manualSave])

  useEffect(() => {
    if (isUndoRedoRef.current) return
    const snapshot = JSON.parse(JSON.stringify({ textOverlays, videoFilters }))
    const timeoutId = setTimeout(() => {
      setHistory(prev => [...prev.slice(0, historyIndex + 1), snapshot].slice(-50))
      setHistoryIndex(prev => Math.min(prev + 1, 49))
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [textOverlays, videoFilters, historyIndex])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true
      const s = history[historyIndex - 1]
      setTextOverlays(s.textOverlays); setVideoFilters(s.videoFilters)
      setHistoryIndex(i => i - 1)
      setTimeout(() => isUndoRedoRef.current = false, 100)
    }
  }, [history, historyIndex])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true
      const s = history[historyIndex + 1]
      setTextOverlays(s.textOverlays); setVideoFilters(s.videoFilters)
      setHistoryIndex(i => i + 1)
      setTimeout(() => isUndoRedoRef.current = false, 100)
    }
  }, [history, historyIndex])

  // Undo/Redo keyboard shortcuts (must run after handleUndo/handleRedo are defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = target?.closest?.('input, textarea, [contenteditable="true"]')
      if (inInput) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // View Orchestration
  const [isLoading, setIsLoading] = useState(false)
  const [useProfessionalTimeline, setUseProfessionalTimeline] = useState(true)

  const getCategoryContent = () => {
    switch (activeCategory) {
      case 'ai-edit': return <EliteAIView videoId={videoId || ''} isTranscribing={isTranscribing} setIsTranscribing={setIsTranscribing} transcript={transcript} setTranscript={setTranscript} editingWords={editingWords} setEditingWords={setEditingWords} aiSuggestions={aiSuggestions} setTimelineSegments={setTimelineSegments} showToast={showToast} setActiveCategory={setActiveCategory} setTextOverlays={setTextOverlays} />
      case 'edit': return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} textOverlays={textOverlays} setTextOverlays={setTextOverlays} shapeOverlays={shapeOverlays} setShapeOverlays={setShapeOverlays} imageOverlays={imageOverlays} setImageOverlays={setImageOverlays} gradientOverlays={gradientOverlays} setGradientOverlays={setGradientOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} videoState={videoState} filterStrength={filterStrength} setFilterStrength={setFilterStrength} showBeforeAfter={showBeforeAfter} setShowBeforeAfter={setShowBeforeAfter} compareMode={compareMode} setCompareMode={setCompareMode} />
      case 'short-clips': return <ShortClipsView videoState={videoState} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'growth': return <GrowthInsightsView isOledTheme={preferences.isOledTheme} />
      case 'automate': return <AutomateView voiceoverText={voiceoverText} setVoiceoverText={setVoiceoverText} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice} isGeneratingVoiceover={isGeneratingVoiceover} setIsGeneratingVoiceover={setIsGeneratingVoiceover} videoId={videoId || ''} showToast={showToast} />
      case 'color': return <ColorGradingView videoFilters={videoFilters} setVideoFilters={setVideoFilters} colorGradeSettings={colorGradeSettings} setColorGradeSettings={setColorGradeSettings} showToast={showToast} />
      case 'timeline': return <AdvancedTimelineView useProfessionalTimeline={useProfessionalTimeline} setUseProfessionalTimeline={setUseProfessionalTimeline} videoState={videoState} setVideoState={setVideoState} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} selectedSegmentId={selectedSegmentId} onSegmentSelect={setSelectedSegmentId} videoUrl={actualVideoUrl || ''} aiSuggestions={aiSuggestions} showAiPreviews={showAiPreviews} showToast={showToast} />
      case 'assets': return <AssetLibraryView currentTime={videoState.currentTime} videoDuration={videoState.duration} setTimelineSegments={setTimelineSegments} showToast={showToast} />
      case 'collaborate': return <CollaborateView videoId={videoId || ''} showToast={showToast} />
      case 'effects': return <EffectsView videoState={videoState} setVideoFilters={setVideoFilters} setTextOverlays={setTextOverlays} setActiveCategory={setActiveCategory} showToast={showToast} timelineEffects={timelineEffects} setTimelineEffects={setTimelineEffects} selectedEffectId={selectedEffectId} setSelectedEffectId={setSelectedEffectId} />
      case 'export': return <ExportView videoId={videoId || ''} videoUrl={actualVideoUrl || ''} textOverlays={textOverlays} shapeOverlays={shapeOverlays} imageOverlays={imageOverlays} gradientOverlays={gradientOverlays} timelineSegments={timelineSegments} videoFilters={videoFilters} showToast={showToast} />
      case 'scripts': return <ScriptGeneratorView showToast={showToast} />
      case 'scheduling': return <SchedulingView showToast={showToast} />
      case 'intelligence':
      case 'accounts':
      case 'remix':
        return <SocialVaultView category={activeCategory} currentTime={videoState.currentTime} videoId={videoId || ''} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'settings':
        return <SettingsView layoutPrefs={layoutPrefs} onLayoutChange={updateLayout} setShowKeyboardHelp={() => setShowKeyboardHelp(true)} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'chromakey':
        return <ChromakeyView chromaKey={chromaKey} setChromaKey={setChromaKey} showToast={showToast} />
      case 'visual-fx':
        return <VisualFXView videoState={videoState} timelineEffects={timelineEffects} setTimelineEffects={setTimelineEffects} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'ai-analysis':
        return <AIAnalysisView videoId={videoId || ''} videoDuration={videoState.duration} currentTime={videoState.currentTime} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'ai':
        return <AIAssistView setActiveCategory={setActiveCategory} showToast={showToast} />
      default:
        return (
          <div className="rounded-2xl border border-subtle bg-surface-card p-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-accent-violet mx-auto mb-4 flex items-center justify-center">
              <EditToolIcon className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Coming soon</h3>
            <p className="text-sm text-theme-secondary max-w-sm mx-auto">
              This tool is in development. Use Edit, Color, Effects, Timeline, or Export in the meantime.
            </p>
          </div>
        )
    }
  }

  if (!actualVideoUrl && !isLoading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full bg-surface-card rounded-2xl border border-subtle shadow-theme-card p-8 sm:p-10">
          <div className="w-16 h-16 bg-accent-violet rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-theme-primary mb-2">No video loaded</h2>
          <p className="text-theme-secondary mb-6 leading-relaxed">Open a video from the library to start editing.</p>
          <button
            onClick={() => window.location.href = '/dashboard/video'}
            className="inline-flex items-center gap-2 bg-accent-violet hover:opacity-90 text-white px-6 py-3 rounded-xl font-semibold shadow-theme-card transition-all"
          >
            Go to videos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex overflow-hidden transition-colors ${preferences.isOledTheme ? 'bg-black text-white' : 'bg-surface-page text-theme-primary'} ${reduceMotion ? 'reduce-motion-editor' : ''}`} data-reduce-motion={reduceMotion}>
      <AchievementSystem />

      <CommandK
        isOpen={commandKOpen}
        onClose={() => setCommandKOpen(false)}
        onExecute={(id) => {
          setActiveCategory(id as EditorCategory)
          showToast(`Executing command: ${id}`, 'info')
        }}
      />

      <AiAssistant
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />

      <EditorSidebar
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        isOledTheme={preferences.isOledTheme}
        deviceView={deviceView}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        videoDuration={videoState.duration}
      />

      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <EditorHeader
          activeCategory={activeCategory}
          projectName={projectName}
          setProjectName={setProjectName}
          videoId={videoId || ''}
          autosaveStatus={autosaveStatus}
          getStatusIcon={getStatusIcon}
          retrySave={retrySave}
          isOledTheme={preferences.isOledTheme}
          historyIndex={historyIndex}
          historyLength={history.length}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          setShowKeyboardHelp={setShowKeyboardHelp}
          contentPanelCollapsed={contentPanelCollapsed}
          setContentPanelCollapsed={setContentPanelCollapsed}
          featuresCount={CATEGORIES.find(c => c.id === activeCategory)?.features?.length || 0}
          layoutPrefs={layoutPrefs}
          onLayoutChange={updateLayout}
          defaultLayout={DEFAULT_LAYOUT}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Adaptable layout: focus mode can hide content panel; preview size and timeline density applied below */}
            <div className={`flex-1 flex flex-col xl:flex-row overflow-hidden gap-3 lg:gap-5 ${layoutPrefs.focusMode === 'preview' ? 'p-2 lg:p-3' : 'p-3 lg:p-5'} ${reduceMotion ? 'transition-none' : 'transition-all duration-300'} ${layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline' ? 'content-panel-hidden' : ''}`}>
              {/* Content Panel - fixed width on xl so preview column gets all remaining space */}
              <div className={`flex flex-col transition-all duration-500 overflow-hidden min-w-0 ${contentPanelCollapsed || layoutPrefs.focusMode === 'preview' || layoutPrefs.focusMode === 'timeline' ? 'flex-[0.0001] opacity-0 pointer-events-none xl:max-w-0' : 'flex-1 xl:flex-none xl:w-[400px] xl:max-w-[400px]'}`}>
                <div className="flex-1 bg-surface-card rounded-2xl shadow-theme-card border border-subtle overflow-hidden flex flex-col">
                  <div className="editor-auto flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar min-w-0">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeCategory}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                      >
                        {getCategoryContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Video Preview - size from effectivePreviewSize (auto = viewport-based); fill uses all space */}
              <div className={`flex-1 flex min-w-0 w-full overflow-hidden ${reduceMotion ? '' : 'transition-all duration-300'} ${layoutPrefs.focusMode === 'preview' ? 'min-h-[55vh] xl:min-h-[65vh]' : 'min-h-[460px] xl:min-h-[540px]'} ${effectivePreviewSize !== 'fill' ? 'justify-center' : ''}`}>
                <div className={`h-full min-h-0 flex flex-col rounded-2xl overflow-hidden border border-subtle bg-surface-elevated shadow-theme-card ${effectivePreviewSize === 'small' ? 'w-full max-w-[640px]' : effectivePreviewSize === 'medium' ? 'w-full max-w-[800px]' : effectivePreviewSize === 'large' ? 'w-full max-w-[1000px]' : 'w-full min-w-0'}`}>
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-subtle bg-surface-card shrink-0">
                    <Film className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Preview</span>
                  </div>
                  <div className="relative flex-1 min-h-0 min-w-0 w-full" style={{ minHeight: 320 }}>
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
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Section - density from layout: compact 180, comfortable 240, expanded 320 */}
            <div className={`shrink-0 flex flex-col gap-2 min-w-0 px-3 lg:px-5 pb-3 lg:pb-5 ${reduceMotion ? 'transition-none' : 'transition-all duration-300'} ${layoutPrefs.timelineDensity === 'compact' ? 'min-h-[180px] max-h-[240px] h-[28%]' : layoutPrefs.timelineDensity === 'expanded' ? 'min-h-[280px] max-h-[380px] h-[38%]' : 'min-h-[220px] max-h-[300px] h-[30%]'} ${layoutPrefs.focusMode === 'timeline' ? 'min-h-[320px] max-h-[50vh] flex-1' : ''}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-theme-muted" />
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Timeline</span>
                  </div>
                  <span className="text-xs font-mono text-theme-muted tabular-nums" title="Current / Duration">
                    {formatTime(videoState.currentTime)} <span className="opacity-80">/</span> {formatTime(videoState.duration)}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${playbackSpeed === s
                        ? 'bg-accent-violet text-white'
                        : 'bg-surface-card border border-subtle text-theme-secondary hover:bg-surface-card-hover'
                        }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResizableTimeline
                  duration={videoState.duration}
                  currentTime={videoState.currentTime}
                  isPlaying={videoState.isPlaying}
                  onPlayPause={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                  density={layoutPrefs.timelineDensity}
                  segments={timelineSegments}
                  onTimeUpdate={(t: number) => setVideoState(prev => ({ ...prev, currentTime: t }))}
                  onSegmentsChange={setTimelineSegments}
                  selectedSegmentId={selectedSegmentId}
                  onSegmentSelect={setSelectedSegmentId}
                  onSegmentDeleted={() => showToast('Segment removed', 'info')}
                  trackVisibility={trackVisibility}
                  onTrackVisibilityChange={(trackIndex, visible) => setTrackVisibility((prev) => ({ ...prev, [trackIndex]: visible }))}
                  onDuplicateSegmentAtPlayhead={(segmentId) => {
                    const seg = timelineSegments.find((s) => s.id === segmentId)
                    if (!seg) return
                    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
                    const segDur = seg.endTime - seg.startTime
                    const newSeg: TimelineSegment = {
                      ...seg,
                      id: newId,
                      startTime: seg.endTime,
                      endTime: seg.endTime + segDur,
                      duration: segDur,
                      name: `${seg.name} (copy)`
                    }
                    setTimelineSegments((prev) =>
                      prev.flatMap((s) => {
                        if (s.id === segmentId) return [s, newSeg]
                        if (s.startTime >= seg.endTime) {
                          return [{ ...s, startTime: s.startTime + segDur, endTime: s.endTime + segDur }]
                        }
                        return [s]
                      })
                    )
                    setSelectedSegmentId(newId)
                    showToast('Segment duplicated', 'success')
                  }}
                  effects={timelineEffects}
                  onEffectsChange={setTimelineEffects}
                  selectedEffectId={selectedEffectId}
                  onEffectSelect={setSelectedEffectId}
                  onEffectDeleted={() => showToast('Effect removed', 'info')}
                  textOverlays={textOverlays}
                  imageOverlays={imageOverlays}
                />
              </div>
            </div>
          </div>

          <PropertiesPanel
            isOpen={propertiesPanelOpen}
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
            isOledTheme={preferences.isOledTheme}
          />
        </div>
      </main>

      {showKeyboardHelp && (
        <KeyboardShortcutsHelp
          shortcuts={[]}
          onClose={() => setShowKeyboardHelp(false)}
        />
      )}

      {/* Neural Interface Overlays */}
      <div className="fixed bottom-4 left-20 z-50 flex items-center gap-2">
        <button
          onClick={() => setCommandKOpen(true)}
          className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white/40 hover:text-white hover:bg-white/20 transition-all group"
          title="Command Palette (Ctrl+K)"
        >
          <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
        <button
          onClick={() => setAssistantOpen(true)}
          className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white/40 hover:text-white hover:bg-white/20 transition-all group"
          title="AI Assistant (Ctrl+J)"
        >
          <AiIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  )
}

export default ModernVideoEditor
