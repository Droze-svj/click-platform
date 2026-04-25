'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Globe, Zap, Activity, Cpu, 
  BarChart3, Coins, Database, Server,
  Lock, RefreshCw, Layers, Radio, Orbit,
  Brain, Flame, Sparkles, TrendingUp
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

const glass = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.6)]'
const pill = 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border'

// ─── Stat Card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, subValue, color = 'indigo' }: any) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
  }

  return (
    <div className={`${glass} p-8 flex flex-col gap-4 relative overflow-hidden group`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">{label}</p>
        <p className="text-3xl font-black text-white leading-none italic">{value}</p>
        {subValue && <p className={`text-[10px] font-bold mt-2 ${colors[color]} opacity-80 uppercase tracking-wider`}>{subValue}</p>}
      </div>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700`} />
    </div>
  )
}

// ─── Click Sub-Components ──────────────────────────────────────────────
const SyndicateDebate = ({ debate, onExecute }: any) => (
  <div className={`${glass} p-10 space-y-8`}>
    <div className="flex items-center justify-between">
      <h3 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
        <Cpu className="w-6 h-6 text-indigo-400" />
        Syndicate Debate (Neural Council)
      </h3>
      <span className={`${pill} text-indigo-400 border-indigo-500/20`}>Phase 23 Consenus Protocol</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {(debate || [
        { name: 'Viralist', status: 'APPROVE', mood: 'Aggressive', color: 'emerald', text: 'Hook kinetic energy at 92%. Pattern interrupt confirmed.' },
        { name: 'Economizer', status: 'APPROVE', mood: 'Stable', color: 'indigo', text: 'Yield Gap < 5%. Profit density optimized for Shadow-Relay.' },
        { name: 'Retention Arch', status: 'REFINE', mood: 'Analytical', color: 'amber', text: 'Bridge at 03:45 shows 12% drop potential. Prepend retention hook.' },
        { name: 'Niche Infiltrator', status: 'APPROVE', mood: 'Stealth', color: 'purple', text: 'Arbitrage match: "Agentic Workflows" rising in Tokyo niche.' }
      ]).map((a: any, i: number) => (
        <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-white uppercase">{a.name}</span>
            <span className={`text-[8px] font-black text-${a.color}-400 px-2 py-0.5 rounded-full border border-${a.color}-500/20`}>{a.status}</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">"{a.text}"</p>
        </div>
      ))}
    </div>
  </div>
);

const GovernanceLedger = ({ actions }: any) => (
  <div className={`${glass} p-10 space-y-8`}>
    <h3 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
      <Shield className="w-6 h-6 text-emerald-400" />
      Governance Ledger (Immutable)
    </h3>
    <div className="space-y-4">
      {actions.slice(0, 5).map((a: any, i: number) => (
        <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${a.severity === 'high' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <p className="text-xs font-black text-white uppercase tracking-tight">{a.actionType}</p>
          </div>
          <p className="text-[10px] text-slate-500 font-mono italic">{a.justification?.substring(0, 50)}...</p>
        </div>
      ))}
    </div>
  </div>
);

const ComplianceShield = ({ status }: any) => (
  <div className={`${glass} p-8 space-y-6`}>
    <div className="flex items-center justify-between">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Compliance Shield</h4>
      <span className="text-emerald-400 text-[10px] font-black">{status.status}</span>
    </div>
    <div className="flex items-center gap-4">
      <Globe className="w-12 h-12 text-emerald-500/50" />
      <div>
        <p className="text-2xl font-black text-white italic leading-none">{status.regionsBlocked} BLOCKS</p>
        <p className="text-[9px] font-bold text-slate-500 uppercase mt-2">Autonomous regional gating</p>
      </div>
    </div>
  </div>
);

const FleetExpansionMonitor = ({ fleet }: any) => (
  <div className={`${glass} p-8 space-y-6`}>
    <div className="flex items-center justify-between">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Fleet Scaling</h4>
      <span className="text-indigo-400 text-[10px] font-black italic">CONSERVATIVE</span>
    </div>
    <div className="space-y-4">
      <div className="flex justify-between text-[10px] font-black uppercase italic">
        <span className="text-slate-500">Node Calibration</span>
        <span className="text-white">{fleet.timeRemaining} LEFT</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: '65%' }} />
      </div>
      <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest text-center">Spawning Shadow Node Alpha-9</p>
    </div>
  </div>
);

// ─── Component ─────────────────────────────────────────────────────────────
export default function OverlordDashboard() {
  const [fleetStatus, setFleetStatus] = useState<any>(null)
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [manifest, setManifest] = useState<any>(null)
  const [ledger, setLedger] = useState<any>(null)
  const [activeMetrics, setActiveMetrics] = useState<any>(null)
  const [syndicateDebate, setSyndicateDebate] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any>([])
  const [complianceStatus, setComplianceStatus] = useState<any>(null)
  const [fleetExpansion, setFleetExpansion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const { showToast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [fleetRes, manifestRes, ledgerRes, healthRes, clickPulse, clickForecast, clickLedger, clickArbitrage] = await Promise.all([
        apiGet('/phase10_12/fleet/status'),
        apiGet('/phase10_12/arbitrage/manifest'),
        apiGet('/phase10_12/intelligence/ledger'),
        apiGet('/phase10_12/fleet/health'),
        apiGet('/click/pulse'),
        apiGet('/click/forecast'),
        apiGet('/click/ledger'),
        apiGet('/click/arbitrage')
      ])
      if (fleetRes) setFleetStatus(fleetRes)
      if (manifestRes) setManifest(manifestRes)
      if (ledgerRes) setLedger(ledgerRes)
      if (healthRes) setHealthStatus(healthRes)
      
      if (clickPulse && clickForecast && fleetRes) {
        setActiveMetrics({
          convergence: clickPulse?.telemetry?.potency || 0,
          activeNodes: fleetRes?.nodes?.length || 0,
          projectedYield: clickForecast?.totals?.revenue || 0,
          vibePotency: clickPulse?.telemetry?.avgSentiment || 'STABLE'
        })
      }
      
      if (clickLedger) setAuditLog(clickLedger)
      setComplianceStatus({ status: 'SECURE', regionsBlocked: 1 })
      setFleetExpansion({ activeNodes: fleetRes?.nodes?.length || 0, pendingNodes: 1, revenueThreshold: 5000, timeRemaining: '31h' })
    } catch (err) {
      console.error('Telemetry fetch failed', err)
      showToast('Neural link lag detected', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  const triggerPulse = async () => {
    try {
      await apiPost('/phase10_12/intelligence/pulse', { tactic: 'Deep-Cognition Hooks' })
      showToast('Global Knowledge Pulse Emitted', 'success')
      fetchData()
    } catch {
      showToast('Pulse failed', 'error')
    }
  }

  const runVerification = async () => {
    setVerifying(true)
    try {
      const result = await apiPost('/phase10_12/fleet/verify-network', {})
      showToast('Network Verification Cycle Complete', 'success')
      console.log('Verification Results:', result)
      fetchData()
    } catch (err) {
      showToast('Network verification failed', 'error')
    } finally {
      setVerifying(false)
    }
  }

  if (loading && !fleetStatus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-10 md:py-16 px-6 md:px-10 space-y-12 md:space-y-16">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/[0.05] pb-10 md:pb-12 gap-8 lg:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 flex-shrink-0">
            <Shield className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`${pill} text-indigo-400 border-indigo-500/20`}>Overlord Terminal v1.1 [Phase 13 Active]</span>
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Command Center</h1>
            <p className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-[0.4em] mt-3">Universal Fleet Orchestration</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button 
            onClick={runVerification}
            disabled={verifying}
            className={`px-6 py-3 rounded-2xl ${verifying ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'} font-black text-[10px] uppercase tracking-widest transition-all`}
          >
            {verifying ? 'Verifying Network...' : 'Run Global Verification'}
          </button>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Targeting Matrix</p>
            <div className="flex items-center gap-2 justify-end">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <p className="text-lg font-black text-white italic uppercase tracking-tight">System Armed</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Integrity Monitor (New Panel) ── */}
      <div className={`${glass} p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10`}>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Database Node</p>
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-400" />
            <p className="text-lg font-black text-white italic uppercase leading-none">{healthStatus?.database.status || 'Checking...'}</p>
          </div>
          <div className="flex gap-2">
            {healthStatus?.database.mongodb && <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-1.5 py-0.5 rounded">Mongo</span>}
            {healthStatus?.database.prisma && <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-1.5 py-0.5 rounded">Prisma</span>}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cache Cluster</p>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <p className="text-lg font-black text-white italic uppercase leading-none">{healthStatus?.cache.status || 'Checking...'}</p>
          </div>
          <p className="text-[9px] font-mono text-slate-500">{healthStatus?.cache.type} | Latency: {healthStatus?.cache.latency}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Swarm Queue</p>
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-purple-400" />
            <p className="text-lg font-black text-white italic uppercase leading-none">{healthStatus?.queue.status || 'Checking...'}</p>
          </div>
          <p className="text-[9px] font-mono text-slate-500">{healthStatus?.queue.type} | Pending: {healthStatus?.queue.pending}</p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Platform API</p>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-emerald-400" />
            <p className="text-lg font-black text-white italic uppercase leading-none">{healthStatus?.api.status || 'Checking...'}</p>
          </div>
          <p className="text-[9px] font-mono text-slate-500">Nexus Version: {healthStatus?.api.version}</p>
        </div>
      </div>

      {/* ── Vision Hub (New Phase 14) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className={`${glass} p-10 col-span-2 space-y-8`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Vision Engine Performance</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Neural Rendering & Auto-Correction Health</p>
            </div>
            <div className="flex gap-4">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-indigo-500/20">4K Upscaling: ACTIVE</span>
              <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-purple-500/20">B-Roll IA: ARMED</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-8">
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Avg. Resolution</p>
              <p className="text-3xl font-black text-white italic">1080P<span className="text-indigo-500">+</span></p>
              <p className="text-[8px] font-bold text-emerald-500 mt-1 uppercase tracking-tighter">↑ 42% via Auto-Upscale</p>
            </div>
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Viral Projection</p>
              <p className="text-3xl font-black text-white italic">84<span className="text-purple-500">/100</span></p>
              <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Fleet Aggregate Baseline</p>
            </div>
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">B-Roll Coverage</p>
              <p className="text-3xl font-black text-white italic">31<span className="text-indigo-500">%</span></p>
              <p className="text-[8px] font-bold text-indigo-400 mt-1 uppercase tracking-tighter">Optimal Engagement Density</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-6`}>
          <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Network Verifier</h3>
          <div className="space-y-4">
            {['LinkedIn', 'Twitter', 'Facebook', 'Instagram'].map((p) => (
              <div key={p} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-bold text-slate-300">{p}</span>
                </div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Verified</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Global Reach (New Phase 15) ── */}
      <div className={`${glass} p-10 mt-10 space-y-8`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Global Reach Expansion</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Multi-Language Broadcasting & Localized Engagement</p>
          </div>
          <div className="flex -space-x-2">
            {['🇺🇸', '🇪🇸', '🇫🇷', '🇮🇳', '🇧🇷'].map((f, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-sm shadow-xl">{f}</div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Regions</p>
            <p className="text-2xl font-black text-white">12<span className="text-emerald-500 text-sm italic ml-1">Live</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Translation Accuracy</p>
            <p className="text-2xl font-black text-white">98.4<span className="text-indigo-500 text-sm ml-1">%</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Velocity</p>
            <p className="text-2xl font-black text-white">4.2x<span className="text-purple-500 text-sm ml-1">reach</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Burn-in Success</p>
            <p className="text-2xl font-black text-white">100<span className="text-emerald-500 text-sm ml-1">%</span></p>
          </div>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <div className="flex items-center gap-6 overflow-x-auto pb-4 no-scrollbar">
          {[
            { lang: 'English', status: 'Primary', reach: '2.4M' },
            { lang: 'Spanish', status: 'Broadcasting', reach: '1.2M' },
            { lang: 'Hindi', status: 'Broadcasting', reach: '840K' },
            { lang: 'French', status: 'Optimizing', reach: '420K' },
            { lang: 'Mandarin', status: 'Initializing', reach: '10K' },
          ].map((l) => (
            <div key={l.lang} className="min-w-[160px] p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] space-y-2">
              <p className="text-xs font-black text-white uppercase italic">{l.lang}</p>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{l.status}</span>
                <span className="text-[10px] font-black text-indigo-400">{l.reach}</span>
              </div>
              <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[60%]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Click Nexus (New Phase 16) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-2 space-y-8`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Click Nexus</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Real-Time Team Orchestration & Agency Pulse</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Presence Active</span>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-l-2 border-indigo-500 pl-4">Active Operations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { user: 'S. Rodriguez', action: 'Reviewing Spanish Hooks', room: 'Project: Solar Swarm', time: 'Live' },
                { user: 'M. Gupta', action: 'Linguistic Verification', room: 'Project: Nexus Core', time: 'Live' },
                { user: 'J. Chen', action: 'Adjusting Burn-in Subs', room: 'Project: Alpha Fleet', time: '2m ago' },
                { user: 'A. Volkov', action: 'Approving Final Render', room: 'Project: Omega Swarm', time: '5m ago' },
              ].map((op, i) => (
                <div key={i} className="p-5 bg-white/[0.02] rounded-2xl border border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                      <span className="text-xs font-black text-white">{op.user.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{op.user}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{op.action}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">{op.room}</p>
                    <p className="text-[8px] font-bold text-slate-600 mt-1">{op.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Urgent Review</h3>
            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-[10px] font-black border border-rose-500/30">4</span>
          </div>
          
          <div className="space-y-4">
            {[
              { title: 'Tiktok: Viral Spanish Hook', reviewer: 'Required: Linguistic', sla: '14m left', priority: 'High' },
              { title: 'Twitter: Global Post #42', reviewer: 'Required: Admin', sla: '1h 20m', priority: 'Medium' },
              { title: 'YouTube: Solar Dev Update', reviewer: 'Required: Producer', sla: '3h 45m', priority: 'Medium' },
              { title: 'Instagram: Bio-Gen Promo', reviewer: 'Required: Linguistic', sla: 'Overdue', priority: 'Critical' },
            ].map((task, i) => (
              <div key={i} className={`p-4 rounded-2xl border ${task.priority === 'Critical' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/[0.02] border-white/[0.05]'} space-y-3`}>
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black text-white leading-tight pr-4">{task.title}</p>
                  <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                    task.priority === 'Critical' ? 'bg-rose-500 text-white' : 
                    task.priority === 'High' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>{task.priority}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{task.reviewer}</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase ${task.sla.includes('left') || task.sla === 'Overdue' ? 'text-rose-400' : 'text-slate-500'}`}>{task.sla}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 transition-all rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-indigo-500/20">
            Open Review Terminal
          </button>
        </div>
      </div>

      {/* ── Revenue Hub (New Phase 17) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-3 space-y-8`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Revenue Hub</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Click Monetization Health & Conversion Velocity</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase">Provider:</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Whop Cloud 🟢</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monetization Health</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">94%</span>
                <span className="text-xs font-bold text-emerald-500 mb-1">+4.2%</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[94%]" />
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">ROI optimization active</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conversion Velocity</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">0.82</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">RPC</span>
              </div>
              <div className="flex gap-1 h-8 items-end">
                {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                  <div key={i} className="flex-1 bg-indigo-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Real-time revenue delta</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Checkout Triggers</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">12</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Active</span>
              </div>
              <div className="flex items-center -space-x-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[8px] font-black text-white">
                    {i}
                  </div>
                ))}
                <span className="text-[8px] font-bold text-slate-600 pl-4">+8 More</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Inlay threshold: 0.85</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8`}>
          <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Top Converters</h3>
          <div className="space-y-6">
            {[
              { name: 'Elite AI Course', price: '$99', rpv: '$1.42', status: 'Viral' },
              { name: 'Viral Masterclass', price: '$47', rpv: '$0.98', status: 'Rising' },
              { name: 'Inner Circle', price: '$199', rpv: '$2.10', status: 'Stable' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div>
                  <p className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors uppercase">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-500">{p.price}</span>
                    <span className="text-[7px] font-black px-1.5 py-0.5 bg-white/[0.05] rounded text-slate-400 uppercase tracking-widest">{p.status}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-emerald-500">{p.rpv}</p>
                  <p className="text-[8px] font-bold text-slate-600 uppercase">RPV</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 border border-white/10 hover:bg-white/[0.05] transition-all rounded-2xl text-[10px] font-black text-white uppercase tracking-widest">
            View All Products
          </button>
        </div>
      </div>

      {/* ── Click Strategist (New Phase 18) ── */}
      <div className={`${glass} p-12 space-y-10 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Brain className="w-64 h-64 text-indigo-500" />
        </div>
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`${pill} text-purple-400 border-purple-500/20`}>Phase 18: Predictive Strategist ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Click Strategist</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-3">Autonomous A/B Swarm & Viral Potential Matrix</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Strategic Alpha</p>
            <p className="text-3xl font-black text-purple-400 italic font-mono">+32.4%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative z-10">
          <div className="lg:col-span-2 space-y-6">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-3">
              <Flame className="w-4 h-4 text-orange-500" />
              Live Viral Heatmap: Hook Potency
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Kinetic Sharpness', score: 92, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
                { label: 'Emotional Polarity', score: 78, color: 'text-rose-400', bg: 'bg-rose-500/20' },
                { label: 'Pattern-Interrupt', score: 85, color: 'text-amber-400', bg: 'bg-amber-500/20' }
              ].map((m, i) => (
                <div key={i} className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                  <div className="flex items-end justify-between">
                    <span className={`text-4xl font-black italic ${m.color}`}>{m.score}%</span>
                    <TrendingUp className={`w-5 h-5 ${m.color} opacity-50`} />
                  </div>
                  <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={`h-full ${m.bg} w-[${m.score}%]`} style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-8 bg-white/[0.01] rounded-[2rem] border border-white/[0.03] space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active A/B Swarm Status</p>
                <div className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { id: 'SWRM-42', platform: 'TikTok', status: 'Crowned', winner: 'Variant A', gain: '+42% Views' },
                  { id: 'SWRM-43', platform: 'YouTube', status: 'Fighting', winner: 'In Progress', gain: '---' }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Radio className={`w-4 h-4 ${s.status === 'Crowned' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white">{s.id} <span className="text-slate-500">[{s.platform}]</span></p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase">{s.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-black uppercase ${s.status === 'Crowned' ? 'text-emerald-400' : 'text-slate-400'}`}>{s.winner}</p>
                      <p className="text-[8px] font-bold text-slate-700 tracking-tighter">{s.gain}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${glass} p-10 space-y-8 flex flex-col justify-between`}>
            <div className="space-y-6">
              <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Strategic Protocol
              </h3>
              <div className="space-y-4">
                {[
                  { rule: 'Champion vs. Challenger', status: 'ACTIVE' },
                  { rule: 'Auto-Killer Deletion', status: 'ENABLED' },
                  { rule: 'Hybrid Limit 6h/1k', status: 'READY' }
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                    <span className="text-[10px] font-black text-slate-300 uppercase">{r.rule}</span>
                    <span className={`text-[8px] font-black px-2 py-1 rounded ${r.status === 'ACTIVE' || r.status === 'ENABLED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-8">
              <button className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] transition-all rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/40">
                Deploy A/B Swarm Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Long-Tail Resurrection (New Phase 19) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-3 space-y-8 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <RefreshCw className="w-48 h-48 text-emerald-500 animate-[spin_20s_linear_infinite]" />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Long-Tail Resurrection</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Autonomous Asset Recycling & Legacy Neural Bridge</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Neural Bridge: Syncing ⚡️</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resurrection Signal</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">88%</span>
                <span className="text-xs font-bold text-emerald-500 mb-1">Optimal</span>
              </div>
              <div className="flex gap-1 h-12 items-end">
                {[60, 40, 80, 50, 90, 70, 85].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Legacy momentum detected</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dark Assets Found</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">24</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Un-Neuralized</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase">
                  <span>Indexing Progress</span>
                  <span>75%</span>
                </div>
                <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[75%]" />
                </div>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Scanning /raw_legacy...</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Remixes</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">7</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Rendering</span>
              </div>
              <div className="flex -space-x-2 pt-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 overflow-hidden flex items-center justify-center text-[8px] font-black text-white">
                    R-{i}
                  </div>
                ))}
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">AI Hooks: Prepending</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8 flex flex-col justify-between relative overflow-hidden`}>
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
              <Radio className="w-5 h-5 text-emerald-400" />
              Resurrection Queue
            </h3>
            <div className="space-y-4">
              {[
                { title: 'Golden Record #12', type: 'High engagement', signal: '92%' },
                { title: 'Legacy Clip: Prowess', type: 'Un-neuralized', signal: '74%' },
                { title: 'Archive: Solar Post', type: 'Resurrection Candidate', signal: '88%' }
              ].map((q, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                  <div>
                    <p className="text-[10px] font-black text-white uppercase">{q.title}</p>
                    <p className="text-[8px] font-bold text-slate-600 uppercase mt-0.5">{q.type}</p>
                  </div>
                  <span className="text-[10px] font-black text-emerald-400 font-mono">{q.signal}</span>
                </div>
              ))}
            </div>
          </div>
          
          <button className="w-full py-4 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 font-black text-[10px] uppercase tracking-widest transition-all rounded-2xl">
            Manual Resurrection Scan
          </button>
        </div>
      </div>

      {/* ── Community Pulse (New Phase 20) ── */}
      <div className={`${glass} p-12 space-y-10 relative overflow-hidden mt-10`}>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent opacity-50" />
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`${pill} text-emerald-400 border-emerald-500/20`}>Phase 20: Hyper-Sensitive Pulse ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Community Pulse</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-3">Autonomous Sentiment Drift & Vibe Shift Analysis</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Resonance Velocity</p>
            <p className="text-3xl font-black text-emerald-400 italic font-mono">+12.4% / hr</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
          <div className="lg:col-span-1 space-y-6">
            <div className={`p-8 ${glass} flex flex-col items-center justify-center text-center space-y-4`}>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Vibe</p>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-[spin_3s_linear_infinite]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 85%)' }} />
                <span className="text-2xl font-black text-white italic">85<span className="text-xs text-emerald-400">%</span></span>
              </div>
              <p className="text-xs font-black text-emerald-400 uppercase italic">Reaching Resonance</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                <span>Threat Level</span>
                <span className="text-emerald-500">LOW</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[15%]" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
              <Activity className="w-4 h-4 text-emerald-500" />
              Sentiment Drift (Last 24h vs Baseline)
            </h4>
            <div className="h-64 bg-white/[0.02] rounded-3xl border border-white/[0.05] relative overflow-hidden p-6 flex items-end gap-2">
              {[20, 35, 45, 30, 60, 55, 75, 40, 85, 50, 95, 80].map((h, i) => (
                <div key={i} className="flex-1 group relative">
                  <div className="w-full bg-indigo-500 opacity-20 rounded-t-sm absolute bottom-0 h-[70%]" />
                  <div className="w-full bg-emerald-500 rounded-t-sm relative z-10 hover:opacity-100 transition-opacity" style={{ height: `${h}%`, opacity: 0.8 }} />
                  {i === 10 && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded italic">SPIKE</div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase tracking-widest">
              <span>00:00</span>
              <span>08:00</span>
              <span>16:00</span>
              <span>Now</span>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Pulse Archetypes</h4>
            <div className="space-y-3">
              {[
                { label: 'Feature Hype', score: 92, color: 'emerald' },
                { label: 'Educational Value', score: 78, color: 'indigo' },
                { label: 'Price Diffraction', score: 12, color: 'rose' },
                { label: 'Community Bonding', score: 65, color: 'purple' }
              ].map((a, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black text-white uppercase">
                    <span>{a.label}</span>
                    <span>{a.score}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className={`h-full bg-${a.color}-500 w-[${a.score}%]`} style={{ width: `${a.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">AI Recommendation</p>
                <p className="text-[10px] font-bold text-slate-300 leading-tight italic">Detecting minor "Pricing Diffraction". Deploying "Value-Transparency" hook variation suggested.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Click Econometrics (New Phase 21) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-3 space-y-8 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <TrendingUp className="w-48 h-48 text-indigo-500" />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Click Econometrics</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Spectral Revenue Forecasting & Yield Optimization</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Projection Model: High-Fidelity 💎</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">7D Yield Forecast</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">$42.8k</span>
                <span className="text-xs font-bold text-emerald-500 mb-1">+$5.2k</span>
              </div>
              <div className="relative h-16 w-full pt-4">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-lg overflow-hidden">
                  <div className="h-full bg-indigo-500/30 w-[85%] blur-sm" />
                </div>
                <div className="relative z-10 h-full flex items-end justify-between px-2 pb-2">
                  {[40, 60, 45, 80, 70, 90, 85].map((h, i) => (
                    <div key={i} className="w-1 bg-white/40 rounded-full" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Weighting: Viral Potential + Sentiment</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monetization Delta</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">+$2.1k</span>
                <span className="text-[10px] font-black text-indigo-400 mb-1">Pivot Gain</span>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase">
                  <span>Optimization Yield</span>
                  <span className="text-emerald-400">+18.5%</span>
                </div>
                <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[18.5%]" />
                </div>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase italic">Yield Gap Logic: 15% Triggered</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Interval</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">92.4%</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Spectral</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= 4 ? 'bg-indigo-500' : 'bg-white/10'}`} />
                ))}
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Data Density: High ⚡️</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8 flex flex-col justify-between relative overflow-hidden`}>
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Yield Curve
            </h3>
            <div className="h-40 relative flex items-end justify-between gap-1 px-2 border-b border-l border-white/10">
              {[15, 25, 20, 45, 30, 60, 50, 85, 70, 95].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-indigo-500/40 to-indigo-500/10 rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
              <div className="absolute top-4 right-4 text-[8px] font-black text-indigo-400 uppercase tracking-widest">Reach vs Rev</div>
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase px-1">
              <span>0 (Viral Reach)</span>
              <span>Max</span>
            </div>
          </div>
          
          <button className="w-full py-4 border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300 font-black text-[10px] uppercase tracking-widest transition-all rounded-2xl">
            Simulate Yield Swarm
          </button>
        </div>
      </div>

      {/* ── Key Stats ── */}




      {/* ── Key Stats ── */}
      <AnimatePresence mode="wait">
        {!activeMetrics && loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-64 items-center justify-center">
             <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
             <p className="ml-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Hydrating Tactical Matrix...</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {activeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Zap} label="Neural Convergence" value={`${activeMetrics.convergence}%`} subValue="+4.2% trajectory" />
          <StatCard icon={Globe} label="Regional Swarm" value={activeMetrics.activeNodes} subValue="Calibration mode" color="emerald" />
          <StatCard icon={Coins} label="Spectral Yield" value={`$${activeMetrics.projectedYield}`} subValue="15% gap detected" color="amber" />
          <StatCard icon={Activity} label="Vibe Potency" value={activeMetrics.vibePotency} subValue="Resonance peak" color="rose" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <SyndicateDebate 
            debate={syndicateDebate} 
            onExecute={(proposal: any) => console.log(`Executing ${proposal.type}...`)} 
          />
          <GovernanceLedger actions={auditLog || []} />
          
          {/* Autonomous Vision Feed */}
          <div className={`${glass} p-10 space-y-8`}>
             <div className="flex items-center justify-between">
               <h3 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                 <Sparkles className="w-6 h-6 text-purple-400" />
                 Autonomous Vision Feed
               </h3>
               <span className={`${pill} text-purple-400 border-purple-500/20`}>Live Generative Stream</span>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-[9/16] rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group">
                    <img src={`https://picsum.photos/seed/click${i}/400/700`} className="w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700" alt="Masterpiece" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
                       <p className="text-[8px] font-black text-white uppercase italic">Viral-Remix v.{i}</p>
                       <div className="flex items-center gap-2 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[7px] font-bold text-slate-400 uppercase">Deployed to TikTok</span>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
        <div className="space-y-8">
          <ComplianceShield status={complianceStatus || { status: 'SECURE', regionsBlocked: 0 }} />
          <FleetExpansionMonitor fleet={fleetExpansion || { activeNodes: 0, pendingNodes: 0, revenueThreshold: 0, timeRemaining: '0h' }} />
          
          {/* Real-time Arbitrage Radar (Simplified Integration) */}
          <div className={`${glass} p-8 space-y-6`}>
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Arbitrage Radar</h4>
             <div className="relative h-32 flex items-center justify-center">
                <div className="absolute inset-0 border border-emerald-500/5 rounded-full animate-ping" />
                <div className="text-center">
                   <p className="text-xl font-black text-emerald-400 italic font-mono">AGENTIC AI</p>
                   <p className="text-[8px] font-black text-slate-600 uppercase mt-2">Global Alpha Spike</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard icon={Server} label="Active Fleet Nodes" value={fleetStatus?.aggregation.onlineNodes || 0} subValue={`${fleetStatus?.aggregation.totalNodes} Nodes Tracked`} color="indigo" />
        <StatCard icon={Coins} label="Fleet Revenue (24h)" value={`$${(fleetStatus?.aggregation.totalRevenue || 0).toLocaleString()}`} subValue="Arbitrage Peak Shift" color="emerald" />
        <StatCard icon={Cpu} label="Active Generations" value={fleetStatus?.aggregation.activeGenerations || 0} subValue="Swarm Capacity: 94%" color="cyan" />
        <StatCard icon={Activity} label="Fleet Health" value={`${(fleetStatus?.aggregation.avgHealth || 0).toFixed(1)}%`} subValue="Network Latency: 12ms" color="rose" />
      </div>

      {/* ── Main Operations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Node Manifest */}
        <div className={`${glass} lg:col-span-2 p-12 space-y-10`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Fleet Manifest</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time Node Telemetry</p>
            </div>
            <button className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/5">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Node Name</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Revenue</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {fleetStatus?.nodes.map((node: any, i: number) => (
                  <tr key={i} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-white mb-0.5">{node.name}</p>
                      <p className="text-[9px] font-mono text-slate-500">Node-ID: {node._id || node.id || 'SYNCING'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">
                        {node.nodeType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-emerald-400 font-mono">${(node.metrics?.revenueDay || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{node.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Arbitrage Steering */}
        <div className="flex flex-col gap-10">
          <div className={`${glass} p-10 space-y-8 flex-1`}>
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Arbitrage Steering</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Revenue Engine Priority</p>
            </div>

            <div className="space-y-4">
              {manifest?.manifest?.map((offer: any, i: number) => (
                <div key={i} className={`p-6 rounded-3xl border transition-all ${i === 0 ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'bg-white/[0.02] border-white/5 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase">{offer.platform}</p>
                    {i === 0 && <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active Steer</span>}
                  </div>
                  <p className="text-lg font-black text-white italic mb-3">{offer.name}</p>
                  <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-4">
                    <div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase">Priority EPC</p>
                      <p className="text-sm font-black text-white italic">${offer.priority?.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-bold text-slate-500 uppercase">CVR Matrix</p>
                      <p className="text-sm font-black text-indigo-400 italic">{(offer.cvr * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98]">
              Target High-Velocity Node
            </button>
          </div>

          <div className={`${glass} p-10 space-y-6`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Orbit className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white italic">Knowledge Pulse</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Universal Tactic Sync</p>
              </div>
            </div>
            <button onClick={triggerPulse} className="w-full py-4 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-bold text-[9px] uppercase tracking-widest transition-all">
              Broadcast Intelligence Wave
            </button>
          </div>
        </div>
      </div>

      {/* ── Knowledge Ledger ── */}
      <div className={`${glass} p-12 space-y-10`}>
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Database className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tight">Intelligence Ledger</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cross-Fleet Tactical Shared Memory</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ledger?.ledger?.map((item: any, i: number) => (
            <div key={i} className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 relative group">
              <div className="absolute top-8 right-8 text-[10px] font-mono text-amber-400 opacity-60">
                v.{(item.viralScore * 100).toFixed(0)}
              </div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{item.lastSource}</p>
              <h3 className="text-xl font-black text-white italic leading-tight mb-4">{item.tactic}</h3>
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.nodesSynced} Nodes Synced</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-amber-400 transition-colors">
                  <Lock className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
