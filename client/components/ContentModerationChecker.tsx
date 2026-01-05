'use client'

import { useState } from 'react'
import { Shield, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

interface ContentModerationCheckerProps {
  content: {
    text?: string
    title?: string
    description?: string
  }
  onModerate?: (result: any) => void
  autoCheck?: boolean
}

export default function ContentModerationChecker({
  content,
  onModerate,
  autoCheck = false,
}: ContentModerationCheckerProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { t } = useTranslation()

  const checkContent = async () => {
    if (!content.text && !content.title && !content.description) {
      return
    }

    setIsChecking(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/moderation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          text: content.text,
          title: content.title,
          description: content.description,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data.data)
        if (onModerate) {
          onModerate(data.data)
        }
      }
    } catch (error) {
      console.error('Moderation check error:', error)
    } finally {
      setIsChecking(false)
    }
  }

  if (autoCheck && !result && !isChecking) {
    checkContent()
  }

  if (!result && !isChecking) {
    return (
      <button
        onClick={checkContent}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Shield className="w-4 h-4" />
        <span>{t('moderation.title')}</span>
      </button>
    )
  }

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t('moderation.checking')}
        </span>
      </div>
    )
  }

  if (!result) {
    return null
  }

  const getStatusIcon = () => {
    if (result.approved) {
      return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
    }
    if (result.moderationScore >= 50) {
      return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
    }
    return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
  }

  const getStatusColor = () => {
    if (result.approved) {
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
    if (result.moderationScore >= 50) {
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    }
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  }

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            {result.approved ? t('moderation.approved') : t('moderation.flagged')}
          </h4>
          
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Moderation Score
              </span>
              <span className={`text-sm font-bold ${
                result.moderationScore >= 80 ? 'text-green-600' :
                result.moderationScore >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {result.moderationScore}/100
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  result.moderationScore >= 80 ? 'bg-green-500' :
                  result.moderationScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${result.moderationScore}%` }}
              />
            </div>
          </div>

          {result.issues && result.issues.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Issues Found:
              </p>
              {result.issues.map((issue: any, index: number) => (
                <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  • {issue.type}: {issue.severity}
                </div>
              ))}
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Recommendations:
              </p>
              {result.recommendations.map((rec: string, index: number) => (
                <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
                  • {rec}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}






