'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '../../../lib/api'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import {
  Sparkles, ArrowLeft, Send, Copy, Check, Hash, Zap,
  RefreshCw, Radio, Cpu, Activity, Globe, Flame, Terminal, X,
  FileText, Network, Gauge, Boxes, CircuitBoard, CheckCircle, AlertCircle,
  Fingerprint
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

const PredictiveAnalytics = lazy(() => import('../../../components/PredictiveAnalytics'))
const AIRecommendations   = lazy(() => import('../../../components/AIRecommendations'))

interface GeneratedContent {
  socialPosts: Array<{ platform: string; content: string; hashtags: string[] }>
  blogSummary: string
  viralIdeas: Array<{ title: string; description: string; platform: string }>
}

const RESONANCE_NODES = [
  { id: 'tiktok',    label: 'KINETIC_NODE',   icon: '♪',  gradient: 'from-slate-800 to-black',       limit: 2200 },
  { id: 'instagram', label: 'VISUAL_NODE',    icon: '◎',  gradient: 'from-indigo-500 to-purple-600',     limit: 2200 },
  { id: 'youtube',   label: 'STREAM_NODE',    icon: '▶', gradient: 'from-red-600 to-rose-900',       limit: 5000 },
  { id: 'twitter',   label: 'X_NODE',        icon: '𝕏',  gradient: 'from-slate-600 to-slate-950',         limit: 280 },
  { id: 'linkedin',  label: 'B2B_LATTICE',    icon: 'in', gradient: 'from-blue-600 to-indigo-900',       limit: 3000 },
]

export default function NeuralForgePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)

  const [logicSeed, setLogicSeed] = useState('')
  const [designation, setDesignation] = useState('')
  const [activeNodes, setActiveNodes] = useState<string[]>(['tiktok', 'instagram', 'twitter'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manifest, setManifest] = useState<GeneratedContent | null>(null)
  const [payloadId, setPayloadId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { if (!user) router.push('/login') }, [user, router])

  const loadPayload = useCallback(async (id: string) => {
    try {
      const res: any = await apiGet(`/content/${id}`)
      setManifest(res?.generatedContent || res?.data?.generatedContent)
    } catch (err) {
      setError('PAYLOAD_LOAD_FAILED: Unable to retrieve generated content. Try refreshing.')
    }
  }, [])

  useEffect(() => {
    if (!socket || !connected) return
    const handler = (data: any) => {
      if (data.status === 'completed' && data.contentId === payloadId) {
        loadPayload(data.contentId); setSuccess('NEURAL_FORGE_SUCCESS: PAYLOAD_READY')
      } else if (data.status === 'failed') { setError('CRITICAL_FAIL: SYNTH_LOGIC_DIFFRACTION') }
    }
    on('content-generated', handler)
    return () => off('content-generated', handler)
  }, [socket, connected, payloadId, on, off, loadPayload])

  const toggleNode = useCallback((id: string) => {
    setActiveNodes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const handleForgeInitiation = async () => {
    if (!logicSeed.trim() || logicSeed.length < 50) { setError('MIN_LOGIC_SEED_NOT_MET: 50_CHARS'); return }

    setLoading(true); setError(''); setSuccess(''); setManifest(null)
    try {
      const res: any = await apiPost('/content/generate', { text: logicSeed, title: designation || undefined, platforms: activeNodes })
      const id = res?.contentId || res?.data?.contentId
      if (id) { 
        setPayloadId(id); 
        setSuccess('INJECTION_ACTIVE: TRANSMITTING_TO_FORGE');
        if (!connected) {
           const iv = setInterval(async () => {
             try {
               const sRes: any = await apiGet(`/content/${id}/status`)
               if (sRes?.status === 'completed' && sRes?.generatedContent) { clearInterval(iv); setManifest(sRes.generatedContent); setSuccess('FORGING_COMPLETE') }
               else if (sRes?.status === 'failed') { clearInterval(iv); setError('FORGE_FAILED') }
             } catch { clearInterval(iv) }
           }, 3000)
           setTimeout(() => clearInterval(iv), 120000)
        }
      }
    } catch {
      setError('FORGE_ERR: THERMAL_OVERLOAD')
    } finally { setLoading(false) }
  }

  const handleCapture = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-4 sm:px-10 pt-10 max-w-[1750px] mx-auto space-y-24 bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter overflow-x-hidden">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.01]">
           <Fingerprint size={800} className="text-surface-900 dark:text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Forge Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button type="button" onClick={() => router.push('/dashboard')} 
                title="Back to Dashboard" aria-label="Back to Dashboard"
                className="w-16 h-16 rounded-[1.8rem] bg-surface-card border-2 border-surface-100 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-primary-500 hover:border-primary-500/30 transition-all shadow-xl active:scale-95 group">
                <ArrowLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div className="w-24 h-24 bg-primary-500/10 border-2 border-primary-500/20 rounded-[3rem] flex items-center justify-center shadow-lg relative group overflow-hidden">
                <Sparkles size={48} className="text-primary-500 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Network size={16} className="text-primary-500 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-primary-500 italic leading-none">Neural Forge Matrix</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-primary-500/10 border-2 border-primary-500/20 shadow-inner">
                       <Radio size={14} className="text-primary-500 animate-pulse" />
                       <span className="text-[10px] font-black text-primary-500 tracking-widest uppercase italic leading-none">FORGE_CORE_IGNITED</span>
                   </div>
                 </div>
                 <h1 className="text-5xl md:text-6xl font-black text-surface-900 dark:text-white tracking-tighter leading-none mb-3 italic uppercase">Content AI</h1>
                 <p className="text-surface-500 dark:text-slate-600 text-sm md:text-base font-black italic uppercase tracking-tight leading-none max-w-2xl">Transmute raw logic seeds into high-resonance synthetic assets.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button type="button" onClick={() => router.push('/dashboard/scheduler')}
                className="px-16 py-8 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.8em] shadow-[0_40px_100px_rgba(0,0,0,0.4)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all duration-300 flex items-center gap-10 italic active:scale-95 group border-none"
              >
                <Send size={28} className="group-hover:translate-x-6 group-hover:-translate-y-6 transition-transform duration-700" />
                DEPLOY_PAYLOADS
              </button>
           </div>
        </header>

        {/* Status Messaging */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-rose-500/5 border-2 border-rose-500/20 flex items-center justify-between gap-12 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><AlertCircle size={200} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner border-2 border-rose-500/20"><AlertCircle className="text-rose-500" size={44} /></div>
                  <p className="text-2xl sm:text-4xl font-black text-rose-500 uppercase tracking-tighter italic leading-none">{error}</p>
               </div>
               <button type="button" onClick={() => setError('')} title="Dismiss Error" aria-label="Dismiss Error" className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center relative z-10 border-none active:scale-90"><X size={32} /></button>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-emerald-500/5 border-2 border-emerald-500/10 flex items-center justify-between gap-12 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><CheckCircle size={200} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner border-2 border-emerald-500/20"><CheckCircle className="text-emerald-500" size={44} /></div>
                  <p className="text-2xl sm:text-4xl font-black text-emerald-500 uppercase tracking-tighter italic leading-none">{success}</p>
               </div>
               <button type="button" onClick={() => setSuccess('')} title="Dismiss Success" aria-label="Dismiss Success" className="w-16 h-16 rounded-full bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center relative z-10 border-none active:scale-90"><X size={32} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
          {/* Logic Injection Node */}
          <section className="bg-surface-card backdrop-blur-3xl rounded-[6rem] overflow-hidden group border-2 border-surface-100 dark:border-primary-500/10 flex flex-col shadow-2xl transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
             <div className="px-8 sm:px-16 py-14 border-b-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between bg-surface-page/30 dark:bg-white/[0.02] gap-10">
                <div className="flex items-center gap-10">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 flex items-center justify-center border-2 border-primary-500/20 shadow-xl group-hover:rotate-12 transition-transform duration-700"><Terminal size={36} className="text-primary-500" /></div>
                  <h2 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-4xl sm:text-5xl leading-none">Logic Injection</h2>
                </div>
                <div className="px-8 py-3.5 rounded-full bg-primary-500/10 border-2 border-primary-500/20 flex items-center gap-5 shadow-inner">
                   <div className="w-3.5 h-3.5 rounded-full bg-primary-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-pulse" />
                   <span className="text-[11px] font-black text-primary-500 uppercase tracking-[0.6em] italic leading-none">SYNC_ACTIVE</span>
                </div>
             </div>

             <div className="p-8 sm:p-20 space-y-16 flex-1 flex flex-col">
                <div className="space-y-10">
                  <label className="text-[14px] font-black text-surface-400 uppercase tracking-[0.8em] italic pl-8 leading-none">Operational Designation</label>
                  <div className="relative group/input">
                    <input type="text" value={designation} onChange={e => setDesignation(e.target.value)}
                      placeholder="PAYLOAD_IDENTIFIER_BETA..."
                      className="w-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[3.5rem] px-10 sm:px-16 py-12 text-2xl sm:text-3xl font-black text-surface-900 dark:text-white uppercase tracking-tighter italic focus:outline-none focus:border-primary-500 transition-all placeholder:text-surface-300 dark:placeholder:text-slate-800 pr-32 shadow-inner backdrop-blur-3xl" 
                    />
                    <Hash size={40} className="absolute right-14 top-1/2 -translate-y-1/2 text-surface-200 dark:text-slate-900 group-focus-within/input:text-primary-500 transition-colors duration-700" />
                  </div>
                </div>

                <div className="space-y-10 flex-1 flex flex-col">
                  <div className="flex flex-col sm:flex-row items-center justify-between px-10 border-l-8 border-primary-500/20 ml-2 gap-6">
                    <label className="text-[14px] font-black text-surface-400 uppercase tracking-[0.8em] italic leading-none">Logic Seed Matrix</label>
                    <div className="flex gap-12">
                       <span className="text-[12px] font-black text-primary-500 font-mono tracking-widest uppercase opacity-60 italic"> {logicSeed.length} BITS_DATA</span>
                       <span className="text-[12px] font-black text-primary-500 font-mono tracking-widest uppercase opacity-60 italic"> {logicSeed.trim().split(/\s+/).filter(Boolean).length} PARTICLES</span>
                    </div>
                  </div>
                  <div className="relative flex-1 group/area min-h-[400px]">
                    <textarea value={logicSeed} onChange={e => setLogicSeed(e.target.value)}
                      placeholder="PASTE_LONG_FORM_LOGIC_SEED_MIN_50_CHARS..."
                      className="w-full h-full bg-surface-page dark:bg-black/60 border-2 border-surface-100 dark:border-white/5 rounded-[4.5rem] px-10 sm:px-16 py-20 text-2xl sm:text-3xl font-black text-surface-900 dark:text-slate-200 uppercase tracking-tighter italic focus:outline-none focus:border-primary-500 transition-all placeholder:text-surface-300 dark:placeholder:text-slate-800 leading-relaxed resize-none shadow-inner backdrop-blur-3xl custom-scrollbar"
                    />
                    <div className="absolute right-14 bottom-14 p-8 bg-surface-card dark:bg-black/80 border-2 border-surface-100 dark:border-white/10 rounded-[2.5rem] opacity-0 group-hover/area:opacity-100 transition-all duration-1000 translate-y-8 group-hover/area:translate-y-0 shadow-2xl flex items-center justify-center"><Boxes size={48} className="text-surface-400 dark:text-slate-800" /></div>
                  </div>
                </div>

                <div className="space-y-12">
                  <label className="text-[14px] font-black text-surface-400 uppercase tracking-[0.8em] italic pl-8 leading-none">Platforms</label>
                  <div className="flex flex-wrap gap-8">
                    {RESONANCE_NODES.map(node => {
                      const active = activeNodes.includes(node.id)
                      return (
                        <button type="button" key={node.id} onClick={() => toggleNode(node.id)}
                          title={`Toggle ${node.label}`} aria-label={`Toggle ${node.label}`}
                          className={`group flex items-center gap-8 px-10 sm:px-14 py-8 rounded-[4rem] text-[14px] font-black uppercase tracking-[0.4em] transition-all duration-500 border-2 italic relative overflow-hidden ${active ? `bg-surface-900 dark:bg-white text-white dark:text-black border-transparent scale-105 shadow-2xl z-10` : 'bg-surface-page dark:bg-black/40 border-surface-100 dark:border-white/5 text-surface-400 hover:text-surface-900 dark:hover:text-white hover:border-primary-500/30 shadow-inner'}`}>
                          <span className={`text-4xl sm:text-5xl transition-all duration-700 relative z-10 ${active ? 'grayscale-0 rotate-12 scale-110' : 'grayscale text-surface-300 dark:text-slate-900 opacity-30 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110'}`}>{node.icon}</span> 
                          <span className="relative z-10">{node.label}</span>
                          <div className={`absolute inset-0 bg-gradient-to-br ${node.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-700`} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                   type="button"
                   onClick={handleForgeInitiation} 
                   disabled={loading || !logicSeed.trim() || logicSeed.length < 50}
                   className="w-full flex items-center justify-center gap-14 py-14 sm:py-20 bg-surface-900 dark:bg-white hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white disabled:opacity-10 text-white dark:text-black rounded-[6rem] text-[20px] sm:text-[24px] font-black uppercase tracking-[1.2em] shadow-[0_50px_120px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-4 active:translate-y-0 italic border-none group/forge-btn"
                >
                  {loading ? (
                    <><RefreshCw size={56} className="animate-spin" /> IGNITING_FORGE...</>
                  ) : (
                    <><Flame size={56} className="group-hover/forge-btn:scale-125 group-hover/forge-btn:rotate-12 transition-all duration-700 text-amber-500" /> FORGE_CONTENT</>
                  )}
                </button>
             </div>
          </section>

          {/* Synthetic Payload Repository */}
          <section className="bg-surface-card backdrop-blur-3xl rounded-[6rem] overflow-hidden group border-2 border-surface-100 dark:border-primary-500/10 flex flex-col min-h-[1000px] shadow-2xl transition-all duration-700 hover:shadow-[0_80px_150px_rgba(0,0,0,0.5)]">
             <div className="px-8 sm:px-16 py-14 border-b-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between bg-surface-page/30 dark:bg-white/[0.02] gap-10">
                <div className="flex items-center gap-10">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/10 flex items-center justify-center border-2 border-primary-500/20 shadow-xl relative overflow-hidden group/rep hover:rotate-12 transition-all duration-700">
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-primary-500 group-hover/rep:h-full transition-all duration-700 opacity-20" />
                     <Cpu size={36} className="text-primary-500 relative z-10" />
                  </div>
                  <h2 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-4xl sm:text-5xl leading-none">Neural Payloads</h2>
                </div>
                {manifest && (
                  <button type="button" onClick={() => router.push('/dashboard/scheduler')}
                    className="px-10 py-5 bg-primary-600 text-white rounded-[4rem] text-[14px] font-black uppercase tracking-[0.5em] shadow-2xl hover:bg-primary-500 transition-all italic flex items-center gap-8 group/deploy border-none active:scale-95">
                    <Send size={28} className="group-hover/deploy:-rotate-12 group-hover/deploy:translate-x-2 transition-transform" /> DEPLOY_ALL
                  </button>
                )}
             </div>

             <div className="p-8 sm:p-20 flex-1 flex flex-col">
                {loading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-20">
                     <div className="w-64 h-64 bg-primary-500/5 border-8 border-primary-500/10 rounded-[7rem] flex items-center justify-center shadow-2xl relative group/load">
                        <div className="absolute inset-0 border-[12px] border-primary-500/20 border-t-primary-500 rounded-[7rem] animate-spin" />
                        <Sparkles size={100} className="text-primary-500 group-hover/load:scale-125 transition-transform duration-700" />
                     </div>
                     <div className="text-center space-y-8">
                        <p className="text-4xl sm:text-6xl font-black text-surface-900 dark:text-white uppercase tracking-[0.25em] italic leading-none animate-pulse">Forging Synthetic Logic</p>
                        <div className="flex items-center justify-center gap-10">
                           <div className="px-8 py-3 rounded-full bg-surface-page dark:bg-white/5 border-2 border-surface-100 dark:border-white/10 flex items-center gap-4 shadow-inner">
                              <CircuitBoard size={20} className="text-primary-500 animate-pulse" />
                              <span className="text-[12px] font-black text-primary-500 font-mono tracking-[0.4em] uppercase italic">NODE_LINK_ESTABLISHED</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {!loading && !manifest && (
                  <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-surface-100 dark:border-white/5 rounded-[8rem] opacity-20 gap-20 hover:opacity-40 transition-all duration-1000 group/empty bg-surface-page/10">
                    <div className="w-40 h-40 bg-surface-card dark:bg-white/5 rounded-[4.5rem] border-2 border-surface-100 dark:border-white/10 flex items-center justify-center shadow-inner group-hover/empty:rotate-[360deg] transition-transform duration-1000">
                      <Sparkles size={80} className="text-surface-400 dark:text-slate-800" />
                    </div>
                    <div className="text-center space-y-8 px-20">
                       <p className="text-4xl sm:text-6xl font-black text-surface-900 dark:text-white uppercase tracking-[0.5em] italic leading-tight opacity-40">Forge Buffer Empty</p>
                       <p className="text-[16px] sm:text-[18px] font-black text-surface-500 dark:text-slate-600 uppercase tracking-[0.8em] italic opacity-40">Manifest logic seeds to observe manifestation.</p>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {manifest && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="space-y-24">
                      {manifest.socialPosts?.length > 0 && (
                        <div className="space-y-16">
                          <div className="flex flex-col sm:flex-row items-center gap-10 px-10">
                             <h3 className="text-[16px] font-black text-surface-400 uppercase tracking-[1em] italic leading-none shrink-0">Resonance Array Matrix</h3>
                             <div className="flex-1 h-1 bg-surface-100 dark:bg-white/[0.05] rounded-full w-full shadow-inner" />
                          </div>
                          <div className="grid grid-cols-1 gap-16">
                            {manifest.socialPosts.map((post, idx) => {
                              const pCfg = RESONANCE_NODES.find(n => n.id === post.platform)
                              const cId = `payload_node_${idx}`
                              return (
                                <motion.article 
                                   initial={{ opacity: 0, scale: 0.95, x: 50 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: idx * 0.15, duration: 1 }}
                                   key={idx} className="bg-surface-page dark:bg-black/60 backdrop-blur-3xl rounded-[6rem] overflow-hidden group/payload shadow-2xl border-2 border-surface-100 dark:border-primary-500/10 hover:border-primary-500/50 transition-all duration-700"
                                >
                                   <div className={`p-1 flex flex-col`}>
                                      <div className={`flex flex-col sm:flex-row items-center justify-between px-10 sm:px-16 py-12 bg-gradient-to-br ${pCfg?.gradient || 'from-slate-800 to-black'} rounded-t-[5.8rem] border-b-2 border-white/10 shadow-2xl gap-10`}>
                                        <div className="flex items-center gap-12 text-white">
                                          <span className="text-5xl sm:text-7xl font-black drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover/payload:scale-125 group-hover/payload:rotate-12 transition-transform duration-700">{pCfg?.icon || '?'}</span>
                                          <div className="space-y-3">
                                             <span className="text-2xl sm:text-4xl font-black uppercase italic tracking-tighter block leading-none">{pCfg?.label.toUpperCase()}</span>
                                             {pCfg && <span className="text-white/40 text-[12px] font-mono tracking-widest uppercase block leading-none italic">{post.content.length} / {pCfg.limit} BITS_RESONANCE</span>}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                          <motion.button whileHover={{ y: -10 }} onClick={() => handleCapture(post.content, cId)}
                                            title="Copy content" aria-label="Copy content"
                                            className="w-16 h-16 bg-white/[0.05] border-2 border-white/20 rounded-[2rem] flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-2xl relative overflow-hidden group/cap active:scale-90">
                                            {copiedId === cId ? <Check size={32} className="text-emerald-400 relative z-10" /> : <Copy size={32} className="relative z-10" />}
                                            <div className="absolute inset-0 bg-white translate-y-full group-hover/cap:translate-y-0 transition-transform duration-700" />
                                          </motion.button>
                                          <button type="button" onClick={() => router.push(`/dashboard/scheduler?text=${encodeURIComponent(post.content)}&platform=${post.platform}`)}
                                            className="px-12 py-6 bg-white text-black hover:bg-primary-600 hover:text-white rounded-[2.5rem] text-[14px] font-black uppercase tracking-[0.6em] transition-all duration-700 italic flex items-center gap-8 shadow-2xl group/send overflow-hidden relative border-none active:scale-95">
                                             <div className="absolute inset-x-0 h-1 bg-primary-600 bottom-0 group-hover/send:h-full transition-all duration-1000 opacity-20" />
                                             <Send size={28} className="relative z-10 group-hover/send:translate-x-4 group-hover/send:-translate-y-4 transition-transform duration-700" /> <span className="relative z-10">DEPLOY</span>
                                          </button>
                                        </div>
                                      </div>
                                      <div className="p-10 sm:p-20 space-y-16">
                                        <p className="text-3xl sm:text-5xl font-black text-surface-900 dark:text-slate-200 italic leading-[1.1] uppercase tracking-tighter opacity-80 group-hover/payload:opacity-100 transition-opacity duration-700">{post.content}</p>
                                        {post.hashtags?.length > 0 && (
                                          <div className="flex flex-wrap gap-6">
                                            {post.hashtags.map((tag, i) => (
                                              <span key={i} className="text-[14px] font-black text-primary-500 bg-primary-500/10 px-8 py-3 rounded-[2rem] border-2 border-primary-500/20 italic tracking-widest uppercase hover:bg-primary-500/20 transition-all cursor-default shadow-lg">
                                                #{tag.replace('#', '').toUpperCase()}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="pt-12 border-t-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-8">
                                           <div className="flex items-center gap-6 text-[12px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-[0.6em] italic leading-none">
                                              <Gauge size={18} className="text-primary-500" /> RESONANCE_INDEX_0.98
                                           </div>
                                           <div className="w-full sm:w-48 h-2 bg-surface-page dark:bg-white/[0.05] rounded-full overflow-hidden shadow-inner ring-2 ring-white/5">
                                              <motion.div initial={{ width: 0 }} animate={{ width: '92%' }} transition={{ duration: 2, ease: 'easeOut' }} className="h-full bg-primary-500 shadow-[0_0_20px_rgba(99,102,241,0.8)]" />
                                           </div>
                                        </div>
                                      </div>
                                   </div>
                                </motion.article>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {manifest.blogSummary && (
                        <div className="space-y-16">
                          <div className="flex flex-col sm:flex-row items-center gap-10 px-10">
                             <h3 className="text-[16px] font-black text-surface-400 uppercase tracking-[1em] italic leading-none shrink-0">Strategic Core Narrative</h3>
                             <div className="flex-1 h-1 bg-surface-100 dark:bg-white/[0.05] rounded-full w-full shadow-inner" />
                          </div>
                          <motion.div initial={{ opacity: 0, scale: 0.95, y: 100 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.2 }} className="bg-surface-page dark:bg-black/60 backdrop-blur-3xl rounded-[7rem] overflow-hidden group/blog shadow-2xl border-2 border-surface-100 dark:border-emerald-500/10 hover:border-emerald-500/40 transition-all duration-700">
                             <div className="flex flex-col sm:flex-row items-center justify-between px-10 sm:px-20 py-14 bg-surface-page/50 dark:bg-emerald-900/10 border-b-2 border-surface-100 dark:border-white/5 shadow-inner gap-10">
                               <div className="flex items-center gap-10">
                                  <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20 shadow-xl group-hover/blog:rotate-12 transition-transform duration-700"><FileText size={36} className="text-emerald-500" /></div>
                                  <div>
                                     <span className="text-[12px] font-black text-emerald-500 uppercase tracking-[0.8em] italic block mb-2 leading-none">Synthetic Core Manifest</span>
                                     <span className="text-[10px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic block leading-none">FORGE_ORCHESTRATION_DATA_V1.2</span>
                                  </div>
                               </div>
                               <button type="button" onClick={() => handleCapture(manifest.blogSummary, 'manifest_summary')}
                                 className="px-12 py-6 bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-emerald-500 hover:text-white rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] shadow-2xl transition-all duration-700 italic flex items-center gap-8 group/cap-man border-none active:scale-95">
                                 {copiedId === 'manifest_summary' ? <Check size={28} className="text-emerald-400 group-hover/cap-man:text-white" /> : <Copy size={28} />}
                                 {copiedId === 'manifest_summary' ? 'CAPTURED' : 'CAPTURE_MANIFEST'}
                               </button>
                             </div>
                             <div className="p-10 sm:p-24">
                               <p className="text-[24px] sm:text-[36px] font-black text-surface-900 dark:text-slate-100 italic leading-[1.2] uppercase tracking-tighter opacity-80 group-hover/blog:opacity-100 transition-opacity duration-700">{manifest.blogSummary}</p>
                             </div>
                          </motion.div>
                        </div>
                      )}

                      {manifest.viralIdeas?.length > 0 && (
                        <div className="space-y-16">
                          <div className="flex flex-col sm:flex-row items-center gap-10 px-10">
                             <h3 className="text-[16px] font-black text-surface-400 uppercase tracking-[1em] italic leading-none shrink-0">Exponential Logic Phantoms</h3>
                             <div className="flex-1 h-1 bg-surface-100 dark:bg-white/[0.05] rounded-full w-full shadow-inner" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            {manifest.viralIdeas.map((idea, idx) => (
                              <motion.article 
                                 initial={{ opacity: 0, scale: 0.9, y: 80 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: idx * 0.2, duration: 1.2, type: 'spring', damping: 20 }}
                                 key={idx} className="p-10 sm:p-16 bg-surface-card dark:bg-black/40 border-2 border-surface-100 dark:border-amber-500/10 rounded-[6rem] shadow-2xl hover:border-amber-500/50 hover:bg-surface-page transition-all duration-700 group/v-node relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 p-20 opacity-[0.02] group-hover/v-node:opacity-[0.12] transition-all duration-1000 rotate-12 scale-150 pointer-events-none"><Zap size={200} className="text-amber-500" /></div>
                                <div className="flex items-start justify-between gap-12 mb-14 relative z-10">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-[1] mb-8 group-hover/v-node:text-amber-500 transition-colors duration-700">{idea.title.toUpperCase()}</h4>
                                    <div className="inline-flex items-center gap-6 px-8 py-4 rounded-[2.5rem] bg-amber-500/10 border-2 border-amber-500/20 shadow-xl">
                                       <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_20px_rgba(245,158,11,1)]" />
                                       <span className="text-[12px] font-black text-amber-500 uppercase tracking-[0.6em] italic leading-none">{idea.platform.toUpperCase()} NODE</span>
                                    </div>
                                  </div>
                                  <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/20 rounded-[2.5rem] flex items-center justify-center text-amber-500 group-hover/v-node:rotate-[360deg] transition-all duration-1000 shadow-2xl relative overflow-hidden flex-shrink-0">
                                     <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover/v-node:opacity-100 transition-opacity" />
                                     <Activity size={40} className="relative z-10" />
                                  </div>
                                </div>
                                <p className="text-[18px] sm:text-[20px] font-black text-surface-500 dark:text-slate-500 italic uppercase tracking-[0.1em] leading-relaxed relative z-10 opacity-60 group-hover/v-node:opacity-100 transition-opacity duration-700">{idea.description}</p>
                                <div className="mt-14 pt-10 border-t-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-6">
                                   <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.8em] italic leading-none opacity-40">VIRAL_COEFFICIENT_MAX</div>
                                   <div className="flex-1 h-2 bg-surface-page dark:bg-white/[0.05] rounded-full overflow-hidden w-full shadow-inner ring-2 ring-white/5">
                                      <motion.div initial={{ width: 0 }} animate={{ width: '96%' }} transition={{ duration: 2.5, ease: 'easeOut' }} className="h-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.8)]" />
                                   </div>
                                </div>
                              </motion.article>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-24 flex flex-col sm:flex-row gap-16 relative z-10">
                        <button type="button" onClick={() => router.push('/dashboard/scheduler')}
                          className="flex-1 flex items-center justify-center gap-12 py-16 sm:py-20 bg-surface-900 dark:bg-white text-white dark:text-black rounded-[7rem] text-[20px] sm:text-[24px] font-black uppercase tracking-[1em] shadow-[0_60px_150px_rgba(0,0,0,0.6)] hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all duration-700 italic hover:-translate-y-6 group/deploy-all border-none active:scale-95"
                        >
                          <Send size={56} className="group-hover/deploy-all:translate-x-10 group-hover/deploy-all:-translate-y-10 transition-transform duration-1000" /> DEPLOY_ALL_TRAJECTORIES
                        </button>
                        <button type="button" onClick={() => setManifest(null)} title="Purge Forge Buffer" aria-label="Purge Forge Buffer"
                          className="w-full sm:w-40 h-24 sm:h-auto bg-surface-card dark:bg-white/5 border-4 border-surface-100 dark:border-white/10 rounded-[4.5rem] text-surface-300 hover:text-primary-500 hover:border-primary-500/40 text-[18px] font-black uppercase tracking-[0.5em] shadow-2xl transition-all duration-700 italic hover:scale-90 group/purge active:rotate-180 flex items-center justify-center">
                          <RefreshCw size={44} className="group-hover/purge:rotate-180 transition-transform duration-1000" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </section>
        </main>

        {/* Intelligence HUD Channels */}
        <footer className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
          <div className="bg-surface-card backdrop-blur-3xl rounded-[7rem] group hover:border-primary-500/50 transition-all duration-700 flex flex-col shadow-2xl border-2 border-surface-100 dark:border-primary-500/10 hover:shadow-[0_60px_120px_rgba(0,0,0,0.5)]">
             <div className="px-10 sm:px-20 py-16 border-b-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-12 bg-surface-page/30 dark:bg-white/[0.02]">
                <div className="w-24 h-24 rounded-[3rem] bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-700"><Network size={48} className="text-primary-500" /></div>
                <div>
                   <h3 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-5xl sm:text-6xl leading-none mb-4">Neural Heuristics</h3>
                   <p className="text-[14px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-[0.6em] italic leading-none">Cognitive logic refinement recommendations.</p>
                </div>
             </div>
             <div className="p-10 sm:p-20 min-h-[600px] flex-1">
               <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-12 opacity-30"><RefreshCw size={80} className="animate-spin text-primary-500" /><p className="text-[18px] font-black text-primary-500 uppercase tracking-[1.2em] animate-pulse italic">Decrypting Heuristics...</p></div>}>
                 <AIRecommendations />
               </Suspense>
             </div>
          </div>
          <div className="bg-surface-card backdrop-blur-3xl rounded-[7rem] group hover:border-purple-500/50 transition-all duration-700 flex flex-col shadow-2xl border-2 border-surface-100 dark:border-purple-500/10 hover:shadow-[0_60px_120px_rgba(0,0,0,0.5)]">
             <div className="px-10 sm:px-20 py-16 border-b-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-12 bg-surface-page/30 dark:bg-white/[0.02]">
                <div className="w-24 h-24 rounded-[3rem] bg-purple-500/10 border-2 border-purple-500/20 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-700"><Gauge size={48} className="text-purple-400" /></div>
                <div>
                   <h3 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-5xl sm:text-6xl leading-none mb-4">Predictive Telemetry</h3>
                   <p className="text-[14px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-[0.6em] italic leading-none">Spectral trajectory forecasting mapping.</p>
                </div>
             </div>
             <div className="p-10 sm:p-20 min-h-[600px] flex-1">
               <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-12 opacity-30"><RefreshCw size={80} className="animate-spin text-purple-500" /><p className="text-[18px] font-black text-purple-500 uppercase tracking-[1.2em] animate-pulse italic">Scanning Trajectories...</p></div>}>
                 <PredictiveAnalytics />
               </Suspense>
             </div>
          </div>
        </footer>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
