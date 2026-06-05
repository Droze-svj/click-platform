'use client'

import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

interface ContentDuplicatorProps {
  contentId: string
  onDuplicate?: (newId: string) => void
  className?: string
}

export default function ContentDuplicator({ contentId, onDuplicate, className = '' }: ContentDuplicatorProps) {
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDuplicated, setIsDuplicated] = useState(false)
  const { showToast } = useToast()
  const { t } = useTranslation()

  const handleDuplicate = async () => {
    setIsDuplicating(true)
    try {
      const response = await fetch(`/api/content/${contentId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate content')
      }

      const data = await response.json()
      setIsDuplicated(true)
      showToast(t('contentDuplicator.duplicateSuccess'), 'success')
      
      if (onDuplicate) {
        onDuplicate(data.data._id)
      }

      // Reset after 2 seconds
      setTimeout(() => {
        setIsDuplicated(false)
      }, 2000)
    } catch (error) {
      showToast(t('contentDuplicator.duplicateError'), 'error')
    } finally {
      setIsDuplicating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={isDuplicating || isDuplicated}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
        isDuplicated
          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
      } ${className}`}
      title={t('contentDuplicator.duplicateTitle')}
    >
      {isDuplicating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t('contentDuplicator.duplicating')}</span>
        </>
      ) : isDuplicated ? (
        <>
          <Check className="w-4 h-4" />
          <span className="text-sm">{t('contentDuplicator.duplicated')}</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span className="text-sm">{t('contentDuplicator.duplicate')}</span>
        </>
      )}
    </button>
  )
}






