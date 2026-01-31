'use client'

import { useEffect, useState } from 'react'

interface DebugLog {
  timestamp: number
  component: string
  message: string
  data: any
}

interface DebugStats {
  logs: DebugLog[]
  total: number
  timestamp: number
}

export default function DebugDashboardPage() {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [stats, setStats] = useState<DebugStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedComponent, setSelectedComponent] = useState<string>('')
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copyAllStatus, setCopyAllStatus] = useState<'idle' | 'copied'>('idle')
  const [copyJsonStatus, setCopyJsonStatus] = useState<'idle' | 'copied'>('idle')
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    loadDebugLogs()
    // Refresh every 5 seconds
    const interval = setInterval(loadDebugLogs, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDebugLogs = async () => {
    try {
      const response = await fetch('/api/debug/log')
      const data = await response.json()
      setStats(data)
      setLogs(data.logs || [])
    } catch (error) {
      console.error('Failed to load debug logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesFilter = !filter ||
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      JSON.stringify(log.data).toLowerCase().includes(filter.toLowerCase())

    const matchesComponent = !selectedComponent || log.component === selectedComponent

    return matchesFilter && matchesComponent
  })

  const componentStats = logs.reduce((acc, log) => {
    acc[log.component] = (acc[log.component] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatData = (data: any) => {
    return JSON.stringify(data, null, 2)
  }

  const copyLogToClipboard = async (log: DebugLog, index: number) => {
    try {
      const logText = `Component: ${log.component}
Message: ${log.message}
Timestamp: ${new Date(log.timestamp).toISOString()}
Data:
${formatData(log.data)}`
      
      await navigator.clipboard.writeText(logText)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('Failed to copy log:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = `Component: ${log.component}\nMessage: ${log.message}\nTimestamp: ${new Date(log.timestamp).toISOString()}\nData:\n${formatData(log.data)}`
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const copyAllLogsToClipboard = async () => {
    try {
      const logsToCopy = filteredLogs.length > 0 ? filteredLogs : logs
      const logText = logsToCopy.map((log, index) => {
        return `[${index + 1}] ${new Date(log.timestamp).toISOString()}
Component: ${log.component}
Message: ${log.message}
Data:
${formatData(log.data)}
${'='.repeat(80)}`
      }).join('\n\n')

      const fullText = `Debug Dashboard Logs
Total: ${logsToCopy.length} logs
Generated: ${new Date().toISOString()}

${logText}`

      await navigator.clipboard.writeText(fullText)
      setCopyAllStatus('copied')
      setTimeout(() => setCopyAllStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy all logs:', error)
      // Fallback for older browsers
      const logsToCopy = filteredLogs.length > 0 ? filteredLogs : logs
      const logText = logsToCopy.map((log, index) => {
        return `[${index + 1}] ${new Date(log.timestamp).toISOString()}\nComponent: ${log.component}\nMessage: ${log.message}\nData:\n${formatData(log.data)}\n${'='.repeat(80)}`
      }).join('\n\n')
      const fullText = `Debug Dashboard Logs\nTotal: ${logsToCopy.length} logs\nGenerated: ${new Date().toISOString()}\n\n${logText}`
      const textArea = document.createElement('textarea')
      textArea.value = fullText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopyAllStatus('copied')
      setTimeout(() => setCopyAllStatus('idle'), 2000)
    }
  }

  const copyLogsAsJSON = async () => {
    try {
      const logsToCopy = filteredLogs.length > 0 ? filteredLogs : logs
      const jsonData = {
        metadata: {
          total: logsToCopy.length,
          generated: new Date().toISOString(),
          filtered: filteredLogs.length > 0 && filteredLogs.length < logs.length,
          filter: filter || null,
          component: selectedComponent || null
        },
        logs: logsToCopy.map(log => ({
          timestamp: log.timestamp,
          timestampISO: new Date(log.timestamp).toISOString(),
          component: log.component,
          message: log.message,
          data: log.data
        }))
      }

      const jsonText = JSON.stringify(jsonData, null, 2)
      await navigator.clipboard.writeText(jsonText)
      setCopyJsonStatus('copied')
      setTimeout(() => setCopyJsonStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy logs as JSON:', error)
      // Fallback for older browsers
      const logsToCopy = filteredLogs.length > 0 ? filteredLogs : logs
      const jsonData = {
        metadata: {
          total: logsToCopy.length,
          generated: new Date().toISOString(),
          filtered: filteredLogs.length > 0 && filteredLogs.length < logs.length,
          filter: filter || null,
          component: selectedComponent || null
        },
        logs: logsToCopy.map(log => ({
          timestamp: log.timestamp,
          timestampISO: new Date(log.timestamp).toISOString(),
          component: log.component,
          message: log.message,
          data: log.data
        }))
      }
      const jsonText = JSON.stringify(jsonData, null, 2)
      const textArea = document.createElement('textarea')
      textArea.value = jsonText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopyJsonStatus('copied')
      setTimeout(() => setCopyJsonStatus('idle'), 2000)
    }
  }

  const clearLogHistory = async () => {
    if (!confirm('Are you sure you want to clear all debug logs? This action cannot be undone.')) {
      return
    }

    setClearing(true)
    try {
      const response = await fetch('/api/debug/log', {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        // Reload logs to show empty state
        await loadDebugLogs()
        alert('Logs cleared successfully!')
      } else {
        alert('Failed to clear logs: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
      alert('Failed to clear logs. Please try again.')
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Debug Dashboard</h1>
          <div className="animate-pulse">Loading debug logs...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🔍 Debug Dashboard</h1>
          <div className="text-sm text-gray-600">
            Total Logs: {stats?.total || 0} | Last Updated: {stats ? formatTimestamp(stats.timestamp) : 'Never'}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Component Activity</h3>
            <div className="space-y-2">
              {Object.entries(componentStats).map(([component, count]) => (
                <div key={component} className="flex justify-between">
                  <span className="text-sm">{component}</span>
                  <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {logs.slice(0, 5).map((log, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">{log.component}:</span> {log.message}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={loadDebugLogs}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Refresh Logs
              </button>
              <button
                onClick={() => setFilter('')}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={copyAllLogsToClipboard}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  copyAllStatus === 'copied'
                    ? 'bg-green-500 text-white'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {copyAllStatus === 'copied' ? '✓ Copied!' : `📋 Copy All Logs (${filteredLogs.length > 0 ? filteredLogs.length : logs.length})`}
              </button>
              <button
                onClick={copyLogsAsJSON}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  copyJsonStatus === 'copied'
                    ? 'bg-green-500 text-white'
                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                }`}
              >
                {copyJsonStatus === 'copied' ? '✓ Copied as JSON!' : `📄 Copy as JSON (${filteredLogs.length > 0 ? filteredLogs.length : logs.length})`}
              </button>
              <button
                onClick={clearLogHistory}
                disabled={clearing || logs.length === 0}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  clearing || logs.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {clearing ? 'Clearing...' : `🗑️ Clear Log History (${logs.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Search Logs</label>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search messages or data..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Filter by Component</label>
              <select
                value={selectedComponent}
                onChange={(e) => setSelectedComponent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Components</option>
                {Object.keys(componentStats).map(component => (
                  <option key={component} value={component}>{component}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} logs
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Component
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {log.component}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {log.message}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                      <details className="cursor-pointer">
                        <summary className="hover:text-gray-700">Click to expand</summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {formatData(log.data)}
                        </pre>
                      </details>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => copyLogToClipboard(log, index)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          copiedIndex === index
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        title="Copy this log to clipboard"
                      >
                        {copiedIndex === index ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No logs found matching your filters.
          </div>
        )}
      </div>
    </div>
  )
}
