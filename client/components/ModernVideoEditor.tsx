
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
  MessageSquare as AiIcon
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

import AchievementSystem from './AchievementSystem'
import { useVideoEditorAutosave } from '../hooks/useVideoEditorAutosave'
import { useToast } from '../contexts/ToastContext'
import { VideoFilter, TextOverlay, TimelineSegment, EditorCategory, CaptionStyle, TemplateLayout, TEMPLATE_LAYOUTS } from '../types/editor'
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

  // Shortcuts Hub
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Clinical State Management
  const [videoFilters, setVideoFilters] = useState<VideoFilter>({
    brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
    noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100
  })
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([])
  const [colorGradeSettings, setColorGradeSettings] = useState<any>({})
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle | null>({
    enabled: false,
    size: 'medium',
    font: 'Inter, sans-serif',
    layout: 'bottom-center',
    textStyle: 'default'
  })
  const [templateLayout, setTemplateLayout] = useState<TemplateLayout>('standard')
  const [videoState, setVideoState] = useState({ currentTime: 0, duration: 0, isPlaying: false, volume: 1, isMuted: false })
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // AI Feature State
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<any>(null)
  const [editingWords, setEditingWords] = useState<any[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [showAiPreviews, setShowAiPreviews] = useState(true)
  const [voiceoverText, setVoiceoverText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('alloy')
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false)

  // System Preferences
  const [preferences] = useState({ isOledTheme: true })

  // History Orchestration
  const [history, setHistory] = useState<any[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedoRef = useRef(false)

  const editorState: any = useMemo(() => ({
    videoFilters, textOverlays, timelineSegments, colorGradeSettings, captionStyle, templateLayout,
    playbackSpeed: 1, filterIntensity: 100, showBeforeAfter: false, projectName, videoId: videoId || 'temp-id'
  }), [videoFilters, textOverlays, timelineSegments, colorGradeSettings, captionStyle, templateLayout, projectName, videoId])

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

  // View Orchestration
  const [isLoading, setIsLoading] = useState(false)
  const [useProfessionalTimeline, setUseProfessionalTimeline] = useState(true)

  const getCategoryContent = () => {
    switch (activeCategory) {
      case 'ai-edit': return <EliteAIView videoId={videoId || ''} isTranscribing={isTranscribing} setIsTranscribing={setIsTranscribing} transcript={transcript} setTranscript={setTranscript} editingWords={editingWords} setEditingWords={setEditingWords} aiSuggestions={aiSuggestions} setTimelineSegments={setTimelineSegments} showToast={showToast} />
      case 'edit': return <BasicEditorView videoFilters={videoFilters} setVideoFilters={setVideoFilters} setColorGradeSettings={setColorGradeSettings} setTextOverlays={setTextOverlays} showToast={showToast} setActiveCategory={setActiveCategory} templateLayout={templateLayout} setTemplateLayout={setTemplateLayout} />
      case 'growth': return <GrowthInsightsView isOledTheme={preferences.isOledTheme} />
      case 'automate': return <AutomateView voiceoverText={voiceoverText} setVoiceoverText={setVoiceoverText} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice} isGeneratingVoiceover={isGeneratingVoiceover} setIsGeneratingVoiceover={setIsGeneratingVoiceover} videoId={videoId || ''} showToast={showToast} />
      case 'color': return <ColorGradingView videoFilters={videoFilters} setVideoFilters={setVideoFilters} colorGradeSettings={colorGradeSettings} setColorGradeSettings={setColorGradeSettings} showToast={showToast} />
      case 'timeline': return <AdvancedTimelineView useProfessionalTimeline={useProfessionalTimeline} setUseProfessionalTimeline={setUseProfessionalTimeline} videoState={videoState} setVideoState={setVideoState} timelineSegments={timelineSegments} setTimelineSegments={setTimelineSegments} videoUrl={actualVideoUrl || ''} aiSuggestions={aiSuggestions} showAiPreviews={showAiPreviews} showToast={showToast} />
      case 'assets': return <AssetLibraryView currentTime={videoState.currentTime} videoDuration={videoState.duration} setTimelineSegments={setTimelineSegments} showToast={showToast} />
      case 'collaborate': return <CollaborateView videoId={videoId || ''} showToast={showToast} />
      case 'effects': return <EffectsView videoState={videoState} setVideoFilters={setVideoFilters} setTextOverlays={setTextOverlays} setActiveCategory={setActiveCategory} showToast={showToast} />
      case 'export': return <ExportView videoId={videoId || ''} videoUrl={actualVideoUrl || ''} textOverlays={textOverlays} videoFilters={videoFilters} showToast={showToast} />
      case 'scripts': return <ScriptGeneratorView showToast={showToast} />
      case 'scheduling': return <SchedulingView showToast={showToast} />
      case 'intelligence':
      case 'accounts':
      case 'remix':
        return <SocialVaultView category={activeCategory} currentTime={videoState.currentTime} videoId={videoId || ''} setActiveCategory={setActiveCategory} showToast={showToast} />
      default: return null
    }
  }

  if (!actualVideoUrl && !isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Video className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Video Loaded</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Please provide a video URL to start editing.</p>
          <button onClick={() => window.location.href = '/dashboard/video'} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">Go to Videos</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex overflow-hidden transition-colors ${preferences.isOledTheme ? 'bg-black text-white' : 'bg-slate-50 text-slate-900 dark:bg-gray-900 dark:text-white'}`}>
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
        />

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Improved responsive layout with better breakpoints and spacing */}
            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden p-3 lg:p-5 gap-3 lg:gap-5">
              {/* Content Panel - Improved flex behavior */}
              <div className={`flex-1 flex flex-col transition-all duration-500 overflow-hidden min-w-0 ${contentPanelCollapsed ? 'flex-[0.0001] opacity-0' : 'flex-1'}`}>
                <div className="flex-1 bg-white dark:bg-gray-800/50 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
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

              {/* Video Preview - Improved responsive sizing */}
              <div className="w-full xl:w-[480px] 2xl:w-[600px] flex shrink-0">
                <RealTimeVideoPreview
                  videoUrl={actualVideoUrl || ''}
                  currentTime={videoState.currentTime}
                  isPlaying={videoState.isPlaying}
                  volume={videoState.volume}
                  isMuted={videoState.isMuted}
                  playbackSpeed={playbackSpeed}
                  filters={videoFilters}
                  textOverlays={textOverlays}
                  editingWords={editingWords}
                  captionStyle={captionStyle}
                  templateLayout={templateLayout}
                  onTimeUpdate={(t: number) => setVideoState(prev => ({ ...prev, currentTime: t }))}
                  onDurationChange={(d: number) => setVideoState(prev => ({ ...prev, duration: d }))}
                  onPlayPause={() => setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                />
              </div>
            </div>

            {/* Timeline Section - Improved spacing and sizing */}
            <div className="h-[30%] min-h-[220px] max-h-[300px] px-3 lg:px-5 pb-3 lg:pb-5 shrink-0 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Speed</span>
                <div className="flex gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        playbackSpeed === s
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                  segments={timelineSegments}
                  onTimeUpdate={(t: number) => setVideoState(prev => ({ ...prev, currentTime: t }))}
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
