'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'

export default function RealtimeConnection() {
  const pathname = usePathname()
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const { user, loading } = useAuth()
  const { connected } = useSocket(user?.id || null)

  // Don't show on auth pages (login, register) or when loading
  // Check this AFTER all hooks are called (React rules)
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/'

  useEffect(() => {
    if (isAuthPage || loading) return
    setIsConnected(connected)
    if (!connected && user) {
      setReconnectAttempts((prev) => prev + 1)
    } else if (connected) {
      setReconnectAttempts(0)
    }
  }, [connected, user, isAuthPage, loading])

  // Only show after a few seconds of disconnection (not immediately)
  useEffect(() => {
    if (isAuthPage || loading) {
      setShowWarning(false)
      return
    }
    
    if (!isConnected && user) {
      const timer = setTimeout(() => setShowWarning(true), 3000)
      return () => clearTimeout(timer)
    } else {
      setShowWarning(false)
    }
  }, [isConnected, user, isAuthPage, loading])

  // Don't show on auth pages or when loading
  if (isAuthPage || loading) {
    return null
  }

  // Only show connection status if user is logged in
  if (!user) {
    return null
  }

  // Don't show warning if connected
  if (isConnected) {
    return null
  }

  // Don't show warning immediately - wait a few seconds
  if (!showWarning) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 shadow-lg z-50">
      <div className="flex items-center gap-2">
        {reconnectAttempts > 0 ? (
          <>
            <WifiOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Reconnecting...
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Attempt {reconnectAttempts}
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Real-time connection lost
            </p>
          </>
        )}
      </div>
    </div>
  )
}






