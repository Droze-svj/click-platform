'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import ErrorAlert from '../../../../components/ErrorAlert'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Script {
  _id: string
  title: string
  type: string
  topic: string
  wordCount: number
  duration?: number
  script: string
  structure: {
    introduction: string
    mainPoints: Array<{ title: string; content: string; duration: number }>
    conclusion: string
    callToAction: string
  }
  metadata: {
    keywords: string[]
    hashtags: string[]
    timestamps: Array<{ time: string; section: string }>
  }
}

export default function ScriptDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editedScript, setEditedScript] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadScript()
  }, [user, router, params.id])

  const loadScript = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/scripts/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setScript(response.data.data)
        setEditedScript(response.data.data.script)
      }
    } catch (error: any) {
      showToast('Failed to load script', 'error')
      router.push('/dashboard/scripts')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!script) return

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${API_URL}/scripts/${script._id}`,
        { script: editedScript },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      if (response.data.success) {
        setScript(response.data.data)
        setEditing(false)
        showToast('Script saved successfully!', 'success')
      }
    } catch (error: any) {
      showToast('Failed to save script', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (format: string) => {
    if (!script) return

    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/scripts/${script._id}/export?format=${format}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${script.title.replace(/\s+/g, '-')}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast('Script exported successfully!', 'success')
    } catch (error: any) {
      showToast('Failed to export script', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading script..." />
      </div>
    )
  }

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorAlert message="Script not found" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push('/dashboard/scripts')}
              className="text-purple-600 hover:underline mb-2"
            >
              ← Back to Scripts
            </button>
            <h1 className="text-3xl font-bold">{script.title}</h1>
            <p className="text-gray-600 mt-2">
              {script.type} • {script.wordCount} words
              {script.duration && ` • ${script.duration} minutes`}
            </p>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Export TXT
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  Export JSON
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setEditedScript(script.script)
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {editing ? (
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              className="w-full h-96 p-4 border rounded-lg font-mono text-sm"
              placeholder="Edit your script..."
            />
          ) : (
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                {script.script}
              </div>

              {script.structure.mainPoints && script.structure.mainPoints.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-4">Structure</h3>
                  <div className="space-y-4">
                    {script.structure.introduction && (
                      <div>
                        <h4 className="font-semibold">Introduction</h4>
                        <p className="text-gray-700">{script.structure.introduction}</p>
                      </div>
                    )}
                    {script.structure.mainPoints.map((point, index) => (
                      <div key={index}>
                        <h4 className="font-semibold">
                          {index + 1}. {point.title}
                          {point.duration && <span className="text-sm text-gray-500 ml-2">({point.duration} min)</span>}
                        </h4>
                        <p className="text-gray-700">{point.content}</p>
                      </div>
                    ))}
                    {script.structure.conclusion && (
                      <div>
                        <h4 className="font-semibold">Conclusion</h4>
                        <p className="text-gray-700">{script.structure.conclusion}</p>
                      </div>
                    )}
                    {script.structure.callToAction && (
                      <div>
                        <h4 className="font-semibold">Call to Action</h4>
                        <p className="text-gray-700">{script.structure.callToAction}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {script.metadata.timestamps && script.metadata.timestamps.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-4">Timestamps</h3>
                  <div className="space-y-2">
                    {script.metadata.timestamps.map((ts, index) => (
                      <div key={index} className="flex gap-4">
                        <span className="font-mono font-semibold">{ts.time}</span>
                        <span>{ts.section}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {script.metadata.keywords && script.metadata.keywords.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-4">Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {script.metadata.keywords.map((keyword, index) => (
                      <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {script.metadata.hashtags && script.metadata.hashtags.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-4">Hashtags</h3>
                  <div className="flex flex-wrap gap-2">
                    {script.metadata.hashtags.map((hashtag, index) => (
                      <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                        {hashtag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}







