'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { AlertCircle, RefreshCw, BarChart3, TrendingUp, Zap } from 'lucide-react'
import { errorMonitor } from '../utils/errorMonitor'
import { errorHandler } from '../utils/errorHandler'

interface ErrorStats {
  sessionErrors: number
  sessionDuration: number
  errorsPerMinute: number
  topCategories: Array<[string, number]>
  topComponents: Array<[string, number]>
}

export default function ErrorDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [recentErrors, setRecentErrors] = useState<any[]>([])
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    updateStats()

    // Auto-update every 30 seconds
    const interval = setInterval(updateStats, 30000)

    // Keyboard shortcut to toggle (Ctrl+Shift+E)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const updateStats = () => {
    setStats(errorMonitor.getStats())
    setRecentErrors(errorHandler.getRecentErrors(10))
  }

  const resetStats = () => {
    errorMonitor.resetStats()
    updateStats()
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Error Monitor
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Error Monitoring Dashboard
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={updateStats} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={resetStats} size="sm" variant="outline">
              Reset Stats
            </Button>
            <Button onClick={() => setIsVisible(false)} size="sm" variant="destructive">
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {stats && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium">Session Errors</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.sessionErrors}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Errors/Min</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.errorsPerMinute.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium">Session Duration</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {stats.sessionDuration.toFixed(1)}m
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium">Active Patterns</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {stats.topCategories.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Categories and Components */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Error Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topCategories.length > 0 ? (
                      <div className="space-y-2">
                        {stats.topCategories.map(([category, count]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="text-sm capitalize">{category}</span>
                            <span className="text-sm font-medium bg-red-100 text-red-800 px-2 py-1 rounded">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No errors recorded</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Top Error Components</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topComponents.length > 0 ? (
                      <div className="space-y-2">
                        {stats.topComponents.map(([component, count]) => (
                          <div key={component} className="flex justify-between items-center">
                            <span className="text-sm font-mono">{component}</span>
                            <span className="text-sm font-medium bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No component errors recorded</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Errors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Errors (Last 10)</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentErrors.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {recentErrors.map((error, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-red-600">
                              {error.component || 'Unknown'} • {error.action || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date().toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {typeof error.data === 'string' ? error.data : JSON.stringify(error.data)}
                          </p>
                          {error.stack && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-500 cursor-pointer">Stack Trace</summary>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                {error.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No recent errors</p>
                  )}
                </CardContent>
              </Card>

              {/* Keyboard Shortcut Info */}
              <div className="text-center text-sm text-gray-500 border-t pt-4">
                Press <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl+Shift+E</kbd> to toggle this dashboard
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


