'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Script {
  _id: string
  title: string
  type: string
  topic: string
  wordCount: number
  duration?: number
  status: string
  createdAt: string
}

export default function ScriptsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Generation form state
  const [topic, setTopic] = useState('')
  const [scriptType, setScriptType] = useState('youtube')
  const [duration, setDuration] = useState(10)
  const [tone, setTone] = useState('professional')
  const [targetAudience, setTargetAudience] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadScripts()
  }, [user, router, loadScripts])

  const loadScripts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/scripts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const scriptsData = extractApiData<Script[]>(response)
      setScripts(Array.isArray(scriptsData) ? scriptsData : [])
    } catch (error: any) {
      setError(extractApiError(error) || 'Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate input
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    if (topic.trim().length < 3) {
      setError('Topic must be at least 3 characters long')
      return
    }

    if (topic.trim().length > 200) {
      setError('Topic is too long. Please keep it under 200 characters')
      return
    }

    if (scriptType === 'youtube' || scriptType === 'podcast') {
      if (duration && (duration < 1 || duration > 120)) {
        setError('Duration must be between 1 and 120 minutes')
        return
      }
    }

    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/scripts/generate`,
        {
          topic,
          type: scriptType,
          options: {
            duration: scriptType === 'youtube' || scriptType === 'podcast' ? duration : undefined,
            tone,
            targetAudience: targetAudience || user?.niche || 'general audience',
            platform: scriptType === 'social-media' ? 'instagram' : undefined
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = extractApiData(response)
      if (data) {
        setSuccess('Script generated successfully!')
        showToast('Script generated successfully!', 'success')
        setTopic('')
        setShowForm(false)
        await loadScripts()
      }
    } catch (error: any) {
      const errorMsg = extractApiError(error) || 'Failed to generate script'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (scriptId: string, format: string = 'txt') => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/scripts/${scriptId}/export?format=${format}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `script-${scriptId}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast('Script exported successfully!', 'success')
    } catch (error: any) {
      showToast('Failed to export script', 'error')
    }
  }

  const handleDelete = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/scripts/${scriptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast('Script deleted successfully', 'success')
      await loadScripts()
    } catch (error: any) {
      showToast('Failed to delete script', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading scripts..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-0 mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Script Generator</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 touch-target"
          >
            {showForm ? 'Cancel' : '+ Generate Script'}
          </button>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

        {showForm && (
          <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Generate New Script</h2>
            <form onSubmit={handleGenerate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Topic *</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g., How to grow your YouTube channel"
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Script Type *</label>
                  <select
                    value={scriptType}
                    onChange={(e) => setScriptType(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="youtube">YouTube Video</option>
                    <option value="podcast">Podcast</option>
                    <option value="social-media">Social Media Post</option>
                    <option value="blog">Blog Post</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                {(scriptType === 'youtube' || scriptType === 'podcast') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      min="1"
                      max="60"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                    <option value="humorous">Humorous</option>
                    <option value="inspiring">Inspiring</option>
                    <option value="educational">Educational</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Target Audience</label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder={user?.niche || 'e.g., entrepreneurs, students'}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={generating}
                className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 touch-target"
                aria-label={generating ? 'Generating script, please wait' : 'Generate script'}
                aria-busy={generating}
              >
                {generating ? 'Generating...' : 'Generate Script'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Your Scripts</h2>
            {scripts.length === 0 ? (
              <EmptyState
                title="No scripts yet"
                description="Generate your first script to get started with content creation"
                icon="📝"
              />
            ) : (
              <div className="space-y-4">
                {scripts.map((script) => (
                  <div key={script._id} className="border rounded-lg p-3 md:p-4 hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base md:text-lg">{script.title}</h3>
                        <p className="text-xs md:text-sm text-gray-600 mt-1">
                          {script.type} • {script.wordCount} words
                          {script.duration && ` • ${script.duration} min`}
                        </p>
                        <p className="text-xs md:text-sm text-gray-500 mt-2">Topic: {script.topic}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/scripts/${script._id}`)}
                          className="text-blue-600 hover:underline touch-target px-2"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleExport(script._id, 'txt')}
                          className="text-green-600 hover:underline touch-target px-2"
                        >
                          Export
                        </button>
                        <button
                          onClick={() => handleDelete(script._id)}
                          className="text-red-600 hover:underline touch-target px-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    )
  }







