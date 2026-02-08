'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../../components/Navbar'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import Breadcrumb from '../../components/Breadcrumb'
import { useAuth } from '../../hooks/useAuth'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Enhanced debugging for DashboardLayout (commented out to prevent ERR_CONNECTION_REFUSED)
  const sendDashboardDebugLog = (message: string, data: any) => {
    // Development debug logging disabled to prevent console spam
    // fetch('http://127.0.0.1:5557/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     location: 'dashboard/layout.tsx',
    //     message: `dashboard_${message}`,
    //     data: {
    //       ...data,
    //       timestamp: Date.now(),
    //       sessionId: 'debug-session',
    //       runId: 'run-dashboard-debug'
    //     }
    //   }),
    // }).catch(() => {})
  }

  useEffect(() => {
    console.log('🔍 DashboardLayout: Auth state - loading:', loading, 'user:', !!user)

    // Enhanced authentication state tracking
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    const authState = {
      loading,
      hasUser: !!user,
      hasToken: !!token,
      tokenLength: token?.length || 0,
      userId: user?.id || null,
      userEmail: user?.email || null,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : null,
      timestamp: Date.now()
    }

    console.log('🔍 DashboardLayout: Token present:', !!token, 'length:', token?.length || 0)
    sendDashboardDebugLog('auth_state_check', authState)

    if (!loading && !user && process.env.NODE_ENV !== 'development') {
      console.log('🔍 DashboardLayout: Redirecting to login - no user and not loading')
      sendDashboardDebugLog('redirect_to_login', {
        reason: 'no_user_and_not_loading',
        ...authState
      })
      router.push('/login')
    } else if (!loading && user) {
      sendDashboardDebugLog('dashboard_access_granted', authState)
    } else if (!loading && !user && process.env.NODE_ENV === 'development') {
      console.log('🔧 DashboardLayout: Development mode - allowing access without user')
    }
  }, [loading, user, router])

  // Track component lifecycle
  useEffect(() => {
    sendDashboardDebugLog('layout_mounted', {
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : null
    })

    // Track performance metrics
    const loadStartTime = performance.now()

    return () => {
      const loadDuration = performance.now() - loadStartTime
      sendDashboardDebugLog('layout_unmounted', {
        duration: loadDuration,
        pathname: typeof window !== 'undefined' ? window.location.pathname : null
      })
    }
  }, [])

  // Prevent dashboard pages from mounting until auth is resolved.
  // This avoids race-condition redirects in pages that do `if (!user) router.push('/login')`.
  if (loading) {
    return (
      <div className="page-layout bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <header className="flex-shrink-0">
          <Navbar />
        </header>
        <main className="layout-scroll flex-1 min-h-0">
          <div className="container-readable py-8">
            <LoadingSkeleton type="card" count={3} />
          </div>
        </main>
      </div>
    )
  }

  // In development mode, allow rendering even without user to help with debugging
  // In production, require user to be present
  if (!user && process.env.NODE_ENV !== 'development') {
    return null
  }

  // In development mode without user, show a message instead of returning null
  if (!user && process.env.NODE_ENV === 'development') {
    return (
      <div className="page-layout bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <header className="flex-shrink-0">
          <Navbar />
        </header>
        <main className="layout-scroll flex-1 min-h-0">
          <div className="container-readable py-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                🔧 Development Mode: Waiting for authentication to initialize...
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="page-layout bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <header className="flex-shrink-0">
        <Navbar />
      </header>
      <main className="layout-scroll flex-1 min-h-0 w-full min-w-0 pt-16 lg:pt-0">
        <div className="container-readable py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Breadcrumb />
          {children}
        </div>
      </main>
    </div>
  )
}


