'use client'

import React, { useState, useEffect } from 'react'
import { 
  Network, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  ShieldCheck, 
  RefreshCcw, 
  Key, 
  ChevronRight,
  Database,
  Search,
  Timer,
  Globe
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface PlatformHealth {
    status: 'healthy' | 'warning' | 'expired' | 'error' | 'disconnected'
    message: string
}

interface Quota {
    platform: string
    limit: number
    used: number
    label: string
}

interface NetworkHealth {
    status: 'operational' | 'degraded' | 'critical' | 'inactive'
    platforms: Record<string, PlatformHealth>
    quotas: Quota[]
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.02] border border-subtle shadow-2xl"

export const NetworkStatusHUD: React.FC = () => {
    const [health, setHealth] = useState<NetworkHealth | null>(null)
    const [loading, setLoading] = useState(false)
    const [auditing, setAuditing] = useState(false)

    const auditNetwork = async () => {
        setAuditing(true)
        try {
            const data = await apiGet('/click/network-health')
            setHealth(data)
        } catch (err) {
            console.error('Network audit failed')
        } finally {
            setAuditing(false)
        }
    }

    useEffect(() => {
        auditNetwork()
    }, [])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-emerald-400'
            case 'warning': return 'text-amber-400'
            case 'expired': return 'text-rose-400'
            case 'error': return 'text-rose-500'
            default: return 'text-theme-muted'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <ShieldCheck className="w-4 h-4 text-emerald-400" />
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />
            case 'expired': return <Key className="w-4 h-4 text-rose-400" />
            case 'error': return <Activity className="w-4 h-4 text-rose-500" />
            default: return <RefreshCcw className="w-4 h-4 text-theme-muted" />
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-emerald-600 text-white shadow-xl shadow-emerald-600/20">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Connection health</h4>
                        <span className="text-[9px] font-black text-theme-muted uppercase tracking-[0.4em] mt-1 block italic text-emerald-500/70">Your connected platforms and API limits</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-subtle flex items-center gap-3">
                        <Activity className={`w-3 h-3 ${health?.status === 'operational' ? 'text-emerald-400' : 'text-rose-400'}`} />
                        <span className="text-[10px] font-black text-theme-primary uppercase italic tracking-widest leading-none">
                            {health?.status === 'operational' ? 'All connections working' : 'Some connections need attention'}
                        </span>
                    </div>
                    <button
                        type="button"
                        aria-label="Check connections"
                        onClick={auditNetwork}
                        disabled={auditing}
                        className={`p-3 rounded-xl bg-white/5 border border-default text-theme-primary hover:bg-white/10 transition-all ${auditing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                
                {/* Left: Platform Nodes (7 Cols) */}
                <div className="xl:col-span-7 space-y-8">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 relative overflow-hidden h-full`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-xl font-black text-theme-primary italic tracking-tighter uppercase leading-none">Connected platforms</h5>
                                <p className="text-[9px] font-black text-theme-muted uppercase tracking-widest mt-2">Account connection status</p>
                            </div>
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {auditing ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-24 bg-white/5 animate-pulse rounded-3xl" />
                                ))
                            ) : health?.platforms ? (
                                Object.entries(health.platforms).map(([platform, data], i) => (
                                    <m.div 
                                        key={platform}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-6 rounded-3xl bg-white/5 border border-subtle group hover:border-emerald-500/30 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg bg-white/5 text-theme-primary/70 uppercase text-[9px] font-black tracking-widest`}>
                                                    {platform}
                                                </div>
                                            </div>
                                            {getStatusIcon(data.status)}
                                        </div>
                                        <div className="space-y-1">
                                            <p className={`text-xs font-black uppercase italic ${getStatusColor(data.status)}`}>
                                                {data.status}
                                            </p>
                                            <p className="text-[8px] font-bold text-theme-muted uppercase tracking-widest opacity-60">
                                                {data.message}
                                            </p>
                                        </div>
                                    </m.div>
                                ))
                            ) : (
                                <div className="col-span-2 p-20 text-center opacity-20">
                                    <RefreshCcw className="w-10 h-10 mx-auto animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Platform Quotas (5 Cols) */}
                <div className="xl:col-span-5 space-y-8">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 relative overflow-hidden h-full`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-xl font-black text-theme-primary italic tracking-tighter uppercase leading-none">API limits</h5>
                                <p className="text-[9px] font-black text-theme-muted uppercase tracking-widest mt-2">Usage against each platform&apos;s limit</p>
                            </div>
                            <Database className="w-5 h-5 text-emerald-400" />
                        </div>

                        <div className="space-y-8">
                            {health?.quotas.map((quota, i) => (
                                <div key={i} className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <span className="text-[8px] font-black text-theme-muted uppercase tracking-[0.2em]">{quota.platform}</span>
                                            <h6 className="text-[10px] font-black text-theme-primary italic uppercase">{quota.label}</h6>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-emerald-400 italic">{quota.used} / {quota.limit}</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                        <m.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(quota.used / quota.limit) * 100}%` }}
                                            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        />
                                    </div>
                                </div>
                            ))}

                            <div className="p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 mt-10">
                                <div className="flex items-start gap-4">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-1" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase italic tracking-widest">Tip</p>
                                        <p className="text-[9px] font-bold text-theme-secondary mt-1 leading-relaxed">
                                            Reconnect any expired account to keep publishing to it.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    )
}
