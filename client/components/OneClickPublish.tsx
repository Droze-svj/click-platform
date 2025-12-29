'use client'

import { useState } from 'react'
import { Send, CheckCircle2, Loader2, X } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface Platform {
  id: string
  name: string
  icon: string
  connected: boolean
}

interface OneClickPublishProps {
  contentId: string
  platforms?: Platform[]
}

export default function OneClickPublish({ contentId, platforms }: OneClickPublishProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [published, setPublished] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { showToast } = useToast()

  const defaultPlatforms: Platform[] = platforms || [
    { id: 'twitter', name: 'Twitter/X', icon: '🐦', connected: false },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', connected: false },
    { id: 'facebook', name: 'Facebook', icon: '📘', connected: false },
    { id: 'instagram', name: 'Instagram', icon: '📷', connected: false },
  ]

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  const handlePublish = async () => {
    if (selectedPlatforms.length === 0) {
      showToast('Please select at least one platform', 'error')
      return
    }

    setIsPublishing(true)
    const publishedPlatforms: string[] = []

    try {
      // Publish to all selected platforms
      for (const platformId of selectedPlatforms) {
        try {
          const response = await fetch(`/api/social/post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              platform: platformId,
              contentId,
            }),
          })

          if (response.ok) {
            publishedPlatforms.push(platformId)
          }
        } catch (error) {
          console.error(`Failed to publish to ${platformId}:`, error)
        }
      }

      if (publishedPlatforms.length > 0) {
        setPublished(publishedPlatforms)
        showToast(
          `Published to ${publishedPlatforms.length} platform${publishedPlatforms.length > 1 ? 's' : ''}!`,
          'success'
        )
        
        // Reset after 3 seconds
        setTimeout(() => {
          setPublished([])
          setSelectedPlatforms([])
          setIsOpen(false)
        }, 3000)
      } else {
        showToast('Failed to publish to any platform', 'error')
      }
    } catch (error) {
      showToast('Publishing failed', 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
      >
        <Send className="w-4 h-4" />
        <span>Publish</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Publish to Platforms
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {defaultPlatforms.map((platform) => {
            const isSelected = selectedPlatforms.includes(platform.id)
            const isPublished = published.includes(platform.id)

            return (
              <button
                key={platform.id}
                onClick={() => !isPublished && handlePlatformToggle(platform.id)}
                disabled={isPublishing || isPublished || !platform.connected}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                  isPublished
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${
                  !platform.connected
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {platform.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPublished ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-600 dark:text-green-400">Published</span>
                    </>
                  ) : isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : !platform.connected ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Not connected</span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || selectedPlatforms.length === 0 || published.length > 0}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publish</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}






