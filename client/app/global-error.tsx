'use client'

import { AlertTriangle, RotateCcw, RefreshCw, Home, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunk   = /chunk|loading|module/i.test(error.message)
  const isNetwork = /network|fetch|timeout/i.test(error.message)

  const title  = isChunk ? 'Code Load Failure' : isNetwork ? 'Network Failure' : 'Critical System Error'
  const detail = isChunk
    ? 'A JavaScript module failed to load. This often happens after a new deployment. Clearing cache and retrying usually fixes it.'
    : isNetwork
    ? 'A critical network request failed before the app could render. Check your internet connection and try again.'
    : 'An unrecoverable application error occurred. The error has been logged for review.'

  const clearAndReset = async () => {
    if (typeof window !== 'undefined') {
      try {
        if ('caches' in window) { const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n))) }
      } catch { /* best-effort */ }
    }
    reset()
  }

  return (
    <html lang="en">
      <body className="bg-[#07070f] text-white antialiased" suppressHydrationWarning>
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient background */}
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[50vw] h-[50vh] bg-rose-600/6 blur-[160px] rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vh] bg-indigo-600/6 blur-[160px] rounded-full" />
          </div>

          {/* Grid texture */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.015] global-error-grid" />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative z-10 max-w-lg w-full"
          >
            {/* Card */}
            <div className="bg-white/[0.025] border border-white/[0.08] rounded-[3rem] p-10 shadow-2xl shadow-black/50 text-center backdrop-blur-xl">

              {/* Icon */}
              <div className="relative mx-auto mb-8 w-fit">
                <div className="w-20 h-20 rounded-[1.75rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.15)]">
                  <AlertTriangle className="w-9 h-9 text-rose-400" />
                </div>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 rounded-full border-2 border-[#07070f] flex items-center justify-center">
                  <Zap size={9} className="text-white" />
                </span>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-[0.35em] text-rose-400">{title}</span>
              </div>

              <h1 className="text-4xl font-black italic tracking-tighter mb-4">
                System <span className="text-rose-400">Offline</span>
              </h1>

              <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">{detail}</p>

              {/* Dev detail */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-6 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left">
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">{error.name}</p>
                  <p className="text-[9px] text-slate-500 font-mono leading-relaxed">{error.message}</p>
                  {error.digest && <p className="text-[7px] text-slate-700 mt-1">Digest: {error.digest}</p>}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button onClick={clearAndReset}
                  className="flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-black font-black text-[11px] uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-lg shadow-white/10"
                >
                  <RotateCcw className="w-4 h-4" /> {isChunk ? 'Clear Cache & Retry' : 'Reinitialize App'}
                </button>
                <div className="flex gap-2">
                  <button onClick={reset}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-slate-300 font-black text-[10px] uppercase tracking-widest hover:bg-white/[0.08] transition-all active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <a href="/dashboard"
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600/25 transition-all active:scale-95"
                  >
                    <Home className="w-3.5 h-3.5" /> Dashboard
                  </a>
                </div>
              </div>

              {error.digest && <p className="text-[7px] text-slate-800 mt-6">Error ID: {error.digest}</p>}
            </div>

            {/* Bottom label */}
            <p className="text-center text-[8px] text-slate-700 font-black uppercase tracking-widest mt-5 flex items-center justify-center gap-2">
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              Click — AI Content Platform
              <span className="w-1 h-1 rounded-full bg-slate-700" />
            </p>
          </motion.div>
        </div>
      </body>
    </html>
  )
}
