'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Palette,
  Music,
  Type,
  Sparkles,
  Brain,
  Film,
  Gauge,
  Download,
  Play,
  Pause,
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  RotateCw,
  Save,
  Eye,
  Layers,
  History,
  Bookmark,
  Zap
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface ManualVideoEditorProps {
  videoId?: string
  videoUrl?: string
  onExport?: (result: any) => void
}

export default function ManualVideoEditor({ videoId, videoUrl, onExport }: ManualVideoEditorProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedVideo, setProcessedVideo] = useState<string | null>(null)
  const [editHistory, setEditHistory] = useState<any>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [savedPresets, setSavedPresets] = useState<any[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Sync play state button with native video element
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onPlay  = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => { el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause) }
  }, [])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const tabs = [
    { id: 'color',       name: 'Color',       icon: Palette,  gradient: 'from-purple-500 to-violet-600' },
    { id: 'audio',       name: 'Audio',       icon: Music,    gradient: 'from-blue-500 to-indigo-600' },
    { id: 'typography',  name: 'Text',        icon: Type,     gradient: 'from-emerald-500 to-teal-600' },
    { id: 'motion',      name: 'Motion',      icon: Sparkles, gradient: 'from-pink-500 to-rose-600' },
    { id: 'ai',          name: 'AI Assist',   icon: Brain,    gradient: 'from-orange-400 to-amber-500' },
    { id: 'transitions', name: 'Transitions', icon: Film,     gradient: 'from-red-500 to-orange-600' },
    { id: 'speed',       name: 'Speed',       icon: Gauge,    gradient: 'from-yellow-400 to-amber-500' },
    { id: 'export',      name: 'Export',      icon: Download, gradient: 'from-indigo-500 to-blue-600' },
    { id: 'keyframes',   name: 'Keyframes',   icon: Layers,   gradient: 'from-cyan-500 to-sky-600' },
    { id: 'timeline',    name: 'Timeline',    icon: Layers,   gradient: 'from-teal-500 to-emerald-600' },
    { id: 'marketplace', name: 'Market',      icon: Bookmark, gradient: 'from-amber-400 to-orange-500' },
    { id: 'tutorials',   name: 'Learn',       icon: Zap,      gradient: 'from-lime-500 to-green-600' },
  ]

  // Load edit history
  useEffect(() => {
    if (videoId) {
      loadEditHistory()
      loadPresets()
    }
  }, [videoId])

  const loadEditHistory = async () => {
    if (!videoId) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/video/manual-editing/history/${videoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setEditHistory(data.data)
        setCanUndo(data.data.canUndo)
        setCanRedo(data.data.canRedo)
      }
    } catch (error) {
      console.error('Failed to load edit history', error)
    }
  }

  const loadPresets = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/presets', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setSavedPresets(data.data.presets || [])
      }
    } catch (error) {
      console.error('Failed to load presets', error)
    }
  }

  const handleUndo = async () => {
    if (!videoId || !canUndo) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/history/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId })
      })
      const data = await response.json()
      if (data.success) {
        showToast('Edit undone', 'success')
        loadEditHistory()
      }
    } catch (error: any) {
      showToast(error.message || 'Undo failed', 'error')
    }
  }

  const handleRedo = async () => {
    if (!videoId || !canRedo) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/history/redo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId })
      })
      const data = await response.json()
      if (data.success) {
        showToast('Edit redone', 'success')
        loadEditHistory()
      }
    } catch (error: any) {
      showToast(error.message || 'Redo failed', 'error')
    }
  }

  const handleGeneratePreview = async (time = 5) => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      showToast('Please select a video file', 'error')
      return
    }

    try {
      const formData = new FormData()
      if (fileInputRef.current?.files?.[0]) {
        formData.append('video', fileInputRef.current.files[0])
      }
      formData.append('time', time.toString())

      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/preview/frame', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      const data = await response.json()
      if (data.success) {
        setPreviewImage(data.data.outputPath)
        setShowPreview(true)
      }
    } catch (error: any) {
      showToast(error.message || 'Preview generation failed', 'error')
    }
  }

  const handleProcess = async (endpoint: string, formData: FormData, editState?: any) => {
    setIsProcessing(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/video/manual-editing/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Processing failed')
      }

      // Save edit state to history
      if (videoId && editState) {
        try {
          await fetch('/api/video/manual-editing/history/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ videoId, editState })
          })
          loadEditHistory()
        } catch (err) {
          console.error('Failed to save edit history', err)
        }
      }

      showToast('Processing completed successfully', 'success')
      setProcessedVideo(data.data?.outputPath || data.data?.url)
      if (onExport) {
        onExport(data.data)
      }
    } catch (error: any) {
      showToast(error.message || 'Processing failed', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* Dark header bar + embedded video player */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Manual Editor</p>
              <p className="text-white/40 text-[10px]">Professional editing tools</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {videoId && (
              <>
                <button onClick={handleUndo} disabled={!canUndo || isProcessing} title="Undo"
                  className={`p-2 rounded-xl transition-all ${canUndo ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}>
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={handleRedo} disabled={!canRedo || isProcessing} title="Redo"
                  className={`p-2 rounded-xl transition-all ${canRedo ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}>
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
              </>
            )}
            <button onClick={() => handleGeneratePreview()} disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            {videoId && editHistory && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <History className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] font-bold text-gray-500">{editHistory.totalStates || 0}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Embedded video player — always fills the card, auto-sized ── */}
        <div className="relative bg-gray-950" style={{ aspectRatio: '16/9' }}>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Film className="w-7 h-7 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No video loaded</p>
              <p className="text-gray-700 text-xs">Upload a video on the Videos page to start editing</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 max-w-3xl w-full border border-gray-100 dark:border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Frame Preview</h3>
              <button onClick={() => setShowPreview(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold">✕</button>
            </div>
            <img src={previewImage} alt="Preview" className="w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* ── Tool Tabs ── */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Editing Tools</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(isActive ? null : tab.id)}
                className={`group flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  isActive ? 'border-transparent shadow-lg scale-105' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:scale-105'
                }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isActive ? `bg-gradient-to-br ${tab.gradient} shadow-md` : 'bg-gray-50 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-700'
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-bold leading-tight text-center ${
                  isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                }`}>{tab.name}</span>
              </button>
            )
          })}
        </div>

        {/* Active tab content */}
        {activeTab && (
          <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
            {activeTab === 'color'       && <ColorGradingTab onProcess={handleProcess} videoUrl={videoUrl} savedPresets={savedPresets.filter(p => p.category === 'color-grading')} onSavePreset={loadPresets} />}
            {activeTab === 'audio'       && <AudioMixingTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'typography'  && <TypographyTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'motion'      && <MotionGraphicsTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'ai'          && <AIAssistTab onProcess={handleProcess} videoId={videoId} />}
            {activeTab === 'transitions' && <TransitionsTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'speed'       && <SpeedControlTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'export'      && <ExportTab onProcess={handleProcess} videoUrl={videoUrl} />}
            {activeTab === 'keyframes'   && <KeyframesTab onProcess={handleProcess} videoUrl={videoUrl} videoId={videoId} />}
            {activeTab === 'timeline'    && <TimelineTab onProcess={handleProcess} videoId={videoId} />}
            {activeTab === 'marketplace' && <MarketplaceTab onProcess={handleProcess} />}
            {activeTab === 'tutorials'   && <TutorialsTab videoId={videoId} />}
          </div>
        )}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
          <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Processing video…</p>
        </div>
      )}

      {/* Processed video result */}
      {processedVideo && (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 flex items-center justify-between">
            <p className="text-white font-bold text-sm">Processed Video Ready</p>
            <a href={processedVideo} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors">
              <Download className="w-3 h-3" /> Download
            </a>
          </div>
          <div className="bg-gray-950" style={{ aspectRatio: '16/9' }}>
            <video src={processedVideo} className="w-full h-full object-contain" controls playsInline />
          </div>
        </div>
      )}
    </div>
  )
}

// Color Grading Tab
function ColorGradingTab({
  onProcess,
  videoUrl,
  savedPresets = [],
  onSavePreset
}: {
  onProcess: any,
  videoUrl?: string,
  savedPresets?: any[],
  onSavePreset?: () => void
}) {
  const [preset, setPreset] = useState('cinematic')
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const builtInPresets = ['cinematic', 'vintage', 'film-noir', 'golden-hour', 'cool-blue', 'vibrant', 'moody', 'bright-clean']
  const allPresets = [...builtInPresets, ...savedPresets.map(p => p.name)]

  const handleApply = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      showToast('Please select a video file', 'error')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('presetName', preset)

    const editState = {
      type: 'color-grading',
      preset,
      timestamp: new Date().toISOString()
    }

    onProcess('color-grading/preset', formData, editState)
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      showToast('Please enter a preset name', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/presets/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          presetData: {
            name: presetName,
            category: 'color-grading',
            settings: { preset }
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast('Preset saved successfully', 'success')
        setShowSavePreset(false)
        setPresetName('')
        if (onSavePreset) onSavePreset()
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to save preset', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Color Grading</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Preset
        </label>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {allPresets.map(p => (
            <option key={p} value={p}>{String(p).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Apply Color Preset
        </button>
        <button
          onClick={() => setShowSavePreset(true)}
          className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20"
          title="Save as Preset"
        >
          <Save className="w-4 h-4" />
        </button>
      </div>

      {/* Save Preset Modal */}
      {showSavePreset && (
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="w-full p-2 border rounded-lg mb-2 bg-white dark:bg-gray-900"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSavePreset}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSavePreset(false)
                setPresetName('')
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Audio Mixing Tab
function AudioMixingTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [eqPreset, setEqPreset] = useState('voice-enhancement')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const presets = ['voice-enhancement', 'music-boost', 'podcast-mode', 'bass-boost', 'treble-boost']

  const handleApply = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      alert('Please select a video file')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('preset', eqPreset)

    onProcess('audio/eq-preset', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audio Mixing</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          EQ Preset
        </label>
        <select
          value={eqPreset}
          onChange={(e) => setEqPreset(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {presets.map(p => (
            <option key={p} value={p}>{p.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleApply}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Apply EQ Preset
      </button>
    </div>
  )
}

// Typography Tab
function TypographyTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [template, setTemplate] = useState('title-card')
  const [text, setText] = useState('Your Text Here')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const templates = ['title-card', 'lower-third', 'end-card', 'tiktok-style', 'youtube-style']

  const handleApply = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      alert('Please select a video file')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('template', JSON.stringify({ type: template, text, startTime: 0, endTime: 5 }))

    onProcess('typography/template', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Typography</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Template
        </label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {templates.map(t => (
            <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Text
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        />
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleApply}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Apply Text Template
      </button>
    </div>
  )
}

// Motion Graphics Tab
function MotionGraphicsTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [strength, setStrength] = useState(0.5)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleStabilize = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      alert('Please select a video file')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('strength', strength.toString())

    onProcess('motion-graphics/stabilize', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Motion Graphics</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Stabilization Strength: {strength}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={strength}
          onChange={(e) => setStrength(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleStabilize}
        className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
      >
        Stabilize Video
      </button>
    </div>
  )
}

// AI Assist Tab
function AIAssistTab({ onProcess, videoId }: { onProcess: any, videoId?: string }) {
  const [analysisType, setAnalysisType] = useState('smart-cuts')
  const { showToast } = useToast()

  const handleAnalyze = async () => {
    if (!videoId) {
      showToast('Video ID is required', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/video/manual-editing/ai-assist/${analysisType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoId })
      })

      const data = await response.json()
      if (data.success) {
        showToast('AI analysis complete!', 'success')
      }
    } catch (error: any) {
      showToast(error.message || 'AI analysis failed', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI-Assisted Editing</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Analysis Type
        </label>
        <select
          value={analysisType}
          onChange={(e) => setAnalysisType(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="smart-cuts">Smart Cut Suggestions</option>
          <option value="best-moments">Best Moments</option>
          <option value="pacing">Pacing Analysis</option>
          <option value="quality-check">Quality Check</option>
        </select>
      </div>
      <button
        onClick={handleAnalyze}
        className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
      >
        Run AI Analysis
      </button>
    </div>
  )
}

// Transitions Tab
function TransitionsTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [transition, setTransition] = useState('fade')
  const clip1Ref = useRef<HTMLInputElement>(null)
  const clip2Ref = useRef<HTMLInputElement>(null)

  const transitions = ['fade', 'crossfade', 'wipe-left', 'wipe-right', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'glitch']

  const handleApply = () => {
    if (!clip1Ref.current?.files?.[0] || !clip2Ref.current?.files?.[0]) {
      alert('Please select two video clips')
      return
    }

    const formData = new FormData()
    formData.append('clip1', clip1Ref.current.files[0])
    formData.append('clip2', clip2Ref.current.files[0])
    formData.append('transition', JSON.stringify({ type: transition, duration: 1.0 }))

    onProcess('transitions/apply', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transitions</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Transition Type
        </label>
        <select
          value={transition}
          onChange={(e) => setTransition(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {transitions.map(t => (
            <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Clip 1
        </label>
        <input ref={clip1Ref} type="file" accept="video/*" className="w-full p-2 border rounded-lg" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Clip 2
        </label>
        <input ref={clip2Ref} type="file" accept="video/*" className="w-full p-2 border rounded-lg" />
      </div>
      <button
        onClick={handleApply}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Apply Transition
      </button>
    </div>
  )
}

// Speed Control Tab
function SpeedControlTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [speed, setSpeed] = useState(2.0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleApply = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      alert('Please select a video file')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('speedOptions', JSON.stringify({ start: 0, end: 10, speed, audioPitchCorrection: true }))

    onProcess('speed/variable', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Speed Control</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Speed: {speed}x
        </label>
        <input
          type="range"
          min="0.25"
          max="8"
          step="0.25"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleApply}
        className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
      >
        Apply Speed Change
      </button>
    </div>
  )
}

// Export Tab
function ExportTab({ onProcess, videoUrl }: { onProcess: any, videoUrl?: string }) {
  const [platform, setPlatform] = useState('youtube')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const platforms = ['youtube', 'instagram-feed', 'instagram-story', 'instagram-reel', 'tiktok', 'twitter', 'linkedin', 'facebook']

  const handleExport = () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      alert('Please select a video file')
      return
    }

    const formData = new FormData()
    if (fileInputRef.current?.files?.[0]) {
      formData.append('video', fileInputRef.current.files[0])
    }
    formData.append('platform', platform)

    onProcess('export/preset', formData)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Professional Export</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Platform Preset
        </label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {platforms.map(p => (
            <option key={p} value={p}>{p.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleExport}
        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Export for {platform.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </button>
    </div>
  )
}

// Keyframes Tab
function KeyframesTab({ onProcess, videoUrl, videoId }: { onProcess: any, videoUrl?: string, videoId?: string }) {
  const [property, setProperty] = useState('opacity')
  const [preset, setPreset] = useState('fade-in')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const properties = ['position', 'scale', 'rotation', 'opacity']
  const presets = ['fade-in', 'fade-out', 'slide-in-left', 'zoom-in', 'bounce']

  const handleApply = async () => {
    if (!fileInputRef.current?.files?.[0] && !videoUrl) {
      showToast('Please select a video file', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/video/manual-editing/keyframes/presets', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      const presetData = data.data?.presets?.[preset]

      if (presetData && videoId) {
        // Save animation
        await fetch('/api/video/manual-editing/keyframes/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            videoId,
            animationData: { ...presetData, property }
          })
        })
      }

      const formData = new FormData()
      if (fileInputRef.current?.files?.[0]) {
        formData.append('video', fileInputRef.current.files[0])
      }
      formData.append('keyframes', JSON.stringify(presetData?.keyframes || []))
      formData.append('property', property)

      onProcess('keyframes/apply', formData)
    } catch (error: any) {
      showToast(error.message || 'Failed to apply keyframes', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyframe Animation</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Property
        </label>
        <select
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {properties.map(p => (
            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Animation Preset
        </label>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          {presets.map(p => (
            <option key={p} value={p}>{p.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>
      {!videoUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Video File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}
      <button
        onClick={handleApply}
        className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
      >
        Apply Keyframe Animation
      </button>
    </div>
  )
}

// Timeline Tab
function TimelineTab({ onProcess, videoId }: { onProcess: any, videoId?: string }) {
  const [trackType, setTrackType] = useState('video')
  const [trackName, setTrackName] = useState('')
  const { showToast } = useToast()

  const handleAddTrack = async () => {
    if (!videoId) {
      showToast('Video ID is required', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/video/manual-editing/timeline/${videoId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trackData: {
            type: trackType,
            name: trackName || `${trackType} Track`
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast('Track added successfully', 'success')
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to add track', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multi-Track Timeline</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Track Type
        </label>
        <select
          value={trackType}
          onChange={(e) => setTrackType(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="video">Video Track</option>
          <option value="audio">Audio Track</option>
          <option value="text">Text Track</option>
          <option value="graphics">Graphics Track</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Track Name
        </label>
        <input
          type="text"
          value={trackName}
          onChange={(e) => setTrackName(e.target.value)}
          placeholder="Track name (optional)"
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        />
      </div>
      <button
        onClick={handleAddTrack}
        className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
      >
        Add Track
      </button>
    </div>
  )
}

// Marketplace Tab
function MarketplaceTab({ onProcess }: { onProcess: any }) {
  const [templates, setTemplates] = useState<any[]>([])
  const [category, setCategory] = useState('all')
  const { showToast } = useToast()

  useEffect(() => {
    loadTemplates()
  }, [category])

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('token')
      const url = category === 'all'
        ? '/api/video/manual-editing/marketplace/browse'
        : `/api/video/manual-editing/marketplace/browse?category=${category}`

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setTemplates(data.data.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates', error)
    }
  }

  const handleDownload = async (templateId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/video/manual-editing/marketplace/${templateId}/download`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        showToast('Template downloaded', 'success')
      }
    } catch (error: any) {
      showToast(error.message || 'Download failed', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Template Marketplace</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="all">All Categories</option>
          <option value="color-grading">Color Grading</option>
          <option value="text">Text Templates</option>
          <option value="transition">Transitions</option>
          <option value="effect-chain">Effect Chains</option>
          <option value="export">Export Presets</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {templates.map(template => (
          <div key={template._id} className="p-4 border rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">⭐ {template.rating?.toFixed(1) || '0.0'}</span>
              <button
                onClick={() => handleDownload(template._id)}
                className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Tutorials Tab
function TutorialsTab({ videoId }: { videoId?: string }) {
  const [feature, setFeature] = useState('color-grading')
  const [tutorials, setTutorials] = useState<any[]>([])
  const [tooltips, setTooltips] = useState<any>({})
  const { showToast } = useToast()

  useEffect(() => {
    loadTutorials()
  }, [feature])

  const loadTutorials = async () => {
    try {
      const token = localStorage.getItem('token')
      const [tutorialsRes, tooltipsRes] = await Promise.all([
        fetch(`/api/video/manual-editing/tutorials/${feature}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/video/manual-editing/tutorials/${feature}/tooltips`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      const tutorialsData = await tutorialsRes.json()
      const tooltipsData = await tooltipsRes.json()

      if (tutorialsData.success) {
        setTutorials(tutorialsData.data.tutorials || [])
      }
      if (tooltipsData.success) {
        setTooltips(tooltipsData.data.tooltips || {})
      }
    } catch (error) {
      console.error('Failed to load tutorials', error)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Learning & Tutorials</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Feature
        </label>
        <select
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
          className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="color-grading">Color Grading</option>
          <option value="audio-mixing">Audio Mixing</option>
          <option value="keyframes">Keyframes</option>
          <option value="timeline">Timeline</option>
        </select>
      </div>
      <div className="space-y-2">
        {tutorials.map(tutorial => (
          <div key={tutorial.id} className="p-3 border rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white">{tutorial.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{tutorial.description}</p>
            <span className="text-xs text-gray-500">Duration: {tutorial.duration} min</span>
          </div>
        ))}
      </div>
    </div>
  )
}
