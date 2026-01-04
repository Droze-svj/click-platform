'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseSocketReturn {
  socket: Socket | null
  connected: boolean
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback?: (...args: any[]) => void) => void
}

// Global singleton socket (prevents React strict-mode mount/unmount thrash in dev)
let globalSocket: Socket | null = null
let globalSocketUsers = 0
let globalDisconnectTimer: any = null

export function useSocket(userId?: string | null): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const serverUrl = useMemo(() => {
    // Prefer the local backend for local dev.
    if (typeof window !== 'undefined') {
      const host = window.location.hostname
      if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5001'
    }
    return process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001'
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    globalSocketUsers += 1
    if (globalDisconnectTimer) {
      clearTimeout(globalDisconnectTimer)
      globalDisconnectTimer = null
    }

    // Reuse a single socket instance globally (across components).
    if (!globalSocket) {
      const socketInstance = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
      })

      socketInstance.on('connect', () => {
        console.log('Socket connected:', socketInstance.id)
        setConnected(true)
      })

      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected')
        setConnected(false)
      })

      socketInstance.on('error', (error) => {
        console.error('Socket error:', error)
      })

      globalSocket = socketInstance
    }

    socketRef.current = globalSocket
    setSocket(globalSocket)

    return () => {
      globalSocketUsers -= 1
      socketRef.current = null

      // Delay disconnect slightly so React dev strict-mode's double-invocation doesn't cause
      // "WebSocket is closed before the connection is established" spam.
      if (globalSocketUsers <= 0) {
        globalDisconnectTimer = setTimeout(() => {
          globalSocket?.disconnect()
          globalSocket = null
          globalSocketUsers = 0
          globalDisconnectTimer = null
        }, 250)
      }
    }
  }, [serverUrl])

  // Join user room when userId becomes available or changes (without recreating socket).
  useEffect(() => {
    if (!userId) return
    if (!socketRef.current) return
    socketRef.current.emit('join-user', userId)
  }, [userId])

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.on(event, callback)
    }
  }, [socket])

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socket) {
      if (callback) {
        socket.off(event, callback)
      } else {
        socket.off(event)
      }
    }
  }, [socket])

  return { socket, connected, on, off }
}
