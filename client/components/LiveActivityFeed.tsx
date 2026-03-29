'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Zap, Shield, Cpu, Binary, Globe,
  Terminal, Search, Database, MessageSquare, Flame
} from 'lucide-react'

const SIGNAL_TYPES = [
  { label: 'Neural Transcription', icon: Cpu, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { label: 'Hook Optimization', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { label: 'Trend Migration', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Cluster Sync', icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Agent Strategy', icon: Binary, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { label: 'Sentiment Logic', icon: MessageSquare, color: 'text-pink-400', bg: 'bg-pink-500/10' },
]

const SIGNALS = [
  'Refined Whisper V3 weights for 98.4% precision',
  'Analyzing TikTok "Shock-Cut" trend in US-East',
  'Syncing user brand-kit to edge nodes',
  'Processing frame-buffer for pattern interrupt',
  'Calibrating hook-score against 12M viral clips',
  'Aggregating engagement velocity for cluster-B',
  'Optimizing GPU shard for parallel transcription',
  'Retrieving LLM context for caption generation',
  'Validating cross-platform publishing tokens',
  'Intercepting viral signals in niche: Tech-Edu',
]

export default function LiveActivityFeed() {
  const [activeSignals, setActiveSignals] = useState<any[]>([])
  const timerRef = useRef<any>(null)

  useEffect(() => {
    // Initial batch
    const initial = Array.from({ length: 4 }).map((_, i) => createSignal(i))
    setActiveSignals(initial)

    // Interval to add new signals
    timerRef.current = setInterval(() => {
      const newSignal = createSignal(Date.now())
      setActiveSignals(prev => [newSignal, ...prev.slice(0, 5)])
    }, 4000)

    return () => clearInterval(timerRef.current)
  }, [])

  function createSignal(id: any) {
    const type = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)]
    const message = SIGNALS[Math.floor(Math.random() * SIGNALS.length)]
    return { id, ...type, message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Neural Signal Feed</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[7.5px] font-black text-emerald-400 uppercase tracking-widest">Live Encryption</span>
        </div>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-hidden relative">
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#07070f] to-transparent z-10 pointer-events-none" />

        <AnimatePresence mode="popLayout">
          {activeSignals.map((signal, i) => (
            <motion.div
              key={signal.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className="group p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all flex items-start gap-4"
            >
              <div className={`w-10 h-10 rounded-xl ${signal.bg} flex items-center justify-center border border-white/5 shrink-0 group-hover:scale-105 transition-transform`}>
                <signal.icon className={`w-5 h-5 ${signal.color}`} />
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest ${signal.color}`}>{signal.label}</span>
                  <span className="text-[8px] font-black text-slate-700 tabular-nums">{signal.time}</span>
                </div>
                <p className="text-[10px] text-slate-300 font-bold italic leading-tight truncate">
                  <span className="text-slate-600 mr-2">➜</span>
                  {signal.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center pt-2">
        <button className="text-[9px] font-black text-slate-600 hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 transition-colors">
          <Activity size={10} /> Calibrate Neural Core
        </button>
      </div>
    </div>
  )
}
