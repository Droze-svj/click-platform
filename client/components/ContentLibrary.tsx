'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Search, Filter, Plus, Copy, Edit, Trash2 } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'

interface LibraryItem {
  id: string
  title: string
  type: string
  text: string
  platforms: string[]
  createdAt: string
  usageCount: number
}

export default function ContentLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [filteredItems, setFilteredItems] = useState<LibraryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLibrary()
  }, [])

  useEffect(() => {
    filterItems()
  }, [searchQuery, filterType, items])

  const loadLibrary = async () => {
    setLoading(true)
    try {
      const response = await apiGet<any>('/library/items')

      if (response?.success && response.data?.items) {
        setItems(response.data.items)
      } else if (response?.items && Array.isArray(response.items)) {
        setItems(response.items)
      } else if (Array.isArray(response)) {
        setItems(response)
      }
    } catch (error: any) {
      console.error('Library load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterItems = () => {
    let filtered = [...items]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType)
    }

    setFilteredItems(filtered)
  }

  const useItem = async (item: LibraryItem) => {
    try {
      // Create new content from library item
      const response = await apiPost<any>('/content/generate', {
        text: item.text,
        title: item.title,
        type: item.type,
        platforms: item.platforms
      })

      if (response?.success || response) {
        // Increment usage count
        await apiPost(`/library/items/${item.id}/use`, {})
        
        // Reload library
        loadLibrary()
      }
    } catch (error: any) {
      console.error('Use item error:', error)
    }
  }

  const duplicateItem = async (item: LibraryItem) => {
    try {
      await apiPost(`/library/items/${item.id}/duplicate`, {})
      loadLibrary()
    } catch (error: any) {
      console.error('Duplicate error:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Content Library
          </h3>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add to Library
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white appearance-none"
          >
            <option value="all">All Types</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="podcast">Podcasts</option>
            <option value="quote">Quotes</option>
          </select>
        </div>
      </div>

      {/* Library Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {searchQuery || filterType !== 'all' 
              ? 'No items match your search'
              : 'Your content library is empty'}
          </p>
          <button className="text-blue-600 dark:text-blue-400 hover:underline">
            Add your first item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-white flex-1">
                  {item.title}
                </h4>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {item.type}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {item.text.substring(0, 100)}...
              </p>

              <div className="flex flex-wrap gap-1 mb-3">
                {item.platforms.slice(0, 3).map((platform) => (
                  <span
                    key={platform}
                    className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                  >
                    {platform}
                  </span>
                ))}
                {item.platforms.length > 3 && (
                  <span className="text-xs text-gray-500">+{item.platforms.length - 3}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Used {item.usageCount} times
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => useItem(item)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Use this content"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => duplicateItem(item)}
                    className="p-1.5 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


