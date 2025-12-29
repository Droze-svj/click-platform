'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

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

export default function SubscriptionStatus() {
  const router = useRouter()
  const { user } = useAuth()
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadSubscriptionStatus()
    }
  }, [user])

  const loadSubscriptionStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setStatus(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load subscription status', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !status) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  const getStatusColor = () => {
    if (status.isExpired) return 'text-red-600 bg-red-100'
    if (status.isExpiringSoon) return 'text-yellow-600 bg-yellow-100'
    if (status.status === 'active') return 'text-green-600 bg-green-100'
    return 'text-gray-600 bg-gray-100'
  }

  const getStatusText = () => {
    if (status.isExpired) return 'Expired'
    if (status.isExpiringSoon) return `Expires in ${status.daysUntilExpiry} days`
    if (status.status === 'active') return 'Active'
    return status.status.charAt(0).toUpperCase() + status.status.slice(1)
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Subscription Status</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-600">Current Plan</p>
          <p className="font-semibold">{status.package?.name || 'No package'}</p>
        </div>

        {status.endDate && (
          <div>
            <p className="text-sm text-gray-600">Expires On</p>
            <p className="font-semibold">
              {new Date(status.endDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {status.daysUntilExpiry > 0 && (
          <div>
            <p className="text-sm text-gray-600">Days Remaining</p>
            <p className="font-semibold">{status.daysUntilExpiry} days</p>
          </div>
        )}

        {(status.isExpired || status.isExpiringSoon) && (
          <button
            onClick={() => router.push('/dashboard/membership')}
            className="w-full mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {status.isExpired ? 'Renew Subscription' : 'Upgrade Now'}
          </button>
        )}
      </div>
    </div>
  )
}







