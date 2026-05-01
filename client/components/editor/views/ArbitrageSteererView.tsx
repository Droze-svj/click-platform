'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  Target, 
  BarChart3, 
  MousePointer2, 
  ExternalLink, 
  Zap, 
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  DollarSign,
  PieChart,
  ArrowRightLeft
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface ArbitrageOffer {
  id: string
  name: string
  platform: string
  cvr: number
  pcv: number
  category: string
  tags: string[]
  priority: number
}

interface ArbitrageManifest {
  activeSteer: ArbitrageOffer
  manifest: ArbitrageOffer[]
  autonomyState: {
    canAutoSteer: boolean
    superiority: string
    recommendation: string
  }
  recommendation: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const ArbitrageSteererView: React.FC = () => {
    const [manifest, setManifest] = useState<ArbitrageManifest | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSteering, setIsSteering] = useState(false)

    useEffect(() => {
        fetchManifest()
    }, [])

    const fetchManifest = async () => {
        try {
            const data = await apiGet('/phase10_12/arbitrage/manifest')
            setManifest(data)
        } catch (err) {
            console.error('Failed to fetch monetization data')
        } finally {
            setLoading(false)
        }
    }

    const performSteer = async (offerId: string) => {
        setIsSteering(true)
        // In a real scenario, this would update the Neural Broadcaster's destination config
        showToast('Neural Broadcaster Steer Initialized', 'info')
        setTimeout(() => setIsSteering(false), 2000)
    }

    const showToast = (m: string, t: any) => {
        // Mock toast hook integration
        console.log(m, t)
    }

    if (loading) return <div className="h-96 flex items-center justify-center"><TrendingUp className="w-8 h-8 animate-pulse text-indigo-500" /></div>

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Steering Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                        <ArrowRightLeft className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Arbitrage Steering</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Monetization Velocity Engine</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                   <div className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Autonomous Sync: ACTIVE</span>
                   </div>
                   <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-2xl transition-all">
                       Inject Offer Node
                   </button>
                </div>
            </div>

            {/* Active Steering Matrix */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left Column: Metrics & Recommendation */}
                <div className="xl:col-span-1 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden`}>
                        <div className="flex items-center gap-4">
                            <Target className="w-6 h-6 text-indigo-400" />
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Yield Analysis</h5>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Best EPC</span>
                                <h3 className="text-4xl font-black text-emerald-400 italic tracking-tighter uppercase leading-none">
                                    ${manifest?.activeSteer.priority.toFixed(2)}
                                </h3>
                            </div>

                            <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-4">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-4 h-4 text-indigo-400" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Recommended Steer</span>
                                </div>
                                <p className="text-xs font-bold text-white italic leading-relaxed">
                                    {manifest?.recommendation}
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Confidence: HIGH</span>
                                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sync: 42ms</span>
                                </div>
                            </div>
                        </div>

                        <div className="absolute -bottom-10 -right-10 opacity-5">
                            <TrendingUp className="w-40 h-40" />
                        </div>
                    </div>

                    <div className="p-8 bg-indigo-600 rounded-[2.5rem] space-y-4 text-white">
                        <div className="flex items-center justify-between">
                            <PieChart className="w-8 h-8" />
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 italic">Capture Efficiency</span>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black italic tracking-tighter leading-none uppercase">94.2%</h3>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Network ROI Purity</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Offer Ledger */}
                <div className="xl:col-span-2 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8`}>
                        <div className="flex items-center justify-between">
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Monetization Plan</h5>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{manifest?.manifest.length} Active Nodes</span>
                        </div>

                        <div className="space-y-4">
                            {manifest?.manifest.map((offer, idx) => (
                                <div key={idx} className="p-6 bg-black/40 border border-white/5 rounded-3xl group hover:border-indigo-500/30 transition-all">
                                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                      <div className="flex items-center gap-6">
                                         <div className={`p-4 rounded-2xl ${idx === 0 ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-500'} transition-colors`}>
                                             <DollarSign className="w-6 h-6" />
                                         </div>
                                         <div className="space-y-1">
                                            <h6 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{offer.name}</h6>
                                            <div className="flex items-center gap-3">
                                               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{offer.platform}</span>
                                               <div className="w-1 h-1 bg-slate-800 rounded-full" />
                                               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">{offer.category}</span>
                                            </div>
                                         </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-6">
                                         <div className="text-right">
                                            <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">EPC Score</span>
                                            <span className="text-xl font-black text-emerald-400 italic">${offer.priority.toFixed(2)}</span>
                                         </div>
                                         <div className="text-right">
                                            <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">Conv. Rate</span>
                                            <span className="text-xl font-black text-white italic">{(offer.cvr * 100).toFixed(0)}%</span>
                                         </div>
                                         <button 
                                            onClick={() => performSteer(offer.id)}
                                            className={`${idx === 0 ? 'bg-indigo-600' : 'bg-white/5 border border-white/10'} px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest italic hover:scale-105 transition-all`}
                                         >
                                            {idx === 0 ? 'ACTIVE STEER' : 'Steer Engine'}
                                         </button>
                                      </div>
                                   </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
