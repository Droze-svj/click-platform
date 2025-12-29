'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Template {
  _id: string
  name: string
  description?: string
  type: string
  category: string
  niche: string
  rating: number
  usageCount: number
  isFeatured: boolean
  isPublic: boolean
  createdBy: {
    _id: string
    name: string
    email: string
  }
  preview?: {
    thumbnail?: string
    description?: string
  }
  tags: string[]
}

export default function TemplateMarketplace() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: '',
    niche: '',
    featured: false,
    sortBy: 'popular'
  })
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')

  useEffect(() => {
    if (user && token) {
      loadTemplates()
    }
  }, [user, token, filters])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.niche) params.append('niche', filters.niche)
      if (filters.featured) params.append('featured', 'true')
      params.append('sortBy', filters.sortBy)

      const response = await axios.get(`${API_URL}/templates/marketplace?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setTemplates(response.data.data)
      }
    } catch (error) {
      showToast('Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = async (template: Template) => {
    try {
      await axios.post(
        `${API_URL}/templates/${template._id}/use`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      showToast('Template applied!', 'success')
      router.push(`/dashboard/content?templateId=${template._id}`)
    } catch (error) {
      showToast('Failed to use template', 'error')
    }
  }

  const handleRateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      await axios.post(
        `${API_URL}/templates/${selectedTemplate._id}/rate`,
        { rating, review },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      showToast('Rating submitted!', 'success')
      setShowRatingModal(false)
      setSelectedTemplate(null)
      setRating(5)
      setReview('')
      loadTemplates()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to submit rating', 'error')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading marketplace..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Template Marketplace</h1>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Categories</option>
                <option value="social">Social Media</option>
                <option value="blog">Blog</option>
                <option value="video">Video</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Niche</label>
              <select
                value={filters.niche}
                onChange={(e) => setFilters({ ...filters, niche: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Niches</option>
                <option value="business">Business</option>
                <option value="health">Health</option>
                <option value="tech">Technology</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.featured}
                  onChange={(e) => setFilters({ ...filters, featured: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Featured Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div
              key={template._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              {template.isFeatured && (
                <div className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-semibold px-2 py-1 rounded mb-2 inline-block">
                  ⭐ Featured
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {template.description || 'No description'}
              </p>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm font-semibold">{template.rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {template.usageCount} uses
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs capitalize">
                  {template.type}
                </span>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                  {template.category}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  Use Template
                </button>
                <button
                  onClick={() => {
                    setSelectedTemplate(template)
                    setShowRatingModal(true)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  Rate
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                By {template.createdBy.name}
              </p>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No templates found. Try adjusting your filters.
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">Rate Template</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedTemplate.name}</p>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-2xl ${
                        star <= rating ? 'text-yellow-500' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Review (Optional)</label>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Share your thoughts about this template..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRatingModal(false)
                    setSelectedTemplate(null)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRateTemplate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Submit Rating
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}







