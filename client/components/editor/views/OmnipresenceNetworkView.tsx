'use client'

import React, { useState, useEffect } from 'react'
import { 
  Globe, 
  Zap, 
  BrainCircuit, 
  Share2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Target, 
  Sparkles,
  Search,
  MessageSquare as AiIcon,
  Radio,
  BarChart3
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { 
  OmnipresencePulse, 
  AgentDraft, 
  NeuralPipeline,
  ContentNiche 
} from '../../../types/editor'
import { OracleSandboxHUD } from '../OracleSandboxHUD'

interface OmnipresenceNetworkViewProps {
  videoId?: string
  currentNiche?: ContentNiche
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const OmnipresenceNetworkView: React.FC<OmnipresenceNetworkViewProps> = ({ 
  videoId, 
  currentNiche = 'general',
  showToast 
}) => {
  const [niche, setNiche] = useState<ContentNiche>(currentNiche as ContentNiche)
  const [pulse, setPulse] = useState<OmnipresencePulse | null>(null)
  const [drafts, setDrafts] = useState<AgentDraft[]>([])
  const [pipeline, setPipeline] = useState<NeuralPipeline | null>(null)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchPulse, 30000) // Pulse updates every 30s
    return () => clearInterval(interval)
  }, [niche])

  const fetchData = async () => {
    setLoading(true)
    await Promise.all([fetchPulse(), fetchDrafts()])
    setLoading(false)
  }

  const fetchPulse = async () => {
    try {
      const data = await apiGet(`/phase9/swarm/pulse?niche=${niche}`)
      setPulse(data)
    } catch (err) {
      console.error('Pulse fetch failed')
    }
  }

  const fetchDrafts = async () => {
    try {
      const { drafts } = await apiGet('/phase9/autonomic-cm/drafts')
      setDrafts(drafts)
    } catch (err) {
      console.error('Drafts fetch failed')
    }
  }

  const handleBroadcast = async () => {
    if (!videoId) {
      showToast('No active video sequence detected', 'error')
      return
    }

    setIsBroadcasting(true)
    try {
      const { pipeline } = await apiPost('/phase9/broadcaster/build-pipeline', {
        videoId,
        platforms: ['tiktok', 'instagram', 'youtube', 'twitter'],
        aeoMetadata: { niche, summary: "Autonomous high-velocity asset deployment." }
      })
      setPipeline(pipeline)
      showToast('Neural Broadcast Pipeline Synchronized', 'success')
    } catch (err) {
      showToast('Broadcast Sync Failed', 'error')
    } finally {
      setIsBroadcasting(false)
    }
  }

  const broadcastS2SPulse = async (tactic: string) => {
    try {
      await apiPost('/phase10_12/intelligence/pulse', { tactic, confidence: 0.95 })
      showToast('Knowledge sync propagated', 'success')
      fetchPulse()
    } catch (err) {
      showToast('Pulse Broadcast Failed', 'error')
    }
  }

  const approveResponse = async (responseId: string) => {
    try {
      await apiPost('/phase9/autonomic-cm/approve', { responseId })
      setDrafts(prev => prev.filter(d => d._id !== responseId))
      showToast('Agent Response Dispatched', 'success')
    } catch (err) {
      showToast('Approval Failed', 'error')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-2 md:p-6">
      {/* Header with Niche Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">
                <Globe className="w-3.5 h-3.5 animate-pulse" />
                Click Network Active
            </div>
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                OMNIPRESENCE<br />NETWORK
            </h2>
        </div>

        <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-3xl">
            {(['general', 'b2b', 'gaming', 'lifestyle'] as ContentNiche[]).map(cat => (
                <button
                    key={cat}
                    onClick={() => setNiche(cat)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        niche === cat
                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20'
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Network Insights */}
        <div className="xl:col-span-1 space-y-6">
            <div className={`${glassStyle} rounded-[3rem] p-8 space-y-8`}>
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                        <BrainCircuit className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Network Signals</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Expert Viral Pulse</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {pulse?.trendingSignals.map((signal: any, idx: number) => (
                        <div key={idx} className="p-5 bg-black/40 border border-white/5 rounded-2xl space-y-3 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-white italic uppercase tracking-widest">{signal.tactic}</span>
                                <button 
                                    onClick={() => broadcastS2SPulse(signal.tactic)}
                                    className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                                    title="Broadcast S2S Pulse"
                                >
                                    <Zap className="w-3 h-3" />
                                </button>
                                <span className={`text-[8px] font-black px-3 py-1 rounded-full ${
                                    signal.status === 'DOMINANT' ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400'
                                } uppercase tracking-widest`}>
                                    {signal.status}
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-500 italic leading-relaxed">{signal.description}</p>
                            <div className="flex items-center gap-3">
                                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 transition-all duration-1000" 
                                        style={{ width: `${signal.viralScore * 100}%` }} 
                                    />
                                </div>
                                <span className="text-[10px] font-black text-indigo-400">{(signal.viralScore * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    ))}
                    {!pulse && [1,2,3].map(i => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl" />)}
                </div>
            </div>

            <div className="p-8 bg-indigo-600 rounded-[2.5rem] space-y-4 text-white">
                <div className="flex items-center justify-between">
                    <BarChart3 className="w-8 h-8" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80 italic">Network Reach</span>
                </div>
                <div>
                   <h3 className="text-3xl font-black italic tracking-tighter leading-none uppercase">{(pulse?.snapshot.activeNodes ?? 0) * 14}K</h3>
                   <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Global Impression Pulse</span>
                </div>
            </div>
        </div>

        {/* Center/Right Column: Agent & Broadcaster */}
        <div className="xl:col-span-2 space-y-8">
            
            {/* Neural Broadcaster HUD */}
            <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-10 opacity-5">
                    <Radio className="w-40 h-40 text-indigo-500" />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                            <Radio className={`w-6 h-6 ${isBroadcasting ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Neural Broadcaster</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Autonomous Dispatch Protocol</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleBroadcast}
                        disabled={isBroadcasting}
                        className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] italic shadow-2xl transition-all disabled:opacity-50"
                    >
                        {isBroadcasting ? 'Calibrating Pulse...' : 'Commence Broadcast'}
                    </button>
                </div>

                {pipeline ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                        {pipeline.deployments.map((dep: any, idx: number) => (
                            <div key={idx} className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                               <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-white uppercase italic">{dep.platform}</span>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                               </div>
                               <div className="space-y-1">
                                  <span className="text-[8px] font-black text-slate-500 uppercase">Status</span>
                                  <p className="text-[10px] font-black text-indigo-400 uppercase italic leading-none">{dep.status}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-slate-700" />
                                  <span className="text-[8px] font-bold text-slate-500">{new Date(dep.scheduledTime).toLocaleTimeString()}</span>
                               </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4">
                        <Share2 className="w-12 h-12 text-slate-800" />
                        <p className="text-xs font-medium text-slate-600 italic">No autonomous pipelines active in current frequency.</p>
                    </div>
                    )}
            </div>

            {/* Oracle Sandbox Integration */}
            <OracleSandboxHUD projectId={videoId ?? undefined} showToast={showToast} />

            {/* Agent Approval Matrix */}
            <div className={`${glassStyle} rounded-[3rem] p-10 space-y-10`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                            <AiIcon className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Agent Approvals</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Autonomous Community Manager</span>
                        </div>
                    </div>
                    <div className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {drafts.length} Pending
                    </div>
                </div>

                <div className="space-y-6">
                    <AnimatePresence mode="popLayout">
                        {drafts.map((draft) => (
                            <motion.div 
                                key={draft._id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="p-8 bg-black/40 border border-white/5 rounded-[2.5rem] space-y-6 group"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Incoming Comment</span>
                                    </div>
                                    <p className="text-xs font-bold text-white italic">"{draft.commentId.text}"</p>
                                </div>

                                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Agent Suggestion</span>
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3 h-3 text-indigo-400" />
                                            <span className="text-[9px] font-black text-white italic">{(draft.sentimentAtTime * 100).toFixed(0)}% Vibe Sync</span>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-slate-300 italic leading-relaxed">
                                        {draft.suggestedText}
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                                    <button className="p-4 rounded-2xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-slate-500 hover:text-red-400 transition-all">
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => approveResponse(draft._id)}
                                        className="flex-1 max-w-[200px] flex items-center justify-center gap-4 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] italic shadow-xl transition-all"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve Response
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {drafts.length === 0 && !loading && (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6 text-slate-700" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">No pending agent audits detected.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>

      </div>

      {/* Marquee (Background element) */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-indigo-600/10 backdrop-blur-3xl border-t border-indigo-500/20 flex items-center overflow-hidden z-[100]">
          <div className="flex gap-20 animate-marquee whitespace-nowrap px-10">
              {[1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-6">
                      <span className="text-[10px] font-black text-indigo-400 italic uppercase">Pulse Alpha: 94.2% Stability</span>
                      <span className="text-[10px] font-black text-white italic uppercase tracking-widest">Tactic: Zero-Click Metadata [Rising]</span>
                      <span className="text-[10px] font-black text-indigo-400 italic uppercase">Network Nodes: 162 Active</span>
                      <span className="text-[10px] font-black text-white italic uppercase tracking-widest">Chrono Shift: +14% Hook Retention</span>
                  </div>
              ))}
          </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default OmnipresenceNetworkView
