'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Cpu, Zap, TrendingUp, Layers, ShieldCheck, BarChart3, Activity, Users,
  Rocket, Search, Brain, Repeat, Share2, Lock, ChevronRight, RefreshCw,
  AlertCircle, BarChart, Eye, ArrowUpRight, Target, ShoppingCart, Lightbulb,
  ArrowLeft, ArrowRight, Gavel, Split, History, Network, Gauge, Fingerprint,
  Terminal, Sparkles, PieChart, Shield, Workflow, HardDrive, Binary, Orbit,
  Scan, ActivityIcon, Command, Box, Wind, Ghost, Signal, ShieldAlert,
  UserCheck, Key, Anchor, ChevronDown, Sparkle
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart as RechartsBarChart, Bar, Cell
} from 'recharts'
import { apiGet, apiPost } from '../../../lib/api'
import StrategicPivotsView from './StrategicPivotsView'
import WhopProductHub from './WhopProductHub'
import SovereignGovernancePortal from './SovereignGovernancePortal'
import CreatorPayoutMap from './CreatorPayoutMap'
import GlobalABSynthesisHub from './GlobalABSynthesisHub'
import SurgeHistoryLedger from './SurgeHistoryLedger'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'

// Types
interface Trend {
  tag?: string; topic?: string; trend?: string; growth?: string; views?: string; velocity?: number; sentiment?: string; maturity?: string;
}

interface Agent {
  id: string; name: string; status: string; load: number; color: 'emerald' | 'violet' | 'blue' | 'orange' | 'amber'; task?: string; critique?: string;
}

interface SLASummary {
  healthy: number; atRisk: number; missed: number; total: number;
}

type DashboardView = 'pipeline' | 'strategic' | 'monetization' | 'distribution' | 'ab_test' | 'surge_ledger'

const colorMap = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400',  bar: 'bg-violet-500' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    bar: 'bg-blue-500' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  text: 'text-orange-400',  bar: 'bg-orange-500' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   bar: 'bg-amber-500' }
}

const chartData = [
  { name: '00:00', reach: 4500, score: 85 },
  { name: '04:00', reach: 5200, score: 72 },
  { name: '08:00', reach: 9800, score: 94 },
  { name: '12:00', reach: 7100, score: 88 },
  { name: '16:00', reach: 8800, score: 91 },
  { name: '20:00', reach: 12000, score: 96 },
]

const heatmapData = [
  { time: '0:05', score: 98, level: 'high' },
  { time: '0:10', score: 92, level: 'high' },
  { time: '0:15', score: 45, level: 'low', warning: 'Retention Drop' },
  { time: '0:20', score: 88, level: 'high' },
  { time: '0:25', score: 76, level: 'medium' },
  { time: '0:30', score: 32, level: 'low', warning: 'B-roll Needed' },
  { time: '0:35', score: 91, level: 'high' },
]

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

const InfiniteAgencyDashboardView: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>('pipeline')
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)
  const [trends, setTrends] = useState<Trend[]>([])
  const [loadingTrends, setLoadingTrends] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [efficiency, setEfficiency] = useState(94.2)
  const [benchmark, setBenchmark] = useState<any>(null)
  const [pivots, setPivots] = useState<any[]>([])
  const [currentWins, setCurrentWins] = useState<string>('')
  const [whopProducts, setWhopProducts] = useState<any[]>([])
  const [loadingPivots, setLoadingPivots] = useState(false)
  const [thoughts, setThoughts] = useState<string[]>([
    "Strategy Oracle: Imported trending topics from TikTok #tech.",
    "Style DNA: Extracted 12.4s hook rhythm from your top performer.",
    "Retention Critic: Warning — predicted retention drop at 0:15.",
    "Visual Synthesizer: Rendering B-roll overlays… 42%",
  ])
  const [ledgerState, setLedgerState] = useState<any>({ height: 4280, lastHash: '0x882_ALPHA', transactions: 1240 })
  const [audits, setAudits] = useState<any[]>([])
  const [governanceOpen, setGovernanceOpen] = useState(false)
  const [proposals, setProposals] = useState<any[]>([])
  const [financials, setFinancials] = useState<any>({ totalSettledUSD: 4280, activeBridges: 4 })
  const [synthesisState, setSynthesisState] = useState<any>({ seed: 'SOURCE_0x882', jobs: [] })
  const [slaSummary, setSlaSummary] = useState<SLASummary>({ healthy: 12, atRisk: 2, missed: 0, total: 14 })
  const [latestReports, setLatestReports] = useState<any[]>([])
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [debateMode, setDebateMode] = useState(false)
  const [swarmHealth, setSwarmHealth] = useState(98.4)
  const [autoSurgeActive, setAutoSurgeActive] = useState(true)
  const [evolutionForecast, setEvolutionForecast] = useState<any[]>([])
  const [surgeLedger, setSurgeLedger] = useState<any[]>([])

  const [agents, setAgents] = useState<Agent[]>([
    { id: 'ora-1', name: 'Strategy Oracle', status: 'Inference', load: 84, color: 'emerald', task: 'Analyzing Q3 winning styles', critique: 'Content hook matches Pareto distribution for high-velocity niches.' },
    { id: 'dna-4', name: 'Style DNA Weaver', status: 'Vibrating', load: 42, color: 'violet', task: 'Extracting temporal cues from FCPX', critique: 'Temporal shift detected in audience attention span; suggesting 0.5s faster cuts.' },
    { id: 'vis-x', name: 'Visual Synthesizer', status: 'Rendering', load: 91, color: 'blue', task: 'Synthesizing B-roll via Sora', critique: 'Visual fidelity optimized for 4K. Aesthetic alignment with brand guidelines: 98%.' },
    { id: 'mon-9', name: 'Retention Critic', status: 'Auditing', load: 12, color: 'orange', task: 'Scanning for 3s drop zones', critique: 'Warning: Retention drop predicted at 0:15 due to high-contrast saturation.' },
    { id: 'adm-0', name: 'Consent Bridge', status: 'Bridging', load: 5, color: 'amber', task: 'Mapping 24 product SKUs to timeline', critique: 'SKU placement verified. ROI forecast: 8.4x improvement on direct conversion.' },
  ])

  const loadAll = useCallback(async () => {
    try {
      const [tRes, bRes, pRes, lRes, fRes, sRes, eRes, slRes, rRes] = await Promise.all([
        apiGet('/video/neural/trends?platform=tiktok').catch(() => ({ trends: [] })),
        apiGet('/competitive/benchmarks?platform=tiktok').catch(() => ({ data: null })),
        apiPost('/video/advanced/analyze-pivots', { niche: 'AI SaaS' }).catch(() => ({ data: { plan: { recommendedPivots: [], currentWins: '' } } })),
        apiGet('/video/advanced/ledger').catch(() => ({ data: { audits: [], state: ledgerState } })),
        apiGet('/video/advanced/financial-bridge').catch(() => ({ data: { summary: financials } })),
        apiGet('/video/advanced/synthesis-status').catch(() => ({ success: false })),
        apiGet('/video/advanced/evolution-forecast').catch(() => ({ success: false })),
        apiGet('/agency/slas/status').catch(() => ({ success: false })),
        apiGet('/agency/reports/latest').catch(() => ({ success: false }))
      ])

      const rawT = tRes as any; if (rawT.success) setTrends(rawT.trends)
      const rawB = bRes as any; if (rawB.success) setBenchmark(rawB.data)
      const rawP = pRes as any; if (rawP.success) { setPivots(rawP.data.plan.recommendedPivots); setCurrentWins(rawP.data.plan.currentWins) }
      const rawL = lRes as any; if (rawL.success) { setAudits(rawL.data.audits); setLedgerState(rawL.data.state) }
      const rawF = fRes as any; if (rawF.success) setFinancials(rawF.data.summary)
      const rawS = sRes as any; if (rawS.success) setSynthesisState(rawS)
      const rawE = eRes as any; if (rawE.success) setEvolutionForecast(rawE.data)
      const rawSL = slRes as any; if (rawSL.success) setSlaSummary(rawSL.data)
      const rawR = rRes as any; if (rawR.success) setLatestReports(rawR.data.reports)
    } catch { /* Silent */ }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const iv = setInterval(() => {
      setAgents(p => p.map(a => ({
        ...a, load: Math.min(100, Math.max(10, a.load + (Math.random() * 10 - 5))),
        status: Math.random() > 0.9 ? ['Inference', 'Syncing', 'Rendering', 'Auditing', 'Inference'][Math.floor(Math.random() * 5)] : a.status
      })))
      setEfficiency(p => Math.min(100, Math.max(90, p + (Math.random() * 1 - 0.5))))
      setSwarmHealth(p => Math.min(100, Math.max(95, p + (Math.random() * 0.2 - 0.1))))
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const supplyChainSteps = useMemo(() => [
    { id: 'discovery', label: 'Signal Node', icon: Search, status: 'completed', metric: `${trends.length || 14} ACTIVE`, desc: 'Neural Signal Ingestion' },
    { id: 'synthesis', label: 'Synthesis Loop', icon: Brain, status: 'active', metric: '94% RECALL', desc: 'Cognitive Sequence Refining' },
    { id: 'retention', label: 'Telemetry HUD', icon: Target, status: 'active', metric: 'SCORE 88', desc: 'Predictive Retention Scan' },
    { id: 'monetization', label: 'Fiscal Bridge', icon: ShoppingCart, status: 'waiting', metric: '24 SKUS', desc: 'Consensus Transaction Sync' },
  ], [trends])

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-[#020205] text-white p-10 gap-12 font-inter relative">
      {/* Background Matrix Layer */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <pattern id="neural-matrix" width="100" height="100" patternUnits="userSpaceOnUse">
             <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#6366f1" strokeWidth="0.5" />
             <circle cx="2" cy="2" r="1.5" fill="#6366f1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#neural-matrix)" />
        </svg>
      </div>

      {/* Global Agency Header HUD */}
      <header className="flex justify-between items-end relative z-10">
        <div className="flex items-center gap-12">
           <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.4)] relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 to-transparent opacity-100" />
              <Network size={48} className="text-indigo-400 relative z-10 animate-spin-slow group-hover:scale-125 transition-transform duration-1000" />
           </div>
           <div>
              <div className="flex items-center gap-6 mb-4">
                 <div className="flex items-center gap-3">
                    <Activity size={16} className="text-indigo-400 animate-pulse" />
                    <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Neural Command Terminal v14.2.0</span>
                 </div>
                 <div className="px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                    <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">STABLE</span>
                 </div>
              </div>
              <h1 className="text-6xl font-black text-white tracking-tighter leading-none drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">Agency Console</h1>
              <p className="text-slate-400 text-[13px] font-medium tracking-wide mt-4 leading-relaxed">Manage every brand, campaign, and creator from a single workspace.</p>
           </div>
        </div>

        <div className="flex items-center gap-12">
           <nav className="flex gap-6 p-4 rounded-[4rem] bg-white/[0.02] border border-white/10 shadow-[0_60px_200px_rgba(0,0,0,0.8)] backdrop-blur-3xl">
              {[
                { id: 'strategic', label: 'INTENT', icon: Lightbulb, color: 'text-indigo-400' },
                { id: 'monetization', label: 'ASSETS', icon: ShoppingCart, color: 'text-emerald-400' },
                { id: 'distribution', label: 'PRESENCE', icon: Globe, color: 'text-blue-400' },
                { id: 'ab_test', label: 'PATTERN', icon: Split, color: 'text-purple-400' }
              ].map(v => (
                 <button key={v.id} onClick={() => setActiveView(v.id as any)}
                   className={`px-12 py-6 rounded-[2.8rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-1000 flex items-center gap-4 italic active:scale-90 border-2 ${activeView === v.id ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' : 'text-slate-700 border-transparent hover:text-white hover:bg-white/5'}`}>
                   <v.icon size={22} className={activeView === v.id ? 'text-black' : v.color} />
                   {v.label}
                 </button>
              ))}
           </nav>
           
           <div className="flex flex-col items-end gap-4 pl-12 border-l-2 border-white/10">
              <div className="flex items-center gap-4">
                 <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.6em] italic">COHERENCE</span>
                 <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 text-[10px] font-black text-emerald-400 italic shadow-2xl">OPTIMIZED_v18</div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="w-56 h-3 bg-black/80 rounded-full overflow-hidden border-2 border-white/5 shadow-inner p-0.5">
                    <motion.div animate={{ width: `${efficiency}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)] rounded-full relative overflow-hidden">
                       <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                    </motion.div>
                 </div>
                 <span className="text-3xl font-black text-white italic tabular-nums tracking-tighter drop-shadow-2xl">{efficiency.toFixed(1)}%</span>
              </div>
           </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-12 min-h-0 relative z-10">
        {/* Main Operational Matrix */}
        <section className="col-span-8 flex flex-col gap-12 overflow-hidden">
           <AnimatePresence mode="wait">
              {activeView === 'pipeline' && (
                 <motion.div initial={{ opacity: 0, scale: 0.98, x: -50 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 1.02, x: 50 }} transition={{ duration: 0.8 }} className="flex flex-col gap-12 h-full">
                    {/* Orchestration Matrix */}
                    <div className={`${glassStyle} flex-1 rounded-[6rem] p-24 relative overflow-hidden flex flex-col justify-between group bg-black/40 shadow-[0_100px_300px_rgba(0,0,0,1)] border-white/5`}>
                       <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/[0.04] blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-indigo-500/[0.08] transition-all duration-[3s]" />
                       
                       <div className="flex items-center justify-between relative z-10 px-8">
                          <div>
                             <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">Orchestration Matrix</h3>
                             <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Autonomous operational relay for distributed cognitive labor units.</p>
                          </div>
                          <div className="px-12 py-5 rounded-[3rem] bg-indigo-500/[0.02] border-2 border-indigo-500/20 text-indigo-400 text-[13px] font-black uppercase tracking-[0.4em] italic flex items-center gap-6 shadow-3xl animate-pulse">
                             <Terminal size={24} /> <span className="opacity-40">NODE_AUTH:</span> 0x882_ROOT_ALPHA
                          </div>
                       </div>

                       <div className="relative flex items-center justify-between px-20 py-16">
                          <div className="absolute top-1/2 left-24 right-24 h-[3px] bg-white/[0.02] -translate-y-1/2 rounded-full">
                             <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} className="h-full w-96 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_30px_rgba(99,102,241,0.5)]" />
                          </div>

                          {supplyChainSteps.map((step, idx) => (
                             <motion.div key={step.id} whileHover={{ scale: 1.15, y: -20 }} onMouseEnter={() => setHoveredStep(step.id)} onMouseLeave={() => setHoveredStep(null)}
                               className="relative flex flex-col items-center gap-10 cursor-pointer group/step z-10"
                             >
                                <div className={`w-32 h-32 rounded-[3.5rem] flex items-center justify-center border-4 transition-all duration-1000 shadow-3xl relative ${
                                  step.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' :
                                  step.status === 'active' ? 'bg-indigo-500/10 border-indigo-500/60 text-indigo-400 shadow-[0_0_100px_rgba(99,102,241,0.4)]' :
                                  'bg-white/5 border-white/10 text-slate-950'
                                }`}>
                                   <step.icon size={56} className={`${step.status === 'active' ? 'animate-pulse' : ''} group-hover/step:rotate-12 transition-transform duration-1000`} />
                                   {step.status === 'active' && (
                                      <div className="absolute inset-0 rounded-[3.2rem] border-4 border-indigo-400/40 animate-ping opacity-20" />
                                   )}
                                </div>
                                <div className="text-center space-y-4">
                                   <p className={`text-[17px] font-black uppercase tracking-[0.4em] leading-none italic ${step.status === 'active' ? 'text-indigo-400' : 'text-slate-800'} transition-colors duration-1000`}>{step.label}</p>
                                   <div className="px-6 py-1.5 rounded-full bg-black/60 border-2 border-white/5 shadow-inner inline-block">
                                      <p className="text-[10px] font-black text-white/40 italic uppercase tracking-widest">{step.metric}</p>
                                   </div>
                                </div>

                                <AnimatePresence>
                                   {hoveredStep === step.id && (
                                     <motion.div initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.9 }} className="absolute -bottom-48 w-96 p-10 rounded-[4rem] bg-[#050505] border-2 border-indigo-500/30 shadow-[0_80px_200px_rgba(0,0,0,1)] z-[100] pointer-events-none">
                                        <div className="space-y-6">
                                           <div className="flex justify-between items-center border-b-2 border-white/5 pb-5 px-4">
                                              <p className="text-[14px] font-black text-white uppercase italic tracking-widest">{step.desc}</p>
                                              <Zap size={20} className="text-indigo-400 animate-pulse" />
                                           </div>
                                           <div className="space-y-4 px-4">
                                              {['Neural Pattern Extraction', 'Sector Calibration', 'Validation Logic'].map(n => (
                                                <div key={n} className="flex items-center gap-5">
                                                   <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                                                   <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest italic">{n}</span>
                                                </div>
                                              ))}
                                           </div>
                                        </div>
                                     </motion.div>
                                   )}
                                </AnimatePresence>
                             </motion.div>
                          ))}
                       </div>

                       <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-16 px-8 pb-4">
                          <div className="flex gap-24">
                             <div className="space-y-3">
                                <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.8em] italic border-l-2 border-white/10 pl-6">active_neural_vectors</p>
                                <p className="text-5xl font-black italic text-white leading-none uppercase tracking-tighter drop-shadow-2xl">{trends.length || 14} Nodes</p>
                             </div>
                             <div className="space-y-3">
                                <p className="text-[12px] font-black text-emerald-500/40 uppercase tracking-[0.8em] italic border-l-2 border-emerald-500/10 pl-6">roi_projection_v14</p>
                                <p className="text-5xl font-black italic text-emerald-400 leading-none uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">8.42X</p>
                             </div>
                          </div>
                          <button onClick={loadAll} className="flex flex-col items-end group">
                             <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-3 group-hover:text-white transition-colors">Top Performing Region</span>
                             <div className="flex items-center gap-6">
                                <span className="text-3xl font-black text-white tracking-tighter group-hover:text-indigo-400 transition-colors leading-tight">Global · TikTok</span>
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border-2 border-white/5 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:border-indigo-500/50 transition-colors">
                                   <ArrowRight size={36} className="group-hover:translate-x-4 transition-transform duration-1000" />
                                </div>
                             </div>
                          </button>
                       </div>
                    </div>

                    {/* Integrated Telemetry Grid */}
                    <div className="grid grid-cols-3 gap-12 h-96">
                       <div className={`${glassStyle} rounded-[5rem] p-12 flex flex-col relative overflow-hidden group bg-black/40 border-white/5 shadow-2xl`}>
                          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/[0.04] blur-[80px] rounded-full translate-x-1/4 -translate-y-1/4 pointer-events-none" />
                          <div className="flex items-center justify-between mb-10 relative z-10 px-4 pt-2">
                             <div>
                                <h4 className="text-[14px] font-black text-white uppercase tracking-[0.5em] leading-none mb-3 italic">Retention Stream</h4>
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic opacity-60">Sequence: Chronos_045</p>
                             </div>
                             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-3xl"><Target size={28} className="text-indigo-400 animate-pulse" /></div>
                          </div>
                          <div className="flex-1 flex items-end gap-3 relative z-10 px-4 pb-4">
                              {heatmapData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-4 group/bar">
                                   <div className="w-full h-full relative flex flex-col justify-end">
                                      <motion.div initial={{ height: 0 }} animate={{ height: `${d.score}%` }} transition={{ duration: 2.5, delay: i * 0.1, ease: "circOut" }}
                                        className={`w-full rounded-t-2xl transition-all duration-[2s] relative overflow-hidden ${d.level === 'high' ? 'bg-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.4)]' : d.level === 'medium' ? 'bg-indigo-500/20' : 'bg-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.3)]'}`}
                                      >
                                         <div className="absolute inset-0 bg-white/10 animate-shimmer" />
                                      </motion.div>
                                   </div>
                                   <span className="text-[9px] font-black text-slate-950 italic tabular-nums tracking-widest">{d.time}</span>
                                </div>
                              ))}
                          </div>
                       </div>

                       <div className={`${glassStyle} rounded-[5rem] p-12 flex flex-col relative overflow-hidden group bg-black/40 border-emerald-500/10 shadow-2xl`}>
                          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/[0.04] blur-[80px] rounded-full -translate-x-1/4 translate-y-1/4 pointer-events-none" />
                          <div className="flex items-center justify-between mb-10 relative z-10 px-4 pt-2">
                             <div>
                                <h4 className="text-[14px] font-black text-white uppercase tracking-[0.5em] leading-none mb-3 italic">Market Trajectory</h4>
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest italic opacity-60">Sector Alpha Surging</p>
                             </div>
                             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-3xl"><TrendingUp size={28} className="text-emerald-400 animate-pulse" /></div>
                          </div>
                          <div className="flex-1 relative z-10 px-4">
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                   <defs>
                                      <linearGradient id="pGradGreen" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                      </linearGradient>
                                   </defs>
                                   <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#pGradGreen)" strokeWidth={6} />
                                </AreaChart>
                             </ResponsiveContainer>
                             <div className="absolute top-4 right-8 flex flex-col items-end gap-3 text-right">
                                <span className="text-6xl font-black italic text-white tracking-tighter drop-shadow-2xl">92.4 <span className="text-2xl text-emerald-500">ND</span></span>
                                <div className="px-5 py-1.5 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 shadow-3xl">
                                   <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic leading-none">GROWTH</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className={`${glassStyle} rounded-[5rem] p-12 flex flex-col relative overflow-hidden group bg-black/40 border-white/5 shadow-2xl`}>
                          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/[0.04] blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                          <div className="flex items-center justify-between mb-10 relative z-10 px-4 pt-2">
                             <div>
                                <h4 className="text-[14px] font-black text-white uppercase tracking-[0.5em] leading-none mb-3 italic">Latent Ingestion</h4>
                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic opacity-60">Sora-Core Scalar Sync</p>
                             </div>
                             <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-3xl"><Cpu size={28} className="text-indigo-400 animate-spin-slow" /></div>
                          </div>
                          <div className="flex-1 flex flex-col justify-center gap-10 relative z-10 px-4">
                             <div className="flex justify-between items-center group/seed border-b-2 border-white/5 pb-4">
                                <span className="text-[11px] font-black text-slate-950 uppercase tracking-[0.4em] italic leading-none">Neural_Seed</span>
                                <span className="text-[12px] font-mono font-black text-indigo-400 truncate w-40 text-right italic group-hover:text-white transition-colors">0x_882_ROOT_SOURCE</span>
                             </div>
                             <div className="grid grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                   <div key={i} className="bg-black/60 rounded-[1.5rem] p-5 border-2 border-white/5 flex flex-col items-center gap-3 shadow-inner hover:border-indigo-500/30 transition-all duration-700">
                                      <p className="text-[8px] font-black text-slate-950 uppercase italic group-hover:text-white transition-colors">DIM_{i}</p>
                                      <motion.p animate={{ opacity: [1, 0.3, 1], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }} className="text-[14px] font-black text-white italic tabular-nums">{(Math.random()).toFixed(3)}</motion.p>
                                   </div>
                                ))}
                             </div>
                             <div className="flex justify-between items-center pt-6 border-t-2 border-white/5">
                                <div className="flex items-center gap-4">
                                   <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
                                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">LOCKED</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                   <span className="text-[9px] font-black text-slate-900 uppercase italic">FIDELITY:</span>
                                   <span className="text-[15px] font-black text-indigo-400 italic tabular-nums drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">0.984</span>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </motion.div>
              )}
              {activeView === 'strategic' && <StrategicPivotsView pivots={pivots} currentWins={currentWins} onScale={(n) => loadAll()} loading={loadingPivots} onClose={() => setActiveView('pipeline')} />}
              {activeView === 'monetization' && <WhopProductHub products={whopProducts} onClose={() => setActiveView('pipeline')} />}
              {activeView === 'distribution' && <CreatorPayoutMap onApplyStyleBridge={() => {}} evolutionForecast={evolutionForecast} isAutonomous={autoSurgeActive} />}
              {activeView === 'ab_test' && <GlobalABSynthesisHub onClose={() => setActiveView('pipeline')} onStyleFix={() => {}} onExportWhop={() => {}} onSyncFeedback={() => {}} />}
              {activeView === 'surge_ledger' && <SurgeHistoryLedger entries={surgeLedger} onClose={() => setActiveView('distribution')} />}
           </AnimatePresence>
        </section>

        {/* AI Agent Pool */}
        <aside className="col-span-4 flex flex-col gap-12 overflow-hidden">
           <div className={`${glassStyle} rounded-[6rem] p-16 flex-1 flex flex-col overflow-hidden relative group bg-black/40 border-white/5 shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
              <div className="absolute inset-0 bg-indigo-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-[3s] pointer-events-none" />
              <div className="flex items-center justify-between mb-16 relative z-10 px-6 pt-4">
                 <div>
                    <h3 className="text-[17px] font-black text-white tracking-tight mb-2 leading-tight">AI Agent Pool</h3>
                    <p className="text-[11px] font-medium text-slate-400 leading-tight border-l-2 border-indigo-500/20 pl-4 ml-1">Autonomous workers handling content tasks</p>
                 </div>
                 <div className="flex items-center gap-8">
                    <button onClick={() => setDebateMode(!debateMode)} className={`px-10 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] border-2 transition-all duration-1000 italic active:scale-90 ${debateMode ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse shadow-[0_0_50px_rgba(99,102,241,0.6)]' : 'bg-white/5 border-white/10 text-slate-800 hover:text-white hover:bg-white/10 hover:border-white/20'}`}>
                       {debateMode ? 'DEBATING' : 'START_DEBATE'}
                    </button>
                 </div>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-6 relative z-10 px-4">
                 {agents.map(agent => (
                    <motion.div key={agent.id} layout whileHover={{ x: 15, scale: 1.02 }} className="p-10 rounded-[3.5rem] bg-black/60 border-2 border-white/5 flex flex-col gap-10 group/node cursor-pointer transition-all duration-1000 shadow-[inset_0_0_50px_rgba(255,255,255,0.02)] hover:border-white/10">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-8">
                             <div className={`w-20 h-20 rounded-[2.5rem] ${colorMap[agent.color].bg} border-2 ${colorMap[agent.color].border} ${colorMap[agent.color].text} group-hover/node:rotate-12 transition-all duration-1000 shadow-3xl flex items-center justify-center flex-shrink-0`}>
                                <Cpu size={40} className="group-hover:scale-110 transition-transform duration-1000" />
                             </div>
                             <div>
                                <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3 italic drop-shadow-2xl">{agent.name}</h4>
                                <div className="flex items-center gap-3">
                                   <div className={`w-2 h-2 rounded-full ${colorMap[agent.color].bar} animate-pulse shadow-2xl`} />
                                   <p className={`text-[11px] font-black uppercase tracking-widest italic ${colorMap[agent.color].text}`}>{agent.status.toUpperCase()}...</p>
                                </div>
                             </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-3">
                             <p className={`text-4xl font-black italic tabular-nums leading-none ${colorMap[agent.color].text} drop-shadow-2xl`}>{agent.load.toFixed(0)}%</p>
                             <div className="w-32 h-2.5 bg-black/60 rounded-full overflow-hidden border-2 border-white/5 shadow-inner p-0.5">
                                <motion.div animate={{ width: `${agent.load}%` }} className={`h-full ${colorMap[agent.color].bar} shadow-[0_0_20px_rgba(99,102,241,0.5)] rounded-full`} />
                             </div>
                          </div>
                       </div>
                       {agent.task && (
                          <div className="flex flex-col gap-6 pl-16 border-l-4 border-white/5 relative group-hover/node:border-white/10 transition-colors">
                             <div className="flex items-center gap-4 text-slate-800 group-hover/node:text-white/60 transition-colors">
                                <Terminal size={16} />
                                <p className="text-[12px] font-black uppercase tracking-tight italic truncate max-w-[280px]">{agent.task}</p>
                             </div>
                             {debateMode && agent.critique && (
                                <motion.div initial={{ opacity: 0, height: 0, y: 20 }} animate={{ opacity: 1, height: 'auto', y: 0 }} className="p-8 rounded-[2.5rem] bg-indigo-500/5 border-2 border-indigo-500/10 shadow-inner group-hover/node:bg-indigo-500/10 transition-all duration-1000">
                                   <div className="flex gap-4">
                                      <div className="text-amber-500 mt-1 flex-shrink-0"><Sparkle size={16} className="animate-pulse" /></div>
                                      <p className="text-[13px] font-black text-slate-400 italic leading-relaxed uppercase tracking-tighter group-hover:text-white/80 transition-colors">"{agent.critique}"</p>
                                   </div>
                                </motion.div>
                             )}
                          </div>
                       )}
                    </motion.div>
                 ))}
              </div>

              <div className="mt-12 relative z-10 space-y-12">
                 {/* Auto-Publish Bridge HUD */}
                 <div className={`p-12 rounded-[5rem] border-4 transition-all duration-1000 relative overflow-hidden group shadow-[0_80px_200px_rgba(0,0,0,1)] ${autoSurgeActive ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_40px_100px_rgba(99,102,241,0.2)]' : 'bg-black/60 border-white/5'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
                    
                    <div className="flex justify-between items-center mb-8 relative z-10 px-4">
                       <div className="flex items-center gap-10">
                          <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-3xl transition-all duration-1000 ${autoSurgeActive ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/40' : 'bg-white/5 text-slate-950 border-2 border-white/5'}`}>
                             <Zap size={40} className={autoSurgeActive ? 'animate-pulse' : ''} />
                          </div>
                          <div>
                             <h4 className="text-2xl font-black text-white tracking-tight leading-tight mb-2 drop-shadow-xl">Auto-Publish Bridge</h4>
                             <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${autoSurgeActive ? 'bg-indigo-500' : 'bg-amber-500'} animate-ping`} />
                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic leading-none">{autoSurgeActive ? 'PREDICTION_READY' : 'MANUAL_ONLY'}</p>
                             </div>
                          </div>
                       </div>
                       <button onClick={() => setAutoSurgeActive(!autoSurgeActive)} className={`w-24 h-12 rounded-[2rem] relative transition-all duration-1000 border-4 shadow-3xl active:scale-75 ${autoSurgeActive ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_50px_rgba(99,102,241,0.5)]' : 'bg-slate-950 border-slate-900 shadow-inner'}`}>
                          <motion.div animate={{ x: autoSurgeActive ? 48 : 0 }} className={`absolute top-1 left-1 w-7 h-7 rounded-full shadow-2xl ${autoSurgeActive ? 'bg-white' : 'bg-slate-700'}`} />
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8 relative z-10 px-2">
                       <button onClick={() => setActiveView('surge_ledger')} className="py-6 rounded-[2.5rem] bg-black/80 border-2 border-white/5 text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic hover:bg-white hover:text-black hover:scale-105 active:scale-90 transition-all duration-700 shadow-2xl">View ledger</button>
                       <div className="px-8 py-6 rounded-[2.5rem] bg-black/40 border-2 border-white/5 flex flex-col justify-center shadow-inner group-hover:border-indigo-500/20 transition-all duration-1000">
                          <span className="text-[10px] font-black text-slate-950 uppercase italic leading-none mb-2 tracking-[0.2em] opacity-40">THRESHOLD</span>
                          <span className="text-[17px] font-black text-white leading-none italic uppercase tracking-widest drop-shadow-2xl">{">"} 90% PROB</span>
                       </div>
                    </div>
                 </div>

                 {/* Revenue HUD */}
                 <div className="p-12 rounded-[5rem] bg-emerald-500/5 border-4 border-emerald-500/10 flex flex-col gap-8 shadow-[0_80px_200px_rgba(0,0,0,1)] group hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all duration-1000 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
                    <div className="flex justify-between items-center relative z-10 px-4">
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-transform duration-1000"><ShoppingCart size={32} className="text-emerald-500" /></div>
                          <p className="text-[15px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none group-hover:text-white transition-colors">Settled Revenue</p>
                       </div>
                       <div className="px-6 py-2 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 text-[11px] font-black text-emerald-400 italic shadow-3xl animate-pulse">VERIFIED</div>
                    </div>
                    <div className="flex items-baseline gap-6 px-4 pb-2 relative z-10">
                       <span className="text-7xl font-black text-white italic tabular-nums leading-none tracking-tighter drop-shadow-[0_10px_40px_rgba(0,0,0,0.5)] group-hover:text-emerald-400 transition-colors duration-1000">${(financials.totalSettledUSD || 4284).toLocaleString()}</span>
                       <span className="text-[13px] font-black text-emerald-500/40 uppercase italic tracking-[0.6em] mb-1">Settled</span>
                    </div>
                 </div>

                 <button onClick={() => loadAll()} className="w-full relative group h-24 rounded-[3.5rem] overflow-hidden shadow-[0_80px_200px_rgba(99,102,241,0.3)] active:scale-95 transition-all outline-none border-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-indigo-500 to-violet-800 transition-all duration-1000 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-white/10 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative flex items-center justify-center gap-10 font-black text-[20px] uppercase tracking-[0.8em] italic text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                       <Rocket size={40} className="group-hover:translate-x-6 group-hover:-translate-y-6 transition-transform duration-[1.5s] ease-out" />
                       SCALE_OPERATIONS // 10X
                    </div>
                 </button>
              </div>
           </div>

           {/* Cryptographic Decision Ledger */}
           <section className={`${glassStyle} h-96 rounded-[6rem] p-16 flex flex-col group overflow-hidden relative border-emerald-500/20 bg-black/40 shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-500/[0.04] blur-[100px] rounded-full translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-emerald-500/[0.08] transition-all duration-[3s]" />
              <div className="flex items-center justify-between relative z-10 mb-12 px-8 pt-4">
                 <div className="flex items-center gap-10">
                    <div className="w-20 h-20 rounded-[3rem] bg-emerald-500/5 border-2 border-emerald-500/20 flex items-center justify-center shadow-3xl group-hover:rotate-[30deg] transition-transform duration-1000"><Shield size={40} className="text-emerald-500 animate-pulse" /></div>
                    <div>
                       <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 leading-none italic drop-shadow-2xl">Decision Ledger</h3>
                       <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none border-l-4 border-emerald-500/20 pl-8 ml-4">Cryptographic Decision Entropy Logs</p>
                    </div>
                 </div>
                 <button onClick={() => setGovernanceOpen(true)} className="px-12 py-5 bg-emerald-600 text-black rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] italic hover:bg-white hover:scale-110 active:scale-75 transition-all duration-700 shadow-[0_40px_100px_rgba(16,185,129,0.3)]">Review</button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-8 relative z-10 px-8">
                 {thoughts.slice(0, 15).map((t, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1 - (i * 0.08), x: 0 }} transition={{ duration: 1, delay: i * 0.05 }} className="flex items-start gap-10 p-6 rounded-[2.5rem] bg-white/[0.01] border-2 border-white/[0.03] group/log hover:bg-white/5 hover:border-emerald-500/20 transition-all duration-700">
                       <span className="text-[12px] font-mono font-black text-emerald-500/60 mt-1 tabular-nums italic group-hover:text-emerald-400 transition-colors">BLOCK_0x_{1240 - i}</span>
                       <p className="text-[14px] font-black text-slate-600 italic uppercase tracking-tighter leading-relaxed group-hover:text-white transition-colors duration-700">{t}</p>
                    </motion.div>
                 ))}
              </div>

              <div className="flex justify-between items-end text-[12px] font-black text-slate-900 tracking-[0.6em] relative z-10 mt-12 border-t-2 border-white/5 pt-12 px-8 italic bg-black/40 -mx-16 px-16 -mb-4 pb-12 rounded-b-[6rem]">
                 <div className="flex flex-col gap-4">
                    <span className="text-white/60">LATTICE_HEIGHT: <span className="text-white">{ledgerState.height}</span></span>
                    <span className="opacity-40">TX_TOTAL_CONSENSUS: {ledgerState.transactions}</span>
                 </div>
                 <div className="text-right flex flex-col items-end gap-6">
                    <div className="px-8 py-3 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-black border-2 border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]">VERIFIED</div>
                    <div className="flex items-center gap-4 text-[10px] font-mono opacity-20 uppercase">
                       <Scan size={14} />
                       <span className="truncate w-48 text-right">HASH_ROOT: {ledgerState.lastHash}_SOVEREIGN</span>
                    </div>
                 </div>
              </div>
           </section>
        </aside>
      </main>

      <AnimatePresence>
        {governanceOpen && <SovereignGovernancePortal proposals={proposals} onVote={() => {}} onClose={() => setGovernanceOpen(false)} />}
      </AnimatePresence>

      <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        @keyframes shimmer-ultra { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .animate-shimmer { animation: shimmer-ultra 4s infinite linear; }
        .shadow-3xl { shadow: 0 40px 150px rgba(0,0,0,0.8); }
      `}</style>
    </div>
  )
}

export default InfiniteAgencyDashboardView
