'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPut, apiDelete } from '../../../lib/api'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import NotificationPreferences from '../../../components/NotificationPreferences'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../hooks/useAuth'
import { useSocket } from '../../../hooks/useSocket'
import { 
  Search, Settings, CheckCircle2, Trash2, Activity, Zap, 
  Wifi, Radio, Terminal, Sliders, Eye, Archive, 
  ShieldAlert, ArrowLeft, ChevronRight, Check, X,
  AlertTriangle, Info, Bell, Trash, RefreshCw, Cpu,
  Fingerprint, Compass, Boxes, Layout, Layers, Timer, Box, ArrowRight,
  ActivitySquare, Signal, Ghost, Network, Target, Wind, Sparkles, MonitorCheck,
  ZapOff, Lock, Unlock, ShieldCheck, Database
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface Notification {
  _id: string; type: 'info' | 'success' | 'warning' | 'error';
  title: string; message?: string; read: boolean; createdAt: string;
  link?: string | null; category?: string | null; aiSummary?: string | null; suggestion?: string | null;
}

interface LiveStatusItem {
  id: string; title: string; status: string; dueDate?: string | null; type: string;
}

interface LiveStatusJob {
  id: string; title: string; status: string; type: 'job'; queue?: string;
}

interface LiveStatusState {
  tasks: LiveStatusItem[]; jobs: LiveStatusJob[]; lastUpdated?: string | null;
}

const CATEGORIES = ['TASK_OPS', 'PROJECT_VINE', 'CONTENT_FORGE', 'APPROVAL_NODE', 'MENTION_SIGNAL', 'SYSTEM_CORE', 'WORKFLOW_LATTICE'] as const

export default function SignalDiffusionLedgerPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { socket } = useSocket(user?.id ?? null)
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [category, setCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set())
  const [liveStatus, setLiveStatus] = useState<LiveStatusState>({ tasks: [], jobs: [], lastUpdated: null })
  const [refreshing, setRefreshing] = useState(false)

  const loadSignals = useCallback(async () => {
    setRefreshing(true)
    try {
      const u = filter === 'unread' ? '&unread=true' : filter === 'read' ? '&read=true' : ''
      const c = category ? `&category=${category}` : ''
      const res: any = await apiGet(`/notifications?limit=100${u}${c}`)
      const data = res?.data || res
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : [])
      setUnreadCount(data?.unreadCount || 0)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, category])

  const loadLiveStatus = useCallback(async () => {
    try {
      const res: any = await apiGet('/notifications/live-status')
      const data = res?.data || res
      setLiveStatus({
        tasks: data?.tasks || [],
        jobs: data?.jobs || [],
        lastUpdated: data?.lastUpdated || null
      })
    } catch {
      setLiveStatus({ tasks: [], jobs: [], lastUpdated: null })
    }
  }, [])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadSignals()
    loadLiveStatus()
  }, [user, loadSignals, loadLiveStatus, router])

  useEffect(() => {
    if (socket) {
      socket.on('notification', () => loadSignals())
      socket.on('live_status:update', () => loadLiveStatus())
      return () => {
        socket.off('notification')
        socket.off('live_status:update')
      }
    }
  }, [socket, loadSignals, loadLiveStatus])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <ShieldCheck className="text-emerald-400" size={32} />
      case 'warning': return <AlertTriangle className="text-amber-400" size={32} />
      case 'error': return <ShieldAlert className="text-rose-400" size={32} />
      default: return <Signal className="text-indigo-400" size={32} />
    }
  }

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'success': return 'border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_50px_rgba(16,185,129,0.1)]'
      case 'warning': return 'border-amber-500/20 bg-amber-500/5 shadow-[0_0_50px_rgba(245,158,11,0.1)]'
      case 'error': return 'border-rose-500/20 bg-rose-500/5 shadow-[0_0_80px_rgba(225,29,72,0.2)]'
      default: return 'border-indigo-500/20 bg-indigo-500/5 shadow-[0_0_50px_rgba(99,102,241,0.1)]'
    }
  }

  const filteredNotifications = notifications.filter(n => {
    const s = searchQuery === '' || n.title.toLowerCase().includes(searchQuery.toLowerCase()) || (n.message && n.message.toLowerCase().includes(searchQuery.toLowerCase()))
    return s
  })

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Radio size={80} className="text-indigo-500 animate-pulse mb-12 drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
        <span className="text-[16px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Decoding Signal Spectrum...</span>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Bell size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Diffusion Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Bell size={48} className="text-indigo-400 relative z-10 group-hover:rotate-12 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Signal Feed v12.8.4</span>
                   </div>
                   {unreadCount > 0 && (
                      <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,1)]" />
                          <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase italic leading-none">{unreadCount} ACTIVE_SIGNALS_DETECTED</span>
                      </div>
                   )}
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Signal Diffusion</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">High-priority telemetry intercepts and mission-critical resonance triggers.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={loadSignals} className={`${glassStyle} w-20 h-20 rounded-[2.2rem] flex items-center justify-center group shadow-2xl active:scale-95 border-none bg-white/[0.02]`}>
                 <RefreshCw size={36} className={`text-slate-800 group-hover:text-indigo-400 transition-colors ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-1000'}`} />
              </button>
              <button onClick={() => setShowPreferences(!showPreferences)} 
                className={`px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_40px_100px_rgba(0,0,0,0.4)] transition-all duration-1000 flex items-center gap-8 italic border-2 active:scale-95 ${showPreferences ? 'bg-white text-black border-white' : 'bg-white/[0.02] border-white/10 text-slate-800 hover:text-white'}`}
              >
                <Sliders size={28} className={showPreferences ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} /> SENSOR_FUSION_CALIBRATION
              </button>
           </div>
        </header>

        {/* Mission Telemetry HUD (Live Tracking) */}
        <AnimatePresence>
           {(liveStatus.tasks.length > 0 || liveStatus.jobs.length > 0) && (
             <motion.section initial={{ opacity: 0, scale: 0.95, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
               className={`${glassStyle} p-20 rounded-[6rem] border-indigo-500/30 shadow-[0_100px_250px_rgba(0,0,0,0.8)] relative overflow-hidden z-20 bg-black/40`}
             >
                <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none border-none group-hover:rotate-6 transition-transform"><MonitorCheck size={600} className="text-white" /></div>
                <div className="flex flex-col md:flex-row items-center justify-between mb-20 relative z-10 border-b border-white/5 pb-16 gap-10">
                   <div className="flex items-center gap-12">
                      <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.3)] animate-pulse">
                         <ActivitySquare size={48} className="text-indigo-400" />
                      </div>
                      <div>
                         <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Mission Telemetry</h2>
                         <p className="text-[14px] text-slate-800 font-black uppercase tracking-[0.6em] italic leading-none">Real-time kinetic execution downlink_v14.2</p>
                      </div>
                   </div>
                   {liveStatus.lastUpdated && <div className="px-10 py-5 rounded-[2.5rem] bg-black/60 border-2 border-white/5 text-[12px] font-black text-indigo-400 uppercase tracking-widest italic shadow-inner">LAST_SIGNAL_BURST: {new Date(liveStatus.lastUpdated).toLocaleTimeString().toUpperCase()}</div>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
                   <div className="space-y-12">
                      <div className="flex items-center gap-6 pl-10 border-l-[6px] border-indigo-500/40"><span className="text-[16px] font-black text-indigo-400 uppercase tracking-[1em] italic leading-none">ACTIVE_OPERATIONS_RESONANCE</span></div>
                      <div className="space-y-8">
                         {liveStatus.tasks.map(t => (
                            <motion.div whileHover={{ x: 30, scale: 1.02 }} key={t.id} className="flex items-center justify-between p-12 rounded-[4rem] bg-black/60 border-2 border-white/5 hover:border-indigo-500/50 hover:bg-white/[0.04] transition-all duration-1000 group shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
                               <div className="flex items-center gap-10">
                                  <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/10 transition-colors duration-1000"><Zap size={32} className="text-amber-500 animate-pulse" /></div>
                                  <div>
                                     <p className="text-3xl font-black text-white uppercase italic tracking-tighter group-hover:text-indigo-400 transition-colors duration-1000 leading-none mb-3">{t.title}</p>
                                     <div className="flex items-center gap-4">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] font-mono leading-none">{t.status.toUpperCase()} // DIRECTIVE_LOCKED</span>
                                     </div>
                                  </div>
                               </div>
                               <button onClick={() => router.push(`/dashboard/tasks?open=${t.id}`)} className="w-16 h-16 rounded-[2.2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-1000 shadow-2xl active:scale-95 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/20"><Eye size={28}/></button>
                            </motion.div>
                         ))}
                         {liveStatus.tasks.length === 0 && <div className="p-16 border-4 border-dashed border-white/5 rounded-[4.5rem] text-center"><Ghost size={48} className="text-slate-950 mx-auto mb-6 opacity-20" /><p className="text-[14px] font-black text-slate-950 uppercase tracking-[0.8em] italic">NO_KINETIC_TRAJECTORIES_ARMED</p></div>}
                      </div>
                   </div>
                   <div className="space-y-12">
                      <div className="flex items-center gap-6 pl-10 border-l-[6px] border-purple-500/40"><span className="text-[16px] font-black text-purple-400 uppercase tracking-[1em] italic leading-none">BACKGROUND_ASYNC_CYCLES</span></div>
                      <div className="space-y-8">
                         {liveStatus.jobs.map(j => (
                            <motion.div whileHover={{ x: 30, scale: 1.02 }} key={j.id} className="flex items-center justify-between p-12 rounded-[4rem] bg-black/60 border-2 border-white/5 hover:border-purple-500/50 hover:bg-white/[0.04] transition-all duration-1000 group shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
                               <div className="flex items-center gap-10">
                                  <div className="w-16 h-16 rounded-[2rem] bg-purple-500/5 border-2 border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/10 transition-colors duration-1000"><RefreshCw size={32} className="text-purple-500 animate-spin" style={{ animationDuration: '6s' }} /></div>
                                  <div>
                                     <p className="text-3xl font-black text-white uppercase italic tracking-tighter group-hover:text-purple-400 transition-colors duration-1000 leading-none mb-3">{j.title}</p>
                                     <div className="flex items-center gap-4">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                                        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] font-mono leading-none">{j.status.toUpperCase()} // QUEUE::{j.queue?.toUpperCase()}</span>
                                     </div>
                                  </div>
                               </div>
                               <button onClick={() => router.push('/dashboard/jobs')} className="w-16 h-16 rounded-[2.2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-1000 shadow-2xl active:scale-95 group-hover:border-purple-500/50 group-hover:bg-purple-500/20"><Cpu size={28}/></button>
                            </motion.div>
                         ))}
                         {liveStatus.jobs.length === 0 && <div className="p-16 border-4 border-dashed border-white/5 rounded-[4.5rem] text-center"><Wind size={48} className="text-slate-950 mx-auto mb-6 opacity-20" /><p className="text-[14px] font-black text-slate-950 uppercase tracking-[0.8em] italic">ASYNC_LATTICE_QUIESCENT</p></div>}
                      </div>
                   </div>
                </div>
             </motion.section>
           )}
        </AnimatePresence>

        {/* Preferences Injector */}
        <AnimatePresence>
           {showPreferences && (
             <motion.div initial={{ opacity: 0, height: 0, y: -20 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -20 }} className="relative z-30">
                <div className={`${glassStyle} p-20 rounded-[6rem] border-white/10 shadow-[0_80px_200px_rgba(0,0,0,0.6)] bg-black/60`}>
                   <NotificationPreferences onUpdate={loadSignals} />
                </div>
             </motion.div>
           )}
        </AnimatePresence>

        {/* Global Signal Matrix (Main Feed) */}
        <div className={`${glassStyle} rounded-[7rem] p-24 border-white/5 relative overflow-hidden flex flex-col min-h-[1200px] shadow-[0_100px_300px_rgba(0,0,0,0.9)] bg-black/40`}>
           <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none group-hover/matrix:scale-110 transition-transform duration-1000 group/matrix"><Terminal size={800} className="text-white" /></div>
           
           <header className="flex flex-col xl:flex-row items-center justify-between gap-20 mb-32 relative z-10 border-b border-white/5 pb-20">
              <div className="flex items-center gap-12 flex-1 w-full relative group/search">
                 <div className="absolute left-12 top-1/2 -translate-y-1/2 flex items-center gap-6 pointer-events-none">
                    <Search className="text-slate-950 group-focus-within/search:text-indigo-400 transition-all duration-1000" size={40} />
                    <div className="w-1 h-10 bg-white/5 rounded-full" />
                 </div>
                 <input type="text" placeholder="SCAN_GLOBAL_SIGNAL_MATRIX..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-black/80 border-4 border-white/5 rounded-[5.5rem] pl-32 pr-16 py-12 text-5xl font-black text-white uppercase italic tracking-tighter focus:outline-none focus:border-indigo-500/50 transition-all duration-1000 shadow-inner placeholder:text-slate-950 font-mono"
                 />
              </div>
              
              <nav className="flex items-center gap-8 bg-black/60 p-6 rounded-[4.5rem] border-2 border-white/5 shadow-inner">
                 {(['all', 'unread', 'read'] as const).map(f => (
                   <button key={f} onClick={() => setFilter(f)}
                     className={`px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] transition-all duration-1000 italic ${filter === f ? 'bg-white text-black shadow-2xl scale-110' : 'bg-transparent text-slate-800 hover:text-white hover:bg-white/5'}`}
                   >
                     {f.toUpperCase()}
                   </button>
                 ))}
                 <div className="w-[2px] h-20 bg-white/10 mx-6 rounded-full" />
                 <div className="relative group/sector">
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                      className="appearance-none bg-black/80 border-2 border-white/10 px-20 py-8 rounded-[4rem] text-[14px] font-black uppercase tracking-[0.8em] text-indigo-400 focus:outline-none cursor-pointer italic pr-32 shadow-inner hover:border-indigo-500/50 transition-all"
                    >
                      <option value="">ALL_SIGNAL_SECTORS</option>
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#020205]">{c}</option>)}
                    </select>
                    <ChevronRight size={32} className="absolute right-12 top-1/2 -translate-y-1/2 text-indigo-400 rotate-90 pointer-events-none opacity-40 group-hover/sector:opacity-100 transition-opacity" />
                 </div>
              </nav>
           </header>

           {/* Batch Command Terminal */}
           <AnimatePresence>
             {selectedNotifications.size > 0 && (
                <motion.div initial={{ y: 50, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.9 }}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-6xl p-10 rounded-[6rem] bg-indigo-500/20 border-4 border-indigo-500/40 shadow-[0_100px_300px_rgba(0,0,0,1)] ring-[20px] ring-black/60 backdrop-blur-3xl z-[100] flex items-center justify-between"
                >
                   <div className="flex items-center gap-16 px-16 border-r-4 border-white/10 h-28">
                      <div className="relative">
                         <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-80 animate-pulse" />
                         <div className="relative w-28 h-28 bg-white text-black rounded-[4rem] flex items-center justify-center font-black text-5xl shadow-[0_0_80px_rgba(255,255,255,0.4)] italic scale-125 border-8 border-black/40">{selectedNotifications.size}</div>
                      </div>
                      <div className="space-y-4">
                         <p className="text-2xl font-black text-white uppercase tracking-[0.5em] leading-none">BURSTS_BUFFERED</p>
                         <div className="flex items-center gap-4">
                            <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                            <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[1em] italic leading-none">MASS_ACK_PROTOCOL_READY</p>
                         </div>
                      </div>
                   </div>
                   <div className="flex-1 flex items-center justify-center gap-12 px-16">
                      <button onClick={async () => { setBusy(true); await Promise.all(Array.from(selectedNotifications).map(id => apiPut(`/notifications/${id}/read`, {}))); await loadSignals(); setSelectedNotifications(new Set()); setBusy(false) }}
                        className="px-20 py-10 bg-white text-black rounded-[5rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic shadow-2xl flex items-center gap-8 border-none scale-105 active:scale-95 group/ack"
                      >
                         <CheckCircle2 size={40} className="group-hover/ack:scale-125 transition-transform" /> SYNCHRONIZE_SIGNALS
                      </button>
                      <button onClick={async () => { if (!confirm('CRITICAL: PURGE_SELECTED_TELEMETRY?_THIS_ACTION_IS_PERMANENT.')) return; setBusy(true); await Promise.all(Array.from(selectedNotifications).map(id => apiDelete(`/notifications/${id}`))); await loadSignals(); setSelectedNotifications(new Set()); setBusy(false) }}
                        className="px-20 py-10 bg-rose-600 text-white rounded-[5rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-rose-500 transition-all duration-1000 italic shadow-2xl flex items-center gap-8 border-none scale-105 active:scale-95 group/purge"
                      >
                         <Trash2 size={40} className="group-hover/purge:rotate-12 transition-transform" /> PURGE_LEDGER_DATA
                      </button>
                   </div>
                   <button onClick={() => setSelectedNotifications(new Set())} className="w-24 h-24 rounded-[3rem] bg-white/5 border-2 border-white/10 text-slate-950 hover:text-white hover:bg-rose-500/20 transition-all duration-1000 flex items-center justify-center border-none mr-12 hover:scale-110 active:scale-90 shadow-2xl"><X size={48}/></button>
                </motion.div>
             )}
           </AnimatePresence>

           <div className="flex-1 overflow-y-auto space-y-12 pr-12 custom-scrollbar relative z-10">
              {filteredNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-[0.05] gap-20 py-80">
                   <div className="w-80 h-80 bg-white/5 rounded-[12rem] border-4 border-white/5 flex items-center justify-center animate-pulse shadow-inner"><Bell size={160} className="text-white opacity-40" /></div>
                   <div className="space-y-10 max-w-4xl">
                      <h3 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-6">Signal Spectrum Void</h3>
                      <p className="text-3xl font-black text-slate-800 uppercase tracking-[1em] italic leading-relaxed">No active resonance triggered in the current temporal resolution.</p>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-12">
                   {filteredNotifications.map((n, idx) => (
                     <motion.div layout key={n._id} initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 1 }}
                       className={`group relative p-16 rounded-[6rem] border-2 transition-all duration-1000 overflow-hidden shadow-[0_60px_150px_rgba(0,0,0,0.6)] ${
                         !n.read ? 'bg-indigo-500/[0.04] border-indigo-500/20 shadow-[0_0_150px_rgba(99,102,241,0.08)] ring-4 ring-indigo-500/10' : 'bg-black/60 border-white/[0.03] hover:border-white/10 hover:bg-white/[0.02]'
                       } ${selectedNotifications.has(n._id) ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_200px_rgba(99,102,241,0.3)] ring-[10px] ring-indigo-500/10' : ''}`}
                     >
                        <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-1000 pointer-events-none scale-150 group-hover:rotate-12"><Radio size={400} className="text-white" /></div>
                        
                        <div className="flex items-start gap-16 relative z-10">
                           <div className="pt-8">
                              <input type="checkbox" checked={selectedNotifications.has(n._id)}
                                onChange={() => setSelectedNotifications(prev => { const nS = new Set(prev); nS.has(n._id) ? nS.delete(n._id) : nS.add(n._id); return nS })}
                                className="w-14 h-14 rounded-[1.8rem] bg-black/80 border-2 border-white/10 text-indigo-500 focus:ring-16 focus:ring-indigo-500/20 cursor-pointer appearance-none checked:bg-indigo-500 checked:border-white transition-all shadow-inner active:scale-90"
                              />
                           </div>
                           
                           <div className={`w-32 h-32 rounded-[3.5rem] flex items-center justify-center shadow-inner flex-shrink-0 border-2 group-hover:scale-110 transition-transform duration-1000 relative overflow-hidden ${getTypeStyle(n.type)}`}>
                               <div className="absolute inset-0 bg-white/[0.02] group-hover:opacity-100 opacity-0 transition-opacity" />
                               {getTypeIcon(n.type)}
                           </div>

                           <div className="flex-1 min-w-0 space-y-10 group/content">
                              <div className="flex items-center justify-between border-b border-white/5 pb-8 mb-4">
                                 <div className="flex items-center gap-10">
                                    {n.category && <span className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.8em] italic bg-indigo-500/10 px-10 py-3 rounded-[2.5rem] border-2 border-indigo-500/20 shadow-inner group-hover:bg-indigo-500/20 transition-all duration-1000">{n.category.replace('_', ' ')}</span>}
                                    <div className="flex items-center gap-4 text-slate-800">
                                       <Timer size={16} className="text-slate-950" />
                                       <span className="text-[12px] font-black uppercase tracking-[0.4em] italic font-mono">{new Date(n.createdAt).toLocaleString().toUpperCase()}</span>
                                    </div>
                                 </div>
                                 {!n.read && <div className="flex items-center gap-4 px-8 py-3 bg-indigo-500/10 border-2 border-indigo-500/30 rounded-full shadow-[0_0_40px_rgba(99,102,241,0.3)] animate-pulse"><span className="w-3 h-3 bg-indigo-500 rounded-full" /><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">ACTIVE_RESONANCE</span></div>}
                              </div>

                              <div className="space-y-10">
                                 <h3 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none mb-10 group-hover:text-indigo-400 transition-colors duration-1000 drop-shadow-2xl">{n.title}</h3>
                                 <p className="text-slate-400 font-black text-3xl uppercase tracking-tighter italic leading-tight max-w-5xl opacity-80 group-hover:opacity-100 transition-opacity duration-1000 group-hover:text-slate-200">{n.message || n.aiSummary || 'NULL_SIGNAL_PAYLOAD'}</p>
                                 
                                 <AnimatePresence>
                                   {n.suggestion && (
                                     <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} 
                                       className="mt-12 flex items-start gap-10 p-10 rounded-[4rem] bg-indigo-500/10 border-2 border-indigo-500/20 w-fit shadow-2xl group-hover:border-indigo-500/50 transition-all duration-1000 relative overflow-hidden"
                                     >
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent animate-shimmer" />
                                        <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/20 flex items-center justify-center relative z-10"><Zap size={36} className="text-indigo-400 animate-pulse" /></div>
                                        <div className="relative z-10 pr-10">
                                           <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[1em] italic mb-3">DIRECTIVE_RESYNTHESIS_ADVICE</p>
                                           <p className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">{n.suggestion}</p>
                                        </div>
                                     </motion.div>
                                   )}
                                 </AnimatePresence>
                              </div>

                              <footer className="flex items-center gap-16 pt-12 border-t border-white/5 bg-white/[0.01] -mx-16 -mb-16 px-16 py-12 mt-12 transition-colors duration-1000 group-hover:bg-white/[0.03]">
                                 {n.link && (
                                   <button type="button" onClick={() => { if (!n.read) apiPut(`/notifications/${n._id}/read`, {}); router.push(n.link!) }}
                                     className="text-[18px] font-black text-indigo-400 hover:text-white uppercase tracking-[0.8em] flex items-center gap-10 transition-all group/link italic border-none outline-none group-link:scale-110"
                                   >
                                     <Compass className="group-hover/link:rotate-180 transition-transform duration-1000" size={32} /> ACCESS_ORIGIN_NODE <ArrowRight size={32} className="group-hover/link:translate-x-6 transition-all duration-700" />
                                   </button>
                                 )}
                                 <div className="flex items-center gap-10 ml-auto opacity-0 group-hover:opacity-100 transition-all duration-1000 scale-90 group-hover:scale-100">
                                    {!n.read && (
                                      <button onClick={() => { apiPut(`/notifications/${n._id}/read`, {}); loadSignals() }} 
                                        className="px-16 py-8 bg-indigo-500 text-white rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] italic shadow-2xl hover:bg-white hover:text-indigo-600 transition-all duration-1000 border-none scale-105 active:scale-95"
                                      >
                                        RESONANCE_ACK
                                      </button>
                                    )}
                                    <button onClick={() => { if (confirm('PURGE_PERMANENT_SIGNAL?')) { apiDelete(`/notifications/${n._id}`); loadSignals() } }} 
                                      className="w-20 h-20 bg-rose-600/10 border-2 border-rose-500/20 text-rose-950 hover:text-rose-400 hover:bg-rose-600/20 rounded-[2.5rem] flex items-center justify-center transition-all duration-700 active:scale-75 shadow-2xl border-none"
                                    >
                                      <Trash2 size={36}/>
                                    </button>
                                 </div>
                              </footer>
                           </div>
                        </div>
                     </motion.div>
                   ))}
                </div>
              )}
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
          select { -webkit-appearance: none; appearance: none; cursor: pointer; }
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-shimmer { animation: shimmer 3s infinite; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
