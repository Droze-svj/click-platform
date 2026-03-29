'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import {
  Video, Sparkles, Send, BarChart3, Brain, RefreshCw,
  ArrowRight, Zap, TrendingUp, Flame, FileText, CalendarDays,
  Target, CheckCircle2, Clock, Activity, Wifi, AlertTriangle, Globe, Settings,
  Shield, Layers, Cpu, Radio, Terminal, Hexagon, ArrowLeft, Monitor, User,
  Power, Box, ZapOff, ActivitySquare, Fingerprint, Gauge, Network, Database,
  Scan, Orbit, Binary, Wind, Ghost, Signal, ShieldCheck, ActivityIcon,
  CpuIcon, HardDrive, Workflow, ShieldAlert, UserCheck, Key, Anchor,
  ChevronRight, Sparkle, Command
} from 'lucide-react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import ToastContainer from '../../components/ToastContainer'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import NeuralStrategyHub from '../../components/NeuralStrategyHub'
import NeuralWorkspaceHub from '../../components/NeuralWorkspaceHub'
import { useDebug } from '../../hooks/useDebug'
import { validateFile } from '../../utils/fileValidator'
import LiveActivityFeed from '../../components/LiveActivityFeed'
import { useTheme } from '../../components/ThemeProvider'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

const MISSION_ACTIONS = [
  { label: 'Spectral Forge',   desc: 'Neural motion synthesis',     icon: Video,        href: '/dashboard/video',              badge: 'KINETIC' },
  { label: 'Neural Forge',     desc: 'Autonomous logic crafting',   icon: Sparkles,     href: '/dashboard/content',            badge: 'AI_LOGIC' },
  { label: 'Temporal Matrix',  desc: 'Chronos orchestration',        icon: Send,         href: '/dashboard/scheduler',          badge: 'SYNC' },
  { label: 'Heuristic Intel',  desc: 'Spectral surge mapping',      icon: BarChart3,    href: '/dashboard/insights',           badge: 'INTEL' },
  { label: 'Cognitive Matrix', desc: 'Predictive trend consensus',  icon: Brain,        href: '/dashboard/ai',                 badge: 'NEURAL' },
  { label: 'Recursive Flux',   desc: 'Lattice repurposing',         icon: RefreshCw,    href: '/dashboard/recycling',          badge: 'FLUX' },
  { label: 'Autonomous Hub',   desc: 'Global node synchronization', icon: Globe,        href: '/dashboard/agency',             badge: 'MATRIX' },
  { label: 'Marketing Oracle', desc: 'Global AI marketing expert',  icon: TrendingUp,   href: '/dashboard/marketing-ai',       badge: 'ORACLE' },
]


type NexusView = 'overview' | 'strategy' | 'workspace'

interface NexusStat { label: string; value: string | number; icon: React.ElementType; color: string; bg: string; trend?: string }

function GlobalPayloadDropZone() {
  const [dragging, setDragging] = useState(false)
  
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
    const onDragLeave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault(); setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return
      const f = files[0]
      const result = await validateFile(f, { allowedTypes: ['video/', 'image/', 'audio/'], maxSizeMB: 500 })
      if (result.valid) window.location.href = '/dashboard/video'
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-indigo-500/20 backdrop-blur-3xl border-8 border-dashed border-indigo-500/40 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <div className={`w-64 h-64 rounded-[5rem] ${glassStyle} flex items-center justify-center mx-auto mb-16 shadow-[0_0_200px_rgba(99,102,241,0.6)] bg-indigo-500/30 scale-110 border-indigo-500/50`}>
              <Box className="w-24 h-24 text-white animate-bounce" />
            </div>
            <p className="text-8xl font-black italic text-white uppercase tracking-tighter leading-none mb-8 drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]">Inject Payload</p>
            <p className="text-[18px] text-indigo-400 font-bold uppercase tracking-[1em] italic animate-pulse">Neural validation sequence initiated_v16.0</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function SovereignCommandConsolePage() {
  const { user } = useAuth()
  const [activeView, setActiveView] = useState<NexusView>('overview')
  const [stats] = useState<NexusStat[]>([
    { label: 'Operational Payloads', value: '14/48',    icon: Video,      color: 'text-rose-400',    bg: 'bg-rose-500/10', trend: 'SURGE +12%' },
    { label: 'Lattice Integrity',    value: '98.4%',   icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: 'AUTONOMOUS' },
    { label: 'Recursive Swarm Flux', value: '42.8',    icon: Zap,        color: 'text-amber-400',   bg: 'bg-amber-500/10', trend: 'CONSENSUS_PEAK' },
    { label: 'Synchronous Node Uplinks', value: '12',  icon: Signal,     color: 'text-indigo-400', bg: 'bg-indigo-500/10', trend: 'STABLE' },
  ])
  const [apiStatus, setApiStatus] = useState<'ok' | 'down' | 'checking'>('checking')
  
  const [recentManifests] = useState([
    { text: 'Trajectory locked: TikTok Surge', time: '2h ago', icon: Radio,        color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
    { text: 'Hook Efficiency: 94/100',         time: '4h ago', icon: Flame,        color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    { text: 'Autonomous Synthesis Complete',   time: 'Yesterday', icon: Cpu,       color: 'text-emerald-400',  bg: 'bg-emerald-500/10' },
    { text: 'Social Sync: 5 Nodes Updated',    time: 'Yesterday', icon: Globe,     color: 'text-fuchsia-400',   bg: 'bg-fuchsia-500/10' },
  ])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Neural Dawn' : hour < 17 ? 'Cycle Zenith' : 'Logic Nocturne'
  const firstName = (user as any)?.name?.split(' ')[0] || 'Sovereign'

  useEffect(() => {
    fetch('/api/health').then(res => setApiStatus(res.ok ? 'ok' : 'down')).catch(() => setApiStatus('down'))
  }, [])

  return (
    <ErrorBoundary>
      <GlobalPayloadDropZone />
      <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
        <SubscriptionBanner />
        <ToastContainer />
      </div>

      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1850px] mx-auto space-y-24">
        {/* Persistent Background Layer */}
        <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
           <Shield size={1000} className="text-white absolute -top-40 -right-40 rotate-12 blur-[2px]" />
           <Command size={1200} className="text-white absolute -bottom-80 -left-60 rotate-[32deg] blur-[1px]" />
        </div>

        {/* Command Header Hub */}
        <header className="flex flex-col xl:flex-row items-center justify-between gap-12 relative z-[100]">
           <div className="flex items-center gap-12">
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Shield size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-8 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Command Matrix v16.4.2</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className={`w-3 h-3 rounded-full ${apiStatus === 'ok' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]' : 'bg-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,1)]'} `} />
                       <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase italic leading-none">{apiStatus === 'ok' ? 'LATTICE_SECURE' : 'SYNC_INTERRUPTED'}</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                   {greeting}, {firstName.toUpperCase()}
                 </h1>
                 <p className="text-slate-800 text-[15px] uppercase font-black tracking-[0.6em] italic mt-4 leading-none">Central node for mission architecture and recursive swarm resonance.</p>
              </div>
           </div>

           <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-[5rem] bg-white/[0.02] border border-white/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative z-10 backdrop-blur-3xl bg-black/40">
              {[
                { id: 'overview',  label: 'Mission_Nexus', icon: Activity },
                { id: 'strategy',  label: 'Heuristic_Logic', icon: Brain },
                { id: 'workspace', label: 'Operational_Lattice', icon: Layers },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveView(tab.id as NexusView)}
                  className={`flex items-center gap-6 px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic active:scale-90 border-2 ${
                    activeView === tab.id 
                    ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' 
                    : 'text-slate-800 border-transparent hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <tab.icon size={28} className={activeView === tab.id ? 'text-black' : 'text-slate-800'} />
                  {tab.label}
                </button>
              ))}
           </div>
           
           <div className="flex items-center gap-10 pl-16 border-l-2 border-white/10">
              <Link href="/dashboard/settings" title="Calibrate" className="w-20 h-20 rounded-[2.2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-950 hover:text-white transition-all hover:scale-125 active:scale-75 shadow-3xl group relative overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
                <Settings size={40} className="group-hover:rotate-180 transition-transform duration-1000 relative z-10" />
              </Link>
              <button title="Surveillance" className="w-20 h-20 rounded-[2.2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-950 hover:text-white transition-all hover:scale-125 active:scale-75 shadow-3xl group relative overflow-hidden">
                 <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
                 <Monitor size={40} className="group-hover:scale-110 transition-transform duration-700 relative z-10" />
              </button>
           </div>
        </header>

        {/* Command Matrix Interface */}
        <section className="relative z-10">
          <AnimatePresence mode="wait">
            {activeView === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, scale: 0.98, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.02, y: -100 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-24"
              >
                {/* Neural Flux Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
                  {stats.map((s, idx) => (
                    <motion.div key={idx} whileHover={{ y: -15, scale: 1.02 }} className={`${glassStyle} p-16 rounded-[5.5rem] group bg-black/40 relative overflow-hidden flex flex-col items-center text-center hover:border-indigo-500/40 shadow-[0_60px_150px_rgba(0,0,0,0.8)] border-white/5`}>
                      <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-1000 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><s.icon size={250} /></div>
                      <div className="flex items-center justify-center mb-12 w-full">
                        <div className={`w-28 h-28 rounded-[3.5rem] ${s.bg} border-2 border-white/5 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all duration-1000 scale-110`}>
                          <s.icon className={`w-14 h-14 ${s.color} drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]`} />
                        </div>
                      </div>
                      <p className="text-[14px] font-black text-slate-900 uppercase tracking-[0.8em] mb-6 italic leading-none opacity-60 group-hover:text-white transition-colors">{s.label}</p>
                      <h3 className="text-8xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-10 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] group-hover:text-indigo-400 transition-colors duration-1000">{s.value}</h3>
                      {s.trend && (
                        <div className="px-8 py-3 rounded-full bg-black/60 border-2 border-white/5 text-indigo-400 text-[11px] font-black uppercase tracking-[0.5em] italic flex items-center gap-4 shadow-inner group-hover:border-indigo-500/30 transition-all">
                          <ActivityIcon size={16} className="animate-pulse" /> {s.trend}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-20">
                   {/* Main Surveillance Monitor */}
                   <div className="xl:col-span-2 space-y-16">
                      <div className={`${glassStyle} rounded-[7rem] p-24 overflow-hidden relative min-h-[900px] flex flex-col border-indigo-500/20 hover:border-indigo-500/40 shadow-[inset_0_0_200px_rgba(0,0,0,1)] bg-black/40`}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-32 relative z-50 px-8">
                          <div>
                            <div className="flex items-center gap-6 mb-4">
                               <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl"><Fingerprint size={28} className="text-indigo-400 animate-pulse" /></div>
                               <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Nexus Surveillance</h2>
                            </div>
                            <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic pl-16 border-l-4 border-indigo-500/20 ml-6">Heuristic trajectory mapping // Node Latency: 32μs</p>
                          </div>
                          <div className="flex items-center gap-10">
                             <div className="flex items-center gap-6 px-12 py-5 rounded-[3rem] bg-indigo-500/5 border-2 border-indigo-500/30 shadow-[0_0_80px_rgba(99,102,241,0.2)]">
                                <div className="w-4 h-4 rounded-full bg-indigo-500 animate-ping" />
                                <span className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.4em] italic">SWARM_CONSENSUS: 98.2%</span>
                             </div>
                             <button className="w-20 h-20 rounded-[2.24rem] bg-white/[0.03] border-2 border-white/5 flex items-center justify-center text-slate-950 hover:text-white transition-all shadow-2xl hover:bg-black/80 hover:scale-110 active:scale-75 group/refresh"><RefreshCw size={36} className="group-hover/refresh:rotate-180 transition-transform duration-1000" /></button>
                          </div>
                        </div>

                        <div className="flex-1 rounded-[6rem] bg-[#020205] border-4 border-white/5 relative overflow-hidden flex items-center justify-center p-32 group/monitor shadow-[0_100px_300px_rgba(0,0,0,1)] hover:border-indigo-500/20 transition-all duration-[2s]">
                           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.08] via-transparent to-violet-500/[0.08]" />
                           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] mix-blend-overlay" />
                           <div className="absolute inset-0 border-[20px] border-black/80 rounded-[5.8rem] pointer-events-none" />
                           
                           {/* Neural visualization effect */}
                           <div className="absolute inset-0 flex items-center justify-center opacity-20 blur-[100px]">
                              <div className="w-[1200px] h-[1200px] bg-indigo-500/20 rounded-full animate-pulse" />
                              <div className="absolute w-[900px] h-[900px] bg-violet-500/10 rounded-full animate-[ping_10s_linear_infinite]" />
                           </div>
                           
                           <div className="relative text-center max-w-2xl z-10 group-hover/monitor:scale-105 transition-transform duration-[2s]">
                              <div className="relative mb-24 w-64 h-64 mx-auto group/brain">
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 10, repeat: Infinity }}
                                  className="absolute inset-0 bg-indigo-400 rounded-full blur-[100px] pointer-events-none"
                                />
                                <div className="relative w-64 h-64 rounded-[4.5rem] bg-gradient-to-br from-indigo-500 via-indigo-700 to-violet-900 flex items-center justify-center shadow-[0_60px_200px_rgba(99,102,241,0.6)] border-4 border-white/40 rotate-12 group-hover/brain:rotate-0 transition-all duration-[2s] group-hover:scale-110">
                                  <Brain size={160} className="text-white -rotate-12 group-hover/brain:rotate-0 transition-all duration-[2s] drop-shadow-2xl" />
                                </div>
                              </div>
                              <h3 className="text-8xl font-black text-white italic uppercase tracking-tighter mb-10 leading-none group-hover/monitor:text-indigo-400 transition-colors duration-[2s] drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">Viral Surge Detected</h3>
                              <p className="text-[17px] text-slate-700 font-black uppercase tracking-[0.5em] leading-[1.8] mb-20 italic opacity-60 max-w-xl mx-auto">Sector 09-Beta: AI_KINETIC_FLOW. Trajectory indicates massive retention spike (92.4%) in alpha-tier markets. Swarm consensus confirmed. Node dissolution bypassed.</p>
                              <button className="px-24 py-12 bg-white text-black rounded-[3.5rem] text-[18px] font-black uppercase tracking-[0.8em] shadow-[0_80px_200px_rgba(255,255,255,0.2)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic scale-125 active:scale-90 group/btn border-none relative overflow-hidden">
                                <div className="absolute inset-x-0 bottom-0 h-2 bg-indigo-300 animate-shimmer" />
                                <div className="relative z-10 flex items-center gap-6">
                                  <Zap size={32} className="group-hover/btn:animate-ping" /> INJECT_RECURSIVE_SWARM
                                </div>
                              </button>
                           </div>

                           {/* HUD Telemetry Stream */}
                           <div className="absolute bottom-16 left-16 right-16 flex justify-between items-end bg-black/60 backdrop-blur-3xl p-12 rounded-[4rem] border-2 border-white/5 shadow-3xl">
                              <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                   <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"><Gauge size={20} className="text-indigo-400 animate-pulse" /></div>
                                   <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none opacity-60">Neural Swarm Load Capacity</p>
                                </div>
                                <div className="w-96 h-4 bg-black/80 rounded-full overflow-hidden border-2 border-white/5 shadow-inner p-0.5">
                                  <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} transition={{ duration: 4, ease: "circOut" }} className="h-full bg-gradient-to-r from-indigo-700 to-indigo-400 shadow-[0_0_30px_rgba(99,102,241,1)] rounded-full relative">
                                     <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                                  </motion.div>
                                </div>
                              </div>
                              <div className="space-y-4 text-right pr-4 pb-2">
                                <div className="flex items-center justify-end gap-3 text-[12px] font-black text-slate-900 uppercase tracking-widest italic opacity-40">
                                   <Wifi size={14} /> CROSS_LATTICE_LATENCY
                                </div>
                                <div className="flex items-end gap-2 group/lat transition-all duration-700">
                                   <p className="text-7xl font-black text-emerald-400 italic tabular-nums tracking-tighter leading-none glow-text drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">0.032</p>
                                   <span className="text-2xl font-black text-emerald-400/40 italic mb-1 uppercase tracking-tighter decoration-emerald-500/20 leading-none">ms</span>
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                   </div>

                   {/* Heuristic Intelligence Feed */}
                   <div className="space-y-20">
                      <div className={`${glassStyle} rounded-[6rem] p-16 relative overflow-hidden border-white/5 group min-h-[450px] flex flex-col justify-center bg-black/60 shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
                         <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-[3s] pointer-events-none group-hover:rotate-45 group-hover:scale-150"><Sparkles className="text-indigo-400" size={300} /></div>
                         <div className="w-24 h-24 rounded-[3.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center mb-16 shadow-[0_40px_100px_rgba(99,102,241,0.2)] transition-all duration-1000 group-hover:rotate-12 group-hover:scale-110">
                            <Sparkle className="text-indigo-400 animate-pulse" size={64} />
                         </div>
                         <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter mb-10 leading-none border-l-8 border-indigo-500/40 pl-8">Consensus Protocol</h3>
                         <p className="text-2xl text-slate-800 italic font-black leading-[1.6] mb-16 uppercase tracking-tight opacity-80 group-hover:text-white transition-colors duration-1000">
                           &quot;Pattern-interrupt triggers drive 3.2× more retention than high-fidelity hooks. Traversal bypass required for logic-heavy segments. Shift resonance.&quot;
                         </p>
                         <div className="p-12 rounded-[4rem] bg-[#020205] border-2 border-white/5 relative overflow-hidden shadow-inner group-hover:border-indigo-500/40 transition-all duration-1000">
                            <div className="absolute inset-0 bg-indigo-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-6 mb-8 relative z-10">
                               <Terminal size={20} className="text-indigo-400 animate-pulse" />
                               <p className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.8em] italic leading-none">AUTO_MISSION_OVERRIDE_12.4</p>
                            </div>
                            <p className="text-[15px] text-slate-900 font-black leading-[1.8] uppercase tracking-[0.2em] italic relative z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                              Execute 12 synthesis cycles with hyper-kinetic visuals (1-frame lattice cuts). Suppress neural audio signatures until frame 0042.
                            </p>
                         </div>
                      </div>

                      {/* Operation Node Lattice Grid */}
                      <div className="grid grid-cols-2 gap-12">
                         {MISSION_ACTIONS.slice(0, 4).map((act, i) => (
                           <Link key={i} href={act.href} className={`${glassStyle} group relative p-12 rounded-[4.5rem] bg-black/40 hover:bg-black/80 transition-all duration-1000 overflow-hidden border-white/5 hover:border-indigo-500/50 shadow-[0_40px_100px_rgba(0,0,0,0.6)] flex flex-col justify-between min-h-[220px]`}>
                              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                              <div className="flex justify-between items-start w-full relative z-10">
                                 <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/[0.03] border-2 border-white/5 flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 shadow-[0_40px_80px_rgba(0,0,0,0.6)] group-hover:text-indigo-400 text-slate-950">
                                    <act.icon size={40} />
                                 </div>
                                 {act.badge && (
                                   <div className="p-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 shadow-2xl">
                                      <span className="text-[10px] font-black text-white uppercase tracking-[0.4em] px-5 py-2 rounded-full bg-black/60 block italic leading-none">{act.badge}</span>
                                   </div>
                                 )}
                              </div>
                              <div className="relative z-10 mt-12 pl-4">
                                <p className="text-[20px] font-black text-white uppercase tracking-[0.4em] italic group-hover:translate-x-4 transition-transform duration-1000 leading-none mb-3 drop-shadow-2xl">{act.label}</p>
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic mt-4 opacity-40 group-hover:opacity-100 transition-opacity duration-1000">{act.desc}</p>
                              </div>
                           </Link>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Mission Integrity Ledger (Recent activity) */}
                <footer className={`${glassStyle} rounded-[7rem] p-24 border-emerald-500/10 hover:border-emerald-500/40 group shadow-[0_100px_300px_rgba(0,0,0,1)] bg-black/40 transition-all duration-1000`}>
                   <div className="flex flex-col xl:flex-row items-center justify-between gap-12 mb-32 px-8">
                      <div className="flex items-center gap-12">
                        <div className="w-24 h-24 rounded-[3.5rem] bg-emerald-500/5 border-2 border-emerald-500/20 flex items-center justify-center shadow-[0_0_100px_rgba(16,185,129,0.1)] group-hover:rotate-[30deg] transition-all duration-1000 animate-pulse">
                          <ActivitySquare className="text-emerald-500" size={56} />
                        </div>
                        <div>
                           <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Integrity Ledger</h2>
                           <p className="text-[15px] font-black text-slate-800 uppercase tracking-[1em] italic leading-none border-l-4 border-emerald-500/20 pl-8 ml-4">Autonomous Node Saturation // Operational Resonance Feed</p>
                        </div>
                      </div>
                      <button className="px-24 py-12 rounded-[4rem] bg-white text-black text-[18px] font-black uppercase tracking-[0.8em] italic shadow-[0_40px_100px_rgba(0,0,0,0.6)] hover:bg-emerald-600 hover:text-white transition-all duration-1000 scale-110 active:scale-90 group border-none relative overflow-hidden">
                        <div className="absolute inset-x-0 bottom-0 h-2 bg-emerald-300 animate-shimmer" />
                        <div className="relative z-10 flex items-center gap-8">
                          MONITOR_SYNC_NODE <ArrowRight size={28} className="group-hover:translate-x-6 transition-transform duration-1000" />
                        </div>
                      </button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 px-4 pb-4">
                      {recentManifests.map((item, i) => (
                        <motion.div key={i} whileHover={{ scale: 1.05, y: -10 }} className="p-16 rounded-[4.5rem] bg-black/80 border-2 border-white/5 hover:border-emerald-500/50 transition-all duration-1000 group/item flex flex-col justify-between min-h-[280px] shadow-[inset_0_0_100px_rgba(255,255,255,0.02)] relative overflow-hidden">
                           <div className="absolute inset-0 bg-emerald-500/[0.04] opacity-0 group-hover/item:opacity-100 transition-opacity duration-1000" />
                           <div className="flex items-center justify-between mb-12 w-full relative z-10">
                              <div className={`p-6 rounded-[2.5rem] ${item.bg} border-2 border-white/10 shadow-3xl transition-all duration-1000 group-hover/item:scale-125 group-hover:rotate-12`}>
                                 <item.icon className={`${item.color} drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`} size={40} />
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                 <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic opacity-40">{item.time.toUpperCase()}</span>
                                 <div className="w-12 h-1 bg-white/5 rounded-full" />
                              </div>
                           </div>
                           <p className="text-[18px] font-black text-slate-800 uppercase tracking-[0.2em] italic group-hover/item:text-white transition-colors duration-1000 leading-relaxed mb-12 relative z-10 drop-shadow-2xl">{item.text.toUpperCase()}</p>
                           <div className="flex justify-end relative z-10">
                              <div className="w-16 h-16 rounded-[2rem] bg-white/[0.02] border-2 border-white/5 flex items-center justify-center group-hover/item:bg-emerald-500/20 group-hover/item:border-emerald-500/50 transition-all duration-1000 shadow-3xl hover:scale-110 active:scale-75 cursor-pointer">
                                <ArrowUpRight size={32} className="text-slate-950 group-hover/item:text-emerald-400 group-hover/item:translate-x-2 group-hover/item:-translate-y-2 transition-all duration-1000" />
                              </div>
                           </div>
                        </motion.div>
                      ))}
                   </div>
                </footer>
              </motion.div>
            )}

            {activeView === 'strategy' && (
              <motion.div key="strategy" initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1, y: -50 }} transition={{ duration: 0.8, ease: "anticipate" }}>
                <NeuralStrategyHub />
              </motion.div>
            )}

            {activeView === 'workspace' && (
              <motion.div key="workspace" initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.1, y: -50 }} transition={{ duration: 0.8, ease: "anticipate" }}>
                <NeuralWorkspaceHub />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .glow-text { text-shadow: 0 0 40px rgba(16, 185, 129, 0.6); }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; }
          @keyframes shimmer-fast { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-shimmer { animation: shimmer-fast 2s infinite linear; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

const ArrowUpRight = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
)
