'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Zap, FileJson, Users, Brain, Orbit, Activity, 
  MessageSquare, Radio, ShieldCheck, Share2, Rocket
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

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

// ─── A: Neural Broadcaster Panel ───────────────────────────────────────────
const NeuralBroadcasterPanel = () => {
  const { t } = useTranslation()
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
        showToast(t('phase9Dashboard.deploymentPipelineScheduled'), 'success')
      }
    } catch (e) {
      showToast(t('phase9Dashboard.pipelineBuildFailed'), 'error')
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
      <SectionHeader icon={Radio} title={t('phase9Dashboard.neuralBroadcasterTitle')} subtitle={t('phase9Dashboard.neuralBroadcasterSubtitle')} color="cyan" badge={t('phase9Dashboard.zeroClickBadge')} />

      <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-cyan-400 font-black not-italic">{t('phase9Dashboard.howItWorks')}</span> {t('phase9Dashboard.neuralBroadcasterDescription')}
        </p>
      </div>

      <button type="button" onClick={runPrediction} disabled={loading}
        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-600/20">
        {loading ? <Orbit className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {t('phase9Dashboard.scheduleOmnipresenceDrop')}
      </button>

      <AnimatePresence>
        {pipeline && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-6">
            <div className="flex justify-between items-center p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div>
                <p className="text-sm font-black text-white">{t('phase9Dashboard.algorithmicLaunchWindow')}</p>
                <p className="text-[10px] font-mono text-cyan-400">{new Date(pipeline.timingLogic.scheduledTime).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400">{t('phase9Dashboard.velocityPropensity')}</p>
                <p className="text-xl font-black text-emerald-400">{(pipeline.timingLogic.predictedVelocity * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid gap-4 mt-6">
              {pipeline.deployments?.map((dep: any, i: number) => (
                <div key={i} className={`p-5 rounded-2xl border ${platColor[dep.platform]}`}>
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-black uppercase">{dep.platform.replace('_', ' ')}</p>
                    <span className="px-2 py-1 text-[8px] font-bold uppercase bg-white/10 rounded-md">{t('phase9Dashboard.cropLabel', { crop: dep.renderCrop })}</span>
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
  const { t } = useTranslation()
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
      showToast(t('phase9Dashboard.localInsightsPushed'), 'success')
      fetchPulse()
    } catch {
      showToast(t('phase9Dashboard.syncFailed'), 'error')
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Share2} title={t('phase9Dashboard.federatedSwarmTitle')} subtitle={t('phase9Dashboard.federatedSwarmSubtitle')} color="purple" badge={t('phase9Dashboard.decentralizedBadge')} />

      <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-purple-400 font-black not-italic">{t('phase9Dashboard.theCollective')}</span> {t('phase9Dashboard.federatedSwarmDescription', { nodes: swarmState ? swarmState.activeNodes : '---' })}
        </p>
      </div>

      <div className="flex gap-4">
        <button type="button" onClick={fetchPulse} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-300 font-bold text-[10px] uppercase tracking-wider transition-all">
          <Activity className="w-4 h-4" /> {t('phase9Dashboard.fetchPulse')}
        </button>
        <button type="button" onClick={syncLocal}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/40 text-emerald-300 font-bold text-[10px] uppercase tracking-wider transition-all">
          <Zap className="w-4 h-4" /> {t('phase9Dashboard.pushLocalBreakthrough')}
        </button>
      </div>

      <AnimatePresence>
        {swarmState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-6">{t('phase9Dashboard.trendingSignals')}</p>
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
  const { t } = useTranslation()
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
      showToast(t('phase9Dashboard.autonomicAgentDeployed'), 'success')
      fetchStatus()
    } catch (e: any) {
      showToast(e.message || t('phase9Dashboard.agentDeploymentFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={MessageSquare} title={t('phase9Dashboard.autonomicCommunityTitle')} subtitle={t('phase9Dashboard.autonomicCommunitySubtitle')} color="emerald" badge={t('phase9Dashboard.algorithmBoostBadge')} />

      <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-emerald-400 font-black not-italic">{t('phase9Dashboard.omnipresenceLogic')}</span> {t('phase9Dashboard.autonomicCommunityDescription')}
        </p>
      </div>

      <div className="flex items-center gap-6">
        <button type="button" onClick={launchAgent} disabled={running || loading}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${running ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'}`}>
          {loading ? <Orbit className="w-4 h-4 animate-spin" /> : (running ? <ShieldCheck className="w-4 h-4" /> : <Brain className="w-4 h-4" />)}
          {running ? t('phase9Dashboard.agentLiveMonitoring') : t('phase9Dashboard.deployCmAgent')}
        </button>

        {running && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('phase9Dashboard.activePulse')}
          </div>
        )}
      </div>

      <AnimatePresence>
        {running && telemetry && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-6 pt-4">
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('phase9Dashboard.sentiment')}</p>
              <p className="text-2xl font-black text-white italic">{(telemetry.avgSentiment * 100).toFixed(0)}%</p>
              <p className="text-[8px] font-bold text-emerald-500 uppercase mt-1">{t('phase9Dashboard.positiveShift')}</p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('phase9Dashboard.engagedTracker')}</p>
              <p className="text-2xl font-black text-white italic">{telemetry.engagementCount}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{t('phase9Dashboard.totalActions')}</p>
            </div>
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('phase9Dashboard.swarms')}</p>
              <p className="text-2xl font-black text-white italic">{telemetry.activeSwarms}</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{t('phase9Dashboard.activeNodes')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── D: Oracle Sandbox (Variant Testing) ───────────────────────────────────
const OracleSandboxPanel = () => {
  const { t } = useTranslation()
  const [deployed, setDeployed] = useState(false)
  const { showToast } = useToast()

  const deployVariants = async () => {
    try {
      await apiPost('/phase9/oracle-sandbox/deploy')
      setDeployed(true)
      showToast(t('phase9Dashboard.darkVariantsPushed'), 'success')
    } catch {
      showToast(t('phase9Dashboard.deploymentFailed'), 'error')
    }
  }

  return (
    <div className={`${glass} p-10 space-y-8`}>
      <SectionHeader icon={Orbit} title={t('phase9Dashboard.oracleSandboxTitle')} subtitle={t('phase9Dashboard.oracleSandboxSubtitle')} color="amber" badge={t('phase9Dashboard.winnerTakesAllBadge')} />

      <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/15">
        <p className="text-xs text-slate-400 leading-relaxed italic">
          <span className="text-amber-400 font-black not-italic">{t('phase9Dashboard.theStrategy')}</span> {t('phase9Dashboard.oracleSandboxDescription')}
        </p>
      </div>

      <button type="button" onClick={deployVariants} disabled={deployed}
        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${deployed ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20 active:scale-95'}`}>
        <Zap className="w-4 h-4" />
        {deployed ? t('phase9Dashboard.variantsScaling') : t('phase9Dashboard.deploySandboxArray')}
      </button>
    </div>
  )
}

// ─── Main Phase 9 Dashboard ────────────────────────────────────────────────
export default function Phase9Dashboard() {
  const { t } = useTranslation()
  const SECTIONS = [
    { id: 'broadcaster', label: t('phase9Dashboard.navNeuralBroadcaster'), icon: Radio },
    { id: 'swarm', label: t('phase9Dashboard.navFederatedSwarm'), icon: Share2 },
    { id: 'cm', label: t('phase9Dashboard.navCommunityAgent'), icon: MessageSquare },
    { id: 'oracle', label: t('phase9Dashboard.navOracleSandbox'), icon: Orbit }
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
              <span className={`${pill} text-cyan-400 border-cyan-500/20`}>{t('phase9Dashboard.headerPill')}</span>
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            </div>
            <h1 className="text-5xl font-black text-[var(--text-main)] italic uppercase tracking-tighter leading-none">{t('phase9Dashboard.headerTitle')}</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">{t('phase9Dashboard.headerSubtitle')}</p>
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
          {activeSection === 'broadcaster' && <NeuralBroadcasterPanel />}
          {activeSection === 'swarm' && <FederatedSwarmPanel />}
          {activeSection === 'cm' && <AutonomicCMPaPanel />}
          {activeSection === 'oracle' && <OracleSandboxPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
