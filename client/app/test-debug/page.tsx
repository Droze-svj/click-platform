'use client'

import { useEffect, useState } from 'react'

export default function TestDebugPage() {
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    console.log('🔍🔍🔍 TEST DEBUG PAGE: Component mounted at', new Date().toISOString())
    setLogs(prev => [...prev, `Component mounted at ${new Date().toISOString()}`])

    // Test the debug API directly
    console.log('🔍🔍🔍 TEST DEBUG PAGE: About to call /debug/log')
    fetch('/api/debug/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'test-debug-page.tsx',
        message: 'test debug page loaded',
        data: { timestamp: Date.now() }
      })
    }).then((response) => {
      console.log('🔍🔍🔍 TEST DEBUG PAGE: Debug API call completed with status:', response.status)
      setLogs(prev => [...prev, `Debug API call completed, status: ${response.status}`])
    }).catch((err) => {
      console.error('🔍🔍🔍 TEST DEBUG PAGE: Debug API call failed:', err)
      setLogs(prev => [...prev, `Debug API call failed: ${err.message}`])
    })

    // Test token storage
    const token = localStorage.getItem('token')
    console.log('🔍🔍🔍 TEST DEBUG PAGE: Token check:', !!token, 'length:', token?.length || 0)
    setLogs(prev => [...prev, `Token present: ${!!token}, length: ${token?.length || 0}`])
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Debug Test Page</h1>
        <p className="mb-4">Check the browser console and server logs for debug output.</p>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Test Results:</h2>
          <ul className="space-y-1">
            {logs.map((log, i) => (
              <li key={i} className="text-sm font-mono bg-gray-100 p-2 rounded">
                {log}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <button
            onClick={() => {
              console.log('🔍 Manual test button clicked')
              setLogs(prev => [...prev, 'Manual test button clicked'])
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Manual Test
          </button>
        </div>
      </div>
    </div>
  )
}
