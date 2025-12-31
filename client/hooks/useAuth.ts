'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

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

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async (retryCount = 0) => {
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
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    router.push('/login')
  }

  return { user, loading, error, logout, refresh: checkAuth }
}







