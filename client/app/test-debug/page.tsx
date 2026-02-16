'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { sendDebugLog, sendDebugLogNow } from '../../utils/debugLog'

export default function TestDebugPage() {
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    console.log('🔍🔍🔍 TEST DEBUG PAGE: Component mounted at', new Date().toISOString())
    setLogs(prev => [...prev, `Component mounted at ${new Date().toISOString()}`])
    sendDebugLog('test-debug-page', 'test debug page loaded', { timestamp: Date.now() })

    // Test token storage
    const token = localStorage.getItem('token')
    console.log('🔍🔍🔍 TEST DEBUG PAGE: Token check:', !!token, 'length:', token?.length || 0)
    setLogs(prev => [...prev, `Token present: ${!!token}, length: ${token?.length || 0}`])
  }, [])

  const handleSendTestLog = () => {
    const id = Date.now()
    sendDebugLogNow('test-debug-page', 'manual_test_click', { id, label: 'manual check', timestamp: id })
    setLogs(prev => [...prev, `Sent test log (id: ${id}) — check debug dashboard`])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Debug Test Page</h1>
        <p className="mb-4">Check the browser console and server logs for debug output.</p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-2">Quick manual check</h2>
          <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1 mb-3">
            <li>Click &quot;Send test log&quot; below.</li>
            <li>Open &quot;View logs in dashboard&quot; (same or new tab).</li>
            <li>Confirm you see a recent entry with message <code className="bg-amber-100 px-1 rounded">manual_test_click</code>.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSendTestLog}
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 font-medium"
            >
              Send test log
            </button>
            <Link
              href="/debug-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 font-medium"
            >
              View logs in dashboard →
            </Link>
          </div>
        </div>

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
            type="button"
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
