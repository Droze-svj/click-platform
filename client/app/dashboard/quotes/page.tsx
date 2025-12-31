'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface QuoteCard {
  imageUrl: string
  quote: string
  author: string
  style: string
}

export default function QuotesPage() {
  const router = useRouter()
  const [quoteText, setQuoteText] = useState('')
  const [style, setStyle] = useState('modern')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [quoteCards, setQuoteCards] = useState<QuoteCard[]>([])
  const [contents, setContents] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
    loadContents()
  }, [loadContents])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      localStorage.removeItem('token')
      router.push('/login')
    }
  }

  const loadContents = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const contents = extractApiData<any[]>(response) || []
      setContents(Array.isArray(contents) ? contents : [])
    } catch (error) {
      // Silently fail - contents are optional for this page
      // Error is already handled by extractApiError if needed
    }
  }, [])

  const handleGenerate = async () => {
    // Validate input
    if (!quoteText.trim()) {
      setError('Please enter a quote')
      return
    }

    if (quoteText.trim().length < 5) {
      setError('Quote must be at least 5 characters long')
      return
    }

    if (quoteText.trim().length > 500) {
      setError('Quote is too long. Please keep it under 500 characters')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/quote/generate`,
        {
          quoteText,
          style
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = extractApiData<{ quoteCards: QuoteCard[] }>(response)
      setQuoteCards(data?.quoteCards || [])
      setSuccess('Quote cards generated successfully!')
    } catch (error: any) {
      setError(extractApiError(error) || 'Failed to generate quote cards')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFromContent = async (contentId: string) => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/quote/generate`,
        {
          contentId,
          style
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      const data = extractApiData<{ quoteCards: QuoteCard[] }>(response)
      setQuoteCards(data?.quoteCards || [])
      setSuccess('Quote cards generated successfully!')
    } catch (error: any) {
      setError(extractApiError(error) || 'Failed to generate quote cards')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Quote Cards</h1>
          <p className="text-sm md:text-base text-gray-600">Create branded quote graphics from memorable quotes</p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <SuccessAlert message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-1 bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Create Quote Card</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quote Text
              </label>
              <textarea
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your quote here..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="modern">Modern</option>
                <option value="minimalist">Minimalist</option>
                <option value="vibrant">Vibrant</option>
                <option value="professional">Professional</option>
              </select>
            </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !quoteText.trim()}
                    className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                    aria-label={loading ? 'Generating quote cards, please wait' : 'Generate quote card from text'}
                    aria-busy={loading}
                  >
                    {loading ? 'Generating...' : 'Generate Quote Card'}
                  </button>

            {contents.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Or Generate from Content</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {contents.map((content) => (
                    <button
                      key={content._id}
                      onClick={() => handleGenerateFromContent(content._id)}
                      className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                    >
                      {content.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            {loading && (
              <div className="bg-white rounded-lg shadow p-6 md:p-12 text-center">
                <LoadingSpinner size="lg" text="Generating quote cards..." />
              </div>
            )}

            {!loading && quoteCards.length === 0 && (
              <EmptyState
                title="No quote cards generated yet"
                description="Enter a quote and click generate to create your first quote card"
                icon="💬"
              />
            )}

            {quoteCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {quoteCards.map((card, index) => (
                  <div key={index} className="bg-white rounded-lg shadow overflow-hidden">
                    <img
                      src={`${API_URL.replace('/api', '')}${card.imageUrl}`}
                      alt={card.quote}
                      className="w-full h-auto"
                    />
                    <div className="p-4">
                      <p className="text-sm text-gray-600 mb-2">"{card.quote}"</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">— {card.author}</span>
                        <a
                          href={`${API_URL.replace('/api', '')}${card.imageUrl}`}
                          download
                          className="text-sm text-purple-600 hover:text-purple-800"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  )
}

