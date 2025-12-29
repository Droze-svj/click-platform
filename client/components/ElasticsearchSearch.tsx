'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'

interface SearchResult {
  _id: string
  title: string
  type: string
  _score?: number
  [key: string]: any
}

interface ElasticsearchSearchProps {
  onResultSelect?: (result: SearchResult) => void
  placeholder?: string
}

export default function ElasticsearchSearch({
  onResultSelect,
  placeholder = 'Search with Elasticsearch...',
}: ElasticsearchSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isElasticsearchEnabled, setIsElasticsearchEnabled] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    checkElasticsearchStatus()
  }, [])

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchContent(debouncedQuery)
      getSuggestions(debouncedQuery)
    } else {
      setResults([])
      setSuggestions([])
    }
  }, [debouncedQuery])

  const checkElasticsearchStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/search/elasticsearch/status', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setIsElasticsearchEnabled(data.data.enabled)
      }
    } catch (error) {
      console.error('Failed to check Elasticsearch status:', error)
    }
  }

  const searchContent = async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/search/elasticsearch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          query: searchQuery,
          index: 'content',
          size: 10,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.data.hits || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSuggestions = async (searchQuery: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `/api/search/elasticsearch/suggestions?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.data.suggestions || [])
      }
    } catch (error) {
      console.error('Suggestions error:', error)
    }
  }

  if (!isElasticsearchEnabled) {
    return null // Don't show if Elasticsearch is not enabled
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
        {isElasticsearchEnabled && !isLoading && (
          <Sparkles className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-500" />
        )}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(suggestion)
                searchContent(suggestion)
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result._id}
              onClick={() => {
                if (onResultSelect) {
                  onResultSelect(result)
                }
                setQuery('')
                setResults([])
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {result.type} • {result.status}
                  </p>
                </div>
                {result._score && (
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    Score: {result._score.toFixed(2)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}






