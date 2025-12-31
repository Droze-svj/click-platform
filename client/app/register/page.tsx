'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

// Use production API URL - can be overridden with NEXT_PUBLIC_API_URL env var
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Log the actual API URL being used for debugging
      console.log('🔍 Registration Debug Info:')
      console.log('  - API_URL:', API_URL)
      console.log('  - Full endpoint:', `${API_URL}/auth/register`)
      console.log('  - Timestamp:', new Date().toISOString())
      
      const response = await axios.post(`${API_URL}/auth/register`, {
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
      
      // Wait a moment to ensure token is stored, then redirect
      // Increased delay to ensure localStorage is fully written
      setTimeout(() => {
        console.log('🔄 Redirecting to dashboard...')
        router.push('/dashboard')
      }, 500)
    } catch (err: any) {
      console.error('Registration error:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status
      })
      
      let errorMessage = 'Registration failed'
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The server may be waking up (this can take 30-60 seconds on free tier). Please try again in a moment.'
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        const isProduction = API_URL.includes('render.com') || API_URL.includes('onrender.com')
        if (isProduction) {
          errorMessage = 'Cannot connect to server. The server may be sleeping (free tier). Please wait 30-60 seconds and try again.'
        } else {
          errorMessage = 'Cannot connect to server. Make sure the backend is running.'
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.response?.status) {
        errorMessage = `Server error: ${err.response.status} - ${err.message}`
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Sign Up</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              minLength={6}
            />
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

