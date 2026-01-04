'use client'

import { useState } from 'react'
import { RefreshCw, TrendingUp, CheckCircle2 } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface PlatformAnalyticsSyncProps {
  postId?: string
  onSync?: (analytics: any) => void
}

export default function PlatformAnalyticsSync({ postId, onSync }: PlatformAnalyticsSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const { showToast } = useToast()

  const syncAnalytics = async () => {
    setIsSyncing(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = postId
        ? `/api/analytics/platform/sync/${postId}`
        : '/api/analytics/platform/sync-all'

      const response = await fetch(endpoint, {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setLastSync(new Date())
        showToast('Analytics synced successfully', 'success')
        if (onSync) {
          onSync(data.data)
        }
      } else {
        showToast('Failed to sync analytics', 'error')
      }
    } catch (error) {
      showToast('Failed to sync analytics', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={syncAnalytics}
        disabled={isSyncing}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{isSyncing ? 'Syncing...' : 'Sync Analytics'}</span>
      </button>
      
      {lastSync && (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span>Synced {lastSync.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}






