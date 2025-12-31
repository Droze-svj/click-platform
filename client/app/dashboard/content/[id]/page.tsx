'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'

// Lazy load heavy components for better performance
const VersionHistory = lazy(() => import('../../../../components/VersionHistory'))
const CommentsSection = lazy(() => import('../../../../components/CommentsSection'))
const ContentPerformanceAnalytics = lazy(() => import('../../../../components/ContentPerformanceAnalytics'))
const LiveCollaboration = lazy(() => import('../../../../components/LiveCollaboration'))
const ContentInsights = lazy(() => import('../../../../components/ContentInsights'))
const ContentHealthChecker = lazy(() => import('../../../../components/ContentHealthChecker'))
const ContentSchedulingAssistant = lazy(() => import('../../../../components/ContentSchedulingAssistant'))
const ContentDuplicator = lazy(() => import('../../../../components/ContentDuplicator'))
const OneClickPublish = lazy(() => import('../../../../components/OneClickPublish'))
const ContentApprovalButton = lazy(() => import('../../../../components/ContentApprovalButton'))

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Content {
  _id: string
  title: string
  description: string
  type: string
  status: string
  transcript: string
  generatedContent: any
  tags: string[]
  category: string
  isFavorite: boolean
  folderId?: {
    _id: string
    name: string
    color: string
  }
  createdAt: string
  updatedAt: string
}

export default function ContentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'comments' | 'performance'>('overview')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    if (params.id) {
      loadContent()
    }
  }, [user, router, params.id])

  const loadContent = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/content/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const contentData = extractApiData<Content>(response) || (response.data && response.data._id ? response.data : null)
      if (contentData) {
        setContent(contentData)
      }
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load content', 'error')
      router.push('/dashboard/content')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!content) return

    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/library/content/${content._id}/organize`,
        { isFavorite: !content.isFavorite },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const updatedContent = { ...content, isFavorite: !content.isFavorite }
      setContent(updatedContent)
      showToast(updatedContent.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success')
    } catch (error) {
      showToast('Failed to update favorite', 'error')
    }
  }

  const handleAddTag = async (tag: string) => {
    if (!content || !tag.trim()) return

    const newTags = [...(content.tags || []), tag.trim()]
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/library/content/${content._id}/organize`,
        { tags: newTags },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      setContent({ ...content, tags: newTags })
      showToast('Tag added', 'success')
    } catch (error) {
      showToast('Failed to add tag', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading content..." />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Content not found</p>
          <button
            onClick={() => router.push('/dashboard/content')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Content
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/content')}
            className="text-purple-600 hover:text-purple-800 mb-4"
          >
            ← Back to Content
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{content.title || 'Untitled'}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="capitalize">{content.type}</span>
                <span className={`px-2 py-1 rounded ${
                  content.status === 'completed' ? 'bg-green-100 text-green-800' :
                  content.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {content.status}
                </span>
                {content.folderId && (
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: content.folderId.color }}
                    />
                    <span>{content.folderId.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggleFavorite}
                className={`px-4 py-2 rounded-lg ${
                  content.isFavorite
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {content.isFavorite ? '⭐ Favorited' : '☆ Favorite'}
              </button>
              <button
                onClick={() => router.push(`/dashboard/library`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Organize
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'versions'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Versions
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'comments'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Comments
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'performance'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Performance
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {content.description && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Description</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{content.description}</p>
                </div>
              )}

              {content.transcript && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Transcript</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{content.transcript}</p>
                </div>
              )}

              {content.generatedContent && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Generated Content</h2>
                  {content.generatedContent.socialPosts && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Social Media Posts</h3>
                      {content.generatedContent.socialPosts.map((post: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                              {post.platform}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(post.content)
                                showToast('Copied to clipboard', 'success')
                              }}
                              className="text-sm text-purple-600 hover:text-purple-800"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {post.hashtags.map((tag: string, i: number) => (
                                <span key={i} className="text-xs text-purple-600">#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex gap-2">
                  <ContentDuplicator 
                    contentId={content._id}
                    onDuplicate={(newId) => router.push(`/dashboard/content/${newId}`)}
                    className="flex-1"
                  />
                  <OneClickPublish contentId={content._id} />
                </div>
              </div>

              {/* Content Health Checker */}
              <ContentHealthChecker
                content={{
                  text: content.transcript || content.description || '',
                  title: content.title,
                  tags: content.tags,
                  description: content.description,
                  type: content.type,
                }}
                onFix={(issue, suggestion) => {
                  showToast(`Fix: ${suggestion}`, 'info')
                }}
              />

              {/* Quick Insights */}
              <ContentInsights contentId={content._id} compact={true} />

              {/* Scheduling Assistant */}
              <ContentSchedulingAssistant
                contentId={content._id}
                content={{
                  text: content.transcript || content.description,
                  type: content.type,
                }}
              />

              {/* Details */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Details</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium capitalize">{content.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium capitalize">{content.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium">{content.category || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium">{new Date(content.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Updated</p>
                    <p className="font-medium">{new Date(content.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {content.tags && content.tags.map((tag, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add tag..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag(e.currentTarget.value)
                      e.currentTarget.value = ''
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <Suspense fallback={<LoadingSpinner size="md" />}>
            <VersionHistory contentId={content._id} onRestore={loadContent} />
          </Suspense>
        )}

        {activeTab === 'comments' && (
          <Suspense fallback={<LoadingSpinner size="md" />}>
            <CommentsSection entityType="content" entityId={content._id} teamId={undefined} />
          </Suspense>
        )}

        {activeTab === 'performance' && (
          <Suspense fallback={<LoadingSpinner size="md" />}>
            <ContentPerformanceAnalytics contentId={content._id} />
          </Suspense>
        )}
      </div>

      {/* Live Collaboration */}
      <Suspense fallback={<LoadingSpinner size="sm" />}>
        <LiveCollaboration
          contentId={content._id}
          onContentChange={(change) => {
            // Handle real-time content changes
            // Content changes are handled automatically by LiveCollaboration component
          }}
        />
      </Suspense>
      </div>
    </ErrorBoundary>
  )
}

