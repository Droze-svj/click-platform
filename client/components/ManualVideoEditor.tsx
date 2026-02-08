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
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const tabs = [
    { id: 'color', name: 'Color Grading', icon: Palette, color: 'purple' },
    { id: 'audio', name: 'Audio Mixing', icon: Music, color: 'blue' },
    { id: 'typography', name: 'Typography', icon: Type, color: 'green' },
    { id: 'motion', name: 'Motion Graphics', icon: Sparkles, color: 'pink' },
    { id: 'ai', name: 'AI Assist', icon: Brain, color: 'orange' },
    { id: 'transitions', name: 'Transitions', icon: Film, color: 'red' },
    { id: 'speed', name: 'Speed Control', icon: Gauge, color: 'yellow' },
    { id: 'export', name: 'Export', icon: Download, color: 'indigo' },
    { id: 'keyframes', name: 'Keyframes', icon: Layers, color: 'cyan' },
    { id: 'timeline', name: 'Timeline', icon: Layers, color: 'teal' },
    { id: 'marketplace', name: 'Marketplace', icon: Bookmark, color: 'amber' },
    { id: 'tutorials', name: 'Learn', icon: Zap, color: 'emerald' }
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Professional Manual Editor
        </h2>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          {videoId && (
            <>
              <button
                onClick={handleUndo}
                disabled={!canUndo || isProcessing}
                className={`p-2 rounded-lg border transition-all ${canUndo
                    ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                  }`}
                title="Undo"
              >
                <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo || isProcessing}
                className={`p-2 rounded-lg border transition-all ${canRedo
                    ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                  }`}
                title="Redo"
              >
                <RotateCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}

          {/* Preview */}
          <button
            onClick={() => handleGeneratePreview()}
            disabled={isProcessing}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            title="Generate Preview"
          >
            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* History */}
          {videoId && editHistory && (
            <div className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <History className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">
                {editHistory.totalStates || 0}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <img src={previewImage} alt="Preview" className="w-full rounded-lg" />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(isActive ? null : tab.id)}
              className={`p-4 rounded-lg border-2 transition-all ${isActive
                  ? `border-${tab.color}-500 bg-${tab.color}-50 dark:bg-${tab.color}-900/20`
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 text-${tab.color}-600 dark:text-${tab.color}-400`} />
              <div className={`text-sm font-medium text-${tab.color}-700 dark:text-${tab.color}-300`}>
                {tab.name}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          {activeTab === 'color' && (
            <ColorGradingTab
              onProcess={handleProcess}
              videoUrl={videoUrl}
              savedPresets={savedPresets.filter(p => p.category === 'color-grading')}
              onSavePreset={loadPresets}
            />
          )}
          {activeTab === 'audio' && <AudioMixingTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'typography' && <TypographyTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'motion' && <MotionGraphicsTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'ai' && <AIAssistTab onProcess={handleProcess} videoId={videoId} />}
          {activeTab === 'transitions' && <TransitionsTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'speed' && <SpeedControlTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'export' && <ExportTab onProcess={handleProcess} videoUrl={videoUrl} />}
          {activeTab === 'keyframes' && <KeyframesTab onProcess={handleProcess} videoUrl={videoUrl} videoId={videoId} />}
          {activeTab === 'timeline' && <TimelineTab onProcess={handleProcess} videoId={videoId} />}
          {activeTab === 'marketplace' && <MarketplaceTab onProcess={handleProcess} />}
          {activeTab === 'tutorials' && <TutorialsTab videoId={videoId} />}
        </div>
      )}

      {processedVideo && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-800 dark:text-green-300 mb-2">Processed video ready!</p>
          <a
            href={processedVideo}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-green-700 dark:text-green-400 underline"
          >
            Download / View
          </a>
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

  const handleAnalyze = async () => {
    if (!videoId) {
      alert('Video ID is required')
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
        alert(`Analysis complete! Check console for results.`)
        console.log('AI Analysis:', data.data)
      }
    } catch (error: any) {
      alert(error.message)
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
