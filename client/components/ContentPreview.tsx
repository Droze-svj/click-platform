'use client'

import { useState } from 'react'

interface ContentPreviewProps {
  content: {
    title?: string
    type: string
    preview?: string
    thumbnail?: string
    duration?: number
    wordCount?: number
  }
  onClose: () => void
}

export default function ContentPreview({ content, onClose }: ContentPreviewProps) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {content.thumbnail && (
          <div className="mb-4">
            <img
              src={content.thumbnail}
              alt="Preview"
              className="w-full rounded-lg"
            />
          </div>
        )}

        <div className="space-y-4">
          {content.title && (
            <div>
              <h3 className="font-semibold mb-2">Title</h3>
              <p>{content.title}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
              <p className="font-medium capitalize">{content.type}</p>
            </div>
            {content.duration && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                <p className="font-medium">{content.duration} seconds</p>
              </div>
            )}
            {content.wordCount && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Word Count</p>
                <p className="font-medium">{content.wordCount} words</p>
              </div>
            )}
          </div>

          {content.preview && (
            <div>
              <h3 className="font-semibold mb-2">Preview</h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <p className="whitespace-pre-wrap text-sm">{content.preview}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}







