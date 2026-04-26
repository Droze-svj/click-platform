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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Elite Control Header */}
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-2">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 italic">
                <Globe className="w-3.5 h-3.5 animate-pulse" />
                Global Uplink Active
            </div>
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                DISTRIBUTION<br />HUB
            </h2>
        </div>

        <div className="flex gap-2 p-1.5 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-3xl">
            {[
                { id: 'matrix', label: 'Push Matrix', icon: Target },
                { id: 'schedule', label: 'Chrono', icon: Calendar },
                { id: 'platforms', label: 'Nodes', icon: Share2 }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    title={tab.label}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20'
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
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
            className="space-y-6"
          >
            {/* Social Push Metadata Matrix */}
            <div className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden group border-emerald-500/10`}>
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Globe className="w-40 h-40 text-emerald-500" />
                </div>

                <div className="flex items-center justify-between mb-10 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-xl">
                            <Target className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Social Push Matrix</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-emerald-500/70">Neural Metadata Injection</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Viral Title / Caption</label>
                            <input
                                type="text"
                                placeholder="The strategy that changed everything..."
                                title="Viral Title"
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 transition-all placeholder-slate-800"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Description & Dynamic Tags</label>
                            <textarea
                                rows={6}
                                placeholder="Check the link in bio for more insight..."
                                title="Description"
                                className="w-full bg-black/40 border border-white/5 rounded-[2rem] px-6 py-4 text-xs font-medium text-slate-300 outline-none focus:border-emerald-500/50 transition-all placeholder-slate-800 resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-10">
                        <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 italic">Neural Tags (Optimized)</label>
                            <div className="flex flex-wrap gap-2">
                                {['#viral', '#growth', '#ai', '#creative', '#edit'].map(t => (
                                    <span key={t} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 italic">
                                        {t}
                                    </span>
                                ))}
                                <button title="Add New Tag" className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-slate-500 hover:text-white transition-all">+ Add Tag</button>
                            </div>
                        </div>

                        <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Forecasted Engagement</span>
                                    <p className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">84% Optimal</p>
                                </div>
                                <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/30">
                                    <BarChart3 className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 w-[84%] rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed">Peak posting window in 2 hours for current timezone clusters. Strategic wait suggested for 15% growth lift.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between gap-10">
                    <div className="flex items-center gap-4 text-slate-600">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">3 platform nodes pending metadata sync</span>
                    </div>
                    <button
                        onClick={handleBroadcast}
                        disabled={isSyncing}
                        title="Commence Broadcast"
                        className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 relative overflow-hidden group"
                    >
                        {isSyncing ? (
                            <div className="absolute inset-0 bg-white/10" style={{ width: `${syncProgress}%` }} />
                        ) : null}
                        <Radio className={`w-5 h-5 ${isSyncing ? 'animate-pulse' : ''}`} />
                        <span className="relative z-10">{isSyncing ? `Broadcasting ${syncProgress}%` : 'Commence Broadcast'}</span>
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
            <div className={`${glassStyle} rounded-[3rem] p-10`}>
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                            <Calendar className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Neural Matrix</h4>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic">Chrono Management Cluster</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white italic">
                            March 2026
                        </div>
                        <button className="p-3 bg-indigo-500 text-white rounded-xl hover:scale-110 transition-all">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-[9px] font-black uppercase text-slate-600 tracking-[0.3em] italic mb-4">{d}</div>
                    ))}
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className={`min-h-[140px] p-4 rounded-3xl border ${i === 3 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/20 border-white/5'} hover:border-white/10 transition-all group`}>
                            <div className="flex justify-between items-center mb-4">
                                <span className={`text-lg font-black italic ${i === 3 ? 'text-indigo-400' : 'text-slate-700'}`}>{i + 1}</span>
                                {i === 3 && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,1)]" />}
                            </div>

                            {i === 3 && (
                                <div className="space-y-2">
                                    <div className="p-2 bg-pink-500/20 border border-pink-500/30 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 bg-pink-500 rounded-full" />
                                            <span className="text-[8px] font-black text-white italic uppercase tracking-widest truncate">Viral Hook</span>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 bg-blue-500 rounded-full" />
                                            <span className="text-[8px] font-black text-white italic uppercase tracking-widest truncate">AI Breakdown</span>
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
            <div className={`${glassStyle} p-10 rounded-[3rem] space-y-8`}>
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20">
                    <Share2 className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">IDENTITY<br />CLUSTERS</h4>
                </div>

                <div className="space-y-4">
                    {[
                    { n: 'TikTok', s: 'Connected', i: 'Radio', c: 'text-pink-500', bg: 'bg-pink-500/10' },
                    { n: 'Instagram', s: 'Connected', i: 'CheckCircle2', c: 'text-purple-500', bg: 'bg-purple-500/10' },
                    { n: 'YouTube', s: 'Sync Required', i: 'AlertCircle', c: 'text-red-500', bg: 'bg-red-500/10' },
                    { n: 'Twitter / X', s: 'Offline', i: 'Link2', c: 'text-slate-500', bg: 'bg-slate-500/10' }
                    ].map(node => (
                    <div key={node.n} className="p-5 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                        <div className="flex items-center gap-6">
                        <div className={`p-4 ${node.bg} rounded-xl ${node.c}`}>
                            {node.n === 'TikTok' ? <Radio className="w-5 h-5 animate-pulse" /> : node.n === 'YouTube' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-white italic tracking-tighter uppercase leading-none">{node.n}</p>
                            <p className={`text-[9px] font-black mt-1 uppercase tracking-widest ${node.c}`}>{node.s}</p>
                        </div>
                        </div>
                        <button className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold text-slate-500 hover:text-white transition-all">Configure</button>
                    </div>
                    ))}
                </div>
            </div>

            {/* Neural Dispatch Stream */}
            <div className={`${glassStyle} p-10 rounded-[3rem] space-y-8 relative overflow-hidden group`}>
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-emerald-500/10 border border-emerald-500/20">
                        <Zap className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">LIVE<br />UPLINK</h4>
                </div>

                <div className="space-y-6">
                    {[
                        { platform: 'TikTok Alpha', status: 'Routing Node 4', log: 'Metadata Injection Complete' },
                        { platform: 'YouTube Primary', status: 'Handoff Failure', log: 'Re-authenticating Token...', error: true },
                        { platform: 'Digital Twin - ES', status: 'Regional Sync', log: 'Hyper-Native Dub Synthesis [ES-MX]' },
                        { platform: 'Digital Twin - FR', status: 'Spatial Route', log: 'Neural Lip-Sync Bridge Complete' }
                    ].map((stream, idx) => (
                        <div key={idx} className="p-6 bg-black/40 border border-white/5 rounded-[2rem]">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-black text-white italic uppercase tracking-[0.2em]">{stream.platform}</span>
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full ${stream.error ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'} uppercase tracking-widest`}>
                                    {stream.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium italic">
                                <Clock className="w-3 h-3 text-slate-700" />
                                {stream.log}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[2rem] flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Link Stability</span>
                        <span className="text-xs font-black text-white italic">99.9% Uptime</span>
                    </div>
                    <div className="flex gap-1">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} className={`h-4 flex-1 rounded-sm ${Math.random() > 0.05 ? 'bg-indigo-500/50' : 'bg-red-500/50 animate-pulse'}`} />
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
