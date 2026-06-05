'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Filter, X, Clock, Star, TrendingUp, Sparkles, Save, History, Bell, Eye, MoreVertical, Copy, ExternalLink, AlertCircle } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface SearchResult {
  content: any
  relevanceScore: number
  matchedFields: string[]
  highlights: Array<{ field: string; text: string }>
}

interface SearchFacets {
  platforms: string[]
  contentTypes: string[]
  tags: string[]
  statuses: string[]
}

interface SearchSuggestion {
  text: string
  type: string
}

export default function AdvancedSearch({ onResultSelect }: { onResultSelect?: (content: any) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [facets, setFacets] = useState<SearchFacets | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    platforms: [] as string[],
    contentTypes: [] as string[],
    tags: [] as string[],
    status: [] as string[],
    dateRange: null as { start: string; end: string } | null,
    minEngagement: null as number | null
  })
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const [savedSearches, setSavedSearches] = useState<any[]>([])
  const [searchType, setSearchType] = useState<'semantic' | 'faceted' | 'natural'>('semantic')
  const [searchAlerts, setSearchAlerts] = useState<any[]>([])
  const [previewContent, setPreviewContent] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [clusteredResults, setClusteredResults] = useState<any>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadFacets()
    loadSearchHistory()
    loadSavedSearches()
    loadSearchAlerts()
  }, [])

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await apiGet<any>(`/search/suggestions?q=${encodeURIComponent(query)}`)
      if (response?.success) {
        setSuggestions(response.data?.suggestions || [])
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }, [query])

  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        loadSuggestions()
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSuggestions([])
    }
  }, [query, loadSuggestions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadFacets = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [AdvancedSearch] Skipping facets API call in development mode')
      setFacets({
        platforms: ['Instagram', 'TikTok', 'YouTube', 'Twitter'],
        contentTypes: ['post', 'reel', 'video', 'story'],
        tags: ['viral', 'trending', 'music', 'dance'],
        statuses: ['draft', 'scheduled', 'published']
      })
      return
    }
    try {
      const response = await apiGet<any>('/search/facets')
      if (response?.success) {
        setFacets(response.data)
      }
    } catch (error) {
      console.error('Error loading facets:', error)
    }
  }


  const loadSearchHistory = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [AdvancedSearch] Skipping search history API call in development mode')
      return
    }
    try {
      const response = await apiGet<any>('/search/history?limit=10')
      if (response?.success) {
        setSearchHistory(response.data?.history || [])
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const loadSearchAlerts = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [AdvancedSearch] Skipping search alerts API call in development mode')
      return
    }
    try {
      const response = await apiGet<any>('/search/alerts')
      if (response?.success) {
        // API returns { alerts: [...] }
        setSearchAlerts(response.data?.alerts || [])
      }
    } catch (error) {
      console.error('Error loading search alerts:', error)
    }
  }

  const loadSavedSearches = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [AdvancedSearch] Skipping saved searches API call in development mode')
      return
    }
    try {
      const response = await apiGet<any>('/search/saved')
      if (response?.success) {
        setSavedSearches(response.data?.searches || [])
      }
    } catch (error) {
      console.error('Error loading saved searches:', error)
    }
  }

  const performSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      if (searchType === 'natural') {
        // Natural language search
        const response = await apiPost<any>('/search/natural', { query: searchQuery })
        if (response?.success) {
          setResults((response.data?.results || []).map((r: any) => ({
            content: r,
            relevanceScore: 50,
            matchedFields: [],
            highlights: []
          })))

          // Cluster results
          try {
            const clusterResponse = await apiPost<any>('/search/cluster', { results: response.data?.results || [], maxClusters: 5 })
            if (clusterResponse?.success) {
              setClusteredResults(clusterResponse.data)
            }
          } catch (error) {
            console.error('Error clustering results:', error)
          }
        }
      } else if (searchType === 'faceted' || Object.keys(filters).some(key => {
        const filterValue = filters[key as keyof typeof filters]
        return Array.isArray(filterValue) ? filterValue.length > 0 : filterValue !== null
      })) {
        // Faceted search
        const response = await apiPost<any>('/search/faceted', { query: searchQuery, filters })
        if (response?.success) {
          setResults((response.data?.results || []).map((r: any) => ({
            content: r,
            relevanceScore: 50,
            matchedFields: [],
            highlights: []
          })))
        }
      } else {
        // Semantic search
        const response = await apiPost<any>('/search/semantic', { query: searchQuery, limit: 20 })
        if (response?.success) {
          setResults(response.data?.results || [])
        }
      }
    } catch (error: any) {
      console.error('Error performing search:', error)
    } finally {
      setLoading(false)
      setSuggestions([])
    }
  }

  const handleResultClick = async (result: SearchResult, position: number) => {
    // Track click
    try {
      await apiPost('/search/click', {
        contentId: result.content._id,
        position,
        query,
        searchId: Date.now().toString()
      })
    } catch (error) {
      console.error('Error tracking click:', error)
    }

    // Load preview
    try {
      const response = await apiGet<any>(`/search/preview/${result.content._id}`)
      if (response?.success) {
        setPreviewContent(response.data)
        setShowPreview(true)
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    }

    onResultSelect?.(result.content)
  }

  const createSearchAlert = async () => {
    try {
      const name = prompt(t('advancedSearch.enterAlertName'))
      if (!name) return

      await apiPost('/search/alerts', {
        name,
        query,
        filters,
        frequency: 'daily'
      })
      alert(t('advancedSearch.searchAlertCreated'))
      loadSearchAlerts()
    } catch (error: any) {
      alert(error.response?.data?.error || t('advancedSearch.errorCreatingAlert'))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch()
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    performSearch(suggestion)
  }

  const handleHistoryClick = (historyItem: any) => {
    setQuery(historyItem.query)
    if (historyItem.filters) {
      setFilters(prev => ({ ...prev, ...historyItem.filters }))
    }
    performSearch(historyItem.query)
  }

  const handleSavedSearchClick = (saved: any) => {
    setQuery(saved.query)
    if (saved.filters) {
      setFilters(prev => ({ ...prev, ...saved.filters }))
    }
    performSearch(saved.query)
  }

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters(prev => {
      const current = prev[category] as string[]
      if (Array.isArray(current)) {
        return {
          ...prev,
          [category]: current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value]
        }
      }
      return prev
    })
  }

  const clearFilters = () => {
    setFilters({
      platforms: [],
      contentTypes: [],
      tags: [],
      status: [],
      dateRange: null,
      minEngagement: null
    })
  }

  const saveCurrentSearch = async () => {
    try {
      await apiPost('/search/save', { query, filters, name: query || 'Saved Search' })
      loadSavedSearches()
    } catch (error) {
      console.error('Error saving search:', error)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('advancedSearch.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
            {query && (
              <button
               type="button"
                onClick={() => {
                  setQuery('')
                  setResults([])
                  searchInputRef.current?.focus()
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
           type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-lg border transition-colors ${
              showFilters || Object.values(filters).some(v =>
                Array.isArray(v) ? v.length > 0 : v !== null
              )
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
          <button            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('advancedSearch.searching')}
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                {t('advancedSearch.search')}
              </>
            )}
          </button>
        </form>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {suggestions.map((suggestion, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSuggestionClick(suggestion.text)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{suggestion.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && facets && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)]">{t('advancedSearch.filters')}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {t('advancedSearch.clearAll')}
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Platforms */}
          {facets.platforms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('advancedSearch.platforms')}
              </label>
              <div className="flex flex-wrap gap-2">
                {facets.platforms.map(platform => (
                  <button
                    type="button"
                    key={platform}
                    onClick={() => toggleFilter('platforms', platform)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.platforms.includes(platform)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content Types */}
          {facets.contentTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('advancedSearch.contentTypes')}
              </label>
              <div className="flex flex-wrap gap-2">
                {facets.contentTypes.map(type => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleFilter('contentTypes', type)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.contentTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {facets.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('advancedSearch.tags')}
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {facets.tags.slice(0, 20).map(tag => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleFilter('tags', tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          {facets.statuses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('advancedSearch.status')}
              </label>
              <div className="flex flex-wrap gap-2">
                {facets.statuses.map(status => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => toggleFilter('status', status)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.status.includes(status)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            const types: Array<'semantic' | 'faceted' | 'natural'> = ['semantic', 'faceted', 'natural']
            const currentIndex = types.indexOf(searchType)
            setSearchType(types[(currentIndex + 1) % types.length])
          }}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 text-sm"
        >
          <Sparkles className="w-4 h-4" />
          {searchType === 'semantic' ? t('advancedSearch.aiSearch') : searchType === 'faceted' ? t('advancedSearch.facetedSearch') : t('advancedSearch.naturalLanguage')}
        </button>
        {query && (
          <>
            <button
              type="button"
              onClick={saveCurrentSearch}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              {t('advancedSearch.saveSearch')}
            </button>
            <button
              type="button"
              onClick={createSearchAlert}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 text-sm"
            >
              <Bell className="w-4 h-4" />
              {t('advancedSearch.createAlert')}
            </button>
          </>
        )}
      </div>

      {/* Search History & Saved Searches */}
      {(searchHistory.length > 0 || savedSearches.length > 0) && !results.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)] mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                {t('advancedSearch.recentSearches')}
              </h3>
              <div className="space-y-2">
                {searchHistory.slice(0, 5).map((item, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleHistoryClick(item)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.query || t('advancedSearch.noQuery')}</span>
                    <Clock className="w-3 h-3 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {savedSearches.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)] mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" />
                {t('advancedSearch.savedSearches')}
              </h3>
              <div className="space-y-2">
                {savedSearches.slice(0, 5).map((saved) => (
                  <button
                    type="button"
                    key={saved._id}
                    onClick={() => handleSavedSearchClick(saved)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{saved.name}</span>
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clustered Results */}
      {clusteredResults && clusteredResults.clusters.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)] mb-4">
            {t('advancedSearch.resultsByCategory')}
          </h3>
          <div className="space-y-4">
            {clusteredResults.clusters.map((cluster: any) => (
              <div key={cluster.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 dark:text-[var(--text-main)] mb-3">
                  {cluster.label} ({cluster.items.length})
                </h4>
                <div className="space-y-2">
                  {cluster.items.slice(0, 3).map((item: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => handleResultClick(item, idx)}
                      className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <p className="text-sm text-gray-900 dark:text-white">
                        {item.content?.title || item.title || t('advancedSearch.untitled')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-main)]">
              {results.length === 1
                ? t('advancedSearch.resultCountSingular', { count: results.length })
                : t('advancedSearch.resultCountPlural', { count: results.length })}
            </h3>
            <div className="flex gap-2">
              {query && (
                <>
                  <button
                    type="button"
                    onClick={saveCurrentSearch}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Save className="w-4 h-4" />
                    {t('advancedSearch.save')}
                  </button>
                  <button
                    type="button"
                    onClick={createSearchAlert}
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Bell className="w-4 h-4" />
                    {t('advancedSearch.alert')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4
                      onClick={() => handleResultClick(result, idx)}
                      className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      {result.content.title || t('advancedSearch.untitled')}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.relevanceScore > 0 && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                        {t('advancedSearch.matchPercent', { score: result.relevanceScore })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResultClick(result, idx)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={t('advancedSearch.preview')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {result.content.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {result.content.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{result.content.type}</span>
                  {result.content.tags && result.content.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{result.content.tags.slice(0, 3).join(', ')}</span>
                    </>
                  )}
                  {result.matchedFields.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{t('advancedSearch.matchedFields', { fields: result.matchedFields.join(', ') })}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Alerts */}
      {searchAlerts.length > 0 && !results.length && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-[var(--text-main)] mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {t('advancedSearch.activeSearchAlerts')}
          </h3>
          <div className="space-y-2">
            {searchAlerts.filter((a: any) => a.isActive).slice(0, 5).map((alert: any) => (
              <div key={alert._id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('advancedSearch.alertFrequencyNotifications', { frequency: alert.frequency, count: alert.notificationCount })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(alert.query)
                    if (alert.filters) setFilters(prev => ({ ...prev, ...alert.filters }))
                    performSearch(alert.query)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {t('advancedSearch.run')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result Preview Modal */}
      {showPreview && previewContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-[var(--text-main)]">
                  {previewContent.content.title}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false)
                    setPreviewContent(null)
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedSearch.type')}</p>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">
                    {previewContent.content.type}
                  </p>
                </div>

                {previewContent.content.description && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedSearch.description')}</p>
                    <p className="text-gray-900 dark:text-white">{previewContent.content.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedSearch.totalPosts')}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {previewContent.stats.totalPosts}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('advancedSearch.totalEngagement')}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {previewContent.stats.totalEngagement.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {previewContent.quickActions.canEdit && (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {t('advancedSearch.edit')}
                    </button>
                  )}
                  {previewContent.quickActions.canDuplicate && (
                    <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                      {t('advancedSearch.duplicate')}
                    </button>
                  )}
                  {previewContent.quickActions.canSchedule && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      {t('advancedSearch.schedule')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t('advancedSearch.noResultsFor', { query })}</p>
          <p className="text-sm mt-2">{t('advancedSearch.tryAdjusting')}</p>
        </div>
      )}
    </div>
  )
}
