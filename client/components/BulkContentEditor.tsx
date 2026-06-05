'use client'

import { useState } from 'react'
import { Edit3, Save, X, CheckCircle2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      showToast(t('bulkContentEditor.noItemsSelected'), 'error')
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const payload: any = {}
      
      if (updates.tags) payload.tags = updates.tags.split(',').map(tag => tag.trim())
      if (updates.category) payload.category = updates.category
      if (updates.folderId) payload.folderId = updates.folderId
      if (updates.status) payload.status = updates.status

      const response = await fetch('/api/batch/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          contentIds: selectedIds,
          updates: payload
        })
      })

      if (response.ok) {
        showToast(t('bulkContentEditor.updateSuccess', { count: selectedIds.length }), 'success')
        onUpdate()
        onClose()
      } else {
        showToast(t('bulkContentEditor.updateFailed'), 'error')
      }
    } catch (error) {
      showToast(t('bulkContentEditor.updateFailed'), 'error')
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
            <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)]">
              {t('bulkContentEditor.bulkEditTitle', { count: selectedIds.length })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>{t('bulkContentEditor.editSelectedItems')}</span>
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('bulkContentEditor.tagsLabel')}
              </label>
              <input
                type="text"
                value={updates.tags}
                onChange={(e) => setUpdates({ ...updates, tags: e.target.value })}
                placeholder={t('bulkContentEditor.tagsPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('bulkContentEditor.categoryLabel')}
              </label>
              <select
                value={updates.category}
                onChange={(e) => setUpdates({ ...updates, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">{t('bulkContentEditor.noChange')}</option>
                <option value="social">{t('bulkContentEditor.categorySocial')}</option>
                <option value="blog">{t('bulkContentEditor.categoryBlog')}</option>
                <option value="video">{t('bulkContentEditor.categoryVideo')}</option>
                <option value="other">{t('bulkContentEditor.categoryOther')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('bulkContentEditor.statusLabel')}
              </label>
              <select
                value={updates.status}
                onChange={(e) => setUpdates({ ...updates, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">{t('bulkContentEditor.noChange')}</option>
                <option value="draft">{t('bulkContentEditor.statusDraft')}</option>
                <option value="completed">{t('bulkContentEditor.statusCompleted')}</option>
                <option value="scheduled">{t('bulkContentEditor.statusScheduled')}</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('bulkContentEditor.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>{t('bulkContentEditor.saving')}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t('bulkContentEditor.saveChanges')}</span>
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






