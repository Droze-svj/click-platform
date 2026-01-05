'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Download,
  Eye,
  EyeOff,
  Type,
  Palette,
  Music,
  Volume2,
  Zap,
  Crop,
  Split,
  Merge,
  Wand2,
  Filter,
  Sliders,
  Image as ImageIcon,
  Mic,
  Speaker,
  Layers,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Monitor,
  Smartphone,
  Tablet,
  Edit3,
  Video,
  Share,
  Brain
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import AdvancedColorGrading from './AdvancedColorGrading'
import ChromaKey from './ChromaKey'
import KeyboardShortcuts, { createVideoEditorShortcuts, KeyboardShortcutsHelp } from './KeyboardShortcuts'
import VideoEditingTemplates from './VideoEditingTemplates'
import FlowOptimizer from './FlowOptimizer'
import { errorHandler, logReactError } from '../utils/errorHandler'
import {
  EditToolIcon,
  MagicEffectsIcon,
  ColorPaletteIcon,
  MagicWandIcon,
  MagicEffectsIcon as VisualFXIcon,
  NeuralNetworkIcon,
  CollaborationIcon,
  LayersIcon,
  UploadCloudIcon
} from './icons/VideoIcons'
import AISceneDetection from './AISceneDetection'
import AdvancedVisualEffects from './AdvancedVisualEffects'
import CollaborativeEditing from './CollaborativeEditing'
import RealTimeVideoPreview from './RealTimeVideoPreview'
import VideoTemplates from './VideoTemplates'
import AIContentAnalysis from './AIContentAnalysis'
import AdvancedVideoTimeline from './AdvancedVideoTimeline'
import SocialMediaExporter from './SocialMediaExporter'

interface VideoEditorProps {
  videoId?: string
  videoUrl?: string
  videoPath?: string
  onExport?: (result: any) => void
}

interface VideoState {
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
}

interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  startTime: number
  endTime: number
}

interface VideoFilter {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  blur: number
  sepia: number
  vignette: number
  sharpen: number
  noise: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  clarity: number
  dehaze: number
}

export default function ModernVideoEditor({ videoId, videoUrl, videoPath, onExport }: VideoEditorProps) {

  // UI State Management
  const [activeCategory, setActiveCategory] = useState<'edit' | 'effects' | 'timeline' | 'export' | 'ai' | 'color' | 'chromakey' | 'visual-fx' | 'ai-analysis' | 'collaborate'>('edit')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true)
  const [timelineCollapsed, setTimelineCollapsed] = useState(false)
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Flow tracking state
  const [sessionStartTime, setSessionStartTime] = useState(Date.now())
  const [userActions, setUserActions] = useState<Array<{action: string, timestamp: number, data: any}>>([])
  const [currentWorkflow, setCurrentWorkflow] = useState<string | null>(null)
  const [lastInteraction, setLastInteraction] = useState(Date.now())

  // Video State
  const [videoState, setVideoState] = useState<VideoState>({
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
  })

  // Editor Content State
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [videoFilters, setVideoFilters] = useState<VideoFilter>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0,
    vignette: 0,
    sharpen: 0,
    noise: 0,
    temperature: 100,
    tint: 0,
    highlights: 0,
    shadows: 0,
    clarity: 0,
    dehaze: 0
  })
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  // Advanced Features State
  const [colorGradeSettings, setColorGradeSettings] = useState({})
  const [chromaKeySettings, setChromaKeySettings] = useState({
    keyColor: { r: 0, g: 255, b: 0 },
    similarity: 50,
    smoothness: 10,
    spillSuppression: 50,
    edgeFeather: 5,
    despillBalance: 50,
    matteBlur: 2,
    enable: false
  })
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right'>('right')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  // Timeline State
  const [timelineSegments, setTimelineSegments] = useState<Array<{
    id: string
    startTime: number
    endTime: number
    duration: number
    type: 'video' | 'audio' | 'text' | 'transition'
    name: string
    color: string
    track: number
    properties?: any
  }>>([])

  const { showToast } = useToast()

  // Navigation categories with modern design and realistic icons
  const categories = [
    {
      id: 'edit',
      label: 'Edit',
      icon: EditToolIcon,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-300',
      description: 'Basic editing tools',
      features: ['Trim', 'Crop', 'Rotate', 'Split']
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: MagicEffectsIcon,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-700 dark:text-purple-300',
      description: 'Filters & enhancements',
      features: ['Filters', 'Text', 'Transitions', 'Audio']
    },
    {
      id: 'color',
      label: 'Color',
      icon: ColorPaletteIcon,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      textColor: 'text-indigo-700 dark:text-indigo-300',
      description: 'Professional color grading',
      features: ['Curves', 'Color Wheels', 'LUTs', 'Scopes']
    },
    {
      id: 'chromakey',
      label: 'Chroma Key',
      icon: MagicWandIcon,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      description: 'Green screen & compositing',
      features: ['Key Removal', 'Spill Suppression', 'Edge Refinement']
    },
    {
      id: 'visual-fx',
      label: 'Visual FX',
      icon: VisualFXIcon,
      color: 'from-cyan-500 to-blue-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      textColor: 'text-cyan-700 dark:text-cyan-300',
      description: 'Particle systems & effects',
      features: ['Particles', 'Lens Flares', 'Lights', 'Motion']
    },
    {
      id: 'ai-analysis',
      label: 'AI Analysis',
      icon: NeuralNetworkIcon,
      color: 'from-pink-500 to-purple-500',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      textColor: 'text-pink-700 dark:text-pink-300',
      description: 'Smart scene detection',
      features: ['Scene Detection', 'Auto-Editing', 'Suggestions']
    },
    {
      id: 'collaborate',
      label: 'Collaborate',
      icon: CollaborationIcon,
      color: 'from-green-500 to-teal-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-300',
      description: 'Real-time collaboration',
      features: ['Live Cursors', 'Comments', 'Team Editing']
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: LayersIcon,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      description: 'Advanced editing',
      features: ['Multi-track', 'Keyframes', 'Precision', 'Layers']
    },
    {
      id: 'export',
      label: 'Export',
      icon: UploadCloudIcon,
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-300',
      description: 'Share & export',
      features: ['Social Media', 'Formats', 'Quality', 'Presets']
    }
  ]

  // Detect device type and adjust layout
  useEffect(() => {
    const updateDeviceView = () => {
      const width = window.innerWidth
      if (width < 768) setDeviceView('mobile')
      else if (width < 1024) setDeviceView('tablet')
      else setDeviceView('desktop')
    }

    updateDeviceView()
    window.addEventListener('resize', updateDeviceView)
    return () => window.removeEventListener('resize', updateDeviceView)
  }, [])

  // Flow tracking functions
  const detectWorkflowPattern = useCallback((from: string, to: string): string => {
    const patterns = {
      'edit->effects': 'basic_editing_flow',
      'effects->color': 'enhancement_workflow',
      'color->chromakey': 'compositing_flow',
      'chromakey->visual-fx': 'effects_chain',
      'visual-fx->timeline': 'advanced_editing',
      'timeline->export': 'completion_flow',
      'edit->export': 'quick_edit',
      'ai->timeline': 'ai_assisted_editing',
      'collaborate->timeline': 'team_workflow'
    }

    const key = `${from}->${to}`
    return patterns[key as keyof typeof patterns] || 'exploration'
  }, [])

  const trackUserAction = useCallback((action: string, data: any = {}) => {
    const actionData = {
      action,
      ...data,
      sessionDuration: Date.now() - sessionStartTime,
      activeCategory,
      deviceView,
      hasVideo: !!(videoUrl || videoPath),
      workflowPattern: currentWorkflow
    }

    setUserActions(prev => [...prev.slice(-49), actionData]) // Keep last 50 actions
    setLastInteraction(Date.now())

    // Detect workflow patterns
    if (action === 'category_switched') {
      const pattern = detectWorkflowPattern(data.from, data.to)
      setCurrentWorkflow(pattern)

      // Show loading state for category switches
      setIsLoading(true)
      setLoadingMessage(`Loading ${categories.find(c => c.id === data.to)?.label} tools...`)

      setTimeout(() => {
        setIsLoading(false)
        setLoadingMessage('')
      }, 300)
    }

  }, [sessionStartTime, activeCategory, deviceView, videoUrl, videoPath, currentWorkflow, detectWorkflowPattern, categories])

  // Auto-adjust panels based on device
  useEffect(() => {
    trackUserAction('device_view_changed', { from: deviceView, to: deviceView })

    if (deviceView === 'mobile') {
      setSidebarCollapsed(true)
      setPropertiesPanelOpen(false)
      setTimelineCollapsed(true)
    } else if (deviceView === 'tablet') {
      setSidebarCollapsed(false)
      setPropertiesPanelOpen(true)
      setTimelineCollapsed(false)
    } else {
      setSidebarCollapsed(false)
      setPropertiesPanelOpen(true)
      setTimelineCollapsed(false)
    }
  }, [deviceView, trackUserAction])

  // Handle navigation from FlowOptimizer
  useEffect(() => {
    const handleNavigateToCategory = (event: CustomEvent) => {
      const { category } = event.detail
      const categoryObj = categories.find(c => c.id === category)
      if (categoryObj) {
        setActiveCategory(category as any)
        trackUserAction('flow_navigated', { to: category })
      }
    }

    window.addEventListener('navigateToCategory', handleNavigateToCategory as EventListener)
    return () => window.removeEventListener('navigateToCategory', handleNavigateToCategory as EventListener)
  }, [categories, trackUserAction])


  // Keyboard shortcuts setup
  const keyboardShortcuts = createVideoEditorShortcuts({
    playPause: () => {
      // Toggle play/pause logic would go here
      showToast('Play/Pause toggled', 'info')
    },
    seekForward: (seconds = 5) => {
      setVideoState(prev => ({
        ...prev,
        currentTime: Math.min(prev.duration, prev.currentTime + seconds)
      }))
    },
    seekBackward: (seconds = 5) => {
      setVideoState(prev => ({
        ...prev,
        currentTime: Math.max(0, prev.currentTime - seconds)
      }))
    },
    skipToStart: () => setVideoState(prev => ({ ...prev, currentTime: 0 })),
    skipToEnd: () => setVideoState(prev => ({ ...prev, currentTime: prev.duration })),
    increaseVolume: () => {
      setVideoState(prev => ({
        ...prev,
        volume: Math.min(1, prev.volume + 0.1)
      }))
    },
    decreaseVolume: () => {
      setVideoState(prev => ({
        ...prev,
        volume: Math.max(0, prev.volume - 0.1)
      }))
    },
    toggleMute: () => {
      setVideoState(prev => ({ ...prev, isMuted: !prev.isMuted }))
    },
    volumeUp: () => {
      setVideoState(prev => ({
        ...prev,
        volume: Math.min(1, prev.volume + 0.1)
      }))
    },
    volumeDown: () => {
      setVideoState(prev => ({
        ...prev,
        volume: Math.max(0, prev.volume - 0.1)
      }))
    },
    fullscreen: () => showToast('Toggle fullscreen', 'info'),
    setPlaybackSpeed: (speed: number) => setPlaybackSpeed(speed),
    addVideoFilter: () => showToast('Video filter added', 'success'),
    addTextOverlay: () => {
      setTextOverlays(prev => [...prev, {
        id: Date.now().toString(),
        text: 'New Text',
        x: 50,
        y: 50,
        fontSize: 24,
        color: '#ffffff',
        fontFamily: 'Arial',
        startTime: videoState.currentTime,
        endTime: videoState.currentTime + 5
      }])
      showToast('Text overlay added', 'success')
    },
    undo: () => showToast('Undo not implemented yet', 'info'),
    redo: () => showToast('Redo not implemented yet', 'info'),
    cut: () => showToast('Cut operation', 'info'),
    copy: () => showToast('Copy operation', 'info'),
    paste: () => showToast('Paste operation', 'info'),
    delete: () => showToast('Delete operation', 'info'),
    selectAll: () => showToast('Select all', 'info'),
    split: () => showToast('Split clip', 'info'),
    zoomIn: () => showToast('Zoom in', 'info'),
    zoomOut: () => showToast('Zoom out', 'info'),
    resetZoom: () => showToast('Reset zoom', 'info'),
    fitToScreen: () => showToast('Fit to screen', 'info'),
    toggleFullscreen: () => showToast('Toggle fullscreen', 'info'),
    exportVideo: () => showToast('Export video', 'info'),
    saveProject: () => showToast('Save project', 'info'),
    newProject: () => showToast('New project', 'info'),
    openProject: () => showToast('Open project', 'info'),
    showKeyboardHelp: () => setShowKeyboardHelp(true)
  })

  // Add keyboard help shortcut
  keyboardShortcuts.push({
    key: '?',
    description: 'Show keyboard shortcuts',
    action: () => setShowKeyboardHelp(true),
    category: 'Help'
  })

  // Helper functions
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getCategoryContent = () => {

    switch (activeCategory) {
      case 'edit':
        return (
          <div className="space-y-6">
            <VideoEditingTemplates
              onApplyTemplate={(template) => {
                // Apply template settings to the editor
                setVideoFilters(prev => ({
                  ...prev,
                  brightness: template.settings.colorGrade.brightness,
                  contrast: template.settings.colorGrade.contrast,
                  saturation: template.settings.colorGrade.saturation,
                  temperature: template.settings.colorGrade.temperature,
                  tint: template.settings.colorGrade.tint,
                  highlights: template.settings.colorGrade.highlights,
                  shadows: template.settings.colorGrade.shadows,
                  clarity: (template.settings.colorGrade as any).clarity || 0,
                  dehaze: (template.settings.colorGrade as any).dehaze || 0
                }))

                // Apply text overlays
                setTextOverlays(template.textOverlays.map(overlay => ({
                  id: `template-${overlay.id}-${Date.now()}`,
                  text: overlay.text,
                  x: overlay.position.x,
                  y: overlay.position.y,
                  fontSize: overlay.fontSize,
                  color: overlay.color,
                  fontFamily: overlay.fontFamily,
                  startTime: overlay.startTime,
                  endTime: overlay.endTime
                })))

                showToast(`"${template.name}" template applied successfully!`, 'success')
              }}
            />
          </div>
        )
      case 'effects':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">Visual Filters</h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">Enhance your video</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                    Brightness & Contrast
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                    Color Correction
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                    Advanced Filters
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Type className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">Text & Titles</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Add overlays & captions</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => setTextOverlays(prev => [...prev, {
                      id: Date.now().toString(),
                      text: 'Your Text Here',
                      x: 50,
                      y: 50,
                      fontSize: 24,
                      color: '#ffffff',
                      fontFamily: 'Arial',
                      startTime: videoState.currentTime,
                      endTime: videoState.currentTime + 5
                    }])}
                    className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    Add Text Overlay
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                    Animated Text
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                    Subtitles
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border border-green-200 dark:border-green-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Audio & Music</h3>
                    <p className="text-sm text-green-700 dark:text-green-300">Enhance sound</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors">
                    Background Music
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors">
                    Voice Enhancement
                  </button>
                  <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors">
                    Audio Effects
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      case 'timeline':
        return (
          <div className="space-y-6">
            <AdvancedVideoTimeline
              duration={videoState.duration || 0}
              currentTime={videoState.currentTime}
              segments={timelineSegments}
              keyframes={[]}
              onTimeUpdate={(time) => {
                setVideoState(prev => ({ ...prev, currentTime: time }))
              }}
              onSegmentUpdate={(segmentId, updates) => {
                setTimelineSegments(prev =>
                  prev.map(seg => seg.id === segmentId ? { ...seg, ...updates } : seg)
                )
              }}
              onSegmentDelete={(segmentId) => {
                setTimelineSegments(prev => prev.filter(seg => seg.id !== segmentId))
                showToast('Segment deleted', 'success')
              }}
              onSegmentAdd={(segment) => {
                const newSegment = {
                  ...segment,
                  id: Date.now().toString()
                }
                setTimelineSegments(prev => [...prev, newSegment])
                showToast(`Added ${segment.type} segment`, 'success')
              }}
              onKeyframeAdd={() => {}}
              onKeyframeUpdate={() => {}}
              onKeyframeDelete={() => {}}
            />
          </div>
        )
      case 'export':
        return (
          <div className="space-y-6">
            {videoUrl ? (
              <SocialMediaExporter
                videoUrl={videoUrl}
                videoId={videoId}
                onExport={(preset, options) => {
                  showToast(`Starting export for ${preset.platform}...`, 'info')
                  console.log('Export config:', { preset, options, textOverlays, videoFilters })
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Please load a video first to access export features.
              </div>
            )}
          </div>
        )
      case 'color':
        return (
          <div className="space-y-6">
            <AdvancedColorGrading
              currentSettings={colorGradeSettings}
              onSettingsChange={setColorGradeSettings}
            />
          </div>
        )
      case 'chromakey':
        return (
          <div className="space-y-6">
            {videoUrl ? (
              <ChromaKey
                videoUrl={videoUrl}
                settings={chromaKeySettings}
                onSettingsChange={setChromaKeySettings}
                onProcessed={(resultUrl) => {
                  showToast('Chroma key processed successfully!', 'success')
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Please load a video first to access chroma key features.
              </div>
            )}
          </div>
        )
      case 'visual-fx':
        return (
          <div className="space-y-6">
            <AdvancedVisualEffects
              onEffectChange={(effects) => {
                // Handle visual effects changes
                showToast('Visual effects updated', 'success')
              }}
            />
          </div>
        )
      case 'ai-analysis':
        return (
          <div className="space-y-6">
            {videoUrl ? (
              <AISceneDetection
                videoUrl={videoUrl}
                onScenesDetected={(scenes) => {
                  showToast(`Detected ${scenes.length} scenes with AI`, 'success')
                }}
                onSuggestedEdit={(edit) => {
                  showToast(`AI suggests: ${edit.suggestion}`, 'info')
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Please load a video first to access AI analysis features.
              </div>
            )}
          </div>
        )
      case 'collaborate':
        return (
          <div className="space-y-6">
            <CollaborativeEditing
              sessionId={`session-${videoId}`}
              currentUser={{
                id: 'user-1',
                name: 'You',
                avatar: undefined
              }}
              onSessionUpdate={(session) => {
                showToast(`Session updated: ${session.participants.length} participants`, 'info')
              }}
              onCommentAdd={(comment) => {
                showToast('Comment added to collaborative session', 'success')
              }}
              onCursorMove={(userId, position) => {
                // Handle cursor movement updates
              }}
            />
          </div>
        )
      case 'timeline':
        return (
          <div className="space-y-6">
            <AdvancedVideoTimeline
              duration={videoState.duration || 0}
              currentTime={videoState.currentTime}
              segments={timelineSegments}
              keyframes={[]}
              onTimeUpdate={(time) => {
                setVideoState(prev => ({ ...prev, currentTime: time }))
              }}
              onSegmentUpdate={(segmentId, updates) => {
                setTimelineSegments(prev =>
                  prev.map(seg => seg.id === segmentId ? { ...seg, ...updates } : seg)
                )
              }}
              onSegmentDelete={(segmentId) => {
                setTimelineSegments(prev => prev.filter(seg => seg.id !== segmentId))
                showToast('Segment deleted', 'success')
              }}
              onSegmentAdd={(segment) => {
                const newSegment = {
                  ...segment,
                  id: Date.now().toString()
                }
                setTimelineSegments(prev => [...prev, newSegment])
                showToast(`Added ${segment.type} segment`, 'success')
              }}
              onKeyframeAdd={() => {}}
              onKeyframeUpdate={() => {}}
              onKeyframeDelete={() => {}}
            />
          </div>
        )
      case 'export':
        return (
          <div className="space-y-6">
            {videoUrl ? (
              <SocialMediaExporter
                videoUrl={videoUrl}
                videoId={videoId}
                onExport={(preset, options) => {
                  showToast(`Starting export for ${preset.platform}...`, 'info')
                  console.log('Export config:', { preset, options, textOverlays, videoFilters })
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Please load a video first to access export features.
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  if (!videoUrl && !videoPath) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full blur-xl opacity-30"></div>
            <div className="relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
              <Video className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Modern Video Editor
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Transform your videos with AI-powered editing tools, real-time effects, and professional-grade features
          </p>
          <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
            Upload Your Video
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-900">
      {/* Mobile Header */}
      {deviceView === 'mobile' && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 p-4 flex items-center justify-between lg:hidden sticky top-0 z-40">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Video Editor
          </h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
            <Smartphone className="w-4 h-4" />
            Mobile
          </div>
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`${
          deviceView === 'mobile'
            ? `fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : sidebarCollapsed ? 'w-20' : 'w-72'
        } bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-r border-gray-200/50 dark:border-gray-700/50 flex flex-col transition-all duration-300 shadow-xl`}>
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between">
              <h2 className={`font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${sidebarCollapsed && deviceView !== 'mobile' ? 'hidden' : ''}`}>
                Creator Tools
              </h2>
              {deviceView !== 'mobile' && (
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Category Navigation */}
          <div className="flex-1 p-4 space-y-3">
            {categories.map(category => {
              const Icon = category.icon
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id as any)
                    if (deviceView === 'mobile') setMobileMenuOpen(false)
                  }}
                  className={`w-full group relative overflow-hidden rounded-2xl transition-all duration-300 ${
                    activeCategory === category.id
                      ? `bg-gradient-to-r ${category.color} text-white shadow-lg scale-105`
                      : `${category.bgColor} ${category.textColor} hover:shadow-md hover:scale-102`
                  }`}
                >
                  <div className="p-4 flex items-center gap-4">
                    <div className={`p-2 rounded-xl transition-colors ${
                      activeCategory === category.id
                        ? 'bg-white/20'
                        : 'bg-white dark:bg-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {(!sidebarCollapsed || deviceView === 'mobile') && (
                      <div className="text-left flex-1">
                        <div className="font-semibold text-sm">{category.label}</div>
                        <div className={`text-xs mt-1 ${activeCategory === category.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                          {category.description}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {category.features.slice(0, 2).map(feature => (
                            <span
                              key={feature}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                activeCategory === category.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active indicator */}
                  {activeCategory === category.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-pulse"></div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Device & Status */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              {deviceView === 'desktop' && <Monitor className="w-4 h-4" />}
              {deviceView === 'tablet' && <Tablet className="w-4 h-4" />}
              {deviceView === 'mobile' && <Smartphone className="w-4 h-4" />}
              <span className="capitalize font-medium">{deviceView} Mode</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Video Ready • {formatTime(videoState.duration)}</span>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200/50 dark:border-gray-700/50 p-4 sticky top-0 z-30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {categories.find(c => c.id === activeCategory)?.label}
                </h1>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {categories.find(c => c.id === activeCategory)?.features.length} Features
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowKeyboardHelp(true)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                  title="Keyboard shortcuts (Press ?)"
                >
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">?</kbd>
                  Shortcuts
                </button>
                <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  onClick={() => setPropertiesPanelOpen(!propertiesPanelOpen)}
                  className={`p-2 rounded-xl transition-colors ${
                    propertiesPanelOpen
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Main Editor Area */}
            <div className="flex-1 p-6 min-w-0 overflow-y-auto">
              {/* Video Preview Section */}
              <div className="mb-8">
                {(videoUrl || videoPath) ? (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                    <RealTimeVideoPreview
                      videoUrl={(videoUrl || videoPath) as string}
                      textOverlays={textOverlays}
                      videoFilters={videoFilters}
                      playbackSpeed={playbackSpeed}
                      onTimeUpdate={(currentTime, duration) => {
                        setVideoState(prev => ({ ...prev, currentTime, duration }))
                      }}
                      onVideoLoad={(duration) => {
                        setVideoState(prev => ({ ...prev, duration }))
                      }}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                    <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                      <div className="text-center">
                        <Video className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">No video loaded</p>
                        <p className="text-sm">Upload a video to start editing</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Content with Smooth Transitions */}
              <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-6 transition-all duration-300 ${
                isTransitioning
                  ? `transform ${transitionDirection === 'right' ? 'translate-x-4' : '-translate-x-4'} opacity-50`
                  : 'transform translate-x-0 opacity-100'
              }`}>
                <div className={`transition-all duration-500 ${
                  isTransitioning
                    ? `transform ${transitionDirection === 'right' ? '-translate-x-4' : 'translate-x-4'} opacity-0`
                    : 'transform translate-x-0 opacity-100'
                }`}>
                  {(() => {
                    try {
                      return getCategoryContent()
                    } catch (error) {

                      logReactError(error, null, 'ModernVideoEditor')
                      return (
                        <div className="text-center py-8 text-red-600 dark:text-red-400">
                          <p className="font-semibold">Error loading {activeCategory} tools</p>
                          <p className="text-sm mt-2">Please try refreshing the page</p>
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* Properties Panel - Desktop/Tablet only */}
            {(deviceView === 'desktop' || deviceView === 'tablet') && propertiesPanelOpen && (
              <div className="w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-l border-gray-200/50 dark:border-gray-700/50 flex flex-col shadow-xl">
                <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Properties
                  </h3>
                  <button
                    onClick={() => setPropertiesPanelOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-6">
                    {/* Video Filters */}
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-xl">
                      <h4 className="font-semibold mb-4 text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Video Filters
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-purple-700 dark:text-purple-300 mb-2">
                            Brightness: {videoFilters.brightness}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={videoFilters.brightness}
                            onChange={(e) => setVideoFilters(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-purple-700 dark:text-purple-300 mb-2">
                            Contrast: {videoFilters.contrast}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={videoFilters.contrast}
                            onChange={(e) => setVideoFilters(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-purple-700 dark:text-purple-300 mb-2">
                            Saturation: {videoFilters.saturation}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={videoFilters.saturation}
                            onChange={(e) => setVideoFilters(prev => ({ ...prev, saturation: parseInt(e.target.value) }))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-purple-700 dark:text-purple-300 mb-2">
                            Vignette: {videoFilters.vignette}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={videoFilters.vignette}
                            onChange={(e) => setVideoFilters(prev => ({ ...prev, vignette: parseInt(e.target.value) }))}
                            className="w-full accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Text Overlays */}
                    {textOverlays.length > 0 && (
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl">
                        <h4 className="font-semibold mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          Text Overlays ({textOverlays.length})
                        </h4>
                        <div className="space-y-3">
                          {textOverlays.map(overlay => (
                            <div key={overlay.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                              <div className="font-medium text-sm mb-1 text-blue-900 dark:text-blue-100">{overlay.text}</div>
                              <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                                {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                              </div>
                              <div className="flex gap-2">
                                <button className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                                  Edit
                                </button>
                                <button
                                  onClick={() => setTextOverlays(prev => prev.filter(o => o.id !== overlay.id))}
                                  className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Playback Controls */}
                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-xl">
                      <h4 className="font-semibold mb-4 text-green-900 dark:text-green-100 flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Playback
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-green-700 dark:text-green-300 mb-2">
                            Speed: {playbackSpeed}x
                          </label>
                          <select
                            value={playbackSpeed}
                            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-green-200 dark:border-green-700 rounded-lg bg-white dark:bg-gray-800 text-green-900 dark:text-green-100"
                          >
                            <option value="0.25">0.25x (Slow Motion)</option>
                            <option value="0.5">0.5x (Half Speed)</option>
                            <option value="1">1x (Normal)</option>
                            <option value="1.25">1.25x (Slightly Fast)</option>
                            <option value="1.5">1.5x (Fast)</option>
                            <option value="2">2x (Double Speed)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timeline - Desktop/Tablet only */}
          {(deviceView === 'desktop' || deviceView === 'tablet') && !timelineCollapsed && (
            <div className="border-t border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg">
              <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Timeline
                </h3>
                <button
                  onClick={() => setTimelineCollapsed(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="h-48 overflow-hidden">
                <AdvancedVideoTimeline
                  duration={videoState.duration || 0}
                  currentTime={videoState.currentTime}
                  segments={timelineSegments}
                  keyframes={[]}
                  onTimeUpdate={(time) => {
                    setVideoState(prev => ({ ...prev, currentTime: time }))
                  }}
                  onSegmentUpdate={(segmentId, updates) => {
                    setTimelineSegments(prev =>
                      prev.map(seg => seg.id === segmentId ? { ...seg, ...updates } : seg)
                    )
                  }}
                  onSegmentDelete={(segmentId) => {
                    setTimelineSegments(prev => prev.filter(seg => seg.id !== segmentId))
                  }}
                  onSegmentAdd={(segment) => {
                    const newSegment = {
                      ...segment,
                      id: Date.now().toString()
                    }
                    setTimelineSegments(prev => [...prev, newSegment])
                  }}
                  onKeyframeAdd={() => {}}
                  onKeyframeUpdate={() => {}}
                  onKeyframeDelete={() => {}}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {deviceView === 'mobile' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 flex shadow-2xl">
          {categories.map(category => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => {
                  const previousCategory = activeCategory
                  const currentIndex = categories.findIndex(c => c.id === previousCategory)
                  const newIndex = categories.findIndex(c => c.id === category.id)

                  setTransitionDirection(newIndex > currentIndex ? 'right' : 'left')
                  setIsTransitioning(true)

                  trackUserAction('category_switched', {
                    from: previousCategory,
                    to: category.id,
                    direction: newIndex > currentIndex ? 'forward' : 'backward'
                  })

                  // Add haptic feedback if available
                  if (navigator.vibrate) {
                    navigator.vibrate(50)
                  }

                  // Smooth transition
                  setTimeout(() => {
                    setActiveCategory(category.id as any)
                    setTimeout(() => setIsTransitioning(false), 150)
                  }, 150)
                }}
                className={`flex-1 p-3 flex flex-col items-center gap-1 transition-all duration-200 group ${
                  activeCategory === category.id
                    ? `text-white bg-gradient-to-t ${category.color} scale-105 shadow-lg`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:scale-102 active:scale-95'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{category.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile Overlay */}
      {deviceView === 'mobile' && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts shortcuts={keyboardShortcuts} />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        shortcuts={keyboardShortcuts}
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      {/* Flow Optimizer */}
      <FlowOptimizer
        activeCategory={activeCategory}
        userActions={userActions}
        sessionDuration={Date.now() - sessionStartTime}
        onWorkflowSuggestion={(suggestion) => {
          // Handle workflow suggestions
          trackUserAction('workflow_suggestion_shown', { suggestionId: suggestion.id })
        }}
        onFlowComplete={(flow) => {
          trackUserAction('workflow_completed', {
            completedSteps: flow.completedSteps.length,
            totalSteps: flow.suggestedWorkflow.length,
            sessionDuration: Date.now() - sessionStartTime
          })
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 flex items-center gap-4">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{loadingMessage}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Please wait...</p>
            </div>
          </div>
        </div>
      )}

      {/* Smooth Transitions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-30">
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 transition-opacity duration-500 ${
          activeCategory !== 'edit' ? 'opacity-100' : 'opacity-0'
        }`} />
      </div>

      {/* Add bottom padding for mobile navigation */}
      {deviceView === 'mobile' && <div className="h-20"></div>}
    </div>
  )
}
