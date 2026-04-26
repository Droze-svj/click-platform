'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  BarChart3, TrendingUp, Target, Users, Sparkles, RefreshCw, 
  Link2, Calendar, Zap, MessageSquare, Heart, Share2, 
  ChevronRight, Cpu, Activity, Shield, Globe, Radio, 
  Layers, Terminal, X, ArrowUpRight, Hexagon, PieChart,
  ArrowLeft, Network, Gauge, Fingerprint, Brain, Monitor,
  ActivitySquare, Lock, AlertCircle, Boxes, ArrowRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface AudienceOverview {
  totalEngagement?: number
  totalImpressions?: number
  engagementRate?: number
  platformDistribution?: Record<string, number>
  postsPerDay?: number
}

interface AudienceInsights {
  hasData: boolean
  message?: string
  period?: number
  totalPosts?: number
  insights?: {
    overview?: AudienceOverview
    engagement?: Record<string, unknown>
    demographics?: Record<string, unknown>
    recommendations?: string[]
  }
}

interface PlatformAudience {
  totalPosts?: number
  totalReach?: number
  totalEngagement?: number
  averageEngagementRate?: number
  topPlatform?: string
  bestPostingTime?: string
  engagementByPlatform?: Record<string, number>
}

interface ConnectedAccounts {
  twitter?: unknown; linkedin?: unknown; facebook?: unknown; 
  instagram?: unknown; youtube?: unknown; tiktok?: unknown;
}

export default function CognitiveForecasterPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audienceInsights, setAudienceInsights] = useState<AudienceInsights | null>(null)
  const [platformAudience, setPlatformAudience] = useState<PlatformAudience | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)
  const [period, setPeriod] = useState(30)

  const loadCognitiveData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [insightsRes, platformRes, accountsRes] = await Promise.all([
        apiGet<{ success?: boolean; data?: AudienceInsights }>(`/audience/insights?period=${period}`).catch(() => ({ data: { hasData: false } })),
        apiGet<{ success?: boolean; data?: PlatformAudience }>(`/analytics/platform/audience?period=${period}`).catch(() => ({ data: null })),
        apiGet<{ success?: boolean; accounts?: ConnectedAccounts }>('/oauth/accounts').catch(() => ({ accounts: {} }))
      ])
      
      const rawI = insightsRes as any
      const rawP = platformRes as any
      const rawA = accountsRes as any
      
      setAudienceInsights(rawI?.data ?? rawI ?? { hasData: false })
      setPlatformAudience(rawP?.data ?? rawP ?? null)
      setAccounts(rawA?.accounts ?? rawA ?? {})
    } catch {
      setError('UPLINK_ERR: COGNITIVE_ACCESS_DENIED')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { loadCognitiveData() }, [loadCognitiveData])

  const handleSynchronizeCognitive = async () => {
    try {
      setSyncing(true)
      setError(null)
      await apiPost('/analytics/platform/sync-all', { limit: 50 })
      await loadCognitiveData()
    } catch {
      setError('SYNC_ERR: NEURAL_DIFFRACTION')
    } finally {
      setSyncing(false)
    }
  }

  const connectedCount = accounts ? Object.values(accounts).filter(Boolean).length : 0

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Brain size={64} className="text-cyan-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Decoding Cognitive Waveforms...</span>
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
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={32} />
              </button>
              <div className="w-24 h-24 bg-cyan-500/5 border border-cyan-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-transparent opacity-100" />
                <Cpu size={44} className="text-cyan-400 relative z-10 group-hover:scale-125 transition-transform duration-300" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Shield size={16} className="text-cyan-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-cyan-400 italic leading-none">Cognitive Matrix v14.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <ActivitySquare size={12} className="text-cyan-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">PREDICTION_SYNCED</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Forecaster</h1>
                 <p className="text-slate-400 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Deep-layer receptor analysis and synthetic heuristic projections.</p>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center p-2 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-inner">
                {[7, 30, 90].map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-8 py-3 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic transition-all duration-700 ${
                      period === p ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}_CYCLES
                  </button>
                ))}
              </div>
              <button onClick={handleSynchronizeCognitive} disabled={syncing}
                className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] hover:bg-cyan-500 hover:text-white transition-all shadow-[0_40px_100px_rgba(255,255,255,0.1)] active:scale-95 flex items-center gap-6 group"
              >
                <RefreshCw size={28} className={syncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'} />
                {syncing ? 'DECRYPTING...' : 'SYNC_COG_INTEL'}
              </button>
           </div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-50"
            >
               <div className="p-12 rounded-[4rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-8 group shadow-2xl">
                  <div className="flex items-center gap-10">
                     <div className="w-16 h-16 bg-rose-500/20 rounded-3xl flex items-center justify-center border border-rose-500/30"><AlertCircle className="text-rose-400" size={32} /></div>
                     <p className="text-2xl font-black text-rose-400 uppercase tracking-tighter italic leading-none">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"><X size={24} /></button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Connection Status */}
        <div className={`${glassStyle} rounded-[6rem] p-16 relative z-10 group overflow-hidden border-cyan-500/10 hover:border-cyan-500/30 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)]`}>
          <div className="absolute top-0 right-0 p-16 opacity-[0.02] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-300"><Boxes size={400} /></div>
          <div className="flex flex-col xl:flex-row items-center justify-between gap-12 relative z-10">
            <div className="flex items-center gap-12">
              <div className="w-24 h-24 bg-cyan-600/5 border border-cyan-500/10 rounded-[3rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-300">
                <Link2 className="w-12 h-12 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Receptor Uplinks</h3>
                <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">
                  {connectedCount > 0
                    ? `${connectedCount} ACTIVE_SUBSTRATE_UPLINKS_DETECTED`
                    : 'INITIATE_UPLINK_TO_ACTIVATE_COGNITIVE_SURVEILLANCE'}
                </p>
              </div>
            </div>
            <button onClick={() => router.push('/dashboard/social')}
              className="px-16 py-8 bg-cyan-600 text-white rounded-[3rem] text-[16px] font-black uppercase tracking-[0.4em] italic hover:bg-white hover:text-black transition-all shadow-[0_40px_100px_rgba(6,182,212,0.3)] flex items-center gap-8 group"
            >
              {connectedCount > 0 ? 'CALIBRATE_UPLINKS' : 'INITIALIZE_NODES'}
              <ArrowUpRight className="w-8 h-8 group-hover:translate-x-4 group-hover:-translate-y-4 transition-transform duration-700" />
            </button>
          </div>
        </div>

        {/* Matrix Metrics HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
          <HeuristicStatCard icon={Globe} label="Spectral Reach" value={audienceInsights?.insights?.overview?.totalImpressions ?? platformAudience?.totalReach ?? 0} format="number" color="text-indigo-400" />
          <HeuristicStatCard icon={Activity} label="Signal Affinity" value={audienceInsights?.insights?.overview?.totalEngagement ?? platformAudience?.totalEngagement ?? 0} format="number" color="text-emerald-400" />
          <HeuristicStatCard icon={Zap} label="Resonance Rate" value={audienceInsights?.insights?.overview?.engagementRate ?? platformAudience?.averageEngagementRate ?? 0} format="percent" color="text-amber-400" />
          <HeuristicStatCard icon={Target} label="Primary Vector" value={platformAudience?.topPlatform ?? 'N/A'} format="text" color="text-rose-400" />
        </div>

        {/* Cognitive Intelligence Layers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-20 relative z-10">
          {/* Neural Receptor Density */}
          <div className={`${glassStyle} rounded-[6rem] overflow-hidden group border-indigo-500/10 shadow-[0_60px_150px_rgba(0,0,0,0.6)]`}>
            <div className="px-16 py-12 border-b border-white/5 flex items-center gap-10 bg-white/[0.01]">
              <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-2xl transition-all group-hover:rotate-12 group-hover:scale-110"><Users size={32} className="text-indigo-400" /></div>
              <h3 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Neural Receptors</h3>
            </div>
            <div className="p-16 min-h-[600px] flex flex-col justify-center">
              {audienceInsights?.hasData || platformAudience ? (
                <div className="space-y-16">
                  {audienceInsights?.insights?.overview?.platformDistribution && (
                    <div className="space-y-12">
                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none pl-6 border-l-2 border-indigo-500/40">Density Distribution Matrix</p>
                      <div className="grid grid-cols-1 gap-6">
                        {Object.entries(audienceInsights.insights.overview.platformDistribution).map(([p, count], idx) => (
                          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                            key={p} className="p-10 bg-black/40 border border-white/5 rounded-[3.5rem] flex items-center justify-between group/node hover:bg-indigo-500/5 hover:border-indigo-500/20 transition-all duration-700 shadow-[inset_0_0_50px_rgba(0,0,0,0.4)]"
                          >
                            <span className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-indigo-400 transition-colors">{p}</span>
                            <div className="flex items-center gap-10">
                               <div className="hidden md:block w-48 h-3 bg-black/60 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                  <div className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]" style={{ width: `${Math.min((count as number) * 10, 100)}%` }} />
                               </div>
                               <span className="text-2xl font-black text-indigo-400 italic tabular-nums leading-none tracking-tighter">{String(count).toUpperCase()} NODES</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                  {platformAudience?.bestPostingTime && (
                    <div className="flex items-center gap-12 p-12 bg-cyan-500/5 border border-cyan-500/10 rounded-[4.5rem] shadow-2xl group/opt transition-all duration-300 hover:bg-cyan-500/10 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover/opt:opacity-[0.1] transition-opacity"><Monitor size={200} /></div>
                      <div className="w-24 h-24 bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 rounded-[2.5rem] flex items-center justify-center shadow-2xl group-hover/opt:rotate-12 transition-transform duration-700"><Calendar size={48} /></div>
                      <div className="relative z-10">
                          <p className="text-[12px] font-black text-cyan-400/60 uppercase tracking-[0.6em] italic mb-4 leading-none truncate">Spectral_Window_Optimal</p>
                          <p className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">{platformAudience.bestPostingTime.toUpperCase()}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-[0.02] gap-16 group-hover:opacity-10 transition-opacity duration-300">
                  <PieChart size={180} className="text-white animate-pulse" />
                  <p className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none max-w-lg">NULL_RECEPTOR_SIGNAL</p>
                </div>
              )}
            </div>
          </div>

          {/* Synthetic Logic Synthesis */}
          <div className={`${glassStyle} rounded-[6rem] overflow-hidden group border-amber-500/10 shadow-[0_60px_150px_rgba(0,0,0,0.6)]`}>
            <div className="px-16 py-12 border-b border-white/5 flex items-center gap-10 bg-white/[0.01]">
              <div className="w-16 h-16 rounded-[2rem] bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-2xl transition-all group-hover:rotate-[-12deg] group-hover:scale-110"><Sparkles size={32} className="text-amber-400" /></div>
              <h3 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Logic Synthesis</h3>
            </div>
            <div className="p-16 min-h-[600px] flex flex-col justify-center">
              {audienceInsights?.insights?.recommendations && audienceInsights.insights.recommendations.length > 0 ? (
                <div className="grid grid-cols-1 gap-8">
                  {audienceInsights.insights.recommendations.slice(0, 5).map((rec, i) => (
                    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i}
                      className="flex items-center gap-12 p-10 bg-black/40 border border-amber-500/5 rounded-[4rem] group/rec hover:bg-amber-500/5 hover:border-amber-500/20 transition-all duration-700 shadow-inner"
                    >
                      <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center text-amber-500 flex-shrink-0 group-hover/rec:scale-110 group-hover/rec:rotate-12 transition-all duration-700 shadow-2xl">
                         <Zap size={32} />
                      </div>
                      <div>
                          <div className="flex items-center gap-6 mb-3">
                             <span className="text-[12px] font-black text-amber-400 uppercase tracking-widest italic leading-none">SYNTHETIC_PACKET_V{i+1}</span>
                             <div className="h-0.5 flex-1 bg-amber-500/10" />
                          </div>
                          <span className="text-3xl font-black text-slate-100 italic leading-[1.2] uppercase tracking-tighter line-clamp-2">{rec.toUpperCase()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-[0.02] gap-16 group-hover:opacity-10 transition-opacity duration-300">
                  <Shield size={180} className="text-white animate-pulse" />
                  <div className="space-y-8">
                     <p className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">SYNTHESIS_BUFFERED</p>
                     <p className="text-2xl font-black text-slate-400 uppercase tracking-widest italic leading-none max-w-md mx-auto">Initialize operational frequency to generate logic.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Persistence Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10 pt-16">
          {[
            { label: 'Spectral Sync', desc: 'Detailed performance diagnostics.', icon: BarChart3, href: '/dashboard/analytics', color: 'text-indigo-400' },
            { label: 'Temporal Hub', desc: 'Optimal node deployment windows.', icon: Calendar, href: '/dashboard/scheduler', color: 'text-teal-400' },
            { label: 'Neural Forge', desc: 'Synthetic logic payload crafting.', icon: Sparkles, href: '/dashboard/content', color: 'text-purple-400' },
          ].map((a, i) => (
            <motion.button key={a.label} whileHover={{ y: -20, scale: 1.05 }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => router.push(a.href)}
              className={`${glassStyle} p-16 rounded-[6rem] text-center flex flex-col items-center gap-10 border-white/5 hover:border-white/20 shadow-2xl group`}
            >
              <div className="w-24 h-24 bg-white/[0.02] border border-white/10 rounded-[3rem] flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-all duration-300">
                <a.icon size={44} className={a.color} />
              </div>
              <div>
                <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">{a.label}</h4>
                <p className="text-[14px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-relaxed px-12">{a.desc}</p>
              </div>
              <div className="mt-8 flex items-center gap-6 text-[12px] font-black text-teal-400 uppercase tracking-[0.6em] italic group-hover:gap-12 transition-all duration-700 shadow-teal-500/20">
                 INITIATE_SESSION <ArrowRight size={28} />
              </div>
            </motion.button>
          ))}
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function HeuristicStatCard({ icon: Icon, label, value, format, color }: { icon: any; label: string; value: any; format: 'number' | 'percent' | 'text'; color: string }) {
  const display = format === 'number' ? (typeof value === 'number' ? (value >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(value)) : '0') : format === 'percent' ? (typeof value === 'number' ? value.toFixed(1) + '%' : '0%') : String(value)

  return (
    <motion.div whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }}
       className={`${glassStyle} rounded-[5.5rem] p-16 flex flex-col items-center text-center group border-white/5 relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)]`}
    >
      <div className="absolute top-0 right-0 p-12 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"><Monitor size={150} /></div>
      <div className={`w-24 h-24 rounded-[3.5rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-12 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-300`}>
        <Icon size={44} className={color} />
      </div>
      <div className={`text-6xl font-black italic tabular-nums leading-none tracking-tighter mb-6 text-white group-hover:text-cyan-400 transition-colors duration-700 drop-shadow-2xl`}>{display.toUpperCase()}</div>
      <div className="text-[14px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">{label}</div>
      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-8 italic bg-white/5 px-6 py-2 rounded-full border border-white/5 group-hover:text-cyan-400 transition-colors">HEURISTIC_SIGNAL</div>
    </motion.div>
  )
}
