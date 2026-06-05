'use client'

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
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
  const { t } = useTranslation()
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

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.niche) params.append('niche', filters.niche)
      if (filters.featured) params.append('featured', 'true')
      params.append('sortBy', filters.sortBy)

      const response = await axios.get(`${API_URL}/templates/marketplace?${params.toString()}`, {
      })

      if (response.data.success) {
        setTemplates(response.data.data)
      }
    } catch (error) {
      showToast(t('templateMarketplace.failedToLoad'), 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, showToast, t])

  useEffect(() => {
    if (user && token) {
      loadTemplates()
    }
  }, [user, token, filters, loadTemplates])

  const handleUseTemplate = async (template: Template) => {
    try {
      await axios.post(
        `${API_URL}/templates/${template._id}/use`,
        {},
        {
        }
      )
      showToast(t('templateMarketplace.templateApplied'), 'success')
      router.push(`/dashboard/content?templateId=${template._id}`)
    } catch (error) {
      showToast(t('templateMarketplace.failedToUse'), 'error')
    }
  }

  const handleRateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      await axios.post(
        `${API_URL}/templates/${selectedTemplate._id}/rate`,
        { rating, review },
        {
        }
      )
      showToast(t('templateMarketplace.ratingSubmitted'), 'success')
      setShowRatingModal(false)
      setSelectedTemplate(null)
      setRating(5)
      setReview('')
      loadTemplates()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('templateMarketplace.failedToSubmitRating'), 'error')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text={t('templateMarketplace.loadingMarketplace')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('templateMarketplace.title')}</h1>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('templateMarketplace.category')}</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">{t('templateMarketplace.allCategories')}</option>
                <option value="social">{t('templateMarketplace.categorySocial')}</option>
                <option value="blog">{t('templateMarketplace.categoryBlog')}</option>
                <option value="video">{t('templateMarketplace.categoryVideo')}</option>
                <option value="email">{t('templateMarketplace.categoryEmail')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('templateMarketplace.niche')}</label>
              <select
                value={filters.niche}
                onChange={(e) => setFilters({ ...filters, niche: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">{t('templateMarketplace.allNiches')}</option>
                <option value="business">{t('templateMarketplace.nicheBusiness')}</option>
                <option value="health">{t('templateMarketplace.nicheHealth')}</option>
                <option value="tech">{t('templateMarketplace.nicheTech')}</option>
                <option value="finance">{t('templateMarketplace.nicheFinance')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('templateMarketplace.sortBy')}</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="popular">{t('templateMarketplace.sortPopular')}</option>
                <option value="rating">{t('templateMarketplace.sortRating')}</option>
                <option value="newest">{t('templateMarketplace.sortNewest')}</option>
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
                <span className="text-sm">{t('templateMarketplace.featuredOnly')}</span>
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
                  ⭐ {t('templateMarketplace.featured')}
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                {template.description || t('templateMarketplace.noDescription')}
              </p>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm font-semibold">{template.rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {t('templateMarketplace.uses', { count: template.usageCount })}
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
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  {t('templateMarketplace.useTemplate')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(template)
                    setShowRatingModal(true)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  {t('templateMarketplace.rate')}
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                {t('templateMarketplace.byAuthor', { name: template.createdBy.name })}
              </p>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {t('templateMarketplace.noTemplatesFound')}
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">{t('templateMarketplace.rateTemplate')}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedTemplate.name}</p>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('templateMarketplace.rating')}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
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
                <label className="block text-sm font-medium mb-2">{t('templateMarketplace.reviewOptional')}</label>
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('templateMarketplace.reviewPlaceholder')}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRatingModal(false)
                    setSelectedTemplate(null)
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t('templateMarketplace.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleRateTemplate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {t('templateMarketplace.submitRating')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}







