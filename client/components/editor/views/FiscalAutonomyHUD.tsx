'use client'

import React, { useState, useEffect } from 'react'
import { 
  DollarSign, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Activity, 
  ArrowUpRight, 
  BarChart3, 
  Target, 
  Cpu, 
  Wallet,
  Globe,
  RefreshCcw,
  AlertTriangle,
  Repeat,
  Compass
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface FiscalVelocity {
    velocity: number
    rpd: number
    epc: number
    pulseRevenue: number
    pulseClicks: number
    timestamp: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl"

export const FiscalAutonomyHUD: React.FC = () => {
    const [velocity, setVelocity] = useState<FiscalVelocity | null>(null)
    const [loading, setLoading] = useState(false)
    const [steerMode, setSteerMode] = useState<'autonomous' | 'advisory'>('autonomous')

    const fetchVelocity = async () => {
        setLoading(true)
        try {
            const data = await apiGet('/sovereign/fiscal-velocity')
            setVelocity(data)
        } catch (err) {
            console.error('Fiscal sync failed')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchVelocity()
    }, [])

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-5 rounded-[1.5rem] bg-indigo-600 text-white shadow-xl shadow-indigo-600/20">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-white italic tracking-tighter leading-none uppercase">Fiscal Autonomy HUD</h4>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block italic text-indigo-500/70">Revenue Steering</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5">
                    <button 
                        onClick={() => setSteerMode('autonomous')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${steerMode === 'autonomous' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Autonomous
                    </button>
                    <button 
                        onClick={() => setSteerMode('advisory')}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${steerMode === 'advisory' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        Advisory
                    </button>
                </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { label: 'Fiscal Velocity', value: `$${velocity?.velocity.toFixed(2)}/hr`, sub: 'Real-time Yield Rate', icon: Zap, color: 'text-indigo-400' },
                    { label: 'Revenue Per Dispatch', value: `$${velocity?.rpd.toFixed(2)}`, sub: 'Avg Post Yield', icon: Globe, color: 'text-emerald-400' },
                    { label: 'Earnings Per Click', value: `$${velocity?.epc.toFixed(2)}`, sub: 'Link Performance', icon: TrendingUp, color: 'text-blue-400' },
                    { label: 'Pulse Revenue (24h)', value: `$${velocity?.pulseRevenue.toFixed(0)}`, sub: 'Collective Yield', icon: DollarSign, color: 'text-white' }
                ].map((stat, i) => (
                    <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`${glassStyle} p-8 rounded-[2.5rem] relative overflow-hidden group`}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                        <h5 className="text-3xl font-black text-white italic mt-3 tracking-tighter">{stat.value}</h5>
                        <p className={`text-[9px] font-black uppercase mt-2 ${stat.color} tracking-[0.2em]`}>{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Yield Steering & Node Map */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                
                {/* Left: Active Monetization Nodes (7 Cols) */}
                <div className="xl:col-span-7">
                    <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden h-full`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Fiscal Nodes</h5>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Active Monetization Targets</p>
                            </div>
                            <Activity className="w-6 h-6 text-indigo-500" />
                        </div>

                        <div className="space-y-6">
                            {[
                                { name: 'Alpha Access (Whop)', yield: 0.92, status: 'Active', trend: '+12%', color: 'bg-emerald-500' },
                                { name: 'Click Pro Subscription', yield: 0.78, status: 'Active', trend: '+5%', color: 'bg-indigo-500' },
                                { name: 'Vultr Node Hardware (Ref)', yield: 0.45, status: 'Dormant', trend: '-2%', color: 'bg-slate-500' }
                            ].map((node, i) => (
                                <div key={node.name} className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/[0.08] transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-2xl ${node.color} flex items-center justify-center text-white shadow-lg`}>
                                            <Target className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h6 className="text-[13px] font-black text-white uppercase italic">{node.name}</h6>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 mt-1 block w-fit">
                                                {node.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[14px] font-black text-white italic">{Math.round(node.yield * 100)}% Yield</div>
                                        <div className="text-[10px] font-black text-emerald-400 flex items-center justify-end gap-1 mt-1">
                                            <ArrowUpRight className="w-3 h-3" />
                                            {node.trend}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 p-8 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                            <div className="flex items-start gap-4">
                                <Zap className="w-5 h-5 text-indigo-400 mt-1" />
                                <div>
                                    <p className="text-[11px] font-black text-indigo-300 uppercase italic tracking-widest text-balance">Autonomous Pivot Advisory</p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed">
                                        AI engine detected a 22% yield potential increase for 'Alpha Access'. Redirecting 30% of LinkedIn dispatch manifests to this node.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Revenue Forecast (5 Cols) */}
                <div className="xl:col-span-5">
                    <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden h-full flex flex-col`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Fiscal Outlook</h5>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">7-Day Yield Forecast</p>
                            </div>
                            <BarChart3 className="w-6 h-6 text-indigo-500" />
                        </div>

                        <div className="flex-1 flex flex-col justify-between">
                            <div className="space-y-8">
                                {[
                                    { day: 'MON', val: 85, rev: '$420' },
                                    { day: 'TUE', val: 92, rev: '$480' },
                                    { day: 'WED', val: 78, rev: '$390' },
                                    { day: 'THU', val: 95, rev: '$510' }
                                ].map((d, i) => (
                                    <div key={d.day} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{d.day}</span>
                                            <span className="text-[11px] font-black text-white italic uppercase">{d.rev} Target</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${d.val}%` }}
                                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12 p-8 rounded-[2.5rem] bg-amber-500/5 border border-amber-500/10">
                                <div className="flex items-center gap-4 mb-4">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    <span className="text-[10px] font-black text-amber-500 uppercase italic tracking-widest">Syndicate Pulse</span>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 leading-relaxed italic uppercase tracking-wider">
                                    "Yield drift detected in Gaming niche. Broadcaster spreading dispatches to stabilize conversion floor."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6 group hover:border-indigo-500/30 transition-all`}>
                    <div className="p-4 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-600/20">
                        <Cpu className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Steer Protocol</span>
                        <h6 className="text-[12px] font-black text-white italic uppercase tracking-widest mt-1">Autonomous Mastery</h6>
                    </div>
                </div>
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6 group hover:border-emerald-500/30 transition-all`}>
                    <div className="p-4 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-600/20">
                        <Repeat className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Attribution State</span>
                        <h6 className="text-[12px] font-black text-emerald-400 italic uppercase tracking-widest mt-1">Zero-Drift Synchronized</h6>
                    </div>
                </div>
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6 group hover:border-blue-500/30 transition-all`}>
                    <div className="p-4 rounded-2xl bg-blue-600 shadow-xl shadow-blue-600/20">
                        <Compass className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Market Alignment</span>
                        <h6 className="text-[12px] font-black text-white italic uppercase tracking-widest mt-1">Peak Yield Trajectory</h6>
                    </div>
                </div>
            </div>
        </div>
    )
}
