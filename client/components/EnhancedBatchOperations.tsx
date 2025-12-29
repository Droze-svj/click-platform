'use client'

import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import ExportImportModal from './ExportImportModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface EnhancedBatchOperationsProps {
  selectedItems: string[]
  type: 'content' | 'scripts' | 'posts'
  onComplete: () => void
  onSelectionChange?: (selected: string[]) => void
}

export default function EnhancedBatchOperations({
  selectedItems,
  type,
  onComplete,
  onSelectionChange
}: EnhancedBatchOperationsProps) {
  const { showToast } = useToast()
  const [operation, setOperation] = useState<'delete' | 'export' | 'import' | 'tag' | 'folder' | null>(null)
  const [loading, setLoading] = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')

  if (selectedItems.length === 0) {
    return null
  }

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items? This action cannot be undone.`)) {
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = type === 'content'
        ? `${API_URL}/batch/delete-content`
        : type === 'scripts'
        ? `${API_URL}/batch/delete-scripts`
        : `${API_URL}/batch/delete-posts`
      
      const body = type === 'content'
        ? { contentIds: selectedItems }
        : type === 'scripts'
        ? { scriptIds: selectedItems }
        : { postIds: selectedItems }

      await axios.post(endpoint, body, {
        headers: { Authorization: `Bearer ${token}` }
      })

      showToast(`Deleted ${selectedItems.length} items successfully`, 'success')
      onSelectionChange?.([])
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete items', 'error')
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBatchTag = async () => {
    if (!newTag.trim()) {
      showToast('Please enter a tag', 'error')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      // Update each item with the new tag
      const promises = selectedItems.map(id =>
        axios.put(
          `${API_URL}/library/content/${id}/organize`,
          { tags: [newTag.trim()] }, // Add tag
          { headers: { Authorization: `Bearer ${token}` } }
        )
      )

      await Promise.all(promises)
      showToast(`Added tag "${newTag}" to ${selectedItems.length} items`, 'success')
      setNewTag('')
      setShowTagModal(false)
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to add tags', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBatchFolder = async () => {
    if (!selectedFolder) {
      showToast('Please select a folder', 'error')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const promises = selectedItems.map(id =>
        axios.put(
          `${API_URL}/library/content/${id}/organize`,
          { folderId: selectedFolder === 'none' ? null : selectedFolder },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      )

      await Promise.all(promises)
      showToast(`Moved ${selectedItems.length} items to folder`, 'success')
      setSelectedFolder('')
      setShowFolderModal(false)
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to move items', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => onSelectionChange?.([])}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowExportImport(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              📤 Export
            </button>
            <button
              onClick={() => setShowTagModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              🏷️ Add Tag
            </button>
            <button
              onClick={() => setShowFolderModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              📁 Move to Folder
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Export/Import Modal */}
      {showExportImport && (
        <ExportImportModal
          isOpen={showExportImport}
          onClose={() => setShowExportImport(false)}
          type={type}
          selectedIds={selectedItems}
        />
      )}

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Add Tag</h3>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Enter tag name"
              className="w-full px-4 py-2 border rounded-lg mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleBatchTag()
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowTagModal(false)
                  setNewTag('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchTag}
                disabled={loading || !newTag.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">Move to Folder</h3>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            >
              <option value="none">No Folder</option>
              {/* Folders would be loaded from API */}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowFolderModal(false)
                  setSelectedFolder('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchFolder}
                disabled={loading || !selectedFolder}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}







