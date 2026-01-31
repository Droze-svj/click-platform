'use client'

import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import { useTranslation } from '../../../../hooks/useTranslation'
import { apiGet, apiPost, API_URL } from '../../../../lib/api'

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

interface Content {
  _id: string
  title: string
  description: string
  type: string
  status: string
  transcript: string
  body?: string
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
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'comments' | 'performance' | 'translations'>('overview')
  const { t } = useTranslation()
  const [translationList, setTranslationList] = useState<{ language: string; _id: string }[]>([])
  const [supportedLangs, setSupportedLangs] = useState<{ code: string; name: string }[]>([])
  const [viewingLang, setViewingLang] = useState<string | null>(null)
  const [translatedContent, setTranslatedContent] = useState<{ title: string; description: string; body: string; transcript: string; tags: string[] } | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('es')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    if (params.id) {
      loadContent()
    }
  }, [user, router, params.id])

  const loadTranslations = useCallback(async () => {
    if (!content?._id) return
    try {
      const [listRes, langsRes] = await Promise.all([
        apiGet<{ data?: { translations?: { language: string; _id: string }[] }; translations?: { language: string; _id: string }[] }>('/translation/content/' + content._id + '/translations'),
        apiGet<{ data?: { languages?: { code: string; name: string }[] }; languages?: { code: string; name: string }[] }>('/translation/languages')
      ])
      const list = (listRes as any)?.data?.translations ?? (listRes as any)?.translations ?? []
      const langs = (langsRes as any)?.data?.languages ?? (langsRes as any)?.languages ?? []
      setTranslationList(Array.isArray(list) ? list : [])
      setSupportedLangs(Array.isArray(langs) ? langs : [])
    } catch {
      setTranslationList([])
      setSupportedLangs([])
    }
  }, [content?._id])

  useEffect(() => {
    if (activeTab === 'translations' && content?._id) loadTranslations()
  }, [activeTab, content?._id, loadTranslations])

  const handleTranslate = async () => {
    if (!content?._id || !targetLanguage || isTranslating) return
    setIsTranslating(true)
    try {
      await apiPost('/translation/translate', { contentId: content._id, targetLanguage })
      showToast(t('translation.translated'), 'success')
      await loadTranslations()
    } catch (e: any) {
      showToast(t('translation.translationFailed') + ': ' + (e?.response?.data?.error || e?.message || ''), 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleTranslateToAll = async () => {
    if (!content?._id || isTranslating) return
    setIsTranslating(true)
    try {
      const res = await apiPost<{ data?: { successful?: { length: number }; failed?: { length: number } }; successful?: { length: number }; failed?: { length: number } }>('/translation/translate-multiple', {
        contentId: content._id,
        languages: ['es', 'fr', 'de']
      })
      const d = (res as any)?.data ?? res
      const ok = (d?.successful ?? [])?.length ?? 0
      const fail = (d?.failed ?? [])?.length ?? 0
      showToast(t('translation.translated') + ` (${ok} ok${fail ? `, ${fail} failed` : ''})`, fail ? 'info' : 'success')
      await loadTranslations()
    } catch (e: any) {
      showToast(t('translation.translationFailed') + ': ' + (e?.response?.data?.error || e?.message || ''), 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleViewInLanguage = async (lang: string) => {
    if (!content?._id) return
    try {
      const res = await apiGet<{ data?: any }>('/translation/content/' + content._id + '/' + lang + '?fallbackToOriginal=true')
      const d = (res as any)?.data ?? res
      if (d) {
        setViewingLang(lang)
        setTranslatedContent({
          title: d.title ?? '',
          description: d.description ?? '',
          body: d.body ?? '',
          transcript: d.transcript ?? '',
          tags: d.tags ?? []
        })
      }
    } catch {
      showToast(t('translation.translationFailed'), 'error')
    }
  }

  const handleViewOriginal = () => {
    setViewingLang(null)
    setTranslatedContent(null)
  }

  const loadContent = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/content/${params.id}`, {
      })

      const contentData = extractApiData<Content>(response) || (response.data && response.data._id ? response.data : null)
      if (contentData) {
        setContent(contentData)
      }
    } catch (error) {
      const errorObj = extractApiError(error)
      showToast(typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Failed to load content', 'error')
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
          <button
            onClick={() => setActiveTab('translations')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'translations'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('translation.title')}
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

        {activeTab === 'translations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">{t('translation.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('translation.translateTo')} {t('translation.targetLanguage')}. {t('translation.translate')} title, description, body, transcript, and tags.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  {(supportedLangs.length > 0 ? supportedLangs : [
                    { code: 'es', name: 'Spanish' },
                    { code: 'fr', name: 'French' },
                    { code: 'de', name: 'German' }
                  ]).map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isTranslating ? t('translation.translating') : t('translation.translate')}
                </button>
                <button
                  onClick={handleTranslateToAll}
                  disabled={isTranslating}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {t('translation.translateToAll')} (es, fr, de)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {viewingLang && (
                  <button
                    onClick={handleViewOriginal}
                    className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm font-medium"
                  >
                    {t('translation.viewOriginal')}
                  </button>
                )}
                {translationList.map((tr) => (
                  <button
                    key={tr._id}
                    onClick={() => handleViewInLanguage(tr.language)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      viewingLang === tr.language
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t('translation.viewIn')} {tr.language.toUpperCase()}
                  </button>
                ))}
                {translationList.length === 0 && !viewingLang && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('translation.noTranslations')}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const display = viewingLang && translatedContent
                  ? { ...translatedContent, _lang: viewingLang }
                  : { title: content.title, description: content.description, body: content.body ?? content.transcript, transcript: content.transcript, tags: content.tags ?? [], _lang: null as string | null }
                return (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-2">{display.title || 'Untitled'}</h3>
                    {display._lang && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">{t('translation.viewIn')} {display._lang.toUpperCase()}</p>
                    )}
                    {display.description && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</h4>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{display.description}</p>
                      </div>
                    )}
                    {display.body && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Body</h4>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{display.body}</p>
                      </div>
                    )}
                    {display.transcript && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Transcript</h4>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{display.transcript}</p>
                      </div>
                    )}
                    {display.tags && display.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {display.tags.map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded text-sm">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
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

