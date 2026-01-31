'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Copy,
  Download,
  Trash2,
  Eye,
  CopyPlus,
  Sparkles,
  X,
  Check,
} from 'lucide-react'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { apiGet, apiPost, apiDelete, api } from '../../../lib/api'

interface Script {
  _id: string
  title: string
  type: string
  topic: string
  wordCount: number
  duration?: number
  status: string
  createdAt: string
  script?: string
}

const QUICK_TOPICS = [
  'How to grow your YouTube channel',
  'Top 5 productivity hacks',
  'Behind the scenes of my business',
  'Product launch announcement',
  'Weekly tips for creators',
  'Storytelling that converts',
]

const PLATFORMS: Record<string, string> = {
  'social-media': 'instagram',
  instagram: 'instagram',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  twitter: 'twitter',
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
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null)
  const [copyId, setCopyId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [scriptType, setScriptType] = useState('youtube')
  const [duration, setDuration] = useState(10)
  const [tone, setTone] = useState('professional')
  const [targetAudience, setTargetAudience] = useState('')
  const [keywordsSeed, setKeywordsSeed] = useState('')
  const [showForm, setShowForm] = useState(false)

  const loadScripts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiGet<{ data?: Script[] }>('/scripts')
      const scriptsData = extractApiData<Script[]>(res as any) ?? (res as any)?.data
      setScripts(Array.isArray(scriptsData) ? scriptsData : [])
    } catch (err: any) {
      const errObj = extractApiError(err)
      setError(typeof errObj === 'string' ? errObj : errObj?.message || 'Failed to load scripts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadScripts()
  }, [user, router, loadScripts])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }
    if (topic.trim().length < 3) {
      setError('Topic must be at least 3 characters')
      return
    }
    if (topic.trim().length > 200) {
      setError('Topic must be under 200 characters')
      return
    }
    if ((scriptType === 'youtube' || scriptType === 'podcast') && (duration < 1 || duration > 120)) {
      setError('Duration must be between 1 and 120 minutes')
      return
    }

    setGenerating(true)
    setError('')
    setSuccess('')

    try {
      const options: Record<string, any> = {
        duration: scriptType === 'youtube' || scriptType === 'podcast' ? duration : undefined,
        tone,
        targetAudience: targetAudience || (user as any)?.niche || 'general audience',
      }
      if (scriptType === 'social-media') {
        options.platform = PLATFORMS[scriptType] || 'instagram'
      }
      if (keywordsSeed.trim()) {
        options.keywords = keywordsSeed.split(/[\s,]+/).filter(Boolean).slice(0, 10)
      }

      const res = await apiPost<{ data?: Script; success?: boolean }>('/scripts/generate', {
        topic: topic.trim(),
        type: scriptType,
        options,
      })
      const data = extractApiData(res as any) ?? (res as any)?.data
      if (data && (data as Script)._id) {
        setSuccess('Script generated!')
        showToast('Script generated successfully!', 'success')
        setLastGeneratedId((data as Script)._id)
        await loadScripts()
        setShowForm(false)
        setTopic('')
      }
    } catch (err: any) {
      const errObj = extractApiError(err)
      const msg = typeof errObj === 'string' ? errObj : errObj?.message || 'Failed to generate script'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async (scriptId: string, format: string = 'txt') => {
    try {
      const response = await api.get(`/scripts/${scriptId}/export?format=${format}`, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `script-${scriptId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Script exported!', 'success')
    } catch {
      showToast('Export failed', 'error')
    }
  }

  const handleCopy = async (s: Script) => {
    if (!s.script) {
      try {
        const res = await apiGet<{ data?: Script }>(`/scripts/${s._id}`)
        const full = (res as any)?.data ?? extractApiData(res as any)
        if (full?.script) {
          await navigator.clipboard.writeText(full.script)
          setCopyId(s._id)
          showToast('Copied to clipboard', 'success')
          setTimeout(() => setCopyId(null), 2000)
        }
      } catch {
        showToast('Could not load script to copy', 'error')
      }
      return
    }
    try {
      await navigator.clipboard.writeText(s.script)
      setCopyId(s._id)
      showToast('Copied to clipboard', 'success')
      setTimeout(() => setCopyId(null), 2000)
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  const handleDuplicate = async (scriptId: string) => {
    try {
      const res = await apiPost<{ data?: Script }>(`/scripts/${scriptId}/duplicate`, {})
      const dup = (res as any)?.data ?? extractApiData(res as any)
      if (dup?._id) {
        showToast('Script duplicated', 'success')
        await loadScripts()
      }
    } catch {
      showToast('Duplicate failed', 'error')
    }
  }

  const handleDelete = async (scriptId: string) => {
    if (!confirm('Delete this script?')) return
    try {
      await apiDelete(`/scripts/${scriptId}`)
      showToast('Script deleted', 'success')
      if (lastGeneratedId === scriptId) setLastGeneratedId(null)
      await loadScripts()
    } catch {
      showToast('Delete failed', 'error')
    }
  }

  const lastGenerated = lastGeneratedId ? scripts.find((s) => s._id === lastGeneratedId) : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading scripts..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Script Generator</h1>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {showForm ? 'Cancel' : '+ Generate Script'}
            </button>
          </div>

          {error && <ErrorAlert message={error} onClose={() => setError('')} />}
          {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

          {showForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Generate New Script</h2>
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Quick topics</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TOPICS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setTopic(q)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-700 dark:text-gray-200"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="script-topic" className="block text-sm font-medium mb-2">Topic *</label>
                    <input
                      id="script-topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., How to grow your YouTube channel"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="script-type" className="block text-sm font-medium mb-2">Type *</label>
                    <select
                      id="script-type"
                      value={scriptType}
                      onChange={(e) => setScriptType(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="youtube">YouTube Video</option>
                      <option value="podcast">Podcast</option>
                      <option value="social-media">Social Media</option>
                      <option value="blog">Blog</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  {(scriptType === 'youtube' || scriptType === 'podcast') && (
                    <div>
                      <label htmlFor="script-duration" className="block text-sm font-medium mb-2">Duration (min)</label>
                      <input
                        id="script-duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10) || 10)}
                        min={1}
                        max={120}
                        className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="script-tone" className="block text-sm font-medium mb-2">Tone</label>
                    <select
                      id="script-tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
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
                    <label htmlFor="script-audience" className="block text-sm font-medium mb-2">Target audience</label>
                    <input
                      id="script-audience"
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder={(user as any)?.niche || 'e.g., entrepreneurs'}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="script-keywords" className="block text-sm font-medium mb-2">Keywords (optional)</label>
                    <input
                      id="script-keywords"
                      type="text"
                      value={keywordsSeed}
                      onChange={(e) => setKeywordsSeed(e.target.value)}
                      placeholder="e.g., growth, tips, strategy"
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={generating}
                  className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <LoadingSpinner size="sm" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? 'Generating...' : 'Generate Script'}
                </button>
              </form>
            </div>
          )}

          {lastGenerated && (
            <div className="mb-6 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Just generated</p>
                <p className="text-gray-700 dark:text-gray-300">{lastGenerated.title}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/scripts/${lastGenerated._id}`)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(lastGenerated._id, 'txt')}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(lastGenerated)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  {copyId === lastGenerated._id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setLastGeneratedId(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Your Scripts</h2>
              {scripts.length === 0 ? (
                <EmptyState
                  title="No scripts yet"
                  description="Generate your first script to get started"
                  icon="📝"
                />
              ) : (
                <div className="space-y-4">
                  {scripts.map((s) => (
                    <div
                      key={s._id}
                      className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{s.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {s.type} · {s.wordCount} words{s.duration != null ? ` · ${s.duration} min` : ''}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 truncate">Topic: {s.topic}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/scripts/${s._id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExport(s._id, 'txt')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            <Download className="w-4 h-4" />
                            Export
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            {copyId === s._id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(s._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            <CopyPlus className="w-4 h-4" />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s._id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
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
    </ErrorBoundary>
  )
}
