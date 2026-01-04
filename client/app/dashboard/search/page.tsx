'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { apiGet } from '../../../lib/api'

export default function SearchPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  interface SearchResult {
    _id: string
    title: string
    type: string
    status: string
    [key: string]: any
  }

  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
  }, [user, router])

  const handleSearch = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (query) params.append('q', query)
      if (type) params.append('type', type)
      if (status) params.append('status', status)

      const response = await apiGet<any>(`/search/content?${params.toString()}`)
      const resultsData = response?.data || response
      setResults(Array.isArray(resultsData) ? resultsData : [])
    } catch (error: any) {
      const errorObj = extractApiError(error)
      setError(typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Search Content</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              id="search-query"
              name="searchQuery"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="px-4 py-2 border rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Types</option>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="podcast">Podcast</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            <button
              onClick={handleSearch}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Search
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {loading ? (
          <LoadingSpinner size="lg" text="Searching..." />
        ) : results.length === 0 ? (
          <EmptyState
            title="No results found"
            description={query ? `No content found for "${query}"` : "Enter a search query to find content"}
            icon="🔍"
          />
        ) : (
          <div className="space-y-4">
            {results.map((item) => (
              <div key={item._id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition cursor-pointer" onClick={() => router.push(`/dashboard/content/${item._id}`)}>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.type} • {item.status}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}







