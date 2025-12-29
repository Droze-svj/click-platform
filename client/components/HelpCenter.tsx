'use client'

import { useState, useEffect } from 'react'
import { Search, BookOpen, MessageCircle, HelpCircle, ChevronRight } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface HelpArticle {
  _id: string
  title: string
  slug: string
  category: string
  views: number
  helpful: number
}

interface Category {
  category: string
  count: number
}

export default function HelpCenter() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadCategories()
    loadArticles()
  }, [selectedCategory, searchQuery])

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/help/categories', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadArticles = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.append('category', selectedCategory)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/help/articles?${params}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setArticles(data.data.articles || [])
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Help Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find answers and get support
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for help..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedCategory === null
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setSelectedCategory(cat.category)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === cat.category
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {cat.category.replace('-', ' ')} ({cat.count})
          </button>
        ))}
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-8">
          <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400">No articles found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => (
            <a
              key={article._id}
              href={`/help/${article.slug}`}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 transition-colors bg-white dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                    {article.category.replace('-', ' ')}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{article.views} views</span>
                <span>{article.helpful} helpful</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Support Section */}
      <div className="mt-8 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Still need help?
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Can't find what you're looking for? Contact our support team.
        </p>
        <a
          href="/help/support"
          className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Contact Support
        </a>
      </div>
    </div>
  )
}






