'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  Target,
  Zap,
  DollarSign,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

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
  activeSteer: ArbitrageOffer | null
  manifest: ArbitrageOffer[]
  autonomyState?: {
    canAutoSteer: boolean
    superiority: string | null
    recommendation: string
  }
  recommendation?: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-default shadow-2xl"

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/**
 * Offer ranking from GET /api/phase10_12/arbitrage/manifest (the user's own
 * monetization offers ranked by conversion rate × price). "Mark as preferred"
 * records a steering decision via POST /api/phase10_12/arbitrage/steer (stored
 * as a SteeringDecision; nothing downstream reads it yet, so the copy only
 * claims that the choice was saved).
 */
export const ArbitrageSteererView: React.FC = () => {
    const { showToast } = useToast()
    const [manifest, setManifest] = useState<ArbitrageManifest | null>(null)
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)
    const [steeringId, setSteeringId] = useState<string | null>(null)
    const [steeredId, setSteeredId] = useState<string | null>(null)

    const fetchManifest = useCallback(async () => {
        setLoading(true)
        setFailed(false)
        try {
            const data = await apiGet<ArbitrageManifest>('/phase10_12/arbitrage/manifest', undefined, false)
            setManifest(data && typeof data === 'object' ? data : null)
        } catch (err) {
            console.error('Failed to fetch monetization data', err)
            setManifest(null)
            setFailed(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchManifest()
    }, [fetchManifest])

    const performSteer = async (offer: ArbitrageOffer) => {
        setSteeringId(offer.id)
        try {
            const res: any = await apiPost('/phase10_12/arbitrage/steer', { offerId: offer.id })
            if (res?.status === 'steered') {
                setSteeredId(String(res.offerId ?? offer.id))
                showToast(`Saved ${res.offerName || offer.name} as your preferred offer.`, 'success')
            } else {
                showToast('Couldn\'t save that choice. Please try again.', 'error')
            }
        } catch {
            showToast('Couldn\'t save that choice. Please try again.', 'error')
        } finally {
            setSteeringId(null)
        }
    }

    if (loading) return <div role="status" aria-label="Loading" className="h-96 flex items-center justify-center"><TrendingUp className="w-8 h-8 animate-pulse text-indigo-500" aria-hidden="true" /></div>

    const offers = Array.isArray(manifest?.manifest) ? manifest!.manifest : []
    const best = manifest?.activeSteer || null

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex items-center gap-6">
                <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                    <ArrowRightLeft className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                    <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Offer ranking</h4>
                    <span className="text-[11px] font-bold text-theme-muted mt-1 block">Which of your offers earns the most per click.</span>
                </div>
            </div>

            {failed && (
                <div role="alert" className={`${glassStyle} rounded-[2rem] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                    <p className="flex items-center gap-3 text-rose-300 text-sm font-semibold"><AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" /> Couldn&apos;t load your offers.</p>
                    <button type="button" onClick={fetchManifest} className="px-6 py-2 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest">Try again</button>
                </div>
            )}

            {!failed && offers.length === 0 ? (
                <div className={`${glassStyle} rounded-[2.5rem] p-10 text-center text-sm text-theme-secondary`}>
                    {manifest?.recommendation || 'No active offers yet. Add a product to a monetization plan to see it ranked here.'}
                </div>
            ) : !failed && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left: best offer */}
                <div className="xl:col-span-1 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden`}>
                        <div className="flex items-center gap-4">
                            <Target className="w-6 h-6 text-indigo-400" aria-hidden="true" />
                            <h5 className="text-xl font-black text-theme-primary italic tracking-tighter uppercase leading-none">Top offer</h5>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Expected earnings per click</span>
                                <h3 className="text-4xl font-black text-emerald-400 italic tracking-tighter uppercase leading-none">
                                    {best ? `$${num(best.priority).toFixed(2)}` : '—'}
                                </h3>
                                {best && <p className="text-xs font-bold text-theme-primary">{best.name}</p>}
                            </div>

                            {manifest?.recommendation && (
                                <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Zap className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                                        <span className="text-[10px] font-black text-theme-primary uppercase tracking-widest">Suggestion</span>
                                    </div>
                                    <p className="text-xs font-bold text-theme-primary leading-relaxed">
                                        {manifest.recommendation}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: offer list */}
                <div className="xl:col-span-2 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8`}>
                        <div className="flex items-center justify-between">
                            <h5 className="text-xl font-black text-theme-primary italic tracking-tighter uppercase leading-none">Your offers</h5>
                            <span className="text-[10px] font-black text-theme-muted uppercase tracking-widest">{offers.length} active</span>
                        </div>

                        <div className="space-y-4">
                            {offers.map((offer) => {
                                const isSteered = steeredId === offer.id
                                const busy = steeringId === offer.id
                                return (
                                <div key={offer.id} className="p-6 bg-surface-card border border-subtle rounded-3xl group hover:border-indigo-500/30 transition-all">
                                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                      <div className="flex items-center gap-6 min-w-0">
                                         <div className={`p-4 rounded-2xl ${isSteered ? 'bg-indigo-500 text-white' : 'bg-white/5 text-theme-muted'} transition-colors`}>
                                             <DollarSign className="w-6 h-6" aria-hidden="true" />
                                         </div>
                                         <div className="space-y-1 min-w-0">
                                            <h6 className="text-lg font-black text-theme-primary italic tracking-tighter uppercase leading-none truncate">{offer.name}</h6>
                                            <span className="text-[9px] font-black text-theme-muted uppercase tracking-widest">{offer.platform}</span>
                                         </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-6">
                                         <div className="text-right">
                                            <span className="text-[8px] font-black text-theme-muted uppercase block mb-1">Per click</span>
                                            <span className="text-xl font-black text-emerald-400 italic">${num(offer.priority).toFixed(2)}</span>
                                         </div>
                                         <div className="text-right">
                                            <span className="text-[8px] font-black text-theme-muted uppercase block mb-1">Conversion rate</span>
                                            <span className="text-xl font-black text-theme-primary italic">{(num(offer.cvr) * 100).toFixed(1)}%</span>
                                         </div>
                                         <button
                                            type="button"
                                            onClick={() => performSteer(offer)}
                                            disabled={busy || steeringId !== null}
                                            className={`${isSteered ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'} px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all flex items-center gap-2 disabled:opacity-60`}
                                         >
                                            {busy ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : isSteered ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : null}
                                            {isSteered ? 'Preferred' : 'Mark as preferred'}
                                         </button>
                                      </div>
                                   </div>
                                </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    )
}
