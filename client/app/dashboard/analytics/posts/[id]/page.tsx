'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Eye, Heart, MessageSquare, Share2, TrendingUp, Calendar, Zap, 
  BarChart3, ExternalLink, Shield, Cpu, Terminal, Fingerprint, Target,
  RefreshCw, Boxes, Monitor, Network, Globe, Radio, ActivitySquare, Lock
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import LoadingSkeleton from '../../../../../components/LoadingSkeleton'
import ToastContainer from '../../../../../components/ToastContainer'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface PostAnalytics {
  id: string; platform: string; platform_post_id?: string; platform_post_url?: string;
  views: number; likes: number; shares: number; comments: number; retweets: number;
  saves: number; engagement_rate: number; click_through_rate: number;
  posted_at?: string; last_updated: string; created_at: string;
}

interface PostInsights {
  post_id: string; user_id: string; performance_score: number;
  best_posting_time: string; recommended_hashtags: string[];
  content_improvements: string[]; audience_reach_estimate: number;
  trending_topics: string[]; generated_at: string;
}

interface PostData {
  post_id: string; analytics: PostAnalytics[]; insights: PostInsights | null;
  aggregate: {
    total_views: number; total_likes: number; total_shares: number;
    total_comments: number; total_retweets: number; total_saves: number;
    platforms_count: number; overall_engagement_rate: string;
  };
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏', linkedin: 'in', instagram: '◎', facebook: 'f', tiktok: '♪', youtube: '▶'
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: 'from-slate-400 to-slate-900', linkedin: 'from-blue-600 to-blue-900',
  instagram: 'from-pink-500 to-purple-600', facebook: 'from-indigo-600 to-indigo-900',
  tiktok: 'from-slate-800 to-black', youtube: 'from-red-600 to-red-900'
}

export default function NodeSpectralDiagnosticPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PostData | null>(null)

  const loadSpectralDiagnostic = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true)
      setError(null)
      const response = await apiGet<PostData>(`/analytics/posts/${params.id}`)
      setData(response)
    } catch (err: any) {
      setError(err.message || 'DIAGNOSTIC_UPLINK_FAILURE')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [params.id])

  useEffect(() => { if (params.id) loadSpectralDiagnostic() }, [params.id, loadSpectralDiagnostic])

  const fmt = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <ActivitySquare size={64} className="text-violet-500 animate-spin mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Deciphering Node Spectrum...</span>
     </div>
  );

  if (error || !data) return (
     <div className="min-h-screen relative z-10 pb-24 px-10 pt-16 max-w-[1500px] mx-auto space-y-16 bg-[#020205]">
        <button onClick={() => router.back()} className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all shadow-2xl"><ArrowLeft size={32}/></button>
        <div className={`${glassStyle} p-32 rounded-[5rem] text-center border-rose-500/20 max-w-3xl mx-auto shadow-[0_0_150px_rgba(225,29,72,0.1)]`}>
           <Zap size={80} className="text-rose-500 mx-auto mb-10 animate-pulse" />
           <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-8">Spectral Signal Lost</h2>
           <p className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic">{error || 'NODE_DATA_DISSOLUTION'}</p>
        </div>
     </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.back()} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={32} />
              </button>
              <div className="w-20 h-20 bg-violet-500/5 border border-violet-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent opacity-100" />
                <ActivitySquare size={40} className="text-violet-400 relative z-10 group-hover:rotate-90 transition-transform duration-1000" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Target size={14} className="text-violet-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.6em] text-violet-400 italic leading-none">Diagnostic Matrix v7.4.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <Shield size={12} className="text-violet-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-800 tracking-widest uppercase italic leading-none">NODE_LOCKED_ALPHA</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Node Diagnostic</h1>
                 <p className="text-slate-800 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">High-fidelity spectral analysis and heuristic intelligence for specific content nodes.</p>
              </div>
           </div>
           <button onClick={() => loadSpectralDiagnostic(true)} disabled={refreshing}
             className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] hover:bg-violet-500 hover:text-white transition-all shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6"
           >
              <RefreshCw size={28} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'SYNCHRONIZING...' : 'SYNC_NODE_DATA'}
           </button>
        </header>

        {/* Core Resonance Metrics HUD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
           <ResonanceCard label="Total Saturation" value={fmt(data.aggregate.total_views)} icon={Eye} color="text-violet-400" trend="SPECTRAL_REACH" />
           <ResonanceCard label="Total Resonance" value={fmt(data.aggregate.total_likes + data.aggregate.total_comments + data.aggregate.total_shares)} icon={Heart} color="text-rose-400" trend="AFFINITY_SIGNALS" />
           <ResonanceCard label="Kinetic Flux" value={`${data.aggregate.overall_engagement_rate}%`} icon={TrendingUp} color="text-emerald-400" trend="RESONANCE_RATE" />
           <ResonanceCard label="Platform Density" value={data.aggregate.platforms_count} icon={Globe} color="text-amber-400" trend="SUBSTRATE_NODES" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-16 relative z-10">
           {/* Substrate Distribution Matrix */}
           <div className="xl:col-span-2 space-y-12">
              <div className={`${glassStyle} rounded-[6rem] p-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] relative overflow-hidden h-full flex flex-col`}>
                 <div className="absolute top-0 right-0 p-32 opacity-[0.015] pointer-events-none"><Network size={600} className="text-white" /></div>
                 <div className="flex items-center gap-8 mb-16 relative z-10 px-8">
                    <div className="p-6 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 shadow-2xl"><Radio size={40} className="text-indigo-400" /></div>
                    <div>
                       <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Substrate Distribution</h2>
                       <p className="text-[12px] text-slate-800 font-black uppercase tracking-[0.5em] italic leading-none">Diagnostic breakdown of performance across all active phantom substrates.</p>
                    </div>
                 </div>

                 <div className="space-y-10 relative z-10 flex-1 px-8 mb-16">
                    {data.analytics.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {data.analytics.map((platform) => (
                          <motion.div whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.04)' }} 
                            key={platform.platform} className="p-10 rounded-[4rem] bg-black/40 border border-white/5 shadow-2xl group transition-all duration-700"
                          >
                             <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-6">
                                   <div className={`w-16 h-16 rounded-[2rem] bg-gradient-to-br ${PLATFORM_COLORS[platform.platform] || 'from-slate-600 to-black'} flex items-center justify-center text-white font-black text-2xl shadow-2xl group-hover:rotate-12 transition-all duration-1000 border border-white/10`}>
                                      {PLATFORM_ICONS[platform.platform] || '📱'}
                                   </div>
                                   <span className="text-2xl font-black text-white uppercase italic tracking-tighter">{platform.platform} NODE</span>
                                </div>
                                {platform.platform_post_url && (
                                  <a href={platform.platform_post_url} target="_blank" rel="noopener noreferrer" 
                                    className="w-12 h-12 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all shadow-2xl"
                                  >
                                    <ExternalLink size={20} />
                                  </a>
                                )}
                             </div>
                             <div className="grid grid-cols-2 gap-6">
                                <PlatformStat label="Saturation" value={fmt(platform.views)} color="text-violet-400" />
                                <PlatformStat label="Affinity" value={fmt(platform.likes)} color="text-rose-400" />
                                <PlatformStat label="Signals" value={fmt(platform.comments)} color="text-indigo-400" />
                                <PlatformStat label="Resonance" value={`${platform.engagement_rate.toFixed(1)}%`} color="text-emerald-400" />
                             </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 opacity-10">
                         <Boxes size={120} className="text-white animate-pulse" />
                         <p className="text-4xl font-black text-white uppercase italic tracking-tighter">NULL_SUBSTRATE_MATRIX</p>
                      </div>
                    )}
                 </div>
                 
                 <div className="pt-12 mt-auto border-t border-white/5 flex items-center justify-between px-8 relative z-10">
                    <div className="flex items-center gap-4 text-slate-800 italic text-[11px] font-black uppercase tracking-widest">
                       <Shield size={16} /> DATA_PROTOCOL_SYMMETRIC
                    </div>
                    <div className="text-slate-800 text-[11px] font-black uppercase tracking-widest italic bg-black/40 px-6 py-2 rounded-full border border-white/5">
                       LITERAL_LOG_V9.4
                    </div>
                 </div>
              </div>
           </div>

           {/* Heuristic Intelligence Report */}
           <div className="xl:col-span-1 space-y-12 h-full">
              <div className={`${glassStyle} rounded-[6rem] p-24 h-full relative overflow-hidden flex flex-col shadow-[0_60px_150px_rgba(0,0,0,0.6)]`}>
                 <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none"><Cpu size={400} className="text-white" /></div>
                 
                 <div className="flex items-center gap-6 mb-16 relative z-10">
                    <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center drop-shadow-2xl animate-pulse shadow-emerald-500/20"><Zap size={32} className="text-emerald-400" /></div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Intelligence Report</h3>
                 </div>

                 <AnimatePresence mode="wait">
                    {data.insights ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16 relative z-10 flex-1">
                         <div className="bg-black/40 border border-white/5 rounded-[4rem] p-12 text-center shadow-inner group/score hover:border-emerald-500/40 transition-all duration-1000">
                            <div className="text-[10rem] font-black italic tracking-tighter text-emerald-400 leading-none drop-shadow-2xl group-hover:scale-110 transition-transform duration-1000">
                               {data.insights.performance_score}
                            </div>
                            <div className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic border-t border-white/5 pt-8 mt-4 leading-none">INTEGRITY_QUOTIENT</div>
                         </div>

                         <div className="grid grid-cols-1 gap-12 pt-8">
                            <div className="space-y-4">
                               <label className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic pl-6">PEAK_MANIFEST_WINDOW</label>
                               <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/5 text-white font-black italic tracking-widest text-2xl uppercase shadow-inner border-l-4 border-l-emerald-500">
                                  {data.insights.best_posting_time}
                               </div>
                            </div>

                            <div className="space-y-6">
                               <label className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic pl-6">HEURISTIC_ImprovementS</label>
                               <ul className="space-y-5">
                                  {data.insights.content_improvements.map((imp, i) => (
                                    <motion.li initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                                      key={i} className="flex items-start gap-6 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 group/li hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all duration-700 shadow-2xl"
                                    >
                                       <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover/li:rotate-45 transition-transform"><ActivitySquare size={16} className="text-indigo-400" /></div>
                                       <span className="text-[16px] text-white font-black italic leading-snug uppercase tracking-tight opacity-80 group-hover/li:opacity-100 transition-opacity">{imp}</span>
                                    </motion.li>
                                  ))}
                               </ul>
                            </div>
                         </div>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
                         <Zap size={100} className="text-violet-500/20 animate-pulse" />
                         <div className="space-y-6">
                            <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter">GENERATE_HEURISTICS</h4>
                            <p className="text-[13px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-relaxed max-w-xs">Initialize AI recursive logic to extract performance signals and optimization nodes.</p>
                         </div>
                         <button onClick={() => router.push(`/dashboard/analytics/insights/${params.id}`)}
                           className="px-16 py-8 bg-white text-black font-black uppercase text-[15px] tracking-[0.8em] italic rounded-[3rem] hover:bg-violet-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-6 group"
                         >
                            <Lock size={24} className="group-hover:scale-110 transition-transform duration-700" /> INITIATE_SCAN
                         </button>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function ResonanceCard({ label, value, icon: Icon, color, trend }: { label: string; value: string; icon: any; color: string; trend: string }) {
  return (
    <motion.div whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }}
      className={`${glassStyle} p-12 rounded-[5rem] flex flex-col items-center text-center group border-white/5 relative overflow-hidden`}
    >
       <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"><Monitor size={120} className="text-white" /></div>
       <div className={`w-24 h-24 rounded-[3rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-700`}>
          <Icon size={44} className={color} />
       </div>
       <div className="text-7xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-6 drop-shadow-2xl">{value}</div>
       <div className="text-[14px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">{label}</div>
       <div className="text-[10px] text-slate-950 font-black uppercase tracking-widest mt-6 italic bg-white/5 px-6 py-2 rounded-full border border-white/5 group-hover:text-violet-400 transition-colors">
          {trend}
       </div>
    </motion.div>
  )
}

function PlatformStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-2 p-6 rounded-[2rem] bg-black/40 border border-white/5 shadow-inner text-center">
       <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1 italic opacity-60">{label}</span>
       <span className={`text-3xl font-black italic tracking-tighter leading-none ${color} drop-shadow-2xl`}>{value}</span>
    </div>
  )
}
