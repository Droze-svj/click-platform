'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Server,
  Activity,
  ShieldCheck,
  Zap,
  RefreshCw,
  Cpu,
  AlertTriangle,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface FleetNode {
  _id?: string
  name: string
  status: 'online' | 'offline' | 'warning' | 'calibrating'
  nodeType: string
  metrics?: {
    revenueDay?: number
    activeGenerations?: number
    healthScore?: number
    lastPulse?: string
    platformHealth?: {
      instagram?: boolean
      youtube?: boolean
      twitter?: boolean
      linkedin?: boolean
    }
  }
  lastPulse?: string
}

interface FleetStatus {
  nodes: FleetNode[]
  aggregation: {
    totalNodes: number
    onlineNodes: number
    warningNodes: number
    totalRevenue: number
    activeGenerations: number
    networkIntegrity: number
  }
  recommendation: {
    type: string
    msg: string
    priority: string
    potentialLift?: number
  } | null
}

type CheckResult = Record<string, { status?: string; error?: string }>

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const CHECK_LABELS: Record<string, { text: string; color: string }> = {
  VALIDATED: { text: 'Working', color: 'text-emerald-400' },
  DRIFT_DETECTED: { text: 'Needs attention', color: 'text-amber-400' },
  DECOUPLED: { text: 'Not set up', color: 'text-slate-400' },
  BREACHED: { text: 'Error', color: 'text-rose-400' },
}

const PLATFORM_ICONS = [
  { id: 'linkedin', icon: Linkedin },
  { id: 'twitter', icon: Twitter },
  { id: 'instagram', icon: Instagram },
  { id: 'youtube', icon: Youtube },
] as const

/**
 * Registered worker nodes from GET /api/phase10_12/fleet/status, plus a real
 * connection check (POST /fleet/verify-network) whose per-platform result is
 * shown as returned.
 */
export const FleetControlHUD: React.FC = () => {
    const { showToast } = useToast()
    const [status, setStatus] = useState<FleetStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

    const fetchStatus = useCallback(async () => {
        try {
            const data = await apiGet<FleetStatus>('/phase10_12/fleet/status', undefined, false)
            setStatus(data && typeof data === 'object' ? data : null)
            setFailed(false)
        } catch (err) {
            console.error('Fleet status fetch failed', err)
            setFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [fetchStatus])

    const checkConnections = async () => {
        setIsSyncing(true)
        try {
            const res: any = await apiPost('/phase10_12/fleet/verify-network', {})
            setCheckResult(res?.platforms && typeof res.platforms === 'object' ? res.platforms : {})
            showToast('Connection check finished.', 'success')
            await fetchStatus()
        } catch (err) {
            console.error('Connection check failed', err)
            showToast('Couldn\'t check your connections. Please try again.', 'error')
        } finally {
            setIsSyncing(false)
        }
    }

    if (loading) return <div role="status" aria-label="Loading" className="h-96 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-indigo-500" aria-hidden="true" /></div>

    const agg = status?.aggregation
    const nodes = Array.isArray(status?.nodes) ? status!.nodes : []
    const hasNodes = nodes.length > 0

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                        <Server className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Workers</h4>
                        <span className="text-[11px] font-bold text-slate-500 mt-1 block">Machines registered to run jobs for your account, and your platform connections.</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={checkConnections}
                    disabled={isSyncing}
                    className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {isSyncing ? 'Checking…' : 'Check connections'}
                </button>
            </div>

            {failed && (
                <div role="alert" className={`${glassStyle} rounded-[2rem] p-6 flex items-center gap-3 text-rose-300 text-sm font-semibold`}>
                    <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" /> Couldn&apos;t load worker status. It will retry automatically.
                </div>
            )}

            {checkResult && (
                <div className={`${glassStyle} rounded-[2rem] p-6 space-y-3`}>
                    <h5 className="text-[11px] font-black text-white uppercase tracking-widest">Connection check</h5>
                    {Object.keys(checkResult).length === 0 ? (
                        <p className="text-[12px] text-slate-400">No platforms were checked.</p>
                    ) : (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {Object.entries(checkResult).map(([platform, r]) => {
                                const label = CHECK_LABELS[String(r?.status)] || { text: String(r?.status || '—'), color: 'text-slate-400' }
                                return (
                                    <li key={platform} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white uppercase">{platform}</span>
                                        <span className={`text-[10px] font-black uppercase ${label.color}`}>{label.text}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            )}

            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Online', val: agg ? agg.onlineNodes : '—', total: agg?.totalNodes, icon: Cpu, color: 'text-indigo-400' },
                    { label: 'Average health', val: hasNodes && agg ? `${((agg.networkIntegrity ?? 0) * 100).toFixed(0)}%` : '—', icon: ShieldCheck, color: 'text-emerald-400' },
                    { label: 'Revenue today', val: agg ? `$${Number(agg.totalRevenue ?? 0).toLocaleString()}` : '—', icon: Zap, color: 'text-amber-400' },
                    { label: 'Jobs running', val: agg ? agg.activeGenerations : '—', icon: Activity, color: 'text-blue-400' }
                ].map((stat) => (
                    <div key={stat.label} className={`${glassStyle} rounded-3xl p-6 space-y-4`}>
                        <div className="flex items-center justify-between">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} aria-hidden="true" />
                            {typeof stat.total === 'number' && stat.total > 0 && <span className="text-[10px] font-black text-slate-500">OF {stat.total}</span>}
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter uppercase">{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recommendation (from the server; informational only) */}
            {status?.recommendation?.msg && (
                <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-6 rounded-[2rem] border flex items-center gap-6 ${
                        status.recommendation.priority === 'high'
                        ? 'bg-indigo-500/10 border-indigo-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}
                >
                    <div className={`p-3 rounded-xl ${status.recommendation.priority === 'high' ? 'bg-indigo-500' : 'bg-amber-500'} text-white`}>
                        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Suggestion</span>
                        <p className="text-xs font-bold text-white italic leading-relaxed">{status.recommendation.msg}</p>
                    </div>
                </m.div>
            )}

            {/* Nodes */}
            {!hasNodes ? (
                <div className={`${glassStyle} rounded-[2rem] p-10 text-center text-sm text-slate-400`}>
                    No workers registered to your account.
                </div>
            ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <AnimatePresence>
                    {nodes.map((node, i) => {
                        const lastPulse = node.metrics?.lastPulse || node.lastPulse
                        const health = node.metrics?.healthScore
                        const platformHealth = node.metrics?.platformHealth || {}
                        const connected = PLATFORM_ICONS.filter(p => (platformHealth as any)[p.id] === true)
                        return (
                        <m.div
                            key={node._id || `${node.name}-${i}`}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`${glassStyle} rounded-[2rem] p-8 space-y-6`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                                        node.status === 'online' ? 'bg-emerald-500' :
                                        node.status === 'warning' ? 'bg-amber-500' : 'bg-slate-700'
                                    }`} aria-hidden="true" />
                                    <h5 className="text-xs font-black text-white uppercase tracking-widest italic truncate">{node.name}</h5>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{node.status}</span>
                                </div>
                                {connected.length > 0 && (
                                    <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-lg border border-white/5" aria-label={`Connected: ${connected.map(c => c.id).join(', ')}`}>
                                        {connected.map(plat => (
                                            <plat.icon key={plat.id} className="w-2.5 h-2.5 text-indigo-400" aria-hidden="true" />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Health</span>
                                    <span className="text-sm font-black text-white italic">{Number.isFinite(Number(health)) ? `${Number(health)}%` : '—'}</span>
                                </div>
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                    <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Revenue today</span>
                                    <span className="text-sm font-black text-emerald-400 italic">${Number(node.metrics?.revenueDay ?? 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pt-4 border-t border-white/5">
                                Last seen: {lastPulse ? new Date(lastPulse).toLocaleString() : '—'}
                            </p>
                        </m.div>
                        )
                    })}
                </AnimatePresence>
            </div>
            )}
        </div>
    )
}
