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
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, backdropFilter: 'blur(0px)' }}
        animate={{ opacity: 1, scale: 1, backdropFilter: 'blur(40px)' }}
        exit={{ opacity: 0, scale: 0.9, backdropFilter: 'blur(0px)' }}
        className="w-full max-w-2xl bg-black/60 border-2 border-white/5 rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-14 shadow-[0_0_150px_rgba(0,0,0,0.9)] relative overflow-hidden pointer-events-auto"
      >
        {/* Scanning Line Animation */}
        <motion.div 
          animate={{ y: [0, 500, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/10 to-transparent h-24 w-full z-0 opacity-40"
        />

        <div className="relative z-10 space-y-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            <div className="space-y-3 text-center sm:text-left">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary-500/10 border-2 border-primary-500/20 text-primary-400 text-[10px] font-black uppercase tracking-[0.4em] italic shadow-inner">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> SWARM_CONSENSUS_CORE
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-white italic tracking-[0.05em] uppercase leading-none drop-shadow-lg">{taskName}</h3>
            </div>
            <div className="w-16 h-16 rounded-[1.75rem] bg-black/40 flex items-center justify-center border-2 border-white/10 shadow-2xl group">
              <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse group-hover:scale-110 transition-transform duration-500" />
            </div>
          </div>

          <div className="space-y-5">
            {debateSteps.map((d, i) => {
              const isActive = i === step
              const isPast = i < step
              const Icon = d.icon

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ 
                    opacity: isActive || isPast ? 1 : 0.1, 
                    x: isActive || isPast ? 0 : -30,
                    scale: isActive ? 1.03 : 1
                  }}
                  className={`p-6 sm:p-8 rounded-[2.5rem] border-2 transition-all duration-700 flex items-center gap-6 sm:gap-8 shadow-xl ${
                    isActive ? 'bg-white/5 border-primary-500/20' : 'bg-transparent border-transparent'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-[1.4rem] flex items-center justify-center transition-all duration-700 ${isActive ? `${d.color} bg-black/40 border-2 border-white/10 shadow-lg` : 'text-slate-700'}`}>
                    <Icon className={`w-7 h-7 ${isActive ? 'animate-bounce' : ''}`} />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-black uppercase tracking-[0.2em] italic ${isActive ? 'text-white' : 'text-slate-600'}`}>{d.agent}</span>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest opacity-60 italic">[{d.role}]</span>
                    </div>
                    <p className={`text-base sm:text-lg italic font-black uppercase tracking-tight leading-tight ${isActive ? 'text-white' : 'text-slate-500'}`}>
                      {isActive ? d.action : isPast ? 'VALIDATED_&_COMMITTED' : 'AWAITING_NODE_SYNAPSE…'}
                    </p>
                  </div>

                  {isActive && (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    />
                  )}
                  {isPast && <ShieldCheck className="w-6 h-6 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </motion.div>
              )
            })}
          </div>

          <div className="pt-8 border-t-2 border-white/5 space-y-6">
             <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    {debateSteps.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-1000 ${i <= step ? 'w-10 bg-primary-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]' : 'w-3 bg-white/5'}`} />
                    ))}
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic flex items-center gap-2.5">
                  <Fingerprint className="w-3.5 h-3.5 text-primary-400" />
                  NEURAL_INTEGRITY: 99.98%
                </span>
             </div>
             
             {/* Scrolling Log Feed */}
             <div className="h-24 overflow-hidden bg-black/40 rounded-[2rem] border-2 border-white/5 p-4 flex flex-col gap-2 opacity-50 shadow-inner">
                {[
                  `[0x${Math.random().toString(16).slice(2, 6)}] INGESTING_SOVEREIGNTY_SEED…`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] MAPPING_ROI_NODES_TO_HOOK_0x4F…`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] SWARM_CONSENSUS_REACHED_8ms_LATENCY`,
                  `[0x${Math.random().toString(16).slice(2, 6)}] INJECTING_STYLE_DNA_INTO_CLUSTER…`
                ].map((log, i) => (
                  <motion.p 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="text-[9px] font-mono font-black text-primary-400/60 whitespace-nowrap overflow-hidden italic uppercase tracking-widest"
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
