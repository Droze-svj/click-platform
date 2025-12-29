'use client'

import { useState } from 'react'
import { Sparkles, Zap, FileText, Video, Mic, Copy } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface QuickContentCreatorProps {
  onContentCreated?: (contentId: string) => void
}

interface QuickTemplate {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  platforms: string[]
  preset: {
    type: string
    title: string
    text: string
  }
}

export default function QuickContentCreator({ onContentCreated }: QuickContentCreatorProps) {
  const [showModal, setShowModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<QuickTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [quickText, setQuickText] = useState('')

  const quickTemplates: QuickTemplate[] = [
    {
      id: 'quote',
      name: 'Quote Card',
      icon: <FileText className="w-5 h-5" />,
      description: 'Create an inspiring quote card',
      platforms: ['instagram', 'twitter', 'linkedin'],
      preset: {
        type: 'article',
        title: 'Quote Card',
        text: 'Enter your quote here...'
      }
    },
    {
      id: 'tip',
      name: 'Quick Tip',
      icon: <Zap className="w-5 h-5" />,
      description: 'Share a quick tip or hack',
      platforms: ['twitter', 'linkedin', 'facebook'],
      preset: {
        type: 'article',
        title: 'Quick Tip',
        text: 'Share your tip here...'
      }
    },
    {
      id: 'video',
      name: 'Video Post',
      icon: <Video className="w-5 h-5" />,
      description: 'Upload and repurpose a video',
      platforms: ['youtube', 'tiktok', 'instagram'],
      preset: {
        type: 'video',
        title: 'Video Post',
        text: ''
      }
    },
    {
      id: 'thread',
      name: 'Twitter Thread',
      icon: <Copy className="w-5 h-5" />,
      description: 'Create a Twitter thread',
      platforms: ['twitter'],
      preset: {
        type: 'article',
        title: 'Twitter Thread',
        text: 'Enter your thread content...'
      }
    },
    {
      id: 'ai-idea',
      name: 'AI Idea',
      icon: <Sparkles className="w-5 h-5" />,
      description: 'Get AI-generated content ideas',
      platforms: ['twitter', 'linkedin', 'instagram'],
      preset: {
        type: 'article',
        title: 'AI Generated Idea',
        text: ''
      }
    }
  ]

  const handleQuickCreate = async (template: QuickTemplate) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      // If it's an AI idea, generate it first
      if (template.id === 'ai-idea') {
        const ideaResponse = await axios.post(
          `${API_URL}/ai/generate-idea`,
          { platforms: template.platforms },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        
        if (ideaResponse.data.success) {
          template.preset.text = ideaResponse.data.data.idea
          template.preset.title = ideaResponse.data.data.title
        }
      }

      // Create content
      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          text: template.preset.text || quickText,
          title: template.preset.title,
          type: template.preset.type,
          platforms: template.platforms
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data?.contentId) {
        onContentCreated?.(response.data.data.contentId)
        setShowModal(false)
        setSelectedTemplate(null)
        setQuickText('')
      }
    } catch (error: any) {
      console.error('Quick create error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickText = async () => {
    if (!quickText.trim()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.post(
        `${API_URL}/content/generate`,
        {
          text: quickText,
          title: 'Quick Content',
          type: 'article',
          platforms: ['twitter', 'linkedin', 'instagram']
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data?.contentId) {
        onContentCreated?.(response.data.data.contentId)
        setQuickText('')
        setShowModal(false)
      }
    } catch (error: any) {
      console.error('Quick text error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Quick Create Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2 font-semibold"
      >
        <Sparkles className="w-5 h-5" />
        Quick Create
      </button>

      {/* Quick Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Quick Content Creation
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false)
                    setSelectedTemplate(null)
                    setQuickText('')
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* Quick Text Input */}
              <div className="mb-6">
                <textarea
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  placeholder="Paste your content here and we'll adapt it for all platforms..."
                  className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
                <button
                  onClick={handleQuickText}
                  disabled={!quickText.trim() || loading}
                  className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create & Adapt'}
                </button>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                OR choose a template
              </div>

              {/* Templates Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {quickTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleQuickCreate(template)}
                    disabled={loading}
                    className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-blue-600 dark:text-blue-400">
                        {template.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {template.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {template.platforms.slice(0, 2).map((platform) => (
                        <span
                          key={platform}
                          className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
                        >
                          {platform}
                        </span>
                      ))}
                      {template.platforms.length > 2 && (
                        <span className="text-xs text-gray-500">+{template.platforms.length - 2}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


