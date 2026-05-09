'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Database, 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Activity,
  ChevronRight,
  Link as LinkIcon,
  Zap,
  Lock
} from 'lucide-react'
import axios from 'axios'

interface LedgerBlock {
  index: number
  timestamp: number
  previousHash: string
  hash: string
  signature: string
  data: {
    type: string
    agent: string
    decision: any
    fiscal?: {
      revenueImpact: number
      payoutStatus: string
      payoutId: string
    }
  }
}

interface LedgerState {
  height: number
  lastHash: string
  isValid: boolean
  transactions: number
}

export const SovereignLedger: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([])
  const [state, setState] = useState<LedgerState | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)

  useEffect(() => {
    fetchLedger()
    const interval = setInterval(fetchLedger, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

  const fetchLedger = async () => {
    try {
      const response = await axios.get('/api/sovereign/ledger')
      if (response.data.success) {
        setBlocks(response.data.data.audits)
        setState(response.data.data.state)
      }
    } catch (error) {
      console.error('Failed to fetch ledger:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatHash = (hash: string) => `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center p-20">
        <Activity className="text-indigo-500 animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Ledger Header Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-indigo-500/5 border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-2">
            <Shield size={16} className={state?.isValid ? 'text-emerald-400' : 'text-rose-400'} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Integrity_Status</span>
          </div>
          <div className="text-2xl font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
            {state?.isValid ? 'SECURE' : 'COMPROMISED'}
            {state?.isValid && <CheckCircle2 size={20} className="text-emerald-400" />}
          </div>
        </div>

        <div className="bg-indigo-500/5 border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-2">
            <Database size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Chain_Height</span>
          </div>
          <div className="text-2xl font-black italic uppercase tracking-tighter text-white">
            {state?.height} <span className="text-[12px] text-indigo-400">BLOCKS</span>
          </div>
        </div>

        <div className="bg-indigo-500/5 border border-white/5 rounded-3xl p-6 backdrop-blur-xl md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <Lock size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Last_Hash_Fragment</span>
          </div>
          <div className="text-lg font-mono font-bold text-indigo-300 break-all leading-none mt-2">
            {state?.lastHash}
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <label className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic flex items-center gap-4">
            <Fingerprint size={18} className="text-indigo-400" /> DECISION_AUDIT_TRAIL
          </label>
          <span className="text-[10px] font-bold text-indigo-400 uppercase italic tracking-widest animate-pulse">Live_Sync_Enabled</span>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode='popLayout'>
            {blocks.map((block, i) => (
              <motion.div
                key={block.hash}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-black/40 border border-white/5 rounded-[2.5rem] p-6 lg:p-8 cursor-pointer group transition-all hover:bg-black/60 ${expandedBlock === block.index ? 'border-indigo-500/30 ring-1 ring-indigo-500/20' : ''}`}
                onClick={() => setExpandedBlock(expandedBlock === block.index ? null : block.index)}
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Zap size={20} className={(block.data?.type || '').includes('SYNTHESIS') ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">#{block.index}</span>
                        <span className="text-[11px] font-black text-white uppercase tracking-tighter italic">{block.data?.type || 'UNKNOWN_ACTION'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={10} className="text-slate-600" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                          {new Date(block.timestamp).toLocaleTimeString()} // AGENT: {block.data?.agent || 'SOVEREIGN_NODE'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                       <LinkIcon size={12} className="text-slate-700" />
                       <span className="text-[10px] font-mono text-slate-600">{formatHash(block.hash)}</span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-500/60 uppercase italic tracking-widest">{block.signature}</span>
                  </div>

                  <ChevronRight size={20} className={`text-slate-700 transition-transform ${expandedBlock === block.index ? 'rotate-90 text-indigo-400' : ''}`} />
                </div>

                {/* Expanded Data Block */}
                {expandedBlock === block.index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-8 pt-8 border-t border-white/5 space-y-6"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">Decision_Metadata</h5>
                        <pre className="bg-black/50 rounded-2xl p-4 text-[11px] font-mono text-indigo-200 overflow-x-auto border border-white/5">
                          {JSON.stringify(block.data?.decision || {}, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic">Fiscal_Impact</h5>
                        <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/10">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Revenue Impact</span>
                            <span className="text-lg font-black text-emerald-400">+${block.data.fiscal?.revenueImpact || '0.00'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Payout Hash</span>
                            <span className="text-[10px] font-mono text-slate-400">{block.data.fiscal?.payoutId}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Decision cryptographically verified</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
