'use client'

import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiPost } from '../../../lib/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { extractApiError } from '../../../utils/apiResponse'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import {
  Sparkles, ArrowLeft, Send, Copy, Check, Hash, Zap,
  ChevronRight, RefreshCw, ArrowUpRight, Layers, AlertCircle,
  CheckCircle, Radio, Cpu, Activity, Shield, Globe, Target, Flame, Terminal, X,
  LayoutGrid, LayoutList, FileText, Share2, Network, Gauge, Compass,
  Monitor, Boxes, Command, CircuitBoard, ActivitySquare, Database, Link2,
  Box, Fingerprint
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
  { id: 'twitter',   label: 'X_NODE',        icon: '𕔏',  gradient: 'from-slate-600 to-slate-950',         limit: 280 },
  { id: 'linkedin',  label: 'B2B_LATTICE',    icon: 'in', gradient: 'from-blue-600 to-indigo-900',       limit: 3000 },
]

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

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
    } catch { /* silent */ }
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
    setCopiedId(id); window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'LOGIC_CAPTURED', type: 'success' } }))
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Forge Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Sparkles size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Network size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Neural Forge Matrix v12.4</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                       <Radio size={14} className="text-indigo-400 animate-pulse" />
                       <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase italic leading-none">FORGE_CORE_IGNITED</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Neural Forge</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Transforming logic seeds into high-resonance synthetic content payloads.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={() => router.push('/dashboard/scheduler')}
                className="px-16 py-8 bg-white text-black hover:bg-emerald-500 hover:text-white rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_120px_rgba(255,255,255,0.1)] transition-all duration-1000 flex items-center gap-8 italic active:scale-95 group border-none"
              >
                <Send size={28} className="group-hover:translate-x-6 group-hover:-translate-y-6 transition-transform duration-1000" />
                DEPLOY_FORGE_PAYLOADS
              </button>
           </div>
        </header>

        {/* Status Messaging */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-rose-500/5 border border-rose-500/20 flex items-center justify-between gap-12 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><AlertCircle size={150} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner"><AlertCircle className="text-rose-500" size={44} /></div>
                  <p className="text-4xl font-black text-rose-500 uppercase tracking-tighter italic leading-none">{error}</p>
               </div>
               <button onClick={() => setError('')} className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center relative z-10"><X size={32} /></button>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between gap-12 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><CheckCircle size={150} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner border border-emerald-500/20"><CheckCircle className="text-emerald-500" size={44} /></div>
                  <p className="text-4xl font-black text-emerald-400 uppercase tracking-tighter italic leading-none">{success}</p>
               </div>
               <button onClick={() => setSuccess('')} className="w-16 h-16 rounded-full bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center relative z-10"><X size={32} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10">
          {/* Logic Injection Node */}
          <section className={`${glassStyle} rounded-[6rem] overflow-hidden group border-indigo-500/10 flex flex-col bg-black/40 shadow-[0_80px_200px_rgba(0,0,0,0.8)]`}>
             <div className="px-16 py-12 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-2xl"><Terminal size={32} className="text-indigo-400" /></div>
                  <h2 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Logic Injection</h2>
                </div>
                <div className="px-8 py-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-4">
                   <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-pulse" />
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] italic leading-none">SYNC_ACTIVE</span>
                </div>
             </div>

             <div className="p-20 space-y-16 flex-1 flex flex-col">
                <div className="space-y-8">
                  <label className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic pl-6">Operational Designation</label>
                  <div className="relative group/input">
                    <input type="text" value={designation} onChange={e => setDesignation(e.target.value)}
                      placeholder="PAYLOAD_IDENTIFIER_BETA..."
                      className="w-full bg-black/60 border-2 border-white/5 rounded-[3rem] px-16 py-10 text-3xl font-black text-white uppercase tracking-tighter italic focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-950 pr-32 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" 
                    />
                    <Hash size={36} className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-950 group-focus-within/input:text-indigo-500 transition-colors duration-700" />
                  </div>
                </div>

                <div className="space-y-8 flex-1 flex flex-col">
                  <div className="flex items-center justify-between px-8 border-l-8 border-indigo-500/20 ml-2">
                    <label className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">Logic Seed Matrix</label>
                    <div className="flex gap-10">
                       <span className="text-[11px] font-black text-indigo-500 font-mono tracking-widest uppercase opacity-60"> {logicSeed.length} BITS_DATA</span>
                       <span className="text-[11px] font-black text-indigo-500 font-mono tracking-widest uppercase opacity-60"> {logicSeed.trim().split(/\s+/).filter(Boolean).length} PARTICLES</span>
                    </div>
                  </div>
                  <div className="relative flex-1 group/area">
                    <textarea value={logicSeed} onChange={e => setLogicSeed(e.target.value)}
                      placeholder="PASTE_LONG_FORM_LOGIC_SEED_MIN_50_CHARS..."
                      className="w-full h-full bg-black/60 border-2 border-white/5 rounded-[4rem] px-16 py-16 text-3xl font-black text-slate-300 uppercase tracking-tighter italic focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-950 leading-relaxed resize-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] custom-scrollbar"
                    />
                    <div className="absolute right-12 bottom-12 p-6 bg-black/80 border border-white/10 rounded-3xl opacity-0 group-hover/area:opacity-100 transition-all duration-700 translate-y-4 group-hover/area:translate-y-0 shadow-2xl"><Boxes size={40} className="text-slate-900" /></div>
                  </div>
                </div>

                <div className="space-y-10">
                  <label className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic pl-6">Target Resonance Nodes</label>
                  <div className="flex flex-wrap gap-6">
                    {RESONANCE_NODES.map(node => {
                      const active = activeNodes.includes(node.id)
                      return (
                        <button key={node.id} onClick={() => toggleNode(node.id)}
                          className={`group flex items-center gap-8 px-12 py-6 rounded-[3.5rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-1000 border-2 italic relative overflow-hidden ${active ? `bg-white text-black border-transparent scale-110 shadow-[0_40px_80px_rgba(0,0,0,0.6)]` : 'bg-black/40 border-white/5 text-slate-800 hover:text-white hover:border-white/20'}`}>
                          <span className={`text-4xl transition-all duration-1000 relative z-10 ${active ? 'grayscale-0 rotate-12 scale-125' : 'grayscale text-slate-950 opacity-40 group-hover:grayscale-0 group-hover:opacity-100'}`}>{node.icon}</span> 
                          <span className="relative z-10">{node.label}</span>
                          <div className={`absolute inset-0 bg-gradient-to-br ${node.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-1000`} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button 
                   onClick={handleForgeInitiation} 
                   disabled={loading || !logicSeed.trim() || logicSeed.length < 50}
                   className="w-full flex items-center justify-center gap-12 py-16 bg-indigo-600 hover:bg-emerald-500 disabled:opacity-10 text-white rounded-[5rem] text-[20px] font-black uppercase tracking-[1em] shadow-[0_60px_150px_rgba(79,70,229,0.2)] transition-all duration-1000 hover:-translate-y-4 active:translate-y-0 italic border-none group/forge-btn"
                >
                  {loading ? (
                    <><RefreshCw size={44} className="animate-spin" /> IGNITING_FORGE...</>
                  ) : (
                    <><Flame size={44} className="group-hover/forge-btn:scale-125 transition-transform duration-1000 text-amber-400" /> FORGE_CONTENT</>
                  )}
                </button>
             </div>
          </section>

          {/* Synthetic Payload Repository */}
          <section className={`${glassStyle} rounded-[6rem] overflow-hidden group border-emerald-500/10 flex flex-col min-h-[1000px] bg-black/40 shadow-[0_80px_200px_rgba(0,0,0,0.8)]`}>
             <div className="px-16 py-12 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-2xl relative overflow-hidden group/rep">
                     <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 group-hover/rep:h-full transition-all duration-1000 opacity-20" />
                     <Cpu size={32} className="text-emerald-400 relative z-10" />
                  </div>
                  <h2 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Neural Payloads</h2>
                </div>
                {manifest && (
                  <button onClick={() => router.push('/dashboard/scheduler')}
                    className="px-12 py-6 bg-emerald-500 text-black rounded-[3rem] text-[13px] font-black uppercase tracking-[0.4em] shadow-2xl hover:bg-emerald-400 transition-all italic flex items-center gap-6 group/deploy">
                    <Send size={24} className="group-hover/deploy:-rotate-12 transition-transform" /> DEPLOY_ALL
                  </button>
                )}
             </div>

             <div className="p-20 flex-1 flex flex-col">
                {loading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-16">
                     <div className="w-48 h-48 bg-indigo-950/20 border-4 border-indigo-500/10 rounded-[5rem] flex items-center justify-center shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative group/load">
                        <div className="absolute inset-0 border-8 border-indigo-500/20 border-t-indigo-400 rounded-[5rem] animate-spin" />
                        <Sparkles size={80} className="text-indigo-400 group-hover/load:scale-125 transition-transform duration-1000 drop-shadow-[0_0_40px_rgba(99,102,241,0.6)]" />
                     </div>
                     <div className="text-center space-y-6">
                        <p className="text-5xl font-black text-white uppercase tracking-[0.2em] italic leading-none drop-shadow-2xl">Forging Synthetic Logic</p>
                        <div className="flex items-center justify-center gap-6">
                           <div className="px-5 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-3">
                              <CircuitBoard size={16} className="text-indigo-500 animate-pulse" />
                              <span className="text-[10px] font-black text-indigo-500 font-mono tracking-widest uppercase">NODE_LINK_ESTABLISHED</span>
                           </div>
                        </div>
                     </div>
                  </div>
                )}

                {!loading && !manifest && (
                  <div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-white/5 rounded-[7rem] opacity-20 gap-16 hover:opacity-40 transition-all duration-1000 group/empty">
                    <div className="w-32 h-32 bg-white/5 rounded-[3.5rem] border border-white/10 flex items-center justify-center shadow-[inset_0_0_80px_rgba(0,0,0,0.5)] group-hover/empty:rotate-45 transition-transform duration-1000">
                      <Sparkles size={64} className="text-white opacity-40" />
                    </div>
                    <div className="text-center space-y-6 px-16">
                       <p className="text-5xl font-black text-white uppercase tracking-[0.4em] italic leading-tight opacity-40">Forge Buffer Empty</p>
                       <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.6em] italic opacity-40">Manifest logic seeds to observe synthetic manifestation.</p>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {manifest && (
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-16">
                      {manifest.socialPosts?.length > 0 && (
                        <div className="space-y-12">
                          <div className="flex items-center gap-8 px-8">
                             <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none">Resonance Array Matrix</h3>
                             <div className="flex-1 h-1 bg-white/[0.03] rounded-full" />
                          </div>
                          <div className="grid grid-cols-1 gap-12">
                            {manifest.socialPosts.map((post, idx) => {
                              const pCfg = RESONANCE_NODES.find(n => n.id === post.platform)
                              const cId = `payload_node_${idx}`
                              return (
                                <motion.article 
                                   initial={{ opacity: 0, scale: 0.9, x: 30 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ delay: idx * 0.1, duration: 1 }}
                                   key={idx} className={`${glassStyle} rounded-[5rem] overflow-hidden group/payload bg-black/60 shadow-[0_40px_100px_rgba(0,0,0,0.6)] border-indigo-500/10 hover:border-indigo-500/40`}
                                >
                                  <div className={`p-1 flex flex-col`}>
                                     <div className={`flex items-center justify-between px-12 py-8 bg-gradient-to-br ${pCfg?.gradient || 'from-slate-800 to-black'} rounded-t-[4.8rem] border-b border-white/10 shadow-2xl`}>
                                       <div className="flex items-center gap-10 text-white">
                                         <span className="text-5xl font-black drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] group-hover/payload:scale-125 transition-transform duration-1000">{pCfg?.icon || '?'}</span>
                                         <div className="space-y-2">
                                            <span className="text-2xl font-black uppercase italic tracking-tighter block leading-none">{pCfg?.label.toUpperCase()}</span>
                                            {pCfg && <span className="text-white/40 text-[10px] font-mono tracking-widest uppercase block leading-none">{post.content.length} / {pCfg.limit} BITS_RESONANCE</span>}
                                         </div>
                                       </div>
                                       <div className="flex items-center gap-6">
                                         <motion.button whileHover={{ y: -5 }} onClick={() => handleCapture(post.content, cId)}
                                           className="w-16 h-16 bg-white/[0.02] border border-white/20 rounded-[1.8rem] flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-2xl relative overflow-hidden group/cap">
                                           {copiedId === cId ? <CheckCircle size={28} className="text-emerald-400 relative z-10" /> : <Copy size={28} className="relative z-10" />}
                                           <div className="absolute inset-0 bg-white translate-y-full group-hover/cap:translate-y-0 transition-transform duration-700" />
                                         </motion.button>
                                         <button onClick={() => router.push(`/dashboard/scheduler?text=${encodeURIComponent(post.content)}&platform=${post.platform}`)}
                                           className="px-10 py-5 bg-white text-black hover:bg-emerald-500 hover:text-white rounded-[2rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic flex items-center gap-5 shadow-[0_20px_60px_rgba(255,255,255,0.1)] group/send overflow-hidden relative">
                                            <div className="absolute inset-x-0 h-1 bg-emerald-500 bottom-0 group-hover/send:h-full transition-all duration-700 opacity-20" />
                                            <Send size={20} className="relative z-10 group-hover/send:translate-x-2 transition-transform" /> <span className="relative z-10">DEPLOY</span>
                                         </button>
                                       </div>
                                     </div>
                                     <div className="p-16 space-y-12">
                                       <p className="text-4xl font-black text-slate-200 italic leading-[1.15] uppercase tracking-tighter drop-shadow-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-1000">{post.content}</p>
                                       {post.hashtags?.length > 0 && (
                                         <div className="flex flex-wrap gap-5">
                                           {post.hashtags.map((tag, i) => (
                                             <span key={i} className="text-[12px] font-black text-indigo-400 bg-indigo-500/10 px-8 py-3 rounded-[1.5rem] border border-indigo-500/20 italic tracking-widest uppercase shadow-[0_0_40px_rgba(99,102,241,0.2)] hover:bg-indigo-500/20 transition-all cursor-default">
                                               #{tag.replace('#', '').toUpperCase()}
                                             </span>
                                           ))}
                                         </div>
                                       )}
                                       <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                                          <div className="flex items-center gap-4 text-[10px] font-black text-slate-800 uppercase tracking-widest italic leading-none">
                                             <Gauge size={14} className="text-indigo-500" /> RESONANCE_INDEX_0.98
                                          </div>
                                          <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                             <motion.div initial={{ width: 0 }} animate={{ width: '90%' }} transition={{ duration: 1.5 }} className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
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
                        <div className="space-y-12">
                          <div className="flex items-center gap-8 px-8">
                             <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none">Strategic Core Narrative</h3>
                             <div className="flex-1 h-1 bg-white/[0.03] rounded-full" />
                          </div>
                          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className={`${glassStyle} rounded-[6rem] overflow-hidden group/blog bg-black/60 shadow-[0_60px_150px_rgba(0,0,0,0.6)] border-emerald-500/10 hover:border-emerald-500/40`}>
                             <div className="flex items-center justify-between px-16 py-10 bg-slate-950 border-b border-white/5 shadow-inner">
                               <div className="flex items-center gap-8">
                                  <div className="w-16 h-16 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><FileText size={28} className="text-emerald-400" /></div>
                                  <span className="text-[12px] font-black text-white uppercase tracking-[0.6em] italic opacity-40">Synthetic Core Manifest v1.0</span>
                               </div>
                               <button onClick={() => handleCapture(manifest.blogSummary, 'manifest_summary')}
                                 className="px-10 py-5 bg-white text-black hover:bg-emerald-500 hover:text-white rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.4em] shadow-2xl transition-all duration-1000 italic flex items-center gap-6 group/cap-man border-none">
                                 {copiedId === 'manifest_summary' ? <CheckCircle size={20} className="text-emerald-400 group-hover/cap-man:text-white" /> : <Copy size={20} />}
                                 {copiedId === 'manifest_summary' ? 'CAPTURED' : 'CAPTURE_MANIFEST'}
                               </button>
                             </div>
                             <div className="p-20">
                               <p className="text-[28px] font-black text-slate-200 italic leading-relaxed uppercase tracking-tighter drop-shadow-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-1000">{manifest.blogSummary}</p>
                             </div>
                          </motion.div>
                        </div>
                      )}

                      {manifest.viralIdeas?.length > 0 && (
                        <div className="space-y-12">
                          <div className="flex items-center gap-8 px-8">
                             <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none">Exponential Logic Phantoms</h3>
                             <div className="flex-1 h-1 bg-white/[0.03] rounded-full" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {manifest.viralIdeas.map((idea, idx) => (
                              <motion.article 
                                 initial={{ opacity: 0, scale: 0.9, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: idx * 0.1, duration: 1.2 }}
                                 key={idx} className="p-12 bg-amber-500/[0.03] border-2 border-amber-500/10 rounded-[5rem] shadow-[0_40px_100px_rgba(0,0,0,0.5)] hover:border-amber-500/40 transition-all duration-1000 group/v-node relative overflow-hidden bg-black/40"
                              >
                                <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover/v-node:opacity-[0.1] transition-all duration-1000 rotate-12 scale-150"><Zap size={150} /></div>
                                <div className="flex items-start justify-between gap-10 mb-10 relative z-10">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-[1.1] mb-6 group-hover:text-amber-400 transition-colors duration-1000 drop-shadow-2xl">{idea.title.toUpperCase()}</h4>
                                    <div className="inline-flex items-center gap-5 px-6 py-3 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                                       <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,1)]" />
                                       <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.4em] italic leading-none">{idea.platform.toUpperCase()} NODE</span>
                                    </div>
                                  </div>
                                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-[1.8rem] flex items-center justify-center text-amber-500 group-hover/v-node:rotate-[360deg] transition-all duration-1000 shadow-2xl relative overflow-hidden">
                                     <div className="absolute inset-0 bg-amber-500/10 opacity-0 group-hover/v-node:opacity-100 transition-opacity" />
                                     <Activity size={32} className="relative z-10" />
                                  </div>
                                </div>
                                <p className="text-[15px] font-black text-slate-800 italic uppercase tracking-[0.1em] leading-relaxed relative z-10 opacity-60 group-hover:opacity-100 transition-opacity duration-1000">{idea.description}</p>
                                <div className="mt-10 pt-8 border-t border-white/5 flex items-center gap-5">
                                   <div className="text-[9px] font-black text-amber-500/40 uppercase tracking-widest italic leading-none">VIRAL_COEFFICIENT_MAX</div>
                                   <div className="flex-1 h-1 bg-white/[0.02] rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: '95%' }} transition={{ duration: 2 }} className="h-full bg-amber-500" />
                                   </div>
                                </div>
                              </motion.article>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-20 flex gap-12 relative z-10">
                        <button onClick={() => router.push('/dashboard/scheduler')}
                          className="flex-1 flex items-center justify-center gap-10 py-16 bg-emerald-600 text-white rounded-[5.5rem] text-[20px] font-black uppercase tracking-[0.8em] shadow-[0_60px_150px_rgba(16,185,129,0.3)] hover:bg-white hover:text-black transition-all duration-1000 italic hover:-translate-y-4 group/deploy-all border-none"
                        >
                          <Send size={44} className="group-hover/deploy-all:translate-x-6 group-hover/deploy-all:-translate-y-6 transition-transform duration-1000" /> DEPLOY_ALL_TRAJECTORIES
                        </button>
                        <button onClick={() => setManifest(null)}
                          className="px-16 py-10 bg-white/5 border-2 border-white/10 rounded-[5.5rem] text-slate-800 hover:text-white hover:border-white/40 text-[14px] font-black uppercase tracking-[0.5em] shadow-2xl transition-all duration-1000 italic hover:scale-95 group/purge">
                          <RefreshCw size={28} className="group-hover/purge:rotate-180 transition-transform duration-1000" />
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
          <div className={`${glassStyle} rounded-[6rem] group hover:border-indigo-500/40 transition-all duration-1000 flex flex-col bg-black/40 shadow-[0_60px_120px_rgba(0,0,0,0.6)]`}>
             <div className="px-16 py-12 border-b border-white/5 flex items-center gap-10 bg-white/[0.02]">
                <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-1000"><Network size={40} className="text-indigo-400" /></div>
                <div>
                   <h3 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none mb-3">Neural Heuristics</h3>
                   <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none">Cognitive logic refinement recommendations and sentiment sync.</p>
                </div>
             </div>
             <div className="p-16 min-h-[600px] flex-1">
               <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-10 opacity-40"><RefreshCw size={64} className="animate-spin text-indigo-500" /><p className="text-[14px] font-black text-indigo-500 uppercase tracking-[1em] animate-pulse italic">Decrypting Heuristics...</p></div>}>
                 <AIRecommendations />
               </Suspense>
             </div>
          </div>
          <div className={`${glassStyle} rounded-[6rem] group hover:border-purple-500/40 transition-all duration-1000 flex flex-col bg-black/40 shadow-[0_60px_120px_rgba(0,0,0,0.6)]`}>
             <div className="px-16 py-12 border-b border-white/5 flex items-center gap-10 bg-white/[0.02]">
                <div className="w-20 h-20 rounded-[2.5rem] bg-purple-500/5 border border-purple-500/20 flex items-center justify-center shadow-2xl group-hover:rotate-12 transition-transform duration-1000"><Gauge size={40} className="text-purple-400" /></div>
                <div>
                   <h3 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none mb-3">Predictive Telemetry</h3>
                   <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none">Spectral trajectory forecasting and global resonance mapping.</p>
                </div>
             </div>
             <div className="p-16 min-h-[600px] flex-1">
               <Suspense fallback={<div className="flex flex-col items-center justify-center h-full gap-10 opacity-40"><RefreshCw size={64} className="animate-spin text-purple-500" /><p className="text-[14px] font-black text-purple-500 uppercase tracking-[1em] animate-pulse italic">Scanning Trajectories...</p></div>}>
                 <PredictiveAnalytics />
               </Suspense>
             </div>
          </div>
        </footer>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.15); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.3); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
