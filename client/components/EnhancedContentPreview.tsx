'use client'

import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Content {
  _id: string
  title: string
  type: string
  generatedContent?: {
    socialPosts?: Array<{
      platform: string
      content: string
      hashtags: string[]
    }>
  }
}

interface EnhancedContentPreviewProps {
  content: Content
  onClose: () => void
}

const platformStyles: Record<string, { bg: string; text: string; border: string }> = {
  twitter: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
  linkedin: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
  instagram: { bg: 'bg-pink-50', text: 'text-pink-900', border: 'border-pink-200' },
  facebook: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
  tiktok: { bg: 'bg-black', text: 'text-white', border: 'border-gray-800' },
  youtube: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' }
}

export default function EnhancedContentPreview({ content, onClose }: EnhancedContentPreviewProps) {
  const { showToast } = useToast()
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    showToast('Copied to clipboard', 'success')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSchedule = async (platform: string, postContent: string) => {
    // Navigate to scheduler with pre-filled data
    const params = new URLSearchParams({
      platform,
      content: postContent,
      contentId: content._id
    })
    window.location.href = `/dashboard/scheduler?${params.toString()}`
  }

  const posts = content.generatedContent?.socialPosts || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold">{content.title || 'Content Preview'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Platform Filter */}
          {posts.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedPlatform(null)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    selectedPlatform === null
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  All Platforms
                </button>
                {Array.from(new Set(posts.map(p => p.platform))).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                      selectedPlatform === platform
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-4">
            {posts
              .filter(post => !selectedPlatform || post.platform === selectedPlatform)
              .map((post, index) => {
                const platformStyle = platformStyles[post.platform.toLowerCase()] || {
                  bg: 'bg-gray-50',
                  text: 'text-gray-900',
                  border: 'border-gray-200'
                }
                const postId = `${post.platform}-${index}`

                return (
                  <div
                    key={index}
                    className={`border-2 rounded-lg p-6 ${platformStyle.bg} ${platformStyle.border}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${platformStyle.text} bg-white dark:bg-gray-800`}>
                          {post.platform.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(post.content, postId)}
                          className={`px-3 py-1 rounded text-sm ${
                            copied === postId
                              ? 'bg-green-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                        >
                          {copied === postId ? '✓ Copied' : '📋 Copy'}
                        </button>
                        <button
                          onClick={() => handleSchedule(post.platform, post.content)}
                          className="px-3 py-1 rounded text-sm bg-purple-600 text-white hover:bg-purple-700"
                        >
                          📅 Schedule
                        </button>
                      </div>
                    </div>

                    <div className={`${platformStyle.text} whitespace-pre-wrap mb-4`}>
                      {post.content}
                    </div>

                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.hashtags.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs text-purple-600 dark:text-purple-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Character Count */}
                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                      {post.content.length} characters
                      {post.platform === 'twitter' && (
                        <span className={post.content.length > 280 ? 'text-red-600' : ''}>
                          {' '}/ 280 (Twitter limit)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>

          {posts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No generated content available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}







