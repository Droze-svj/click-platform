'use client'

import React, { useState, useEffect } from 'react'
import {
  Globe,
  Radio,
  Share2,
  Calendar,
  Zap,
  Target,
  BarChart3,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  Link2,
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiGet } from '../../../lib/api'

interface DistributionHubViewProps {
  videoId: string
  videoUrl: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const DistributionHubView: React.FC<DistributionHubViewProps> = ({ videoId, videoUrl, showToast }) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'schedule' | 'platforms'>('matrix')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const handleBroadcast = async () => {
    setSwarmHUDTask('Commence Global Neural Broadcast')
    setShowSwarmHUD(true)
    setIsSyncing(true)
    setSyncProgress(0)

    // Simulate Pulse Distribution
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          showToast('Neural Broadcast Synchronized Across Cluster', 'success')
          setIsSyncing(false)
          return 100
        }
        return prev + 2
      })
    }, 50)
  }

  return (
    <div className="space-y-8 sm:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-2 sm:p-0">
      {/* Elite Control Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
        <div className="space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/5 border-2 border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 italic shadow-inner">
                <Globe className="w-4 h-4 animate-pulse" />
                GLOBAL_UPLINK_STATUS: ACTIVE
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tight uppercase leading-none drop-shadow-2xl">
                DISTRIBUTION_<br className="hidden sm:block" />HUB
            </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3 p-2 bg-black/40 border-2 border-white/5 rounded-[2rem] backdrop-blur-3xl shadow-2xl">
            {[
                { id: 'matrix', label: 'PUSH_MATRIX', icon: Target },
                { id: 'schedule', label: 'CHRONO_CORE', icon: Calendar },
                { id: 'platforms', label: 'NODE_CLUSTER', icon: Share2 }
            ].map(tab => (
                <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    title={tab.label}
                    className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all italic active:scale-95 ${
                        activeTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] border-none'
                        : 'text-slate-500 hover:text-white hover:bg-white/5 border-2 border-transparent'
                    }`}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Social Push Metadata Matrix */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000">
                    <Globe className="w-64 h-64 text-emerald-500" />
                </div>

                <div className="flex items-center justify-between mb-12 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            <Target className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter leading-none uppercase">SOCIAL_PUSH_MATRIX</h4>
                          <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.4em] mt-2 block italic">NEURAL_METADATA_INJECTION</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-14 relative z-10">
                    <div className="lg:col-span-7 space-y-10">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">VIRAL_MANIFEST_TITLE</label>
                            <input
                                type="text"
                                placeholder="THE_STRATEGY_THAT_CHANGED_EVERYTHING…"
                                title="Viral Title"
                                className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-8 py-5 text-sm font-black text-white outline-none focus:border-emerald-500/40 transition-all placeholder-slate-800 uppercase italic shadow-inner"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">NEURAL_DESCRIPTION_BLOCK</label>
                            <textarea
                                rows={6}
                                placeholder="CHECK_THE_LINK_IN_BIO_FOR_MORE_INSIGHT…"
                                title="Description"
                                className="w-full bg-black/40 border-2 border-white/5 rounded-[2.5rem] px-8 py-6 text-sm font-medium text-slate-300 outline-none focus:border-emerald-500/40 transition-all placeholder-slate-800 resize-none shadow-inner leading-relaxed"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-5 space-y-12">
                        <div className="space-y-5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 italic">OPTIMIZED_NEURAL_TAGS</label>
                            <div className="flex flex-wrap gap-3">
                                {['#VIRAL', '#GROWTH', '#AI', '#CREATIVE', '#EDIT'].map(t => (
                                    <span key={t} className="px-5 py-2.5 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 italic shadow-sm hover:scale-110 transition-transform cursor-default">
                                        {t}
                                    </span>
                                ))}
                                <button title="Add New Tag" className="px-5 py-2.5 bg-white/5 border-2 border-white/10 rounded-full text-[10px] font-black text-slate-500 hover:text-white hover:border-white/20 transition-all italic">+ ADD_TAG</button>
                            </div>
                        </div>

                        <div className="p-8 sm:p-10 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-[3rem] flex flex-col gap-8 shadow-2xl relative overflow-hidden group/card">
                            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest italic">FORECASTED_ENGAGEMENT</span>
                                    <p className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">84%_OPTIMAL</p>
                                </div>
                                <div className="p-5 bg-emerald-500 text-white rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] group-hover/card:scale-110 transition-transform duration-500">
                                    <BarChart3 className="w-7 h-7" />
                                </div>
                            </div>
                            <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border-2 border-white/5 relative z-10 shadow-inner">
                                <motion.div initial={{ width: 0 }} animate={{ width: '84%' }} className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                            </div>
                            <p className="text-[11px] text-slate-500 font-black italic leading-relaxed uppercase tracking-wider relative z-10">PEAK_POSTING_WINDOW: 2_HOURS_OFFSET. STRATEGIC_WAIT_SUGGESTED_FOR_15%_LIFT.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-14 pt-10 border-t-2 border-white/5 flex flex-col sm:flex-row items-center justify-between gap-10 relative z-10">
                    <div className="flex items-center gap-5 text-slate-500 text-center sm:text-left">
                        <AlertCircle className="w-6 h-6 text-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">3_PLATFORM_NODES_PENDING_METADATA_SYNC</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleBroadcast}
                        disabled={isSyncing}
                        title="Commence Broadcast"
                        className="w-full sm:w-auto px-16 py-6 bg-emerald-600 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] italic shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-5 relative overflow-hidden group/btn"
                    >
                        {isSyncing ? (
                            <motion.div className="absolute inset-0 bg-white/20 origin-left" initial={{ scaleX: 0 }} animate={{ scaleX: syncProgress / 100 }} />
                        ) : null}
                        <Radio className={`w-6 h-6 relative z-10 ${isSyncing ? 'animate-pulse' : 'group-hover:scale-125 transition-transform'}`} />
                        <span className="relative z-10">{isSyncing ? `BROADCASTING_${syncProgress}%` : 'COMMENCE_BROADCAST'}</span>
                    </button>
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.5rem] bg-primary-500/10 border-2 border-primary-500/20 shadow-xl">
                            <Calendar className="w-7 h-7 text-primary-400" />
                        </div>
                        <div className="text-center sm:text-left">
                            <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter leading-none uppercase">CHRONO_MATRIX</h4>
                            <span className="text-[10px] font-black text-primary-400/60 uppercase tracking-[0.4em] mt-2 block italic">TEMPORAL_DISPATCH_CLUSTER</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="px-8 py-4 bg-white/5 border-2 border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-white italic shadow-inner">
                            MARCH_2026
                        </div>
                        <button 
                            className="p-4 bg-primary-600 text-white rounded-2xl hover:scale-110 active:scale-90 transition-all shadow-lg shadow-primary-500/30"
                            aria-label="Add Event"
                            title="Add Event"
                        >
                            <Plus className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black uppercase text-slate-600 tracking-[0.4em] italic mb-4">{d}</div>
                    ))}
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className={`min-h-[160px] p-5 rounded-[2rem] border-2 transition-all duration-700 group cursor-pointer ${i === 3 ? 'bg-primary-500/10 border-primary-500/30 shadow-2xl' : 'bg-black/40 border-white/5 hover:border-white/10 shadow-sm'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <span className={`text-2xl font-black italic ${i === 3 ? 'text-primary-400' : 'text-slate-800 group-hover:text-slate-600'}`}>{i + 1}</span>
                                {i === 3 && <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(99,102,241,1)]" />}
                            </div>

                            {i === 3 && (
                                <div className="space-y-3">
                                    <div className="p-2.5 bg-rose-500/10 border-2 border-rose-500/20 rounded-xl group/item hover:bg-rose-500/20 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                            <span className="text-[8px] font-black text-white italic uppercase tracking-widest truncate">VIRAL_HOOK_01</span>
                                        </div>
                                    </div>
                                    <div className="p-2.5 bg-primary-500/10 border-2 border-primary-500/20 rounded-xl group/item hover:bg-primary-500/20 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                            <span className="text-[8px] font-black text-white italic uppercase tracking-widest truncate">AI_BREAKDOWN</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'platforms' && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
             {/* Platform Connection Status (Elite) */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 space-y-10 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.5rem] bg-primary-500/10 border-2 border-primary-500/20 shadow-xl">
                    <Share2 className="w-7 h-7 text-primary-400" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">IDENTITY_<br />CLUSTERS</h4>
                </div>

                <div className="space-y-4">
                    {[
                    { n: 'TIKTOK', s: 'CONNECTED_CORE', i: 'Radio', c: 'text-rose-500', bg: 'bg-rose-500/5', b: 'border-rose-500/20' },
                    { n: 'INSTAGRAM', s: 'VALIDATED_NODE', i: 'CheckCircle2', c: 'text-fuchsia-500', bg: 'bg-fuchsia-500/5', b: 'border-fuchsia-500/20' },
                    { n: 'YOUTUBE', s: 'SYNC_PENDING', i: 'AlertCircle', c: 'text-primary-500', bg: 'bg-primary-500/5', b: 'border-primary-500/20' },
                    { n: 'X_SYSTEM', s: 'OFFLINE_MODE', i: 'Link2', c: 'text-slate-500', bg: 'bg-slate-500/5', b: 'border-slate-500/20' }
                    ].map(node => (
                    <div key={node.n} className="p-6 bg-black/40 border-2 border-white/5 rounded-3xl flex items-center justify-between group hover:border-white/20 transition-all shadow-inner">
                        <div className="flex items-center gap-6">
                        <div className={`p-4 ${node.bg} border-2 ${node.b} rounded-2xl ${node.c} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                            {node.n === 'TIKTOK' ? <Radio className="w-6 h-6 animate-pulse" /> : node.n === 'YOUTUBE' ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="text-base font-black text-white italic tracking-tighter uppercase leading-none">{node.n}</p>
                            <p className={`text-[10px] font-black mt-2 uppercase tracking-[0.2em] ${node.c} italic`}>{node.s}</p>
                        </div>
                        </div>
                        <button className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border-2 border-white/5 rounded-xl text-[10px] font-black text-slate-500 hover:text-white transition-all uppercase italic">SYNC</button>
                    </div>
                    ))}
                </div>
            </div>

            {/* Neural Dispatch Stream */}
            <div className="backdrop-blur-3xl bg-black/40 border-2 border-white/5 rounded-[3rem] p-8 sm:p-12 space-y-10 relative overflow-hidden group shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 shadow-xl">
                        <Zap className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">LIVE_<br />UPLINK_FEED</h4>
                </div>

                <div className="space-y-5">
                    {[
                        { platform: 'TIKTOK_ALPHA', status: 'ROUTING_NODE_4', log: 'METADATA_INJECTION_COMPLETE' },
                        { platform: 'YOUTUBE_PRIMARY', status: 'HANDOFF_FAILURE', log: 'RE_AUTHENTICATING_TOKEN…', error: true },
                        { platform: 'DIGITAL_TWIN_ES', status: 'REGIONAL_SYNC', log: 'HYPER_NATIVE_DUB_SYNTHESIS_[ES-MX]' },
                        { platform: 'DIGITAL_TWIN_FR', status: 'SPATIAL_ROUTE', log: 'NEURAL_LIP_SYNC_BRIDGE_COMPLETE' }
                    ].map((stream, idx) => (
                        <div key={idx} className={`p-6 bg-black/40 border-2 border-white/5 rounded-[2.5rem] shadow-inner group/stream hover:bg-white/[0.02] transition-colors ${stream.error ? 'border-rose-500/20' : ''}`}>
                            <div className="flex justify-between items-center mb-5">
                                <span className={`text-[11px] font-black text-white italic uppercase tracking-[0.25em] group-hover/stream:text-primary-400 transition-colors ${stream.error ? 'text-rose-400' : ''}`}>{stream.platform}</span>
                                <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border-2 ${stream.error ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'} uppercase tracking-widest italic shadow-sm`}>
                                    {stream.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-black italic uppercase tracking-wider">
                                <Clock className="w-4 h-4 text-slate-700 group-hover/stream:text-white transition-colors" />
                                {stream.log}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 bg-primary-500/5 border-2 border-primary-500/10 rounded-[2.5rem] flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">UPLINK_STABILITY_INDEX</span>
                        <span className="text-[11px] font-black text-white italic uppercase tracking-widest">99.98%_UPTIME</span>
                    </div>
                    <div className="flex gap-1 relative z-10">
                        {Array.from({ length: 30 }).map((_, i) => (
                            <motion.div 
                                key={i} 
                                initial={{ scaleY: 0.5 }}
                                animate={{ scaleY: [0.5, 1, 0.5] }}
                                transition={{ duration: 1 + Math.random(), repeat: Infinity }}
                                className={`h-6 flex-1 rounded-full ${Math.random() > 0.05 ? 'bg-primary-500/40 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} 
                            />
                        ))}
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default DistributionHubView
