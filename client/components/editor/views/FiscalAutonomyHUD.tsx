'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  TrendingUp,
  Zap,
  Activity,
  Target,
  Wallet,
  Globe,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react'
import { m } from 'framer-motion'
import { apiGet } from '../../../lib/api'

interface FiscalVelocity {
    velocity?: number
    rpd?: number
    epc?: number
    pulseRevenue?: number
    pulseClicks?: number
    timestamp?: string
}

interface MonetizationOffer {
    id: string
    name: string
    platform?: string
    pcv?: number
    conversions?: number
    conversionRate?: number
    velocity?: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-2xl"

const money = (v: unknown, digits = 2) =>
    Number.isFinite(Number(v)) ? `$${Number(v).toFixed(digits)}` : '—'

/**
 * Revenue readout. Tiles come from GET /api/click/fiscal-velocity (last 24h of
 * attributed revenue); the offer list from GET /api/click/monetization-nodes
 * (the user's own monetization plans with real conversion counts).
 */
export const FiscalAutonomyHUD: React.FC = () => {
    const [velocity, setVelocity] = useState<FiscalVelocity | null>(null)
    const [offers, setOffers] = useState<MonetizationOffer[]>([])
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        setFailed(false)
        let failures = 0
        const [v, nodes] = await Promise.all([
            apiGet<FiscalVelocity>('/click/fiscal-velocity', undefined, false).catch(() => { failures += 1; return null }),
            apiGet<MonetizationOffer[]>('/click/monetization-nodes', undefined, false).catch(() => { failures += 1; return null }),
        ])
        setVelocity(v && typeof v === 'object' ? v : null)
        setOffers(Array.isArray(nodes) ? nodes : [])
        setFailed(failures > 0)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    const stats = [
        { label: 'Revenue per hour', value: velocity ? `${money(velocity.velocity)}/hr` : '—', sub: 'Average over the last 24 hours', icon: Zap, color: 'text-indigo-400' },
        { label: 'Revenue per post', value: money(velocity?.rpd), sub: 'Last 24 hours', icon: Globe, color: 'text-emerald-400' },
        { label: 'Earnings per click', value: money(velocity?.epc), sub: 'Last 24 hours', icon: TrendingUp, color: 'text-blue-400' },
        { label: 'Revenue (24h)', value: money(velocity?.pulseRevenue, 0), sub: Number.isFinite(Number(velocity?.pulseClicks)) ? `${Number(velocity?.pulseClicks).toLocaleString()} clicks` : 'Last 24 hours', icon: DollarSign, color: 'text-white' },
    ]

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                    <div className="p-5 rounded-[1.5rem] bg-indigo-600 text-white shadow-xl shadow-indigo-600/20">
                        <Wallet className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Revenue</h4>
                        <span className="text-[11px] font-bold text-slate-500 mt-2 block">What your links and offers earned in the last 24 hours.</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={fetchAll}
                    disabled={loading}
                    aria-label="Refresh revenue"
                    className="p-4 rounded-xl bg-white/5 border border-white/5 text-white hover:bg-white/10 transition-all self-start lg:self-auto"
                >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
            </div>

            {failed && (
                <div role="alert" className={`${glassStyle} rounded-[2rem] p-6 flex items-center gap-3 text-rose-300 text-sm font-semibold`}>
                    <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" /> Some revenue data couldn&apos;t be loaded. Try refreshing.
                </div>
            )}

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, i) => (
                    <m.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`${glassStyle} p-8 rounded-[2.5rem] relative overflow-hidden group`}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity" aria-hidden="true">
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                        <h5 className="text-3xl font-black text-white italic mt-3 tracking-tighter">{stat.value}</h5>
                        <p className={`text-[10px] font-bold mt-2 ${stat.color}`}>{stat.sub}</p>
                    </m.div>
                ))}
            </div>

            {/* Offers */}
            <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden`}>
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h5 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Your offers</h5>
                        <p className="text-[11px] font-bold text-slate-500 mt-2">Products from your monetization plans, best performing first (last 30 days).</p>
                    </div>
                    <Activity className="w-6 h-6 text-indigo-500" aria-hidden="true" />
                </div>

                {offers.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">
                        {loading ? 'Loading…' : 'No active offers yet. Add a product to a monetization plan to see it here.'}
                    </p>
                ) : (
                    <div className="space-y-6">
                        {offers.map((offer) => (
                            <div key={offer.id} className="p-6 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between gap-4 hover:bg-white/[0.08] transition-all">
                                <div className="flex items-center gap-6 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shrink-0">
                                        <Target className="w-6 h-6" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <h6 className="text-[13px] font-black text-white uppercase italic truncate">{offer.name}</h6>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 mt-1 block w-fit">
                                            {offer.platform || 'custom'}{offer.velocity ? ` · ${offer.velocity}` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[14px] font-black text-white italic">{Number(offer.conversions ?? 0).toLocaleString()} sales</div>
                                    <div className="text-[10px] font-black text-slate-400 mt-1">
                                        {Number.isFinite(Number(offer.conversionRate)) ? `${(Number(offer.conversionRate) * 100).toFixed(1)}% of clicks` : '—'}
                                        {Number(offer.pcv) > 0 ? ` · ${money(offer.pcv)}` : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
