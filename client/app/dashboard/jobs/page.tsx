'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import JobDetailsModal from '../../../components/JobDetailsModal'
import { 
  Search, Filter, Download, RefreshCw, Activity, 
  Cpu, Zap, Shield, Target, Radio, Terminal, 
  Fingerprint, Compass, Boxes, Layout, Layers, 
  Timer, Box, Monitor, ChevronRight, X, Eye, 
  CheckCircle2, AlertTriangle, Archive, Trash2, ArrowLeft,
  Wind, Ghost, ActivitySquare, Scan, Binary, Orbit,
  CpuIcon, Network, Sparkles, Database, Signal,
  ShieldCheck, ShieldAlert, ZapOff, Link2, GitBranch
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Job {
  id: string; name: string; state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number; attemptsMade: number; failedReason?: string;
  processedOn?: Date; finishedOn?: Date; createdAt: Date; queue?: string;
}

interface QueueStats {
  waiting: number; active: number; completed: number; failed: number; delayed: number; total: number;
}

interface QueueMetrics {
  total: number; successful: number; failed: number; averageDuration: number;
  averageMemory: number; totalCost: number; totalRetries: number;
}

export default function BackgroundFluxTerminalPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [userJobs, setUserJobs] = useState<{ active: Job[]; completed: Job[]; failed: Job[] }>({ active: [], completed: [], failed: [] })
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [userMetrics, setUserMetrics] = useState<QueueMetrics | null>(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState<{ id: string; queue: string } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadLattice = useCallback(async () => {
    setRefreshing(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return router.push('/login')
      const headers = { Authorization: `Bearer ${token}` }

      const [jobsRes, metricsRes] = await Promise.all([
        axios.get(`${API_URL}/jobs/user`, { headers }),
        axios.get(`${API_URL}/jobs/metrics/user?timeRange=${timeRange}`, { headers }).catch(() => ({ data: { data: null } }))
      ])

      const jobsData = jobsRes.data.data || { active: [], completed: [], failed: [] }
      setUserJobs(jobsData)
      setUserMetrics(metricsRes.data.data)

      const isAdmin = !!user && (((user as any).role === 'admin') || !!(user as any).isAdmin)
      if (isAdmin) {
        const statsRes = await axios.get(`${API_URL}/jobs/dashboard/stats`, { headers }).catch(() => ({ data: { data: {} } }))
        setQueueStats(statsRes.data.data || {})
      }
    } catch {
      // SILENT_STASIS
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, router, timeRange])

  useEffect(() => {
    loadLattice()
    if (autoRefresh) {
      const interval = setInterval(loadLattice, 10000)
      return () => clearInterval(interval)
    }
  }, [loadLattice, autoRefresh])

  const handleCancel = async (id: string) => {
    if (!confirm('CRITICAL_INTERRUPT: ABORT_ASYNCHRONOUS_RESONANCE_CYCLE?_THIS_MAY_CAUSE_BUFFER_DIFFRACTION.')) return
    try {
      await axios.post(`${API_URL}/jobs/user/${id}/cancel`, {})
      loadLattice()
    } catch {
      // DIFFRACTION
    }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Activity size={80} className="text-blue-500 animate-pulse mb-12 drop-shadow-[0_0_40px_rgba(59,130,246,0.5)]" />
        <span className="text-[16px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Calibrating Flux Receivers...</span>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <CpuIcon size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Flux Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-blue-500/5 border border-blue-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-100" />
                <Activity size={48} className="text-blue-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-blue-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-400 italic leading-none">Flux Matrix v16.2.1</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                       <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,1)] animate-pulse" />
                       <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase italic leading-none">ASYNC_THROTTLE_BYPASS_ACTIVE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Flux Terminal</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Real-time background execution telemetry and neural background load monitoring.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={loadLattice} className={`${glassStyle} w-20 h-20 rounded-[2.2rem] flex items-center justify-center group active:scale-95 border-none bg-white/[0.02] shadow-2xl`}>
                 <RefreshCw size={36} className={`text-slate-800 group-hover:text-blue-400 transition-colors ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-1000'}`} />
              </button>
              <button onClick={() => setAutoRefresh(!autoRefresh)} 
                className={`px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_150px_rgba(0,0,0,0.6)] transition-all duration-1000 flex items-center gap-8 italic border-2 active:scale-95 ${autoRefresh ? 'bg-white text-black border-white' : 'bg-white/[0.02] border-white/10 text-slate-800 hover:text-white'}`}
              >
                <Timer size={32} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} /> {autoRefresh ? 'LIVE_RESONANCE_STREAM' : 'STATIC_OSCILLATION_MODE'}
              </button>
           </div>
        </header>

        {/* Neural Flux Metrics HUD */}
        {userMetrics && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
             <MetricHUD title="ACCUMULATED_CYCLES" value={userMetrics.total} icon={<Layers size={40}/>} color="blue" subtitle="Total lattice executions" />
             <MetricHUD title="SUCCESS_RESONANCE" value={`${((userMetrics.successful / Math.max(userMetrics.total, 1)) * 100).toFixed(1)}%`} icon={<ShieldCheck size={40}/>} color="emerald" subtitle="Optimal phase alignment" />
             <MetricHUD title="FLUX_DIFFRACTIONS" value={userMetrics.failed} icon={<ShieldAlert size={40}/>} color="rose" subtitle="Anomalous termination count" />
             <MetricHUD title="CUMULATIVE_COMPUTE" value={`$${userMetrics.totalCost.toFixed(4)}`} icon={<Zap size={40}/>} color="amber" subtitle="Resource drain coefficient" />
          </section>
        )}

        {/* Kinetic Execution Matrix */}
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-16 relative z-10">
           {/* Command Terminal (Filters) */}
           <div className="xl:col-span-12">
              <div className={`${glassStyle} p-10 rounded-[5rem] flex flex-col md:flex-row items-center gap-12 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.5)] bg-black/40`}>
                 <div className="flex-1 relative group w-full">
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-6 pointer-events-none">
                       <Search className="text-slate-950 group-focus-within:text-blue-400 transition-all duration-1000" size={32} />
                       <div className="w-1 h-8 bg-white/5 rounded-full" />
                    </div>
                    <input type="text" placeholder="ENTER_ASYNC_CYCLE_SIGNATURE_QUERY..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                      className="w-full bg-black/60 border-2 border-white/5 rounded-[4rem] pl-24 pr-12 py-8 text-4xl font-black text-white italic focus:outline-none focus:border-blue-500/50 transition-all duration-1000 uppercase placeholder:text-slate-950 tracking-tighter" 
                    />
                 </div>
                 <nav className="flex items-center gap-6 bg-black/60 p-4 rounded-[3rem] border-2 border-white/5">
                    {['1h', '24h', '7d', '30d'].map(r => (
                       <button key={r} onClick={() => setTimeRange(r)} 
                         className={`px-12 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] italic transition-all duration-1000 ${timeRange === r ? 'bg-white text-black shadow-[0_20px_60px_rgba(255,255,255,0.2)] scale-110' : 'bg-transparent text-slate-800 hover:text-white hover:bg-white/5'}`}
                       >
                         {r.toUpperCase()}
                       </button>
                    ))}
                 </nav>
              </div>
           </div>

           {/* Active Execution Streams */}
           <div className="xl:col-span-7 space-y-16">
              <SectionHeader title="KINETIC_FLOW_STREAMS" subtitle="Real-time asynchronous execution resonance" icon={<Zap className="text-amber-500 animate-pulse"/>} />
              <div className="grid grid-cols-1 gap-10">
                 {userJobs.active.length === 0 ? (
                   <EmptyHUD text="NO_KINETIC_FLUX_DETECTED_IN_SPECTRUM" icon={<Ghost size={80}/>} />
                 ) : (
                   userJobs.active.filter(j => searchQuery === '' || j.name.toLowerCase().includes(searchQuery.toLowerCase())).map((j, idx) => (
                     <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} index={idx} />
                   ))
                 )}
              </div>

              <SectionHeader title="STASIS_CYCLE_ARCHIVE" subtitle="Manifested background operations historically logged" icon={<Archive className="text-emerald-500"/>} />
              <div className="grid grid-cols-1 gap-8">
                 {userJobs.completed.length === 0 ? (
                    <EmptyHUD text="STASIS_ARCHIVE_VACUUM" icon={<Wind size={80}/>} />
                 ) : (
                    userJobs.completed.filter(j => searchQuery === '' || j.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 15).map((j, idx) => (
                       <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} index={idx} />
                    ))
                 )}
              </div>
           </div>

           {/* Diffraction Monitoring (Failures) */}
           <div className="xl:col-span-5 space-y-16">
              <SectionHeader title="ANOMALOUS_FLUX_LOGS" subtitle="Diffracted execution intercepts requiring audit" icon={<ShieldAlert className="text-rose-500 animate-pulse"/>} />
              <div className="grid grid-cols-1 gap-8">
                 {userJobs.failed.length === 0 ? (
                    <EmptyHUD text="RESONANCE_INTEGRITY_MAXIMAL" icon={<Monitor check size={80}/>} />
                 ) : (
                    userJobs.failed.filter(j => searchQuery === '' || j.name.toLowerCase().includes(searchQuery.toLowerCase())).map((j, idx) => (
                       <FluxCard key={j.id} job={j} onCancel={handleCancel} onView={() => setSelectedJob({ id: j.id, queue: j.queue || 'unknown' })} index={idx} isDiffracted />
                    ))
                 )}
              </div>
           </div>
        </main>

        {/* Diagnostic Modal Matrix */}
        <AnimatePresence>
           {selectedJob && (
             <JobDetailsModal
               jobId={selectedJob.id}
               queueName={selectedJob.queue}
               isOpen={!!selectedJob}
               onClose={() => setSelectedJob(null)}
               onRefresh={loadLattice}
             />
           )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }
          @keyframes pulse-glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
          .glow-pulse { animation: pulse-glow 4s infinite; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

function MetricHUD({ title, value, icon, color, subtitle }: { title: string; value: string | number; icon: any; color: string; subtitle: string }) {
  const colors: any = {
    blue: 'from-blue-600/20 to-transparent border-blue-500/30 text-blue-400 shadow-[0_0_60px_rgba(59,130,246,0.15)]',
    emerald: 'from-emerald-600/20 to-transparent border-emerald-500/30 text-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.15)]',
    rose: 'from-rose-600/20 to-transparent border-rose-500/30 text-rose-400 shadow-[0_0_60px_rgba(225,29,72,0.15)]',
    amber: 'from-amber-600/20 to-transparent border-amber-500/30 text-amber-400 shadow-[0_0_60px_rgba(245,158,11,0.15)]'
  }
  return (
    <motion.div whileHover={{ y: -10, scale: 1.02 }} className={`${glassStyle} p-12 rounded-[4.5rem] relative overflow-hidden group shadow-[0_60px_150px_rgba(0,0,0,0.8)] bg-black/40`}>
       <div className={`absolute inset-0 bg-gradient-to-br ${colors[color]} opacity-40`} />
       <div className="flex items-center justify-between relative z-10 gap-8">
          <div className="space-y-4">
             <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic mb-2 leading-none">{title}</p>
             <p className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{value}</p>
             <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">{subtitle}</p>
          </div>
          <div className={`w-28 h-28 rounded-[3.5rem] bg-black/60 border-2 border-white/10 flex items-center justify-center ${colors[color].split(' ')[2]} shadow-[0_40px_100px_rgba(0,0,0,0.5)] scale-110 group-hover:rotate-12 transition-transform duration-1000`}>{icon}</div>
       </div>
    </motion.div>
  )
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: any }) {
  return (
    <div className="flex items-center gap-10 pl-8 border-l-[6px] border-indigo-500/40 relative group">
       <div className="absolute -left-[6px] top-0 bottom-0 w-[6px] bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] group-hover:h-full transition-all" />
       <div className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center shadow-[0_40px_100px_rgba(0,0,0,0.6)] group-hover:rotate-12 transition-transform duration-700">{icon}</div>
       <div>
          <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">{title}</h2>
          <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none">{subtitle}</p>
       </div>
    </div>
  )
}

function FluxCard({ job, onCancel, onView, index, isDiffracted }: { job: Job; onCancel: (id: string) => void; onView: () => void; index: number; isDiffracted?: boolean }) {
  const getStatusStyle = (state: string) => {
    switch (state) {
      case 'completed': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
      case 'active': return 'border-blue-500/30 text-blue-400 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
      case 'failed': return 'border-rose-500/30 text-rose-400 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.2)]'
      case 'delayed': return 'border-amber-500/30 text-amber-400 bg-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
      default: return 'border-white/10 text-slate-800 bg-white/5'
    }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className={`${glassStyle} p-12 rounded-[4.5rem] hover:border-white/20 hover:bg-white/[0.04] transition-all duration-1000 group overflow-hidden relative shadow-[0_60px_150px_rgba(0,0,0,0.6)] bg-black/60`}
    >
       <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-1000 pointer-events-none group-hover:rotate-6 scale-150"><Orbit size={400} /></div>
       <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
       
       <div className="flex items-center justify-between relative z-10 mb-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-10">
             <div className="relative">
                {job.state === 'active' && <div className="absolute inset-0 bg-blue-500 blur-xl opacity-40 animate-pulse" />}
                <span className={`px-8 py-3 rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.6em] italic border-2 relative z-10 ${getStatusStyle(job.state)}`}>{job.state.replace('_', ' ').toUpperCase()}</span>
             </div>
             <div className="space-y-2">
                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter group-hover:text-blue-400 transition-colors duration-1000 drop-shadow-2xl">{job.name}</h3>
                <div className="flex items-center gap-4 text-slate-900">
                   <Binary size={14} className="opacity-40" />
                   <span className="text-[10px] font-black uppercase tracking-widest italic font-mono">CYCLE::HID::{job.id.substring(0, 12).toUpperCase()}</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-6">
             {job.queue && <span className="px-6 py-2 rounded-2xl bg-black/60 border-2 border-white/5 text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] italic shadow-inner">LATTICE::{job.queue.toUpperCase()}</span>}
             <div className="w-1 h-12 bg-white/5 rounded-full" />
             <button onClick={onView} className="w-16 h-16 rounded-[2rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-950 hover:text-white transition-all duration-1000 hover:bg-blue-600/20 active:scale-75 shadow-2xl"><Eye size={36}/></button>
             {(job.state === 'active' || job.state === 'waiting' || job.state === 'delayed') && (
                <button onClick={() => onCancel(job.id)} className="w-16 h-16 rounded-[2.2rem] bg-rose-950/20 border-2 border-rose-500/20 flex items-center justify-center text-rose-500/30 hover:text-rose-400 hover:bg-rose-500/20 transition-all duration-1000 active:scale-75 shadow-2xl"><X size={36}/></button>
             )}
          </div>
       </div>

       {job.state === 'active' && (
         <div className="mb-10 px-8 relative z-10">
            <div className="flex items-center justify-between text-[14px] font-black text-blue-400 uppercase tracking-[1em] mb-6 italic">
               <div className="flex items-center gap-4"><Scan size={20} className="animate-pulse" /> SYNCHRONIZING_FLUX_BUFFER</div>
               <span className="tabular-nums">{job.progress}%</span>
            </div>
            <div className="w-full h-4 bg-black/60 rounded-full overflow-hidden border-2 border-white/5 group-hover:border-white/10 transition-colors shadow-inner p-0.5">
               <motion.div initial={{ width: 0 }} animate={{ width: `${job.progress}%` }} transition={{ duration: 1, ease: "easeOut" }}
                 className="h-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 shadow-[0_0_40px_rgba(59,130,246,1)] rounded-full relative" 
               >
                  <div className="absolute inset-0 bg-white/20 animate-shimmer" />
               </motion.div>
            </div>
         </div>
       )}

       {job.failedReason && (
         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
           className="mb-10 p-10 rounded-[3rem] bg-rose-600/5 border-2 border-rose-500/10 flex items-start gap-6 relative z-10"
         >
            <ShieldAlert size={28} className="text-rose-500 flex-shrink-0 mt-1" />
            <div>
               <p className="text-[12px] font-black text-rose-500 uppercase tracking-[0.8em] italic mb-2">ANOMALY_SIGNATURE_INTERCEPTED</p>
               <p className="text-[16px] font-black text-white uppercase tracking-tighter italic leading-relaxed opacity-80">{job.failedReason}</p>
            </div>
         </motion.div>
       )}

       <footer className="flex items-center justify-between px-10 pt-4 opacity-40 group-hover:opacity-100 transition-all duration-1000 relative z-10">
          <div className="flex items-center gap-10">
             <div className="flex items-center gap-4 text-slate-800">
                <Timer size={16} />
                <span className="text-[12px] font-black uppercase tracking-[0.4em] italic font-mono">{new Date(job.createdAt).toLocaleString().toUpperCase()}</span>
             </div>
             {job.processedOn && (
               <>
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                 <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">PROC_TIME: {new Date(job.processedOn).toLocaleTimeString()}</span>
               </>
             )}
          </div>
          {job.attemptsMade > 1 && (
             <div className="flex items-center gap-4 px-6 py-2 bg-amber-500/5 border-2 border-amber-500/20 rounded-full">
                <RefreshCw size={14} className="text-amber-500 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest italic">RETRY_THRESHOLD_CYCLE_0{job.attemptsMade}</span>
             </div>
          )}
       </footer>
    </motion.div>
  )
}

function EmptyHUD({ text, icon }: { text: string; icon: any }) {
  return (
    <div className="py-48 text-center border-4 border-dashed border-white/5 rounded-[6rem] opacity-10 flex flex-col items-center justify-center gap-12 group hover:opacity-30 transition-opacity">
       <div className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-1000">{icon}</div>
       <p className="text-4xl font-black text-white uppercase tracking-[0.8em] italic max-w-2xl leading-none">{text}</p>
    </div>
  )
}
