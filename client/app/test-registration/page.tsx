'use client'

import { useState } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function TestRegistration() {
  const [status, setStatus] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
    setStatus(message)
  }

  const testFullFlow = async () => {
    setLogs([])
    addLog('Starting test...')
    
    try {
      // Step 1: Register
      addLog('Step 1: Registering user...')
      const testEmail = `test-${Date.now()}@example.com`
      
      const registerResponse = await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: 'Test123!@#',
        name: 'Test User'
      }, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      addLog(`✅ Registration successful: ${registerResponse.status}`)
      addLog(`Response: ${JSON.stringify(registerResponse.data).substring(0, 100)}...`)
      
      const token = registerResponse.data.data?.token || registerResponse.data.token
      if (!token) {
        addLog('❌ No token in response!')
        return
      }
      
      addLog(`✅ Token received: ${token.substring(0, 30)}...`)
      
      // Step 2: Store token
      localStorage.setItem('token', token)
      addLog('✅ Token stored in localStorage')
      
      // Step 3: Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500))
      addLog('⏳ Waited 500ms')
      
      // Step 4: Test /auth/me
      addLog('Step 2: Testing /auth/me...')
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        addLog('❌ Token not found in localStorage!')
        return
      }
      
      addLog(`Token from localStorage: ${storedToken.substring(0, 30)}...`)
      
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`
        },
        timeout: 30000
      })
      
      addLog(`✅ /auth/me successful: ${meResponse.status}`)
      addLog(`Response: ${JSON.stringify(meResponse.data).substring(0, 200)}...`)
      
      // Check user data
      const user = meResponse.data.user || meResponse.data.data?.user
      if (user) {
        addLog(`✅ User found: ${user.email}`)
        addLog('✅ Full flow successful! Ready to go to dashboard.')
      } else {
        addLog('❌ No user in /auth/me response!')
        addLog(`Full response: ${JSON.stringify(meResponse.data)}`)
      }
      
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`)
      if (error.response) {
        addLog(`Status: ${error.response.status}`)
        addLog(`Data: ${JSON.stringify(error.response.data)}`)
      }
      if (error.code) {
        addLog(`Code: ${error.code}`)
      }
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Registration Flow Test</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-2 text-sm">
            <p><strong>API URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{API_URL}</code></p>
            <p><strong>NEXT_PUBLIC_API_URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'Not set (using default)'}</code></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <button
            onClick={testFullFlow}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 font-semibold mb-4"
          >
            Run Full Registration Flow Test
          </button>
          
          {status && (
            <div className={`p-3 rounded mb-4 ${status.includes('✅') ? 'bg-green-50 text-green-800' : status.includes('❌') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
              <strong>Current Status:</strong> {status}
            </div>
          )}
          
          {logs.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2">Test Logs:</h3>
              <div className="space-y-1 font-mono text-sm">
                {logs.map((log, idx) => (
                  <div key={idx} className={log.includes('❌') ? 'text-red-600' : log.includes('✅') ? 'text-green-600' : 'text-gray-700'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h3 className="font-semibold mb-2">What This Tests</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Registration endpoint</li>
            <li>Token extraction from response</li>
            <li>Token storage in localStorage</li>
            <li>Token retrieval from localStorage</li>
            <li>/auth/me endpoint with token</li>
            <li>User data extraction</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

