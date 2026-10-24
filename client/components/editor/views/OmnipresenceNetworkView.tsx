'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  BrainCircuit,
  Share2,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquare as AiIcon,
  Radio,
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
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
  const niche = currentNiche as ContentNiche
  const [pulse, setPulse] = useState<OmnipresencePulse | null>(null)
  const [drafts, setDrafts] = useState<AgentDraft[]>([])
  const [pipeline, setPipeline] = useState<NeuralPipeline | null>(null)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pulseFailed, setPulseFailed] = useState(false)
  const [draftsFailed, setDraftsFailed] = useState(false)

  const fetchPulse = useCallback(async () => {
    try {
      const data = await apiGet(`/phase9/swarm/pulse?niche=${niche}`, undefined, false)
      setPulse(data)
      setPulseFailed(false)
    } catch (err) {
      console.error('Pulse fetch failed', err)
      setPulseFailed(true)
    }
  }, [niche])

  const fetchDrafts = useCallback(async () => {
    try {
      const res: any = await apiGet('/phase9/autonomic-cm/drafts', undefined, false)
      setDrafts(Array.isArray(res?.drafts) ? res.drafts : [])
      setDraftsFailed(false)
    } catch (err) {
      console.error('Drafts fetch failed', err)
      setDraftsFailed(true)
    }
  }, [])

  // The pulse endpoint returns { snapshot: { trendingSignals } }; older
  // shapes put trendingSignals at the top level.
  const signals: any[] = Array.isArray(pulse?.trendingSignals)
    ? pulse.trendingSignals
    : Array.isArray(pulse?.snapshot?.trendingSignals) ? pulse.snapshot.trendingSignals : []

  const fetchData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchPulse(), fetchDrafts()])
    setLoading(false)
  }, [fetchPulse, fetchDrafts])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchPulse, 30000) // Pulse updates every 30s
    return () => clearInterval(interval)
  }, [fetchData, fetchPulse])

  const handleBroadcast = async () => {
    if (!videoId) return

    setIsBroadcasting(true)
    try {
      const { pipeline } = await apiPost('/phase9/broadcaster/build-pipeline', {
        videoId,
        platforms: ['tiktok', 'instagram', 'youtube', 'twitter'],
        aeoMetadata: { niche }
      })
      setPipeline(pipeline)
      showToast('Publishing plan created.', 'success')
    } catch (err) {
      showToast('Couldn\'t create the publishing plan. Please try again.', 'error')
    } finally {
      setIsBroadcasting(false)
    }
  }

  // Saves the tactic to the user's knowledge ledger, scored with the
  // signal's own measured velocity (never an invented confidence).
  const saveTactic = async (signal: any) => {
    try {
      const score = Number(signal?.viralScore)
      await apiPost('/phase10_12/intelligence/pulse', {
        tactic: signal.tactic,
        ...(Number.isFinite(score) ? { confidence: Math.max(0, Math.min(1, score)) } : {}),
      })
      showToast('Tactic saved.', 'success')
      fetchPulse()
    } catch (err) {
      showToast('Couldn\'t save that tactic. Please try again.', 'error')
    }
  }

  const approveResponse = async (responseId: string) => {
    try {
      await apiPost('/phase9/autonomic-cm/approve', { responseId })
      setDrafts(prev => prev.filter(d => d._id !== responseId))
      showToast('Reply approved.', 'success')
    } catch (err) {
      showToast('Couldn\'t approve that reply. Please try again.', 'error')
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-2 md:p-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">
          Trends &amp; replies
        </h2>
        <p className="text-[12px] font-bold text-slate-500">What&apos;s trending right now, and AI-drafted replies to your comments waiting for your approval.</p>
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
                        <h4 className="text-xl font-black text-[var(--text-main)] italic tracking-tighter uppercase leading-none">Trending now</h4>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 block">From the latest trend snapshot</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {signals.map((signal: any, idx: number) => (
                        <div key={idx} className="p-5 bg-black/40 border border-white/5 rounded-2xl space-y-3 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-white italic uppercase tracking-widest">{signal.tactic}</span>
                                <button
                                    type="button"
                                    onClick={() => saveTactic(signal)}
                                    className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                                    title="Save this tactic"
                                    aria-label={`Save tactic ${signal.tactic}`}
                                >
                                    <Zap className="w-3 h-3" aria-hidden="true" />
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
                                        style={{ width: `${Math.max(0, Math.min(100, (Number(signal.viralScore) || 0) * 100))}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black text-indigo-400">{((Number(signal.viralScore) || 0) * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    ))}
                    {loading && !pulse && [1,2,3].map(i => <div key={i} className="h-24 bg-white/5 animate-pulse rounded-2xl" />)}
                    {!loading && signals.length === 0 && (
                        <p className="text-[11px] font-bold text-slate-500 py-6 text-center">
                            {pulseFailed ? 'Couldn\'t load trends. Try again later.' : 'No trend data yet.'}
                        </p>
                    )}
                </div>
            </div>
        </div>

        {/* Center/Right Column: Agent & Broadcaster */}
        <div className="xl:col-span-2 space-y-8">
            
            {/* Publishing plan — needs a video, so only shown when one is open */}
            {videoId && (
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
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Publishing plan</h4>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 block">Plan when this video goes out on TikTok, Instagram, YouTube and X</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleBroadcast}
                        disabled={isBroadcasting}
                        className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] italic shadow-2xl transition-all disabled:opacity-50"
                    >
                        {isBroadcasting ? 'Creating plan…' : 'Create publishing plan'}
                    </button>
                </div>

                {pipeline ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                        {pipeline.deployments.map((dep: any, idx: number) => (
                            <div key={idx} className="p-6 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                               <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-white uppercase italic">{dep.platform}</span>
                               </div>
                               <div className="space-y-1">
                                  <span className="text-[8px] font-black text-slate-500 uppercase">Status</span>
                                  <p className="text-[10px] font-black text-indigo-400 uppercase italic leading-none">{dep.status}</p>
                               </div>
                               <div className="flex items-center gap-2">
                                  <Clock className="w-3 h-3 text-slate-700" />
                                  <span className="text-[8px] font-bold text-slate-500">{dep.scheduledTime ? new Date(dep.scheduledTime).toLocaleString() : '—'}</span>
                               </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4">
                        <Share2 className="w-12 h-12 text-slate-800" />
                        <p className="text-xs font-medium text-slate-500 italic">No publishing plan for this video yet.</p>
                    </div>
                    )}
            </div>
            )}

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
                        <h4 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter leading-none uppercase">Replies to approve</h4>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 block">AI-drafted replies to your comments</span>
                        </div>
                    </div>
                    <div className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {drafts.length} waiting
                    </div>
                </div>

                <div className="space-y-6">
                    <AnimatePresence mode="popLayout">
                        {drafts.map((draft) => (
                            <m.div 
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
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Comment</span>
                                    </div>
                                    <p className="text-xs font-bold text-white italic">&quot;{draft.commentId?.text || '—'}&quot;</p>
                                </div>

                                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Suggested reply</span>
                                        {Number.isFinite(Number(draft.sentimentAtTime)) && (
                                          <div className="flex items-center gap-2">
                                              <Sparkles className="w-3 h-3 text-indigo-400" aria-hidden="true" />
                                              <span className="text-[9px] font-black text-white italic">Comment mood {(Number(draft.sentimentAtTime) * 100).toFixed(0)}%</span>
                                          </div>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-slate-300 italic leading-relaxed">
                                        {draft.suggestedText}
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => approveResponse(draft._id)}
                                        className="flex-1 max-w-[200px] flex items-center justify-center gap-4 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] italic shadow-xl transition-all"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve reply
                                    </button>
                                </div>
                            </m.div>
                        ))}
                    </AnimatePresence>
                    {drafts.length === 0 && !loading && (
                        <div className="text-center py-10 space-y-4">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-6 h-6 text-slate-700" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{draftsFailed ? 'Couldn\'t load replies. Try again later.' : 'No replies waiting for approval.'}</p>
                        </div>
                    )}
                </div>
            </div>

        </div>

      </div>

    </div>
  )
}

export default OmnipresenceNetworkView
