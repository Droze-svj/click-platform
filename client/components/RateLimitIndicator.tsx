'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Clock } from 'lucide-react'

interface RateLimitIndicatorProps {
  response?: Response
}

export default function RateLimitIndicator({ response }: RateLimitIndicatorProps) {
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number
    reset: number
    limit: number
  } | null>(null)

  useEffect(() => {
    if (response) {
      const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
      const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0')
      const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0')

      if (remaining !== null && limit !== null) {
        setRateLimitInfo({ remaining, limit, reset })
      }
    }
  }, [response])

  if (!rateLimitInfo || rateLimitInfo.remaining > rateLimitInfo.limit * 0.2) {
    return null // Don't show if plenty of requests remaining
  }

  const percentage = (rateLimitInfo.remaining / rateLimitInfo.limit) * 100
  const resetDate = rateLimitInfo.reset ? new Date(rateLimitInfo.reset * 1000) : null

  return (
    <div className="fixed top-4 right-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 shadow-lg z-50 max-w-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
            Rate Limit Warning
          </p>
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-yellow-700 dark:text-yellow-400 mb-1">
              <span>{rateLimitInfo.remaining} / {rateLimitInfo.limit} requests remaining</span>
              <span>{Math.round(percentage)}%</span>
            </div>
            <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  percentage < 10 ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          {resetDate && (
            <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <Clock className="w-3 h-3" />
              <span>Resets at {resetDate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}






