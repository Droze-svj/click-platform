'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, Calendar, BarChart3, RefreshCw, ArrowLeft, 
  Activity, Zap, Eye, Share2, MessageSquare, Target, 
  Cpu, Layers, Shield, Terminal, ArrowRight, Boxes,
  ChevronRight, Gauge, ActivitySquare, Monitor, Network
} from 'lucide-react'
import { apiGet } from '../../../../lib/api'
import { useAuth } from '../../../../hooks/useAuth'
import SpectralLoader from '../../../../components/SpectralLoader'
import ToastContainer from '../../../../components/ToastContainer'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface PerformanceData {
  date: string
  views: number
  likes: number
  shares: number
  comments: number
  posts_count: number
}

interface PerformanceResponse {
  success: boolean
  period: string
  performance_data: PerformanceData[]
}

export default function FluxForecastingMatrixPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pulseMode, setPulseMode] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(new Date())
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PerformanceData[]>([])
  const [period, setPeriod] = useState('30')

  const loadFluxPerformance = useCallback(async (isRefresh = false, triggerSync = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true)
      setError(null)

      const syncFlag = triggerSync ? '&sync=true' : ''
      const response = await apiGet<PerformanceResponse>(`/analytics/performance?period=${period}${syncFlag}`)
      setData(response.performance_data || [])
      if (triggerSync) setLastSynced(new Date())
    } catch (err: any) {
      setError(err.message || 'FLUX_SYNC_INTERFACE_FAILURE')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  // Removed Spectral Pulse: Sticking to manual/on-load sync as per Sovereign Protocol
  useEffect(() => {
    loadFluxPerformance()
  }, [loadFluxPerformance])

  const formatFmt = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getTotalResonance = () => {
    return data.reduce((acc, day) => ({
      views: acc.views + day.views,
      engage: acc.engage + (day.likes + day.shares + day.comments),
      posts: acc.posts + day.posts_count
    }), { views: 0, engage: 0, posts: 0 })
  }

  if (loading) return <SpectralLoader message="DECIPHERING_FLUX_TRAJECTORIES..." />;

  const stats = getTotalResonance()
  const engageRate = stats.views > 0 ? (stats.engage / stats.views * 100).toFixed(1) : '0'

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24 bg-[#020205]">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Activity size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Matrix Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard/analytics')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl outline-none focus:ring-2 focus:ring-emerald-500">
                <ArrowLeft size={32} />
              </button>
              <div className="w-20 h-20 bg-emerald-500/5 border border-emerald-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-100" />
                <TrendingUp size={40} className="text-emerald-400 relative z-10 group-hover:scale-125 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Gauge size={14} className="text-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.6em] text-emerald-400 italic leading-none">Flux Matrix v9.4.0</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <Activity size={12} className="text-emerald-400 animate-pulse" />
                       <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic leading-none">TRAJECTORY_SYNCED</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Flux Matrix</h1>
                 <p className="text-slate-400 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">Tracking engagement kinetic and resonance growth across temporal segments.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              {/* Pulse Toggle */}
              <div className="flex flex-col items-end gap-2 mr-4">
                 <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${pulseMode ? 'bg-emerald-500 animate-ping' : 'bg-slate-800'}`} />
                    <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase italic">Pulse_Mode</span>
                    <button 
                      onClick={() => setPulseMode(!pulseMode)}
                      title={pulseMode ? "Disable Pulse Sync" : "Enable Pulse Sync"}
                      aria-label="Toggle Spectral Pulse Mode"
                      className={`w-10 h-5 rounded-full p-1 transition-colors duration-500 ${pulseMode ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-black/40 border border-white/5'}`}
                    >
                       <div className={`w-3 h-3 rounded-full transition-transform duration-500 ${pulseMode ? 'translate-x-5 bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'translate-x-0 bg-slate-700'}`} />
                    </button>
                 </div>
                 {lastSynced && (
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic opacity-50">
                       Last_Sync: {lastSynced.toLocaleTimeString()}
                    </span>
                 )}
              </div>

              <div className="flex items-center p-2 rounded-[2.5rem] bg-black/40 border border-white/10 shadow-inner">
                {['7', '30', '90'].map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-8 py-3 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic transition-all duration-700 ${
                      period === p ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}_CYCLES
                  </button>
                ))}
              </div>
              <button 
                onClick={() => loadFluxPerformance(true, true)} 
                disabled={refreshing}
                className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.4em] italic rounded-[3rem] hover:bg-emerald-500 hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-6 group"
              >
                <RefreshCw size={24} className={`${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                {refreshing ? 'INTERPRETING...' : 'FORCE_SYNC'}
              </button>
           </div>
        </div>

        {/* Summary Kinetic HUD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
           <KineticCard label="Total Saturation" value={formatFmt(stats.views)} icon={Eye} color="text-emerald-400" trend="SPECTRAL_REACH" />
           <KineticCard label="Total Resonance" value={formatFmt(stats.engage)} icon={Zap} color="text-amber-400" trend="SIGNAL_AFFINITY" />
           <KineticCard label="Node Density" value={(stats.posts / parseInt(period)).toFixed(1)} icon={Boxes} color="text-indigo-400" trend="DAILY_PHANTOMS" />
           <KineticCard label="Kinetic Rate" value={`${engageRate}%`} icon={Activity} color="text-rose-400" trend="MOMENTUM_HZ" />
        </div>

        {/* Temporal Velocity Matrix */}
        <div className={`${glassStyle} rounded-[6rem] p-24 relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.6)]`}>
           <div className="absolute top-0 right-0 p-32 opacity-[0.015] pointer-events-none"><Terminal size={600} className="text-white" /></div>
           <div className="flex items-center gap-8 mb-20 relative z-10">
              <div className="p-6 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 shadow-2xl"><ActivitySquare size={40} className="text-emerald-400" /></div>
              <div>
                 <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Temporal Velocity</h2>
                 <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.5em] italic leading-none">High-fidelity resonance trajectory modeling across the current timeline.</p>
              </div>
           </div>

           <div className="space-y-12 relative z-10">
              {data.length > 0 ? (
                <div className="space-y-10">
                   {data.slice(-parseInt(period)).map((day, idx) => {
                     const engagement = day.likes + day.shares + day.comments
                     const maxEngage = Math.max(...data.map(d => d.likes + d.shares + d.comments))
                     const maxViews = Math.max(...data.map(d => d.views))
                     const engWidth = maxEngage > 0 ? (engagement / maxEngage) * 100 : 0
                     const viewWidth = maxViews > 0 ? (day.views / maxViews) * 100 : 0

                     return (
                       <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                         key={day.date} className="flex items-center gap-12 group"
                       >
                          <div className="w-48 text-[12px] font-black text-slate-400 uppercase tracking-widest italic leading-none group-hover:text-emerald-400 transition-colors">
                             {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                          </div>
                          <div className="flex-1 space-y-3">
                             <div className="flex items-center gap-6">
                                <div className="h-2 bg-black/60 rounded-full flex-1 overflow-hidden shadow-inner border border-white/5">
                                   <div className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]" style={{ width: `${viewWidth}%` }} />
                                </div>
                                <span className="w-24 text-right text-[11px] font-black text-white uppercase italic tracking-widest tabular-nums">{formatFmt(day.views)}</span>
                             </div>
                             <div className="flex items-center gap-6">
                                <div className="h-2 bg-black/60 rounded-full flex-1 overflow-hidden shadow-inner border border-white/5">
                                   <div className="h-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]" style={{ width: `${engWidth}%` }} />
                                </div>
                                <span className="w-24 text-right text-[11px] font-black text-amber-500 uppercase italic tracking-widest tabular-nums">{formatFmt(engagement)}</span>
                             </div>
                          </div>
                       </motion.div>
                     )
                   })}
                </div>
              ) : (
                <div className="py-48 flex flex-col items-center justify-center text-center space-y-8 opacity-10">
                   <Target size={120} className="text-white animate-pulse" />
                   <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">NULL_FLUX_SIGNATURE</h3>
                   <p className="text-[14px] font-black text-slate-400 uppercase tracking-[0.8em] italic">No resonance data manifested in this temporal segment.</p>
                </div>
              )}
           </div>
        </div>

        {/* Resonance Ledger */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 border-white/5 shadow-2xl`}>
           <div className="px-20 py-12 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="w-12 h-12 rounded-[1.5rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><Monitor size={20} className="text-emerald-400" /></div>
                 <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Resonance Ledger</h3>
              </div>
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] italic bg-black/40 px-6 py-2 rounded-full border border-white/5">
                 LITERAL_SIGNAL_LOGS_V9
              </div>
           </div>
           
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-black/60 border-b border-white/5">
                    <tr>
                       {['Temporal_Coord', 'Saturation', 'Affinities', 'Signal_Resonance', 'Active_Nodes', 'Kinetic_Flux'].map(h => (
                         <th key={h} className="px-12 py-8 text-[12px] font-black text-slate-400 uppercase tracking-widest italic">{h}</th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/[0.02] bg-white/[0.01]">
                    {data.slice().reverse().map((day, idx) => {
                       const engage = day.likes + day.shares + day.comments
                       const rate = day.views > 0 ? (engage / day.views * 100).toFixed(1) : '0'
                       return (
                         <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                           key={day.date} className="group hover:bg-white/[0.04] transition-all duration-700 font-bold"
                         >
                            <td className="px-12 py-8 whitespace-nowrap text-[14px] text-white italic font-black uppercase tracking-widest">
                               {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                            </td>
                            <td className="px-12 py-8 text-emerald-400 font-black italic tracking-tighter text-xl tabular-nums">{formatFmt(day.views)}</td>
                            <td className="px-12 py-8 text-amber-400 font-black italic tracking-widest text-[14px]">
                               {formatFmt(day.likes)} L / {formatFmt(day.shares)} S
                            </td>
                            <td className="px-12 py-8 text-white font-black italic tracking-tighter text-xl tabular-nums">{formatFmt(engage)}</td>
                            <td className="px-12 py-8 text-indigo-400 font-black italic tracking-widest text-[14px]">{day.posts_count} PHANTOMS</td>
                            <td className="px-12 py-8">
                               <span className="px-6 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xl font-black italic tabular-nums tracking-tighter">
                                  {rate}%
                               </span>
                            </td>
                         </motion.tr>
                       )
                    })}
                 </tbody>
              </table>
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function KineticCard({ label, value, icon: Icon, color, trend }: { label: string; value: string; icon: any; color: string; trend: string }) {
  return (
    <motion.div whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }}
      className={`${glassStyle} p-12 rounded-[5rem] flex flex-col items-center text-center group border-white/5 relative overflow-hidden`}
    >
       <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"><Boxes size={120} className="text-white" /></div>
       <div className={`w-24 h-24 rounded-[3rem] bg-white/[0.02] border border-white/10 flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-12 group-hover:scale-110 transition-all duration-700`}>
          <Icon size={44} className={color} />
       </div>
       <div className="text-7xl font-black text-white italic tracking-tighter tabular-nums leading-none mb-6 drop-shadow-2xl">{value}</div>
       <div className="text-[14px] text-slate-400 font-black uppercase tracking-[0.4em] italic leading-none">{label}</div>
       <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-6 italic bg-white/5 px-6 py-2 rounded-full border border-white/5 group-hover:text-emerald-400 transition-colors">
          {trend}
       </div>
    </motion.div>
  )
}
