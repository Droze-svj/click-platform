'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import EnhancedBatchOperations from '../../../components/EnhancedBatchOperations'
import BulkActions from '../../../components/BulkActions'
import EmptyState from '../../../components/EmptyState'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Content {
  _id: string
  title: string
  type: string
  status: string
  folderId?: {
    _id: string
    name: string
    color: string
  }
  tags: string[]
  category: string
  isFavorite: boolean
  createdAt: string
}

interface Folder {
  _id: string
  name: string
  color: string
  description?: string
}

export default function LibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [content, setContent] = useState<Content[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    // Load filters from URL params
    const query = searchParams?.get('query')
    const type = searchParams?.get('type')
    const status = searchParams?.get('status')
    const category = searchParams?.get('category')
    const folderId = searchParams?.get('folderId')
    const dateFrom = searchParams?.get('dateFrom')
    const dateTo = searchParams?.get('dateTo')

    if (query) setSearchQuery(query)
    if (type) setSelectedCategory(type)
    if (category) setSelectedCategory(category)
    if (folderId) setSelectedFolder(folderId)

    loadData()
  }, [user, router, selectedFolder, selectedTag, selectedCategory, showFavorites, searchQuery, searchParams])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (selectedFolder) params.append('folderId', selectedFolder)
      if (selectedTag) params.append('tag', selectedTag)
      if (selectedCategory) params.append('category', selectedCategory)
      if (showFavorites) params.append('isFavorite', 'true')
      if (searchQuery) params.append('search', searchQuery)

      const [contentRes, foldersRes, tagsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/library/content?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/library/folders`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/library/tags`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/library/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (contentRes.data.success) {
        setContent(contentRes.data.data.content || [])
      }
      if (foldersRes.data.success) {
        setFolders(foldersRes.data.data || [])
      }
      if (tagsRes.data.success) {
        setTags(tagsRes.data.data || [])
      }
      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load library', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    // Validate folder name
    if (!newFolderName.trim()) {
      showToast('Folder name is required', 'error')
      return
    }

    if (newFolderName.trim().length < 1) {
      showToast('Folder name must be at least 1 character', 'error')
      return
    }

    if (newFolderName.trim().length > 100) {
      showToast('Folder name must be no more than 100 characters', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/library/folders`,
        { name: newFolderName },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = extractApiData(response)
      if (data) {
        showToast('Folder created successfully', 'success')
        setShowCreateFolder(false)
        setNewFolderName('')
        await loadData()
      }
    } catch (error: any) {
      const errorMessage = extractApiError(error) || 'Failed to create folder'
      showToast(errorMessage, 'error')
    }
  }

  const handleToggleFavorite = async (contentId: string, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/library/content/${contentId}/organize`,
        { isFavorite: !currentValue },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      await loadData()
      showToast(!currentValue ? 'Added to favorites' : 'Removed from favorites', 'success')
    } catch (error) {
      const errorMessage = extractApiError(error) || 'Failed to update favorite'
      showToast(errorMessage, 'error')
    }
  }

  const handleDuplicate = async (contentId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/library/content/${contentId}/duplicate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = extractApiData(response)
      if (data) {
        showToast('Content duplicated successfully', 'success')
        await loadData()
      }
    } catch (error) {
      showToast('Failed to duplicate content', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading library..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Content Library</h1>
          <button
            onClick={() => setShowCreateFolder(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            + New Folder
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Folders</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className={`w-full text-left px-3 py-2 rounded ${
                      selectedFolder === null ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    All Content
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder._id}
                      onClick={() => setSelectedFolder(folder._id)}
                      className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${
                        selectedFolder === folder._id ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                      {folder.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedTag === tag
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Categories</h3>
                <div className="space-y-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedCategory === category
                          ? 'bg-purple-100 text-purple-800'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <button
                  onClick={() => setShowFavorites(!showFavorites)}
                  className={`w-full text-left px-3 py-2 rounded ${
                    showFavorites ? 'bg-yellow-100 text-yellow-800' : 'hover:bg-gray-100'
                  }`}
                >
                  ⭐ Favorites
                </button>
              </div>
            </div>
          </div>

          {/* Content Grid */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {content.map((item) => (
                  <div
                    key={item._id}
                    className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold truncate">{item.title || 'Untitled'}</h3>
                        <p className="text-sm text-gray-600 capitalize">{item.type}</p>
                      </div>
                      <button
                        onClick={() => handleToggleFavorite(item._id, item.isFavorite)}
                        className={`text-lg ${item.isFavorite ? 'text-yellow-500' : 'text-gray-400'}`}
                      >
                        ⭐
                      </button>
                    </div>

                    {item.folderId && (
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.folderId.color }}
                        />
                        <span className="text-xs text-gray-600">{item.folderId.name}</span>
                      </div>
                    )}

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => router.push(`/dashboard/content/${item._id}`)}
                        className="flex-1 bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDuplicate(item._id)}
                        className="px-3 py-2 border rounded text-sm hover:bg-gray-100"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {content.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>No content found. Create some content to get started!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Batch Operations */}
        {selectedItems.length > 0 && (
          <>
            <EnhancedBatchOperations
              selectedItems={selectedItems}
              type="content"
              onComplete={() => {
                loadData()
                setSelectedItems([])
                setSelectMode(false)
              }}
              onSelectionChange={setSelectedItems}
            />
            <BulkActions
              selectedItems={selectedItems}
              onDelete={async (ids) => {
                try {
                  const token = localStorage.getItem('token')
                  await axios.post(
                    `${API_URL}/batch/delete-content`,
                    { contentIds: ids },
                    { headers: { Authorization: `Bearer ${token}` } }
                  )
                  showToast(`Deleted ${ids.length} items`, 'success')
                  loadData()
                  setSelectedItems([])
                } catch (error: any) {
                  showToast(error.response?.data?.error || 'Failed to delete', 'error')
                }
              }}
              onTag={(ids) => {
                // Handle tagging
                showToast('Tag feature coming soon', 'info')
              }}
              onMove={(ids) => {
                // Handle moving to folder
                showToast('Move feature coming soon', 'info')
              }}
              onExport={(ids) => {
                // Handle export
                showToast('Export feature coming soon', 'info')
              }}
            />
          </>
        )}

        {showCreateFolder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Create Folder</h2>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full px-4 py-2 border rounded-lg mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateFolder(false)
                    setNewFolderName('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

