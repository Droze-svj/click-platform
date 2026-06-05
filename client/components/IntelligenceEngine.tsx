'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Cpu, Zap, Activity, Shield, Sparkles, Network, Fingerprint, Quote, Lightbulb } from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

const IntelligenceEngine = () => {
  const { t } = useTranslation()
  const [pulse, setPulse] = useState(0)
  const [activeNodes, setActiveNodes] = useState<number[]>([])
  const [insight, setInsight] = useState<{ quote: string, tip: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiGet<any>('/analytics/overview')
        if (res?.aiInsight) {
          setInsight(res.aiInsight)
        }
      } catch (err) {
        console.error('Failed to fetch intelligence:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()

    const interval = setInterval(() => {
      setPulse(p => (p + 1) % 100)
      const nodes = Array.from({ length: 5 }, () => Math.floor(Math.random() * 12))
      setActiveNodes(nodes)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="neural-glass-card rounded-[3rem] p-6 sm:p-10 lg:p-14 relative overflow-hidden group border-indigo-500/20 shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)]">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-indigo-600/[0.05] rounded-full blur-[120px] pointer-events-none group-hover:bg-indigo-600/[0.08] transition-all duration-1000" />
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-12 relative z-10">
        <div className="space-y-6 sm:space-y-8 max-w-xl text-center lg:text-left w-full">
          <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-glow-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-700 flex-shrink-0">
              <Brain size={32} className="sm:hidden" />
              <Brain size={40} className="hidden sm:block" />
            </div>
            <div className="flex flex-col items-center sm:items-start">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em]">{t('intelligenceEngine.neuralEngineVersion')}</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic leading-none">{t('intelligenceEngine.resonating')}</span>
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tighter uppercase italic leading-none">{t('intelligenceEngine.neuralCommandCenter')}</h2>
            </div>
          </div>
          
          <AnimatePresence mode="wait">
            {insight ? (
              <motion.div 
                key="insight"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="relative p-6 sm:p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 shadow-inner group/insight">
                  <Quote className="absolute -top-3 -left-3 text-indigo-500 opacity-40" size={32} />
                  <p className="text-lg sm:text-xl font-black text-white italic tracking-tight leading-snug">
                    {insight.quote}
                  </p>
                </div>
                
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Lightbulb size={20} />
                  </div>
                  <p className="text-sm sm:text-base text-indigo-200 font-medium leading-relaxed">
                    <span className="text-indigo-400 font-black uppercase text-[10px] tracking-widest block mb-1">{t('intelligenceEngine.strategicCalibration')}</span>
                    {insight.tip}
                  </p>
                </div>
              </motion.div>
            ) : (
              <p className="text-base sm:text-lg text-[var(--text-dim)] font-medium leading-relaxed italic">
                {loading ? t('intelligenceEngine.initializing') : t('intelligenceEngine.analyzingDescription')}
              </p>
            )}
          </AnimatePresence>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
             <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4 group/node hover:bg-white/[0.05] transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                   <Cpu size={20} />
                </div>
                <div className="text-left">
                   <p className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">{t('intelligenceEngine.inferenceLoad')}</p>
                   <p className="text-sm font-black text-white italic">{t('intelligenceEngine.inferenceLoadValue')}</p>
                </div>
             </div>
             <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4 group/node hover:bg-white/[0.05] transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                   <Zap size={20} />
                </div>
                <div className="text-left">
                   <p className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">{t('intelligenceEngine.latencyPulse')}</p>
                   <p className="text-sm font-black text-white italic">{t('intelligenceEngine.latencyPulseValue')}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Neural Synapse Visualization */}
        <div className="relative w-full lg:w-[450px] aspect-square flex items-center justify-center shrink-0">
           <div className="absolute inset-0 bg-indigo-500/5 rounded-full blur-[100px] animate-pulse" />
           
           <div className="relative w-full h-full flex items-center justify-center">
              {[...Array(12)].map((_, i) => {
                const angle = (i * 360) / 12
                const isActive = activeNodes.includes(i)
                return (
                  <motion.div
                    key={i}
                    className="absolute w-full h-full"
                    initial={{ rotate: angle }}
                    animate={{ rotate: angle + 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                  >
                    <motion.div 
                      className={`absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all duration-1000 ${isActive ? 'bg-indigo-500 border-indigo-400 shadow-glow-primary scale-125' : 'bg-white/5 border-white/10'}`}
                      animate={isActive ? { scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    {isActive && (
                      <motion.div 
                        className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-32 bg-gradient-to-b from-indigo-500 to-transparent opacity-40 origin-top"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 1 }}
                      />
                    )}
                  </motion.div>
                )
              })}
              
              <div className="w-40 h-40 rounded-full bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center relative z-20 shadow-[inset_0_0_40px_rgba(99,102,241,0.2)] group/core">
                 <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                 <Fingerprint size={64} className="text-indigo-400 group-hover:scale-110 transition-transform duration-700" />
                 <div className="absolute -bottom-4 bg-indigo-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] shadow-glow-primary">
                    {t('intelligenceEngine.coreActive')}
                 </div>
              </div>

              {/* Connecting lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                 <circle cx="50%" cy="50%" r="40%" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" className="text-white/20" />
                 <circle cx="50%" cy="50%" r="30%" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" className="text-white/10" />
              </svg>
           </div>
        </div>
      </div>
    </div>
  )
}

export default IntelligenceEngine
