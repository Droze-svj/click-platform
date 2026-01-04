'use client'

import React, { useState, useEffect } from 'react'

interface DebugDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export default function DebugDashboard({ isOpen, onClose }: DebugDashboardProps) {
  const [debugData, setDebugData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch debug data from the ingest endpoint
  const fetchDebugData = async () => {
    try {
      // This would need a way to fetch from the debug log
      // For now, we'll simulate with local storage
      const storedData = localStorage.getItem('debug_dashboard_data')
      if (storedData) {
        setDebugData(JSON.parse(storedData))
      }
    } catch (error) {
      console.error('Failed to fetch debug data:', error)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchDebugData()

      if (autoRefresh) {
        const interval = setInterval(fetchDebugData, 5000)
        return () => clearInterval(interval)
      }
    }
  }, [isOpen, autoRefresh])

  const clearDebugData = () => {
    localStorage.removeItem('debug_dashboard_data')
    setDebugData([])
  }

  const exportDebugData = () => {
    const dataStr = JSON.stringify(debugData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `debug-data-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (!isOpen) return null

  const performanceMetrics = debugData.filter(d => d.message?.includes('performance') || d.message?.includes('memory'))
  const apiCalls = debugData.filter(d => d.message?.includes('api_'))
  const errors = debugData.filter(d => d.message?.includes('error') || d.data?.error)
  const componentEvents = debugData.filter(d => d.message?.includes('component_') || d.message?.includes('interaction_'))

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔍 Debug Dashboard
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: autoRefresh ? '#f0fdf4' : 'white',
                fontSize: '12px'
              }}
            >
              {autoRefresh ? '👁️ Auto-refresh' : '👁️‍🗨️ Manual'}
            </button>
            <button
              onClick={fetchDebugData}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '12px'
              }}
            >
              🔄 Refresh
            </button>
            <button
              onClick={exportDebugData}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '12px'
              }}
            >
              💾 Export
            </button>
            <button
              onClick={clearDebugData}
              style={{
                padding: '4px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '12px'
              }}
            >
              🗑️ Clear
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            {['overview', 'performance', 'api', 'errors', 'components'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: activeTab === tab ? '#f3f4f6' : 'white',
                  fontSize: '14px',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Total Events</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{debugData.length}</div>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>API Calls</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{apiCalls.length}</div>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Errors</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'red' }}>{errors.length}</div>
                </div>
                <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Performance</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{performanceMetrics.length}</div>
                </div>
              </div>

              <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Recent Events</h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {debugData.slice(-10).reverse().map((event, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px',
                      backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                      borderRadius: '4px',
                      marginBottom: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {event.message}
                        </span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          {new Date(event.data?.timestamp || event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {event.location}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Performance Metrics</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {performanceMetrics.slice(-10).reverse().map((metric, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontSize: '14px' }}>{metric.message}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {metric.data?.duration ? `${metric.data.duration}ms` : ''}
                      {metric.data?.fps ? `${metric.data.fps} FPS` : ''}
                      {metric.data?.memoryUsage ? `${Math.round(metric.data.memoryUsage.used / 1024 / 1024)}MB used` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>API Call History</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {apiCalls.slice(-10).reverse().map((call, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: call.message?.includes('error') ? '#fef2f2' : '#f0f9ff',
                        color: call.message?.includes('error') ? '#dc2626' : '#0369a1',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {call.data?.method || 'GET'}
                      </span>
                      <span style={{ fontSize: '14px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {call.data?.url || call.message}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {call.data?.status} • {call.data?.duration ? `${call.data.duration}ms` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Error Events</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {errors.slice(-10).reverse().map((error, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#dc2626' }}>⚠️</span>
                      <span style={{ fontSize: '14px', color: '#dc2626' }}>
                        {error.data?.error?.message || error.message}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {error.location}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'components' && (
            <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Component Events</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {componentEvents.slice(-10).reverse().map((event, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ fontSize: '14px' }}>{event.message}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {event.data?.componentName || event.location}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
