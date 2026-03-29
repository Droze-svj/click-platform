'use client'

import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, DollarSign, Users, ArrowUpRight, MapPin, Fingerprint, Zap, Cpu } from 'lucide-react'

interface StyleDNA {
  topStyle: string;
  matchScore: number;
  secondaryStyle: string;
  color: string;
}

interface RegionData {
  id: string;
  name: string;
  revenue: number;
  creators: number;
  growth: string;
  coords: { x: number; y: number };
  styleDNA: StyleDNA;
  evolutionVelocity: number; // 0-100 score of how fast the DNA is evolving
}

const regions: RegionData[] = [
  {
    id: 'na', name: 'North America', revenue: 142000, creators: 840, growth: '+12%', coords: { x: 200, y: 150 },
    styleDNA: { topStyle: 'Minimalist', matchScore: 88, secondaryStyle: 'Bold Typography', color: '#60a5fa' },
    evolutionVelocity: 42
  },
  {
    id: 'eu', name: 'Europe', revenue: 98000, creators: 620, growth: '+8%', coords: { x: 480, y: 140 },
    styleDNA: { topStyle: 'Corporate Sleek', matchScore: 82, secondaryStyle: 'Cinematic', color: '#f87171' },
    evolutionVelocity: 28
  },
  {
    id: 'as', name: 'Asia Pacific', revenue: 185000, creators: 1240, growth: '+24%', coords: { x: 750, y: 220 },
    styleDNA: { topStyle: 'Cyberpunk', matchScore: 94, secondaryStyle: 'Neon Glitch', color: '#c084fc' },
    evolutionVelocity: 94
  },
  {
    id: 'sa', name: 'South America', revenue: 32000, creators: 210, growth: '+15%', coords: { x: 300, y: 350 },
    styleDNA: { topStyle: 'Vibrant Organic', matchScore: 78, secondaryStyle: 'Street', color: '#fbbf24' },
    evolutionVelocity: 56
  },
  {
    id: 'af', name: 'Africa', revenue: 18000, creators: 145, growth: '+32%', coords: { x: 500, y: 280 },
    styleDNA: { topStyle: 'High Contrast', matchScore: 85, secondaryStyle: 'Geometric', color: '#fb923c' },
    evolutionVelocity: 72
  },
]

interface CreatorPayoutMapProps {
  onApplyStyleBridge?: (regionId: string) => void;
  evolutionForecast?: any[];
  isAutonomous?: boolean;
}

const CreatorPayoutMap: React.FC<CreatorPayoutMapProps> = ({ onApplyStyleBridge, evolutionForecast = [], isAutonomous = false }) => {
  const [viewMode, setViewMode] = React.useState<'revenue' | 'style' | 'evolution'>('revenue')
  const totalRevenue = useMemo(() => regions.reduce((acc, r) => acc + r.revenue, 0), [])
  const avgVelocity = useMemo(() => (regions.reduce((acc, r) => acc + r.evolutionVelocity, 0) / regions.length).toFixed(1), [])
  const [bridgingId, setBridgingId] = React.useState<string | null>(null)

  const handleNodeClick = (regionId: string) => {
    if (viewMode === 'style' && onApplyStyleBridge) {
      setBridgingId(regionId)
      onApplyStyleBridge(regionId)
      setTimeout(() => setBridgingId(null), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-8 h-full"
    >
      {/* Header HUD */}
      <div className="flex items-center justify-between relative z-20">
        <div className="flex flex-col gap-1">
          <h2 className={`text-2xl font-black uppercase tracking-[0.2em] italic flex items-center gap-3 ${viewMode === 'evolution' ? 'text-indigo-400' : 'text-emerald-400'}`}>
            <Globe className="w-6 h-6" />
            {viewMode === 'evolution' ? 'Global Evolution Cartography' : 'Global Revenue Cartography'}
          </h2>
          <div className="flex gap-4 items-center mt-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">
              {viewMode === 'evolution' ? 'Tracking neural Style-DNA adaptation velocity across global nodes' : 'Real-time heatmapping of cross-border fiscal distribution'}
            </p>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
               <button
                 onClick={() => setViewMode('revenue')}
                 className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.1em] transition-all ${viewMode === 'revenue' ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
               >
                 Revenue Flow
               </button>
               <button
                 onClick={() => setViewMode('style')}
                 className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.1em] transition-all ${viewMode === 'style' ? 'bg-violet-500 text-white' : 'text-slate-500 hover:text-white'}`}
               >
                 Style DNA
               </button>
               <button
                 onClick={() => setViewMode('evolution')}
                 className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.1em] transition-all ${viewMode === 'evolution' ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'text-slate-500 hover:text-white'}`}
               >
                 Evolution Mode
               </button>
            </div>
          </div>
        </div>

        <div className="flex gap-8 items-center">
           {isAutonomous && (
             <div className="flex items-center gap-2 px-3 py-1 bg-indigo-600/20 border border-indigo-400/30 rounded-full animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                <span className="text-[7px] font-black text-indigo-300 uppercase tracking-[0.2em]">Autonomous Mode Active</span>
             </div>
           )}
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">{viewMode === 'evolution' ? 'Avg Evolution Velocity' : 'Global Payout Pool'}</span>
              <span className="text-2xl font-black text-white italic">{viewMode === 'evolution' ? `${avgVelocity}v` : `$${totalRevenue.toLocaleString()}`}</span>
           </div>
           <div className="h-10 w-[1px] bg-white/10" />
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">{viewMode === 'evolution' ? 'Fastest Node' : 'Active Nodes'}</span>
              <span className={`text-2xl font-black italic ${viewMode === 'evolution' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {viewMode === 'evolution' ? 'APAC' : '3,055'}
              </span>
           </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
        {/* The Map visualization */}
        <div className="col-span-8 bg-white/[0.02] border border-white/5 rounded-[4rem] p-8 relative overflow-hidden group">
           {/* Simple World Map SVG Mask/Base */}
           <div className="absolute inset-0 opacity-[0.05] pointer-events-none p-12">
             <svg viewBox="0 0 1000 500" className="w-full h-full fill-white">
               <path d="M150,150 L250,150 L300,200 L250,350 L150,350 Z" />
               <path d="M450,120 L550,120 L580,200 L420,200 Z" />
               <path d="M650,150 L850,150 L900,300 L700,400 Z" />
               <path d="M450,250 L550,250 L580,400 L420,400 Z" />
               <path d="M250,350 L350,350 L380,480 L220,480 Z" />
             </svg>
           </div>

            {/* Predictive Surge Ghost Nodes */}
            {viewMode === 'evolution' && evolutionForecast.map((f, i) => {
               const region = regions.find(r => r.id === f.regionId);
               if (!region || parseFloat(f.probability) < 70) return null;
               return (
                 <div
                   key={`surge-${i}`}
                   className="absolute pointer-events-none"
                   style={{ left: region.coords.x + 30, top: region.coords.y - 30 }}
                 >
                    <motion.div
                      animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="relative flex items-center justify-center"
                    >
                       <div className="absolute w-12 h-12 rounded-full bg-indigo-500/10 blur-xl" />
                       <Cpu className="w-6 h-6 text-indigo-400 opacity-40 shrink-0" />
                    </motion.div>
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600/20 backdrop-blur-sm border border-indigo-500/20 px-2 py-0.5 rounded text-[6px] font-black text-indigo-300 uppercase tracking-widest">
                       Surge Echo: {f.probability}
                    </div>
                 </div>
               )
            })}

           {/* Neural Lattice Overlay */}
           <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="w-full h-full bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:40px_40px]" />
           </div>

            {regions.map((region) => (
             <motion.div
               key={region.id}
               className="absolute cursor-pointer group/node"
               style={{ left: region.coords.x, top: region.coords.y }}
               whileHover={{ scale: 1.1 }}
               onClick={() => handleNodeClick(region.id)}
             >
                {/* Pulse Ring */}
                <div className="absolute inset-0 -translate-x-1/2 -translate-y-1/2">
                   <motion.div
                     animate={{
                        scale: bridgingId === region.id ? [1, 3] : [1, 2],
                        opacity: bridgingId === region.id ? [1, 0] : [0.5, 0],
                        borderColor: viewMode === 'style' ? [region.styleDNA.color, region.styleDNA.color] : viewMode === 'evolution' ? ['#818cf8', '#818cf8'] : ['#10b981', '#10b981']
                     }}
                     transition={{ duration: bridgingId === region.id ? 0.5 : 2, repeat: bridgingId === region.id ? 4 : Infinity }}
                     className="w-12 h-12 rounded-full border"
                   />
                </div>

                {/* Node Core */}
                <motion.div
                   animate={{
                      backgroundColor: viewMode === 'style' ? region.styleDNA.color : viewMode === 'evolution' ? '#818cf8' : '#10b981',
                      boxShadow: viewMode === 'style' ? `0 0 20px ${region.styleDNA.color}cc` : viewMode === 'evolution' ? '0 0 20px rgba(129,140,248,0.8)' : '0 0 20px rgba(16,185,129,0.8)',
                      scale: bridgingId === region.id ? [1, 1.5, 1] : 1
                   }}
                   className="relative -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
                />

                {/* Bridging Status */}
                <AnimatePresence>
                  {bridgingId === region.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-[8px] font-black uppercase tracking-widest rounded-full shadow-2xl z-30 whitespace-nowrap"
                    >
                      Bridging Style
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Floating Label */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-44 p-5 rounded-3xl bg-black/95 border border-white/10 backdrop-blur-3xl opacity-0 group-hover/node:opacity-100 transition-all z-20 pointer-events-none shadow-2xl">
                   <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">{region.name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${viewMode === 'style' ? 'bg-violet-500/20 text-violet-400' : viewMode === 'evolution' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{region.growth}</span>
                   </div>

                   {viewMode === 'revenue' && (
                     <div className="space-y-2">
                        <div className="flex justify-between text-[9px]">
                           <span className="text-slate-500 uppercase font-black">Settled:</span>
                           <span className="text-white font-mono">${region.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-[9px]">
                           <span className="text-slate-500 uppercase font-black">Creators:</span>
                           <span className="text-white font-mono">{region.creators}</span>
                        </div>
                     </div>
                   )}

                   {viewMode === 'style' && (
                     <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                           <span className="text-[8px] font-black text-slate-500 uppercase">Top Style DNA:</span>
                           <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-white uppercase italic">{region.styleDNA.topStyle}</span>
                              <span className="text-[10px] font-mono text-violet-400">{region.styleDNA.matchScore}%</span>
                           </div>
                        </div>
                     </div>
                   )}

                   {viewMode === 'evolution' && (
                     <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                           <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-2">
                             <Zap className="w-2 h-2 text-indigo-400 fill-current" />
                             Evolution Velocity:
                           </span>
                           <div className="flex items-center justify-between">
                              <span className="text-[14px] font-black text-white italic">{region.evolutionVelocity}v</span>
                              <span className={`text-[8px] font-black uppercase ${region.evolutionVelocity > 80 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                                {region.evolutionVelocity > 80 ? 'Hyper-Evolving' : 'Stable Mutation'}
                              </span>
                           </div>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                           <motion.div
                             initial={{ width: 0 }}
                             animate={{ width: `${region.evolutionVelocity}%` }}
                             className="h-full bg-indigo-500"
                           />
                        </div>

                        {evolutionForecast.find(f => f.regionId === region.id) && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2"
                          >
                             <div className="flex items-center gap-2">
                                <Cpu className="w-3 h-3 text-indigo-400 animate-pulse" />
                                <span className="text-[7px] font-black text-white uppercase tracking-widest">Predictive Surge Forecast</span>
                             </div>
                             <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                   <span className="text-[12px] font-black text-indigo-400 italic">{evolutionForecast.find(f => f.regionId === region.id).probability} Probability</span>
                                   <span className="text-[7px] text-slate-500 uppercase font-black">Next Shift Imminent</span>
                                </div>
                                <div className="text-right">
                                   <span className="text-[9px] font-black text-white uppercase tracking-tighter">T-Minus {evolutionForecast.find(f => f.regionId === region.id).timeToSurge}</span>
                                </div>
                             </div>
                          </motion.div>
                        )}
                     </div>
                   )}
                </div>
             </motion.div>
           ))}

           {/* Connecting Lines Overlay */}
           <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
              <motion.path
                d="M200,150 Q485,145 480,140"
                fill="none"
                stroke={viewMode === 'style' ? '#8b5cf6' : viewMode === 'evolution' ? '#6366f1' : '#10b981'}
                strokeWidth="0.5"
                strokeDasharray="4 4"
                animate={{ strokeDashoffset: [0, -20] }}
                transition={{ duration: viewMode === 'evolution' ? 1 : 2, repeat: Infinity, ease: 'linear' }}
              />
           </svg>
        </div>

        {/* Sidebar Rank/Stats */}
        <div className="col-span-4 flex flex-col gap-6">
           <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[3rem] p-8 flex flex-col gap-6 overflow-hidden">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                {viewMode === 'revenue' ? 'Region Performance' : viewMode === 'style' ? 'Demographic DNA' : 'Evolution Velocity Rank'}
              </h3>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                 {regions
                   .sort((a, b) => {
                     if (viewMode === 'revenue') return b.revenue - a.revenue;
                     if (viewMode === 'style') return b.styleDNA.matchScore - a.styleDNA.matchScore;
                     return b.evolutionVelocity - a.evolutionVelocity;
                   })
                   .map((region, i) => (
                   <div key={region.id} className="p-5 rounded-[2rem] bg-white/5 border border-white/5 flex items-center gap-5 group hover:bg-white/10 transition-all">
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-black italic transition-colors ${
                        viewMode === 'style' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                        viewMode === 'evolution' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        0{i+1}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between mb-1">
                            <span className="text-[11px] font-black text-white uppercase tracking-tight">{region.name}</span>
                            <span className={`text-[10px] font-black uppercase ${
                              viewMode === 'style' ? 'text-violet-400 italic' :
                              viewMode === 'evolution' ? 'text-indigo-400' :
                              'text-emerald-400'
                            }`}>
                               {viewMode === 'revenue' ? region.growth : viewMode === 'style' ? region.styleDNA.topStyle : `${region.evolutionVelocity}v`}
                            </span>
                         </div>
                         <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                 width: viewMode === 'revenue' ? `${(region.revenue / 200000) * 100}%` :
                                        viewMode === 'style' ? `${region.styleDNA.matchScore}%` :
                                        `${region.evolutionVelocity}%`,
                                 backgroundColor: viewMode === 'style' ? region.styleDNA.color :
                                                  viewMode === 'evolution' ? '#818cf8' :
                                                  '#10b981'
                              }}
                              className="h-full opacity-60"
                            />
                         </div>
                      </div>
                   </div>
                 ))}
              </div>

              <div className={`p-6 rounded-[2.5rem] border ${
                viewMode === 'style' ? 'bg-violet-600/10 border-violet-500/20' :
                viewMode === 'evolution' ? 'bg-indigo-600/10 border-indigo-500/20' :
                'bg-emerald-600/10 border-emerald-500/20'
              }`}>
                 <div className="flex items-center gap-3 mb-3">
                    {viewMode === 'style' ? <Fingerprint className="w-4 h-4 text-violet-400" /> :
                     viewMode === 'evolution' ? <Zap className="w-4 h-4 text-indigo-400" /> :
                     <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                      {viewMode === 'style' ? 'Stylistic Signal DNA' :
                       viewMode === 'evolution' ? 'Neural Adaptation Insights' :
                       'Emerging Markets Signal'}
                    </span>
                 </div>
                 <p className="text-[9px] text-slate-400 leading-relaxed italic">
                   {viewMode === 'style'
                     ? "Visual synthesis weights are shifting toward 'Cyberpunk Glitch' in APAC. Neural preference scores for high-saturation neon exceed sector medians by 40%."
                     : viewMode === 'evolution'
                     ? "APAC node is hyper-evolving due to recursive feedback loops from high-intent community distributions. Style-DNA mutations are occurring every 4.2h."
                     : "Neural ingestion indicates a +45% surge in high-intent signals from the APAC node. Suggesting automated content parity for SE Asia demographics."}
                 </p>
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

export default CreatorPayoutMap
