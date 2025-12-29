'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Sparkles, RefreshCw } from 'lucide-react'

interface ContentHealthCheckerProps {
  content: {
    text?: string
    title?: string
    tags?: string[]
    description?: string
    type?: string
  }
  onFix?: (issue: string, suggestion: string) => void
}

interface HealthIssue {
  type: 'error' | 'warning' | 'info'
  message: string
  suggestion: string
  fixable: boolean
}

export default function ContentHealthChecker({ content, onFix }: ContentHealthCheckerProps) {
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [isChecking, setIsChecking] = useState(false)

  const checkHealth = () => {
    setIsChecking(true)
    const foundIssues: HealthIssue[] = []

    // Check title
    if (!content.title || content.title.trim().length < 5) {
      foundIssues.push({
        type: 'warning',
        message: 'Title is too short or missing',
        suggestion: 'Add a descriptive title (at least 5 characters)',
        fixable: true,
      })
    }

    // Check text content
    if (!content.text || content.text.trim().length < 50) {
      foundIssues.push({
        type: 'error',
        message: 'Content text is too short',
        suggestion: 'Add more content (at least 50 characters)',
        fixable: true,
      })
    }

    // Check tags
    if (!content.tags || content.tags.length === 0) {
      foundIssues.push({
        type: 'warning',
        message: 'No tags added',
        suggestion: 'Add relevant tags to improve discoverability',
        fixable: true,
      })
    } else if (content.tags.length < 3) {
      foundIssues.push({
        type: 'info',
        message: 'Consider adding more tags',
        suggestion: 'Add 3-5 relevant tags for better reach',
        fixable: true,
      })
    }

    // Check description
    if (!content.description || content.description.trim().length < 20) {
      foundIssues.push({
        type: 'info',
        message: 'Description could be more detailed',
        suggestion: 'Add a description (at least 20 characters)',
        fixable: true,
      })
    }

    // Check content length for social media
    if (content.type === 'social' && content.text) {
      const length = content.text.length
      if (length > 280) {
        foundIssues.push({
          type: 'warning',
          message: 'Content exceeds Twitter character limit',
          suggestion: 'Consider shortening for Twitter compatibility',
          fixable: false,
        })
      }
    }

    setTimeout(() => {
      setIssues(foundIssues)
      setIsChecking(false)
    }, 500)
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
      default:
        return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    }
  }

  const getIssueColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
  }

  const healthScore = issues.length === 0 ? 100 : Math.max(0, 100 - (issues.length * 15))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Content Health Check
          </h3>
        </div>
        <button
          onClick={checkHealth}
          disabled={isChecking}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Check'}</span>
        </button>
      </div>

      {issues.length === 0 && !isChecking ? (
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            All Good! 🎉
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Your content looks healthy and ready to publish
          </p>
        </div>
      ) : (
        <>
          {/* Health Score */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Health Score
              </span>
              <span className={`text-lg font-bold ${
                healthScore >= 80 ? 'text-green-600 dark:text-green-400' :
                healthScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {healthScore}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  healthScore >= 80 ? 'bg-green-500' :
                  healthScore >= 60 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>

          {/* Issues List */}
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getIssueColor(issue.type)}`}
              >
                <div className="flex items-start gap-2">
                  {getIssueIcon(issue.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {issue.message}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {issue.suggestion}
                    </p>
                    {issue.fixable && onFix && (
                      <button
                        onClick={() => onFix(issue.message, issue.suggestion)}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Fix this →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}






