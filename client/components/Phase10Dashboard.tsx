'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Zap, Users, Brain, Activity, 
  ShieldCheck, Rocket, Database, Network, TrendingUp, AlertTriangle, Crosshair,
  DollarSign, Share2, Server, Terminal, Shield, CheckCircle2, Cloud
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

const glass = 'backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)]'
const pill = 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border'

const SectionHeader = ({ icon: Icon, title, subtitle, color = 'indigo', badge }: any) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/10'
  }

  return (
    <div className="flex items-start justify-between mb-10">
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{title}</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{subtitle}</p>
        </div>
      </div>
      {badge && (
        <span className={`${pill} ${colors[color]}`}>{badge}</span>
      )}
    </div>
  )
}

// ─── Phase 11: Arbitrage Panel ───────────────────────────────────────────────
const ArbitragePanel = () => {
    const { t } = useTranslation()
    const [offers, setOffers] = useState<any[]>([])
    const { showToast } = useToast()

    const loadOffers = async () => {
        try {
            const res = await apiGet('/phase11/arbitrage/offers')
            if (res.offers) setOffers(res.offers)
        } catch {
            showToast(t('phase10Dashboard.failedToLoadActiveOffers'), 'error')
        }
    }

    const steerFunnel = async (offerId: string) => {
        try {
            await apiPost('/phase11/arbitrage/steer', { offerId, targetNiche: 'high_ticket_affiliate' })
            showToast(t('phase10Dashboard.sovereignFunnelSteered', { offerId }), 'success')
        } catch {
            showToast(t('phase10Dashboard.steeringFailed'), 'error')
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadOffers() }, [])

    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={DollarSign} title={t('phase10Dashboard.arbitrageSteeringTitle')} subtitle={t('phase10Dashboard.arbitrageSteeringSubtitle')} color="orange" badge={t('phase10Dashboard.arbitrageSteeringBadge')} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {offers.map(offer => (
                    <div key={offer.id} className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/20 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] text-orange-400 uppercase font-black tracking-widest mb-1">{t('phase10Dashboard.velocityLabel', { velocity: offer.velocity })}</p>
                            <h4 className="text-xl font-black text-[var(--text-main)] italic uppercase mb-4">{offer.name}</h4>
                            <div className="flex gap-4 mb-6">
                                <div className="text-center">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">{t('phase10Dashboard.cvr')}</p>
                                    <p className="text-lg font-black text-white italic">{(offer.conversionRate * 100).toFixed(1)}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">{t('phase10Dashboard.pcv')}</p>
                                    <p className="text-lg font-black text-white italic">${offer.pcv}</p>
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={() => steerFunnel(offer.id)}
                            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-[9px] uppercase tracking-widest transition-all">
                            {t('phase10Dashboard.steerSwarmToThisOffer')}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Phase 12: Encirclement Panel ────────────────────────────────────────────
const EncirclementPanel = () => {
    const { t } = useTranslation()
    const [network, setNetwork] = useState<any>(null)
    const { showToast } = useToast()

    const loadNetwork = async () => {
        try {
            const res = await apiGet('/phase12/s2s/network-health')
            if (res.health !== undefined) setNetwork(res)
        } catch {
            showToast(t('phase10Dashboard.s2sNetworkDown'), 'error')
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadNetwork() }, [])

    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={Terminal} title={t('phase10Dashboard.globalEncirclementTitle')} subtitle={t('phase10Dashboard.globalEncirclementSubtitle')} color="purple" badge={t('phase10Dashboard.godModeActiveBadge')} />
            
            <div className="grid grid-cols-3 gap-6">
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t('phase10Dashboard.networkHealth')}</p>
                    <p className="text-2xl font-black text-white italic">{(network?.health * 100).toFixed(1)}%</p>
                </div>
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t('phase10Dashboard.aggregatedRevenue')}</p>
                    <p className="text-2xl font-black text-white italic">${(network?.overLordStats?.totalRevenueAggregated / 1000000).toFixed(1)}M</p>
                </div>
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">{t('phase10Dashboard.victoryVectors')}</p>
                    <p className="text-2xl font-black text-white italic">{network?.overLordStats?.victoriesToday}</p>
                </div>
            </div>

            <div className="p-8 rounded-[2rem] bg-black/40 border border-white/5 font-mono text-[10px] text-purple-300 leading-relaxed max-h-[200px] overflow-y-auto">
                <p className="">{t('phase10Dashboard.logInitializingTunnel')}</p>
                <p className="">{t('phase10Dashboard.logEncirclementActive', { count: 14 })}</p>
                <p className="">{t('phase10Dashboard.logVectorReceived', { hook: 'e7a1b', cluster: 'Cluster-East' })}</p>
                <p className="">{t('phase10Dashboard.logLocalSynthesis', { percent: 14 })}</p>
            </div>
        </div>
    )
}

// ─── Stability: System Health Panel ──────────────────────────────────────────
const StabilityPanel = () => {
    const { t } = useTranslation()
    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={Shield} title={t('phase10Dashboard.productionStabilityTitle')} subtitle={t('phase10Dashboard.productionStabilitySubtitle')} color="cyan" badge={t('phase10Dashboard.stableBadge')} />

            <div className="space-y-4">
                {[
                    { label: t('phase10Dashboard.stabilityPhase1Label'), status: t('phase10Dashboard.stabilityPhase1Status'), icon: CheckCircle2, color: 'text-emerald-400' },
                    { label: t('phase10Dashboard.stabilityPhase2Label'), status: t('phase10Dashboard.stabilityPhase2Status'), icon: Zap, color: 'text-cyan-400' },
                    { label: t('phase10Dashboard.stabilityPhase3Label'), status: t('phase10Dashboard.stabilityPhase3Status'), icon: Cloud, color: 'text-amber-400' }
                ].map(item => (
                    <div key={item.label} className="flex justify-between items-center p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-4">
                            <item.icon className={`w-5 h-5 ${item.color}`} />
                            <p className="text-xs font-black text-white uppercase tracking-tight">{item.label}</p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 uppercase">{item.status}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Original Phase 10 Components (Fleet/Oracle) ───
const FleetManagementPanel = () => {
    const { t } = useTranslation()
    const [fleetStats, setFleetStats] = useState<any>(null)
    const { showToast } = useToast()
    useEffect(() => {
        const load = async () => {
            const res = await apiGet('/phase10/fleet/status')
            setFleetStats(res.status)
        }
        load()
        const int = setInterval(load, 15000)
        return () => clearInterval(int)
    }, [])
    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={Network} title={t('phase10Dashboard.fleetCommanderTitle')} subtitle={t('phase10Dashboard.fleetCommanderSubtitle')} color="indigo" badge={t('phase10Dashboard.godModeBadge')} />
            <div className="flex items-center gap-6">
                <div className="px-6 py-4 rounded-xl border border-white/10 bg-black/40 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{t('phase10Dashboard.activeNodes')}</p>
                    <p className="text-3xl font-black text-white italic">{fleetStats?.totalNodes || 0}</p>
                </div>
            </div>
        </div>
    )
}

export default function SovereignDashboard() {
  const { t } = useTranslation()
  const SECTIONS = [
    { id: 'fleet', label: t('phase10Dashboard.navFleetCommander'), icon: Network },
    { id: 'arbitrage', label: t('phase10Dashboard.navArbitrageStrategy'), icon: DollarSign },
    { id: 'encirclement', label: t('phase10Dashboard.navGlobalS2s'), icon: Globe },
    { id: 'stability', label: t('phase10Dashboard.navSystemHealth'), icon: Shield }
  ]

  const [activeSection, setActiveSection] = useState('fleet')

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12 px-8">
      {/* Header */}
      <div className="border-b border-white/[0.05] pb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-white/10 flex items-center justify-center">
            <Server className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`${pill} text-purple-400 border-purple-500/20`}>{t('phase10Dashboard.headerPill')}</span>
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-black text-purple-50 italic uppercase tracking-tighter leading-none">{t('phase10Dashboard.headerTitle')}</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">{t('phase10Dashboard.headerSubtitle')}</p>
          </div>
        </div>

        {/* Section Nav */}
        <div className="flex flex-wrap gap-3 pt-6">
          {SECTIONS.map(s => (
            <button type="button" key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${activeSection === s.id ? 'bg-white text-black' : 'bg-white/[0.02] border border-white/10 text-slate-400 hover:text-white'}`}>
              <s.icon className="w-3.5 h-3.5" />{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Section */}
      <AnimatePresence mode="wait">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
            {activeSection === 'fleet' && <FleetManagementPanel />}
            {activeSection === 'arbitrage' && <ArbitragePanel />}
            {activeSection === 'encirclement' && <EncirclementPanel />}
            {activeSection === 'stability' && <StabilityPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
