'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, X, Star, Clock } from 'lucide-react'

interface AdvancedSearchFiltersProps {
  onSearch: (query: string, filters: any) => void
  items: any[]
  searchFields?: string[]
}

export default function AdvancedSearchFilters({ onSearch, items, searchFields = ['name', 'description'] }: AdvancedSearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    recent: false,
    favorites: false,
    mostUsed: false
  })
  const [filteredItems, setFilteredItems] = useState(items)

  useEffect(() => {
    let results = items

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      results = results.filter(item => {
        return searchFields.some(field => {
          const value = item[field]
          return value && value.toString().toLowerCase().includes(query)
        })
      })
    }

    // Category filter
    if (filters.category) {
      results = results.filter(item => item.category === filters.category)
    }

    // Recent filter
    if (filters.recent) {
      results = results
        .filter(item => item.lastUsed || item.updatedAt)
        .sort((a, b) => {
          const aTime = new Date(a.lastUsed || a.updatedAt).getTime()
          const bTime = new Date(b.lastUsed || b.updatedAt).getTime()
          return bTime - aTime
        })
    }

    // Favorites filter
    if (filters.favorites) {
      results = results.filter(item => item.isFavorite)
    }

    // Most used filter
    if (filters.mostUsed) {
      results = results
        .filter(item => item.usageCount)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    }

    setFilteredItems(results)
    onSearch(searchQuery, filters)
  }, [searchQuery, filters, items, searchFields, onSearch])

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search effects, presets, templates..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilters({ ...filters, recent: !filters.recent })}
          className={`px-3 py-1 rounded-lg border transition-all ${
            filters.recent
              ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          Recent
        </button>
        <button
          onClick={() => setFilters({ ...filters, favorites: !filters.favorites })}
          className={`px-3 py-1 rounded-lg border transition-all ${
            filters.favorites
              ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500 text-yellow-700 dark:text-yellow-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Star className="w-4 h-4 inline mr-1" />
          Favorites
        </button>
        <button
          onClick={() => setFilters({ ...filters, mostUsed: !filters.mostUsed })}
          className={`px-3 py-1 rounded-lg border transition-all ${
            filters.mostUsed
              ? 'bg-green-100 dark:bg-green-900 border-green-500 text-green-700 dark:text-green-300'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
          }`}
        >
          Most Used
        </button>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-3 py-1 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        >
          <option value="">All Categories</option>
          <option value="color-grading">Color Grading</option>
          <option value="audio-mixing">Audio Mixing</option>
          <option value="typography">Typography</option>
          <option value="motion-graphics">Motion Graphics</option>
          <option value="transitions">Transitions</option>
        </select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
      </div>
    </div>
  )
}
