'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Shield, 
  Zap, 
  TrendingUp, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Gavel,
  Scale
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface AgentVote {
  agent: string
  vote: 'APPROVE' | 'REJECT'
  justification: string
  riskScore: number
}

interface ConsensusResult {
  consensus: boolean
  executionStatus: 'PENDING' | 'AUTONOMOUS_LOCKED' | 'AWAITING_HUMAN_OVERRIDE' | 'REJECTED'
  isBudgetImpacting: boolean
  approvals: number
  votes: AgentVote[]
  justification: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const SyndicateConsensusView: React.FC = () => {
    const [result, setResult] = useState<ConsensusResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [proposal, setProposal] = useState({
        type: 'content_pivot',
        title: 'Pivot to Aggressive 15s Hook Format',
        description: 'Shift entire fleet output to 15s aggressive hooks based on high-velocity signals from the Viralist agent.',
        budgetDelta: 0
    })

    const triggerConsensus = async () => {
        setLoading(true)
        try {
            const data = await apiPost('/click/syndicate-consensus', { proposal })
            setResult(data)
        } catch (err) {
            console.error('Consensus trigger failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-violet-500 text-white shadow-xl shadow-violet-500/20">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Syndicate Council</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-violet-500/70">Multi-Agent Strategic Synthesis</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={triggerConsensus}
                        disabled={loading}
                        className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-2xl transition-all ${
                            loading ? 'bg-slate-800 text-slate-600' : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}
                    >
                        {loading ? 'SYNTHESIZING DEBATE...' : 'INITIATE COUNCIL DEBATE'}
                    </button>
                </div>
            </div>

            {/* Proposal & Consensus Status */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left: Proposal Data */}
                <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8 flex flex-col`}>
                    <div className="flex items-center justify-between">
                        <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Draft Proposal</h5>
                        <Gavel className="w-5 h-5 text-violet-400" />
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest leading-none block">Objective</span>
                            <h6 className="text-sm font-black text-white italic uppercase leading-tight tracking-tight">{proposal.title}</h6>
                            <p className="text-[11px] text-slate-400 font-bold leading-relaxed italic">{proposal.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Impact Class</span>
                                <div className="flex items-center gap-2">
                                    <Scale className="w-3 h-3 text-white" />
                                    <span className="text-[10px] font-black text-white uppercase italic">Strategic</span>
                                </div>
                            </div>
                            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-2">Budget Delta</span>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                    <span className="text-[10px] font-black text-white uppercase italic">${proposal.budgetDelta}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-violet-600/10 border border-violet-500/20 rounded-3xl space-y-2">
                        <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Syndicate Tip</span>
                        <p className="text-[10px] text-white font-bold italic leading-tight">
                            Consensus requires a 3/4 supermajority from the specialize personas.
                        </p>
                    </div>
                </div>

                {/* Center: Agent Debate */}
                <div className="xl:col-span-2 flex flex-col gap-8">
                    {!result && !loading ? (
                         <div className={`${glassStyle} rounded-[2.5rem] flex-1 flex flex-col items-center justify-center space-y-6 italic opacity-20`}>
                            <Users className="w-16 h-16" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Debate Initiation</span>
                         </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {(result?.votes || [1,2,3,4]).map((vote, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`${glassStyle} rounded-[2rem] p-6 space-y-5 relative overflow-hidden group`}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-xl bg-white/5 text-slate-400">
                                                {typeof vote === 'object' ? (
                                                    vote.vote === 'APPROVE' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />
                                                ) : <MessageSquare className="w-4 h-4 animate-pulse" />}
                                            </div>
                                            <h6 className="text-[11px] font-black text-white uppercase tracking-widest italic leading-none">
                                                {typeof vote === 'object' ? vote.agent : 'Synthesizing...'}
                                            </h6>
                                        </div>
                                        {typeof vote === 'object' && (
                                            <span className={`text-[9px] font-black uppercase italic ${vote.vote === 'APPROVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {vote.vote}
                                            </span>
                                        )}
                                    </div>

                                    <div className="relative z-10">
                                        {typeof vote === 'object' ? (
                                            <p className="text-[10px] font-bold text-slate-400 italic leading-snug">"{vote.justification}"</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        animate={{ x: ['100%', '-100%'] }}
                                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                                        className="h-full w-1/2 bg-violet-500/50"
                                                    />
                                                </div>
                                                <div className="h-2 w-2/3 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        animate={{ x: ['100%', '-100%'] }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                        className="h-full w-1/2 bg-violet-500/30"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="absolute bottom-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                                        <Shield className="w-16 h-16" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Final Status */}
                    <AnimatePresence>
                        {result && (
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className={`p-8 rounded-[2rem] border relative overflow-hidden ${
                                    result.consensus ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'
                                }`}
                            >
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-6">
                                        <div className={`p-5 rounded-2xl ${result.consensus ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white shadow-xl shadow-rose-500/20'}`}>
                                            {result.consensus ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                {result.consensus ? 'Consensus High-Resonance' : 'Diffraction Detected'}
                                            </h5>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 block italic">
                                                {result.executionStatus.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {result.isBudgetImpacting ? (
                                            <div className="px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
                                                <Lock className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest italic">User Override Required</span>
                                            </div>
                                        ) : (
                                            <div className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
                                                <Zap className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest italic">Autonomous Locking</span>
                                            </div>
                                        )}
                                        <button className="p-4 rounded-xl bg-white/5 border border-white/5 text-white hover:bg-white/10">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </div>
    )
}
