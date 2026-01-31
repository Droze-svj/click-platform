'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'

interface PWAManagerProps {
  children: React.ReactNode
}

interface PWAState {
  isOnline: boolean
  isInstalling: boolean
  canInstall: boolean
  isInstalled: boolean
  serviceWorkerRegistered: boolean
  pushNotificationsEnabled: boolean
  offlineQueue: number
  cacheSize: string
}

export default function PWAManager({ children }: PWAManagerProps) {
  const [pwaState, setPWAState] = useState<PWAState>({
    isOnline: true,
    isInstalling: false,
    canInstall: false,
    isInstalled: false,
    serviceWorkerRegistered: false,
    pushNotificationsEnabled: false,
    offlineQueue: 0,
    cacheSize: '0 MB'
  })

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      registerServiceWorker()
    }

    // Check if already installed
    checkInstallationStatus()

    // Listen for online/offline events
    setupNetworkListeners()

    // Listen for install prompt
    setupInstallPrompt()

    // Listen for messages from service worker
    setupServiceWorkerMessages()

  }, [])

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('✅ Service Worker registered:', registration.scope)

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              showUpdateNotification()
            }
          })
        }
      })

      // Check if service worker is controlling the page
      if (navigator.serviceWorker.controller) {
        setPWAState(prev => ({ ...prev, serviceWorkerRegistered: true }))
      } else {
        // Wait for controller change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          setPWAState(prev => ({ ...prev, serviceWorkerRegistered: true }))
        })
      }

      // Get cache size
      await updateCacheSize()

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error)
      toast.error('Service Worker registration failed')
    }
  }

  const setupNetworkListeners = () => {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine
      setPWAState(prev => ({ ...prev, isOnline }))

      if (isOnline) {
        toast.success('Back online! Syncing data...')
        // Trigger background sync
        triggerBackgroundSync()
      } else {
        toast.error('You are offline. Some features may be limited.')
      }
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Initial check
    updateOnlineStatus()

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }

  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the default install prompt
      e.preventDefault()
      setDeferredPrompt(e)
      setPWAState(prev => ({ ...prev, canInstall: true }))

      // Show install prompt after a delay
      setTimeout(() => {
        setPWAState(currentState => {
          if (!currentState.isInstalled) {
            showInstallPrompt()
          }
          return currentState
        })
      }, 30000) // 30 seconds
    })

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setPWAState(prev => ({
        ...prev,
        isInstalled: true,
        canInstall: false
      }))
      setDeferredPrompt(null)
      toast.success('Click has been installed!')
    })
  }

  const setupServiceWorkerMessages = () => {
    navigator.serviceWorker?.addEventListener('message', (event) => {
      const { type, data } = event.data

      switch (type) {
        case 'sw-activated':
          console.log('🚀 Service Worker activated')
          setPWAState(prev => ({ ...prev, serviceWorkerRegistered: true }))
          break

        case 'push-received':
          handlePushNotification(data)
          break

        case 'content-synced':
          toast.success(`Synced ${data.count} new content items`)
          break

        case 'offline-action-queued':
          setPWAState(prev => ({
            ...prev,
            offlineQueue: prev.offlineQueue + 1
          }))
          break

        default:
          console.log('📨 Service Worker message:', type, data)
      }
    })
  }

  const showInstallPrompt = () => {
    if (deferredPrompt) {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-medium">Install Click</span>
          <span className="text-sm text-gray-600">
            Add Click to your home screen for the best experience
          </span>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                toast.dismiss(t.id)
                installPWA()
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              Install
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              Later
            </button>
          </div>
        </div>
      ), {
        duration: 10000,
        position: 'bottom-center'
      })
    }
  }

  const installPWA = async () => {
    if (!deferredPrompt) return

    setPWAState(prev => ({ ...prev, isInstalling: true }))

    try {
      const result = await deferredPrompt.prompt()
      console.log('Install prompt result:', result)

      setDeferredPrompt(null)
      setPWAState(prev => ({
        ...prev,
        isInstalling: false,
        canInstall: false
      }))

    } catch (error) {
      console.error('❌ PWA installation failed:', error)
      setPWAState(prev => ({ ...prev, isInstalling: false }))
      toast.error('Installation failed')
    }
  }

  const showUpdateNotification = () => {
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span className="font-medium">Update Available</span>
        <span className="text-sm text-gray-600">
          A new version of Click is available
        </span>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => {
              toast.dismiss(t.id)
              updateServiceWorker()
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
          >
            Update
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
          >
            Later
          </button>
        </div>
      </div>
    ), {
      duration: 15000,
      position: 'top-center'
    })
  }

  const updateServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.update()

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      toast.success('Updating Click...')
      setTimeout(() => window.location.reload(), 1000)

    } catch (error) {
      console.error('❌ Service Worker update failed:', error)
      toast.error('Update failed')
    }
  }

  const handlePushNotification = (data: any) => {
    // This is handled by the service worker, but we can show additional UI feedback
    toast.success(`New content: ${data.title || 'Update available'}`)
  }

  const requestPushPermission = async () => {
    try {
      const permission = await Notification.requestPermission()

      if (permission === 'granted') {
        setPWAState(prev => ({ ...prev, pushNotificationsEnabled: true }))

        // Subscribe to push notifications
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SUBSCRIBE_PUSH'
          })
        }

        toast.success('Push notifications enabled!')
      } else {
        toast.error('Push notifications denied')
      }
    } catch (error) {
      console.error('❌ Push permission request failed:', error)
      toast.error('Failed to enable push notifications')
    }
  }

  const triggerBackgroundSync = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'REGISTER_SYNC',
        data: { tag: 'content-sync' }
      })
    }
  }

  const updateCacheSize = async () => {
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_CACHE_SIZE'
        })
      }
    } catch (error) {
      console.error('❌ Cache size check failed:', error)
    }
  }

  const clearCache = async () => {
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE'
        })
        toast.success('Cache cleared successfully')
        await updateCacheSize()
      }
    } catch (error) {
      console.error('❌ Cache clear failed:', error)
      toast.error('Failed to clear cache')
    }
  }

  const checkInstallationStatus = () => {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = (window.navigator as any).standalone === true

    setPWAState(prev => ({
      ...prev,
      isInstalled: isStandalone || isInWebAppiOS
    }))
  }

  // Global PWA functions for components to use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).pwaManager = {
        installPWA,
        requestPushPermission,
        triggerBackgroundSync,
        clearCache,
        updateCacheSize,
        getState: () => pwaState
      }
    }
  }, [pwaState])

  return (
    <>
      {/* PWA Status Indicator */}
      <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
        {/* Offline Indicator */}
        {!pwaState.isOnline && (
          <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Offline</span>
            {pwaState.offlineQueue > 0 && (
              <span className="text-xs bg-red-600 px-2 py-1 rounded">
                {pwaState.offlineQueue} queued
              </span>
            )}
          </div>
        )}

        {/* Install Button */}
        {pwaState.canInstall && !pwaState.isInstalled && (
          <button
            onClick={installPWA}
            disabled={pwaState.isInstalling}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">
              {pwaState.isInstalling ? 'Installing...' : 'Install App'}
            </span>
          </button>
        )}

        {/* Push Notifications */}
        {pwaState.serviceWorkerRegistered &&
         'Notification' in window &&
         Notification.permission === 'default' && (
          <button
            onClick={requestPushPermission}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V7a3 3 0 00-6 0v5l-5 5h5m0 0v2a2 2 0 004 0v-2m-4-4h4" />
            </svg>
            <span className="text-sm font-medium">Enable Notifications</span>
          </button>
        )}
      </div>

      {/* Offline Page Fallback */}
      {!pwaState.isOnline && (
        <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-30 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0 0L12 12m-6.364 6.364L12 12m6.364-6.364L12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              You're Offline
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Some features may be limited, but you can still view cached content and queue actions for when you're back online.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {pwaState.serviceWorkerRegistered && (
        <div className="bg-blue-500 text-white px-4 py-2 text-center text-sm">
          Click is ready to work offline and send notifications
          <button
            onClick={() => setPWAState(prev => ({ ...prev, serviceWorkerRegistered: false }))}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {children}
    </>
  )
}

// Hook for components to use PWA features
export function usePWA() {
  const [pwaState, setPWAState] = useState<PWAState | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).pwaManager) {
      setPWAState((window as any).pwaManager.getState())
    }
  }, [])

  return {
    pwaState,
    installPWA: () => (window as any).pwaManager?.installPWA?.(),
    requestPushPermission: () => (window as any).pwaManager?.requestPushPermission?.(),
    triggerBackgroundSync: () => (window as any).pwaManager?.triggerBackgroundSync?.(),
    clearCache: () => (window as any).pwaManager?.clearCache?.(),
    updateCacheSize: () => (window as any).pwaManager?.updateCacheSize?.()
  }
}









