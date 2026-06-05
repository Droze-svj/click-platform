'use client'

import { useState, useEffect } from 'react'
import { FolderPlus, Folder, Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

interface Collection {
  _id: string
  name: string
  description?: string
  contentCount: number
  color?: string
  createdAt: string
}

interface ContentCollectionsProps {
  contentId?: string
  onCollectionSelect?: (collectionId: string) => void
}

export default function ContentCollections({ contentId, onCollectionSelect }: ContentCollectionsProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDesc, setNewCollectionDesc] = useState('')
  const router = useRouter()
  const { showToast } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setCollections(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      showToast(t('contentCollections.nameRequired'), 'error')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newCollectionName,
          description: newCollectionDesc,
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCollections(prev => [...prev, data.data])
        setShowCreateModal(false)
        setNewCollectionName('')
        setNewCollectionDesc('')
        showToast(t('contentCollections.collectionCreated'), 'success')
        
        if (contentId && onCollectionSelect) {
          onCollectionSelect(data.data._id)
        }
      } else {
        showToast(t('contentCollections.failedToCreate'), 'error')
      }
    } catch (error) {
      showToast('Failed to create collection', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAddToCollection = async (collectionId: string) => {
    if (!contentId) return

    try {
      const response = await fetch(`/api/collections/${collectionId}/content?contentId=${contentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (response.ok) {
        showToast(t('contentCollections.addedToCollection'), 'success')
        fetchCollections()
        if (onCollectionSelect) {
          onCollectionSelect(collectionId)
        }
      } else {
        showToast(t('contentCollections.failedToAdd'), 'error')
      }
    } catch (error) {
      showToast('Failed to add to collection', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-[var(--text-main)]">
            {t('contentCollections.title')}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t('contentCollections.new')}</span>
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-8">
          <FolderPlus className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('contentCollections.emptyState')}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            {t('contentCollections.createCollection')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((collection) => (
            <div
              key={collection._id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{
                    backgroundColor: collection.color || '#8B5CF6',
                  }}
                >
                  <Folder className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-[var(--text-main)]">
                    {collection.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('contentCollections.itemCount', { count: collection.contentCount })}
                  </p>
                </div>
              </div>
              {contentId && (
                <button
                  type="button"
                  onClick={() => handleAddToCollection(collection._id)}
                  className="px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {t('contentCollections.add')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-[var(--text-main)] mb-4">
              {t('contentCollections.createCollection')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('contentCollections.nameLabel')}
                </label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder={t('contentCollections.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('contentCollections.descriptionLabel')}
                </label>
                <textarea
                  value={newCollectionDesc}
                  onChange={(e) => setNewCollectionDesc(e.target.value)}
                  placeholder={t('contentCollections.descriptionPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setNewCollectionName('')
                  setNewCollectionDesc('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('contentCollections.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={isCreating || !newCollectionName.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? t('contentCollections.creating') : t('contentCollections.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






