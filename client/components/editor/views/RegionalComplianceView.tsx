'use client'

import React, { useState } from 'react'
import {
  Globe,
  Map,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Zap,
  Search,
  Flag,
  ShieldCheck
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiPost } from '../../../lib/api'

interface ComparisonResult {
    overallStatus: 'PASS' | 'CAUTION' | 'ALERT'
    regionalIssues?: string[]
    shadowbanRisk?: Record<string, string>
    justification?: string
    region?: string
    requiresHumanOverride?: boolean
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-default shadow-2xl"

const STATUS_LABELS: Record<string, string> = {
    PASS: 'Looks fine',
    CAUTION: 'Review recommended',
    ALERT: 'Likely problem',
}

/**
 * Runs POST /api/click/compliance-audit on a transcript and shows exactly what
 * the AI check returned. The server answers a bare { overallStatus: 'PASS' }
 * when the check itself fails, so a result with no justification and no issue
 * list is reported as "the check couldn't run", not as a pass.
 */
export const RegionalComplianceView: React.FC = () => {
    const [result, setResult] = useState<ComparisonResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [auditInput, setAuditInput] = useState({
        region: 'North America',
        transcript: ''
    })

    const triggerAudit = async () => {
        if (!auditInput.transcript.trim()) {
            setError('Paste your video script or transcript first.')
            return
        }
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const data = await apiPost<ComparisonResult>('/click/compliance-audit', {
                contentId: null,
                transcript: auditInput.transcript,
                region: auditInput.region
            })
            const ranCheck = !!data && (typeof data.justification === 'string' || Array.isArray(data.regionalIssues))
            if (!ranCheck) {
                setError('The check couldn\'t be completed. Please try again later.')
            } else {
                setResult(data)
            }
        } catch (err) {
            console.error('Compliance audit failed', err)
            setError('The check couldn\'t be completed. Please try again later.')
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PASS': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            case 'CAUTION': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            case 'ALERT': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            default: return 'text-theme-secondary bg-slate-500/10 border-slate-500/20'
        }
    }

    const issues = Array.isArray(result?.regionalIssues) ? result!.regionalIssues! : []
    const risks = Object.entries(result?.shadowbanRisk || {})

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center gap-6">
                <div className="p-4 rounded-[1.2rem] bg-amber-500 text-white shadow-xl shadow-amber-500/20">
                    <Globe className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                    <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Regional check</h4>
                    <span className="text-[11px] font-bold text-theme-muted mt-1 block">An AI review of your script for local rules, cultural issues and words platforms tend to limit.</span>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">

                {/* Left: Input */}
                <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden`}>
                    <div className="flex items-center justify-between relative z-10">
                        <h5 className="text-xl font-black text-theme-primary italic tracking-tighter uppercase leading-none">What to check</h5>
                        <Map className="w-5 h-5 text-amber-400" aria-hidden="true" />
                    </div>

                    <div className="space-y-6 relative z-10">
                        <div className="space-y-3">
                            <label htmlFor="compliance-region" className="text-[10px] font-black text-theme-muted uppercase tracking-widest block ml-2">Region</label>
                            <select
                                id="compliance-region"
                                value={auditInput.region}
                                onChange={(e) => setAuditInput({...auditInput, region: e.target.value})}
                                className="w-full bg-white/5 border border-default rounded-2xl p-4 text-theme-primary font-black italic uppercase tracking-tighter focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            >
                                <option value="Middle East">Middle East</option>
                                <option value="East Asia">East Asia</option>
                                <option value="EU Central">EU Central</option>
                                <option value="North America">North America</option>
                                <option value="Latin America">Latin America</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label htmlFor="compliance-transcript" className="text-[10px] font-black text-theme-muted uppercase tracking-widest block ml-2">Script or transcript</label>
                            <textarea
                                id="compliance-transcript"
                                value={auditInput.transcript}
                                onChange={(e) => setAuditInput({...auditInput, transcript: e.target.value})}
                                className="w-full h-40 bg-white/5 border border-default rounded-2xl p-6 text-theme-secondary font-bold italic text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 outline-none transition-all resize-none"
                                placeholder="Paste what you say in the video…"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={triggerAudit}
                            disabled={loading}
                            aria-busy={loading}
                            className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] italic shadow-2xl transition-all ${
                                loading ? 'bg-slate-800 text-theme-secondary' : 'bg-amber-500 hover:bg-amber-400 text-white'
                            }`}
                        >
                            {loading ? 'Checking…' : 'Run check'}
                        </button>
                        {error && (
                            <p role="alert" className="flex items-center gap-2 text-[12px] font-semibold text-rose-300">
                                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: Results */}
                <div className="space-y-8">
                    <AnimatePresence mode="wait">
                        {!result ? (
                            <m.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`${glassStyle} rounded-[2.5rem] p-24 flex flex-col items-center justify-center text-center space-y-6 italic opacity-40 h-full`}
                            >
                                <Search className="w-16 h-16" aria-hidden="true" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">{loading ? 'Checking…' : 'Results will appear here'}</span>
                            </m.div>
                        ) : (
                            <m.div
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                {/* Status Card */}
                                <div className={`p-10 rounded-[2.5rem] border relative overflow-hidden ${getStatusColor(result.overallStatus)}`}>
                                    <div className="flex items-center gap-6">
                                        {result.overallStatus === 'PASS' ? <ShieldCheck className="w-8 h-8 shrink-0" aria-hidden="true" /> : <ShieldAlert className="w-8 h-8 shrink-0" aria-hidden="true" />}
                                        <div>
                                            <h5 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                                                {STATUS_LABELS[result.overallStatus] || result.overallStatus}
                                            </h5>
                                            <span className="text-[10px] font-black uppercase tracking-widest mt-1 block italic opacity-60">
                                                {result.region || auditInput.region}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Findings */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-6`}>
                                        <div className="flex items-center justify-between">
                                            <h6 className="text-[10px] font-black text-theme-primary uppercase tracking-widest italic">Issues found</h6>
                                            <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                        </div>
                                        <div className="space-y-4">
                                            {issues.length > 0 ? issues.map((issue, i) => (
                                                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-subtle">
                                                    <Flag className="w-3 h-3 text-rose-400 mt-1 shrink-0" aria-hidden="true" />
                                                    <span className="text-[11px] font-bold text-theme-secondary italic leading-snug">{issue}</span>
                                                </div>
                                            )) : (
                                                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                                                    <span className="text-[11px] font-bold text-emerald-400 italic">No issues listed</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-6`}>
                                        <div className="flex items-center justify-between">
                                            <h6 className="text-[10px] font-black text-theme-primary uppercase tracking-widest italic">Reach-limit risk</h6>
                                            <Zap className="w-4 h-4 text-violet-500" aria-hidden="true" />
                                        </div>
                                        <div className="space-y-4">
                                            {risks.length > 0 ? risks.map(([platform, risk]) => (
                                                <div key={platform} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-subtle">
                                                    <span className="text-[10px] font-black text-theme-primary uppercase italic">{platform}</span>
                                                    <span className={`text-[10px] font-black uppercase italic ${
                                                        String(risk).toUpperCase() === 'HIGH' ? 'text-rose-400' : String(risk).toUpperCase() === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                                                    }`}>{String(risk)}</span>
                                                </div>
                                            )) : (
                                                <span className="text-[11px] font-bold text-theme-muted italic px-4 block">No per-platform risk returned.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Justification */}
                                {result.justification && (
                                    <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-6`}>
                                        <div className="flex items-center gap-4">
                                            <Info className="w-5 h-5 text-blue-400" aria-hidden="true" />
                                            <h6 className="text-sm font-black text-theme-primary uppercase italic tracking-tighter">Why</h6>
                                        </div>
                                        <p className="text-[12px] font-bold text-theme-secondary leading-relaxed italic border-l-2 border-amber-500/30 pl-6">
                                            {result.justification}
                                        </p>
                                        {result.requiresHumanOverride && (
                                            <p className="pt-4 flex items-center gap-3 text-amber-400 border-t border-subtle text-[11px] font-black uppercase italic">
                                                <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                                                Review this before you post. This is advice only and nothing has been blocked.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
