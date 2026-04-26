'use client'

import React, { useState, useEffect } from 'react'
import { 
  Server, 
  Activity, 
  ShieldCheck, 
  Zap, 
  PlusCircle, 
  RefreshCw, 
  Terminal,
  Cpu,
  Globe,
  AlertTriangle,
  ChevronRight,
  Database,
  Instagram,
  Youtube,
  Twitter,
  Linkedin,
  LucideIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface FleetNode {
  name: string
  status: 'online' | 'offline' | 'warning' | 'calibrating'
  nodeType: string
  metrics: {
    revenueDay: number
    activeGenerations: number
    healthScore: number
    platformHealth: {
      instagram: boolean
      youtube: boolean
      twitter: boolean
      linkedin: boolean
    }
  }
  lastPulse: string
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

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const FleetControlHUD: React.FC = () => {
    const [status, setStatus] = useState<FleetStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [])

    const fetchStatus = async () => {
        try {
            const data = await apiGet('/phase10_12/fleet/status')
            setStatus(data)
        } catch (err) {
            console.error('Fleet status fetch failed')
        } finally {
            setLoading(false)
        }
    }

    const syncFleet = async () => {
        setIsSyncing(true)
        try {
            await apiPost('/phase10_12/fleet/verify-network', {})
            await fetchStatus()
        } catch (err) {
            console.error('Sync failed')
        } finally {
            setTimeout(() => setIsSyncing(false), 2000)
        }
    }

    if (loading) return <div className="h-96 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-indigo-500" /></div>

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Fleet Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                        <Server className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Fleet Control</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Decentralized Node Orchestration</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={syncFleet}
                        disabled={isSyncing}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 text-white transition-all group"
                    >
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    </button>
                    <button className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-2xl transition-all">
                        <PlusCircle className="w-4 h-4" />
                        Provision Node
                    </button>
                </div>
            </div>

            {/* Aggregated Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Nodes', val: status?.aggregation.onlineNodes, total: status?.aggregation.totalNodes, icon: Cpu, color: 'text-indigo-400' },
                    { label: 'Network Integrity', val: `${((status?.aggregation.networkIntegrity ?? 0) * 100).toFixed(0)}%`, icon: ShieldCheck, color: 'text-emerald-400' },
                    { label: 'Fleet Revenue', val: `$${status?.aggregation.totalRevenue.toLocaleString()}`, icon: Zap, color: 'text-amber-400' },
                    { label: 'Active Tasks', val: status?.aggregation.activeGenerations, icon: Activity, color: 'text-blue-400' }
                ].map((stat, i) => (
                    <div key={i} className={`${glassStyle} rounded-3xl p-6 space-y-4`}>
                        <div className="flex items-center justify-between">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            {stat.total && <span className="text-[10px] font-black text-slate-600">OF {stat.total}</span>}
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{stat.val}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Scale Recommendation Alert */}
            {status?.recommendation && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-6 rounded-[2rem] border flex items-center justify-between gap-6 ${
                        status.recommendation.priority === 'high' 
                        ? 'bg-indigo-500/10 border-indigo-500/20' 
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}
                >
                    <div className="flex items-center gap-6">
                        <div className={`p-3 rounded-xl ${status.recommendation.priority === 'high' ? 'bg-indigo-500' : 'bg-amber-500'} text-white`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Scale Recommendation</span>
                            <p className="text-xs font-bold text-white italic leading-relaxed">{status.recommendation.msg}</p>
                        </div>
                    </div>
                    <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest italic transition-all border border-white/10">
                        Authorize Scale
                    </button>
                </motion.div>
            )}

            {/* Node Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <AnimatePresence>
                    {status?.nodes.map((node, i) => (
                        <motion.div 
                            key={i}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`${glassStyle} rounded-[2rem] p-8 space-y-6 group hover:border-indigo-500/30 transition-all`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${
                                        node.status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                        node.status === 'warning' ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'
                                    }`} />
                                    <h5 className="text-xs font-black text-white uppercase tracking-widest italic">{node.name}</h5>
                                </div>
                                <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-lg border border-white/5">
                                    {[
                                        { id: 'li', icon: Linkedin },
                                        { id: 'tw', icon: Twitter },
                                        { id: 'ig', icon: Instagram },
                                        { id: 'yt', icon: Youtube }
                                    ].map(plat => (
                                        <plat.icon key={plat.id} className="w-2.5 h-2.5 text-indigo-400 opacity-60 hover:opacity-100 transition-opacity" />
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                    <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Health</span>
                                    <span className="text-sm font-black text-white italic">{node.metrics.healthScore}%</span>
                                </div>
                                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                    <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Yield</span>
                                    <span className="text-sm font-black text-emerald-400 italic">${node.metrics.revenueDay}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Pulse: {new Date(node.lastPulse).toLocaleTimeString()}
                                </span>
                                <button className="flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                                    Inspect Node <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
