'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  TrendingUp, Eye, Heart, MessageSquare, Share2, 
  Calendar, Zap, BarChart3, ArrowUpRight, ArrowDownRight,
  Filter, Download, ChevronRight, Activity, Target, Waves,
  Cpu, Globe, Network, Fingerprint, Shield, Radio, Lock, ActivitySquare,
  RefreshCw, ArrowLeft, Terminal, Gauge, Flame, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'

import { apiGet } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'
import SpectralLoader from '../../../../../components/SpectralLoader'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-700'
const premiumCard = 'backdrop-blur-2xl bg-black/60 border-2 border-white/5 rounded-[4rem] shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] hover:border-indigo-500/20 transition-all duration-500'

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '𝕏',
  linkedin: 'in',
  instagram: '◎',
  tiktok: '♪',
  youtube: '▶',
  facebook: 'f'
}

interface PostStats {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  engagement_rate: number;
}

interface PostAnalytics {
  post: any;
  analytics: PostStats[];
  insights: any;
  history: any[];
}

export default function SovereignPostDiagnosticHub() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PostAnalytics | null>(null)

  const loadDiagnosticMatrix = useCallback(async () => {
    try {
      setLoading(true)
      const postId = params.id as string
      const [details, historyRes] = await Promise.all([
        apiGet<any>(`/analytics/posts/${postId}`),
        apiGet<any>(`/analytics/history/${postId}`)
      ])
      
      setData({
        post: details.post,
        analytics: details.analytics || [],
        insights: details.insights,
        history: historyRes.history || historyRes.data || []
      })
    } catch (err) {
      console.error('DIAGNOSTIC_LINK_FAILURE:', err)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { loadDiagnosticMatrix() }, [loadDiagnosticMatrix])

  const chartData = useMemo(() => {
    if (!data?.history) return []
    return data.history.map(d => ({
      name: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      val: d.engagement_count || (d.likes + d.shares + d.comments) || 0,
      raw: d
    }))
  }, [data?.history])

  if (loading) return <SpectralLoader message="EXTRACTING_KINETIC_SIGNAL_DATA..." />;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-white bg-[#020205]">NODE_NOT_FOUND</div>;

  const mainStat = data.analytics[0] || { views: 0, likes: 0, shares: 0, comments: 0, engagement_rate: 0 }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24 bg-[#020205] overflow-x-hidden">
        {/* Spectral Ambience */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Activity size={1000} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Diagnostic Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-10">
              <button 
                onClick={() => router.push('/dashboard/analytics')}
                title="BACK_TO_ANALYTICS_MATRIX"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl"
              >
                <ArrowLeft size={32} />
              </button>
              <div className="w-20 h-20 bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Terminal size={40} className="text-indigo-400 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
              </div>
              <div className="max-w-2xl">
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Gauge size={14} className="text-indigo-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Diagnostic Node v9.2.1</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <Shield size={12} className="text-violet-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">{data.post.id?.slice(0, 8).toUpperCase() || 'EXTERNAL'}_NODE</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.9] mb-4 truncate max-w-4xl">{data.post.title || 'Untitled Node'}</h1>
                 <p className="text-slate-400 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">Detailed performance breakdown and heuristic optimization matrix.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <div className="text-right">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Published_Cycle</div>
                 <div className="text-xl font-black text-white italic tracking-widest">{new Date(data.post.published_at || data.post.created_at || Date.now()).toLocaleDateString()}</div>
              </div>
              <div className={`w-20 h-20 rounded-[2.5rem] bg-gradient-to-br ${data.post.platform === 'tiktok' ? 'from-slate-800 to-black' : 'from-indigo-600 to-indigo-900'} flex items-center justify-center text-white text-4xl shadow-2xl font-black italic border border-white/10`}>
                {PLATFORM_ICONS[data.post.platform] || '◈'}
              </div>
           </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 relative z-10">
           {/* Kinetic Path Chart */}
           <div className="xl:col-span-8 space-y-12">
              <div className={`${premiumCard} p-20 relative overflow-hidden h-full flex flex-col`}>
                 <div className="absolute top-0 right-0 p-32 opacity-[0.015] pointer-events-none"><Waves size={600} className="text-white" /></div>
                 <div className="flex items-center gap-8 mb-16 relative z-10 px-8">
                    <div className="p-6 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 shadow-2xl"><Activity size={40} className="text-indigo-400" /></div>
                    <div>
                       <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Kinetic Path</h2>
                       <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.5em] italic leading-none">Chronological engagement gravity mapped across the 30-day kinetic window.</p>
                    </div>
                 </div>

                 <div className="h-[550px] w-full bg-black/40 border border-white/5 rounded-[3rem] shadow-inner relative overflow-hidden p-8 mb-4">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/5 to-transparent opacity-50" />
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={chartData}>
                            <defs>
                               <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} dy={10} />
                            <YAxis stroke="#475569" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} width={40} />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="bg-black/90 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl border-l-[12px] border-l-indigo-500">
                                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">{payload[0].payload.name}</p>
                                      <div className="text-4xl font-black text-white italic tracking-tighter leading-none">{payload[0].value} <span className="text-[14px] text-slate-400 uppercase not-italic tracking-[0.4em] ml-2">Engagements</span></div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={6} fillOpacity={1} fill="url(#colorEngagement)" animationDuration={3000} />
                         </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-10 space-y-8">
                         <Target size={120} className="animate-pulse" />
                         <div className="text-2xl font-black italic uppercase tracking-widest">Spectral_Null_Path</div>
                      </div>
                    )}
                 </div>

                 <div className="grid grid-cols-4 gap-8 px-8 mt-8">
                    <DiagnosticParam label="Views" value={mainStat.views || 0} color="text-rose-400" />
                    <DiagnosticParam label="Likes" value={mainStat.likes || 0} color="text-amber-400" />
                    <DiagnosticParam label="Shares" value={mainStat.shares || 0} color="text-indigo-400" />
                    <DiagnosticParam label="Eng Rate" value={`${mainStat.engagement_rate || 0}%`} color="text-emerald-400" />
                 </div>
              </div>
           </div>

           {/* Diagnostic Matrix Pillar */}
           <div className="xl:col-span-4 space-y-16 flex flex-col h-full">
              <div className={`${premiumCard} p-24 relative overflow-hidden flex-1 flex flex-col`}>
                 <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none"><Cpu size={400} className="text-white" /></div>
                 
                 <div className="flex items-center gap-6 mb-16 relative z-10">
                    <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center drop-shadow-2xl animate-pulse shadow-emerald-500/20"><Zap size={32} className="text-emerald-400" /></div>
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">Diagnostic Matrix</h3>
                 </div>

                 <AnimatePresence mode="wait">
                    {data.insights ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16 relative z-10 flex-1">
                         <div className="bg-black/40 border border-white/5 rounded-[4rem] p-12 text-center shadow-inner group/score hover:border-emerald-500/40 transition-all duration-300">
                            <div className="text-[10rem] font-black italic tracking-tighter text-emerald-400 leading-none drop-shadow-2xl group-hover:scale-110 transition-transform duration-300">
                               {data.insights.performance_score}
                            </div>
                            <div className="text-[14px] font-black text-slate-400 uppercase tracking-[0.6em] italic border-t border-white/5 pt-8 mt-4 leading-none">SIGNAL_INTEGRITY</div>
                         </div>

                         <div className="grid grid-cols-1 gap-12 pt-8">
                            <div className="space-y-4">
                               <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic pl-6">OPTIMAL_MANIFEST_WINDOW</label>
                               <div className="p-8 rounded-[2.5rem] bg-black/40 border border-white/5 text-white font-black italic tracking-widest text-2xl uppercase shadow-inner border-l-4 border-l-emerald-500">
                                  {data.insights.best_posting_time}
                               </div>
                            </div>

                            {data.insights.metadata?.signalGaps && (
                              <div className="space-y-6">
                                <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic pl-6">SIGNAL_GAPS_DETECTED</label>
                                <div className="flex flex-wrap gap-3 pl-4">
                                  {data.insights.metadata.signalGaps.map((gap: string, i: number) => (
                                    <span key={i} className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-black text-rose-400 uppercase tracking-widest italic">
                                      {gap}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-6">
                               <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic pl-6">SUBSTRATE_SPECIFIC_ADVICE</label>
                               <div className="space-y-4">
                                  {data.insights.metadata?.platformAdvice ? Object.entries(data.insights.metadata.platformAdvice).map(([plat, advice], i) => (
                                    <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.01] border border-white/5 group/advice hover:bg-violet-500/5 transition-all">
                                       <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-[10px] font-bold border border-white/10 group-advice:border-violet-500/30">
                                          {PLATFORM_ICONS[plat.toLowerCase()] || plat[0].toUpperCase()}
                                       </div>
                                       <p className="text-[12px] text-slate-400 italic leading-relaxed font-medium">
                                          &ldquo;{advice as string}&rdquo;
                                       </p>
                                    </div>
                                  )) : (
                                    <p className="text-[11px] text-slate-400 uppercase italic pl-6 tracking-widest">NO_SUBSTRATE_SIGNAL</p>
                                  )}
                               </div>
                                                         <div className="space-y-6 pt-4">
                                   <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic pl-6">GENERAL_OPTIMIZATIONS</label>
                                   <div className="space-y-5">
                                      {data.insights.content_improvements?.map((imp: string, i: number) => (
                                        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }}
                                          key={i} className="flex items-start gap-6 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 group/div hover:bg-emerald-500/5 hover:border-emerald-500/20 transition-all duration-700 shadow-2xl"
                                        >
                                           <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover/div:rotate-45 transition-transform">
                                              <Activity size={16} className="text-violet-400" />
                                           </div>
                                           <span className="text-[14px] text-white font-medium italic leading-snug uppercase tracking-tight opacity-80 group-hover/div:opacity-100 transition-opacity">
                                              {imp}
                                           </span>
                                        </motion.div>
                                      ))}
                                   </div>
                                </div>
    </div>
                         </div>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
                         <Waves size={100} className="text-violet-500/20 animate-pulse" />
                         <div className="space-y-6">
                            <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter">GENERATE_HEURISTICS</h4>
                            <p className="text-[13px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-relaxed max-w-xs">Initialize AI recursive logic to extract performance signals and optimization nodes.</p>
                         </div>
                         <button onClick={() => router.push(`/dashboard/analytics/insights/${params.id}`)}
                           className="px-16 py-8 bg-white text-black font-black uppercase text-[15px] tracking-[0.8em] italic rounded-[3rem] hover:bg-violet-600 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-6 group"
                         >
                            <Zap size={24} className="group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700" /> INITIATE_SCAN
                         </button>
                      </motion.div>
                    )}
                 </AnimatePresence>

                 <div className="mt-auto pt-16 border-t border-white/5 flex items-center justify-between px-8 relative z-10">
                    <div className="flex items-center gap-4 text-slate-400 italic text-[11px] font-black uppercase tracking-widest">
                       <ActivitySquare size={16} /> DATA_PROTOCOL_SYMMETRIC
                    </div>
                    <div className="text-slate-400 text-[11px] font-black uppercase tracking-widest italic bg-black/40 px-6 py-2 rounded-full border border-white/5">
                       PHANTOM_STREAM_V9.2
                    </div>
                 </div>
              </div>

              {/* High-Intervention Control Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10 mt-12">
                 <div className={`${premiumCard} p-10 flex items-center gap-8`}>
                    <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center"><Target size={32} className="text-indigo-400" /></div>
                    <div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Potency Score</span>
                       <div className="text-4xl font-black text-white italic tracking-tighter">{data.insights?.performance_score || 0}%</div>
                    </div>
                 </div>
                 <div className={`${premiumCard} p-10 flex items-center gap-8`}>
                    <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center"><TrendingUp size={32} className="text-emerald-400" /></div>
                    <div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Predictive ROI</span>
                       <div className="text-4xl font-black text-emerald-400 italic tracking-tighter">+{data.insights?.metadata?.predictiveROI || 85}%</div>
                    </div>
                 </div>
                 <div className={`${premiumCard} md:col-span-2 p-10 flex items-center gap-8 group`}>
                    <div className="w-16 h-16 rounded-[2rem] bg-violet-500/10 flex items-center justify-center shrink-0"><Cpu size={32} className="text-violet-400 group-hover:scale-110 transition-transform" /></div>
                    <div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Strategic Intervention</span>
                       <div className="text-[14px] font-black text-white italic uppercase tracking-tight leading-tight opacity-90">
                          {data.insights?.metadata?.specificAdvice || "System analyzing kinetic resonance signatures for optimal intervention."}
                       </div>
                    </div>
                 </div>
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

function DiagnosticParam({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-black/40 rounded-[2.5rem] p-6 border border-white/5 flex flex-col items-center justify-center group hover:bg-white/5 transition-all shadow-inner relative overflow-hidden">
       <div className={`text-4xl font-black italic uppercase ${color} tracking-tighter leading-none mb-3`}>{value}</div>
       <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">{label}</div>
    </div>
  )
}
