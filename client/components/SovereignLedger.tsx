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
  Lock,
  TrendingUp
} from 'lucide-react'
import axios from 'axios'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()
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
      <div className="flex flex-col items-center justify-center p-20 min-h-[400px]">
        <Activity className="text-primary-500 animate-spin mb-6" size={48} />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic animate-pulse">{t('sovereignLedger.syncingNodes')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 lg:space-y-12">
      {/* Ledger Header Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-black/40 border-2 border-white/5 rounded-[2.5rem] p-6 backdrop-blur-3xl shadow-2xl group hover:border-emerald-500/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={16} className={state?.isValid ? 'text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-rose-400'} />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{t('sovereignLedger.integrity')}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white flex items-center gap-3">
            {state?.isValid ? t('sovereignLedger.secure') : t('sovereignLedger.fail')}
            {state?.isValid && <CheckCircle2 size={20} className="text-emerald-400" />}
          </div>
        </div>

        <div className="bg-black/40 border-2 border-white/5 rounded-[2.5rem] p-6 backdrop-blur-3xl shadow-2xl group hover:border-primary-500/20 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <Database size={16} className="text-primary-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{t('sovereignLedger.chainHeight')}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">
            {state?.height} <span className="text-[12px] text-primary-400">{t('sovereignLedger.nodes')}</span>
          </div>
        </div>

        <div className="bg-black/40 border-2 border-white/5 rounded-[2.5rem] p-6 backdrop-blur-3xl shadow-2xl md:col-span-2 group hover:border-primary-500/20 transition-all overflow-hidden relative">
          <div className="flex items-center gap-3 mb-4">
            <Lock size={16} className="text-primary-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">{t('sovereignLedger.lastHashSig')}</span>
          </div>
          <div className="text-sm sm:text-lg font-mono font-bold text-primary-300 truncate leading-none mt-2">
            {state?.lastHash}
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 gap-4">
          <label className="text-[12px] font-black text-slate-500 uppercase tracking-[0.5em] sm:tracking-[0.8em] italic flex items-center gap-4">
            <Fingerprint size={18} className="text-primary-400" /> {t('sovereignLedger.auditTrail')}
          </label>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary-500/5 border border-primary-500/20">
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <span className="text-[9px] font-black text-primary-400 uppercase tracking-widest italic">{t('sovereignLedger.liveSync')}</span>
          </div>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <AnimatePresence mode='popLayout'>
            {blocks.map((block, i) => (
              <motion.div
                key={block.hash}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-black/40 backdrop-blur-3xl border-2 border-white/5 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 cursor-pointer group transition-all hover:bg-black/60 hover:border-primary-500/20 ${expandedBlock === block.index ? 'border-primary-500/30 ring-1 ring-primary-500/20 shadow-[0_40px_100px_rgba(0,0,0,0.4)]' : 'shadow-xl'}`}
                onClick={() => setExpandedBlock(expandedBlock === block.index ? null : block.index)}
              >
                <div className="flex items-center justify-between gap-4 sm:gap-6">
                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-primary-500/10 flex items-center justify-center border-2 border-primary-500/20 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                      <Zap size={24} className={(block.data?.type || '').includes('SYNTHESIS') ? 'text-primary-400' : 'text-slate-500'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest italic">#{block.index}</span>
                        <span className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter italic truncate">{block.data?.type || t('sovereignLedger.unknownNode')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={12} className="text-slate-600" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight italic">
                          {t('sovereignLedger.agentLine', { time: new Date(block.timestamp).toLocaleTimeString(), agent: block.data?.agent || 'SOVEREIGN' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden xl:flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                         <LinkIcon size={12} className="text-slate-700" />
                         <span className="text-[10px] font-mono text-slate-600">{formatHash(block.hash)}</span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-500/60 uppercase italic tracking-widest">{block.signature}</span>
                    </div>
                    <ChevronRight size={24} className={`text-slate-700 transition-all duration-500 ${expandedBlock === block.index ? 'rotate-90 text-primary-400' : 'group-hover:translate-x-1'}`} />
                  </div>
                </div>

                {/* Expanded Data Block */}
                {expandedBlock === block.index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-8 pt-8 border-t-2 border-white/5 space-y-8"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <Activity size={14} className="text-primary-400" />
                          <h5 className="text-[10px] font-black text-primary-400 uppercase tracking-widest italic leading-none">{t('sovereignLedger.decisionMatrixPayload')}</h5>
                        </div>
                        <pre className="bg-black/60 rounded-[1.5rem] p-6 text-[11px] font-mono text-primary-200 overflow-x-auto border-2 border-white/5 shadow-inner custom-scrollbar">
                          {JSON.stringify(block.data?.decision || {}, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <TrendingUp size={14} className="text-emerald-400" />
                          <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic leading-none">{t('sovereignLedger.fiscalDeltaInference')}</h5>
                        </div>
                        <div className="bg-emerald-500/5 rounded-[2rem] p-8 border-2 border-emerald-500/10 relative overflow-hidden group/fiscal shadow-xl">
                          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover/fiscal:opacity-[0.08] transition-opacity duration-1000"><Zap size={120} className="text-white" /></div>
                          <div className="flex justify-between items-center mb-6 relative z-10">
                            <span className="text-[11px] font-black text-slate-500 uppercase italic">{t('sovereignLedger.revenueImpact')}</span>
                            <span className="text-3xl font-black text-emerald-400 italic tracking-tighter">
                              +${block.data.fiscal?.revenueImpact?.toLocaleString() || '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center relative z-10">
                            <span className="text-[11px] font-black text-slate-500 uppercase italic">{t('sovereignLedger.payoutHash')}</span>
                            <span className="text-[11px] font-mono text-slate-400 tracking-tighter opacity-60">{block.data.fiscal?.payoutId || t('sovereignLedger.pendingHash')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white/5 border-2 border-white/5 group-hover:border-emerald-500/20 transition-colors">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t('sovereignLedger.inferenceVerified')}</span>
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
