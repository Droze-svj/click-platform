'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Zap, Shield, Cpu, Binary, Globe,
  Terminal, Search, Database, MessageSquare, Flame
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

const SIGNAL_TYPES = [
  { labelKey: 'neuralTranscription', icon: Cpu, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { labelKey: 'hookOptimization', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { labelKey: 'trendMigration', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { labelKey: 'clusterSync', icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { labelKey: 'agentStrategy', icon: Binary, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { labelKey: 'sentimentLogic', icon: MessageSquare, color: 'text-pink-400', bg: 'bg-pink-500/10' },
]

const SIGNAL_KEYS = [
  'signal0', 'signal1', 'signal2', 'signal3', 'signal4',
  'signal5', 'signal6', 'signal7', 'signal8', 'signal9',
]

export default function LiveActivityFeed() {
  const { t } = useTranslation()
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
    const messageKey = SIGNAL_KEYS[Math.floor(Math.random() * SIGNAL_KEYS.length)]
    return { id, ...type, messageKey, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">{t('liveActivityFeed.neuralSignalFeed')}</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[7.5px] font-black text-emerald-400 uppercase tracking-widest">{t('liveActivityFeed.liveEncryption')}</span>
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
                  <span className={`text-[8px] font-black uppercase tracking-widest ${signal.color}`}>{t(`liveActivityFeed.${signal.labelKey}`)}</span>
                  <span className="text-[8px] font-black text-slate-700 tabular-nums">{signal.time}</span>
                </div>
                <p className="text-[10px] text-slate-300 font-bold italic leading-tight truncate">
                  <span className="text-slate-600 mr-2">➜</span>
                  {t(`liveActivityFeed.${signal.messageKey}`)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center pt-2">
        <button className="text-[9px] font-black text-slate-600 hover:text-indigo-400 uppercase tracking-widest flex items-center gap-2 transition-colors">
          <Activity size={10} /> {t('liveActivityFeed.calibrateNeuralCore')}
        </button>
      </div>
    </div>
  )
}
