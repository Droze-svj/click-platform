'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Activity, Shield, Sparkles } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../hooks/useAuth'

interface ActivityPulse {
  id: string
  userName: string
  action: string
  target: string
  type: 'optimization' | 'security' | 'generation' | 'collaboration'
  timestamp: string
}

export default function RealTimeActivityTicker() {
  const { user } = useAuth()
  const { on, off } = useSocket(user?.id)
  const [pulses, setPulses] = useState<ActivityPulse[]>([
    {
      id: 'init-1',
      userName: 'Neural Core',
      action: 'Monitoring',
      target: 'Repository Cluster',
      type: 'security',
      timestamp: new Date().toISOString()
    }
  ])

  useEffect(() => {
    const handlePulse = (pulse: ActivityPulse) => {
      setPulses(prev => [pulse, ...prev].slice(0, 10))
    }

    on('activity-pulse', handlePulse)

    return () => {
      off('activity-pulse', handlePulse)
    }
  }, [on, off])

  const getPulseIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Zap className="w-3 h-3 text-emerald-500" />
      case 'security': return <Shield className="w-3 h-3 text-indigo-500" />
      case 'generation': return <Sparkles className="w-3 h-3 text-purple-500" />
      case 'collaboration': return <Activity className="w-3 h-3 text-amber-500" />
      default: return <Zap className="w-3 h-3 text-emerald-500" />
    }
  }

  return (
    <div className="h-48 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#020202] to-transparent z-10" />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#020202] to-transparent z-10" />

      <div className="space-y-2 py-4">
        <AnimatePresence initial={false}>
          {pulses.map((pulse) => (
            <motion.div
              key={pulse.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-4 group/pulse"
            >
              <div className="w-1 h-8 rounded-full bg-white/5 group-hover/pulse:bg-emerald-500 transition-all duration-700" />

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  {getPulseIcon(pulse.type)}
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter italic">
                    {pulse.userName}
                  </span>
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                    {new Date(pulse.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    {pulse.action}
                  </span>
                  <span className="text-[11px] font-black text-emerald-500/80 italic tracking-tight">
                    {pulse.target}
                  </span>
                </div>
              </div>

              <div className="opacity-0 group-hover/pulse:opacity-100 transition-opacity">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* HUD Scanning Line */}
      <motion.div
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-px bg-white/10 z-20 pointer-events-none"
      />
    </div>
  )
}
