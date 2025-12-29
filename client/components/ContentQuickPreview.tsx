'use client'

import { useState, useRef, useEffect } from 'react'
import { Eye, X } from 'lucide-react'

interface ContentQuickPreviewProps {
  content: {
    id: string
    title?: string
    text?: string
    type?: string
    thumbnail?: string
    createdAt?: string
    status?: string
  }
  children: React.ReactNode
}

export default function ContentQuickPreview({ content, children }: ContentQuickPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/content/${content.id}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          setPreviewData(data.data)
          setIsPreviewOpen(true)
        }
      } catch (error) {
        console.error('Failed to load preview:', error)
      } finally {
        setIsLoading(false)
      }
    }, 500) // Show preview after 500ms hover
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsPreviewOpen(false)
    setPreviewData(null)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        {children}
      </div>

      {isPreviewOpen && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-96 max-h-96 overflow-auto pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                  Quick Preview
                </h3>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto"></div>
              </div>
            ) : previewData ? (
              <div className="p-4">
                {previewData.thumbnail && (
                  <img
                    src={previewData.thumbnail}
                    alt={previewData.title || 'Preview'}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {previewData.title || 'Untitled'}
                </h4>
                
                {previewData.text && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 mb-4">
                    {previewData.text}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {previewData.type && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      {previewData.type}
                    </span>
                  )}
                  {previewData.status && (
                    <span className={`px-2 py-1 rounded ${
                      previewData.status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {previewData.status}
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}






