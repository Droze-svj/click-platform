'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Activity,
  Target,
  AlertCircle,
  RefreshCw,
  DollarSign,
} from 'lucide-react'
import { m } from 'framer-motion'
import { apiGet } from '../../../lib/api'

interface ForecastDay {
  date: string
  revenue: number
  conversions: number
  confidence: number
  spectralIndicators?: {
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
  spectralAnalysis?: {
    sentimentDrift: number
    elasticityState: string
    marketAlignment?: string
  }
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

// The server sends CRITICAL_MARKDOWN / GROWTH_RESONANCE / STABLE_NOISE.
const stateKey = (state: string) => String(state || '').split('_')[0]
const STATE_LABELS: Record<string, string> = {
  CRITICAL: 'Falling',
  GROWTH: 'Growing',
  STABLE: 'Steady',
}

/**
 * 7-day revenue forecast from GET /api/click/forecast. Every figure shown is
 * a field of that response; when a field is missing the tile shows "—".
 */
export const SpectralForecastHUD: React.FC = () => {
    const [data, setData] = useState<SpectralAnalysis | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    const fetchForecast = useCallback(async () => {
        setLoading(true)
        setFailed(false)
        try {
            const result = await apiGet<SpectralAnalysis>('/click/forecast', undefined, false)
            setData(result && Array.isArray(result.daily) ? result : null)
        } catch (err) {
            console.error('Forecast fetch failed', err)
            setData(null)
            setFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchForecast()
    }, [fetchForecast])

    const getStatusColor = (state: string) => {
        switch (stateKey(state)) {
            case 'CRITICAL': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            case 'GROWTH': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
        }
    }

    const drift = data?.spectralAnalysis && Number.isFinite(Number(data.spectralAnalysis.sentimentDrift))
        ? Number(data.spectralAnalysis.sentimentDrift)
        : null
    const maxDay = data ? Math.max(0, ...data.daily.map(d => Number(d.revenue) || 0)) : 0
    const hasRevenue = !!data && Number(data.totals?.revenue) > 0

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-blue-500 text-white shadow-xl shadow-blue-500/20">
                        <BarChart3 className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Revenue Forecast</h4>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 block">Projected revenue for the next 7 days, based on your past revenue.</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {data?.spectralAnalysis?.elasticityState && (
                        <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 border font-black text-[10px] uppercase tracking-widest transition-all ${getStatusColor(data.spectralAnalysis.elasticityState)}`}>
                            <Activity className="w-3 h-3" aria-hidden="true" />
                            Trend: {STATE_LABELS[stateKey(data.spectralAnalysis.elasticityState)] || data.spectralAnalysis.elasticityState.replace(/_/g, ' ').toLowerCase()}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={fetchForecast}
                        disabled={loading}
                        aria-label="Refresh forecast"
                        className="p-4 rounded-xl bg-white/5 border border-white/5 text-white hover:bg-white/10 transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {failed && (
                <div role="alert" className={`${glassStyle} rounded-[2rem] p-6 flex items-center gap-3 text-rose-300 text-sm font-semibold`}>
                    <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" /> Couldn&apos;t load the forecast. Try refreshing.
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Projected revenue (7 days)</span>
                         <DollarSign className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter leading-none">
                        {data ? `$${Number(data.totals?.revenue ?? 0).toLocaleString()}` : '—'}
                    </h3>
                </div>

                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Projected sales</span>
                         <Target className="w-4 h-4 text-blue-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter leading-none">
                        {data ? Number(data.totals?.conversions ?? 0).toLocaleString() : '—'}
                    </h3>
                </div>

                <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-4`}>
                    <div className="flex items-center justify-between">
                         <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Audience mood change</span>
                         <Activity className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    </div>
                    <h3 className={`text-4xl font-black italic tracking-tighter leading-none ${
                        drift === null ? 'text-slate-500' : drift < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                        {drift === null ? '—' : `${drift > 0 ? '+' : ''}${(drift * 100).toFixed(1)}%`}
                    </h3>
                </div>

            </div>

            {/* Daily projection */}
            <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden`}>
                <div>
                    <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Day by day</h5>
                    <span className="text-[10px] font-bold text-slate-500 mt-1 block">Hover a bar to see the projected revenue for that day.</span>
                </div>

                {!hasRevenue ? (
                    <p className="py-12 text-center text-sm text-slate-500">
                        {loading ? 'Loading…' : 'Not enough revenue history yet to project the next 7 days.'}
                    </p>
                ) : (
                    <div className="flex items-end justify-between gap-4 h-64">
                        {data!.daily.map((day, i) => {
                            const pct = maxDay > 0 ? Math.max(0, Math.min(100, ((Number(day.revenue) || 0) / maxDay) * 100)) : 0
                            return (
                                <div key={day.date || i} className="flex-1 h-full flex flex-col items-center justify-end gap-4 group/bar">
                                    <m.div
                                        initial={{ height: '0%' }}
                                        animate={{ height: `${pct}%` }}
                                        transition={{ delay: i * 0.1, type: 'spring' }}
                                        className="w-full rounded-t-2xl relative bg-blue-600 group-hover/bar:brightness-110"
                                    >
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                            <span className="text-[9px] font-black text-white bg-black/80 px-2 py-1 rounded-md border border-white/10 whitespace-nowrap">
                                                ${Number(day.revenue || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </m.div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                        {day.date ? new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' }) : `Day ${i + 1}`}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
