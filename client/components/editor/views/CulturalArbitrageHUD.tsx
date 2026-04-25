'use client'

import React, { useState, useEffect } from 'react'
import { 
  Network, 
  TrendingUp, 
  RefreshCcw, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  History, 
  Flame, 
  Activity, 
  Target,
  ArrowUpRight,
  ChevronRight,
  Database,
  Search,
  Timer
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface ArbitrageTrigger {
    niche: string
    keyword: string
    velocity: number
    threshold: number
}

interface ResurrectionCandidate {
    originalPostId: string
    contentId: string
    title: string
    historicalViews: number
    historicalEngagement: number
    ageInDays: number
    signalStrength: number
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl"

export const CulturalArbitrageHUD: React.FC = () => {
    const [triggers, setTriggers] = useState<ArbitrageTrigger[]>([])
    const [candidates, setCandidates] = useState<ResurrectionCandidate[]>([])
    const [loading, setLoading] = useState(false)
    const [resurrecting, setResurrecting] = useState<string | null>(null)

    const scanMarket = async () => {
        setLoading(true)
        try {
            const [triggersData, candidatesData] = await Promise.all([
                apiGet('/sovereign/arbitrage-triggers'),
                apiGet('/sovereign/resurrection-candidates')
            ])
            setTriggers(triggersData)
            setCandidates(candidatesData)
        } catch (err) {
            console.error('Market scan failed')
        } finally {
            setLoading(false)
        }
    }

    const triggerResurrection = async (candidate: ResurrectionCandidate) => {
        setResurrecting(candidate.contentId)
        try {
            await apiPost('/sovereign/trigger-resurrection', { 
                originalPostId: candidate.originalPostId,
                contentId: candidate.contentId
            })
            // Refresh list
            scanMarket()
        } catch (err) {
            console.error('Resurrection failed')
        } finally {
            setResurrecting(null)
        }
    }

    useEffect(() => {
        scanMarket()
    }, [])

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-violet-600 text-white shadow-xl shadow-violet-600/20">
                        <Network className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Cultural Arbitrage HUD</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-violet-500/70">Trend Spotting & Content Resurrection</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-black text-white uppercase italic tracking-widest leading-none">Live-Wire Engine Ingesting...</span>
                    </div>
                    <button 
                        onClick={scanMarket}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                
                {/* Left: Emergent Triggers (4 Cols) */}
                <div className="xl:col-span-5 space-y-8">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 relative overflow-hidden h-full`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Market Signals</h5>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Emergent Trends Detected</p>
                            </div>
                            <TrendingUp className="w-5 h-5 text-violet-400" />
                        </div>

                        <div className="space-y-6">
                            {loading ? (
                                <div className="space-y-6 opacity-40">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 bg-white/5 animate-pulse rounded-3xl" />
                                    ))}
                                </div>
                            ) : triggers.length > 0 ? (
                                triggers.map((signal, i) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="p-6 rounded-3xl bg-white/5 border border-white/5 group hover:border-violet-500/30 transition-all relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-4 relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="px-3 py-1 rounded-lg bg-violet-500/10 text-violet-400">
                                                    <span className="text-[9px] font-black uppercase italic">{signal.niche}</span>
                                                </div>
                                                <h6 className="text-lg font-black text-white italic tracking-tight uppercase">{signal.keyword}</h6>
                                            </div>
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <ArrowUpRight className="w-4 h-4" />
                                                <span className="text-[11px] font-black lowercase tracking-tighter italic">+{Math.round(signal.velocity * 100)}%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 relative z-10">
                                            <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                <span>Velocity Index</span>
                                                <span>Breakout Threshold: {(signal.threshold * 100).toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(signal.velocity / 0.5) * 100}%` }}
                                                    className="h-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="p-20 text-center space-y-4 italic opacity-20">
                                    <Target className="w-12 h-12 mx-auto" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Scanning Market Noise...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Resurrection Queue (7 Cols) */}
                <div className="xl:col-span-7 space-y-8">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 relative overflow-hidden h-full`}>
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Resurrection Queue</h5>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">Legacy Assets Ready for Deployment</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-black italic tracking-widest uppercase">CAP: 2 DAILY</span>
                                <RefreshCcw className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {loading ? (
                                [1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-64 bg-white/5 animate-pulse rounded-3xl" />
                                ))
                            ) : candidates.map((asset, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex flex-col justify-between hover:bg-white/[0.05] transition-all relative group"
                                >
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
                                                <History className="w-4 h-4" />
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Momentum</span>
                                                <p className="text-xs font-black text-emerald-400 italic">{(asset.historicalViews / 1000).toFixed(1)}K VIEWS</p>
                                            </div>
                                        </div>

                                        <div>
                                            <h6 className="text-lg font-black text-white italic tracking-tight uppercase leading-none">{asset.title}</h6>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase italic mt-2 block tracking-widest leading-none opacity-60">Posted {asset.ageInDays} days ago</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Signal</span>
                                                <div className="flex items-center gap-2 text-amber-400">
                                                    <Flame className="w-3 h-3" />
                                                    <span className="text-[10px] font-black italic italic">{asset.signalStrength}/100</span>
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                                <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Status</span>
                                                <div className="flex items-center gap-2 text-emerald-400">
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span className="text-[10px] font-black italic tracking-widest">READY</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => triggerResurrection(asset)}
                                        disabled={resurrecting === asset.contentId}
                                        className={`w-full py-4 mt-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-xl transition-all flex items-center justify-center gap-4 ${
                                            resurrecting === asset.contentId 
                                                ? 'bg-slate-800 text-slate-500' 
                                                : 'bg-white text-black hover:bg-violet-500 hover:text-white'
                                        }`}
                                    >
                                        {resurrecting === asset.contentId ? (
                                            <>
                                                <Timer className="w-3 h-3 animate-spin" />
                                                DEPLOING...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-3 h-3" />
                                                Deploy Resurrection
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6`}>
                    <div className="p-3 rounded-2xl bg-violet-600 shadow-lg shadow-violet-600/30">
                        <Database className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Data Synthesis</span>
                        <h6 className="text-[10px] font-black text-white italic uppercase tracking-widest leading-none mt-1">Cross-Network Ingestion Active</h6>
                    </div>
                </div>
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6`}>
                    <div className="p-3 rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30">
                        <Timer className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Cycle Status</span>
                        <h6 className="text-[10px] font-black text-white italic uppercase tracking-widest leading-none mt-1">Daily Cap: {2 - candidates.length > 0 ? 0 : 0}/2 Remaining</h6>
                    </div>
                </div>
                <div className={`${glassStyle} p-8 rounded-3xl flex items-center gap-6`}>
                    <div className="p-3 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30">
                        <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Niche Positioning</span>
                        <h6 className="text-[10px] font-black text-white italic uppercase tracking-widest leading-none mt-1">Top Alignment: Agentic SaaS</h6>
                    </div>
                </div>
            </div>
        </div>
    )
}
