'use client'

import React, { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  AlertCircle, 
  Sparkles, 
  RefreshCw,
  Zap,
  ChevronRight,
  DollarSign,
  PieChart
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../../lib/api'

interface ForecastDay {
  date: string
  revenue: number
  conversions: number
  confidence: number
  spectralIndicators: {
    multiplier: number
    isElastic: boolean
  }
}

interface SpectralAnalysis {
  daily: ForecastDay[]
  totals: {
    revenue: number
    conversions: number
  }
  spectralAnalysis: {
    sentimentDrift: number
    elasticityState: 'CRITICAL_MARKDOWN' | 'GROWTH_RESONANCE' | 'STABLE_NOISE'
    marketAlignment: string
  }
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const SpectralForecastHUD: React.FC = () => {
    const [data, setData] = useState<SpectralAnalysis | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchForecast()
    }, [])

    const fetchForecast = async () => {
        setLoading(true)
        try {
            const result = await apiGet('/click/forecast')
            setData(result)
        } catch (err) {
            console.error('Forecast fetch failed')
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (state: string) => {
        switch (state) {
            case 'CRITICAL_MARKDOWN': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            case 'GROWTH_RESONANCE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-blue-500 text-white shadow-xl shadow-blue-500/20">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Spectral Revenue HUD</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-blue-500/70">Neural Value Forecasting & Yield Steering</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {data?.spectralAnalysis && (
                        <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 border font-black text-[10px] uppercase tracking-widest italic transition-all ${getStatusColor(data.spectralAnalysis.elasticityState)}`}>
                            {data.spectralAnalysis.elasticityState === 'CRITICAL_MARKDOWN' ? <Activity className="w-3 h-3 animate-pulse" /> : <Zap className="w-3 h-3" />}
                            State: {data.spectralAnalysis.elasticityState.replace(/_/g, ' ')}
                        </div>
                    )}
                    <button 
                        onClick={fetchForecast}
                        disabled={loading}
                        className="p-4 rounded-xl bg-white/5 border border-white/5 text-white hover:bg-white/10 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Total Projected (7d)</span>
                         <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex items-end gap-3">
                        <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none uppercase">
                            ${data?.totals.revenue.toLocaleString() ?? '0'}
                        </h3>
                        <span className="text-[10px] font-black text-emerald-400 uppercase italic pb-1">Spectral</span>
                    </div>
                </div>

                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Neural Conversions</span>
                         <Target className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex items-end gap-3">
                        <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none uppercase">
                            {data?.totals.conversions.toLocaleString() ?? '0'}
                        </h3>
                        <span className="text-[10px] font-black text-blue-400 uppercase italic pb-1">Projected</span>
                    </div>
                </div>

                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Sentiment Drift</span>
                         <Activity className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex items-end gap-3">
                        <h3 className={`text-4xl font-black italic tracking-tighter leading-none uppercase ${
                            (data?.spectralAnalysis.sentimentDrift ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                            {(data?.spectralAnalysis.sentimentDrift ?? 0) * 100}%
                        </h3>
                        <span className="text-[10px] font-black text-slate-500 uppercase italic pb-1">Impact</span>
                    </div>
                </div>

                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Market Alignment</span>
                         <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex items-end gap-3">
                        <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none uppercase">
                            {data?.spectralAnalysis.marketAlignment ?? 'N/A'}
                        </h3>
                        <span className="text-[10px] font-black text-violet-400 uppercase italic pb-1">Trend</span>
                    </div>
                </div>
            </div>

            {/* Main Charts Mock (Phase 21 visualization) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Spectral Projection Chart */}
                <div className={`${glassStyle} xl:col-span-2 rounded-[2.5rem] p-10 space-y-8 h-[450px] relative overflow-hidden group`}>
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Spectral Projection</h5>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1 block italic">7-Day Value Velocity</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Revenue</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-700" />
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Confidence</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-end justify-between gap-4 h-64 relative z-10">
                        {data?.daily.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-4 group/bar">
                                <div className="w-full relative">
                                    <motion.div 
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(day.revenue / (data.totals.revenue / 4)) * 100}%` }}
                                        transition={{ delay: i * 0.1, type: 'spring' }}
                                        className={`w-full rounded-t-2xl relative transition-all group-hover/bar:brightness-110 ${
                                            day.spectralIndicators.isElastic ? 'bg-amber-500/40 border border-amber-500/30' : 'bg-blue-600'
                                        }`}
                                    >
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                            <span className="text-[8px] font-black text-white bg-black/80 px-2 py-1 rounded-md border border-white/10 whitespace-nowrap">
                                                ${day.revenue.toLocaleString()}
                                            </span>
                                        </div>
                                    </motion.div>
                                    <div className="absolute bottom-0 w-full h-1 bg-white/5" />
                                </div>
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter italic">
                                    Day {i + 1}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
                        <TrendingUp className="w-64 h-64" />
                    </div>
                </div>

                {/* Spectral Indicators */}
                <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8 flex flex-col`}>
                    <div className="flex items-center justify-between">
                         <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Growth Signals</h5>
                         <PieChart className="w-5 h-5 text-blue-400" />
                    </div>

                    <div className="space-y-6 flex-1">
                         <div className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sentiment Resonance</span>
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Optimized</span>
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '82%' }}
                                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                />
                             </div>
                         </div>

                         <div className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Viral Velocity</span>
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">High</span>
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '65%' }}
                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                />
                             </div>
                         </div>

                         <div className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                             <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Decay Risk</span>
                                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Low</span>
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: '12%' }}
                                    className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                                />
                             </div>
                         </div>
                    </div>

                    <div className="p-8 bg-blue-600 rounded-[2rem] space-y-4 text-white hover:scale-[1.02] transition-all cursor-pointer group">
                        <div className="flex items-center justify-between">
                            <Zap className="w-8 h-8 opacity-80" />
                            <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic tracking-tighter leading-none uppercase">Yield Pivot</h3>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Trigger autonomous monetization drift</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
