'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiGet, handleApiError } from '@/lib/api'

function RegistrationSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const verificationRequired = searchParams?.get('verification') === 'required'
  const email = searchParams?.get('email') || ''

  useEffect(() => {
    if (verificationRequired) {
      // Skip auth check if verification is required
      setLoading(false)
      return
    }
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationRequired])

  const checkAuth = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) {
        setError('No authentication token found. Please register again.')
        setLoading(false)
        return
      }
      
      const response = await apiGet<any>('/auth/me')
      setUser(response?.user || response?.data?.user)
      setError('')
    } catch (err: any) {
      const errorMessage = handleApiError(err)
      setError(`Failed to verify authentication: ${errorMessage}`)
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Auth check failed:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const goToDashboard = () => {
    router.push('/dashboard')
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

  // Show email verification message if required
  if (verificationRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-3xl font-bold mb-2 text-purple-600">Check Your Email!</h1>
            <p className="text-gray-600 mb-4">
              We've sent a verification link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Please click the link in the email to verify your account and complete registration.
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-purple-800">
              <strong>Didn't receive the email?</strong>
            </p>
            <ul className="text-xs text-purple-700 mt-2 space-y-1 list-disc list-inside">
              <li>Check your spam/junk folder</li>
              <li>Wait a few minutes for delivery</li>
              <li>Make sure you entered the correct email address</li>
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 font-semibold text-lg"
            >
              Go to Login
            </button>
            <button
              onClick={() => router.push('/register')}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300"
            >
              Back to Registration
            </button>
          </div>
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

export default function RegistrationSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-xl mb-4">Loading...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      </div>
    }>
      <RegistrationSuccessContent />
    </Suspense>
  )
}