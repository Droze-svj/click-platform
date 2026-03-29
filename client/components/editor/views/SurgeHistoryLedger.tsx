'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Rocket, TrendingUp, History, ShieldCheck, Zap } from 'lucide-react'

interface LedgerEntry {
  id: string;
  regionId: string;
  previousStyle: string;
  newStyle: string;
  probability: string;
  timestamp: number;
  confidence: number;
  predictedROI: string;
  status: string;
}

interface SurgeHistoryLedgerProps {
  entries: LedgerEntry[];
  onClose: () => void;
}

const SurgeHistoryLedger: React.FC<SurgeHistoryLedgerProps> = ({ entries, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col gap-6 h-full bg-black/40 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-8 overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-amber-500/5 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black uppercase tracking-[0.2em] italic text-white flex items-center gap-3">
            <History className="w-6 h-6 text-indigo-400" />
            Surge History Ledger
          </h2>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none">
            Forensic tracking of autonomous Style-DNA shifts & ROI delta
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white"
        >
          Close Ledger
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-6 relative z-10">
         <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Total Shifts</span>
            <span className="text-2xl font-black text-white italic">{entries.length}</span>
         </div>
         <div className="p-6 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 flex flex-col gap-1 shadow-inner">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Avg ROI Lift</span>
            <span className="text-2xl font-black text-emerald-400 italic">
               +{entries.length > 0 ? (entries.reduce((acc, e) => acc + parseFloat(e.predictedROI), 0) / entries.length).toFixed(1) : '0.0'}%
            </span>
         </div>
         <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 flex flex-col gap-1 shadow-inner">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Neural Confidence</span>
            <span className="text-2xl font-black text-amber-500 italic">92.4%</span>
         </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-hidden flex flex-col gap-4 relative z-10">
         <div className="px-6 grid grid-cols-12 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">
            <div className="col-span-2 text-left">Identifier</div>
            <div className="col-span-2 text-left">Region</div>
            <div className="col-span-3 text-left">Style Transition</div>
            <div className="col-span-2 text-left">Probability</div>
            <div className="col-span-2 text-left">ROI Delta</div>
            <div className="col-span-1 text-right">Status</div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {entries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                 <Rocket className="w-12 h-12 text-slate-600" />
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No autonomous surges recorded yet</p>
              </div>
            ) : entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-6 py-5 rounded-3xl bg-white/[0.02] border border-white/5 grid grid-cols-12 items-center hover:bg-white/[0.05] transition-all group"
              >
                 <div className="col-span-2 font-mono text-[11px] text-slate-400">{entry.id}</div>
                 <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-tighter">
                       {entry.regionId.toUpperCase()} Node
                    </span>
                 </div>
                 <div className="col-span-3 flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 line-through truncate max-w-[80px]">{entry.previousStyle}</span>
                    <TrendingUp className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="text-[10px] font-black text-white truncate max-w-[100px]">{entry.newStyle}</span>
                 </div>
                 <div className="col-span-2">
                    <div className="flex items-center gap-2">
                       <Zap className="w-3 h-3 text-amber-400 fill-current" />
                       <span className="text-[11px] font-black text-white">{entry.probability}</span>
                    </div>
                 </div>
                 <div className="col-span-2">
                    <span className="text-[12px] font-black text-emerald-400 italic">+{entry.predictedROI}</span>
                 </div>
                 <div className="col-span-1 text-right">
                    <div className="flex justify-end items-center gap-1">
                       <ShieldCheck className="w-3 h-3 text-indigo-400" />
                       <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Bridged</span>
                    </div>
                 </div>
              </motion.div>
            ))}
         </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 relative z-10 flex items-center justify-between">
         <p className="text-[9px] text-slate-400 leading-relaxed italic max-w-2xl">
           The Surge History Ledger utilizes autonomous ROI validation by cross-referencing regional engagement deltas within 4h of a Style-DNA shift. Confidence scores are derived from recursive demographic alignment weights.
         </p>
         <div className="text-right">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Ledger Accuracy</span>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div animate={{ width: '92%' }} className="h-full bg-gradient-to-r from-emerald-500 to-amber-500" />
               </div>
               <span className="text-[10px] font-black text-white">99%</span>
            </div>
         </div>
      </div>
    </motion.div>
  )
}

export default SurgeHistoryLedger
