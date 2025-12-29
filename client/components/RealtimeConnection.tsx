'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function RealtimeConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Initialize Socket.io connection
    const socket = require('socket.io-client')(
      process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001',
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

  if (isConnected) {
    return null // Don't show when connected
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
              Connection lost
            </p>
          </>
        )}
      </div>
    </div>
  )
}






