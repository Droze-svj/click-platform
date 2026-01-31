'use client'

import { useState, useEffect } from 'react'
import { 
  Captions, 
  Download, 
  Languages, 
  Play, 
  Pause, 
  Edit3, 
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { extractApiData } from '../utils/apiResponse'

interface CaptionSegment {
  id: number
  start: number
  end: number
  text: string
}

interface CaptionData {
  text: string
  language: string
  format: string
  captions: string
  segments?: CaptionSegment[]
}

interface VideoCaptionEditorProps {
  contentId: string
  videoUrl?: string
  onSave?: (captions: CaptionData) => void
}

export default function VideoCaptionEditor({ 
  contentId, 
  videoUrl,
  onSave 
}: VideoCaptionEditorProps) {
  const [captions, setCaptions] = useState<CaptionData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedSegments, setEditedSegments] = useState<CaptionSegment[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')
  const [selectedFormat, setSelectedFormat] = useState<'srt' | 'vtt' | 'ssa'>('srt')
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing captions
  useEffect(() => {
    loadCaptions()
  }, [contentId])

  const loadCaptions = async () => {
    try {
      const response = await fetch(`/api/video/captions/${contentId}?format=${selectedFormat}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        const captionData = extractApiData<CaptionData>(data)
        if (captionData) {
          setCaptions(captionData)
          // Parse segments if available
          if (captionData.segments) {
            setEditedSegments(captionData.segments)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load captions:', err)
    }
  }

  const handleGenerateCaptions = async (language?: string) => {
    setIsGenerating(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('contentId', contentId)
      if (language) {
        formData.append('language', language)
      }

      const response = await fetch('/api/video/captions/generate', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        const captionData = extractApiData<CaptionData>(data)
        if (captionData) {
          setCaptions(captionData)
          if (captionData.segments) {
            setEditedSegments(captionData.segments)
          }
          if (onSave) {
            onSave(captionData)
          }
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to generate captions')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate captions')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTranslate = async (targetLanguage: string) => {
    setIsTranslating(true)
    setError(null)

    try {
      const response = await fetch(`/api/video/captions/${contentId}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ targetLanguage }),
      })

      if (response.ok) {
        const data = await response.json()
        await loadCaptions() // Reload captions
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to translate captions')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to translate captions')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleDownload = () => {
    if (!captions) return

    const blob = new Blob([captions.captions], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `captions.${selectedFormat}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSaveEdits = () => {
    // Save edited segments (would need API endpoint for this)
    setIsEditing(false)
    // TODO: Implement save edited captions API call
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
  }

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Captions className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Video Captions
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {captions && (
              <>
                <select
                  value={selectedFormat}
                  onChange={(e) => {
                    setSelectedFormat(e.target.value as 'srt' | 'vtt' | 'ssa')
                    loadCaptions()
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="srt">SRT</option>
                  <option value="vtt">VTT</option>
                  <option value="ssa">SSA</option>
                </select>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {!captions && !isGenerating && (
          <div className="text-center py-8">
            <Captions className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No captions generated yet
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                onClick={() => handleGenerateCaptions()}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Captions className="w-4 h-4" />
                    <span>Generate Auto-Captions</span>
                  </>
                )}
              </button>
              <div className="mt-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                  Or select language:
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleGenerateCaptions(selectedLanguage)}
                  disabled={isGenerating}
                  className="ml-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Generating captions... This may take a few minutes.
            </p>
          </div>
        )}

        {captions && (
          <div className="space-y-4">
            {/* Caption Info */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Language:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                    {languages.find(l => l.code === captions.language)?.name || captions.language}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Format:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white uppercase">
                    {captions.format}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </button>
            </div>

            {/* Caption Text */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              {isEditing && editedSegments.length > 0 ? (
                <div className="space-y-2">
                  {editedSegments.map((segment, index) => (
                    <div key={index} className="p-2 border border-gray-200 dark:border-gray-700 rounded">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {formatTime(segment.start)} → {formatTime(segment.end)}
                      </div>
                      <textarea
                        value={segment.text}
                        onChange={(e) => {
                          const newSegments = [...editedSegments]
                          newSegments[index].text = e.target.value
                          setEditedSegments(newSegments)
                        }}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={2}
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleSaveEdits}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors mt-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              ) : (
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {captions.captions}
                </pre>
              )}
            </div>

            {/* Translation */}
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Translate to:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isTranslating}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleTranslate(selectedLanguage)}
                disabled={isTranslating || selectedLanguage === captions.language}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                    Translating...
                  </>
                ) : (
                  'Translate'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
