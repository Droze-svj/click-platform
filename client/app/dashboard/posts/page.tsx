'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import {
  Plus, Edit, Trash2, Calendar, Eye, Clock, ArrowLeft,
  RefreshCw, BookOpen, Send, BarChart2, Filter, CheckCircle,
  AlertCircle, ChevronLeft, ChevronRight, Shield, Zap, Archive,
  Cpu, Activity, Target, Database, Terminal, Fingerprint,
  Monitor, Compass, Boxes, Layout, Layers, Timer, Box,
  Wind, Ghost, Signal, ShieldCheck, ActivityIcon, HardDrive,
  Workflow, Binary, Orbit, Scan, Command, Sparkle, UserCheck, Key
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-300'

interface Post {
  id: string; title: string; content: string; excerpt: string; slug: string
  status: 'draft' | 'published' | 'scheduled'
  featured_image?: string; thumbnail?: string
  tags: string[]; categories: string[]
  published_at?: string; scheduled_at?: string
  created_at: string; updated_at: string
}

const STATUS_CFG = {
  published: { 
    label: 'DEPLOYED_PHANTOM', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20', 
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]'
  },
  scheduled: { 
    label: 'LOCKED_TRAJECTORY', 
    color: 'text-indigo-400', 
    bg: 'bg-indigo-500/10', 
    border: 'border-indigo-500/20', 
    dot: 'bg-indigo-500',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.5)]'
  },
  draft: { 
    label: 'INERT_PARTICLE', 
    color: 'text-slate-500', 
    bg: 'bg-white/5', 
    border: 'border-white/5', 
    dot: 'bg-slate-700',
    glow: ''
  },
}

const MOCK_POSTS: Post[] = [
  { id: 'p1', title: 'Neural Saturation: 10 Operational Hacks', content: '', excerpt: 'Optimizing payload resonance across stratified social meshes for maximum influence.', slug: 'neural-saturation', status: 'published', tags: ['neural','operational'], categories: ['STRATEGY','LOGIC'], published_at: new Date(Date.now()- 86400000).toISOString(), created_at: new Date(Date.now()-86400000).toISOString(), updated_at: new Date(Date.now()-86400000).toISOString() },
  { id: 'p2', title: 'Lattice Sync Strategy: Deep Archive Audit', content: '', excerpt: 'An exhaustive tactical review of sovereign content trajectories and signal gain.', slug: 'lattice-sync', status: 'published', tags: ['lattice','audit'], categories: ['ANALYTICS','TRAJECTORY'], published_at: new Date(Date.now()-172800000).toISOString(), created_at: new Date(Date.now()-172800000).toISOString(), updated_at: new Date(Date.now()-172800000).toISOString() },
  { id: 'p3', title: 'Spectral Signal Extraction Techniques', content: '', excerpt: 'Developing high-fidelity resonance triggers for autonomous audience induction.', slug: 'spectral-signal', status: 'draft', tags: ['spectral','induction'], categories: ['RESONANCE','SOCIAL'], created_at: new Date(Date.now()-259200000).toISOString(), updated_at: new Date(Date.now()-259200000).toISOString() },
  { id: 'p4', title: 'Kinetic Motion Masterclass: Sovereign Edit', content: '', excerpt: 'Engineering high-velocity visual payloads for rapid synaptic engagement.', slug: 'kinetic-motion', status: 'scheduled', tags: ['kinetic','visual'], categories: ['OPERATIONS','KINETIC'], scheduled_at: new Date(Date.now()+172800000).toISOString(), created_at: new Date(Date.now()-345600000).toISOString(), updated_at: new Date(Date.now()-345600000).toISOString() },
]

export default function SignalDiffusionArchivePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const PAGE_SIZE = 24

  const loadLattice = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      if (process.env.NODE_ENV === 'development') {
        await new Promise(r => setTimeout(r, 800))
        const p = selectedStatus === 'all' ? MOCK_POSTS : MOCK_POSTS.filter(p => p.status === selectedStatus)
        setPosts(p)
      } else {
        const params = new URLSearchParams({ page: currentPage.toString(), limit: String(PAGE_SIZE) })
        if (selectedStatus !== 'all') params.append('status', selectedStatus)
        const res = await apiGet<{ posts: Post[] }>(`/posts?${params}`)
        setPosts(res.posts || [])
      }
    } catch (err: any) { setError(`ARCHIVE_DESYNC: ${err.message}`) }
    finally { setLoading(false); setRefreshing(false) }
  }, [currentPage, selectedStatus])

  useEffect(() => { loadLattice() }, [loadLattice])

  const handlePurge = async (postId: string) => {
    if (!confirm('TERMINATE_PAYLOAD_LATTICE_NODE?')) return
    try { await apiDelete(`/posts/${postId}`); loadLattice() }
    catch (err: any) { setError(`PURGE_FAIL: ${err.message}`) }
  }

  if (loading && posts.length === 0) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen font-inter">
        <Archive size={64} className="text-indigo-500 animate-spin mb-8" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Synchronizing Signal Diffusion Ledger...</span>
     </div>
  )

  const STATS = [
    { label: 'Payload Particles', val: posts.length, color: 'text-white', icon: Database },
    { label: 'Deployed Phantoms', val: posts.filter(p => p.status === 'published').length, color: 'text-emerald-400', icon: Activity },
    { label: 'Locked Trajectories', val: posts.filter(p => p.status === 'scheduled').length, color: 'text-indigo-400', icon: Target },
    { label: 'Inert Particles', val: posts.filter(p => p.status === 'draft').length, color: 'text-rose-400', icon: Cpu },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1800px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Background Signal Layer */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Signal size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Archive size={1000} className="text-white absolute -top-80 -right-40 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Signal Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Archive size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Signal Diffusion v24.8.4</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                       <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic leading-none">STRATUM_UPLINK_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Diffusion</h1>
                 <p className="text-slate-400 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">High-fidelity archival node for persistent mission artifacts and content trajectories.</p>
              </div>
           </div>

           <div className="flex items-center gap-12">
              <button onClick={() => loadLattice(true)} className={`${glassStyle} w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-3xl active:scale-90 border-white/5 bg-black/40 backdrop-blur-3xl`}>
                 <RefreshCw size={32} className={`text-slate-500 group-hover:text-indigo-400 transition-colors duration-700 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <Link href="/dashboard/posts/create"
                className="px-16 py-8 bg-white text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] hover:bg-indigo-600 hover:text-white transition-all duration-300 flex items-center gap-8 italic active:scale-95 group relative overflow-hidden outline-none border-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" /> INITIALIZE_PAYLOAD
              </Link>
           </div>
        </header>

        {/* Diffusion HUD Metrics */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-10 relative z-10">
           {STATS.map((s, i) => (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }}
               key={s.label} className={`${glassStyle} rounded-[4rem] p-12 flex flex-col items-center text-center group bg-black/40 border-white/5 hover:bg-white/[0.04] shadow-inner relative overflow-hidden`}
             >
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-700 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><s.icon size={200} className="text-white" /></div>
                <div className="w-20 h-20 rounded-[2.5rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center mb-10 shadow-3xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <s.icon size={40} className={s.color} />
                </div>
                <p className={`text-6xl font-black italic tracking-tighter leading-none mb-4 drop-shadow-2xl ${s.color}`}>{s.val}</p>
                <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.5em] italic leading-none">{s.label}</p>
             </motion.div>
           ))}
        </section>

        {/* Signal Diffusion Registry */}
        <section className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 shadow-[0_100px_300px_rgba(0,0,0,1)] border-white/5 bg-black/40`}>
           <div className="px-16 py-14 border-b-2 border-white/5 flex flex-col xl:flex-row items-center justify-between gap-16 bg-white/[0.02] relative overflow-hidden backdrop-blur-3xl">
              <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-[5s]"><Layout size={800} className="text-white" /></div>
              
              <div className="flex items-center gap-8 p-3 bg-black/60 rounded-[3.5rem] border-2 border-white/10 shadow-inner relative z-10">
                 {['all','published','scheduled','draft'].map(s => (
                   <button key={s} onClick={() => setSelectedStatus(s)}
                     className={`px-12 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] transition-all duration-300 italic active:scale-95 border-2 ${selectedStatus === s ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' : 'text-slate-500 border-transparent hover:text-white hover:bg-white/[0.05]'}`}>
                     {s === 'all' ? 'FULL_MATRIX' : STATUS_CFG[s as keyof typeof STATUS_CFG].label.split('_')[0]}
                   </button>
                 ))}
              </div>
              <div className="flex items-center gap-10 relative z-10">
                <div className="text-[13px] font-black text-slate-500 uppercase tracking-[0.8em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">
                  {posts.length} TRAJECTORIES_ONLINE
                </div>
                <div className="w-4 h-4 rounded-full bg-indigo-500 animate-ping shadow-[0_0_20px_rgba(99,102,241,1)]" />
              </div>
           </div>

           <div className="p-16 min-h-[600px] bg-black/20">
              <AnimatePresence mode="wait">
                {posts.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.05 }} exit={{ opacity: 0 }} key="empty" className="py-64 text-center flex flex-col items-center gap-16 group">
                     <Terminal size={200} className="text-white animate-pulse group-hover:scale-110 transition-transform duration-700" />
                     <div className="space-y-8">
                        <p className="text-7xl font-black text-white uppercase tracking-[0.8em] italic drop-shadow-2xl underline decoration-indigo-500/20 underline-offset-8">NULL_ARCHIVE_SECTOR</p>
                        <p className="text-[18px] font-black text-slate-600 uppercase tracking-[0.5em] italic leading-none max-w-2xl mx-auto">No active content trajectories identified in this stratum. Initiate payload synthesis to begin diffusion.</p>
                     </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                     {posts.map((post, i) => {
                       const cfg = STATUS_CFG[post.status] || STATUS_CFG.draft
                       return (
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.9, y: 50 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.05 }}
                           key={post.id} className="group relative flex flex-col bg-[#050505] border-2 border-white/5 rounded-[5.5rem] overflow-hidden hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all duration-300 shadow-[0_40px_100px_rgba(0,0,0,1)] hover:shadow-indigo-500/[0.05]"
                         >
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-300 pointer-events-none group-hover:scale-150 rotate-12"><Database size={300} /></div>
                            
                            <div className="flex items-center justify-between px-12 py-10 border-b-2 border-white/5 bg-white/[0.01] relative z-20">
                               <div className="flex items-center gap-6">
                                  <div className={`w-4 h-4 rounded-full ${cfg.dot} ${cfg.glow} ${post.status === 'published' ? 'animate-pulse' : ''}`} />
                                  <span className={`text-[12px] font-black uppercase tracking-[0.4em] ${cfg.color} italic leading-none`}>{cfg.label}</span>
                               </div>
                               {post.categories?.[0] && (
                                 <div className="px-6 py-2 rounded-2xl bg-indigo-500/5 text-indigo-400 border-2 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest italic shadow-inner">
                                   {post.categories[0]}
                                 </div>
                               )}
                            </div>
                            
                            <div className="p-14 flex-1 space-y-10 relative z-10 bg-gradient-to-br from-white/[0.02] to-transparent">
                               <h3 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-400 transition-colors duration-700 drop-shadow-2xl">{post.title || 'UNNAMED_PHANTOM'}</h3>
                               {post.excerpt && <p className="text-[15px] text-slate-500 font-extrabold italic uppercase leading-relaxed line-clamp-3 tracking-tighter opacity-80 group-hover:text-white transition-colors">{post.excerpt}</p>}
                               <div className="flex flex-wrap gap-4 pt-6 border-t-2 border-white/5">
                                  {post.tags?.slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-5 py-2.5 rounded-2xl bg-black/60 border-2 border-white/5 text-[11px] font-black text-slate-500 uppercase italic tracking-[0.2em] group-hover:border-indigo-500/20 group-hover:text-white transition-all shadow-inner">#{tag}</span>
                                  ))}
                               </div>
                            </div>

                            <div className="px-14 py-12 border-t-2 border-white/5 bg-black/40 flex items-center justify-between relative z-20 group-hover:bg-black/60 transition-all">
                               <div className="flex items-center gap-8">
                                  <div className="space-y-3">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] italic leading-none opacity-40">CHRONOS_SYNC</p>
                                     <p className="text-[14px] font-black text-white italic tabular-nums leading-none tracking-widest bg-white/[0.03] px-4 py-2 rounded-xl">
                                        {post.status === 'published' ? new Date(post.published_at!).toLocaleDateString().toUpperCase() : post.status === 'scheduled' ? new Date(post.scheduled_at!).toLocaleDateString().toUpperCase() : 'VAULT_LOCK'}
                                     </p>
                                  </div>
                                  <div className="h-16 w-1 bg-white/5 rounded-full mx-2" />
                                  <div className="flex items-center gap-5">
                                     <button onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)} className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all shadow-3xl active:scale-75 group/edit relative overflow-hidden">
                                        <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover/edit:opacity-20 transition-opacity" />
                                        <Edit size={28} className="group-hover/edit:rotate-12 transition-transform relative z-10" />
                                     </button>
                                     <button onClick={() => router.push(`/dashboard/analytics`)} className="w-16 h-16 rounded-[1.8rem] bg-indigo-500/5 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shadow-3xl active:scale-75 hover:scale-110 relative overflow-hidden group/stats">
                                        <BarChart2 size={28} className="group-hover/stats:scale-110 transition-transform relative z-10" />
                                     </button>
                                  </div>
                               </div>
                               <button onClick={() => handlePurge(post.id)} className="w-16 h-16 rounded-[1.8rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-3xl active:scale-75 group/purge">
                                  <Trash2 size={28} className="group-hover/purge:rotate-[30deg] transition-transform" />
                               </button>
                            </div>
                         </motion.div>
                       )
                     })}
                  </div>
                )}
              </AnimatePresence>
           </div>

           {/* Temporal Ledger Paging */}
           {posts.length >= PAGE_SIZE && (
             <div className="px-16 py-12 border-t-2 border-white/5 bg-black/80 flex items-center justify-between relative z-50 backdrop-blur-3xl">
                <div className="flex items-center gap-8">
                   <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,1)]" />
                   <span className="text-[13px] font-black text-slate-500 uppercase tracking-[1em] italic opacity-40">TEMPORAL_FRAME_{currentPage}</span>
                </div>
                <div className="flex items-center gap-10 p-2 bg-black/40 rounded-[3rem] border-2 border-white/5 shadow-inner">
                   <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-18 h-18 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-5 transition-all active:scale-75 shadow-3xl hover:border-indigo-500/40"><ChevronLeft size={36}/></button>
                   <div className="w-1 h-8 bg-white/5 rounded-full" />
                   <button onClick={() => setCurrentPage(p => p + 1)} disabled={posts.length < PAGE_SIZE} className="w-18 h-18 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-5 transition-all active:scale-75 shadow-3xl hover:border-indigo-500/40"><ChevronRight size={36}/></button>
                </div>
             </div>
           )}
        </section>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); border-radius: 10px; }
          ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; border: 2px solid #020205; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
          .shadow-3xl { filter: drop-shadow(0 40px 100px rgba(0,0,0,0.8)); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
