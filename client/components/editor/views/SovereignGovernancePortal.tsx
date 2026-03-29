'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  X,
  Check,
  Lock,
  AlertTriangle,
  Gavel,
  TrendingUp,
  UserCheck,
  Fingerprint
} from 'lucide-react'

interface GovernanceProposal {
  id: string;
  blockHash: string;
  agent: string;
  type: string;
  decision: any;
  fiscalImpact: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
}

interface SovereignGovernancePortalProps {
  proposals: GovernanceProposal[];
  onVote: (id: string, approved: boolean, preferredCurrency?: string) => void;
  onClose: () => void;
}

const SovereignGovernancePortal: React.FC<SovereignGovernancePortalProps> = ({
  proposals,
  onVote,
  onClose
}) => {
  const [selectedCurrency, setSelectedCurrency] = React.useState('USD')
  const currencies = ['USD', 'ETH', 'SOL', 'BTC']
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 z-50 bg-black/90 backdrop-blur-3xl flex flex-col p-12 overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <svg width="100%" height="100%">
          <pattern id="gov-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#gov-grid)" />
        </svg>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-12 relative z-10">
        <div className="flex items-center gap-6">
          <div className="p-4 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-[0.3em] italic text-white">Sovereign Governance</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mt-1 italic">
              User-In-The-Loop Validation // Decision Consensus
            </p>
          </div>
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10 ml-8">
            {currencies.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCurrency(c)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${selectedCurrency === c ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:text-white'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close Governance Portal"
          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0 relative z-10">

        {/* Proposals List */}
        <div className="col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-4">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 px-2">Pending Consensus ({proposals.filter(p => p.status === 'pending').length})</h3>

          <AnimatePresence mode="popLayout">
            {proposals.length > 0 ? proposals.map((proposal) => (
              <motion.div
                key={proposal.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="group p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Fingerprint className="w-24 h-24 text-white" />
                </div>

                <div className="flex items-start gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400">
                      <Gavel className="w-6 h-6" />
                    </div>
                    <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">ID: {proposal.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{proposal.agent}</span>
                       <span className="text-[10px] text-slate-600 font-black italic">PROPOSES: {proposal.type}</span>
                    </div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tight mb-4 leading-tight italic">
                      "{proposal.decision.highLevelStrategy || 'Adjusting content velocity to maximize Gen-Z retention peaks.'}"
                    </h4>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Est. Revenue: +${proposal.fiscalImpact.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-mono uppercase tracking-tighter">Block: {proposal.blockHash.slice(0, 12)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => onVote(proposal.id, true, selectedCurrency)}
                      className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 shadow-xl shadow-emerald-900/20 transition-all"
                      title="Approve Decision"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => onVote(proposal.id, false, selectedCurrency)}
                      className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                      title="Reject/Override Decision"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-600 opacity-40 uppercase tracking-[0.2em] italic">
                <ShieldCheck className="w-12 h-12" />
                <p className="text-sm font-black">Consensus Reached // All Blocks Validated</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar: Governance Integrity */}
        <div className="col-span-4 flex flex-col gap-6">
           <div className="p-8 rounded-[3rem] bg-emerald-500/5 border border-emerald-500/10 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                 <UserCheck className="w-5 h-5 text-emerald-400" />
                 <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Operator Integrity</h3>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consensus Weight</span>
                    <span className="text-2xl font-black text-white italic">1.0X</span>
                 </div>
                 <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                 </div>
                 <p className="text-[9px] text-slate-500 leading-relaxed italic border-t border-white/5 pt-4">
                   Your authority is absolute. No autonomous decision can impact the fiscal bridge without operator sign-off.
                 </p>
              </div>
           </div>

           <div className="p-8 rounded-[3rem] bg-red-500/5 border border-red-500/10 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                 <AlertTriangle className="w-4 h-4 text-red-500" />
                 <h3 className="text-[11px] font-black text-red-500 uppercase tracking-widest">Security Warning</h3>
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                Rejecting a strategy block will trigger a <span className="text-white">Neural Rollback</span> of specialized agent weights.
              </p>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SovereignGovernancePortal
