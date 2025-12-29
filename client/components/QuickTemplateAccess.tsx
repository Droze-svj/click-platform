'use client'

import { useState, useEffect } from 'react'
import { FileText, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '../contexts/ToastContext'

interface Template {
  _id: string
  name: string
  category: string
  niche: string
  description?: string
  usageCount: number
  rating: number
}

export default function QuickTemplateAccess() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    loadPopularTemplates()
  }, [])

  const loadPopularTemplates = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/templates?limit=4&sortBy=usageCount&sortOrder=desc', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTemplate = async (template: Template) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/templates/${template._id}/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Template loaded!', 'success')
        
        // Navigate based on category
        if (template.category === 'social') {
          router.push(`/dashboard/content?template=${template._id}`)
        } else if (template.category === 'script') {
          router.push(`/dashboard/scripts?template=${template._id}`)
        } else {
          router.push(`/dashboard/content?template=${template._id}`)
        }
      }
    } catch (error) {
      showToast('Failed to load template', 'error')
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social':
        return <TrendingUp className="w-4 h-4" />
      case 'script':
        return <FileText className="w-4 h-4" />
      case 'video':
        return <Zap className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (templates.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Popular Templates
          </h3>
        </div>
        <button
          onClick={() => router.push('/dashboard/templates')}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          View all →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => (
          <button
            key={template._id}
            onClick={() => handleUseTemplate(template)}
            className="text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                {getCategoryIcon(template.category)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {template.name}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {template.category}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>⭐ {template.rating.toFixed(1)}</span>
              <span>•</span>
              <span>{template.usageCount} uses</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}






