'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Download, RefreshCw, X, CheckCircle, Zap, Shield, Wifi, Smartphone, Github as Google } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PWAState {
  isOnline: boolean
  canInstall: boolean
  isInstalled: boolean
  updateAvailable: boolean
  isInstalling: boolean
  isUpdating: boolean
  registration: ServiceWorkerRegistration | null
}

interface PWAContextType {
  state: PWAState
  install: () => Promise<void>
  update: () => Promise<void>
  dismissPrompt: () => void
  requestNotificationPermission: () => Promise<boolean>
}

const PWAContext = createContext<PWAContextType | undefined>(undefined)

export function PWAManager({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PWAState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    canInstall: false,
    isInstalled: false,
    updateAvailable: false,
    isInstalling: false,
    isUpdating: false,
    registration: null
  })

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const hasPromptedThisSession = useRef(false)

  // ── Initialization ────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Online/Offline status
    const updateOnline = () => setState(prev => ({ ...prev, isOnline: navigator.onLine }))
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)

    // 2. Check installation status
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      setState(prev => ({ ...prev, isInstalled: isStandalone || isIOSStandalone }))
    }
    checkInstalled()

    // 3. Service Worker Registration
    if ('serviceWorker' in navigator) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const isProd = process.env.NODE_ENV === 'production'

      if (!isProd || isLocalhost) {
        // Clean up SW in dev mode to prevent caching headaches
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      } else {
        navigator.serviceWorker.register('/sw.js').then(reg => {
          setState(prev => ({ ...prev, registration: reg }))

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setState(prev => ({ ...prev, updateAvailable: true }))
                }
              })
            }
          })
        })
      }
    }

    // 4. Before Install Prompt
    const handleBeforePrompt = (e: any) => {
      // Browsers wait for this to be prevented before showing their own banner
      e.preventDefault()
      setDeferredPrompt(e)
      setState(prev => ({ ...prev, canInstall: true }))

      // Only show the custom banner if we haven't already dismissed it this session
      // and we are NOT already installed
      const lastDismissed = localStorage.getItem('pwa_dismissed')
      const isRecent = lastDismissed && (Date.now() - parseInt(lastDismissed)) < 1000 * 60 * 60 * 24 // 24h

      if (!isRecent && !hasPromptedThisSession.current) {
        // Show after 5 seconds of engagement for better responsiveness
        setTimeout(() => {
          setShowInstallBanner(true)
          hasPromptedThisSession.current = true
        }, 5000)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforePrompt)
    window.addEventListener('appinstalled', () => {
      setState(prev => ({ ...prev, isInstalled: true, canInstall: false }))
      setShowInstallBanner(false)
    })

    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt)
    }
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    setState(prev => ({ ...prev, isInstalling: true }))

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowInstallBanner(false)
      }
    } catch (err) {
      console.error('PWA Install failed', err)
    } finally {
      setState(prev => ({ ...prev, isInstalling: false }))
    }
  }, [deferredPrompt])

  const update = useCallback(async () => {
    if (!state.registration?.waiting) return
    setState(prev => ({ ...prev, isUpdating: true }))

    state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })

    // Listen for the reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    }, { once: true })
  }, [state.registration])

  const dismissPrompt = useCallback(() => {
    setShowInstallBanner(false)
    localStorage.setItem('pwa_dismissed', Date.now().toString())
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }, [])

  return (
    <PWAContext.Provider value={{ state, install, update, dismissPrompt, requestNotificationPermission }}>
      {children}

      <AnimatePresence>
        {/* Update Banner - High Priority Elite Design */}
        {state.updateAvailable && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-6"
          >
            <div className="bg-indigo-600/90 dark:bg-indigo-600/80 backdrop-blur-2xl border border-white/20 p-5 rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex items-center gap-5 group">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center relative overflow-hidden">
                <RefreshCw className={`w-6 h-6 text-white ${state.isUpdating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-white italic uppercase tracking-tighter">Click Evolved</h4>
                <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">New intelligence active.</p>
              </div>
              <button
                onClick={update}
                disabled={state.isUpdating}
                className="px-6 py-3 bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
              >
                {state.isUpdating ? 'Syncing...' : 'Restart'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Install Banner - The Glass Vault Design */}
        {showInstallBanner && state.canInstall && !state.isInstalled && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, x: 50 }}
            className="fixed bottom-8 right-8 z-[90] w-full max-w-sm px-6 md:px-0"
          >
            <div className="bg-black/60 dark:bg-black/40 backdrop-blur-3xl border border-white/10 p-8 rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
              {/* Dynamic Neural Glow */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full group-hover:bg-indigo-500/20 transition-all duration-700" />
              <div className="absolute -bottom-32 -left-32 w-48 h-48 bg-fuchsia-500/10 blur-[80px] rounded-full group-hover:bg-fuchsia-500/20 transition-all duration-700" />

              <button
                onClick={dismissPrompt}
                className="absolute top-6 right-6 p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all"
                aria-label="Dismiss install prompt"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col gap-6 relative z-10">
                <div className="flex items-center gap-5">
                   <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-500 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/20">
                     <Download className="w-7 h-7 text-white" />
                   </div>
                   <div>
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Click Desktop</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Native Edge v4.2</p>
                   </div>
                </div>

                <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                  Ascend to a faster, offline-capable workspace. Built for elite content operations.
                </p>

                <div className="flex items-center gap-4">
                  <button
                    onClick={install}
                    disabled={state.isInstalling}
                    className="flex-1 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-2xl shadow-white/5"
                  >
                    {state.isInstalling ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <>Initialize Installation</>
                    )}
                  </button>
                </div>
              </div>

              {/* Strategic Advantage Tags */}
              <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-indigo-500/30 transition-colors">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Instant</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-emerald-500/30 transition-colors">
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Edge</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-blue-500/30 transition-colors">
                  <Smartphone className="w-3 h-3 text-blue-500" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nexus</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Offline Overlay - Non-intrusive but clear */}
        {!state.isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center pb-12 pointer-events-none"
          >
            <motion.div
              initial={{ y: 20 }} animate={{ y: 0 }}
              className="bg-zinc-900 border border-red-500/30 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_red]" />
              <div className="text-sm">
                <span className="font-bold text-white mr-2">You&apos;re Offline</span>
                <span className="text-zinc-400">Some features may be limited.</span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-bold text-zinc-500 hover:text-white underline underline-offset-4 ml-2"
              >
                Retry Connection
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PWAContext.Provider>
  )
}

export function usePWA() {
  const context = useContext(PWAContext)
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAManager')
  }
  return context
}

export default PWAManager
