'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Activity, ShieldCheck, TrendingUp, BarChart3 } from 'lucide-react'

interface HealthDeltaOverlayProps {
  score: number
  diversityDelta: number
  engagementPotential: number
}

const HealthDeltaOverlay: React.FC<HealthDeltaOverlayProps> = ({ score, diversityDelta, engagementPotential }) => {
  return (
    <div className="absolute top-6 left-6 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="backdrop-blur-2xl bg-black/40 border border-white/10 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 min-w-[240px]"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
             <Activity className="w-4 h-4 text-emerald-400" />
             <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">Predictive Health HUD</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase tracking-widest">
            Elite
          </div>
        </div>

        <div className="space-y-5">
           <div className="flex items-end justify-between">
              <div className="space-y-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Structural Score</span>
                 <div className="text-4xl font-black text-white italic tracking-tighter tabular-nums leading-none">
                   {score}<span className="text-sm not-italic opacity-30 ml-1">%</span>
                 </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                 <div className="flex items-center gap-1.5 text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[11px] font-black italic">+{diversityDelta}%</span>
                 </div>
                 <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">vs Historical Avg</span>
              </div>
           </div>

           <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Retention Alignment</span>
                 </div>
                 <span className="text-[10px] font-bold text-white italic">{engagementPotential}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                 <motion.div
                   initial={{ width: 0 }}
                   animate={{ width: `${engagementPotential}%` }}
                   className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                 />
              </div>
           </div>

           <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
              <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[9px] font-bold text-slate-400 leading-tight">
                This video is <span className="text-white">optimized</span> for current viral patterns in your niche.
              </p>
           </div>
        </div>
      </motion.div>
    </div>
  )
}

export default HealthDeltaOverlay
