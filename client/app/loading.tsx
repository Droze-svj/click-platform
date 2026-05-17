'use client'

import ClickLogo from '../components/ClickLogo'
import { motion } from 'framer-motion'

export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-[var(--page-bg)] flex flex-col items-center justify-center relative overflow-hidden" role="status" aria-live="polite" aria-label="Loading Click">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vh] h-[30vh] bg-indigo-600/20 blur-[100px] rounded-full animate-pulse" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Pulsing Logo Container */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-[var(--glass-border-strong)] flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.25)] backdrop-blur-xl"
        >
          {/* Inner pulsing element */}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-3xl bg-indigo-500/10 blur-xl"
          />
          <ClickLogo size={40} className="z-10" />
        </motion.div>

        {/* Loading Text */}
        <div className="flex flex-col items-center gap-2">
           <motion.div
             animate={{ opacity: [0.6, 1, 0.6] }}
             transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
             className="text-[var(--text-main)] text-xl font-black uppercase tracking-widest"
           >
             INITIALIZING
           </motion.div>
           <div className="flex gap-1">
             {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                />
             ))}
           </div>
        </div>
      </motion.div>
    </div>
  )
}
