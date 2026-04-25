'use client'

import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Scissors, 
  Volume2, 
  Maximize, 
  History,
  Play,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface RemediationAction {
  type: string
  value?: number
  timestamp?: number
}

interface RemediationStatus {
  success: boolean
  status: 'IDLE' | 'SCHEDULED' | 'EVOLVED'
  actionPlan?: RemediationAction[]
  finalUrl?: string
  window?: { start: number, end: number }
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const RemediationHUD: React.FC<{ contentId: string }> = ({ contentId }) => {
    const [status, setStatus] = useState<RemediationStatus | null>(null)
    const [loading, setLoading] = useState(false)
    const [isEvolutionWindow, setIsEvolutionWindow] = useState(false)

    useEffect(() => {
        // Quick check if we are in window
        const hour = new Date().getHours()
        setIsEvolutionWindow(hour >= 2 && hour < 6)
    }, [])

    const triggerRemediation = async () => {
        setLoading(true)
        try {
            const data = await apiPost('/phase16_18/remediation/process', { contentId })
            setStatus(data)
        } catch (err) {
            console.error('Remediation trigger failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-amber-500 text-white shadow-xl shadow-amber-500/20">
                        <RefreshCw className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Autonomous Remediation</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-amber-500/70">Recursive Self-Correction Loop</span>
                    </div>
                </div>

                <div className={`px-6 py-4 rounded-2xl flex items-center gap-4 border transition-all ${
                    isEvolutionWindow 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}>
                    <Clock className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest italic leading-none">
                        Window: {isEvolutionWindow ? 'OPEN (Maintenance)' : 'CLOSED (Scheduled 2AM-6AM)'}
                    </span>
                </div>
            </div>

            {/* Status & Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Proposed Actions */}
                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-8`}>
                    <div className="flex items-center justify-between">
                        <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Action Matrix</h5>
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>

                    <div className="space-y-4">
                        {status?.actionPlan ? (
                            status.actionPlan.map((action, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-5 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="p-3 bg-white/5 rounded-xl">
                                            {action.type === 'ADJUST_VOLUME' && <Volume2 className="w-4 h-4 text-indigo-400" />}
                                            {action.type === 'STABILIZE' && <Zap className="w-4 h-4 text-amber-400" />}
                                            {action.type === 'ENLARGE_TEXT' && <Maximize className="w-4 h-4 text-blue-400" />}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none block mb-1">
                                                {action.type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                VALUE: {action.value ?? 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </motion.div>
                            ))
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center space-y-4 opacity-30 italic">
                                <AlertCircle className="w-8 h-8" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Idle: Awaiting Analysis</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Evolution Trigger */}
                <div className="flex flex-col gap-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 flex-1 flex flex-col items-center justify-center text-center space-y-8 border-2 border-dashed border-white/5 group hover:border-amber-500/20 transition-all`}>
                        <div className="p-8 rounded-[3rem] bg-white/5 group-hover:bg-amber-500 text-white transition-all shadow-2xl relative">
                            <RefreshCw className={`w-12 h-12 ${loading ? 'animate-spin' : ''}`} />
                            {loading && (
                                <div className="absolute inset-0 rounded-[3rem] border-4 border-amber-500 border-t-transparent animate-spin" />
                            )}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Trigger Evolution</h3>
                            <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">
                                Analyzes community feedback consensus and executes fully autonomous timeline modifications.
                            </p>
                        </div>
                        <button 
                            onClick={triggerRemediation}
                            disabled={loading}
                            className={`w-full py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] italic transition-all ${
                                loading ? 'bg-slate-800 text-slate-600' : 'bg-amber-500 hover:bg-amber-400 text-white shadow-xl shadow-amber-500/20'
                            }`}
                        >
                            {loading ? 'RE-RENDERING...' : 'EXECUTE RECURSIVE LOOP'}
                        </button>
                    </div>

                    <div className="p-6 bg-indigo-600 rounded-[2rem] flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                            <History className="w-6 h-6 opacity-60" />
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-80 block mb-1 leading-none">Last Evolution</span>
                                <h6 className="text-sm font-black italic tracking-tighter uppercase leading-none">None Detected</h6>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 opacity-40" />
                    </div>
                </div>

            </div>
        </div>
    )
}
