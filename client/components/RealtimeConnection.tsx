'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function RealtimeConnection() {
  const pathname = usePathname()
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const { user, loading } = useAuth()

  // Don't show on auth pages (login, register) or when loading
  if (pathname === '/login' || pathname === '/register' || loading) {
    return null
  }

  useEffect(() => {
    if (!user) return

    // Initialize Socket.io connection
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
    const socketUrl = apiUrl.replace('/api', '') || 'https://click-platform.onrender.com'
    
    const socket = require('socket.io-client')(
      socketUrl,
      {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      }
    )

    socket.on('connect', () => {
      setIsConnected(true)
      setReconnectAttempts(0)
      
      // Join user room
      socket.emit('join-user', user.id)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('reconnect_attempt', () => {
      setReconnectAttempts(prev => prev + 1)
    })

    socket.on('reconnect', () => {
      setIsConnected(true)
      setReconnectAttempts(0)
      socket.emit('join-user', user.id)
    })

    // Listen for processing updates
    socket.on('processing:progress', (data: any) => {
      // Handle progress updates
      console.log('Processing progress:', data)
    })

    socket.on('processing:complete', (data: any) => {
      // Handle completion
      console.log('Processing complete:', data)
    })

    socket.on('processing:failed', (data: any) => {
      // Handle failure
      console.log('Processing failed:', data)
    })

    return () => {
      socket.disconnect()
    }
  }, [user])

  // Only show after a few seconds of disconnection (not immediately)
  useEffect(() => {
    if (!isConnected && user) {
      const timer = setTimeout(() => setShowWarning(true), 3000)
      return () => clearTimeout(timer)
    } else {
      setShowWarning(false)
    }
  }, [isConnected, user])

  // Only show connection status if user is logged in
  if (!user || loading) {
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






