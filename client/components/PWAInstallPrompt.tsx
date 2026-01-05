'use client'

import React, { useState, useEffect } from 'react'
import { X, Download, Smartphone, Zap, Wifi } from 'lucide-react'
import { trackPWAEvent } from '../utils/analytics'

interface PWAInstallPromptProps {
  onInstall?: () => void
  onDismiss?: () => void
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isInstalled = (window.navigator as any).standalone === true

      if (isStandalone || isInstalled) {
        return // Already installed
      }

      // Check if previously dismissed
      const dismissedTime = localStorage.getItem('pwa-prompt-dismissed')
      if (dismissedTime) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24)
        if (daysSinceDismissed < 7) { // Show again after 7 days
          return
        }
      }

      // Listen for install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as any)

        // Smart timing - show after user has engaged
        setTimeout(() => {
          if (!dismissed) {
            setShowPrompt(true)
            trackPWAEvent('install_prompt_shown', { trigger: 'auto' })
          }
        }, 30000) // Show after 30 seconds of engagement
      }

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

      // Listen for successful install
      const handleAppInstalled = () => {
        setShowPrompt(false)
        setDeferredPrompt(null)
        trackPWAEvent('install_completed', { method: 'prompt' })

        if (onInstall) {
          onInstall()
        }
      }

      window.addEventListener('appinstalled', handleAppInstalled)

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)
      }
    }
  }, [dismissed, onInstall])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    setInstalling(true)

    try {
      // Show install prompt
      deferredPrompt.prompt()

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        trackPWAEvent('install_accepted', { method: 'prompt' })
        setShowPrompt(false)

        if (onInstall) {
          onInstall()
        }
      } else {
        trackPWAEvent('install_declined', { method: 'prompt' })
      }

    } catch (error) {
      console.error('PWA install failed:', error)
      trackPWAEvent('install_error', { error: error instanceof Error ? error.message : String(error) })
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)

    // Remember dismissal
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())

    trackPWAEvent('install_prompt_dismissed', { trigger: 'user' })

    if (onDismiss) {
      onDismiss()
    }
  }

  // Manual install for browsers that don't support beforeinstallprompt
  const handleManualInstall = () => {
    trackPWAEvent('install_manual_attempt', { userAgent: navigator.userAgent })

    // Show manual install instructions
    alert(`To install Click:\n\n1. Tap the share button in your browser\n2. Select "Add to Home Screen"\n3. Tap "Add" to install\n\nThe app will appear on your home screen!`)
  }

  if (!showPrompt || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 animate-in slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Install Click
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Get the full app experience
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Features */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <Zap className="w-3 h-3 text-green-500" />
            <span>Faster loading & offline access</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <Wifi className="w-3 h-3 text-blue-500" />
            <span>Works without internet</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <Smartphone className="w-3 h-3 text-purple-500" />
            <span>Native app-like experience</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {installing ? (
              <>
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                Installing...
              </>
            ) : (
              <>
                <Download className="w-3 h-3" />
                Install App
              </>
            )}
          </button>

          {typeof window !== 'undefined' && !(window as any).beforeinstallprompt && (
            <button
              onClick={handleManualInstall}
              className="px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
            >
              How to install
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          No app store required • Free to install
        </p>
      </div>
    </div>
  )
}

// Hook for managing PWA install state
export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      setIsInstalled(isStandalone || isIOSStandalone)
    }

    checkInstalled()

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setCanInstall(true)
      setDeferredPrompt(e as any)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', () => {
      setCanInstall(false)
      setIsInstalled(true)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt) return false

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      return outcome === 'accepted'
    } catch (error) {
      console.error('PWA install failed:', error)
      return false
    }
  }

  return {
    canInstall,
    isInstalled,
    install
  }
}

export default PWAInstallPrompt


