'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function RegistrationSuccess() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('No authentication token found. Please register again.')
        setLoading(false)
        return
      }

      console.log('Checking auth with token:', token.substring(0, 20) + '...')
      
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000
      })

      console.log('User data received:', response.data)
      setUser(response.data.user || response.data.data?.user)
      setError('')
    } catch (err: any) {
      console.error('Auth check failed:', err)
      setError(`Failed to verify authentication: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const goToDashboard = () => {
    window.location.href = '/dashboard'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-xl mb-4">Verifying your account...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Registration Issue</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/register')}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
            >
              Try Registering Again
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold mb-2 text-green-600">Registration Successful!</h1>
          <p className="text-gray-600">Your account has been created.</p>
        </div>

        {user && (
          <div className="bg-gray-50 p-4 rounded mb-6">
            <h2 className="font-semibold mb-2">Account Details:</h2>
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.id}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={goToDashboard}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 font-semibold text-lg"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300"
          >
            Go to Login Instead
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-500 text-center">
          <p>Token stored in localStorage: ✅</p>
          <p className="mt-2">If dashboard doesn't work, try logging in with your email and password.</p>
        </div>
      </div>
    </div>
  )
}

