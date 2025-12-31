'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

// Global flag to prevent multiple simultaneous auth checks
let authCheckInProgress = false
let lastAuthCheck = 0
const AUTH_CHECK_DEBOUNCE_MS = 2000 // 2 seconds

interface User {
  id: string
  email: string
  name: string
  subscription: {
    status: string
    plan: string
  }
  niche?: string
  brandSettings?: any
  usage?: {
    videosProcessed: number
    contentGenerated: number
    quotesCreated: number
    postsScheduled: number
  }
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    // Debounce auth checks to prevent excessive API calls
    const now = Date.now()
    const timeSinceLastCheck = now - lastAuthCheck
    
    if (timeSinceLastCheck < AUTH_CHECK_DEBOUNCE_MS && lastAuthCheck > 0) {
      // If a check was done recently, wait a bit
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          checkAuth()
        }
      }, AUTH_CHECK_DEBOUNCE_MS - timeSinceLastCheck)
      return () => clearTimeout(timer)
    } else {
      checkAuth()
    }

    return () => {
      mountedRef.current = false
    }
  }, [])

  const checkAuth = async (retryCount = 0) => {
    // Prevent multiple simultaneous auth checks
    if (authCheckInProgress && retryCount === 0) {
      console.log('🔍 [useAuth] Auth check already in progress, skipping...')
      return
    }

    authCheckInProgress = true
    lastAuthCheck = Date.now()
    try {
      // Don't redirect on auth pages
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        if (pathname === '/login' || pathname === '/register' || pathname === '/') {
          setLoading(false)
          return
        }
      }

      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        // Only redirect if not on auth pages
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname
          if (pathname !== '/login' && pathname !== '/register' && pathname !== '/') {
            router.push('/login')
          }
        }
        return
      }

      console.log('🔍 [useAuth] Checking auth with token:', token.substring(0, 20) + '...')
      console.log('🔍 [useAuth] API URL:', API_URL)
      console.log('🔍 [useAuth] Retry attempt:', retryCount)

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000 // 60 seconds for Render.com free tier
      })

      console.log('✅ [useAuth] User loaded:', response.data)
      setUser(response.data.user || response.data.data?.user)
      setError(null)
    } catch (err: any) {
      console.error('❌ [useAuth] Auth check failed:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        status: err.response?.status
      })

      // Retry logic for network errors (Render.com free tier can be slow)
      if (retryCount < 2 && (
        err.code === 'ECONNABORTED' || 
        err.code === 'ERR_NETWORK' || 
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('timeout') ||
        err.message?.includes('Network Error')
      )) {
        console.log(`🔄 [useAuth] Retrying in 2 seconds... (attempt ${retryCount + 1}/2)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return checkAuth(retryCount + 1)
      }

      // Only redirect to login if it's an auth error (401, 403) or max retries reached
      if (err.response?.status === 401 || err.response?.status === 403 || retryCount >= 2) {
        setError(err.response?.data?.error || 'Authentication failed')
        localStorage.removeItem('token')
        router.push('/login')
      } else {
        // For other errors, don't redirect immediately
        setError('Connection issue. Please try again.')
      }
    } finally {
      authCheckInProgress = false
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    router.push('/login')
  }

  return { user, loading, error, logout, refresh: checkAuth }
}







