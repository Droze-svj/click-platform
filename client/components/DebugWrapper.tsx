'use client'

import React, { useEffect, useRef, useState } from 'react'

interface DebugWrapperProps {
  children: React.ReactNode
  componentName: string
  debugLevel?: 'basic' | 'detailed' | 'comprehensive'
  trackRenders?: boolean
  trackProps?: boolean
  trackPerformance?: boolean
}

interface RenderMetrics {
  renderCount: number
  lastRenderTime: number
  averageRenderTime: number
  totalRenderTime: number
  propsChanged: boolean
  lastPropsKeys: string[]
}

export default function DebugWrapper({
  children,
  componentName,
  debugLevel = 'basic',
  trackRenders = false,
  trackProps = false,
  trackPerformance = false
}: DebugWrapperProps) {
  const renderStartTime = useRef<number>(0)
  const renderMetricsRef = useRef<RenderMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    propsChanged: false,
    lastPropsKeys: []
  })
  const lastPropsRef = useRef<any>(null)
  const mountTimeRef = useRef<number>(Date.now())

  // Debug logging function
  const sendDebugLog = (message: string, data: any) => {
    // #region agent log
    fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'DebugWrapper.tsx',
        message: `debug_wrapper_${message}`,
        data: {
          componentName,
          ...data,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run-debug-wrapper'
        }
      }),
    }).catch(() => {})
    // #endregion
  }

  // Component lifecycle tracking
  useEffect(() => {
    const mountDuration = Date.now() - mountTimeRef.current

    sendDebugLog('component_mounted', {
      debugLevel,
      trackRenders,
      trackProps,
      trackPerformance,
      mountDuration,
      initialMemory: (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize
      } : null
    })

    return () => {
      const totalLifetime = Date.now() - mountTimeRef.current
      sendDebugLog('component_unmounted', {
        totalLifetime,
        finalRenderCount: renderMetricsRef.current.renderCount,
        finalMemory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize
        } : null
      })
    }
  }, [componentName, debugLevel, trackRenders, trackProps, trackPerformance])

  // Props change detection
  useEffect(() => {
    if (trackProps && debugLevel !== 'basic') {
      const currentPropsKeys = Object.keys(lastPropsRef.current || {})
      const propsChanged = JSON.stringify(lastPropsRef.current) !== JSON.stringify({})

      if (propsChanged || renderMetricsRef.current.renderCount === 0) {
        sendDebugLog('props_changed', {
          previousPropsKeys: renderMetricsRef.current.lastPropsKeys,
          currentPropsKeys,
          propsChanged,
          renderCount: renderMetricsRef.current.renderCount
        })

        renderMetricsRef.current.lastPropsKeys = currentPropsKeys
        renderMetricsRef.current.propsChanged = propsChanged
      }
    }
  })

  // Store props reference for comparison
  lastPropsRef.current = { componentName, debugLevel, trackRenders, trackProps, trackPerformance }

  // Render tracking and performance monitoring
  if (trackRenders || trackPerformance) {
    renderStartTime.current = performance.now()
  }

  // Use layout effect to measure after render completes
  React.useLayoutEffect(() => {
    if (trackRenders || trackPerformance) {
      const renderEndTime = performance.now()
      const renderDuration = renderEndTime - renderStartTime.current

      renderMetricsRef.current.renderCount++
      renderMetricsRef.current.lastRenderTime = renderDuration
      renderMetricsRef.current.totalRenderTime += renderDuration
      renderMetricsRef.current.averageRenderTime = renderMetricsRef.current.totalRenderTime / renderMetricsRef.current.renderCount

      if (debugLevel === 'comprehensive' || (debugLevel === 'detailed' && renderMetricsRef.current.renderCount % 10 === 0)) {
        sendDebugLog('render_completed', {
          renderCount: renderMetricsRef.current.renderCount,
          renderDuration,
          averageRenderTime: renderMetricsRef.current.averageRenderTime,
          totalRenderTime: renderMetricsRef.current.totalRenderTime,
          propsChanged: renderMetricsRef.current.propsChanged,
          memoryUsage: (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            usagePercent: ((performance as any).memory.usedJSHeapSize / (performance as any).memory.totalJSHeapSize * 100).toFixed(2)
          } : null
        })
      }
    }
  })

  // Error boundary for this component
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.filename?.includes(componentName) || event.message.includes(componentName)) {
        setHasError(true)
        setError(new Error(event.message))

        sendDebugLog('component_error', {
          error: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        })
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [componentName])

  if (hasError && debugLevel !== 'basic') {
    return (
      <div style={{
        border: '2px solid red',
        padding: '10px',
        margin: '10px',
        backgroundColor: '#ffe6e6',
        borderRadius: '5px'
      }}>
        <h3 style={{ color: 'red', margin: '0 0 10px 0' }}>
          🚨 DebugWrapper: {componentName} Error
        </h3>
        <p style={{ margin: '0', fontFamily: 'monospace', fontSize: '12px' }}>
          {error?.message}
        </p>
        {debugLevel === 'comprehensive' && error?.stack && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Stack Trace</summary>
            <pre style={{
              fontSize: '10px',
              backgroundColor: '#f5f5f5',
              padding: '5px',
              borderRadius: '3px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    )
  }

  // Add visual debug indicator for detailed/comprehensive debugging
  if (debugLevel !== 'basic') {
    return (
      <div style={{
        position: 'relative',
        border: debugLevel === 'comprehensive' ? '1px solid #00ff00' : '1px solid #ffff00',
        borderRadius: '3px'
      }}>
        {debugLevel === 'comprehensive' && (
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '0',
            backgroundColor: '#00ff00',
            color: '#000',
            fontSize: '10px',
            padding: '2px 4px',
            borderRadius: '2px',
            zIndex: 9999,
            fontFamily: 'monospace'
          }}>
            🔍 {componentName} (renders: {renderMetricsRef.current.renderCount})
          </div>
        )}
        {children}
      </div>
    )
  }

  return <>{children}</>
}

// Utility function to create debug wrapper HOC
export function withDebug<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  debugOptions?: {
    debugLevel?: 'basic' | 'detailed' | 'comprehensive'
    trackRenders?: boolean
    trackProps?: boolean
    trackPerformance?: boolean
  }
) {
  const WrappedComponent = (props: P) => (
    <DebugWrapper
      componentName={componentName}
      debugLevel={debugOptions?.debugLevel || 'basic'}
      trackRenders={debugOptions?.trackRenders || false}
      trackProps={debugOptions?.trackProps || false}
      trackPerformance={debugOptions?.trackPerformance || false}
    >
      <Component {...props} />
    </DebugWrapper>
  )

  WrappedComponent.displayName = `withDebug(${componentName})`
  return WrappedComponent
}




