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
      className="absolute inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col p-6 sm:p-12 overflow-hidden"
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <pattern id="gov-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#gov-grid)" />
        </svg>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between mb-10 sm:mb-12 relative z-10 gap-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="p-4 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-[0.3em] italic text-white leading-none">Governance</h2>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mt-2 italic">
              User-In-The-Loop Validation // Consensus Matrix
            </p>
          </div>
          <div className="flex bg-white/5 rounded-2xl p-1 border-2 border-white/10 ml-0 sm:ml-8 shadow-inner">
            {currencies.map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setSelectedCurrency(c)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${selectedCurrency === c ? 'bg-emerald-500 text-black shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close Governance Portal"
          className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all absolute top-0 right-0 sm:static"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 relative z-10 overflow-hidden">

        {/* Proposals List */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-0 sm:pr-4">
          <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-2 px-2 italic">Pending Consensus ({proposals.filter(p => p.status === 'pending').length})</h3>

          <AnimatePresence mode="popLayout">
            {proposals.length > 0 ? proposals.map((proposal) => (
              <motion.div
                key={proposal.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="group p-6 sm:p-10 rounded-[3rem] bg-white/[0.02] backdrop-blur-3xl border-2 border-white/5 hover:border-emerald-500/30 transition-all duration-700 relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000">
                   <Fingerprint className="w-24 h-24 text-white" />
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-10">
                  <div className="flex flex-row sm:flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-black/40 border-2 border-white/10 flex items-center justify-center text-emerald-400 shadow-xl group-hover:rotate-12 transition-transform duration-700">
                      <Gavel className="w-6 h-6" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter italic">ID_{proposal.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">{proposal.agent}</span>
                       <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                       <span className="text-[10px] text-slate-500 font-black italic uppercase tracking-widest">Type: {proposal.type}</span>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-6 leading-tight italic group-hover:text-emerald-400 transition-colors duration-500">
                      &ldquo;{proposal.decision.highLevelStrategy || 'Optimizing latent resonance for maximum engagement velocity.'}&rdquo;
                    </h4>

                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-400 shadow-inner">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Est_Fiscal: +${proposal.fiscalImpact.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-60">Block_{proposal.blockHash.slice(0, 12)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-4 w-full sm:w-auto mt-6 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => onVote(proposal.id, true, selectedCurrency)}
                      className="flex-1 sm:w-16 sm:h-16 rounded-[1.5rem] bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 shadow-2xl shadow-emerald-900/20 transition-all active:scale-90 border-none group/vote"
                      title="Approve Decision"
                    >
                      <Check className="w-8 h-8 group-hover/vote:scale-125 transition-transform" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onVote(proposal.id, false, selectedCurrency)}
                      className="flex-1 sm:w-16 sm:h-16 rounded-[1.5rem] bg-rose-600/10 border-2 border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90 group/reject"
                      title="Reject/Override Decision"
                    >
                      <X className="w-8 h-8 group-hover/reject:rotate-90 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="py-48 flex flex-col items-center justify-center gap-8 text-slate-700 opacity-40 uppercase tracking-[0.5em] italic">
                <ShieldCheck className="w-20 h-20 animate-pulse" />
                <p className="text-xl font-black">Consensus_Verified // All_Nodes_Secure</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar: Governance Integrity */}
        <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="p-8 sm:p-10 rounded-[3rem] bg-emerald-500/5 border-2 border-emerald-500/10 flex flex-col gap-8 shadow-xl">
              <div className="flex items-center gap-4">
                 <UserCheck className="w-5 h-5 text-emerald-400" />
                 <h3 className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic leading-none">Operator_Authority</h3>
              </div>

              <div className="space-y-6">
                 <div className="flex justify-between items-end mb-2">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Consensus Weight</span>
                    <span className="text-3xl font-black text-emerald-400 italic tracking-tighter">1.0X</span>
                 </div>
                 <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                    <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                 </div>
                 <p className="text-[10px] text-slate-500 leading-relaxed italic border-t-2 border-white/5 pt-6 uppercase tracking-wider">
                   Your authority is absolute. No autonomous decision can impact the fiscal bridge without operator sign-off.
                 </p>
              </div>
           </div>

           <div className="p-8 sm:p-10 rounded-[3rem] bg-rose-500/5 border-2 border-rose-500/10 flex flex-col gap-6 shadow-xl group hover:bg-rose-500/10 transition-colors duration-700">
              <div className="flex items-center gap-4">
                 <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                 <h3 className="text-[11px] font-black text-rose-500 uppercase tracking-[0.4em] italic leading-none">Security_Protocol</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em] leading-relaxed italic">
                Rejecting a strategy block will trigger a <span className="text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]">Neural Rollback</span> of specialized agent weights. Proceed with caution.
              </p>
           </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SovereignGovernancePortal
