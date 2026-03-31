'use client'

import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Twitter, Linkedin, Facebook, Instagram, Youtube, Video,
  Unlink, ExternalLink, ChevronRight, CheckCircle, AlertCircle,
  Shield, Zap, Globe, Radio, Cpu, Lock, ArrowRight, Activity, X,
  Terminal, Layers, ArrowUpRight, Hexagon, Users, RefreshCw, ArrowLeft,
  Network, Share2, Sparkles, BarChart3, Calendar, Quote, Gauge, Fingerprint,
  Monitor, Boxes, Command, CircuitBoard, ActivitySquare, Database, Link2
} from 'lucide-react'
import { apiGet, apiDelete, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface NodeAccount {
  id: string; platform: string; platform_user_id: string; username: string;
  display_name: string; avatar?: string; is_connected: boolean;
  metadata?: any; created_at: string;
}

interface ResonanceMatrix {
  twitter: NodeAccount | NodeAccount[] | null; linkedin: NodeAccount | null;
  facebook: NodeAccount | null; instagram: NodeAccount | null;
  youtube: NodeAccount | null; tiktok: NodeAccount | null;
}

function ResonanceProtocolAudit() {
  const [audit, setAudit] = useState<Record<string, boolean> | null>(null)
  
  useEffect(() => {
    apiGet<{ configured?: Record<string, boolean> }>('/oauth/status')
      .then((r) => setAudit(r?.configured || {}))
      .catch(() => setAudit({}))
  }, [])

  const nodes = [
    { key: 'tiktok',    label: 'KINETIC_NODE', desc: 'Flux_Reaction_Mesh' },
    { key: 'instagram', label: 'VISUAL_MESH', desc: 'Aesthetic_Ref_Induction' },
    { key: 'youtube',   label: 'STREAM_CORE', desc: 'Narrative_Seq_Prop' },
    { key: 'twitter',   label: 'X_NODE',   desc: 'Signal_Diffusion_Field' },
    { key: 'linkedin',  label: 'B2B_LATTICE', desc: 'Sync_Protocol_Alpha' },
    { key: 'facebook',  label: 'META_NODE', desc: 'Mass_Aggregator_Beta' },
  ]

  return (
    <div className={`${glassStyle} rounded-[6rem] p-20 relative overflow-hidden mt-32 group border-indigo-500/10 shadow-[0_60px_150px_rgba(0,0,0,0.8)] bg-black/40`}>
      <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none group-hover:rotate-12 transition-transform duration-1000"><Shield size={400} className="text-white" /></div>
      <div className="flex items-center gap-10 mb-16 relative z-10">
        <div className="w-24 h-24 bg-indigo-500/5 rounded-[3rem] flex items-center justify-center border border-indigo-500/20 shadow-2xl"><Fingerprint className="text-indigo-400" size={48} /></div>
        <div>
           <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Protocol Audit</h2>
           <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">Autonomous node decryption and presence verification active.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 relative z-10">
        {nodes.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between p-12 bg-black/60 border border-white/5 rounded-[4rem] group/node hover:bg-white/[0.04] transition-all hover:border-indigo-500/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-3">
               <span className="text-2xl font-black text-white uppercase tracking-tighter italic group-hover/node:text-indigo-400 transition-colors leading-none">{label}</span>
               <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none">{desc}</span>
            </div>
            <div className="flex items-center gap-6">
              {audit === null ? (
                <div className="w-10 h-10 rounded-full border-4 border-slate-900 border-t-indigo-500 animate-spin" />
              ) : audit[key] ? (
                <div className="flex items-center gap-4 px-8 py-3 rounded-full bg-emerald-500/5 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)] group-hover/node:bg-emerald-500 group-hover/node:text-black transition-all">
                  <CheckCircle className="w-6 h-6 text-emerald-500 group-hover/node:text-black" />
                  <span className="text-[11px] font-black uppercase italic tracking-[0.2em] group-hover/node:text-black leading-none">RESONANT</span>
                </div>
              ) : (
                <div className="flex items-center gap-4 px-8 py-3 rounded-full bg-rose-500/5 border border-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.2)] group-hover/node:bg-rose-500 group-hover/node:text-white transition-all">
                  <AlertCircle className="w-6 h-6 text-rose-500 group-hover/node:text-white" />
                  <span className="text-[11px] font-black uppercase italic tracking-[0.2em] group-hover/node:text-white leading-none">ISOLATED</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResonanceHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [terminating, setTerminating] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<ResonanceMatrix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const completedRef = useRef(false)

  const loadMatrix = useCallback(async () => {
    try {
      setLoading(true)
      const response: any = await apiGet('/oauth/accounts')
      setMatrix(response.accounts || response)
    } catch {
      setError('UPLINK_ERR: TOPOLOGY_VOID')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMatrix() }, [loadMatrix])

  useEffect(() => {
    const sParam = searchParams.get('success')
    const eParam = searchParams.get('error')
    const pParam = searchParams.get('platform')
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (pParam && code && state && (pParam === 'linkedin' || pParam === 'facebook') && !completedRef.current) {
      completedRef.current = true
      apiPost(`/oauth/${pParam}/complete`, { code, state })
        .then(() => {
          setSuccess(`UPLINK_COMPLETE: ${pParam.toUpperCase()}_NODE_RESONANT`)
          router.replace('/dashboard/social?success=true&platform=' + pParam)
          loadMatrix()
        })
        .catch(() => {
          setError(`UPLINK_FAILED: ${pParam.toUpperCase()}_DIFFRACTION`)
          router.replace('/dashboard/social?error=link_diffraction')
        })
      return
    }

    if (sParam === 'true' && pParam) {
      setSuccess(`LATTICE_SYNC_OK: ${pParam.toUpperCase()}_NODE_SYNCED`)
    } else if (eParam) {
      setError(`MESH_DIFFRACTION: SYNC_ABORTED_${pParam?.toUpperCase() || 'NODE'}`)
    }
  }, [searchParams, router, loadMatrix])

  const handleSyncInitiation = async (platform: string) => {
    try {
      setSyncing(platform)
      const response: any = await apiGet(`/oauth/${platform}/connect`)
      window.location.href = response.auth_url
    } catch {
      setError(`MESH_INJECTION_FAIL: ABORTED`)
      setSyncing(null)
    }
  }

  const handleSyncTermination = async (platform: string, userId: string) => {
    if (!confirm(`CAUTION: TERMINATING RESONANCE WITH ${platform.toUpperCase()} NODE. PROCEED?`)) return
    try {
      setTerminating(platform)
      await apiDelete(`/oauth/${platform}/disconnect`, { data: { platform_user_id: userId } })
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'NODE_DE-TERMINATED', type: 'success' } }))
      await loadMatrix()
    } catch {
      setError(`SYNC_TERMINATION_ERR`)
    } finally {
      setTerminating(null)
    }
  }

  const getPlatformIcon = (p: string) => {
    const i = { twitter: Twitter, linkedin: Linkedin, facebook: Facebook, instagram: Instagram, youtube: Youtube, tiktok: Video }
    return i[p as keyof typeof i] || Globe
  }

  const getPlatformGradient = (p: string) => {
    const g = {
      twitter: 'from-slate-400 to-slate-900',
      linkedin: 'from-blue-700 to-indigo-900',
      facebook: 'from-blue-600 to-blue-800',
      instagram: 'from-pink-600 to-purple-700',
      youtube: 'from-red-600 to-rose-900',
      tiktok: 'from-slate-800 to-black'
    }
    return g[p as keyof typeof g] || 'from-slate-700 to-black'
  }

  const getXNodes = (): NodeAccount[] => {
    const t = matrix?.twitter
    if (!t) return []
    return Array.isArray(t) ? t : [t]
  }

  const renderNodeCard = (p: string, account: NodeAccount | null, meta: { label: string; desc: string; url?: string }) => {
    const Icon = getPlatformIcon(p)
    const gradients = getPlatformGradient(p)
    
    return (
      <motion.div 
         initial={{ opacity: 0, y: 30 }} 
         animate={{ opacity: 1, y: 0 }}
         whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }}
         key={p} 
         className={`${glassStyle} rounded-[6rem] p-12 flex flex-col group border-white/5 h-full shadow-[0_60px_120px_rgba(0,0,0,0.6)] bg-black/40`}
      >
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-10">
            <div className={`w-24 h-24 rounded-[3rem] bg-gradient-to-br ${gradients} flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-all duration-1000 border border-white/20`}>
              <Icon size={48} />
            </div>
            <div>
              <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">{meta.label}</h3>
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none">{meta.desc}</p>
            </div>
          </div>
          {account ? (
             <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.3)] animate-pulse">
                <CheckCircle size={40} />
             </div>
          ) : (
             <div className="w-20 h-20 rounded-[2.5rem] bg-black/60 border border-white/5 flex items-center justify-center text-slate-950 group-hover:text-indigo-500 transition-all duration-1000 shadow-inner">
                <Radio size={40} className="animate-pulse" />
             </div>
          )}
        </div>

        {account ? (
          <div className="space-y-10 flex-1 flex flex-col justify-between">
             <div className="p-12 rounded-[4rem] bg-black/60 border border-white/5 flex items-center gap-10 group/item hover:bg-black/80 transition-all shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/item:opacity-10 transition-opacity rotate-12"><CircuitBoard size={150} /></div>
                {account.avatar ? (
                  <img src={account.avatar} alt={account.display_name} className="w-24 h-24 rounded-[3rem] border-4 border-white/10 shadow-2xl grayscale group-hover/item:grayscale-0 transition-all duration-1000" />
                ) : (
                  <div className="w-24 h-24 rounded-[3rem] bg-white/5 border border-white/10 flex items-center justify-center"><Users size={40} className="text-slate-900" /></div>
                )}
                <div className="flex-1 min-w-0 relative z-10">
                   <p className="text-3xl font-black text-white truncate uppercase italic tracking-tighter leading-none mb-4">{account.display_name}</p>
                   <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] italic group-hover/item:text-indigo-400 transition-colors leading-none font-mono">ID: {account.username}</p>
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                   {meta.url && (
                     <button onClick={() => window.open(meta.url!.replace('{username}', account.username), '_blank')}
                       className="w-16 h-16 bg-white text-black rounded-[1.8rem] hover:bg-white hover:text-black transition-all flex items-center justify-center shadow-xl group/btn scale-100 hover:scale-110" title="Peek"><ExternalLink size={28} /></button>
                   )}
                   <button onClick={() => handleSyncTermination(p, account.platform_user_id)} disabled={terminating === p}
                     className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-[1.8rem] text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-95" title="Terminate"><Unlink size={28} /></button>
                </div>
             </div>
             <div className="px-10 py-6 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center gap-6 shadow-inner">
                <ActivitySquare size={20} className="text-emerald-500 animate-pulse" />
                <span className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.6em] italic leading-none">NODE_RESONANCE_STEADY</span>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-end pt-20">
            <button
              onClick={() => handleSyncInitiation(p)}
              disabled={syncing === p}
              className="w-full py-12 bg-white text-black rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center justify-center gap-10 disabled:opacity-20 shadow-[0_60px_120px_rgba(255,255,255,0.1)] italic group relative overflow-hidden active:scale-95 border-none"
            >
              <div className="absolute inset-x-0 h-1 bg-indigo-500 bottom-0 group-hover:h-full transition-all duration-700" />
              <div className="relative z-10 flex items-center gap-10">
                 {syncing === p ? (
                    <RefreshCw className="w-10 h-10 animate-spin" />
                 ) : (
                    <Link2 size={32} className="group-hover:rotate-45 transition-transform duration-1000" />
                 )}
                 {syncing === p ? 'INITIATING_LINK...' : `LINK_${p.toUpperCase()}_NODE`}
              </div>
            </button>
          </div>
        )}
      </motion.div>
    )
  }

  const renderXNodesCard = () => {
    const xNodes = getXNodes()
    const Icon = Twitter
    const gradients = getPlatformGradient('twitter')
    const meta = { label: 'X_NODE', desc: 'SIGNAL_PROJECTION_FIELD' }
    
    return (
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -15, backgroundColor: 'rgba(255,255,255,0.06)' }} className={`${glassStyle} rounded-[6rem] p-12 flex flex-col group border-white/5 h-full shadow-[0_60px_120px_rgba(0,0,0,0.6)] bg-black/40`}>
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-10">
            <div className={`w-24 h-24 rounded-[3rem] bg-gradient-to-br ${gradients} flex items-center justify-center text-white shadow-2xl group-hover:rotate-12 transition-all duration-1000 border border-white/20`}>
              <Icon size={48} />
            </div>
            <div>
              <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">{meta.label}</h3>
              <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em] mt-3 italic leading-none">{meta.desc}</p>
            </div>
          </div>
          {xNodes.length > 0 ? (
             <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.3)] animate-pulse">
                <CheckCircle size={40} />
             </div>
          ) : (
             <div className="w-20 h-20 rounded-[2.5rem] bg-black/60 border border-white/5 flex items-center justify-center text-slate-950 group-hover:text-indigo-500 transition-all duration-1000 shadow-inner">
                <Radio size={40} className="animate-pulse" />
             </div>
          )}
        </div>

        <div className="space-y-10 flex-1 flex flex-col">
          {xNodes.length > 0 && (
             <div className="space-y-8 max-h-[600px] overflow-y-auto custom-scrollbar pr-6">
                {xNodes.map((account) => (
                  <div key={account.platform_user_id} className="p-12 rounded-[4rem] bg-black/60 border border-white/5 flex items-center gap-10 hover:bg-black/80 transition-all shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] group/node relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/node:opacity-10 transition-opacity rotate-12"><Radio size={150} /></div>
                    {account.avatar ? (
                      <img src={account.avatar} alt={account.display_name} className="w-24 h-24 rounded-[3rem] border-4 border-white/10 shadow-2xl grayscale group-hover/node:grayscale-0 transition-all duration-1000" />
                    ) : (
                      <div className="w-24 h-24 rounded-[3rem] bg-white/5 border border-white/10 flex items-center justify-center text-slate-950"><Users size={40} /></div>
                    )}
                    <div className="flex-1 min-w-0 relative z-10">
                       <p className="text-3xl font-black text-white truncate uppercase italic tracking-tighter leading-none mb-4">{account.display_name}</p>
                       <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none font-mono">@{account.username}</p>
                    </div>
                    <div className="flex flex-col gap-4 relative z-10">
                       <button onClick={() => window.open(`https://twitter.com/${account.username}`, '_blank')}
                         className="w-16 h-16 bg-white text-black rounded-[1.8rem] transition-all flex items-center justify-center shadow-xl hover:scale-110"><ExternalLink size={28} /></button>
                       <button onClick={() => handleSyncTermination('twitter', account.platform_user_id)} disabled={terminating === 'twitter'}
                         className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-[1.8rem] text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-95"><Unlink size={28} /></button>
                    </div>
                  </div>
                ))}
             </div>
          )}
          
          <button
            onClick={() => handleSyncInitiation('twitter')}
            disabled={syncing === 'twitter'}
            className="w-full mt-auto py-12 bg-white text-black rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white shadow-[0_60px_120px_rgba(255,255,255,0.1)] transition-all duration-1000 disabled:opacity-20 italic group relative overflow-hidden active:scale-95 border-none"
          >
            <div className="absolute inset-x-0 h-1 bg-indigo-500 bottom-0 group-hover:h-full transition-all duration-700" />
            <div className="relative z-10 flex items-center justify-center gap-10">
               {syncing === 'twitter' ? (
                  <RefreshCw className="w-10 h-10 animate-spin" />
               ) : (
                  <Link2 size={32} className="group-hover:rotate-45 transition-transform duration-1000" />
               )}
               {syncing === 'twitter' ? 'SYNCHRONIZING...' : xNodes.length > 0 ? 'LINK_ADDITIONAL_NODE' : 'LINK_X_NODE'}
            </div>
          </button>
        </div>
      </motion.div>
    )
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
      <Activity size={80} className="text-indigo-500 animate-pulse mb-12 drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
      <span className="text-[16px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Synchronizing Mesh Topology...</span>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Globe size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Matrix Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Network size={48} className="text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Resonance Hub v9.8.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                       <Radio size={14} className="text-indigo-400 animate-pulse" />
                       <span className="text-[10px] font-black text-indigo-400 tracking-widest uppercase italic leading-none">MESH_SYNC_OPTIMAL</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Resonance Hub</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Managing autonomous node identity matrices and global grid resonance topology.</p>
              </div>
           </div>

           <button onClick={loadMatrix}
             className="px-16 py-8 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_40px_100px_rgba(255,255,255,0.1)] transition-all duration-1000 flex items-center gap-8 italic active:scale-95 group border-none"
           >
             <RefreshCw size={28} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-1000'}`} />
             REFRESH_MESH_GEOMETRY
           </button>
        </header>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-rose-500/5 border border-rose-500/20 flex items-center justify-between gap-12 shadow-[0_40px_100px_rgba(244,63,94,0.1)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><AlertCircle size={150} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner"><AlertCircle className="text-rose-500" size={44} /></div>
                  <div>
                    <h4 className="text-[12px] font-black text-rose-500 uppercase tracking-[0.5em] italic mb-2">SYSTEM_DIFFRACTION_DETECTED</h4>
                    <p className="text-4xl font-black text-rose-400 uppercase tracking-tighter italic leading-none">{error}</p>
                  </div>
               </div>
               <button onClick={() => setError(null)} className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center relative z-10"><X size={32} /></button>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-12 rounded-[5rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between gap-12 shadow-[0_40px_100px_rgba(16,185,129,0.1)] relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-20 transition-opacity"><CheckCircle size={150} /></div>
               <div className="flex items-center gap-12 relative z-10">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center shadow-inner border border-emerald-500/20"><CheckCircle className="text-emerald-500" size={44} /></div>
                  <div>
                    <h4 className="text-[12px] font-black text-emerald-500 uppercase tracking-[0.5em] italic mb-2">OPERATIONAL_SYNC_SUCCESS</h4>
                    <p className="text-4xl font-black text-emerald-400 uppercase tracking-tighter italic leading-none">{success}</p>
                  </div>
               </div>
               <button onClick={() => setSuccess(null)} className="w-16 h-16 rounded-full bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center relative z-10"><X size={32} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Node Matrix Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20 relative z-10">
          {renderXNodesCard()}
          {renderNodeCard('linkedin', matrix?.linkedin ?? null, { label: 'B2B_LATTICE', desc: 'PROFESSIONAL_SYNDICATION_ALPHA' })}
          {renderNodeCard('facebook', matrix?.facebook ?? null, { label: 'META_NODE', desc: 'COMMUNITY_AGGREGATION_BETA' })}
          {renderNodeCard('instagram', matrix?.instagram ?? null, { label: 'VISUAL_MESH', desc: 'AESTHETIC_INDUCTION_CORE', url: 'https://instagram.com/{username}' })}
          {renderNodeCard('youtube', matrix?.youtube ?? null, { label: 'STREAM_CORE', desc: 'NARRATIVE_SEQUENCE_DELTA', url: 'https://youtube.com/@{username}' })}
          {renderNodeCard('tiktok', matrix?.tiktok ?? null, { label: 'KINETIC_NODE', desc: 'REACTIONARY_FLUX_MESH', url: 'https://tiktok.com/@{username}' })}
        </div>

        <ResonanceProtocolAudit />

        {/* Neural Grid Access */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 relative z-10 pt-32 border-t border-white/5">
           {[
             { label: 'Spectral Sync', desc: 'Performance heuristics.', icon: BarChart3, color: 'text-indigo-400', href: '/dashboard/analytics' },
             { label: 'Temporal Hub', desc: 'Node deployment windows.', icon: Calendar, color: 'text-emerald-400', href: '/dashboard/scheduler' },
             { label: 'Neural Forge', desc: 'Synthetic logic crafting.', icon: Sparkles, color: 'text-purple-400', href: '/dashboard/content' },
             { label: 'Axiom Vault',  desc: 'Wisdom fractal repository.', icon: Quote, color: 'text-amber-400', href: '/dashboard/quotes' },
           ].map((a, i) => (
             <motion.button whileHover={{ y: -20, backgroundColor: 'rgba(255,255,255,0.08)' }} key={a.label} onClick={() => router.push(a.href)} className={`${glassStyle} p-16 rounded-[6rem] group text-center flex flex-col items-center gap-12 border-white/5 hover:border-indigo-500/40 transition-all duration-1000 shadow-[0_60px_100px_rgba(0,0,0,0.6)] bg-black/40`}>
                <div className="w-24 h-24 bg-white/[0.02] border border-white/10 rounded-[3rem] flex items-center justify-center group-hover:rotate-45 group-hover:scale-125 transition-all duration-1000 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]">
                   <a.icon size={48} className={a.color} />
                </div>
                <div className="space-y-4">
                   <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">{a.label}</h4>
                   <p className="text-[13px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">{a.desc}</p>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-slate-900 flex items-center justify-center group-hover:border-white transition-all duration-700">
                   <ArrowRight size={32} className="text-slate-900 group-hover:text-white transition-all group-hover:translate-x-4" />
                </div>
             </motion.button>
           ))}
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
          button:disabled { cursor: not-allowed; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}

export default function ResonanceHubPage() {
  return (
    <Suspense fallback={
       <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
          <Globe size={100} className="text-indigo-500 animate-pulse mb-16 drop-shadow-[0_0_50px_rgba(99,102,241,0.5)]" />
          <span className="text-5xl font-black text-slate-950 uppercase tracking-[1em] animate-pulse italic">CALIBRATING...</span>
       </div>
    }>
      <ResonanceHubContent />
    </Suspense>
  )
}
