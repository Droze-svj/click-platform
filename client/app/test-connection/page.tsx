'use client'

import { useState } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function TestConnection() {
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const testHealth = async () => {
    setStatus('Testing health endpoint...')
    setError('')
    setResult(null)
    
    try {
      const response = await axios.get(`${API_URL}/health`, { timeout: 30000 })
      setResult(response.data)
      setStatus('✅ Health check successful!')
    } catch (err: any) {
      setError(`Error: ${err.message} (Code: ${err.code || 'N/A'})`)
      setStatus('❌ Health check failed')
    }
  }

  const testRegister = async () => {
    setStatus('Testing registration endpoint...')
    setError('')
    setResult(null)
    
    const testEmail = `test-${Date.now()}@example.com`
    
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: 'Test123!@#',
        name: 'Test User'
      }, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      setResult(response.data)
      setStatus('✅ Registration test successful!')
    } catch (err: any) {
      setError(`Error: ${err.message} (Code: ${err.code || 'N/A'})`)
      if (err.response) {
        setError(`Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`)
      }
      setStatus('❌ Registration test failed')
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Connection Test Page</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-2">
            <p><strong>API URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{API_URL}</code></p>
            <p><strong>Environment:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{process.env.NODE_ENV || 'development'}</code></p>
            <p><strong>NEXT_PUBLIC_API_URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'Not set (using default)'}</code></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Tests</h2>
          <div className="space-y-4">
            <div>
              <button
                onClick={testHealth}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-4"
              >
                Test Health Endpoint
              </button>
              <button
                onClick={testRegister}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Test Registration Endpoint
              </button>
            </div>
            
            {status && (
              <div className={`p-3 rounded ${status.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {status}
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {result && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded">
                <strong>Response:</strong>
                <pre className="mt-2 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h3 className="font-semibold mb-2">Troubleshooting</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>If tests fail, check browser console (F12) for errors</li>
            <li>Check Network tab to see the actual request/response</li>
            <li>Make sure the backend is awake: <code>curl https://click-platform.onrender.com/api/health</code></li>
            <li>Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

