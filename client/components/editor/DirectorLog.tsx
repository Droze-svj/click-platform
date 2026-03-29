'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, AlertTriangle, CheckCircle2, Flame, Zap } from 'lucide-react'

interface DirectorLogProps {
  persona: 'beast' | 'minimalist' | 'architect' | 'educator'
  metrics: {
    cutsPerMinute: number
    brollRatio: number
    hookStrength: number
  }
  currentTime: number
}

const DirectorLog: React.FC<DirectorLogProps> = ({ persona, metrics, currentTime }) => {
  const [logs, setLogs] = useState<{ id: string; text: string; type: 'alert' | 'praise' | 'info'; timestamp: number }[]>([])

  const personaConfig = {
    beast: { name: 'The Beast', color: 'text-orange-500', icon: Flame },
    minimalist: { name: 'The Minimalist', color: 'text-slate-400', icon: Zap },
    architect: { name: 'The Architect', color: 'text-indigo-500', icon: AlertTriangle },
    educator: { name: 'The Educator', color: 'text-emerald-500', icon: CheckCircle2 }
  }

  // Effect to generate "Live Thoughts" based on metrics
  useEffect(() => {
    const triggerThought = () => {
      let newThought = ''
      let type: 'alert' | 'praise' | 'info' = 'info'

      if (metrics.cutsPerMinute < 8) {
        newThought = persona === 'beast'
          ? "CUT FASTER. We're losing them at the 3-second mark. More tension!"
          : "The pacing is a bit erratic. Let's tighten the temporal flow."
        type = 'alert'
      } else if (metrics.brollRatio < 0.2) {
        newThought = persona === 'architect'
          ? "Visual fatigue detected. Inject B-Roll now to reset the viewer's attention loop."
          : "Needs more visual coverage to maintain semantic resonance."
        type = 'alert'
      } else if (metrics.hookStrength > 90) {
        newThought = persona === 'beast'
          ? "THAT HOOK IS INSANE. This is going viral. Don't touch it."
          : "Excellent hook calibration. Emotional weight is at peak levels."
        type = 'praise'
      }

      if (newThought) {
        setLogs(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          text: newThought,
          type,
          timestamp: Date.now()
        }, ...prev].slice(0, 3))
      }
    }

    const interval = setInterval(triggerThought, 8000)
    return () => clearInterval(interval)
  }, [metrics, persona])

  const Config = personaConfig[persona]

  return (
    <div className="glass-neural rounded-[2rem] p-6 border-white/5 space-y-4 overflow-hidden relative group">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Config.icon className={`w-4 h-4 ${Config.color}`} />
          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">
            Director&apos;s Log // {Config.name}
          </h4>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Live Syncing</span>
        </div>
      </div>

      <div className="space-y-3 min-h-[120px]">
        <AnimatePresence initial={false}>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ height: 0, opacity: 0, x: -10 }}
              animate={{ height: 'auto', opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`p-4 rounded-xl border text-[10px] font-bold leading-relaxed flex gap-3 ${
                log.type === 'alert'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : log.type === 'praise'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-8">
            <MessageSquare className="w-8 h-8 text-white mb-2" />
            <span className="text-[10px] font-black uppercase tracking-widest italic">Awaiting AI Analysis...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DirectorLog
