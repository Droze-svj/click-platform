'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

interface SubscriptionStatus {
  status: string
  isExpired: boolean
  isExpiringSoon: boolean
  daysUntilExpiry: number
  hasAccess: boolean
  endDate: string
  package: {
    name: string
    slug: string
  } | null
}

export default function SubscriptionBanner() {
  const router = useRouter()
  const { user } = useAuth()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    loadSubscriptionStatus()
  }, [user])

  const loadSubscriptionStatus = async () => {
    try {
      const response = await apiGet<{ success: boolean; data: SubscriptionStatus }>('/subscription/status')
      if (response.success) {
        setStatus(response.data)
      }
    } catch (error) {
      console.error('Failed to load subscription status', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !status || dismissed) {
    return null
  }

  // Show banner if expired or expiring soon
  if (!status.isExpired && !status.isExpiringSoon) {
    return null
  }

  const bannerType = status.isExpired ? 'error' : 'warning'

  return (
    <div className={`bg-${bannerType === 'error' ? 'red' : 'yellow'}-50 border-l-4 border-${bannerType === 'error' ? 'red' : 'yellow'}-400 p-4 mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {bannerType === 'error' ? (
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <p className={`text-sm font-medium text-${bannerType === 'error' ? 'red' : 'yellow'}-800`}>
              {status.isExpired
                ? 'Your subscription has expired'
                : `Your subscription expires in ${status.daysUntilExpiry} day${status.daysUntilExpiry > 1 ? 's' : ''}`}
            </p>
            <p className={`mt-1 text-sm text-${bannerType === 'error' ? 'red' : 'yellow'}-700`}>
              {status.isExpired
                ? 'Please renew your subscription to continue using all features.'
                : 'Renew now to avoid interruption of service.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/membership')}
            className={`px-4 py-2 text-sm font-medium text-white bg-${bannerType === 'error' ? 'red' : 'yellow'}-600 rounded-md hover:bg-${bannerType === 'error' ? 'red' : 'yellow'}-700`}
          >
            {status.isExpired ? 'Renew Now' : 'Upgrade'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}







