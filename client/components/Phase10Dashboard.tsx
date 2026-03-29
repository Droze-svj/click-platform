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
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">{title}</h3>
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
    const [offers, setOffers] = useState<any[]>([])
    const { showToast } = useToast()

    const loadOffers = async () => {
        try {
            const res = await apiGet('/phase11/arbitrage/offers')
            if (res.offers) setOffers(res.offers)
        } catch {
            showToast('Failed to load active offers', 'error')
        }
    }

    const steerFunnel = async (offerId: string) => {
        try {
            await apiPost('/phase11/arbitrage/steer', { offerId, targetNiche: 'high_ticket_affiliate' })
            showToast(`Sovereign Funnel steered to Offer: ${offerId}`, 'success')
        } catch {
            showToast('Steering failed', 'error')
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadOffers() }, [])

    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={DollarSign} title="Arbitrage Steering" subtitle="Live High-Ticket Monetization" color="orange" badge="PHASE 11" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {offers.map(offer => (
                    <div key={offer.id} className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/20 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] text-orange-400 uppercase font-black tracking-widest mb-1">{offer.velocity} velocity</p>
                            <h4 className="text-xl font-black text-white italic uppercase mb-4">{offer.name}</h4>
                            <div className="flex gap-4 mb-6">
                                <div className="text-center">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">CVR</p>
                                    <p className="text-lg font-black text-white italic">{(offer.conversionRate * 100).toFixed(1)}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase">PCV</p>
                                    <p className="text-lg font-black text-white italic">${offer.pcv}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => steerFunnel(offer.id)}
                            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-black text-[9px] uppercase tracking-widest transition-all">
                            Steer Swarm to this Offer
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Phase 12: Encirclement Panel ────────────────────────────────────────────
const EncirclementPanel = () => {
    const [network, setNetwork] = useState<any>(null)
    const { showToast } = useToast()

    const loadNetwork = async () => {
        try {
            const res = await apiGet('/phase12/s2s/network-health')
            if (res.health !== undefined) setNetwork(res)
        } catch {
            showToast('S2S Network down', 'error')
        }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadNetwork() }, [])

    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={Terminal} title="Global Encirclement" subtitle="Cross-Sovereign Knowledge Pulse" color="purple" badge="GOD MODE ACTIVE" />
            
            <div className="grid grid-cols-3 gap-6">
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Network Health</p>
                    <p className="text-2xl font-black text-white italic">{(network?.health * 100).toFixed(1)}%</p>
                </div>
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Aggregated Revenue</p>
                    <p className="text-2xl font-black text-white italic">${(network?.overLordStats?.totalRevenueAggregated / 1000000).toFixed(1)}M</p>
                </div>
                <div className={`${glass} p-6 text-center bg-purple-500/5`}>
                    <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest mb-1">Victory Vectors</p>
                    <p className="text-2xl font-black text-white italic">{network?.overLordStats?.victoriesToday}</p>
                </div>
            </div>

            <div className="p-8 rounded-[2rem] bg-black/40 border border-white/5 font-mono text-[10px] text-purple-300 leading-relaxed max-h-[200px] overflow-y-auto">
                <p className="">[SYSTEM] Initializing S2S encrypted tunnel...</p>
                <p className="">[SYSTEM] Encirclement active. 14 sibling instances connected.</p>
                <p className="">[PULSE] Vector Received: Hook &quot;e7a1b&quot; dominating in Cluster-East.</p>
                <p className="">[PULSE] Local Synthesis updated with +14% velocity weighting.</p>
            </div>
        </div>
    )
}

// ─── Stability: System Health Panel ──────────────────────────────────────────
const StabilityPanel = () => {
    return (
        <div className={`${glass} p-10 space-y-8`}>
            <SectionHeader icon={Shield} title="Production Stability" subtitle="Infrastructure Hardening Matrix" color="cyan" badge="STABLE" />
            
            <div className="space-y-4">
                {[
                    { label: 'Phase 1: Quality Wall (Tests)', status: '82% coverage', icon: CheckCircle2, color: 'text-emerald-400' },
                    { label: 'Phase 2: OAuth Persistence', status: 'Healthy', icon: Zap, color: 'text-cyan-400' },
                    { label: 'Phase 3: S3 Asset Migration', status: 'In Progress', icon: Cloud, color: 'text-amber-400' }
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
            <SectionHeader icon={Network} title="Fleet Commander" subtitle="Multi-Tenant Node Orchestration" color="indigo" badge="GOD MODE" />
            <div className="flex items-center gap-6">
                <div className="px-6 py-4 rounded-xl border border-white/10 bg-black/40 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Active Nodes</p>
                    <p className="text-3xl font-black text-white italic">{fleetStats?.totalNodes || 0}</p>
                </div>
            </div>
        </div>
    )
}

export default function SovereignDashboard() {
  const SECTIONS = [
    { id: 'fleet', label: 'Fleet Commander', icon: Network },
    { id: 'arbitrage', label: 'Arbitrage Strategy', icon: DollarSign },
    { id: 'encirclement', label: 'Global S2S', icon: Globe },
    { id: 'stability', label: 'System Health', icon: Shield }
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
              <span className={`${pill} text-purple-400 border-purple-500/20`}>Sovereign 2026 — Phase 12</span>
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-black text-purple-50 italic uppercase tracking-tighter leading-none">The Overlord Terminal</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Final Market Encirclement Engine</p>
          </div>
        </div>

        {/* Section Nav */}
        <div className="flex flex-wrap gap-3 pt-6">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
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
