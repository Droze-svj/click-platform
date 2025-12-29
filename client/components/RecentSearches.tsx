'use client'

import { useState, useEffect } from 'react'
import { Clock, X, Search } from 'lucide-react'

interface RecentSearchesProps {
  onSearch: (query: string) => void
  maxItems?: number
}

export default function RecentSearches({ onSearch, maxItems = 5 }: RecentSearchesProps) {
  const [searches, setSearches] = useState<string[]>([])

  useEffect(() => {
    loadRecentSearches()
  }, [])

  const loadRecentSearches = () => {
    const stored = localStorage.getItem('recent_searches')
    if (stored) {
      try {
        setSearches(JSON.parse(stored).slice(0, maxItems))
      } catch (error) {
        console.error('Failed to load recent searches:', error)
      }
    }
  }

  const saveSearch = (query: string) => {
    if (!query.trim()) return

    const updated = [query, ...searches.filter(s => s !== query)].slice(0, maxItems)
    localStorage.setItem('recent_searches', JSON.stringify(updated))
    setSearches(updated)
  }

  const removeSearch = (query: string) => {
    const updated = searches.filter(s => s !== query)
    localStorage.setItem('recent_searches', JSON.stringify(updated))
    setSearches(updated)
  }

  const clearAll = () => {
    localStorage.removeItem('recent_searches')
    setSearches([])
  }

  const handleSearch = (query: string) => {
    saveSearch(query)
    onSearch(query)
  }

  if (searches.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Recent Searches
          </h4>
        </div>
        {searches.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1">
        {searches.map((search, index) => (
          <div
            key={index}
            className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 py-1.5 transition-colors"
          >
            <button
              onClick={() => handleSearch(search)}
              className="flex items-center gap-2 flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <Search className="w-3 h-3" />
              <span className="truncate">{search}</span>
            </button>
            <button
              onClick={() => removeSearch(search)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
            >
              <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}






