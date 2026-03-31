'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Brain, Fingerprint, Shield, Zap, ActivitySquare } from 'lucide-react'

interface SpectralLoaderProps {
  message?: string
  subMessage?: string
}

export default function SpectralLoader({ 
  message = "Decoding Resonance Matrix...", 
  subMessage = "HEURISTIC_SYNC_IN_PROGRESS" 
}: SpectralLoaderProps) {
  return (
    <div className="min-h-screen bg-[#020205] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-rose-500/5 opacity-50" />
      
      {/* Central HUD Pulse */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-32 h-32 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_100px_rgba(79,70,229,0.2)] mb-12"
        >
          <Brain size={48} className="text-indigo-400" />
        </motion.div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="flex flex-col items-center gap-4"
        >
           <span className="text-[12px] font-black text-white uppercase tracking-[0.6em] animate-pulse italic leading-none">
             {message}
           </span>
           <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
               <Shield size={10} className="text-indigo-400 animate-pulse" />
               <span className="text-[8px] font-black text-slate-800 tracking-widest uppercase italic leading-none">
                 {subMessage}
               </span>
           </div>
        </motion.div>
      </div>

      {/* Floating Nodes */}
      {[Zap, Fingerprint, ActivitySquare].map((Icon, i) => (
        <motion.div
          key={i}
          animate={{ 
            y: [0, -20, 0],
            opacity: [0.1, 0.3, 0.1],
            x: [0, i % 2 === 0 ? 10 : -10, 0]
          }}
          transition={{ 
            duration: 3 + i, 
            repeat: Infinity,
            delay: i * 0.5
          }}
          className="absolute opacity-20 pointer-events-none"
          style={{
            top: `${30 + i * 20}%`,
            left: `${20 + i * 25}%`
          }}
        >
          <Icon size={120} className="text-white" />
        </motion.div>
      ))}

      <style jsx global>{`
        body { background: #020205; overflow: hidden; }
      `}</style>
    </div>
  )
}
