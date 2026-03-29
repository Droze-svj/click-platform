'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShieldCheck, 
  BrainCircuit, 
  Search, 
  Zap, 
  Activity, 
  MessageSquare,
  TrendingUp,
  Fingerprint
} from 'lucide-react'

interface AgentDebate {
  agent: string
  role: string
  action: string
  status: 'thinking' | 'suggesting' | 'validating' | 'approved'
  icon: any
  color: string
}

interface SwarmConsensusHUDProps {
  isVisible: boolean
  onComplete: () => void
  taskName: string
}

export const SwarmConsensusHUD: React.FC<SwarmConsensusHUDProps> = ({ isVisible, onComplete, taskName }) => {
  const [step, setStep] = useState(0)
  
  const debateSteps: AgentDebate[] = [
    { 
      agent: 'Sovereign Architect', 
      role: 'Creative Director', 
      action: 'Synthesizing viral hook geometry...', 
      status: 'suggesting', 
      icon: BrainCircuit, 
      color: 'text-fuchsia-400' 
    },
    { 
      agent: 'Neural Analyst', 
      role: 'Sovereignty Ledger', 
      action: 'Cross-referencing historical ROI nodes...', 
      status: 'thinking', 
      icon: Search, 
      color: 'text-indigo-400' 
    },
    { 
      agent: 'Sovereign Architect', 
      role: 'Creative Director', 
      action: 'Refining hook with high-retention parameters...', 
      status: 'validating', 
      icon: Zap, 
      color: 'text-fuchsia-400' 
    }
  ]

  useEffect(() => {
    if (isVisible) {
      setStep(0)
      const timer = setInterval(() => {
        setStep(prev => {
          if (prev >= debateSteps.length - 1) {
            clearInterval(timer)
            setTimeout(onComplete, 1000)
            return prev
          }
          return prev + 1
        })
      }, 1200)
      return () => clearInterval(timer)
    }
  }, [isVisible, onComplete, debateSteps.length])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, scale: 1, backdropFilter: 'blur(24px)' }}
        exit={{ opacity: 0, scale: 0.9, backdropFilter: 'blur(0px)' }}
        className="w-full max-w-2xl bg-black/40 border border-white/10 rounded-[3.5rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden pointer-events-auto"
      >
        {/* Scanning Line Animation */}
        <motion.div 
          animate={{ y: [0, 400, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-500/10 to-transparent h-20 w-full z-0 opacity-30"
        />

        <div className="relative z-10 space-y-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em]">
                <Activity className="w-3 h-3" /> SWARM CONSENSUS 2.0
              </div>
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">{taskName}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-4">
            {debateSteps.map((d, i) => {
              const isActive = i === step
              const isPast = i < step
              const Icon = d.icon

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ 
                    opacity: isActive || isPast ? 1 : 0.2, 
                    x: isActive || isPast ? 0 : -20,
                    scale: isActive ? 1.02 : 1
                  }}
                  className={`p-6 rounded-[2rem] border transition-all duration-500 flex items-center gap-6 ${
                    isActive ? 'bg-white/5 border-white/20 shadow-xl' : 'bg-transparent border-transparent'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center ${isActive ? `${d.color} bg-white/5 border border-white/10` : 'text-slate-500'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>{d.agent}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-60">[{d.role}]</span>
                    </div>
                    <p className={`text-sm italic font-medium ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {isActive ? d.action : isPast ? 'Optimized & Verified' : 'Awaiting node availability...'}
                    </p>
                  </div>

                  {isActive && (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"
                    />
                  )}
                  {isPast && <ShieldCheck className="w-5 h-5 text-emerald-500" />}
                </motion.div>
              )
            })}
          </div>

          <div className="pt-6 border-t border-white/10 space-y-4">
             <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {debateSteps.map((_, i) => (
                      <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'w-8 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'w-2 bg-white/5'}`} />
                    ))}
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic flex items-center gap-2">
                  <Fingerprint className="w-3 h-3 text-indigo-400" />
                  Neural Integrity: 99.8%
                </span>
             </div>
             
             {/* Scrolling Log Feed */}
             <div className="h-20 overflow-hidden bg-black/20 rounded-2xl border border-white/5 p-3 flex flex-col gap-1.5 opacity-60">
                {[
                  `[0x${Math.random().toString(16).slice(2, 6)}] Ingesting sovereignty seed...`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] Mapping ROI nodes to hook 0x4f...`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] Swarm consensus reached at 8ms latency.`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] Injecting style-DNA into regional cluster.`
                ].map((log, i) => (
                  <motion.p 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="text-[8px] font-mono text-slate-500 whitespace-nowrap overflow-hidden"
                  >
                    {log}
                  </motion.p>
                ))}
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
