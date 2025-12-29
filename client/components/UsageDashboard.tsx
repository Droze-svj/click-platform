'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface UsageSummary {
  tier: {
    name: string
    slug: string
  }
  usage: {
    aiMinutes: {
      used: number
      limit: number
      percentage: number
      overage: number
      overageCost: number
    }
    clients: {
      used: number
      limit: number
      percentage: number
      overage: number
      overageCost: number
    }
    profiles: {
      used: number
      limit: number
      percentage: number
      overage: number
      overageCost: number
    }
    content: {
      posts: {
        used: number
        limit: number | null
        percentage: number | null
      }
      videos: {
        used: number
        limit: number | null
        percentage: number | null
      }
    }
  }
  features: any
  billing: {
    currentPeriod: {
      start: string
      end: string
    }
    nextBillingDate: string | null
  }
}

export default function UsageDashboard() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsage()
  }, [])

  const loadUsage = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/pricing/usage`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setUsage(res.data.data)
      }
    } catch (error) {
      console.error('Error loading usage', error)
    } finally {
      setLoading(false)
    }
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-orange-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!usage) {
    return <div className="p-8 text-center text-gray-500">No usage data available</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Usage Dashboard</h1>
        <p className="text-gray-600">Current Plan: {usage.tier.name}</p>
      </div>

      {/* AI Minutes */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">AI Minutes</h2>
          <span className="text-sm text-gray-600">
            {usage.usage.aiMinutes.used.toLocaleString()} / {usage.usage.aiMinutes.limit.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className={`h-4 rounded-full ${getPercentageColor(usage.usage.aiMinutes.percentage)}`}
            style={{ width: `${Math.min(100, usage.usage.aiMinutes.percentage)}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-600">
          {usage.usage.aiMinutes.percentage}% used
          {usage.usage.aiMinutes.overage > 0 && (
            <span className="text-red-600 ml-2">
              ({usage.usage.aiMinutes.overage} over limit - ${usage.usage.aiMinutes.overageCost.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* Clients */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Clients</h2>
          <span className="text-sm text-gray-600">
            {usage.usage.clients.used} / {usage.usage.clients.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className={`h-4 rounded-full ${getPercentageColor(usage.usage.clients.percentage)}`}
            style={{ width: `${Math.min(100, usage.usage.clients.percentage)}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-600">
          {usage.usage.clients.percentage}% used
          {usage.usage.clients.overage > 0 && (
            <span className="text-red-600 ml-2">
              ({usage.usage.clients.overage} over limit - ${usage.usage.clients.overageCost.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* Connected Profiles */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Connected Profiles</h2>
          <span className="text-sm text-gray-600">
            {usage.usage.profiles.used} / {usage.usage.profiles.limit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className={`h-4 rounded-full ${getPercentageColor(usage.usage.profiles.percentage)}`}
            style={{ width: `${Math.min(100, usage.usage.profiles.percentage)}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-600">
          {usage.usage.profiles.percentage}% used
          {usage.usage.profiles.overage > 0 && (
            <span className="text-red-600 ml-2">
              ({usage.usage.profiles.overage} over limit - ${usage.usage.profiles.overageCost.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* Content Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Content Usage</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Posts</div>
            <div className="text-xl font-semibold">
              {usage.usage.content.posts.used.toLocaleString()}
              {usage.usage.content.posts.limit && (
                <span className="text-gray-500 text-sm"> / {usage.usage.content.posts.limit.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Videos</div>
            <div className="text-xl font-semibold">
              {usage.usage.content.videos.toLocaleString()}
              {usage.usage.content.videos.limit && (
                <span className="text-gray-500 text-sm"> / {usage.usage.content.videos.limit.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Billing Period */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Billing Period</h2>
        <div className="text-sm text-gray-600">
          <div>Current Period: {new Date(usage.billing.currentPeriod.start).toLocaleDateString()} - {new Date(usage.billing.currentPeriod.end).toLocaleDateString()}</div>
          {usage.billing.nextBillingDate && (
            <div className="mt-2">Next Billing: {new Date(usage.billing.nextBillingDate).toLocaleDateString()}</div>
          )}
        </div>
      </div>
    </div>
  )
}

