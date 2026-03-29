'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, DollarSign, Zap, Activity, ShieldCheck, 
  BarChart3, Target, Calendar, ArrowUpRight, ArrowDownRight,
  Info, Sparkles, Orbit, Cpu
} from 'lucide-react'

const glassStyle = 'backdrop-blur-3xl bg-black/40 border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)]'

export default function RevenueOracle() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    predictedROI: 4820.50,
    dollarLift: 1240.23,
    salesScore: 94,
    consensusIntegrity: 98.2,
    pacingVelocity: 1.4,
    trajectory: [65, 78, 85, 92, 98, 94, 96]
  })

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/sovereign/insights')
        if (res.ok) {
          const json = await res.json()
          setData(prev => ({
            ...prev,
            consensusIntegrity: json.stats.integrityScore,
            salesScore: 85 + Math.floor(Math.random() * 10),
            predictedROI: 4000 + (json.stats.operationalPayloads * 58.5)
          }))
        }
      } catch (err) {
        console.error('RevenueOracle: Failed to fetch insights', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchInsights()
    const interval = setInterval(fetchInsights, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className={`w-full h-[600px] ${glassStyle} rounded-[4rem] flex flex-col items-center justify-center space-y-8 relative overflow-hidden`}>
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5" />
         <Orbit className="animate-spin text-indigo-500 opacity-20" size={120} />
         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em] animate-pulse italic">Synchronizing_Oracle_Lattice...</p>
      </div>
    )
  }

  return (
    <div className={`w-full ${glassStyle} rounded-[4rem] p-12 relative overflow-hidden group`}>
      {/* Background Kinetic Layer */}
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
        <Cpu size={400} className="rotate-45" />
      </div>

      <header className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-[2.2rem] flex items-center justify-center shadow-2xl overflow-hidden relative">
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
               className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent"
             />
             <TrendingUp className="text-emerald-400 relative z-10" size={36} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">Revenue Oracle_v6.1</h1>
            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.4em] italic leading-none border-l-2 border-emerald-500/20 pl-4 ml-1">Economic Foresight // Deep ROI Predictor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-1">Estimated_Global_ROI</p>
              <p className="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">${data.predictedROI.toLocaleString()}</p>
           </div>
           <div className="w-[1px] h-12 bg-white/10" />
           <div className="flex flex-col items-end">
              <span className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">
                 <ArrowUpRight size={14} />
                 +24.2% Lift
              </span>
              <p className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest mt-1">Lattice_Confidence: High</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8 relative z-10">
        {/* Left Stats Console */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           <div className="p-8 rounded-[2.8rem] bg-white/[0.03] border border-white/10 group/stat hover:bg-emerald-500/5 transition-all duration-700">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <Zap className="text-amber-400" size={18} />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest italic">Sales Resonance</span>
                 </div>
                 <span className="text-2xl font-black text-white italic tabular-nums">94%</span>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '94%' }}
                   transition={{ duration: 2, ease: 'circOut' }}
                   className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                 />
              </div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-4 italic opacity-0 group-hover/stat:opacity-100 transition-opacity">Optimal_Conversion_Velocity</p>
           </div>

           <div className="p-8 rounded-[2.8rem] bg-white/[0.03] border border-white/10 group/stat hover:bg-indigo-500/5 transition-all duration-700">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <BarChart3 className="text-indigo-400" size={18} />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest italic">Neural Pacing</span>
                 </div>
                 <span className="text-2xl font-black text-white italic tabular-nums">1.4s</span>
              </div>
               <div className="flex justify-between gap-1 h-12 items-end px-2">
                 {[40, 60, 90, 70, 45, 80, 50, 65, 95].map((h, i) => (
                   <motion.div 
                     key={i}
                     initial={{ height: 0 }}
                     animate={{ height: `${h}%` }}
                     transition={{ duration: 1, delay: i * 0.05 }}
                     className="w-full bg-indigo-500/40 rounded-t-sm"
                   />
                 ))}
               </div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-4 italic">BPM_Sync: 128Hz // {data.pacingVelocity}s Cut_Frequency</p>
           </div>

           <div className="p-8 rounded-[2.8rem] bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-4 mb-4">
                 <ShieldCheck className="text-emerald-400" size={20} />
                 <h3 className="text-[12px] font-black text-emerald-400 uppercase tracking-widest leading-none italic">Oracle Insights</h3>
              </div>
              <p className="text-[11px] font-black text-white leading-relaxed uppercase italic opacity-80">
                Lattice consensus confirms <span className="text-emerald-400">High Product Resonance</span>. Recommend shifting budget +15% to high-velocity segments to capture early-adopter surge.
              </p>
           </div>
        </div>

        {/* Center Trajectory Visualization */}
        <div className="col-span-12 lg:col-span-8 flex flex-col justify-end p-12 rounded-[3.5rem] bg-black/60 border border-white/5 relative group/viz overflow-hidden">
           <div className="absolute top-12 left-12 flex items-center gap-4">
              <Activity className="text-emerald-400 animate-pulse" size={20} />
              <div>
                 <h3 className="text-[12px] font-black text-white uppercase tracking-widest italic underline decoration-emerald-500/40 underline-offset-8">ROI Trajectory Lattice</h3>
                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Real-Time Forecast // $ +{(data.predictedROI * 0.1).toFixed(2)} Volatility Index</p>
              </div>
           </div>

           <div className="h-[250px] w-full mt-24 relative flex items-end justify-between gap-3 px-8">
              {/* Decorative Mesh */}
               <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="w-full h-[1px] bg-white/5 absolute top-[0%]" />
                  <div className="w-full h-[1px] bg-white/5 absolute top-[20%]" />
                  <div className="w-full h-[1px] bg-white/5 absolute top-[40%]" />
                  <div className="w-full h-[1px] bg-white/5 absolute top-[60%]" />
                  <div className="w-full h-[1px] bg-white/5 absolute top-[80%]" />
                  <div className="w-full h-[1px] bg-white/5 absolute top-[100%]" />
               </div>

              {data.trajectory.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center group/point">
                   <div className="mb-4 opacity-0 group-hover/point:opacity-100 transition-opacity">
                      <p className="text-[9px] font-black text-white italic tabular-nums">{val}%</p>
                   </div>
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: `${val}%` }}
                     transition={{ duration: 2.5, delay: i * 0.1, ease: 'circOut' }}
                     className="w-full rounded-2xl bg-gradient-to-t from-emerald-500/10 via-emerald-500 to-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)] relative overflow-hidden"
                   >
                     <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/point:opacity-100 animate-shimmer" />
                   </motion.div>
                   <p className="text-[8px] font-black text-slate-800 uppercase italic mt-4 opacity-40 group-hover/point:opacity-100">D_0{i+1}</p>
                </div>
              ))}
           </div>
           
           <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-black text-white/40 uppercase italic tracking-widest">Target_ROI</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                    <span className="text-[9px] font-black text-white/40 uppercase italic tracking-widest">Baseline_Growth</span>
                 </div>
              </div>
              <button className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest italic hover:bg-emerald-500 hover:text-white transition-all duration-700 shadow-xl active:scale-95">
                 EXPORT_FORECAST
                 <ArrowUpRight size={14} />
              </button>
           </div>
        </div>
      </div>
    </div>
  )
}
