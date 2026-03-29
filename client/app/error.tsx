'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 selection:bg-red-500/30 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-600/10 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`${glassStyle} p-10 md:p-16 rounded-[3rem] w-full max-w-2xl text-center relative z-10`}
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
          SYSTEM <span className="text-red-400">ANOMALY</span>.
        </h1>

        <p className="text-slate-400 text-lg mb-10 max-w-md mx-auto leading-relaxed font-medium">
          We encountered a temporary disruption while processing your request. Our neural pathways have logged the incident.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="group w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-black font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-3 active:scale-95"
          >
            <RotateCcw className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" />
            Reinitialize
          </button>

          <Link
            href="/"
            className={`group w-full sm:w-auto px-8 py-4 rounded-xl ${glassStyle} text-white font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95`}
          >
            <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Return Home
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
