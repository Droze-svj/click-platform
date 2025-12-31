'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import EmptyState from '../../../components/EmptyState'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import TemplateMarketplace from '../../../components/TemplateMarketplace'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Template {
  _id: string
  name: string
  description: string
  category: string
  niche: string
  preview?: {
    thumbnail?: string
    description?: string
  }
  usageCount: number
  rating: {
    average: number
    count: number
  }
  tags: string[]
  isPublic: boolean
}

export default function TemplatesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedNiche, setSelectedNiche] = useState<string>('all')
  const [showMarketplace, setShowMarketplace] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadTemplates()
  }, [user, router, selectedCategory, selectedNiche])

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.append('category', selectedCategory)
      if (selectedNiche !== 'all') params.append('niche', selectedNiche)

      const response = await axios.get(`${API_URL}/templates?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const templatesData = extractApiData<any[]>(response)
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
    } catch (error) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = async (templateId: string) => {
    try {
      const token = localStorage.getItem('token')
      const [useRes, templateRes] = await Promise.all([
        axios.post(
          `${API_URL}/templates/${templateId}/use`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        ),
        axios.get(`${API_URL}/templates/${templateId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      const useData = extractApiData(useRes)
      const templateData = extractApiData(templateRes)
      
      if (useData && templateData) {
        const template = templateData
        // Navigate to appropriate page based on template category
        if (template.category === 'social') {
          router.push(`/dashboard/content?template=${templateId}`)
        } else if (template.category === 'script') {
          router.push(`/dashboard/scripts?template=${templateId}`)
        } else {
          router.push(`/dashboard/content?template=${templateId}`)
        }
        showToast('Template loaded', 'success')
      }
    } catch (error: any) {
      const errorMessage = extractApiError(error)
      showToast(errorMessage || 'Failed to use template', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading templates..." />
      </div>
    )
  }

  const categories = ['all', 'social', 'video', 'blog', 'email', 'script', 'quote']
  const niches = ['all', 'health', 'finance', 'education', 'technology', 'lifestyle', 'business', 'entertainment']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-3xl font-bold">Content Templates</h1>
              <p className="text-gray-600">Choose from pre-built templates to get started quickly</p>
            </div>
            <button
              onClick={() => setShowMarketplace(!showMarketplace)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">🏪</span> Marketplace
            </button>
          </div>
        </div>

        {showMarketplace && (
          <div className="mb-6">
            <TemplateMarketplace />
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Niche</label>
            <select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              {niches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche === 'all' ? 'All Niches' : niche.charAt(0).toUpperCase() + niche.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {templates.length === 0 ? (
          <EmptyState
            title="No templates found"
            description={selectedCategory !== 'all' || selectedNiche !== 'all' ? 'Try adjusting your filters' : 'Check back later for new templates'}
            icon="📄"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div key={template._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                {template.preview?.thumbnail && (
                  <img
                    src={template.preview.thumbnail}
                    alt={template.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-semibold">{template.name}</h3>
                    {template.isPublic && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        Public
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <span className="capitalize">{template.category}</span>
                    <span>•</span>
                    <span className="capitalize">{template.niche}</span>
                    <span>•</span>
                    <span>{template.usageCount} uses</span>
                  </div>

                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleUseTemplate(template._id)}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

