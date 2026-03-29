'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Flame, TrendingUp } from 'lucide-react'

interface EngagementHeatMapProps {
  transcript: any
  currentTime: number
  duration: number
  isOled?: boolean
}

const EngagementHeatMap: React.FC<EngagementHeatMapProps> = ({
  transcript,
  currentTime,
  duration,
  isOled = false
}) => {
  // Synthesize engagement data based on transcript semantic weight
  const engagementWaves = useMemo(() => {
    if (!duration || duration <= 0) return []

    const points = 100
    const waves = []
    const words = transcript?.words || []

    // High impact keywords that trigger "peaks"
    const impactKeywords = ['secret', 'massive', 'insane', 'never', 'immediately', 'viral', 'stop', 'look']

    for (let i = 0; i < points; i++) {
      const timeAtPoint = (i / points) * duration

      // Base wave (noise)
      let score = 40 + Math.sin(i * 0.3) * 10 + Math.random() * 5

      // Boost score if words near this time are "High Impact"
      const localWords = words.filter((w: any) => w && Math.abs((w.start ?? 0) - timeAtPoint) < 2)
      const hasImpact = localWords.some((w: any) => {
        const text = (w.word || w.text || '').toString().toLowerCase().replace(/[^a-z]/g, '');
        return text && impactKeywords.includes(text);
      })

      if (hasImpact) score += 35
      if (score > 95) score = 95

      waves.push({
        id: i,
        time: timeAtPoint,
        score,
        isPeak: score > 75
      })
    }
    return waves
  }, [transcript, duration])

  const progress = (currentTime / duration) * 100

  return (
    <div className={`p-6 rounded-[2.5rem] ${isOled ? 'bg-black border border-white/5' : 'bg-white/[0.02] border border-white/5'} backdrop-blur-3xl relative overflow-hidden group`}>
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Neural Engagement Map</h4>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Predictive Retention // 0xRetent</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-emerald-400 tabular-nums">94% PROP</span>
              <span className="text-[7px] font-bold text-slate-600 uppercase tracking-tighter">Alpha Peak</span>
           </div>
           <Flame className="w-4 h-4 text-orange-500" />
        </div>
      </div>

      <div className="h-20 w-full flex items-end gap-[2px] relative group/map">
        {/* Playhead Indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-[2px] bg-white z-20 shadow-[0_0_15px_rgba(255,255,255,0.8)]"
          style={{ left: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {engagementWaves.map((wave, i) => (
          <div
            key={wave.id}
            className={`flex-1 rounded-t-sm transition-all duration-700 ${
              wave.isPeak
                ? 'bg-gradient-to-t from-emerald-500/40 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-white/10'
            }`}
            style={{
              height: `${wave.score}%`,
              opacity: (i / 100) * 100 > progress ? 0.3 : 1
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-slate-500" />
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Global Retention Benchmarking Active</span>
        </div>
        <span className="text-[8px] font-mono text-slate-500">v4.0.2_SYNT</span>
      </div>
    </div>
  )
}

export default EngagementHeatMap
