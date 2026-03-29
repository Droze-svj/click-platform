'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Zap, Brain, Activity, 
  ShieldCheck, Database, Network, TrendingUp, AlertTriangle,
  DollarSign, Terminal, Shield, CheckCircle2, Cloud,
  BarChart3, Orbit, Cpu, ZapOff, ActivityIcon
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import ResonanceCommandMatrix from './EngagementCommandCenter'

const glass = 'backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)]'
const pill = 'px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.4em] border italic shadow-xl'

const SectionHeader = ({ icon: Icon, title, subtitle, color = 'indigo', badge }: any) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.2)]',
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.2)]',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10 shadow-[0_0_30_rgba(168,85,247,0.2)]',
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30_rgba(6,182,212,0.2)]',
    orange: 'text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.2)]',
    fuchsia: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10 shadow-[0_0_30px_rgba(232,121,249,0.2)]'
  }

  return (
    <div className="flex items-start justify-between mb-16 relative z-10">
      <div className="flex items-center gap-8">
        <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center border-2 transition-transform duration-1000 hover:rotate-12 ${colors[color]}`}>
          <Icon className="w-10 h-10" />
        </div>
        <div>
          <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">{title}</h3>
          <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic opacity-60 border-l-2 pl-6 ml-1 border-white/10">{subtitle}</p>
        </div>
      </div>
      {badge && (
        <span className={`${pill} ${colors[color]} animate-pulse`}>{badge}</span>
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

    useEffect(() => { loadOffers() }, [])

    return (
        <div className="space-y-12">
            <SectionHeader icon={DollarSign} title="Arbitrage Steering" subtitle="Live High-Ticket Monetization Engine" color="orange" badge="PHASE 11 ACTIVE" />
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {offers.map(offer => (
                    <motion.div key={offer.id} whileHover={{ y: -10, backgroundColor: 'rgba(249,115,22,0.06)' }}
                      className={`${glass} p-12 flex flex-col justify-between border-orange-500/10 hover:border-orange-500/30 transition-all duration-1000 relative overflow-hidden group min-h-[400px]`}>
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-1000"><DollarSign size={200} /></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-4">
                              <span className="text-[10px] text-orange-400 uppercase font-black tracking-[0.4em] italic px-5 py-2 rounded-full bg-orange-500/5 border border-orange-500/20">{offer.velocity} Velocity Flux</span>
                              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shadow-[0_0_10px_rgba(249,115,22,1)]" />
                            </div>
                            <h4 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-8 leading-tight drop-shadow-2xl">{offer.name}</h4>
                            
                            <div className="flex gap-12 mb-12">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic opacity-40">CONVERSION_RESISTANCE</p>
                                    <p className="text-4xl font-black text-white italic tracking-tighter tabular-nums leading-none">{(offer.conversionRate * 100).toFixed(1)}<span className="text-xl text-orange-400 opacity-40 ml-1">%</span></p>
                                </div>
                                <div className="space-y-2 border-l-2 border-white/10 pl-12">
                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic opacity-40">PAYOUT_CAPITAL_VALUE</p>
                                    <p className="text-4xl font-black text-emerald-400 italic tracking-tighter tabular-nums leading-none"><span className="text-xl opacity-40 mr-1">$</span>{offer.pcv}</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => steerFunnel(offer.id)}
                            className="w-full py-6 rounded-[2.5rem] bg-white text-black font-black text-[14px] uppercase tracking-[0.6em] transition-all duration-700 italic hover:bg-orange-500 hover:text-white shadow-2xl active:scale-95 group relative overflow-hidden">
                            <span className="relative z-10 flex items-center justify-center gap-4">
                                <Zap size={20} className="group-hover:animate-bounce" /> STEER_SWARM_UPLINK
                            </span>
                        </button>
                    </motion.div>
                ))}
                
                {offers.length === 0 && (
                    <div className={`${glass} p-24 text-center col-span-2 flex flex-col items-center justify-center space-y-8 border-dashed border-white/10`}>
                        <ZapOff size={64} className="text-slate-800 opacity-20" />
                        <p className="text-2xl font-black text-slate-800 uppercase tracking-widest italic opacity-40">No latent arbitrage vectors detected.</p>
                    </div>
                )}
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

    useEffect(() => { loadNetwork() }, [])

    const stats = [
        { label: 'Lattice Health', value: network ? (network.health * 100).toFixed(1) : '---', unit: '%', color: 'text-purple-400', icon: ShieldCheck },
        { label: 'Aggregated Revenue', value: network ? (network.overLordStats.totalRevenueAggregated / 1000000).toFixed(1) : '---', unit: 'M+', color: 'text-emerald-400', icon: TrendingUp },
        { label: 'Victory Vectors', value: network ? network.overLordStats.victoriesToday : '---', unit: 'FLUX', color: 'text-fuchsia-400', icon: Zap },
    ]

    return (
        <div className="space-y-16">
            <SectionHeader icon={Terminal} title="Global Encirclement" subtitle="Cross-Sovereign Knowledge Pulse & Encirclement Lattice" color="purple" badge="GOD_MODE_SATURATION_ACTIVE" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {stats.map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className={`${glass} p-12 text-center bg-purple-500/5 group hover:bg-purple-500/10 border-purple-500/10 hover:border-purple-500/40 transition-all duration-1000 rounded-[4rem] relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)]`}>
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-[2s]"><s.icon size={120} /></div>
                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] mb-8 italic opacity-60 leading-none">{s.label}</p>
                        <div className={`text-7xl font-black italic tracking-tighter tabular-nums mb-4 drop-shadow-2xl ${s.color}`}>
                          {s.value}<span className="text-3xl opacity-40 ml-2">{s.unit}</span>
                        </div>
                        <div className="w-12 h-1 bg-purple-500/20 mx-auto rounded-full group-hover:w-24 transition-all duration-1000" />
                    </motion.div>
                ))}
            </div>

            <div className={`${glass} p-12 space-y-8 border-purple-500/20 relative overflow-hidden bg-black/40 shadow-inner group hover:border-purple-500/40 transition-all duration-1000`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <Terminal size={20} className="text-purple-400 animate-pulse" />
                        <span className="text-[11px] font-black text-purple-400 uppercase tracking-[0.6em] italic leading-none">Decentralized Intelligence Ledger</span>
                    </div>
                    <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic opacity-40">SYNC_LATENCY: 12ms</span>
                </div>
                <div className="space-y-4 font-mono text-[13px] text-purple-300 leading-relaxed max-h-[300px] overflow-y-auto pr-8 custom-scrollbar">
                    <p className="opacity-40 uppercase tracking-widest border-b border-purple-500/10 pb-2 mb-4">--- INITIATING SECURE ENCIRCLEMENT ---</p>
                    <p className="flex gap-4"><span>[21:42:01]</span> <span className="text-white font-bold">SYSTEM</span> <span>Initializing S2S encrypted tunnel to sibling node alpha-zero...</span></p>
                    <p className="flex gap-4"><span>[21:42:04]</span> <span className="text-white font-bold">SYSTEM</span> <span>Encirclement active. 14 sibling instances connected across substrate.</span></p>
                    <p className="flex gap-4"><span>[21:43:12]</span> <span className="text-fuchsia-400 font-bold">PULSE</span> <span>Vector Received: Hook &quot;e7a1b&quot; dominating in Cluster-East. Velocity: +142/hr.</span></p>
                    <p className="flex gap-4"><span>[21:43:15]</span> <span className="text-emerald-400 font-bold">UPLINK</span> <span>Local Synthesis updated with +14% velocity weighting from sibling pulse.</span></p>
                    <p className="flex gap-4"><span>[21:44:28]</span> <span className="text-amber-400 font-bold">ROUTING</span> <span>Arbitrage Funnel adjusted in Node_Beta based on sibling ROAS data (2.45x).</span></p>
                    <p className="flex gap-4 animate-pulse"><span>[21:45:00]</span> <span className="text-purple-400 font-bold">STABLE</span> <span>Lattice integrity maintained at 98.4%. Continuing mission.</span></p>
                </div>
            </div>
        </div>
    )
}

// ─── Stability: System Health Panel ──────────────────────────────────────────
const StabilityPanel = () => {
    return (
        <div className="space-y-16">
            <SectionHeader icon={Shield} title="Production Hardening" subtitle="Infrastructure Matrix & Sovereign Resilience Protocol" color="cyan" badge="STABLE SUBSYSTEMS" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {[
                    { label: 'Phase 1: Performance Firewall', status: '82% coverage', icon: CheckCircle2, color: 'text-emerald-400', desc: 'Comprehensive unit & integration test suite' },
                    { label: 'Phase 2: Persistent Identity', status: 'LOCKED', icon: Zap, color: 'text-cyan-400', desc: 'OAuth token persistence & refresh sync' },
                    { label: 'Phase 3: Spectral Storage', status: 'IN_PROGRESS', icon: Cloud, color: 'text-amber-400', desc: 'Direct-to-S3 high-velocity asset migration' }
                ].map((item, i) => (
                    <motion.div key={item.label} whileHover={{ scale: 1.02, backgroundColor: 'rgba(6,182,212,0.03)' }}
                      className={`${glass} p-10 flex flex-col justify-between border-cyan-500/10 hover:border-cyan-500/40 transition-all duration-700 group min-h-[320px] shadow-[0_40px_100px_rgba(0,0,0,0.4)]`}>
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className={`w-14 h-14 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform duration-700`}>
                                   <item.icon className={item.color} size={28} />
                                </div>
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest italic">{item.status}</span>
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">{item.label}</h4>
                                <p className="text-[11px] font-bold text-slate-800 uppercase tracking-widest italic opacity-60 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                        <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden mt-8 border border-white/5">
                            <motion.div initial={{ width: 0 }} animate={{ width: item.status.includes('%') ? item.status : '100%' }} transition={{ duration: 2, delay: i * 0.2 }}
                              className={`h-full bg-gradient-to-r ${item.color.replace('text', 'from')} to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]`} />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className={`p-10 rounded-[3rem] ${glass} bg-rose-500/5 border-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-12 hover:border-rose-500/40 transition-all duration-700 shadow-[0_50px_150px_rgba(244,63,94,0.1)]`}>
                <div className="flex items-center gap-8">
                    <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-pulse"><AlertTriangle className="text-rose-500" size={40} /></div>
                    <div>
                        <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Emergency Node Killswitch</h4>
                        <p className="text-[12px] font-bold text-slate-800 uppercase tracking-[0.4em] italic opacity-60">Instant lattice disconnect // Zero-Day Protocol</p>
                    </div>
                </div>
                <button className="px-16 py-6 bg-rose-600 text-white font-black uppercase text-[15px] tracking-[0.8em] italic rounded-[3rem] hover:bg-rose-700 transition-all shadow-[0_20px_60px_rgba(244,63,94,0.4)] active:scale-95 group overflow-hidden relative">
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    EXECUTE_TERMINATE
                </button>
            </div>
        </div>
    )
}

// ─── Main Sovereign 12 Dashboard Host ──────────────────────────────────────────
export default function Sovereign12Dashboard() {
  const [activeTab, setActiveTab] = useState<'resonance' | 'arbitrage' | 'encirclement' | 'stability'>('resonance')
  
  const TABS = [
    { id: 'resonance', label: 'Resonance Hub', icon: Brain, color: 'indigo' },
    { id: 'arbitrage', label: 'Arbitrage Strategy', icon: DollarSign, color: 'orange' },
    { id: 'encirclement', label: 'Global S2S', icon: Globe, color: 'purple' },
    { id: 'stability', label: 'System Health', icon: Shield, color: 'cyan' }
  ]

  return (
    <div className="min-h-screen bg-transparent pb-48 font-app-sans text-theme-primary">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
          <Orbit size={800} className="text-white absolute -top-40 -left-40 animate-spin-slow" />
          <Network size={1000} className="text-white absolute -bottom-80 -right-60 rotate-[32deg] opacity-[0.05]" />
      </div>

      <div className="max-w-[1700px] mx-auto pt-24 px-10 relative z-10 space-y-20">
        {/* Unified Terminal Header */}
        <header className="flex flex-col xl:flex-row items-center justify-between gap-16 border-b border-white/[0.05] pb-24 relative z-50">
           <div className="flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border-2 border-white/10 rounded-[3rem] flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.3)] group relative overflow-hidden transition-all duration-1000 hover:rotate-12">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Terminal size={48} className="text-white relative z-10 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex flex-col md:flex-row items-center gap-6 mb-4">
                    <div className="flex items-center gap-3">
                       <ActivityIcon size={12} className="text-purple-400 animate-pulse" />
                       <span className="text-[12px] font-black uppercase tracking-[0.5em] text-purple-400 italic leading-none">Sovereign 2026 // v12.0.4</span>
                    </div>
                    <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-black/60 border border-white/5 shadow-inner">
                        <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,1)]" />
                        <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase italic leading-none">OVERLORD_TERMINAL_SYNCED</span>
                    </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                   The Overlord Terminal
                 </h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none opacity-80 border-l-4 border-purple-500/40 pl-8 ml-2">Final Market Encirclement Engine & Global Autonomous Control.</p>
              </div>
           </div>

           {/* High-End Tab Nav */}
           <div className={`flex flex-wrap items-center gap-4 p-5 rounded-[4rem] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative z-10 backdrop-blur-3xl bg-white/[0.01]`}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-5 px-10 py-5 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-700 italic active:scale-95 border ${
                    activeTab === tab.id 
                    ? 'bg-white text-black border-white shadow-[0_20px_80px_rgba(255,255,255,0.1)] scale-105' 
                    : 'text-slate-800 border-transparent hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <tab.icon size={22} className={activeTab === tab.id ? 'text-black' : 'text-slate-800'} />
                  {tab.label}
                </button>
              ))}
           </div>
        </header>

        {/* Content Matrix */}
        <main className="relative z-10 min-h-[800px]">
           <AnimatePresence mode="wait">
              {activeTab === 'resonance' && (
                <motion.div key="resonance" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
                   <div className="scale-[0.9] -mt-24 origin-top">
                      <ResonanceCommandMatrix />
                   </div>
                </motion.div>
              )}

              {activeTab === 'arbitrage' && (
                <motion.div key="arbitrage" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.8 }}>
                   <ArbitragePanel />
                </motion.div>
              )}

              {activeTab === 'encirclement' && (
                <motion.div key="encirclement" initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.8 }}>
                   <EncirclementPanel />
                </motion.div>
              )}

              {activeTab === 'stability' && (
                <motion.div key="stability" initial={{ opacity: 0, rotateX: 45 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0, rotateX: -45 }} transition={{ duration: 0.8 }}>
                   <StabilityPanel />
                </motion.div>
              )}
           </AnimatePresence>
        </main>
      </div>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 120s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.3); border-radius: 10px; }
      `}</style>
    </div>
  )
}
