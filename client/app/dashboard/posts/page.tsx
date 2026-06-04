'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
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
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'

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
    color: 'text-emerald-700 dark:text-emerald-400', 
    bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
    border: 'border-emerald-200 dark:border-emerald-500/20', 
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]'
  },
  scheduled: { 
    label: 'LOCKED_TRAJECTORY', 
    color: 'text-primary-700 dark:text-primary-400', 
    bg: 'bg-primary-50 dark:bg-primary-500/10', 
    border: 'border-primary-200 dark:border-primary-500/20', 
    dot: 'bg-primary-500',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.5)]'
  },
  draft: { 
    label: 'INERT_PARTICLE', 
    color: 'text-surface-600 dark:text-surface-400', 
    bg: 'bg-surface-100 dark:bg-white/5', 
    border: 'border-surface-200 dark:border-white/5', 
    dot: 'bg-surface-400 dark:bg-slate-700',
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
  const { t } = useTranslation()
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
    if (!confirm(t('postsPage.confirmDelete'))) return
    try { await apiDelete(`/posts/${postId}`); loadLattice() }
    catch (err: any) { setError(`PURGE_FAIL: ${err.message}`) }
  }

  const STATUS_LABELS: Record<string, string> = {
    published: t('postsPage.statusPublished'),
    scheduled: t('postsPage.statusScheduled'),
    draft: t('postsPage.statusDraft'),
  }

  if (loading && posts.length === 0) return (
     <div className="min-h-screen bg-surface-page font-inter transition-colors duration-500 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto" aria-busy="true" aria-label={t('postsPage.loadingAria')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="space-y-4">
           {Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
     </div>
  )

  const STATS = [
    { label: t('postsPage.statTotal'), val: posts.length, color: 'text-surface-900 dark:text-white', icon: Database },
    { label: t('postsPage.statPublished'), val: posts.filter(p => p.status === 'published').length, color: 'text-emerald-600 dark:text-emerald-400', icon: Activity },
    { label: t('postsPage.statScheduled'), val: posts.filter(p => p.status === 'scheduled').length, color: 'text-primary-600 dark:text-primary-400', icon: Target },
    { label: t('postsPage.statDraft'), val: posts.filter(p => p.status === 'draft').length, color: 'text-rose-600 dark:text-rose-400', icon: Cpu },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-10 pt-16 max-w-[1800px] mx-auto space-y-24 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter">
        <ToastContainer />
        
        {/* Background Signal Layer */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.01]">
           <Signal size={1200} className="text-surface-900 dark:text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Archive size={1000} className="text-surface-900 dark:text-white absolute -top-80 -right-40 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Signal Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button type="button" onClick={() => router.push('/dashboard')} title={t('postsPage.backToDashboard')} aria-label={t('postsPage.backToDashboard')}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2.5rem] bg-surface-card border-2 border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-lg backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary-500/5 border-2 border-primary-500/20 rounded-[3rem] flex items-center justify-center shadow-lg relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-100" />
                <Archive size={48} className="text-primary-500 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-primary-500 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-primary-500 italic leading-none">{t('postsPage.kicker')}</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-surface-card dark:bg-black/60 border-2 border-surface-200 dark:border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_20px_rgba(99,102,241,1)]" />
                       <span className="text-[10px] font-black text-surface-500 dark:text-slate-400 tracking-widest uppercase italic leading-none">{t('postsPage.uplinkStatus')}</span>
                   </div>
                 </div>
                 <h1 className="text-5xl sm:text-7xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-3">{t('postsPage.title')}</h1>
                 <p className="text-surface-500 dark:text-slate-400 text-sm md:text-base font-medium mt-4 max-w-2xl leading-relaxed">{t('postsPage.subtitle')}</p>
              </div>
           </div>

           <div className="flex items-center gap-12">
               <button type="button" onClick={() => loadLattice(true)} title={t('postsPage.refresh')} aria-label={t('postsPage.refresh')} className="w-16 h-16 sm:w-20 sm:h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-lg active:scale-90 border-surface-200 dark:border-white/5 bg-surface-card dark:bg-black/40 backdrop-blur-3xl transition-all">
                  <RefreshCw size={32} className={`text-surface-400 group-hover:text-primary-500 transition-colors duration-700 ${refreshing ? 'animate-spin' : ''}`} />
               </button>
              <Link href="/dashboard/posts/create"
                className="px-10 sm:px-16 py-6 sm:py-8 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-xl hover:bg-primary-600 hover:text-white transition-all duration-300 flex items-center gap-8 italic active:scale-95 group relative overflow-hidden outline-none border-none"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" /> {t('postsPage.createPost')}
              </Link>
           </div>
        </header>

        {/* Diffusion HUD Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 relative z-10">
           {STATS.map((s, i) => (
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }}
               key={s.label} className="bg-surface-card backdrop-blur-3xl rounded-[4rem] p-12 flex flex-col items-center text-center group border border-surface-200 dark:border-white/5 hover:bg-surface-page dark:hover:bg-white/[0.04] shadow-xl relative overflow-hidden transition-all duration-500"
             >
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-700 pointer-events-none group-hover:rotate-12 group-hover:scale-150"><s.icon size={200} className="text-surface-900 dark:text-white" /></div>
                <div className="w-20 h-20 rounded-[2.5rem] bg-surface-page dark:bg-white/[0.02] border-2 border-surface-100 dark:border-white/10 flex items-center justify-center mb-10 shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <s.icon size={40} className={s.color} />
                </div>
                <p className={`text-6xl font-black italic tracking-tighter leading-none mb-4 ${s.color}`}>{s.val}</p>
                <p className="text-[12px] font-black text-surface-500 dark:text-slate-400 uppercase tracking-[0.5em] italic leading-none">{s.label}</p>
             </motion.div>
           ))}
        </section>

        {/* Signal Diffusion Registry */}
        <section className="bg-surface-card backdrop-blur-3xl rounded-[6rem] overflow-hidden relative z-10 shadow-2xl border border-surface-200 dark:border-white/5 transition-all duration-500">
           <div className="px-8 sm:px-16 py-14 border-b-2 border-surface-100 dark:border-white/5 flex flex-col xl:flex-row items-center justify-between gap-16 bg-surface-page/30 dark:bg-white/[0.02] relative overflow-hidden backdrop-blur-3xl">
              <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none transition-opacity duration-[5s]"><Layout size={800} className="text-surface-900 dark:text-white" /></div>
              
              <div className="flex items-center gap-8 p-3 bg-surface-page dark:bg-black/60 rounded-[3.5rem] border-2 border-surface-100 dark:border-white/10 shadow-inner relative z-10 overflow-x-auto max-w-full">
                 {['all','published','scheduled','draft'].map(s => (
                   <button type="button" key={s} onClick={() => setSelectedStatus(s)}
                     className={`px-12 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.5em] transition-all duration-300 italic active:scale-95 border-2 shrink-0 ${selectedStatus === s ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-surface-900 dark:border-white shadow-xl scale-105' : 'text-surface-500 border-transparent hover:text-surface-900 dark:hover:text-white hover:bg-surface-page/50'}`}>
                     {s === 'all' ? t('postsPage.filterAll') : STATUS_LABELS[s]}
                   </button>
                 ))}
              </div>
              <div className="flex items-center gap-10 relative z-10">
                <div className="text-[13px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[0.8em] italic leading-none border-l-4 border-primary-500/20 pl-8 ml-4">
                  {t('postsPage.trajectoriesOnline', { count: posts.length })}
                </div>
                <div className="w-4 h-4 rounded-full bg-primary-500 animate-ping shadow-[0_0_20px_rgba(99,102,241,1)]" />
              </div>
           </div>

           <div className="p-8 sm:p-16 min-h-[40vh] bg-surface-page/10">
              <AnimatePresence mode="wait">
                {posts.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }} key="empty" className="py-16 sm:py-32 text-center flex flex-col items-center gap-8 sm:gap-16 group">
                     <Terminal size={200} className="text-surface-900 dark:text-white animate-pulse group-hover:scale-110 transition-transform duration-700" />
                     <div className="space-y-8">
                        <p className="text-4xl sm:text-7xl font-black text-surface-900 dark:text-white uppercase tracking-[0.8em] italic drop-shadow-lg underline decoration-primary-500/20 underline-offset-8">{t('postsPage.emptyTitle')}</p>
                        <p className="text-[16px] sm:text-[18px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.5em] italic leading-none max-w-2xl mx-auto">{t('postsPage.emptyDescription')}</p>
                     </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                     {posts.map((post, i) => {
                       const cfg = STATUS_CFG[post.status] || STATUS_CFG.draft
                       return (
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.9, y: 50 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.05 }}
                           key={post.id} className="group relative flex flex-col bg-surface-card dark:bg-[#050505] border-2 border-surface-200 dark:border-white/5 rounded-[5.5rem] overflow-hidden hover:border-primary-500/40 hover:bg-surface-page dark:hover:bg-white/[0.04] transition-all duration-300 shadow-xl"
                         >
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity duration-300 pointer-events-none group-hover:scale-150 rotate-12"><Database size={300} className="text-surface-900 dark:text-white" /></div>
                            
                            <div className="flex items-center justify-between px-12 py-10 border-b-2 border-surface-100 dark:border-white/5 bg-surface-page/30 dark:bg-white/[0.01] relative z-20">
                               <div className="flex items-center gap-6">
                                  <div className={`w-4 h-4 rounded-full ${cfg.dot} ${cfg.glow} ${post.status === 'published' ? 'animate-pulse' : ''}`} />
                                  <span className={`text-[12px] font-black uppercase tracking-[0.4em] ${cfg.color} italic leading-none`}>{STATUS_LABELS[post.status] || STATUS_LABELS.draft}</span>
                               </div>
                               {post.categories?.[0] && (
                                 <div className="px-6 py-2 rounded-2xl bg-primary-500/5 text-primary-600 dark:text-primary-400 border-2 border-primary-500/20 text-[10px] font-black uppercase tracking-widest italic shadow-inner">
                                   {post.categories[0]}
                                 </div>
                               )}
                            </div>
                            
                            <div className="p-14 flex-1 space-y-10 relative z-10 bg-gradient-to-br from-primary-500/5 to-transparent dark:from-white/5">
                               <h3 className="text-4xl sm:text-5xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none group-hover:text-primary-500 transition-colors duration-700 drop-shadow-sm">{post.title || t('postsPage.untitledPost')}</h3>
                               {post.excerpt && <p className="text-[15px] text-surface-500 dark:text-slate-500 font-extrabold italic uppercase leading-relaxed line-clamp-3 tracking-tighter opacity-80 group-hover:text-surface-900 dark:group-hover:text-white transition-colors">{post.excerpt}</p>}
                               <div className="flex flex-wrap gap-4 pt-6 border-t-2 border-surface-100 dark:border-white/5">
                                  {post.tags?.slice(0, 3).map((tag, i) => (
                                    <span key={i} className="px-5 py-2.5 rounded-2xl bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 text-[11px] font-black text-surface-400 dark:text-slate-500 uppercase italic tracking-[0.2em] group-hover:border-primary-500/20 group-hover:text-surface-900 dark:group-hover:text-white transition-all shadow-inner">#{tag}</span>
                                  ))}
                               </div>
                            </div>

                            <div className="px-14 py-12 border-t-2 border-surface-100 dark:border-white/5 bg-surface-page/50 dark:bg-black/40 flex items-center justify-between relative z-20 group-hover:bg-surface-page dark:group-hover:bg-black/60 transition-all gap-4">
                               <div className="flex flex-col sm:flex-row items-center gap-8">
                                  <div className="space-y-3">
                                     <p className="text-[10px] font-black text-surface-400 dark:text-slate-400 uppercase tracking-[0.6em] italic leading-none opacity-40">{t('postsPage.dateLabel')}</p>
                                     <p className="text-[14px] font-black text-surface-900 dark:text-white italic tabular-nums leading-none tracking-widest bg-surface-page dark:bg-white/[0.03] px-4 py-2 rounded-xl shadow-inner">
                                        {post.status === 'published' ? new Date(post.published_at!).toLocaleDateString().toUpperCase() : post.status === 'scheduled' ? new Date(post.scheduled_at!).toLocaleDateString().toUpperCase() : t('postsPage.noDate')}
                                     </p>
                                  </div>
                                  <div className="hidden sm:block h-16 w-1 bg-surface-100 dark:bg-white/5 rounded-full mx-2" />
                                  <div className="flex items-center gap-5">
                                     <button type="button" onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)} title={t('postsPage.editPost')} aria-label={t('postsPage.editPost')} className="w-16 h-16 rounded-[1.8rem] bg-surface-card border-2 border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-lg active:scale-75 group/edit relative overflow-hidden">
                                        <div className="absolute inset-0 bg-primary-500 opacity-0 group-hover/edit:opacity-20 transition-opacity" />
                                        <Edit size={28} className="group-hover/edit:rotate-12 transition-transform relative z-10" />
                                     </button>
                                     <button type="button" onClick={() => router.push(`/dashboard/analytics`)} title={t('postsPage.viewAnalytics')} aria-label={t('postsPage.viewAnalytics')} className="w-16 h-16 rounded-[1.8rem] bg-primary-500/5 border-2 border-primary-500/20 flex items-center justify-center text-primary-500 hover:bg-primary-600 hover:text-white transition-all shadow-lg active:scale-75 hover:scale-110 relative overflow-hidden group/stats">
                                        <BarChart2 size={28} className="group-hover/stats:scale-110 transition-transform relative z-10" />
                                     </button>
                                  </div>
                               </div>
                               <button type="button" onClick={() => handlePurge(post.id)} title={t('postsPage.deletePost')} aria-label={t('postsPage.deletePost')} className="w-16 h-16 rounded-[1.8rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-center text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-lg active:scale-75 group/purge">
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
             <div className="px-8 sm:px-16 py-12 border-t-2 border-surface-100 dark:border-white/5 bg-surface-card dark:bg-black/80 flex flex-col sm:flex-row items-center justify-between relative z-50 backdrop-blur-3xl gap-8">
                <div className="flex items-center gap-8">
                   <span className="w-3 h-3 rounded-full bg-primary-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,1)]" />
                   <span className="text-[13px] font-black text-surface-400 dark:text-slate-500 uppercase tracking-[1em] italic opacity-40">{t('postsPage.pageLabel', { page: currentPage })}</span>
                </div>
                <div className="flex items-center gap-10 p-2 bg-surface-page dark:bg-black/40 rounded-[3rem] border-2 border-surface-100 dark:border-white/5 shadow-inner">
                   <button type="button" aria-label={t('postsPage.previousPage')} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-18 h-18 rounded-[1.8rem] bg-surface-card border-2 border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white disabled:opacity-5 transition-all active:scale-75 shadow-lg hover:border-primary-500/40"><ChevronLeft size={36}/></button>
                   <div className="w-1 h-8 bg-surface-100 dark:bg-white/5 rounded-full" />
                   <button type="button" aria-label={t('postsPage.nextPage')} onClick={() => setCurrentPage(p => p + 1)} disabled={posts.length < PAGE_SIZE} className="w-18 h-18 rounded-[1.8rem] bg-surface-card border-2 border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white disabled:opacity-5 transition-all active:scale-75 shadow-lg hover:border-primary-500/40"><ChevronRight size={36}/></button>
                </div>
             </div>
           )}
        </section>
      </div>
    </ErrorBoundary>
  )
}
