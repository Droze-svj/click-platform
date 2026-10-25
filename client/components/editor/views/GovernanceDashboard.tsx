'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Terminal,
  Search,
  Hash,
  Info,
  Clock,
  Fingerprint,
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiGet, handleApiError } from '../../../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface GovernanceAction {
  _id: string
  actionType: string
  resourceId: string
  resourceType: string
  justification: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: {
    decisionHash: string
    immutableAnchor: boolean
    [key: string]: any
  }
  timestamp: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const GovernanceDashboard: React.FC = () => {
    const { t } = useTranslation()
    const [actions, setActions] = useState<GovernanceAction[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        fetchLedger()
    }, [])

    const fetchLedger = async () => {
        try {
            // GET /click/ledger answers a bare GovernanceAction[] for this user.
            // (/sovereign/ledger is a different {audits, state} payload.)
            const res: any = await apiGet('/click/ledger', undefined, false)
            const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
            setActions(list)
            setLoadError('')
        } catch (err) {
            setActions([])
            setLoadError(handleApiError(err) || t('governanceDashboard.loadFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Audit log</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-emerald-500/70">Actions taken by automations, with the reason for each</span>
                    </div>
                </div>

            </div>

            {/* Decision Log */}
            <div className={`${glassStyle} rounded-[2.5rem] overflow-hidden`}>
                <div className="p-8 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Terminal className="w-5 h-5 text-emerald-400" />
                        <h5 className="text-sm font-black text-white uppercase tracking-widest italic">Recent actions</h5>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Time</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Action</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Reason</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest italic text-center">Severity</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Decision hash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                [1,2,3].map(n => (
                                    <tr key={n} className="animate-pulse">
                                        <td colSpan={6} className="p-12"><div className="h-4 bg-white/5 rounded-full" /></td>
                                    </tr>
                                ))
                            ) : actions.map((action, i) => (
                                <m.tr 
                                    key={action._id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="hover:bg-white/[0.02] transition-colors group"
                                >
                                    <td className="p-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-black text-white uppercase italic">
                                                {new Date(action.timestamp).toLocaleTimeString()}
                                            </span>
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                {new Date(action.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[10px] font-black text-white uppercase italic tracking-tight">{action.actionType}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-[10px] font-bold text-slate-400 italic max-w-sm line-clamp-2">
                                            {action.justification}
                                        </p>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                                            action.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                            action.severity === 'high' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                            'bg-white/5 border-white/10 text-slate-400'
                                        }`}>
                                            {action.severity}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3 group-hover:text-emerald-400 transition-colors">
                                            <Hash className="w-3 h-3 opacity-40" />
                                            <code className="text-[9px] font-mono text-slate-500 group-hover:text-emerald-400/80">
                                                {action.metadata?.decisionHash?.substring(0, 16)}...
                                            </code>
                                        </div>
                                    </td>
                                </m.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && loadError && (
                    <div className="p-6 text-sm text-rose-400">{t('governanceDashboard.loadFailed')} {loadError}</div>
                )}

                {!loading && !loadError && actions.length === 0 && (
                    <div className="p-24 flex flex-col items-center justify-center text-center space-y-4 opacity-30 italic">
                        <Fingerprint className="w-16 h-16" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">No actions recorded yet</span>
                    </div>
                )}
            </div>

            {/* Bottom Insight */}
            <div className="grid grid-cols-1 gap-8">
                <div className={`${glassStyle} rounded-[2rem] p-6 flex items-center gap-5`}>
                     <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                         <Search className="w-5 h-5" />
                     </div>
                     <div>
                         <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total actions</span>
                         <h6 className="text-[10px] font-black text-white uppercase italic">{actions.length} logged</h6>
                     </div>
                </div>
            </div>
        </div>
    )
}
