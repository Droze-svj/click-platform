'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

// IMPORTANT: In local dev we want the Next rewrite proxy (`/api`) so auth tokens match the local backend.
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const apiBase = useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_API_URL
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return '/api'
    return DEFAULT_API_URL
  }, [])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Log the actual API URL being used for debugging
      console.log('🔍 Registration Debug Info:')
      console.log('  - API_URL:', apiBase)
      console.log('  - Full endpoint:', `${apiBase}/auth/register`)
      console.log('  - Timestamp:', new Date().toISOString())
      
      const response = await axios.post(`${apiBase}/auth/register`, {
        name,
        email,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 seconds - Render.com free tier can take time to wake up
      })

      console.log('Registration response:', response.data)
      const token = response.data.data?.token || response.data.token
      if (!token) {
        setError('Registration successful but no token received. Please try logging in.')
        return
      }
      
      // Store token
      localStorage.setItem('token', token)
      console.log('✅ Token stored in localStorage')
      
      // Verify token was stored
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        setError('Failed to store authentication token. Please try again.')
        return
      }
      console.log('✅ Token verified in localStorage:', storedToken.substring(0, 30) + '...')
      
      // Redirect to success page instead of dashboard directly
      console.log('✅ Registration successful! Redirecting to success page...')
      setTimeout(() => {
        console.log('🔄 Redirecting to registration success page...')
        router.push('/registration-success')
      }, 500)
    } catch (err: any) {
      console.error('Registration error:', err)
      console.error('Error details:', {
        code: err.code,
        response: err.response?.data,
        status: err.response?.status
      })
      
      let errorMessage = 'Registration failed'
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The server may be waking up (this can take 30-60 seconds on free tier). Please try again in a moment.'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        const isProduction = apiBase.includes('render.com') || apiBase.includes('onrender.com')
        if (isProduction) {
          errorMessage = 'Cannot connect to server. The server may be sleeping (free tier). Please wait 30-60 seconds and try again.'
        } else {
          errorMessage = 'Cannot connect to server. Make sure the backend is running.'
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.response?.data?.details) {
        // Handle express-validator errors array
        const validationErrors = Array.isArray(err.response.data.details)
          ? err.response.data.details.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ')
          : JSON.stringify(err.response.data.details)
        errorMessage = `Validation error: ${validationErrors}`
      } else if (err.response?.data?.errors) {
        // Handle validation errors array
        const validationErrors = Array.isArray(err.response.data.errors) 
          ? err.response.data.errors.map((e: any) => e.msg || e.message || e).join(', ')
          : JSON.stringify(err.response.data.errors)
        errorMessage = `Validation error: ${validationErrors}`
      } else if (err.response?.status) {
        errorMessage = `Server error: ${err.response.status} - ${err.message}`
      } else if (err.message) {
        errorMessage = err.message
      }
      
      // Log full error response for debugging
      console.error('Full error response:', err.response?.data)
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gray-100" 
      style={{ position: 'relative', zIndex: 9999, isolation: 'isolate' }}
    >
      <div 
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md" 
        style={{ position: 'relative', zIndex: 10000, isolation: 'isolate' }}
      >
        <h1 className="text-3xl font-bold mb-6 text-center">Sign Up</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 10002 }}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                console.log('Name input onChange:', e.target.value)
                setName(e.target.value)
              }}
              onFocus={(e) => console.log('Name input focused')}
              onClick={(e) => console.log('Name input clicked')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
              style={{ pointerEvents: 'auto', zIndex: 10001, position: 'relative', color: '#111827' }}
              required
              autoComplete="name"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                console.log('Email input onChange:', e.target.value)
                setEmail(e.target.value)
              }}
              onFocus={(e) => console.log('Email input focused')}
              onClick={(e) => console.log('Email input clicked')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
              style={{ pointerEvents: 'auto', zIndex: 10001, position: 'relative', color: '#111827' }}
              required
              autoComplete="email"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                console.log('Password input onChange:', e.target.value.length, 'characters')
                setPassword(e.target.value)
              }}
              onFocus={(e) => console.log('Password input focused')}
              onClick={(e) => console.log('Password input clicked')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
              style={{ pointerEvents: 'auto', zIndex: 10001, position: 'relative', color: '#111827' }}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 6 characters with uppercase, lowercase, and a number
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-purple-600 hover:underline">
            Login
          </a>
        </p>
      </div>
    </div>
  )
}

