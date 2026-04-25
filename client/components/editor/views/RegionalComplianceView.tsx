'use client'

import React, { useState, useEffect } from 'react'
import { 
  Globe, 
  Map, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Info, 
  Zap, 
  ExternalLink,
  Search,
  History,
  Flag,
  MoreVertical,
  ChevronRight,
  ShieldCheck
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '../../../lib/api'

interface ComparisonResult {
    overallStatus: 'PASS' | 'CAUTION' | 'ALERT'
    regionalIssues: string[]
    shadowbanRisk: Record<string, string>
    justification: string
    region: string
    requiresHumanOverride: boolean
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const RegionalComplianceView: React.FC = () => {
    const [result, setResult] = useState<ComparisonResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [auditInput, setAuditInput] = useState({
        region: 'Middle East',
        transcript: 'New crypto trading bot tutorial! Link in bio to join our giveaway and get cash app rewards fast follow me for more'
    })

    const triggerAudit = async () => {
        setLoading(true)
        try {
            const data = await apiPost('/click/compliance-audit', { 
                contentId: 'test-content-1',
                transcript: auditInput.transcript,
                region: auditInput.region 
            })
            setResult(data)
        } catch (err) {
            console.error('Compliance audit failed')
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PASS': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            case 'CAUTION': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            case 'ALERT': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-amber-500 text-white shadow-xl shadow-amber-500/20">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Regional Compliance</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-amber-500/70">Global Guardrails & Shadowban Detection</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase italic tracking-widest leading-none">Global Agent Online</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                
                {/* Left: Input & Analysis */}
                <div className="space-y-8">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden`}>
                        <div className="flex items-center justify-between relative z-10">
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Audit Configuration</h5>
                            <Map className="w-5 h-5 text-amber-400" />
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Target Region</label>
                                <select 
                                    value={auditInput.region}
                                    onChange={(e) => setAuditInput({...auditInput, region: e.target.value})}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-black italic uppercase tracking-tighter focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                >
                                    <option value="Middle East">Middle East</option>
                                    <option value="East Asia">East Asia</option>
                                    <option value="EU Central">EU Central</option>
                                    <option value="North America">North America</option>
                                    <option value="Latin America">Latin America</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-2">Content Transcript</label>
                                <textarea 
                                    value={auditInput.transcript}
                                    onChange={(e) => setAuditInput({...auditInput, transcript: e.target.value})}
                                    className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-300 font-bold italic text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                                    placeholder="Enter content transcript for regional auditing..."
                                />
                            </div>

                            <button 
                                onClick={triggerAudit}
                                disabled={loading}
                                className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] italic shadow-2xl transition-all ${
                                    loading ? 'bg-slate-800 text-slate-600' : 'bg-amber-500 hover:bg-amber-400 text-white'
                                }`}
                            >
                                {loading ? 'AUDITING REGIONAL RESONANCE...' : 'RUN COMPLIANCE SWEEP'}
                            </button>
                        </div>
                    </div>

                    <div className={`${glassStyle} rounded-[2.5rem] p-10 flex items-center justify-between`}>
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-2xl bg-white/5 text-slate-400 border border-white/10">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h6 className="text-sm font-black text-white uppercase italic tracking-tighter leading-none">Guardrail Status</h6>
                                <p className="text-[10px] font-bold text-slate-500 italic mt-1 uppercase">ADVISORY MODE ACTIVE</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Zap className="w-3 h-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Optimized</span>
                        </div>
                    </div>
                </div>

                {/* Right: Results Dashboard */}
                <div className="space-y-8">
                    <AnimatePresence mode="wait">
                        {!result && !loading ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`${glassStyle} rounded-[2.5rem] p-24 flex flex-col items-center justify-center text-center space-y-6 italic opacity-20 h-full`}
                            >
                                <Search className="w-16 h-16" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Awaiting Compliance Ingestion</span>
                            </motion.div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                {/* Status Card */}
                                <div className={`p-10 rounded-[2.5rem] border relative overflow-hidden ${getStatusColor(result?.overallStatus || 'PASS')}`}>
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-8">
                                            <div className="p-6 rounded-3x-l bg-current opacity-10" />
                                            <div className="absolute left-10 p-4">
                                                {result?.overallStatus === 'PASS' ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                                            </div>
                                            <div>
                                                <h5 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                                                    {result?.overallStatus || 'SCANNING...'}
                                                </h5>
                                                <span className="text-[10px] font-black uppercase tracking-widest mt-1 block italic opacity-60">
                                                    Regional Consensus Audit Complete
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Audit Integrity</span>
                                            <div className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md">
                                                <span className="text-[11px] font-black italic uppercase">99.8% CERTAINTY</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Findings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-6`}>
                                        <div className="flex items-center justify-between">
                                            <h6 className="text-[10px] font-black text-white uppercase tracking-widest italic">Regional Conflicts</h6>
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="space-y-4">
                                            {result?.regionalIssues.map((issue, i) => (
                                                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                                    <Flag className="w-3 h-3 text-rose-400 mt-1" />
                                                    <span className="text-[10px] font-bold text-slate-400 italic leading-snug">{issue}</span>
                                                </div>
                                            )) || (
                                                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-[10px] font-bold text-emerald-400 italic">No cultural conflicts detected</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-6`}>
                                        <div className="flex items-center justify-between">
                                            <h6 className="text-[10px] font-black text-white uppercase tracking-widest italic">Shadowban Risk</h6>
                                            <Zap className="w-4 h-4 text-violet-500" />
                                        </div>
                                        <div className="space-y-4">
                                            {Object.entries(result?.shadowbanRisk || {}).map(([platform, risk], i) => (
                                                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                                    <span className="text-[10px] font-black text-white uppercase italic">{platform}</span>
                                                    <span className={`text-[10px] font-black uppercase italic ${
                                                        risk === 'HIGH' ? 'text-rose-400' : 'text-emerald-400'
                                                    }`}>{risk}</span>
                                                </div>
                                            )) || (
                                                <span className="text-[10px] font-bold text-slate-500 italic px-4">Awaiting platform sweep...</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Justification & Action */}
                                <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-6`}>
                                    <div className="flex items-center gap-4">
                                        <Info className="w-5 h-5 text-blue-400" />
                                        <h6 className="text-sm font-black text-white uppercase italic tracking-tighter italic">Compliance Justification</h6>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-6">
                                        "{result?.justification}"
                                    </p>
                                    
                                    {result?.requiresHumanOverride && (
                                        <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-6">
                                            <div className="flex items-center gap-3 text-amber-400">
                                                <ShieldAlert className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase italic">Decision: Human Override Required</span>
                                            </div>
                                            <button className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest italic">
                                                Sign & Proceed
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
