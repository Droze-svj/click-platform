'use client'

import { useState, useEffect } from 'react'
import { Search, Sparkles, Loader2 } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'

interface Article {
  _id: string
  title: string
  slug: string
  category: string
  relevanceScore?: number
}

export default function AIHelpSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchArticles(debouncedQuery)
    } else {
      setResults([])
    }
  }, [debouncedQuery])

  const searchArticles = async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/help/ai-search?q=${encodeURIComponent(searchQuery)}`,
        {
          credentials: 'include',
        }
      )

      if (response.ok) {
        const data = await response.json()
        setResults(data.data || [])
      }
    } catch (error) {
      console.error('AI search error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question or search help articles..."
          className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
        {!isLoading && query && (
          <Sparkles className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-500" />
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((article) => (
            <a
              key={article._id}
              href={`/help/${article.slug}`}
              className="block px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {article.title}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 capitalize mt-1">
                    {article.category.replace('-', ' ')}
                  </p>
                </div>
                {article.relevanceScore && (
                  <span className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                    {Math.round(article.relevanceScore * 10) / 10}% match
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}






