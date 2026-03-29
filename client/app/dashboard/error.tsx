'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCcw, Home, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Categorise and log
    const isDev = process.env.NODE_ENV === 'development'
    console.error('[Dashboard Error Boundary]', error.name, error.message)
    if (isDev) console.error(error.stack)

    // Attempt automatic recovery for common issues
    const recoverablePatterns = [/chunk/i, /network/i, /fetch/i, /timeout/i, /loading/i]
    const isRecoverable = recoverablePatterns.some(p => p.test(error.message) || p.test(error.name))
    if (isRecoverable) {
      console.info('[Dashboard] Recoverable error detected — auto-resetting in 4s')
      const t = setTimeout(() => reset(), 4000)
      return () => clearTimeout(t)
    }
  }, [error, reset])

  const isChunkError = /chunk|loading|module/i.test(error.message)
  const isNetworkError = /network|fetch|timeout|offline/i.test(error.message)

  const clearCacheAndRetry = async () => {
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n)))
    }
    reset()
  }

  return (
    <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-8 text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vh] bg-rose-600/8 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vh] bg-indigo-600/8 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-xl w-full bg-white/[0.03] border border-white/[0.08] rounded-[3rem] p-10 text-center shadow-2xl"
      >
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 mb-5">
          <span className="text-[8px] font-black uppercase tracking-widest text-rose-400">
            {isChunkError ? 'Code Chunk Error' : isNetworkError ? 'Network Error' : 'Runtime Error'}
          </span>
        </div>

        <h1 className="text-3xl font-black italic tracking-tighter mb-3">
          Something went <span className="text-rose-400">wrong</span>
        </h1>

        <p className="text-slate-500 text-sm leading-relaxed mb-4">
          {isChunkError
            ? 'A code chunk failed to load — this usually happens after a deployment. Clearing cache and retrying should fix it.'
            : isNetworkError
            ? 'A network request failed. Check your internet connection, then try again.'
            : 'An unexpected error occurred in this section of the dashboard.'}
        </p>

        {/* Error detail */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{error.name}</p>
            <p className="text-[10px] text-slate-400 font-mono leading-relaxed">{error.message}</p>
            {error.digest && <p className="text-[8px] text-slate-700 mt-1">Digest: {error.digest}</p>}
          </div>
        )}

        {/* Auto-recovery indicator */}
        {/chunk|loading|network/i.test(error.message) && (
          <div className="mb-5 flex items-center gap-2 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
            <p className="text-[9px] font-bold text-indigo-300">Auto-recovery in progress…</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-black font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all shadow-lg active:scale-95"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>

          {isChunkError && (
            <button onClick={clearCacheAndRetry}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600/30 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Clear Cache + Retry
            </button>
          )}

          <Link href="/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white font-black text-[11px] uppercase tracking-widest hover:bg-white/[0.08] transition-all active:scale-95"
          >
            <Home className="w-4 h-4" /> Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
