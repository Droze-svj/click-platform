'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { 
  Trophy, Zap, Activity, Cpu, Database, 
  Globe, Radio, ArrowUpRight, CheckCircle2, 
  Lock, Unlock, Target, Terminal, Layers, 
  Settings2, Box, Sparkles, Video,
  ArrowLeft, Fingerprint, Gauge, Network, Brain,
  TrendingUp, PieChart, Shield, History, Grid,
  Award, Command, Boxes, Monitor, ActivitySquare
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface Achievement {
  _id: string; achievementType: string; unlockedAt: string; metadata?: any;
}

interface EngagementStats {
  achievements: { total: number; recent: Achievement[]; all: Achievement[] };
  streak: { currentStreak: number; longestStreak: number };
  stats: { totalContent: number; totalVideos: number; totalScripts: number };
  level: number;
}

const allMilestones = [
  { type: 'first_video', name: 'Genesis Rendition', emoji: '🎥', description: 'Deploy your first autonomous video rendition.' },
  { type: 'first_content', name: 'Logic Architect', emoji: '✨', description: 'Initialize your first logic synthesis payload.' },
  { type: 'first_script', name: 'Neural Scripter', emoji: '📝', description: 'Craft your first neural execution script.' },
  { type: 'content_milestone_10', name: 'Logic Cluster 10', emoji: '🎉', description: 'Synthesize 10 logic payloads.' },
  { type: 'content_milestone_50', name: 'Logic Cluster 50', emoji: '🚀', description: 'Synthesize 50 logic payloads.' },
  { type: 'content_milestone_100', name: 'Logic Matrix 100', emoji: '💯', description: 'Synthesize 100 logic payloads.' },
  { type: 'video_milestone_10', name: 'Spectral Decad 10', emoji: '🎬', description: 'Render 10 spectral video streams.' },
  { type: 'video_milestone_50', name: 'Spectral Centurion 50', emoji: '🎥', description: 'Render 50 spectral video streams.' },
  { type: 'streak_7', name: 'Coherence 7', emoji: '🔥', description: 'Maintain neural coherence for 7 cycles.' },
  { type: 'streak_30', name: 'Coherence 30', emoji: '⭐', description: 'Maintain neural coherence for 30 cycles.' },
  { type: 'streak_100', name: 'Resonance Prime 100', emoji: '👑', description: 'Maintain neural coherence for 100 cycles.' },
  { type: 'workflow_master', name: 'Orchestration Prime', emoji: '🤖', description: 'Initialize 5+ autonomous orchestration matrices.' },
  { type: 'social_media_pro', name: 'Presence Flux Pro', emoji: '📱', description: 'Distribute to 5+ resonance nodes.' },
  { type: 'content_creator', name: 'Logic Synthesis Master', emoji: '🎨', description: 'Achieve peak logic synthesis fidelity.' },
  { type: 'early_adopter', name: 'Protocol Pioneer', emoji: '🌟', description: 'Integrated during genesis phase.' },
  { type: 'power_user', name: 'High-Fidelity Operative', emoji: '⚡', description: 'Operate at peak neural capacity.' }
]

export default function AscensionLedgerPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<EngagementStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMilestoneData = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        setStats({
          achievements: {
            total: 3,
            recent: [
              { _id: 'm1', achievementType: 'first_video', unlockedAt: new Date(Date.now() - 86400000).toISOString() },
              { _id: 'm2', achievementType: 'first_content', unlockedAt: new Date(Date.now() - 172800000).toISOString() },
              { _id: 'm3', achievementType: 'content_milestone_10', unlockedAt: new Date(Date.now() - 259200000).toISOString() }
            ],
            all: [
              { _id: 'm1', achievementType: 'first_video', unlockedAt: new Date(Date.now() - 86400000).toISOString() },
              { _id: 'm2', achievementType: 'first_content', unlockedAt: new Date(Date.now() - 172800000).toISOString() },
              { _id: 'm3', achievementType: 'content_milestone_10', unlockedAt: new Date(Date.now() - 259200000).toISOString() }
            ]
          },
          streak: { currentStreak: 5, longestStreak: 12 },
          stats: { totalContent: 25, totalVideos: 8, totalScripts: 15 },
          level: 3
        })
        setLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/engagement/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) setStats(response.data.data)
    } catch { /* Silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login')
      return
    }
    loadMilestoneData()
  }, [user, router, loadMilestoneData, loading])

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Trophy size={64} className="text-amber-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Cataloging Evolutionary Ascension...</span>
     </div>
  );

  const decryptedTypes = new Set(stats?.achievements.all.map(a => a.achievementType) || [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Ascension Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={32} />
              </button>
              <div className="w-24 h-24 bg-amber-500/5 border border-amber-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-100" />
                <Trophy size={44} className="text-amber-400 relative z-10 group-hover:scale-125 transition-transform duration-1000" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Shield size={16} className="text-amber-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-amber-400 italic leading-none">Ascension Registry v10.4</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <ActivitySquare size={12} className="text-amber-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-800 tracking-widest uppercase italic leading-none">LEVEL_{stats?.level}_ASYNC</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Ascension Ledger</h1>
                 <p className="text-slate-800 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Global catalog of neural progression and autonomous breakthroughs.</p>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <button onClick={loadMilestoneData}
                className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] hover:bg-amber-500 hover:text-white transition-all shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6 group"
              >
                <RefreshCw size={28} className="group-hover:rotate-180 transition-transform duration-1000" />
                REFRESH_REGISTRY
              </button>
           </div>
        </header>

        {/* Stats Matrix HUD */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
            <AscensionStatCard icon={Layers} label="Evolutionary Tier" value={`TIER_${stats.level}`} sub={`${(stats.level % 10) * 10}% TO_ASCENSION`} color="text-purple-400" />
            <AscensionStatCard icon={Award} label="Decrypted Milestones" value={stats.achievements.total} sub="VECTORS_VERIFIED" color="text-blue-400" />
            <AscensionStatCard icon={Zap} label="Coherence Streak" value={stats.streak.currentStreak} sub={`PEAK_RESONANCE: ${stats.streak.longestStreak}`} color="text-amber-400" pulse />
            <AscensionStatCard icon={TrendingUp} label="Synthesis Volume" value={stats.stats.totalContent} sub="TOTAL_PAYLOADS_SYNTHESIZED" color="text-emerald-400" />
          </div>
        )}

        {/* Neural Progression Overview */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className={`${glassStyle} rounded-[6rem] p-20 relative overflow-hidden group border-indigo-500/10 shadow-[0_60px_150px_rgba(0,0,0,0.6)]`}
        >
           <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none group-hover:opacity-[0.1] transition-all duration-1000"><Activity size={400} className="text-indigo-400" /></div>
           <div className="flex flex-col lg:flex-row items-center justify-between gap-24 relative z-10">
              <div className="text-center lg:text-left space-y-8 max-w-2xl">
                 <div className="flex items-center gap-6 mb-2">
                   <Monitor size={32} className="text-indigo-400" />
                   <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Neural Progression</h3>
                 </div>
                 <p className="text-[16px] text-slate-800 font-black uppercase italic tracking-[0.4em] leading-relaxed">
                    Real-time synchronization of autonomous output across all operational sectors. Manifesting high-fidelity evolution.
                 </p>
                 <div className="pt-8 border-t border-white/5 flex items-center gap-6">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[12px] font-black text-emerald-400 uppercase tracking-widest italic leading-none">TELEMETRY_STREAM_ACTIVE</span>
                 </div>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-10 w-full">
                 <DetailProgCard icon={Video} label="Spectral Renditions" value={stats?.stats.totalVideos || 0} color="text-rose-400" />
                 <DetailProgCard icon={Sparkles} label="Logic Payloads" value={stats?.stats.totalContent || 0} color="text-blue-400" />
                 <DetailProgCard icon={Terminal} label="Neural Scripts" value={stats?.stats.totalScripts || 0} color="text-purple-400" />
              </div>
           </div>
        </motion.div>

        {/* Recent Breakthroughs */}
        <AnimatePresence>
          {stats && stats.achievements.recent.length > 0 && (
            <div className="space-y-12 relative z-10">
               <div className="flex items-center gap-8">
                  <History size={32} className="text-amber-500" />
                  <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Recent Breakthroughs</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {stats.achievements.recent.slice(0, 3).map((a, i) => {
                    const data = allMilestones.find(m => m.type === a.achievementType)
                    return (
                      <motion.div key={a._id} initial={{ opacity: 0, scale: 0.9, x: -30 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -15, backgroundColor: 'rgba(245,158,11,0.06)' }}
                        className="p-10 bg-amber-500/[0.03] border border-amber-500/10 rounded-[4rem] flex items-center gap-10 group shadow-[0_40px_80px_rgba(0,0,0,0.4)] transition-all duration-700"
                      >
                         <div className="text-7xl group-hover:scale-125 group-hover:rotate-12 transition-transform duration-1000 drop-shadow-2xl">{data?.emoji || '🏆'}</div>
                         <div>
                            <p className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 group-hover:text-amber-400 transition-colors">{data?.name || a.achievementType.toUpperCase()}</p>
                            <p className="text-[11px] font-black text-amber-400/60 uppercase italic tracking-[0.3em] leading-none mb-4">DECRYPTED {new Date(a.unlockedAt).toLocaleDateString()}</p>
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-amber-500" />
                               <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest italic">ASCENSION_VERIFIED</span>
                            </div>
                         </div>
                      </motion.div>
                    )
                  })}
               </div>
            </div>
          )}
        </AnimatePresence>

        {/* Node Ascension Matrix */}
        <div className="space-y-12 relative z-10">
           <div className="flex items-center gap-8">
              <Boxes className="text-indigo-500" size={32} />
              <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Node Ascension Matrix</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {allMilestones.map((m, idx) => {
                const isDecrypted = decryptedTypes.has(m.type)
                const unlocked = stats?.achievements.all.find(a => a.achievementType === m.type)

                return (
                  <motion.div key={m.type} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                    className={`relative p-12 rounded-[4.5rem] border-2 transition-all duration-1000 group hover:shadow-[0_60px_100px_rgba(0,0,0,0.6)] ${isDecrypted ? 'bg-indigo-500/[0.05] border-indigo-500/30' : 'bg-black/40 border-white/5 opacity-30 hover:opacity-100 hover:border-white/20'}`}>
                     
                     {isDecrypted && (
                       <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#020205] shadow-2xl z-20">
                          <CheckCircle2 size={24} className="text-white" />
                       </div>
                     )}

                     <div className="flex flex-col items-center text-center gap-10">
                        <div className={`text-8xl transition-all duration-1000 drop-shadow-2xl ${isDecrypted ? 'group-hover:scale-125 group-hover:rotate-12' : 'grayscale group-hover:grayscale-0'}`}>{m.emoji}</div>
                        <div className="space-y-4">
                           <h4 className={`text-2xl font-black italic uppercase tracking-tighter leading-none ${isDecrypted ? 'text-white group-hover:text-indigo-400' : 'text-slate-800'}`}>{m.name}</h4>
                           <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] leading-relaxed italic px-4">{m.description}</p>
                        </div>
                        
                        <div className="w-full pt-8 border-t border-white/5 relative">
                           {isDecrypted && unlocked ? (
                             <div className="flex flex-col items-center gap-2">
                                <p className="text-[10px] font-black text-indigo-400 uppercase italic tracking-[0.3em] leading-none mb-1">DECRYPTED</p>
                                <p className="text-[12px] font-black text-white italic tracking-tighter leading-none">{new Date(unlocked.unlockedAt).toLocaleDateString()}</p>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-2">
                                <Lock size={20} className="text-slate-900 mb-1" />
                                <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-[0.3em] leading-none">LOGIC_GATED</p>
                             </div>
                           )}
                        </div>
                     </div>
                  </motion.div>
                )
              })}
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function AscensionStatCard({ icon: Icon, label, value, sub, color, pulse }: { icon: any; label: string; value: any; sub: string; color: string; pulse?: boolean }) {
  return (
    <motion.div whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }}
       className={`${glassStyle} rounded-[5rem] p-16 flex flex-col items-center text-center group border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.5)]`}
    >
       <div className={`w-20 h-20 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-10 shadow-2xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 relative`}>
          <div className={`absolute inset-0 bg-white/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
          <Icon size={36} className={`${color} relative z-10 ${pulse ? 'animate-pulse' : ''}`} />
       </div>
       <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.4em] italic mb-4 leading-none opacity-60">{label}</h4>
       <div className="text-6xl font-black text-white italic tabular-nums leading-none tracking-tighter mb-6 group-hover:text-indigo-400 transition-colors duration-700 drop-shadow-2xl">{typeof value === 'number' ? value.toLocaleString() : value}</div>
       <div className="px-6 py-2 rounded-full bg-white/5 border border-white/5">
         <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic leading-none">{sub}</p>
       </div>
    </motion.div>
  )
}

function DetailProgCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-black/40 border border-white/10 p-12 rounded-[4rem] flex flex-col items-center text-center group/card hover:bg-white/5 transition-all duration-700 shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]">
       <div className={`w-20 h-20 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-10 shadow-2xl group-hover/card:rotate-12 group-hover/card:scale-110 transition-all duration-1000`}><Icon size={36} className={color} /></div>
       <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] italic mb-4 opacity-40">{label}</p>
       <p className="text-5xl font-black text-white italic tabular-nums leading-none tracking-tighter drop-shadow-2xl">{value.toLocaleString()}</p>
       <div className="mt-8 w-12 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full ${color.replace('text', 'bg')} opacity-40`} style={{ width: '60%' }} />
       </div>
    </div>
  )
}
