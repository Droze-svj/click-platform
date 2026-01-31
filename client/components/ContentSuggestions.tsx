'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '../lib/api'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'

interface ContentIdea {
  title: string
  description: string
  platforms: string[]
  hashtags: string[]
  contentType: string
}

export default function ContentSuggestions() {
  const router = useRouter()
  const { showToast } = useToast()
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [gaps, setGaps] = useState<any[]>([])
  const [trending, setTrending] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ideas' | 'gaps' | 'trending'>('ideas')

  useEffect(() => {
    loadSuggestions()
  }, [])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const [ideasRes, gapsRes, trendingRes] = await Promise.all([
        apiGet<any>('/suggestions/daily-ideas?count=5'),
        apiGet<any>('/suggestions/content-gaps'),
        apiGet<any>('/suggestions/trending')
      ])

      if (ideasRes?.success && ideasRes.data) {
        setIdeas(ideasRes.data || [])
      } else if (Array.isArray(ideasRes)) {
        setIdeas(ideasRes)
      }
      if (gapsRes?.success && gapsRes.data) {
        setGaps(gapsRes.data || [])
      } else if (Array.isArray(gapsRes)) {
        setGaps(gapsRes)
      }
      if (trendingRes?.success && trendingRes.data) {
        setTrending(trendingRes.data || [])
      } else if (Array.isArray(trendingRes)) {
        setTrending(trendingRes)
      }
    } catch (error) {
      showToast('Failed to load suggestions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUseIdea = (idea: ContentIdea) => {
    // Navigate to content generator with pre-filled data
    router.push(`/dashboard/content?idea=${encodeURIComponent(JSON.stringify(idea))}`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">💡 Content Suggestions</h2>
        <button
          onClick={loadSuggestions}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab('ideas')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'ideas'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Daily Ideas
        </button>
        <button
          onClick={() => setActiveTab('gaps')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'gaps'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Content Gaps
        </button>
        <button
          onClick={() => setActiveTab('trending')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'trending'
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Trending
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading suggestions...</div>
      ) : (
        <>
          {activeTab === 'ideas' && (
            <div className="space-y-4">
              {ideas.map((idea, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <h3 className="font-semibold mb-2">{idea.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{idea.description}</p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex gap-2">
                      {idea.platforms?.map((platform) => (
                        <span key={platform} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          {platform}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{idea.contentType}</span>
                  </div>
                  {idea.hashtags && idea.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {idea.hashtags.map((tag, i) => (
                        <span key={i} className="text-xs text-purple-600">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleUseIdea(idea)}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Use This Idea
                  </button>
                </div>
              ))}
              {ideas.length === 0 && (
                <div className="text-center py-8 text-gray-500">No ideas available</div>
              )}
            </div>
          )}

          {activeTab === 'gaps' && (
            <div className="space-y-3">
              {gaps.map((gap, index) => (
                <div key={index} className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold capitalize">{gap.platform}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {gap.count} posts • {gap.recommendation}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/content?platform=${gap.platform}`)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ))}
              {gaps.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Great! You're posting to all platforms regularly.
                </div>
              )}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="space-y-3">
              {trending.map((topic, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/content?topic=${encodeURIComponent(topic)}`)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{topic}</p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Trending</span>
                  </div>
                </div>
              ))}
              {trending.length === 0 && (
                <div className="text-center py-8 text-gray-500">No trending topics available</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}







