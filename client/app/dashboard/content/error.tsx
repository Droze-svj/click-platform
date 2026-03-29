'use client'

import { useEffect } from 'react'
import { Sparkles, RotateCcw, Home } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function ContentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[Content Error]', error.message)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 text-white">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-10">
        <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-[1.25rem] flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black italic mb-3">Content AI <span className="text-rose-400">Error</span></h2>
        <p className="text-slate-500 text-sm mb-7">The Content AI module hit an unexpected error. Your drafts are saved and unaffected.</p>
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600/30 transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Try Again
          </button>
          <Link href="/dashboard" className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/[0.08] transition-all">
            <Home className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
