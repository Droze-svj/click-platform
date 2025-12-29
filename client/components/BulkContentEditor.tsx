'use client'

import { useState } from 'react'
import { Edit3, Save, X, CheckCircle2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface BulkContentEditorProps {
  selectedIds: string[]
  onClose: () => void
  onUpdate: () => void
}

export default function BulkContentEditor({ selectedIds, onClose, onUpdate }: BulkContentEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [updates, setUpdates] = useState({
    tags: '',
    category: '',
    folderId: '',
    status: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const { showToast } = useToast()

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      showToast('No items selected', 'error')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const payload: any = {}
      
      if (updates.tags) payload.tags = updates.tags.split(',').map(t => t.trim())
      if (updates.category) payload.category = updates.category
      if (updates.folderId) payload.folderId = updates.folderId
      if (updates.status) payload.status = updates.status

      const response = await fetch('/api/batch/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          contentIds: selectedIds,
          updates: payload,
        }),
      })

      if (response.ok) {
        showToast(`Updated ${selectedIds.length} item(s)`, 'success')
        onUpdate()
        onClose()
      } else {
        showToast('Failed to update items', 'error')
      }
    } catch (error) {
      showToast('Failed to update items', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (selectedIds.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[400px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Bulk Edit ({selectedIds.length} items)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Selected Items</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={updates.tags}
                onChange={(e) => setUpdates({ ...updates, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={updates.category}
                onChange={(e) => setUpdates({ ...updates, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">No change</option>
                <option value="social">Social</option>
                <option value="blog">Blog</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={updates.status}
                onChange={(e) => setUpdates({ ...updates, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">No change</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}






