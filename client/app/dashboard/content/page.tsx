'use client'

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'

// Lazy load heavy components for better performance
const PredictiveAnalytics = lazy(() => import('../../../components/PredictiveAnalytics'))
const AIRecommendations = lazy(() => import('../../../components/AIRecommendations'))

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface GeneratedContent {
  socialPosts: Array<{
    platform: string
    content: string
    hashtags: string[]
  }>
  blogSummary: string
  viralIdeas: Array<{
    title: string
    description: string
    platform: string
  }>
}

export default function ContentPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'linkedin', 'instagram'])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [contentId, setContentId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
  }, [user, router])

  // Listen for real-time content generation updates
  useEffect(() => {
    if (!socket || !connected) return

    const handleContentGenerated = (data: any) => {
      if (data.status === 'completed' && data.contentId === contentId) {
        loadGeneratedContent(data.contentId)
        setSuccess('Content generated successfully!')
      } else if (data.status === 'failed') {
        setError('Content generation failed')
      }
    }

    on('content-generated', handleContentGenerated)

    return () => {
      off('content-generated', handleContentGenerated)
    }
  }, [socket, connected, contentId, on, off])

  const loadGeneratedContent = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/content/${id}`, {
      })
      if (response.data.generatedContent) {
        setGeneratedContent(response.data.generatedContent)
      }
    } catch (error) {
      // Silently fail - content will load via polling or socket
      // Error handling is done at the parent level
    }
  }

  const handlePlatformToggle = useCallback((platform: string) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }, [])

  const handleGenerate = async () => {
    // Validate input
    if (!text.trim()) {
      setError('Please enter some text content')
      return
    }

    // Backend validation requires at least 50 characters (see server validators).
    if (text.trim().length < 50) {
      setError('Please enter at least 50 characters of content')
      return
    }

    if (text.trim().length > 50000) {
      setError('Content is too long. Please keep it under 50,000 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setGeneratedContent(null)

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          text,
          title: title || undefined,
          platforms
        },
        {
        }
      )

      const data = extractApiData<{ contentId: string }>(response)
      const id = data?.contentId
      if (id) {
        setContentId(id)
        setSuccess('Content generation started! This may take a moment...')
      }

      // Track action for workflow learning
      if (id) {
        try {
          await axios.post(
            `${API_URL}/workflows/track`,
            {
              action: 'generate_content',
              metadata: {
                entityType: 'content',
                entityId: id,
                platforms: platforms
              }
            },
            {
            }
          )
        } catch (err) {
          // Silent fail for tracking
          console.error('Failed to track action', err)
        }
      }

      // Real-time updates via Socket.io, fallback to polling if not connected
      if (id) {
        if (!connected) {
          pollContentStatus(id)
        }
      }
    } catch (error: any) {
      const errorObj = extractApiError(error)
      setError(typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Failed to generate content')
    } finally {
      setLoading(false)
    }
  }

  const pollContentStatus = async (id: string) => {
    const token = localStorage.getItem('token')
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_URL}/content/${id}`, {
        })

        if (response.data.status === 'completed' && response.data.generatedContent) {
          clearInterval(interval)
          setGeneratedContent(response.data.generatedContent)
          setSuccess('Content generated successfully!')
        } else if (response.data.status === 'failed') {
          clearInterval(interval)
          setError('Content generation failed')
          clearInterval(interval)
        }
      } catch (error) {
        clearInterval(interval)
      }
    }, 2000)

    setTimeout(() => clearInterval(interval), 60000)
  }

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard!')
    setTimeout(() => setSuccess(''), 2000)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Content Generator</h1>
          <p className="text-sm md:text-base text-gray-600">Transform your articles and blog posts into social media content</p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <SuccessAlert message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Input</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter title..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Paste your article, blog post, or transcript here..."
              />
              <p className="text-xs text-gray-500 mt-1">{text.length} characters</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => handlePlatformToggle(platform)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      platforms.includes(platform)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </button>
                ))}
              </div>
            </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !text.trim()}
                    className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                    aria-label={loading ? 'Generating content, please wait' : 'Generate content from text'}
                    aria-busy={loading}
                  >
                    {loading ? 'Generating...' : 'Generate Content'}
                  </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Generated Content</h2>
            
            {loading && (
              <div className="py-8 md:py-12">
                <LoadingSpinner size="lg" text="Generating content..." />
              </div>
            )}

            {!loading && !generatedContent && (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <p className="text-sm md:text-base">Generated content will appear here</p>
              </div>
            )}

            {generatedContent && (
              <div className="space-y-6">
                {generatedContent.socialPosts && generatedContent.socialPosts.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Social Media Posts</h3>
                    <div className="space-y-3 md:space-y-4">
                      {generatedContent.socialPosts.map((post, index) => (
                        <div key={index} className="border rounded-lg p-3 md:p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                              {post.platform}
                            </span>
                            <button
                              onClick={() => copyToClipboard(post.content)}
                              className="text-sm text-purple-600 hover:text-purple-800 touch-target px-2"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {post.hashtags.map((tag, i) => (
                                <span key={i} className="text-xs text-purple-600">#{tag.replace('#', '')}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {generatedContent.blogSummary && (
                  <div>
                    <h3 className="font-semibold mb-3">Blog Summary</h3>
                    <div className="border rounded-lg p-4">
                      <button
                        onClick={() => copyToClipboard(generatedContent.blogSummary)}
                        className="text-sm text-purple-600 hover:text-purple-800 mb-2"
                      >
                        Copy
                      </button>
                      <p className="text-sm whitespace-pre-wrap">{generatedContent.blogSummary}</p>
                    </div>
                  </div>
                )}

                {generatedContent.viralIdeas && generatedContent.viralIdeas.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Viral Post Ideas</h3>
                    <div className="space-y-3">
                      {generatedContent.viralIdeas.map((idea, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h4 className="font-semibold mb-1">{idea.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{idea.description}</p>
                          <span className="text-xs text-purple-600">{idea.platform}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Features Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-2xl">💡</span>
              AI Recommendations
            </h2>
            <Suspense fallback={<LoadingSpinner size="md" text="Loading recommendations..." />}>
              <AIRecommendations />
            </Suspense>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Performance Prediction
            </h2>
            <Suspense fallback={<LoadingSpinner size="md" text="Loading analytics..." />}>
              <PredictiveAnalytics />
            </Suspense>
          </div>
        </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

