'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, ShieldCheck, Cpu, Fingerprint, BarChart3, Database, Workflow, Signal } from 'lucide-react'

interface ConsensusBlock {
  _id: string;
  contentId: string;
  refineryPass: number;
  integrityScore: number;
  status: 'refining' | 'stable' | 'rejected';
  swarmFeedback: string;
  timestamp: string;
  userId?: { name: string };
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

export default function SwarmConsensusFlux() {
  const [blocks, setBlocks] = useState<ConsensusBlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFlux() {
      try {
        const res = await fetch('/api/sovereign/swarm/flux')
        if (res.ok) {
          const data = await res.json()
          setBlocks(data.slice(0, 5))
        }
      } catch (err) {
        console.error('Failed to fetch Swarm Flux', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFlux()
    const interval = setInterval(fetchFlux, 5000) // Poll every 5s for the "live" feel
    return () => clearInterval(interval)
  }, [])

  if (loading && blocks.length === 0) {
    return (
      <div className={`${glassStyle} rounded-[3rem] p-12 min-h-[300px] flex items-center justify-center`}>
        <Cpu className="text-indigo-400 animate-spin w-12 h-12 opacity-40" />
      </div>
    )
  }

  return (
    <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden group`}>
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-[2s] pointer-events-none group-hover:rotate-45 group-hover:scale-125">
        <Workflow className="text-indigo-400" size={150} />
      </div>
      
      <div className="flex items-center justify-between mb-10 px-2">
         <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-all duration-700 animate-pulse">
               <Database className="text-indigo-400" size={28} />
            </div>
            <div>
               <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Consensus Flux</h2>
               <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none border-l-2 border-indigo-500/20 pl-4 ml-1">Live Refinery Ledger // 2026.4_SOVEREIGN</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <Signal size={12} className="text-emerald-400 animate-ping" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">Lattice_Sync</span>
         </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {blocks.map((block) => (
            <motion.div 
              key={block._id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className={`p-6 rounded-[2rem] bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all duration-700 group/item flex items-center justify-between shadow-xl relative overflow-hidden`}
            >
              <div className="flex items-center gap-6 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/10 shadow-inner ${
                  block.integrityScore > 90 ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                }`}>
                  <Fingerprint size={20} className={block.integrityScore > 90 ? 'text-emerald-400' : 'text-amber-400'} />
                </div>
                <div>
                   <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">PASS_{block.refineryPass}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">ID: {block.contentId.substring(0, 8)}...</span>
                   </div>
                   <p className="text-[12px] font-black text-white uppercase tracking-wider italic leading-none opacity-80 group-hover/item:opacity-100 transition-opacity">
                     {block.swarmFeedback === 'Initial refinery pass' ? 'SYNTHESIS_REFINED' : 'ADAPTIVE_PULSE_CORRECTION'}
                   </p>
                </div>
              </div>

              <div className="text-right relative z-10">
                 <div className="flex items-center justify-end gap-3 mb-1">
                    <BarChart3 size={12} className="text-indigo-400 opacity-40" />
                    <span className="text-[14px] font-black text-white italic tabular-nums tracking-tighter leading-none">
                      {block.integrityScore}%
                    </span>
                 </div>
                 <p className={`text-[8px] font-black uppercase tracking-widest italic leading-none ${
                   block.status === 'stable' ? 'text-emerald-400' : 'text-amber-400'
                 }`}>
                   {block.status.toUpperCase()}
                 </p>
              </div>

              {/* Decorative block scan effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/[0.03] to-transparent -translate-x-full group-hover/item:animate-shimmer pointer-events-none" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
         <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Chain_Link Integrity Verified</p>
         <button className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic hover:underline">VIEW_FULL_LEDGER</button>
      </div>
    </div>
  )
}
