'use client'

import { useEffect } from 'react'
import { BarChart3, RotateCcw, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function AnalyticsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[Analytics Error]', error.message)
    const isNetwork = /network|fetch|timeout/i.test(error.message)
    if (isNetwork) { const t = setTimeout(reset, 5000); return () => clearTimeout(t) }
  }, [error, reset])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 text-white">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-10">
        <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.25rem] flex items-center justify-center mx-auto mb-5">
          <BarChart3 className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-black italic mb-3">Analytics <span className="text-rose-400">Unavailable</span></h2>
        <p className="text-slate-500 text-sm mb-7">
          {/network|fetch/i.test(error.message)
            ? 'Could not reach the analytics service. Auto-retrying in 5 seconds…'
            : 'The analytics module encountered an error. Your data is safe.'}
        </p>
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600/30 transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </button>
          <Link href="/dashboard" className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/[0.08] transition-all">
            <Home className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
