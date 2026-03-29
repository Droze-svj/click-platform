'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import {
  Users,
  FileText,
  TrendingUp,
  Shield,
  BarChart3,
  UserCheck,
  UserX,
  Eye,
  Heart,
  Activity,
  Zap,
  Cpu,
  Database,
  Globe,
  Lock,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  HardDrive,
  ActivityIcon,
  Fingerprint,
  Radio,
  Network,
  Orbit,
  Binary,
  Scan,
  MoreHorizontal
} from 'lucide-react'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700'

interface AdminOverview {
  users: {
    total: number
    verified: number
    unverified: number
  }
  posts: {
    total: number
    published: number
    drafts: number
  }
  social: {
    connected_accounts: number
  }
}

interface RecentUser {
  id: string
  email: string
  first_name: string
  last_name: string
  created_at: string
}

interface RecentPost {
  id: string
  title: string
  status: string
  author_id: string
  created_at: string
  users: {
    email: string
  }
}

interface SystemHealth {
  database: string
  api: string
  uptime: number
  memory: any
}

interface DashboardData {
  overview: AdminOverview
  recent_activity: {
    users: RecentUser[]
    posts: RecentPost[]
  }
  system_health: SystemHealth
}

export default function SovereignOversightTerminalPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiGet<DashboardData>('/admin/dashboard')
      setData(response)
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err)
      setError(err.message || 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
       <Fingerprint size={64} className="text-amber-500 animate-pulse mb-8" />
       <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Deciphering Oversight Protocols...</span>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-[#020205] flex items-center justify-center p-10">
       <div className={`${glassStyle} p-12 rounded-[3rem] border-rose-500/20 text-center max-w-xl`}>
          <ShieldAlert size={64} className="text-rose-500 mx-auto mb-8 animate-bounce" />
          <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-4">Oversight Error</h2>
          <p className="text-slate-800 text-[13px] font-black uppercase tracking-widest italic mb-10">{error || 'UNAUTHORIZED_ACCESS_DETECTED'}</p>
          <button onClick={loadDashboard} className="px-12 py-5 bg-white text-black font-black uppercase text-[12px] tracking-widest italic rounded-2xl hover:bg-rose-500 hover:text-white transition-all">RETRY_SYNC</button>
       </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Persistent Watermark */}
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
           <Shield size={1000} className="text-white absolute -top-40 -left-60 -rotate-12" />
        </div>

        {/* Global Oversight Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <div className="w-20 h-20 bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-100" />
                <Shield size={40} className="text-amber-400 relative z-10 group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Binary size={14} className="text-amber-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.6em] text-amber-400 italic leading-none">Oversight Matrix v9.2.0</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                       <ShieldCheck size={12} className="text-emerald-400 animate-pulse" />
                       <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">AUTHORIZED_ROOT</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Oversight</h1>
                 <p className="text-slate-800 text-[11px] uppercase font-black tracking-[0.4em] italic leading-none">Monitoring global node operatives, hive cluster health and lattice vitality.</p>
              </div>
           </div>

           <div className="flex items-center gap-6">
              <button onClick={loadDashboard}
                className="px-10 py-5 bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white hover:bg-white/[0.05] font-black uppercase text-[11px] tracking-[0.4em] italic rounded-2xl transition-all flex items-center gap-4 group shadow-xl">
                 <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" /> REFRESH_LATTICE
              </button>
              <button className="p-5 bg-white text-black hover:bg-amber-500 hover:text-white transition-all rounded-2xl shadow-2xl group active:scale-90">
                 <Scan size={24} className="group-hover:scale-110 transition-transform" />
              </button>
           </div>
        </header>

        {/* Global Vitality Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
           <VitalityCard icon={Users} label="Node Operatives" value={data.overview.users.total} trend={`${data.overview.users.verified} Verified`} color="text-indigo-400" bg="bg-indigo-500/10" />
           <VitalityCard icon={FileText} label="Content Payloads" value={data.overview.posts.total} trend={`${data.overview.posts.published} Published`} color="text-emerald-400" bg="bg-emerald-500/10" />
           <VitalityCard icon={Orbit} label="Neural Sync Nodes" value={data.overview.social.connected_accounts} trend="LATTICE_ACTIVE" color="text-fuchsia-400" bg="bg-fuchsia-500/10" />
           <VitalityCard icon={Activity} label="Lattice Vitality" value={data.system_health.database === 'healthy' ? 'OPTIMAL' : 'ANOMALY'} trend={`Uptime: ${formatUptime(data.system_health.uptime)}`} color="text-amber-400" bg="bg-amber-500/10" isHealthy={data.system_health.database === 'healthy'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 relative z-10">
           {/* Recent Lattice Resonance (Activity Logs) */}
           <div className="lg:col-span-2 space-y-12">
              <div className={`${glassStyle} p-12 rounded-[5rem] border-white/5 shadow-inner`}>
                 <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 mb-8">
                    <div className="flex items-center gap-6">
                       <Scan size={24} className="text-amber-400" />
                       <h3 className="text-[14px] font-black text-white uppercase tracking-[0.5em] italic">Resonance Feed</h3>
                    </div>
                    <button className="text-[10px] font-black text-slate-800 uppercase tracking-widest hover:text-white transition-colors italic">VIEW_ALL_LOGS</button>
                 </div>
                 
                 <div className="space-y-12 p-4">
                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.6em] italic pl-6">New Operative Signatures</label>
                       <div className="grid grid-cols-1 gap-4">
                          {data.recent_activity.users.slice(0, 4).map((user) => (
                            <div key={user.id} className="group p-8 rounded-[2.5rem] bg-black/60 border border-white/5 hover:border-indigo-500/30 transition-all duration-700 flex items-center justify-between shadow-inner">
                               <div className="flex items-center gap-6">
                                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                     <UserCheck size={24} />
                                  </div>
                                  <div>
                                     <p className="text-[15px] font-black text-white uppercase italic tracking-widest leading-none mb-2">{user.first_name} {user.last_name}</p>
                                     <p className="text-[11px] font-black text-slate-800 uppercase italic tracking-[0.2em] leading-none">{user.email}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic opacity-40">{new Date(user.created_at).toLocaleTimeString()}</span>
                                  <p className="text-[9px] font-black text-indigo-500/60 uppercase tracking-tighter italic mt-1 font-mono">NODE_INIT_COMPLETED</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.6em] italic pl-6">Pending Content Payloads</label>
                       <div className="grid grid-cols-1 gap-4">
                          {data.recent_activity.posts.slice(0, 4).map((post) => (
                            <div key={post.id} className="group p-8 rounded-[2.5rem] bg-black/60 border border-white/5 hover:border-emerald-500/30 transition-all duration-700 flex items-center justify-between shadow-inner">
                               <div className="flex items-center gap-6 max-w-[70%]">
                                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0">
                                     <FileText size={24} />
                                  </div>
                                  <div className="truncate">
                                     <p className="text-[15px] font-black text-white uppercase italic tracking-widest leading-none mb-2 truncate">{post.title || 'NULL_TITLE'}</p>
                                     <p className="text-[11px] font-black text-slate-800 uppercase italic tracking-[0.2em] leading-none">{post.users.email}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest italic ${
                                     post.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                     {post.status.toUpperCase()}
                                  </span>
                                  <p className="text-[9px] font-black text-slate-900 uppercase tracking-tighter italic mt-2 opacity-40">{new Date(post.created_at).toLocaleDateString()}</p>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Core Lattice Health & Quick Operations */}
           <div className="space-y-16">
              <div className={`${glassStyle} p-12 rounded-[5rem] border-white/5 shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] bg-black/40`}>
                 <div className="flex items-center gap-6 border-b border-white/5 pb-8 mb-10 px-4">
                    <Database size={20} className="text-amber-400" />
                    <h3 className="text-[13px] font-black text-white uppercase tracking-[0.5em] italic">Core Vitality</h3>
                 </div>
                 
                 <div className="space-y-10 p-4">
                    <HealthRow label="Core Ledger" status={data.system_health.database} />
                    <HealthRow label="Uplink API" status={data.system_health.api} />
                    
                    <div className="pt-6 border-t border-white/5">
                       <div className="flex justify-between items-center mb-4 px-2">
                          <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic">Cognitive Buffer</label>
                          <span className="text-[11px] font-mono text-indigo-400 font-bold">
                             {formatMemory(data.system_health.memory.heapUsed)}/ {formatMemory(data.system_health.memory.heapTotal)}
                          </span>
                       </div>
                       <div className="w-full h-3 bg-white/[0.02] border border-white/5 rounded-full overflow-hidden p-0.5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(data.system_health.memory.heapUsed / data.system_health.memory.heapTotal) * 100}%` }} transition={{ duration: 2 }} 
                            className="h-full bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                       </div>
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t border-white/5 px-2">
                       <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic">Total Uptime</label>
                       <span className="text-[13px] font-black text-white italic tracking-widest">{formatUptime(data.system_health.uptime).toUpperCase()}</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.8em] italic pl-8">Quick Oversight Commands</h4>
                 <div className="grid grid-cols-1 gap-6">
                    <CommandButton icon={Users} label="Manage_Node_Operatives" desc="View and calibrate operative permissions" color="text-indigo-400" onClick={() => router.push('/dashboard/admin/users')} />
                    <CommandButton icon={FileText} label="Moderate_Payloads" desc="Review and authorize content flows" color="text-emerald-400" onClick={() => router.push('/dashboard/admin/posts')} />
                    <CommandButton icon={BarChart3} label="Global_Lattice_Analytics" desc="Full-spectrum system telemetry" color="text-fuchsia-400" onClick={() => router.push('/dashboard/admin/analytics')} />
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

function VitalityCard({ icon: Icon, label, value, trend, color, bg, isHealthy = true }: { icon: any; label: string; value: string | number; trend: string; color: string; bg: string; isHealthy?: boolean }) {
  return (
    <motion.div whileHover={{ y: -10 }} className={`${glassStyle} p-12 rounded-[4rem] group hover:bg-white/[0.05] transition-all relative overflow-hidden flex flex-col items-center text-center`}>
       <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-1000 -rotate-12 scale-150 pointer-events-none"><Icon size={120} /></div>
       <div className={`w-20 h-20 rounded-[2.5rem] ${bg} border border-white/5 flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-12 transition-all`}>
          <Icon className={color} size={36} />
       </div>
       <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em] mb-4 italic leading-none">{label}</p>
       <h3 className="text-5xl font-black text-white italic tracking-tighter leading-none mb-6">{value}</h3>
       <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/40 border border-white/5">
          <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
          <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic">{trend}</span>
       </div>
    </motion.div>
  )
}

function HealthRow({ label, status }: { label: string; status: string }) {
  const isHealthy = status === 'healthy' || status === 'up' || status === 'ok'
  return (
    <div className="group flex items-center justify-between p-6 rounded-[2rem] bg-black/40 border border-white/5 hover:border-white/10 transition-all shadow-inner">
       <span className="text-[12px] font-black text-white uppercase italic tracking-[0.3em]">{label}</span>
       <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse outline outline-rose-500/30'}`} />
          <span className={`text-[11px] font-black uppercase italic tracking-widest ${isHealthy ? 'text-emerald-400' : 'text-rose-500'}`}>{status.toUpperCase()}</span>
       </div>
    </div>
  )
}

function CommandButton({ icon: Icon, label, desc, color, onClick }: { icon: any; label: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${glassStyle} group p-8 rounded-[3rem] hover:bg-white/[0.04] text-left transition-all duration-700 flex items-center gap-8 shadow-inner overflow-hidden relative`}>
       <div className="absolute inset-x-0 bottom-0 h-1 bg-white scale-x-0 group-hover:scale-x-100 transition-transform duration-700 opacity-20" />
       <div className={`w-20 h-20 rounded-[2.2rem] bg-black/60 border border-white/5 flex items-center justify-center ${color} group-hover:scale-110 group-hover:rotate-12 transition-all shadow-2xl flex-shrink-0`}>
          <Icon size={32} />
       </div>
       <div className="flex-1">
          <p className="text-[15px] font-black text-white uppercase italic tracking-[0.4em] mb-2 leading-none group-hover:translate-x-2 transition-transform duration-700">{label}</p>
          <p className="text-[10px] font-black text-slate-800 uppercase italic tracking-widest leading-none opacity-60">{desc}</p>
       </div>
       <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 text-slate-900 group-hover:text-white group-hover:bg-white/10 transition-all">
          <ArrowUpRight size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
       </div>
    </button>
  )
}

const ArrowUpRight = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
)
