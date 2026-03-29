'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Activity, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Flame, MessageSquare, Eye, Heart,
  ArrowUpRight, ArrowDownRight, Brain, Sparkles,
  RefreshCw, Share2, Users, Shield, Terminal, Fingerprint,
  Target, ActivitySquare, Monitor, Network, X, Lock
} from 'lucide-react'
import { apiGet } from '../lib/api'
import ToastContainer from '../components/ToastContainer'
import { ErrorBoundary } from '../components/ErrorBoundary'

const glass = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

// ── Types ──────────────────────────────────────────────────────────────────────
interface PostHealth {
  postId: string
  platform: string
  views: number
  likes: number
  comments: number
  velocity: number // engagements/hour
  healthScore: number // 0-100
  anomalyType: string
  anomalyAdvice: { action: string; reasoning: string; urgency: string } | null
}

interface CommandCenterData {
  overallScore: number
  totalViews: number
  avgEngagementRate: number
  peakVelocityPost: PostHealth | null
  alerts: PostHealth[]
  posts: PostHealth[]
  nextBestAction: string
  workflowEfficiencyScore: number
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

function getScoreBg(score: number) {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20'
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-rose-500/10 border-rose-500/20'
}

function getAnomalyIcon(type: string) {
  switch (type) {
    case 'virality_spike': return <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
    case 'shadow_banned':  return <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
    case 'drop_off':       return <TrendingDown className="w-5 h-5 text-amber-400" />
    default:               return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
  }
}

// ── Mock data for local dev ────────────────────────────────────────────────────
function getMockData(): CommandCenterData {
  return {
    overallScore: 74,
    totalViews: 128_500,
    avgEngagementRate: 5.3,
    workflowEfficiencyScore: 66,
    nextBestAction: 'Uplink response sequence to top 10 comment nodes on TikTok to re-trigger algorithmic drift.',
    peakVelocityPost: {
      postId: 'mock-1', platform: 'tiktok', views: 47200, likes: 3100, comments: 380,
      velocity: 312, healthScore: 94, anomalyType: 'virality_spike',
      anomalyAdvice: { action: 'Commit response payloads to top 20 nodes immediately.', reasoning: 'Keeps resonance loop active.', urgency: 'ACT_WITHIN_120_MINS' }
    },
    alerts: [
      {
        postId: 'mock-2', platform: 'instagram', views: 840, likes: 72, comments: 1,
        velocity: 3, healthScore: 38, anomalyType: 'low_comment_ratio',
        anomalyAdvice: { action: 'Anchor a consensus-prompt reply to primary node.', reasoning: 'Directly prompts neural discussion.', urgency: 'LOW_PRIORITY' }
      }
    ],
    posts: [
      { postId: 'mock-1', platform: 'tiktok',    views: 47200, likes: 3100, comments: 380, velocity: 312, healthScore: 94, anomalyType: 'virality_spike', anomalyAdvice: null },
      { postId: 'mock-3', platform: 'instagram', views: 12400, likes: 890,  comments: 62,  velocity: 18,  healthScore: 78, anomalyType: 'none',           anomalyAdvice: null },
      { postId: 'mock-4', platform: 'youtube',   views: 6800,  likes: 420,  comments: 55,  velocity: 8,   healthScore: 73, anomalyType: 'none',           anomalyAdvice: null },
      { postId: 'mock-2', platform: 'instagram', views: 840,   likes: 72,   comments: 1,   velocity: 3,   healthScore: 38, anomalyType: 'low_comment_ratio', anomalyAdvice: null },
    ],
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ResonanceCommandMatrix() {
  const [data, setData] = useState<CommandCenterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<PostHealth | null>(null)

  const fetchResonanceData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet('/analytics/engagement/command-center')
      setData(res?.data || res)
    } catch {
      setData(getMockData())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchResonanceData() }, [fetchResonanceData])

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Brain size={64} className="text-indigo-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Decoding Resonance Matrix...</span>
     </div>
  );

  if (!data) return null

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Terminal size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Brain size={44} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Resonance Matrix v9.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                       <span className="text-[9px] font-black text-slate-800 tracking-widest uppercase italic leading-none">ANOMALY_MONITOR_SYNCED</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Resonance Hub</h1>
                 <p className="text-slate-800 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Real-time engagement anomaly detection and heuristic advisor protocol.</p>
              </div>
           </div>
           <button onClick={fetchResonanceData} 
             className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] hover:bg-indigo-500 hover:text-white transition-all shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6 group"
           >
              <RefreshCw size={28} className="group-hover:rotate-180 transition-transform duration-1000" />
              SYNC_RESONANCE_DATA
           </button>
        </header>

        {/* Trajectory Kinetic HUD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 relative z-10">
          {[
            { label: 'Resonance Integrity', value: data.overallScore, unit: '%', icon: Brain, color: getScoreColor(data.overallScore), trend: 'NODE_HEALTH' },
            { label: 'Saturation (24h)', value: (data.totalViews / 1000).toFixed(1), unit: 'K', icon: Eye, color: 'text-white', trend: 'CUMULATIVE_REACH' },
            { label: 'Avg Affinity', value: data.avgEngagementRate.toFixed(1), unit: '%', icon: Heart, color: 'text-rose-400', trend: 'SIGNAL_TRAJECTORY' },
            { label: 'Workflow Velocity', value: data.workflowEfficiencyScore, unit: '%', icon: Zap, color: getScoreColor(data.workflowEfficiencyScore), trend: 'IDEATION_THROUGHPUT' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -10, backgroundColor: 'rgba(255,255,255,0.06)' }}
              className={`${glass} p-12 rounded-[5rem] flex flex-col items-center text-center group border-white/5 relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]`}
            >
               <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"><Monitor size={120} className="text-white" /></div>
               <div className={`w-20 h-20 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-700`}>
                  <kpi.icon size={36} className={`${kpi.color} opacity-80`} />
               </div>
               <div className={`text-7xl font-black italic tracking-tighter tabular-nums leading-none mb-6 drop-shadow-2xl ${kpi.color}`}>
                 {kpi.value}<span className="text-2xl opacity-40 ml-1">{kpi.unit}</span>
               </div>
               <div className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">{kpi.label}</div>
               <div className="text-[10px] text-slate-950 font-black uppercase tracking-widest mt-6 italic bg-white/5 px-6 py-2 rounded-full border border-white/5">
                  {kpi.trend}
               </div>
            </motion.div>
          ))}
        </div>

        {/* Matrix Intelligence & Kinetic Alert */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 relative z-10">
           {/* Heuristic Protocol Advice */}
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
             className={`${glass} p-16 rounded-[6rem] bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] relative flex flex-col justify-between min-h-[400px] group transition-all duration-1000`}
           >
              <div className="absolute top-0 right-0 p-16 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-1000"><Terminal size={300} /></div>
              <div className="space-y-12 relative z-10">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl animate-pulse"><Sparkles size={32} className="text-indigo-400" /></div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Heuristic Protocol</h3>
                 </div>
                 <div className="border-l-4 border-indigo-500/40 pl-10 space-y-6">
                    <p className="text-4xl font-black text-white leading-tight italic tracking-tighter max-w-2xl">
                       &quot;{data.nextBestAction}&quot;
                    </p>
                    <p className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-relaxed">
                       Recommended based on multi-node engagement patterns and algorithmic resonance modeling.
                    </p>
                 </div>
              </div>
              <div className="flex items-center gap-6 text-[11px] font-black text-indigo-400 uppercase tracking-[0.8em] italic border-t border-white/5 pt-12">
                 MISSION_CRITICAL_UPDATE_ACTIVE
              </div>
           </motion.div>

           {/* Kinetic Signal Breach Card */}
           {data.peakVelocityPost && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
               className={`${glass} p-16 rounded-[6rem] bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] cursor-pointer group flex flex-col justify-between min-h-[400px] transition-all duration-1000`}
               onClick={() => setSelectedPost(data.peakVelocityPost)}
             >
                <div className="absolute top-0 right-0 p-16 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-1000"><Network size={320} /></div>
                <div className="space-y-10 relative z-10">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[2rem] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-2xl"><Flame size={32} className="text-orange-400 animate-pulse" /></div>
                        <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Kinetic Breach</h3>
                     </div>
                     <ArrowUpRight size={40} className="text-orange-400 opacity-20 group-hover:opacity-100 group-hover:scale-125 transition-all duration-1000" />
                  </div>
                  <div className="text-9xl font-black text-white italic tracking-tighter leading-none mt-8 drop-shadow-2xl">
                    +{data.peakVelocityPost.velocity}<span className="text-3xl text-slate-500 ml-2 not-italic tracking-widest opacity-40">/HR_FLUX</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="text-2xl font-black text-white/50 uppercase italic tracking-widest">{data.peakVelocityPost.platform.toUpperCase()} PHANTOM NODE</p>
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <p className="text-2xl font-black text-orange-400 italic">{(data.peakVelocityPost.views / 1000).toFixed(1)}K SATURATION</p>
                  </div>
                </div>

                {data.peakVelocityPost.anomalyAdvice && (
                  <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/5 relative z-10 group-hover:border-orange-500/40 transition-all duration-1000">
                    <div className="text-[12px] font-black text-orange-400 uppercase tracking-widest italic mb-2">→ ADVISORY_PROTOCOL:</div>
                    <p className="text-[18px] font-black text-white italic tracking-tight leading-snug">{data.peakVelocityPost.anomalyAdvice.action}</p>
                  </div>
                )}
             </motion.div>
           )}
        </div>

        {/* Node Integrity Ledger */}
        <div className={`${glass} p-12 rounded-[6rem] space-y-12 border-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden`}>
           <div className="absolute top-0 right-0 p-32 opacity-[0.015] pointer-events-none border-none"><Terminal size={400} /></div>
           <div className="flex items-center gap-8 mb-12 relative z-10">
              <div className="p-6 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 shadow-2xl shadow-indigo-500/20"><ActivitySquare size={40} className="text-indigo-400" /></div>
              <div>
                 <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Node Integrity Ledger</h2>
                 <p className="text-[12px] text-slate-800 font-black uppercase tracking-[0.5em] italic leading-none">Diagnostic surveillance of high-cadence content nodes across the global substrate.</p>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-10 relative z-10">
              {data.posts.map((post, i) => (
                <motion.div key={post.postId} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 20, backgroundColor: 'rgba(255,255,255,0.04)' }}
                  className={`${glass} flex flex-col xl:flex-row items-center gap-12 p-8 rounded-[4rem] border shadow-2xl cursor-pointer transition-all duration-700 ${getScoreBg(post.healthScore)}`}
                  onClick={() => setSelectedPost(post)}
                >
                   <div className="w-20 h-20 rounded-[2rem] bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0 shadow-2xl group-hover:rotate-12 transition-all duration-1000">
                      {getAnomalyIcon(post.anomalyType)}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-6 mb-3">
                         <span className="text-2xl font-black text-white uppercase italic tracking-tighter">{post.platform} NODE</span>
                         {post.anomalyType !== 'none' && (
                           <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest border border-orange-500/30 px-4 py-1.5 rounded-full bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                             {post.anomalyType.replace('_', ' ')}
                           </span>
                         )}
                      </div>
                      <div className="flex flex-wrap items-center gap-8 text-[12px] text-slate-800 font-black uppercase tracking-widest italic">
                         <div className="flex items-center gap-3"><Eye size={16} /> <span>{(post.views / 1000).toFixed(1)}K_SAT</span></div>
                         <div className="flex items-center gap-3"><Heart size={16} /> <span>{post.likes.toLocaleString()}_AFFINITY</span></div>
                         <div className="flex items-center gap-3"><MessageSquare size={16} /> <span>{post.comments}_SIGNALS</span></div>
                         <div className="flex items-center gap-3"><Zap size={16} className="text-amber-500" /> <span>{post.velocity}/HR_FLUX</span></div>
                      </div>
                   </div>

                   <div className={`text-7xl font-black italic tracking-tighter tabular-nums leading-none flex items-end gap-2 drop-shadow-2xl ${getScoreColor(post.healthScore)}`}>
                      {post.healthScore}<span className="text-2xl opacity-40 mb-2">%_INTEGRITY</span>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>

        {/* ── Post Detail Drawer (Heuristic Insight) ── */}
        <AnimatePresence>
          {selectedPost && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-8"
              onClick={() => setSelectedPost(null)}
            >
              <motion.div initial={{ scale: 0.9, y: 100, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 100, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
                className={`${glass} w-full max-w-4xl rounded-[6rem] p-24 space-y-16 border-white/10 shadow-[0_100px_200px_rgba(0,0,0,0.8)] relative overflow-hidden`}
                onClick={e => e.stopPropagation()}
              >
                 <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none"><Fingerprint size={800} /></div>
                 
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-10">
                       <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all duration-700">
                          {getAnomalyIcon(selectedPost.anomalyType)}
                       </div>
                       <div>
                          <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">
                             {selectedPost.platform.toUpperCase()} Node Diagnostic
                          </h4>
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.5em] italic">Heuristic Depth Scan active...</span>
                       </div>
                    </div>
                    <button onClick={() => setSelectedPost(null)} className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 shadow-2xl"><X size={32} /></button>
                 </div>

                 <div className="flex flex-col items-center justify-center py-16 relative z-10 space-y-6">
                    <div className={`text-[12rem] font-black italic tracking-tighter leading-none drop-shadow-2xl ${getScoreColor(selectedPost.healthScore)}`}>
                       {selectedPost.healthScore}<span className="text-4xl opacity-40 ml-4">%</span>
                    </div>
                    <div className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none border-t border-white/5 pt-8">NODE_INTEGRITY_INDEX</div>
                 </div>

                 {selectedPost.anomalyType !== 'none' && selectedPost.anomalyAdvice && (
                   <div className="p-16 rounded-[4rem] bg-indigo-600/10 border border-indigo-500/30 space-y-8 relative z-10 shadow-[inset_0_0_80px_rgba(99,102,241,0.1)]">
                      <div className="flex items-center justify-between">
                         <div className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.8em] italic">→ HEURISTIC_RECOMMENDATION</div>
                         <div className="flex items-center gap-4 text-orange-500 text-[11px] font-black uppercase tracking-widest italic animate-pulse">
                            <AlertTriangle size={16} /> {selectedPost.anomalyAdvice.urgency}
                         </div>
                      </div>
                      <p className="text-4xl font-black text-white italic tracking-tighter leading-tight border-l-4 border-indigo-500/30 pl-10">
                        {selectedPost.anomalyAdvice.action}
                      </p>
                      <p className="text-[16px] text-slate-800 font-black italic leading-relaxed pl-10 opacity-80 uppercase tracking-widest border-l-4 border-indigo-500/10">
                        {selectedPost.anomalyAdvice.reasoning}
                      </p>
                   </div>
                 )}

                 <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
                    <DetailStat label="Saturation" value={selectedPost.views.toLocaleString()} icon={Eye} color="text-emerald-400" />
                    <DetailStat label="Affinity" value={selectedPost.likes.toLocaleString()} icon={Heart} color="text-rose-400" />
                    <DetailStat label="Signals" value={selectedPost.comments.toLocaleString()} icon={MessageSquare} color="text-indigo-400" />
                    <DetailStat label="Flux Rate" value={`${selectedPost.velocity}/hr`} icon={Zap} color="text-amber-400" />
                 </div>
                 
                 <div className="pt-8 flex justify-center relative z-10">
                    <button onClick={() => setSelectedPost(null)} className="px-16 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.8em] italic rounded-[3.5rem] hover:bg-indigo-600 hover:text-white transition-all duration-700 shadow-2xl active:scale-95">CLOSE_DIAGNOSTIC</button>
                 </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function DetailStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="p-8 rounded-[3rem] bg-black/60 border border-white/10 flex flex-col items-center text-center group hover:bg-white/[0.04] transition-all duration-700 shadow-inner">
      <Icon className={`w-8 h-8 ${color} mb-4 opacity-70 group-hover:scale-125 transition-all duration-700`} />
      <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] mb-3 italic">{label}</div>
      <div className={`text-3xl font-black italic tracking-tighter tabular-nums ${color} leading-none group-hover:scale-110 transition-transform duration-700 drop-shadow-2xl`}>{value}</div>
    </div>
  )
}
