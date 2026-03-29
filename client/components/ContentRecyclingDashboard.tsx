'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  RefreshCw, TrendingUp, Clock, CheckCircle, XCircle, 
  Play, Pause, Plus, BarChart3, Shield, Zap, Target, 
  Cpu, Activity, Radio, ChevronRight, X, Fingerprint,
  Layers, Boxes, ArrowUpRight
} from 'lucide-react'
import AdvancedRecyclingAnalytics from './AdvancedRecyclingAnalytics'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

interface RecyclableContent {
  postId: string
  contentId: string
  platform: string
  title: string
  engagement: number
  impressions: number
  engagementRate: number
  postedAt: string
  isEvergreen?: boolean
  evergreenScore?: number
  recommendation?: string
}

interface RecyclingPlan {
  _id: string
  originalContentId: {
    _id: string
    title: string
  }
  platform: string
  status: string
  repostSchedule: {
    frequency: string
    interval: number
    maxReposts: number
    currentRepostCount: number
    nextRepostDate: string
    isActive: boolean
  }
  originalPerformance: {
    engagement: number
    engagementRate: number
  }
  repostPerformance?: {
    engagement: number
    engagementRate: number
  }
  isEvergreen: boolean
  evergreenScore: number
}

interface RecyclingStats {
  totalRecycled: number
  active: number
  completed: number
  totalReposts: number
  averagePerformanceChange: number
  evergreenContent: number
  byPlatform: Record<string, { count: number; reposts: number }>
  topPerformers: Array<{
    recycleId: string
    contentId: string
    platform: string
    engagement: number
  }>
}

export default function EntropyReversalNode() {
  const [suggestions, setSuggestions] = useState<RecyclableContent[]>([])
  const [plans, setPlans] = useState<RecyclingPlan[]>([])
  const [stats, setStats] = useState<RecyclingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'suggestions' | 'plans' | 'stats'>('suggestions')
  const [selectedContent, setSelectedContent] = useState<RecyclableContent | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      if (activeTab === 'suggestions') {
        const res = await axios.get(`${API_URL}/recycling/suggestions?limit=10`, { headers })
        if (res.data.success) setSuggestions(res.data.data.suggestions || [])
      } else if (activeTab === 'plans') {
        const res = await axios.get(`${API_URL}/recycling/plans`, { headers })
        if (res.data.success) setPlans(res.data.data.plans || [])
      } else if (activeTab === 'stats') {
        const res = await axios.get(`${API_URL}/recycling/stats`, { headers })
        if (res.data.success) setStats(res.data.data)
      }
    } catch (error) {
      console.error('Lattice Sync Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const createRecyclingPlan = async (postId: string, options: any = {}) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/recycling/create`, { postId, ...options }, { headers: { Authorization: `Bearer ${token}` } })
      loadData()
      setSelectedContent(null)
    } catch (error: any) {
      console.error('Multiplex Failed:', error)
    }
  }

  const toggleRecycling = async (recycleId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/recycling/plans/${recycleId}/toggle`, { isActive }, { headers: { Authorization: `Bearer ${token}` } })
      loadData()
    } catch (error: any) {
      console.error('Flux Control Error:', error)
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  }

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-10 bg-[#020205] rounded-[5rem] border-2 border-white/5 shadow-2xl backdrop-blur-3xl">
        <RefreshCw size={64} className="text-indigo-500 animate-spin" />
        <div className="space-y-4 text-center">
           <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Synchronizing Entropy Reversal Matrix...</p>
           <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] leading-none">LATTICE_RECONSTITUTION_IN_PROGRESS</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 font-inter pt-10">
      <div className={`${glassStyle} rounded-[6rem] p-24 overflow-hidden relative group border-indigo-500/20 shadow-[0_100px_250px_rgba(0,0,0,1)]`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.02] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 p-24 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-[3s]">
           <RefreshCw size={300} className="text-white animate-spin-slow" />
        </div>
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-20 relative z-10">
          <div className="flex items-center gap-10">
             <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-all duration-1000">
                <Shield className="text-indigo-400" size={48} />
             </div>
             <div>
                <div className="flex items-center gap-4 mb-4">
                  <Fingerprint className="text-indigo-400 animate-pulse" size={16} />
                  <span className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.6em] italic leading-none">Entropy Reversal Protocol v9.4.2</span>
                </div>
                <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Reversal Matrix</h2>
                <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-6 italic leading-none">Autonomous cascading flux for eternal sovereign content trajectories.</p>
             </div>
          </div>
          <div className="flex items-center gap-4 px-8 py-4 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
             <Radio size={14} className="text-indigo-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase italic leading-none">CLUSTER_FLUX_CALIBRATED</span>
          </div>
        </div>

        {/* HUD Tabs */}
        <div className="flex gap-6 p-4 bg-black/80 backdrop-blur-3xl rounded-[3rem] border-2 border-white/5 mb-20 relative z-10 shadow-inner max-w-4xl mx-auto">
          {(['suggestions', 'plans', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-6 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all duration-700 italic border-4 ${
                activeTab === tab ? 'bg-white text-black border-indigo-500 shadow-3xl scale-105' : 'text-slate-800 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'suggestions' ? 'Resonance Extraction' : tab === 'plans' ? 'Reversion Sequences' : 'Dissipation Ledger'}
            </button>
          ))}
        </div>

        {/* Resonance Extraction (Suggestions) */}
        {activeTab === 'suggestions' && (
          <div className="relative z-10 pt-10">
            <div className="flex items-center justify-between mb-12 border-b-2 border-white/5 pb-8">
               <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl flex items-center justify-center shadow-3xl"><Zap size={24} className="text-amber-400 animate-pulse" /></div>
                  <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">High-Resonance Particles Detected</h3>
               </div>
               <span className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">SECTOR_SCAN_COMPLETE</span>
            </div>
            {suggestions.length === 0 ? (
              <div className="text-center py-48 border-4 border-dashed border-white/5 rounded-[5rem] bg-white/[0.01]">
                <Radio className="w-24 h-24 mx-auto mb-10 text-slate-800 animate-pulse" />
                <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">No recyclable particles identified in the current cluster.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {suggestions.map((item) => (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    key={item.postId}
                    className={`${glassStyle} rounded-[4rem] p-12 hover:border-indigo-500/40 transition-all group relative overflow-hidden flex flex-col`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="flex flex-col h-full relative z-10">
                      <div className="flex items-center gap-5 mb-8">
                        <span className="px-6 py-2 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] rounded-full border-2 border-indigo-500/20 italic">NODE_{item.platform.toUpperCase()}</span>
                        {item.isEvergreen && (
                          <span className="px-6 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] rounded-full border-2 border-emerald-500/20 flex items-center gap-3 italic">
                            <CheckCircle className="w-4 h-4" /> ETERNAL_PULSE
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-6 group-hover:text-indigo-400 transition-colors duration-700 leading-tight line-clamp-2">{item.title}</h3>
                      
                      <div className="grid grid-cols-2 gap-8 mb-10">
                         <div className="p-8 rounded-[2.5rem] bg-black/60 border-2 border-white/5 shadow-inner group-hover:border-indigo-500/20 transition-all">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-3 italic leading-none">Saturation</p>
                            <p className="text-4xl font-black text-white italic tabular-nums leading-none tracking-tighter">{formatNumber(item.engagement)}</p>
                         </div>
                         <div className="p-8 rounded-[2.5rem] bg-black/60 border-2 border-white/5 shadow-inner group-hover:border-emerald-500/20 transition-all">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-3 italic leading-none">Resonance</p>
                            <p className="text-4xl font-black text-emerald-400 italic tabular-nums leading-none tracking-tighter">{item.engagementRate.toFixed(2)}%</p>
                         </div>
                      </div>

                      {item.recommendation && (
                        <div className="mb-12 p-6 rounded-3xl bg-indigo-500/[0.03] border-2 border-indigo-500/10 flex-1">
                          <p className="text-[12px] text-slate-700 font-black uppercase tracking-tight italic leading-relaxed">
                            <span className="text-indigo-400 mr-2">PROTOCOL_ADVISORY:</span> {item.recommendation.toUpperCase()}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => setSelectedContent(item)}
                        title="Init Trajectory"
                        className="w-full py-8 bg-white text-black rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center justify-center gap-6 shadow-3xl italic active:scale-95 group/btn"
                      >
                        <Plus className="w-6 h-6 group-btn:rotate-90 transition-transform duration-700" /> INITIATE_REVERSION
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reversion Sequences (Plans) */}
        {activeTab === 'plans' && (
          <div className="relative z-10 pt-10">
            {plans.length === 0 ? (
              <div className="text-center py-64 border-4 border-dashed border-white/5 rounded-[5rem] bg-white/[0.01]">
                <Clock className="w-24 h-24 mx-auto mb-10 text-slate-800 animate-pulse" />
                <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">No active cascades detected. Deploy a resonance particle to begin.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {plans.map((plan) => (
                  <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
                    key={plan._id}
                    className={`${glassStyle} rounded-[5rem] p-16 flex flex-col lg:flex-row items-center gap-16 hover:border-indigo-500/30 group relative overflow-hidden transition-all duration-1000`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="flex-1 min-w-0 relative z-10">
                      <div className="flex flex-wrap items-center gap-6 mb-8">
                        <span className="px-6 py-2 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] rounded-full border-2 border-indigo-500/20 italic">NODE_{plan.platform.toUpperCase()}</span>
                        {plan.isEvergreen && (
                          <span className="px-6 py-2 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em] rounded-full border-2 border-emerald-500/20 italic">ETERNAL_PULSE ({plan.evergreenScore}%)</span>
                        )}
                        <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.4em] border-2 transition-all italic flex items-center gap-3 ${plan.repostSchedule.isActive ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-slate-900 text-slate-900 border-slate-900'}`}>
                           <div className={`w-3 h-3 rounded-full ${plan.repostSchedule.isActive ? 'bg-amber-400 animate-ping' : 'bg-slate-800'}`} />
                           {plan.repostSchedule.isActive ? 'CASCADING' : 'DORMANT'}
                        </div>
                      </div>
                      <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-12 truncate leading-none group-hover:text-indigo-400 transition-colors duration-700">{plan.originalContentId?.title || 'SPECTRAL NODE UNNAMED'}</h3>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">Cycle Count</p>
                          <p className="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter">
                            {plan.repostSchedule.currentRepostCount} <span className="text-slate-800 text-sm ml-2">/ {plan.repostSchedule.maxReposts}</span>
                          </p>
                        </div>
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">Flux Frequency</p>
                          <p className="text-3xl font-black text-indigo-400 italic uppercase leading-none tracking-tighter">{plan.repostSchedule.frequency}</p>
                        </div>
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">Next Pulse</p>
                          <p className="text-3xl font-black text-white italic tabular-nums leading-none tracking-tighter uppercase">
                            {plan.repostSchedule.nextRepostDate ? formatDate(plan.repostSchedule.nextRepostDate) : 'INDEFINITE'}
                          </p>
                        </div>
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">Signal Gain</p>
                          <p className="text-4xl font-black text-emerald-400 italic tabular-nums leading-none tracking-tighter">
                            {plan.repostPerformance ? formatNumber(plan.repostPerformance.engagement) : formatNumber(plan.originalPerformance.engagement)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleRecycling(plan._id, !plan.repostSchedule.isActive)}
                      title={plan.repostSchedule.isActive ? "Pause Cascade" : "Resume Cascade"}
                      className={`w-32 h-32 rounded-[3rem] flex items-center justify-center transition-all duration-1000 shadow-3xl border-4 relative overflow-hidden group/ctl active:scale-90 ${
                        plan.repostSchedule.isActive
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-white'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/ctl:opacity-100 transition-opacity duration-1000" />
                      {plan.repostSchedule.isActive ? <Pause size={48} className="relative z-10" /> : <Play size={48} className="relative z-10 translate-x-1" />}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dissipation Ledger (Stats) */}
        {activeTab === 'stats' && (
          <div className="relative z-10 pt-10">
            {stats ? (
              <div className="space-y-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                  {[
                    { label: 'Particles Multiplexed', val: stats.totalRecycled, icon: Cpu, color: 'text-indigo-400' },
                    { label: 'Active Cascades', val: stats.active, icon: Activity, color: 'text-emerald-400' },
                    { label: 'Cumulative Flux', val: stats.totalReposts, icon: Zap, color: 'text-amber-400' },
                    { label: 'Signal Velocity', val: `${(stats.averagePerformanceChange || 0) > 0 ? '+' : ''}${stats.averagePerformanceChange.toFixed(1)}%`, icon: TrendingUp, color: 'text-purple-400' }
                  ].map(s => (
                    <div key={s.label} className={`${glassStyle} rounded-[4rem] p-12 flex flex-col items-center text-center group hover:scale-110 transition-transform duration-1000`}>
                       <div className="w-16 h-16 rounded-[2rem] bg-white/5 border-2 border-white/5 flex items-center justify-center mb-8 group-hover:rotate-12 transition-transform duration-700">
                          <s.icon size={28} className={s.color} />
                       </div>
                       <p className="text-5xl font-black text-white italic tabular-nums mb-4 tracking-tighter leading-none">{s.val}</p>
                       <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none">{s.label}</p>
                    </div>
                  ))}
                </div>

                {stats.topPerformers && stats.topPerformers.length > 0 && (
                  <div className={`${glassStyle} rounded-[5rem] p-16 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none" />
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-12 flex items-center gap-6">
                       <Target size={32} className="text-indigo-400 animate-pulse" /> High-Intensity Reposts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                      {stats.topPerformers.map((performer, idx) => (
                        <div key={idx} className="flex items-center justify-between p-8 bg-black/60 rounded-[2.5rem] border-2 border-white/5 group hover:border-indigo-500/40 transition-all duration-700 shadow-inner">
                          <div className="flex items-center gap-6">
                            <span className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center font-black text-xl tabular-nums italic border-2 border-indigo-500/30">
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="text-[12px] font-black text-white uppercase italic truncate w-40 leading-none">NODE_{performer.platform.toUpperCase()}</p>
                              <p className="text-[14px] font-black text-emerald-400 italic tabular-nums mt-3 leading-none">{formatNumber(performer.engagement)} SIGNAL</p>
                            </div>
                          </div>
                          <TrendingUp className="w-6 h-6 text-emerald-500/20 group-hover:text-emerald-500 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all duration-700" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-48 border-4 border-dashed border-white/5 rounded-[5rem] bg-white/[0.01]">
                <BarChart3 className="w-24 h-24 mx-auto mb-10 text-slate-800" />
                <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">No spectral analytics mapped to current cluster.</p>
              </div>
            )}

            <div className="mt-20">
               <div className="flex items-center gap-6 mb-12 border-l-8 border-indigo-500 pl-8">
                  <Activity size={32} className="text-indigo-400 animate-pulse" />
                  <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Deep Spectral Analytics</h3>
               </div>
               <div className={`${glassStyle} rounded-[5rem] overflow-hidden`}>
                 <AdvancedRecyclingAnalytics period={30} />
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Reversal Configuration Overlay */}
      <AnimatePresence>
        {selectedContent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-black/90 backdrop-blur-2xl" onClick={() => setSelectedContent(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.8, rotate: 2 }}
              className={`${glassStyle} rounded-[6rem] p-24 max-w-3xl w-full border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_500px_rgba(79,70,229,0.3)]`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-16 px-4">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-indigo-500/10 border-2 border-indigo-500/30 rounded-[2rem] flex items-center justify-center rotate-12"><RefreshCw size={32} className="text-indigo-400" /></div>
                   <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Reversal Calibrations</h3>
                </div>
                <button 
                  onClick={() => setSelectedContent(null)} 
                  title="Abort Calibration"
                  className="w-16 h-16 bg-white/5 border-2 border-white/10 rounded-[2rem] text-slate-800 hover:text-white hover:border-rose-500/50 transition-all duration-700 hover:rotate-90 active:scale-90 flex items-center justify-center"
                >
                  <X size={32} />
                </button>
              </div>

              <div className="mb-16 p-12 bg-indigo-500/5 border-4 border-indigo-500/20 rounded-[4rem] shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><Target size={120} className="text-indigo-400" /></div>
                <p className="text-4xl font-black text-white italic uppercase tracking-tighter mb-6 leading-tight group-hover:text-indigo-400 transition-colors duration-700">
                  {selectedContent.title}
                </p>
                <div className="flex flex-wrap gap-6 pt-6 border-t-2 border-white/5">
                  <span className="px-6 py-2 bg-black/60 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] italic border-2 border-indigo-500/20 shadow-3xl">NODE_{selectedContent.platform.toUpperCase()}</span>
                  <span className="px-6 py-2 bg-black/60 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] italic border-2 border-emerald-500/20 shadow-3xl">{formatNumber(selectedContent.engagement)} PARTICLES</span>
                  <span className="px-6 py-2 bg-black/60 rounded-full text-[10px] font-black text-purple-400 uppercase tracking-[0.4em] italic border-2 border-purple-500/20 shadow-3xl">{selectedContent.engagementRate.toFixed(2)}% RESONANCE</span>
                </div>
              </div>

              <MultiplexOptions 
                content={selectedContent} 
                onCancel={() => setSelectedContent(null)} 
                onCreate={createRecyclingPlan} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MultiplexOptions({ content, onCancel, onCreate }: any) {
  const [frequency, setFrequency] = useState('monthly')
  const [interval, setInterval] = useState(30)
  const [maxReposts, setMaxReposts] = useState(5)
  const [updateHashtags, setUpdateHashtags] = useState(true)
  const [updateTiming, setUpdateTiming] = useState(true)
  const [updateCaption, setUpdateCaption] = useState(false)
  const [autoSchedule, setAutoSchedule] = useState(true)

  const handleCreate = () => {
    onCreate(content.postId, {
      repostSchedule: { frequency, interval, maxReposts },
      refreshOptions: { updateHashtags, updateTiming, updateCaption, addNewElements: false },
      autoSchedule
    })
  }

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <label htmlFor="frequency-id" className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none border-l-4 border-indigo-500 pl-4 py-1">Flux Frequency</label>
          <select 
            id="frequency-id"
            title="Frequency Mode"
            value={frequency} 
            onChange={(e) => {
              setFrequency(e.target.value)
              const intervals: any = { daily: 1, weekly: 7, monthly: 30, quarterly: 90 }
              if (intervals[e.target.value]) setInterval(intervals[e.target.value])
            }}
            className="w-full bg-black/80 border-2 border-white/5 rounded-[2rem] px-8 py-6 text-[14px] font-black text-white uppercase tracking-[0.2em] focus:outline-none focus:border-indigo-500/40 transition-all italic shadow-inner"
          >
            <option value="daily">Every 24h (Aggressive)</option>
            <option value="weekly">Every 168h (Cyclic)</option>
            <option value="monthly">Every 720h (Pulse)</option>
            <option value="quarterly">Every 2160h (Eternal)</option>
            <option value="custom">Manual Interval</option>
          </select>
        </div>

        <div className="space-y-6">
          <label htmlFor="max-reposts-id" className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none border-l-4 border-indigo-500 pl-4 py-1">Max Reversion Cascades</label>
          <input 
            id="max-reposts-id"
            title="Max Cascades"
            type="number" 
            value={maxReposts} 
            onChange={(e) => setMaxReposts(parseInt(e.target.value) || 5)}
            className="w-full bg-black/80 border-2 border-white/5 rounded-[2rem] px-8 py-6 text-[14px] font-black text-white uppercase tracking-[0.2em] focus:outline-none focus:border-indigo-500/40 transition-all italic shadow-inner"
          />
        </div>
      </div>

      <div className="space-y-8">
        <label className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none border-l-4 border-indigo-500 pl-4 py-1">Flux Modulation Parameters</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { state: updateHashtags, set: setUpdateHashtags, label: 'Lattice Tag Refresh' },
            { state: updateTiming, set: setUpdateTiming, label: 'Neural Time Windows' },
            { state: updateCaption, set: setUpdateCaption, label: 'Payload Regeneration' },
            { state: autoSchedule, set: setAutoSchedule, label: 'Instant Injection' },
          ].map(opt => (
            <button key={opt.label} onClick={() => opt.set(!opt.state)}
              title={opt.label}
              className={`flex items-center justify-between p-8 rounded-[2.5rem] border-2 transition-all duration-700 italic group/opt shadow-3xl ${opt.state ? 'bg-indigo-600 border-indigo-400 text-white translate-y-[-4px]' : 'bg-black/60 border-white/5 text-slate-800 hover:border-indigo-500/30'}`}
            >
              <span className="text-[12px] font-black uppercase tracking-[0.4em]">{opt.label}</span>
              <div className={`w-6 h-6 rounded-full border-4 transition-all duration-700 ${opt.state ? 'bg-white border-white shadow-[0_0_20px_rgba(255,255,255,1)] scale-110' : 'border-slate-900 group-hover/opt:border-indigo-500/30'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8 pt-12">
        <button 
          onClick={onCancel} 
          title="Abort Process"
          className="flex-1 py-8 bg-black/80 border-4 border-white/5 text-slate-800 hover:text-white rounded-[3rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic hover:border-rose-500/50 shadow-3xl"
        >
          ABORT_PROCESS
        </button>
        <button 
          onClick={handleCreate} 
          title="Initiate Reversal"
          className="flex-2 py-8 bg-white text-black rounded-[3rem] text-[16px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 shadow-[0_40px_150px_rgba(79,70,229,0.3)] italic active:scale-95 group/seal"
        >
          <span className="relative z-10">INITIATE_REVERSAL</span>
          <div className="absolute inset-0 bg-indigo-500 scale-x-0 group-hover/seal:scale-x-100 origin-left transition-transform duration-1000" />
        </button>
      </div>
    </div>
  )
}
