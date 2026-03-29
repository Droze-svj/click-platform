'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, ArrowRight, Lightbulb, Zap, Target, BarChart3, ShieldCheck } from 'lucide-react'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'

interface Pivot {
  pivot: string;
  reason: string;
  expectedImpact: string;
  confidence?: number;
}

interface StrategicPivotsViewProps {
  pivots: Pivot[];
  currentWins?: string;
  onScale: (niche: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const StrategicPivotsView: React.FC<StrategicPivotsViewProps> = ({ pivots, currentWins, onScale, onClose, loading }) => {
  const [selectedNiche, setSelectedNiche] = React.useState('AI SaaS')
  const [showSwarmHUD, setShowSwarmHUD] = React.useState(false)
  
  const handleApplyStrategy = () => {
    setShowSwarmHUD(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col gap-6 h-full"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-black uppercase tracking-[0.2em] italic text-violet-400 flex items-center gap-3">
              <Lightbulb className="w-5 h-5" />
              Strategic Intelligence // Cognitive Loop
            </h2>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
              Analyzing high-revenue patterns and suggesting autonomous pivots
            </p>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="flex gap-2">
            {['AI SaaS', 'Gaming', 'Fintech', 'Ecommerce'].map(n => (
              <button
                key={n}
                onClick={() => setSelectedNiche(n)}
                className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                  selectedNiche === n ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
        >
          [ Close Node ]
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: WIN Summary */}
        <div className="col-span-4 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                 <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Winning DNA Summary: {selectedNiche}</h3>
           </div>

           <div className="flex-1 space-y-4">
              <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
                 <p className="text-[12px] text-slate-300 italic leading-relaxed">
                   "{currentWins || 'Pattern detected: 15s hooks with high-contrast subtitles are driving +40% retention in the first 3 seconds of the video.'}"
                 </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Avg. Hook CTR</p>
                    <p className="text-xl font-black text-emerald-400">12.4%</p>
                 </div>
                 <div className="p-4 rounded-3xl bg-white/5 border border-white/5 text-center">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Conversion Velocity</p>
                    <p className="text-xl font-black text-violet-400">High</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Recommended Pivots */}
        <div className="col-span-8 flex flex-col gap-6 overflow-hidden">
           <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Autonomous Strategy for {selectedNiche}</h3>
                 <span className="text-[8px] px-2 py-1 rounded bg-violet-500/20 text-violet-400 font-black uppercase">Stress-Test Live</span>
              </div>

              <div className="space-y-6">
                 {pivots.length > 0 ? pivots.map((pivot, i) => (
                   <motion.div
                     key={i}
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: i * 0.1 }}
                     className="group relative p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-violet-500/30 transition-all cursor-pointer"
                   >
                     <div className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 border border-white/10 group-hover:bg-violet-500 transition-colors">
                        <Zap className="w-3 h-3 text-white" />
                     </div>

                     <div className="flex items-start gap-5">
                        <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center font-black text-violet-400 text-sm italic">
                          0{i+1}
                        </div>
                        <div className="flex-1">
                           <h4 className="text-[13px] font-black text-white uppercase tracking-wider mb-2">{pivot.pivot}</h4>
                           <p className="text-[10px] text-slate-400 leading-relaxed mb-4 italic">&ldquo;{pivot.reason}&rdquo;</p>
                           <div className="flex items-center justify-between mt-4">
                               <div className="flex items-center gap-2">
                                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Impact: {pivot.expectedImpact}</span>
                               </div>
                               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                  <ShieldCheck className="w-2.5 h-2.5 text-indigo-400" />
                                  <span className="text-[8px] font-black text-indigo-400 uppercase">Confidence: {pivot.confidence || 92}%</span>
                               </div>
                            </div>
                        </div>
                     </div>
                   </motion.div>
                 )) : (
                     <div className="h-64 flex flex-col items-center justify-center text-slate-600 gap-4 opacity-40 italic">
                       {loading ? <Zap className="w-12 h-12 animate-pulse text-violet-400" /> : <BarChart3 className="w-12 h-12" />}
                       <p className="text-xs uppercase tracking-widest">{loading ? `Synthesizing ${selectedNiche} Strategy...` : 'Analyzing platform signals...'}</p>
                    </div>
                 )}
              </div>
           </div>

           <button
             onClick={handleApplyStrategy}
             disabled={loading}
             className="w-full py-5 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-[11px] uppercase tracking-[0.3em] italic transition-all flex items-center justify-center gap-4 group"
           >
              {loading ? 'Processing Node...' : `Apply ${selectedNiche} Strategy to All Agents`}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      </div>

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={`Strategy Optimization: ${selectedNiche}`}
        onComplete={() => {
          setShowSwarmHUD(false)
          onScale(selectedNiche)
        }}
      />
    </motion.div>
  )
}

export default StrategicPivotsView
