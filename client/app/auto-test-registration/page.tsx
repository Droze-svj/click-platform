'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function AutoTestRegistration() {
  const [status, setStatus] = useState<string>('Ready to test')
  const [logs, setLogs] = useState<string[]>([])
  const [autoRunning, setAutoRunning] = useState(false)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔍'
    setLogs(prev => [...prev, `${timestamp} ${icon} ${message}`])
    setStatus(message)
  }

  const runAutoTest = async () => {
    setLogs([])
    setAutoRunning(true)
    addLog('Starting automatic registration test...', 'info')

    try {
      // Step 1: Wake up server
      addLog('Step 1: Waking up server...', 'info')
      try {
        await axios.get(`${API_URL}/health`, { timeout: 30000 })
        addLog('Server is awake!', 'success')
      } catch (err: any) {
        addLog(`Server might be sleeping (${err.message}). Continuing anyway...`, 'info')
      }

      await new Promise(resolve => setTimeout(resolve, 2000))

      // Step 2: Register
      addLog('Step 2: Registering new user...', 'info')
      const testEmail = `autotest-${Date.now()}@example.com`
      addLog(`Using email: ${testEmail}`, 'info')

      const registerResponse = await axios.post(
        `${API_URL}/auth/register`,
        {
          email: testEmail,
          password: 'Test123!@#',
          name: 'Auto Test User'
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      addLog(`Registration successful! Status: ${registerResponse.status}`, 'success')
      addLog(`Response: ${JSON.stringify(registerResponse.data).substring(0, 150)}...`, 'info')

      const token = registerResponse.data.data?.token || registerResponse.data.token
      if (!token) {
        addLog('ERROR: No token in response!', 'error')
        setAutoRunning(false)
        return
      }

      addLog(`Token received: ${token.substring(0, 30)}...`, 'success')

      // Step 3: Store token
      addLog('Step 3: Storing token in localStorage...', 'info')
      localStorage.setItem('token', token)
      addLog('Token stored!', 'success')

      // Step 4: Verify token
      await new Promise(resolve => setTimeout(resolve, 500))
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        addLog('ERROR: Token not found in localStorage!', 'error')
        setAutoRunning(false)
        return
      }
      addLog(`Token verified: ${storedToken.substring(0, 30)}...`, 'success')

      // Step 5: Test /auth/me
      addLog('Step 4: Testing /auth/me endpoint...', 'info')
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        },
        timeout: 30000
      })

      addLog(`/auth/me successful! Status: ${meResponse.status}`, 'success')
      const user = meResponse.data.user || meResponse.data.data?.user
      if (user) {
        addLog(`User loaded: ${user.email}`, 'success')
        addLog(`User ID: ${user.id}`, 'info')
        addLog(`User name: ${user.name}`, 'info')
      } else {
        addLog('WARNING: No user in response', 'error')
      }

      // Step 6: Redirect to dashboard
      addLog('Step 5: All tests passed! Redirecting to dashboard...', 'success')
      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('Redirecting now...', 'info')
      window.location.href = '/dashboard'

    } catch (error: any) {
      addLog(`ERROR: ${error.message}`, 'error')
      if (error.response) {
        addLog(`Status: ${error.response.status}`, 'error')
        addLog(`Data: ${JSON.stringify(error.response.data)}`, 'error')
      }
      if (error.code) {
        addLog(`Code: ${error.code}`, 'error')
      }
      setAutoRunning(false)
    }
  }

  useEffect(() => {
    // Auto-run on page load
    const timer = setTimeout(() => {
      if (!autoRunning) {
        runAutoTest()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Automatic Registration Test</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-2 text-sm">
            <p><strong>API URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{API_URL}</code></p>
            <p><strong>Status:</strong> <span className={autoRunning ? 'text-blue-600' : 'text-gray-600'}>{status}</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Test Logs</h2>
            <button
              onClick={runAutoTest}
              disabled={autoRunning}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {autoRunning ? 'Running...' : 'Run Test Again'}
            </button>
          </div>
          
          {logs.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded max-h-96 overflow-y-auto">
              <div className="space-y-1 font-mono text-sm">
                {logs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={
                      log.includes('❌') ? 'text-red-600' : 
                      log.includes('✅') ? 'text-green-600' : 
                      'text-gray-700'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {logs.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Test will start automatically in 1 second...
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded">
          <h3 className="font-semibold mb-2">What This Does</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Wakes up the server (if sleeping)</li>
            <li>Registers a new test user</li>
            <li>Stores the authentication token</li>
            <li>Tests the /auth/me endpoint</li>
            <li>Redirects to dashboard if successful</li>
          </ul>
          <p className="mt-3 text-sm text-gray-600">
            <strong>Note:</strong> This test runs automatically when you open this page. 
            If successful, you'll be redirected to the dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}

