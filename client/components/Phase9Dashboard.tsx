'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Zap, FileJson, Users, Brain, Orbit, Activity, 
  MessageSquare, Radio, ShieldCheck, Share2, Rocket
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

const glass = 'backdrop-blur-2xl bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)]'
const pill = 'px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border'

// ─── Section Header ────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle, color = 'indigo', badge }: any) => {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    purple: 'text-purple-400 border-purple-500/20 bg-purple-500/10',
    cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10'
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

// ─── A: Neural Broadcaster Panel ───────────────────────────────────────────
const NeuralBroadcasterPanel = () => {
  const [pipeline, setPipeline] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const runPrediction = async () => {
    setLoading(true)
    try {
      const result = await apiPost('/phase9/broadcaster/build-pipeline', {
        videoId: `vid_${Date.now()}`,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        aeoMetadata: {
          summary: "Scale your revenue completely autonomously with Sovereign.",
          productData: {
            pricing: { price: '299' },
            ctaUrl: 'https://sovereign.city'
          }
        }
      })
      if (result.pipeline) {
        setPipeline(result.pipeline)
        showToast('Deployment Pipeline Scheduled', 'success')
      }
    } catch (e) {
      showToast('Pipeline build failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const platColor: Record<string, string> = {
    tiktok: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10',
    youtube_shorts: 'text-rose-400 border-rose-500/20 bg-rose-500/10',
    instagram_reels: 'text-purple-400 border-purple-500/20 bg-purple-500/10'
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Radio} title="The Neural Broadcaster" subtitle="Autonomic Cross-Platform Deployment" color="cyan" badge="ZERO-CLICK" />
      
      <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-cyan-400 font-black not-italic">How it works:</span> The engine bypasses human publishing, automatically finding the algorithmic &quot;golden minute&quot; to deploy across all short-form platforms simultaneously, injecting your Phase 8 AEO tags perfectly formatted for each.
        </p>
      </div>

      <button onClick={runPrediction} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-600/20">
        {loading ? <Orbit className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        Schedule Omnipresence Drop
      </button>

      <AnimatePresence>
        {pipeline && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-6">
            <div className="flex justify-between items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div>
                <p className="text-sm font-black text-white">Algorithmic Launch Window</p>
                <p className="text-[10px] font-mono text-cyan-400">{new Date(pipeline.timingLogic.scheduledTime).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400">Velocity Propensity</p>
                <p className="text-xl font-black text-emerald-400">{(pipeline.timingLogic.predictedVelocity * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid gap-4 mt-6">
              {pipeline.deployments?.map((dep: any, i: number) => (
                <div key={i} className={`p-5 rounded-2xl border ${platColor[dep.platform]}`}>
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-black uppercase">{dep.platform.replace('_', ' ')}</p>
                    <span className="px-2 py-1 text-[8px] font-bold uppercase bg-white/10 rounded-md">Crop: {dep.renderCrop}</span>
                  </div>
                  <p className="text-[10px] opacity-80 font-mono italic">&quot;{dep.injectedDescription}&quot;</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── B: Federated Swarm Intelligence Panel ─────────────────────────────────
const FederatedSwarmPanel = () => {
  const [swarmState, setSwarmState] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const fetchPulse = async () => {
    setLoading(true)
    try {
      const result = await apiGet('/phase9/swarm/pulse')
      if (result.snapshot) setSwarmState(result.snapshot)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPulse()
    const interval = setInterval(fetchPulse, 10000)
    return () => clearInterval(interval)
  }, [])

  const syncLocal = async () => {
    try {
      await apiPost('/phase9/swarm/sync', { localVirality: 0.95, tacticUsed: 'ugcRaw' })
      showToast('Local insights pushed to Global Ledger', 'success')
      fetchPulse()
    } catch {
      showToast('Sync failed', 'error')
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Share2} title="Federated Swarm" subtitle="Global Intelligence Ledger" color="purple" badge="DECENTRALIZED" />

      <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-purple-400 font-black not-italic">The Collective:</span> {swarmState ? swarmState.activeNodes : '---'} active creator nodes are feeding real-time engagement data back to the core. If a spatial trick goes viral in Japan, your agent learns it in seconds.
        </p>
      </div>

      <div className="flex gap-4">
        <button onClick={fetchPulse} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-300 font-bold text-[10px] uppercase tracking-wider transition-all">
          <Activity className="w-4 h-4" /> Fetch Pulse
        </button>
        <button onClick={syncLocal}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/40 text-emerald-300 font-bold text-[10px] uppercase tracking-wider transition-all">
          <Zap className="w-4 h-4" /> Push Local Breakthrough
        </button>
      </div>

      <AnimatePresence>
        {swarmState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-6">Trending Signals</p>
            <div className="grid gap-3">
              {swarmState.trendingSignals?.map((sig: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div>
                    <p className="text-sm font-black text-white">{sig.tactic.replace('_', ' ')}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{sig.platform.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${sig.status === 'DOMINANT' ? 'text-indigo-400' : sig.status === 'RISING' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {sig.status}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">v.{sig.viralScore}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── C: Autonomic Community Manager ─────────────────────────────────────────
const AutonomicCMPaPanel = () => {
  const [running, setRunning] = useState(false)
  const [telemetry, setTelemetry] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const fetchStatus = useCallback(async () => {
    try {
      const result = await apiGet('/phase9/autonomic-cm/status')
      // Map 'active' or 'shadow' to running state
      if (result.status === 'active' || result.status === 'shadow') {
        setRunning(true)
        setTelemetry({
          ...result.telemetry,
          engagementCount: result.engagementCount || 0
        })
      } else {
        setRunning(false)
      }
    } catch (e) {
      console.error('Failed to fetch agent status', e)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const launchAgent = async () => {
    setLoading(true)
    try {
      await apiPost('/phase9/autonomic-cm/start')
      setRunning(true)
      showToast('Autonomic Agent Deployed', 'success')
      fetchStatus()
    } catch (e: any) {
      showToast(e.message || 'Agent deployment failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={MessageSquare} title="Autonomic Community" subtitle="LLM-Powered Auto-Response Array" color="emerald" badge="ALGORITHM BOOST" />
      
      <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-emerald-400 font-black not-italic">Omnipresence Logic:</span> The agent monitors all connected social channels, analyzing sentiment in real-time. It prioritizes high-impact engagement to maximize the &quot;Golden Hour&quot; algorithmic boost.
        </p>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={launchAgent} disabled={running || loading}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${running ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'}`}>
          {loading ? <Orbit className="w-4 h-4 animate-spin" /> : (running ? <ShieldCheck className="w-4 h-4" /> : <Brain className="w-4 h-4" />)}
          {running ? 'Agent Live & Monitoring' : 'Deploy CM Agent'}
        </button>

        {running && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> ACTIVE PULSE
          </div>
        )}
      </div>

      <AnimatePresence>
        {running && telemetry && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-6 pt-4">
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sentiment</p>
              <p className="text-2xl font-black text-white italic">{(telemetry.avgSentiment * 100).toFixed(0)}%</p>
              <p className="text-[8px] font-bold text-emerald-500 uppercase mt-1">Positive Shift</p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Engaged Tracker</p>
              <p className="text-2xl font-black text-white italic">{telemetry.engagementCount}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Total Actions</p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Swarms</p>
              <p className="text-2xl font-black text-white italic">{telemetry.activeSwarms}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Active Nodes</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── D: Oracle Sandbox (Variant Testing) ───────────────────────────────────
const OracleSandboxPanel = () => {
  const [deployed, setDeployed] = useState(false)
  const { showToast } = useToast()

  const deployVariants = async () => {
    try {
      await apiPost('/phase9/oracle-sandbox/deploy')
      setDeployed(true)
      showToast('3 Dark Variants pushed to TikTok Spark', 'success')
    } catch {
      showToast('Deployment failed', 'error')
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Orbit} title="Oracle Sandbox" subtitle="A/B/C Concept Testing at Micro-Budgets" color="amber" badge="WINNER TAKES ALL" />
      
      <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-amber-400 font-black not-italic">The Strategy:</span> Generates 3 totally different UGC variants, runs them for 2 hours on $5 ad-sets, and automatically scales the winner with the remaining daily budget.
        </p>
      </div>

      <button onClick={deployVariants} disabled={deployed}
        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${deployed ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-95'}`}>
        <Zap className="w-4 h-4" />
        {deployed ? 'Variants Scaling in Background' : 'Deploy Sandbox Array'}
      </button>
    </div>
  )
}

// ─── Main Phase 9 Dashboard ────────────────────────────────────────────────
export default function Phase9Dashboard() {
  const SECTIONS = [
    { id: 'broadcaster', label: 'Neural Broadcaster', icon: Radio },
    { id: 'swarm', label: 'Federated Swarm', icon: Share2 },
    { id: 'cm', label: 'Community Agent', icon: MessageSquare },
    { id: 'oracle', label: 'Oracle Sandbox', icon: Orbit }
  ]

  const [activeSection, setActiveSection] = useState('broadcaster')

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-12 px-8">
      {/* Header */}
      <div className="border-b border-white/[0.05] pb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-indigo-500/10 border border-white/10 flex items-center justify-center">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`${pill} text-cyan-400 border-cyan-500/20`}>Phase 9 — Sovereign Omnipresence</span>
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Global Network</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Autonomous Distribution & Federated Intelligence</p>
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
          {activeSection === 'broadcaster' && <NeuralBroadcasterPanel />}
          {activeSection === 'swarm' && <FederatedSwarmPanel />}
          {activeSection === 'cm' && <AutonomicCMPaPanel />}
          {activeSection === 'oracle' && <OracleSandboxPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
