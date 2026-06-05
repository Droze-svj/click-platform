'use client'

import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import ExportImportModal from './ExportImportModal'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Folder {
  _id: string
  name: string
}

interface EnhancedBatchOperationsProps {
  selectedItems: string[]
  type: 'content' | 'scripts' | 'posts'
  onComplete: () => void
  onSelectionChange?: (selected: string[]) => void
  folders?: Folder[]
}

export default function EnhancedBatchOperations({
  selectedItems,
  type,
  onComplete,
  onSelectionChange,
  folders = []
}: EnhancedBatchOperationsProps) {
  const { t } = useTranslation()
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
    if (!confirm(t('enhancedBatchOperations.confirmDelete', { count: selectedItems.length }))) {
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = type === 'content'
        ? `${API_URL}/batch/delete`
        : type === 'scripts'
          ? `${API_URL}/batch/delete-scripts`
          : `${API_URL}/batch/delete-posts`

      const body = type === 'content'
        ? { contentIds: selectedItems }
        : type === 'scripts'
          ? { scriptIds: selectedItems }
          : { postIds: selectedItems }

      await axios.post(endpoint, body, {
      })

      showToast(t('enhancedBatchOperations.deletedSuccess', { count: selectedItems.length }), 'success')
      onSelectionChange?.([])
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('enhancedBatchOperations.failedDelete'), 'error')
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBatchTag = async () => {
    if (!newTag.trim()) {
      showToast(t('enhancedBatchOperations.pleaseEnterTag'), 'error')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      await axios.post(
        `${API_URL}/batch/tag`,
        { contentIds: selectedItems, tags: [newTag.trim()], action: 'add' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      showToast(t('enhancedBatchOperations.tagAdded', { tag: newTag, count: selectedItems.length }), 'success')
      setNewTag('')
      setShowTagModal(false)
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('enhancedBatchOperations.failedAddTags'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBatchFolder = async () => {
    if (!selectedFolder) {
      showToast(t('enhancedBatchOperations.pleaseSelectFolder'), 'error')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      await axios.post(
        `${API_URL}/batch/update`,
        {
          contentIds: selectedItems,
          updates: { folderId: selectedFolder === 'none' || !selectedFolder ? null : selectedFolder }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      showToast(t('enhancedBatchOperations.movedToFolder', { count: selectedItems.length }), 'success')
      setSelectedFolder('')
      setShowFolderModal(false)
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('enhancedBatchOperations.failedMove'), 'error')
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
              {selectedItems.length === 1
                ? t('enhancedBatchOperations.itemsSelected', { count: selectedItems.length })
                : t('enhancedBatchOperations.itemsSelectedPlural', { count: selectedItems.length })}
            </span>
            <button
              type="button"
              onClick={() => onSelectionChange?.([])}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              {t('enhancedBatchOperations.clear')}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowExportImport(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              📤 {t('enhancedBatchOperations.export')}
            </button>
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              🏷️ {t('enhancedBatchOperations.addTag')}
            </button>
            <button
              type="button"
              onClick={() => { setShowFolderModal(true); setSelectedFolder('none') }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              📁 {t('enhancedBatchOperations.moveToFolder')}
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
            >
              🗑️ {t('enhancedBatchOperations.delete')}
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
            <h3 className="text-xl font-semibold mb-4">{t('enhancedBatchOperations.addTag')}</h3>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t('enhancedBatchOperations.enterTagName')}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleBatchTag()
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowTagModal(false)
                  setNewTag('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t('enhancedBatchOperations.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBatchTag}
                disabled={loading || !newTag.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {t('enhancedBatchOperations.addTag')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-semibold mb-4">{t('enhancedBatchOperations.moveToFolder')}</h3>
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg mb-4"
            >
              <option value="none">{t('enhancedBatchOperations.noFolder')}</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowFolderModal(false)
                  setSelectedFolder('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t('enhancedBatchOperations.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBatchFolder}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {t('enhancedBatchOperations.move')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}







