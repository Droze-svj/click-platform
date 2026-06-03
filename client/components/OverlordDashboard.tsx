'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
      <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
        <Cpu className="w-6 h-6 text-indigo-400" />
        Syndicate Debate (Neural Council)
      </h3>
      <span className={`${pill} text-indigo-400 border-indigo-500/20`}>Phase 23 Consenus Protocol</span>
    </div>
    {debate && debate.length > 0 ? (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {debate.map((a: any, i: number) => (
          <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black text-white uppercase">{a.name}</span>
              <span className={`text-[8px] font-black text-${a.color}-400 px-2 py-0.5 rounded-full border border-${a.color}-500/20`}>{a.status}</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">"{a.text}"</p>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex items-center justify-center py-12">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No council debate yet</p>
      </div>
    )}
  </div>
);

const GovernanceLedger = ({ actions }: any) => (
  <div className={`${glass} p-10 space-y-8`}>
    <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
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
        <span className="text-slate-500">Active Nodes</span>
        <span className="text-white">{fleet.activeNodes ?? '—'}</span>
      </div>
      <div className="flex justify-between text-[10px] font-black uppercase italic">
        <span className="text-slate-500">Pending Nodes</span>
        <span className="text-white">{fleet.pendingNodes ?? '—'}</span>
      </div>
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [fleetRes, manifestRes, ledgerRes, healthRes, clickPulse, clickForecast, clickLedger] = await Promise.all([
        apiGet('/phase10_12/fleet/status'),
        apiGet('/phase10_12/arbitrage/manifest'),
        apiGet('/phase10_12/intelligence/ledger'),
        apiGet('/phase10_12/fleet/health'),
        apiGet('/click/pulse'),
        apiGet('/click/forecast'),
        apiGet('/click/ledger')
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
      setComplianceStatus({ status: 'SECURE', regionsBlocked: 0 })
      setFleetExpansion({ activeNodes: fleetRes?.nodes?.length || 0, pendingNodes: 0 })
    } catch (err) {
      console.error('Telemetry fetch failed', err)
      showToast('Neural link lag detected', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [fetchData])

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
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-[var(--text-main)] italic uppercase tracking-tighter leading-none">Command Center</h1>
            <p className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-[0.4em] mt-3">Universal Fleet Orchestration</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
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
              <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Vision Engine Performance</h3>
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
              <p className="text-3xl font-black text-white italic">—</p>
              <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Awaiting data</p>
            </div>
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Viral Projection</p>
              <p className="text-3xl font-black text-white italic">—</p>
              <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Awaiting data</p>
            </div>
            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05]">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">B-Roll Coverage</p>
              <p className="text-3xl font-black text-white italic">—</p>
              <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">Awaiting data</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-6`}>
          <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Network Verifier</h3>
          <div className="flex items-center justify-center py-10">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No connected networks yet</p>
          </div>
        </div>
      </div>

      {/* ── Global Reach (New Phase 15) ── */}
      <div className={`${glass} p-10 mt-10 space-y-8`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Global Reach Expansion</h3>
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
            <p className="text-2xl font-black text-white">—</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Translation Accuracy</p>
            <p className="text-2xl font-black text-white">—</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Velocity</p>
            <p className="text-2xl font-black text-white">—</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Burn-in Success</p>
            <p className="text-2xl font-black text-white">—</p>
          </div>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

        <div className="flex items-center justify-center py-6">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No language reach data yet</p>
        </div>
      </div>

      {/* ── Click Nexus (New Phase 16) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-2 space-y-8`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Click Nexus</h3>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Real-Time Team Orchestration & Agency Pulse</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Presence Active</span>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-l-2 border-indigo-500 pl-4">Active Operations</h4>
            <div className="flex items-center justify-center py-12">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No active operations yet</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Urgent Review</h3>
          </div>

          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No items awaiting review</p>
          </div>
        </div>
      </div>

      {/* ── Revenue Hub (New Phase 17) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 mt-10">
        <div className={`${glass} p-10 col-span-3 space-y-8`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Revenue Hub</h3>
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
                <span className="text-4xl font-black text-white">—</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden" />
              <p className="text-[9px] font-bold text-slate-600 uppercase">Awaiting data</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conversion Velocity</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">RPC</span>
              </div>
              <div className="flex items-center justify-center h-8">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Awaiting data</p>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Real-time revenue delta</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Checkout Triggers</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Active</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Awaiting data</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8`}>
          <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Top Converters</h3>
          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No data yet</p>
          </div>
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
            <h2 className="text-4xl font-black text-[var(--text-main)] italic uppercase tracking-tighter leading-none">Click Strategist</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-3">Autonomous A/B Swarm & Viral Potential Matrix</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Strategic Alpha</p>
            <p className="text-3xl font-black text-purple-400 italic font-mono">—</p>
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
                { label: 'Kinetic Sharpness', color: 'text-indigo-400' },
                { label: 'Emotional Polarity', color: 'text-rose-400' },
                { label: 'Pattern-Interrupt', color: 'text-amber-400' }
              ].map((m, i) => (
                <div key={i} className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{m.label}</p>
                  <div className="flex items-end justify-between">
                    <span className={`text-4xl font-black italic ${m.color}`}>—</span>
                    <TrendingUp className={`w-5 h-5 ${m.color} opacity-50`} />
                  </div>
                  <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden" />
                </div>
              ))}
            </div>

            <div className="p-8 bg-white/[0.01] rounded-[2rem] border border-white/[0.03] space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active A/B Swarm Status</p>
              </div>
              <div className="flex items-center justify-center py-8">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">No active A/B swarm tests</p>
              </div>
            </div>
          </div>

          <div className={`${glass} p-10 space-y-8 flex flex-col justify-between`}>
            <div className="space-y-6">
              <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
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
              <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Long-Tail Resurrection</h3>
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
                <span className="text-4xl font-black text-white">—</span>
              </div>
              <div className="flex items-center justify-center h-12">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Awaiting data</p>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Legacy momentum detected</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dark Assets Found</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Un-Neuralized</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Awaiting data</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Remixes</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Rendering</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Awaiting data</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8 flex flex-col justify-between relative overflow-hidden`}>
          <div className="space-y-6">
            <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
              <Radio className="w-5 h-5 text-emerald-400" />
              Resurrection Queue
            </h3>
            <div className="flex items-center justify-center py-12">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No resurrection candidates yet</p>
            </div>
          </div>
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
            <h2 className="text-4xl font-black text-[var(--text-main)] italic uppercase tracking-tighter leading-none">Community Pulse</h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-3">Autonomous Sentiment Drift & Vibe Shift Analysis</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Resonance Velocity</p>
            <p className="text-3xl font-black text-emerald-400 italic font-mono">—</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
          <div className="lg:col-span-1 space-y-6">
            <div className={`p-8 ${glass} flex flex-col items-center justify-center text-center space-y-4`}>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Vibe</p>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-[spin_3s_linear_infinite]" />
                <span className="text-2xl font-black text-white italic">—</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase italic">Awaiting data</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                <span>Threat Level</span>
                <span className="text-slate-500">—</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden" />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
              <Activity className="w-4 h-4 text-emerald-500" />
              Sentiment Drift (Last 24h vs Baseline)
            </h4>
            <div className="h-64 bg-white/[0.02] rounded-3xl border border-white/[0.05] relative overflow-hidden p-6 flex items-center justify-center">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Awaiting sentiment data</p>
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
            <div className="flex items-center justify-center py-12">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No archetype data yet</p>
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
              <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Click Econometrics</h3>
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
                <span className="text-4xl font-black text-white">—</span>
              </div>
              <div className="relative h-16 w-full flex items-center justify-center">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Awaiting data</p>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Weighting: Viral Potential + Sentiment</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monetization Delta</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-indigo-400 mb-1">Pivot Gain</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase italic">Awaiting data</p>
            </div>

            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Interval</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black text-white">—</span>
                <span className="text-[10px] font-black text-slate-600 mb-1">Spectral</span>
              </div>
              <p className="text-[9px] font-bold text-slate-600 uppercase">Awaiting data</p>
            </div>
          </div>
        </div>

        <div className={`${glass} p-10 space-y-8 flex flex-col justify-between relative overflow-hidden`}>
          <div className="space-y-6">
            <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              Yield Curve
            </h3>
            <div className="h-40 relative flex items-center justify-center px-2 border-b border-l border-white/10">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Awaiting yield data</p>
              <div className="absolute top-4 right-4 text-[8px] font-black text-indigo-400 uppercase tracking-widest">Reach vs Rev</div>
            </div>
            <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase px-1">
              <span>0 (Viral Reach)</span>
              <span>Max</span>
            </div>
          </div>
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
          <StatCard icon={Zap} label="Neural Convergence" value={`${activeMetrics.convergence}%`} />
          <StatCard icon={Globe} label="Regional Swarm" value={activeMetrics.activeNodes} color="emerald" />
          <StatCard icon={Coins} label="Spectral Yield" value={`$${activeMetrics.projectedYield}`} color="amber" />
          <StatCard icon={Activity} label="Vibe Potency" value={activeMetrics.vibePotency} color="rose" />
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
               <h3 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight flex items-center gap-3">
                 <Sparkles className="w-6 h-6 text-purple-400" />
                 Autonomous Vision Feed
               </h3>
               <span className={`${pill} text-purple-400 border-purple-500/20`}>Live Generative Stream</span>
             </div>
             <div className="flex items-center justify-center py-16">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No generative renders yet</p>
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
                   <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No arbitrage signal yet</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard icon={Server} label="Active Fleet Nodes" value={fleetStatus?.aggregation.onlineNodes || 0} subValue={`${fleetStatus?.aggregation.totalNodes} Nodes Tracked`} color="indigo" />
        <StatCard icon={Coins} label="Fleet Revenue (24h)" value={`$${(fleetStatus?.aggregation.totalRevenue || 0).toLocaleString()}`} subValue="Arbitrage Peak Shift" color="emerald" />
        <StatCard icon={Cpu} label="Active Generations" value={fleetStatus?.aggregation.activeGenerations || 0} color="cyan" />
        <StatCard icon={Activity} label="Fleet Health" value={`${(fleetStatus?.aggregation.avgHealth || 0).toFixed(1)}%`} color="rose" />
      </div>

      {/* ── Main Operations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Node Manifest */}
        <div className={`${glass} lg:col-span-2 p-12 space-y-10`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Fleet Manifest</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time Node Telemetry</p>
            </div>
            <button type="button" onClick={fetchData} aria-label="Refresh fleet manifest" className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
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
              <h2 className="text-2xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Arbitrage Steering</h2>
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
            <button type="button" onClick={triggerPulse} className="w-full py-4 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-bold text-[9px] uppercase tracking-widest transition-all">
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
            <h2 className="text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tight">Intelligence Ledger</h2>
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
              <h3 className="text-xl font-black text-[var(--text-main)] italic leading-tight mb-4">{item.tactic}</h3>
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
