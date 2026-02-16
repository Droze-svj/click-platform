'use client'

import { useState, useEffect } from 'react'
import DebugDashboard from './DebugDashboard'
import { sendDebugLog } from '../utils/debugLog'

interface DebugLayoutProps {
  children: React.ReactNode
}

export default function DebugLayout({ children }: DebugLayoutProps) {
  const [debugDashboardOpen, setDebugDashboardOpen] = useState(false)

  // Debug dashboard keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setDebugDashboardOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Global debug functions
  useEffect(() => {
    // Make debug functions available globally
    ; (window as any).openDebugDashboard = () => setDebugDashboardOpen(true)
      ; (window as any).closeDebugDashboard = () => setDebugDashboardOpen(false)
      ; (window as any).toggleDebugDashboard = () => setDebugDashboardOpen(prev => !prev)

    const sendDebugInitLog = (message: string, data: Record<string, unknown>) => {
      try {
        if (message === 'initialized') console.log('DebugLayout:', message, data)
        sendDebugLog('DebugLayout', `debug_system_${message}`, {
          ...data,
          sessionId: 'debug-session',
          runId: 'run-debug-system-init',
        })
      } catch {
        // Silently ignore
      }
    }

    sendDebugInitLog('initialized', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      debugLevel: 'comprehensive',
      features: [
        'performance_monitoring',
        'api_debugging',
        'component_lifecycle_tracking',
        'error_boundary_enhancement',
        'interaction_debugging',
        'network_debugging',
        'memory_monitoring',
        'debug_dashboard'
      ]
    })

    // Console commands for debugging
    console.log('🔧 Debug functions available:')
    console.log('  window.openDebugDashboard() - Open debug dashboard')
    console.log('  window.closeDebugDashboard() - Close debug dashboard')
    console.log('  window.toggleDebugDashboard() - Toggle debug dashboard')
    console.log('  Ctrl+Shift+D - Toggle debug dashboard')
    console.log('🔍 Comprehensive debugging system activated!')
  }, [])

  return (
    <>
      {children}
      <DebugDashboard
        isOpen={debugDashboardOpen}
        onClose={() => setDebugDashboardOpen(false)}
      />
    </>
  )
}









