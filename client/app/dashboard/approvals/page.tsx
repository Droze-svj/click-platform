'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { API_URL } from '../../../lib/api'
import { 
  Shield, Zap, CheckCircle2, XCircle, Activity, 
  Cpu, Database, Lock, Unlock, Globe, Radio, 
  ChevronRight, ArrowRight, Target, Terminal, 
  Clock, Plus, Filter, MessageSquare, ArrowLeft,
  Search, Layers, Network, Fingerprint, Gauge, X,
  Workflow, Binary, Orbit, Scan, ActivityIcon,
  Command, Box, Wind, Ghost, Signal, ShieldAlert,
  UserCheck, Key, Anchor, Sparkle
} from 'lucide-react'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-1000'

interface ConsensusRequest {
  _id: string
  entityType: string
  entityId: string
  requestedBy: {
    _id: string
    name: string
    email: string
  }
  requestedFrom: {
    _id: string
    name: string
    email: string
  }
  status: string
  priority: string
  response: string
  createdAt: string
  expiresAt: string | null
}

export default function ConsensusValidationNodePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [matrix, setMatrix] = useState<ConsensusRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [showInitializationModal, setShowInitializationModal] = useState(false)
  const [newRequest, setNewRequest] = useState({
    entityType: 'content',
    entityId: '',
    requestedFrom: '',
    priority: 'medium',
    message: ''
  })

  const loadMatrixData = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return

      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)

      const res = await axios.get(`${API_URL}/approvals?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data.success) {
        setMatrix(Array.isArray(res.data.data) ? res.data.data : [])
      }
    } catch {
      showToast('MATRIX_ERR: PROTOCOL_DESYNC', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadMatrixData()
  }, [user, router, loadMatrixData])

  const handleAuthorize = async (id: string) => {
    const log = prompt('VALIDATION_LOG (Optional):')
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/approve`, { response: log || '' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast('PROTOCOL_AUTHORIZED: NODE_UNLOCKED', 'success')
      loadMatrixData()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'AUTHORIZATION_FAILED', 'error')
    }
  }

  const handleDissent = async (id: string) => {
    const reason = prompt('DISSENT_REASON (Optional):')
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/reject`, { response: reason || '' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast('PROTOCOL_VETOED: NODE_LOCKED', 'success')
      loadMatrixData()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'VETO_FAILED', 'error')
    }
  }

  const handleAbortInit = async (id: string) => {
    if (!confirm('Abort consensus protocol initialization?')) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast('PROTOCOL_ABORTED', 'success')
      loadMatrixData()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'ABORT_FAILED', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Shield size={64} className="text-indigo-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] animate-pulse italic">Calibrating Consensus Matrix...</span>
      </div>
    )
  }

  const pendingNodes = matrix.filter(r => r.status === 'pending')

  return (
    <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
      <ToastContainer />
      
      {/* Background Matrix Layer */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
          <Lock size={1200} className="text-white absolute -top-40 -left-60 -rotate-12 blur-[1px]" />
          <Fingerprint size={1000} className="text-white absolute -bottom-80 -right-60 rotate-[32deg] blur-[2px]" />
      </div>

      {/* Sovereign Validation Header */}
      <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
        <div className="flex items-center gap-10">
          <button onClick={() => router.push('/dashboard')} title="Abort"
            className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-indigo-500/50 backdrop-blur-3xl group">
            <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
          </button>
          <div className="w-24 h-24 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
             <Fingerprint size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-3">
                <Network className="text-indigo-500 animate-pulse" size={16} />
                <span className="text-[12px] font-black uppercase tracking-[0.8em] text-indigo-400 italic leading-none">Validation Node v14.8.2</span>
              </div>
              <div className="px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">LATTICE_INTEGRITY_SHIELDED</span>
              </div>
            </div>
            <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">Consensus</h1>
            <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Sovereign validation gates for global operational output synchronization and nodal consensus.</p>
          </div>
        </div>

        <button onClick={() => setShowInitializationModal(true)}
          className="px-16 py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] transition-all duration-1000 flex items-center gap-8 italic bg-white text-black hover:bg-indigo-600 hover:text-white hover:scale-110 active:scale-95 group relative overflow-hidden outline-none border-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[2s]" />
          <Plus size={32} className="group-hover:rotate-90 transition-transform duration-1000" /> INITIALIZE_CONSENSUS
        </button>
      </header>

      {/* Navigation Filter Matrix */}
      <nav className="flex gap-6 p-4 rounded-[4rem] bg-white/[0.02] border-2 border-white/10 shadow-[0_60px_200px_rgba(0,0,0,1)] w-fit z-50 relative backdrop-blur-3xl bg-black/40">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={`px-12 py-6 rounded-[2.8rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic active:scale-90 border-2 ${filter === f ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' : 'text-slate-700 border-transparent hover:text-white hover:bg-white/[0.04]'}`}>
            {f === 'all' ? 'COMPLETE_LEDGER' : f.toUpperCase()}
          </button>
        ))}
      </nav>

      <main className="space-y-24 relative z-10">
        {/* Awaiting Authorization Terminal */}
        <AnimatePresence>
          {pendingNodes.length > 0 && (
            <motion.section initial={{ opacity: 0, scale: 0.98, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.02, y: -50 }}
              className={`${glassStyle} p-24 rounded-[6rem] relative overflow-hidden group z-10 border-amber-500/20 bg-amber-500/[0.02] shadow-[0_100px_300px_rgba(245,158,11,0.05)]`}
            >
                <div className="absolute top-0 right-0 p-24 opacity-[0.05] animate-pulse pointer-events-none group-hover:opacity-[0.1] transition-opacity duration-[3s]">
                   <Radio size={400} className="text-amber-500" />
                </div>
                <div className="flex items-center justify-between mb-20 relative z-10 px-8">
                   <div className="flex items-center gap-10">
                      <div className="w-24 h-24 rounded-[3rem] bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/30 shadow-[0_40px_100px_rgba(245,158,11,0.2)] group-hover:rotate-12 transition-transform duration-1000">
                        <Zap className="text-amber-500 animate-pulse" size={48} />
                      </div>
                      <div>
                        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">Pending Node Gates</h2>
                        <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none border-l-4 border-amber-500/20 pl-8 ml-4">Operational streams awaiting consensus validation signatures.</p>
                      </div>
                   </div>
                   <div className="px-10 py-4 rounded-full bg-amber-500/10 border-2 border-amber-500/20 text-amber-500 text-[12px] font-black uppercase tracking-[0.3em] italic animate-bounce shadow-3xl">RESONANCE_ALERT: {pendingNodes.length} STREAMS_HELD</div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                  {pendingNodes.map((request) => (
                    <motion.div initial={{ opacity: 0, scale: 0.95, x: -30 }} animate={{ opacity: 1, scale: 1, x: 0 }} key={request._id} 
                      className="bg-black/60 border-2 border-white/5 rounded-[5rem] p-16 hover:bg-black/80 hover:border-amber-500/30 transition-all duration-1000 group/node relative overflow-hidden shadow-[inset_0_0_50px_rgba(255,255,255,0.02)]"
                    >
                      <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-[2s] -rotate-12 group-hover:rotate-0 scale-150 group-hover:scale-100"><Cpu size={200} /></div>
                      <div className="flex items-start justify-between mb-12">
                         <div className="space-y-6">
                            <div className="flex items-center gap-6">
                               <div className="px-8 py-2.5 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 shadow-3xl">
                                  <span className="text-indigo-400 text-[11px] font-black uppercase tracking-[0.4em] italic">NODE_{request.entityType.toUpperCase()}</span>
                               </div>
                               <div className="flex items-center gap-3">
                                  <Clock size={14} className="text-slate-900" />
                                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] italic">{new Date(request.createdAt).toLocaleTimeString()}</span>
                               </div>
                            </div>
                            <div>
                               <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-4 drop-shadow-2xl">{request.requestedBy.name}</h3>
                               <div className="flex items-center gap-4 py-2 px-6 rounded-2xl bg-black/40 border border-white/5 w-fit shadow-inner">
                                  <Database size={14} className="text-slate-950" />
                                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em] italic leading-none font-mono">ID: {request.entityId.substring(0, 16)}...</p>
                               </div>
                            </div>
                         </div>
                         <div className="flex flex-col items-end gap-4 text-right">
                            <span className="text-[10px] font-black text-amber-500/40 uppercase tracking-[0.5em] italic">RESOLUTION_FLUX</span>
                            <div className={`w-5 h-5 rounded-full shadow-3xl ${request.priority === 'urgent' ? 'bg-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse border-4 border-rose-500/30' : request.priority === 'high' ? 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)] border-4 border-orange-500/30' : 'bg-indigo-500/30 border-4 border-indigo-500/10'}`} />
                         </div>
                      </div>
                      
                      {request.response && (
                        <div className="mb-12 p-8 rounded-[3rem] bg-indigo-500/5 border-2 border-white/5 italic text-[16px] font-black text-slate-400 leading-relaxed uppercase tracking-tighter line-clamp-3 relative shadow-inner group-hover:border-indigo-500/20 transition-all duration-1000">
                           <div className="absolute top-4 left-6 text-indigo-500 opacity-20"><MessageSquare size={24} /></div>
                           <span className="pl-12 block group-hover:text-white transition-colors duration-1000">OBJECTIVE_CONTEXT:</span>
                           <p className="pl-12 mt-2 opacity-60 group-hover:opacity-100 transition-opacity duration-1000">"{request.response}"</p>
                        </div>
                      )}
                      
                      <div className="flex gap-8 mt-auto pt-4 relative z-10">
                        <button onClick={() => handleAuthorize(request._id)}
                          className="flex-1 py-8 bg-white text-black rounded-[2.5rem] text-[15px] font-black uppercase tracking-[0.5em] hover:bg-emerald-600 hover:text-white hover:scale-105 active:scale-75 transition-all duration-[0.8s] shadow-[0_40px_100px_rgba(255,255,255,0.1)] italic border-none group/auth flex items-center justify-center gap-6">
                          <CheckCircle2 size={24} className="group-hover/auth:rotate-12 transition-transform duration-700" />
                          AUTHORIZE
                        </button>
                        <button onClick={() => handleDissent(request._id)}
                          className="flex-1 py-8 bg-white/5 border-2 border-white/10 text-slate-800 rounded-[2.5rem] text-[15px] font-black uppercase tracking-[0.5em] hover:bg-rose-600 hover:text-white hover:border-rose-500 hover:scale-105 active:scale-75 transition-all duration-[0.8s] italic flex items-center justify-center gap-6 group/diss shadow-2xl">
                          <XCircle size={24} className="group-hover/diss:-rotate-12 transition-transform duration-700" />
                          DISSENT
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Validation Ledger Table */}
        <section className={`${glassStyle} p-24 rounded-[6rem] z-10 relative bg-black/40 border-white/5 shadow-[0_100px_300px_rgba(0,0,0,1)]`}>
            <div className="flex flex-col lg:flex-row items-center justify-between mb-20 px-8 gap-12 pt-4">
               <div className="flex items-center gap-10">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 shadow-3xl group-hover:rotate-12 transition-transform duration-1000">
                    <Database className="text-indigo-400" size={40} />
                  </div>
                  <div>
                    <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Validation Ledger</h2>
                    <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Immutable records of consensus decisions and nodal authorizations.</p>
                  </div>
               </div>
               <div className="flex items-center gap-12">
                  <div className="px-10 py-4 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">{matrix.length} PROTOCOL_LOGS ANALYZED</span>
                  </div>
                  <div className="w-[2px] h-12 bg-white/10" />
                  <button className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white hover:border-indigo-500/50 transition-all duration-700 shadow-3xl hover:scale-110 active:scale-90"><Search size={32} /></button>
               </div>
            </div>

            {matrix.length === 0 ? (
              <div className="py-48 text-center flex flex-col items-center justify-center gap-12 group">
                 <div className="w-32 h-32 bg-white/[0.02] rounded-[4rem] border-2 border-white/5 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-1000"><Globe size={72} className="text-white/20 animate-spin-slow" /></div>
                 <div className="space-y-4">
                   <p className="text-3xl font-black text-white uppercase tracking-[0.8em] italic leading-none drop-shadow-2xl">Ghost Matrix</p>
                   <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic opacity-40">No historical consensus records identified in current lattice.</p>
                 </div>
              </div>
            ) : (
              <div className="space-y-8 px-4 pb-4">
                {matrix.map((request, idx) => {
                  const isInitiator = request.requestedBy._id === user?.id
                  const isValidator = request.requestedFrom._id === user?.id
                  const statusColor = request.status === 'approved' 
                    ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.3)]' 
                    : request.status === 'rejected' 
                      ? 'text-rose-500 border-rose-500/30 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.3)]' 
                      : 'text-amber-500 border-amber-500/30 bg-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.3)]'

                  return (
                    <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: idx * 0.08 }}
                      key={request._id} className="group relative bg-[#020205] border-2 border-white/5 rounded-[4rem] p-12 hover:bg-black hover:border-indigo-500/30 transition-all duration-1000 flex flex-col lg:flex-row items-center justify-between gap-16 overflow-hidden shadow-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                      
                      <div className="flex-1 flex flex-col md:flex-row items-center gap-16 relative z-10 w-full">
                          <div className="w-24 h-24 rounded-[2.5rem] bg-black border-2 border-white/10 flex flex-col items-center justify-center gap-2 font-black shadow-inner flex-shrink-0 group-hover:border-indigo-400 transition-colors duration-1000">
                             <span className="text-[28px] text-white leading-none drop-shadow-2xl">{new Date(request.createdAt).getDate()}</span>
                             <span className="text-[10px] text-slate-800 uppercase leading-none tracking-widest">{new Date(request.createdAt).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0 text-center md:text-left space-y-8">
                              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8">
                                 <div className={`px-10 py-2.5 rounded-full text-[12px] font-black uppercase tracking-[0.4em] border-2 transition-all duration-1000 italic ${statusColor}`}>
                                   {request.status.toUpperCase()}
                                 </div>
                                 <div className="flex items-center gap-4 py-1.5 px-6 rounded-full bg-white/[0.03] border border-white/5 italic">
                                   <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">NODE_{request.entityType.toUpperCase()}</span>
                                 </div>
                                 <div className="flex items-center gap-4 group/id cursor-pointer">
                                   <Binary size={14} className="text-indigo-400 opacity-40 group-hover/id:opacity-100 transition-opacity duration-1000" />
                                   <span className="text-[10px] font-black text-indigo-500 group-hover:text-white transition-all duration-1000 uppercase tracking-widest italic font-mono">HASH: {request.entityId.substring(0, 24)}</span>
                                 </div>
                              </div>
                              
                              <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-16">
                                <div className="space-y-3">
                                   <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.6em] italic opacity-40 leading-none">IDENT_MAP_PRIMARY</p>
                                   <p className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">
                                     {isInitiator ? request.requestedFrom.name : request.requestedBy.name}
                                   </p>
                                </div>
                                <div className="w-[1px] h-12 bg-white/5 hidden md:block" />
                                <div className="space-y-3">
                                   <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.6em] italic opacity-40 leading-none">NODE_ROLE_SIGNER</p>
                                   <p className="text-xl font-black text-indigo-400/60 transition-colors duration-1000 group-hover:text-indigo-400 italic uppercase tracking-widest leading-none drop-shadow-2xl">
                                     {isInitiator ? 'TARGET_VALIDATOR' : 'INBOUND_INITIATOR'}
                                   </p>
                                </div>
                              </div>

                              {request.response && (
                                 <div className="p-8 rounded-[2.5rem] bg-black/60 border-2 border-white/5 italic text-[15px] font-black text-slate-800 group-hover:text-white leading-relaxed uppercase tracking-tighter border-l-4 border-l-indigo-500/50 pl-10 transition-all duration-1000 relative shadow-inner">
                                    <div className="absolute top-4 left-4 text-indigo-500 opacity-10"><Workflow size={24} /></div>
                                    <span className="opacity-30 block mb-2 text-[10px] tracking-[0.4em]">LOG_RESONANCE_DATA:</span>
                                    "{request.response}"
                                 </div>
                              )}
                          </div>
                      </div>

                      <div className="flex items-center gap-10 relative z-10 flex-shrink-0 lg:flex-col xl:flex-row">
                          {request.status === 'pending' && (
                            <div className="flex gap-6 lg:flex-col xl:flex-row">
                              {isValidator && (
                                <>
                                  <button onClick={() => handleAuthorize(request._id)} className="w-20 h-20 bg-white text-black rounded-[1.8rem] flex items-center justify-center shadow-3xl hover:bg-emerald-600 hover:text-white hover:scale-110 active:scale-75 transition-all duration-[0.8s] group/auth border-none outline-none"><CheckCircle2 size={40} className="group-hover/auth:rotate-12 transition-transform duration-700" /></button>
                                  <button onClick={() => handleDissent(request._id)} className="w-20 h-20 bg-white/5 border-2 border-white/10 text-rose-500 rounded-[1.8rem] flex items-center justify-center hover:bg-rose-600 hover:text-white hover:border-rose-500 hover:scale-110 active:scale-75 transition-all duration-[0.8s] group/diss shadow-2xl outline-none"><XCircle size={40} className="group-hover/diss:-rotate-12 transition-transform duration-700" /></button>
                                </>
                              )}
                              {isInitiator && (
                                <button onClick={() => handleAbortInit(request._id)}
                                  className="px-12 py-6 bg-white/5 border-2 border-white/10 text-slate-800 hover:text-white hover:border-rose-500/50 rounded-[1.8rem] text-[12px] font-black uppercase tracking-[0.4em] transition-all duration-700 italic hover:bg-rose-600 active:scale-90 shadow-2xl">ABORT_INIT</button>
                              )}
                            </div>
                          )}
                          <button className="w-20 h-20 bg-white/5 border-2 border-white/10 rounded-[1.8rem] flex items-center justify-center text-slate-950 hover:text-white transition-all duration-700 hover:bg-indigo-600 hover:border-indigo-400 hover:scale-110 active:scale-90 shadow-3xl group">
                            <ChevronRight size={36} className="group-hover:translate-x-2 transition-transform duration-700" />
                          </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
        </section>
      </main>

      {/* Consensus Generation Modal HUD */}
      <AnimatePresence>
        {showInitializationModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-12 overflow-hidden" onClick={() => setShowInitializationModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/98 backdrop-blur-[100px]" />
            
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 100, rotateX: 30 }} animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, scale: 0.8, y: 100, rotateX: 30 }} transition={{ type: "spring", damping: 25, stiffness: 100 }}
              className={`${glassStyle} rounded-[7rem] p-32 max-w-6xl w-full border-white/20 relative overflow-hidden shadow-[0_120px_400px_rgba(99,102,241,0.2)] bg-[#050505]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 right-0 p-32 opacity-[0.05] pointer-events-none group-hover:rotate-12 transition-transform duration-[5s] -translate-y-1/2 translate-x-1/2 scale-150"><Target size={800} className="text-white" /></div>
              
              <div className="flex flex-col md:flex-row items-center justify-between mb-24 relative z-10 gap-12">
                <div className="flex items-center gap-12 text-center md:text-left">
                  <div className="w-28 h-28 rounded-[3.5rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(99,102,241,0.3)] animate-pulse"><Shield size={56} className="text-indigo-400" /></div>
                  <div>
                     <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 drop-shadow-2xl">Initialize Gate</h2>
                     <p className="text-[13px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none border-l-4 border-indigo-500/20 pl-8 ml-4">Defining consensus parameters for validated mission deployment.</p>
                  </div>
                </div>
                <button onClick={() => setShowInitializationModal(false)} className="w-24 h-24 rounded-[3rem] bg-white/[0.03] border-4 border-white/10 flex items-center justify-center text-slate-900 hover:text-white hover:bg-rose-600 hover:border-rose-400 transition-all duration-700 hover:scale-110 active:scale-75 shadow-3xl group">
                  <X size={48} className="group-hover:rotate-180 transition-transform duration-1000" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 relative z-10">
                 <div className="space-y-16">
                    <div className="space-y-10">
                       <div className="flex items-center gap-6 px-4">
                          <Layers size={20} className="text-indigo-500" />
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic">Node Entity Selection</label>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {['content', 'script', 'payload'].map(type => (
                             <button key={type} onClick={() => setNewRequest({ ...newRequest, entityType: type })}
                               className={`px-10 py-8 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] italic text-center transition-all duration-700 border-4 active:scale-95 ${newRequest.entityType === type ? 'bg-white text-black border-white shadow-[0_40px_100px_rgba(255,255,255,0.2)] scale-110' : 'bg-black/60 border-white/5 text-slate-900 hover:text-white hover:border-indigo-500/30'}`}>
                               NODE_{type.toUpperCase()}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-10">
                       <div className="flex items-center gap-6 px-4">
                          <Gauge size={20} className="text-amber-500" />
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic">Criticality Flux Calibration</label>
                       </div>
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                          {['low', 'medium', 'high', 'urgent'].map(p => (
                             <button key={p} onClick={() => setNewRequest({ ...newRequest, priority: p })}
                               className={`px-6 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] italic transition-all duration-700 border-4 active:scale-95 ${newRequest.priority === p ? (p === 'urgent' ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_60px_rgba(244,63,94,0.6)] scale-110' : 'bg-white text-black border-white shadow-3xl scale-110') : 'bg-black/60 border-white/5 text-slate-900'}`}>
                               {p === 'low' ? 'MINIMAL' : p.toUpperCase()}
                             </button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-16">
                    <div className="space-y-10">
                       <div className="flex items-center gap-6 px-4">
                          <UserCheck size={20} className="text-indigo-400" />
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic">Target Signer Node identity</label>
                       </div>
                       <div className="relative group">
                          <input type="text" value={newRequest.requestedFrom} onChange={e => setNewRequest({ ...newRequest, requestedFrom: e.target.value })}
                            className="w-full px-12 py-10 bg-black/60 border-4 border-white/5 rounded-[3.5rem] text-[20px] font-black uppercase text-white tracking-[0.3em] focus:outline-none focus:border-indigo-500/50 transition-all duration-1000 placeholder:text-slate-950 italic shadow-inner group-hover:border-white/10"
                            placeholder="OPERATOR_HEX_ID..."
                          />
                          <Key size={32} className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-950 group-hover:text-indigo-400 transition-colors duration-1000 group-hover:rotate-12" />
                       </div>
                    </div>

                    <div className="space-y-10">
                       <div className="flex items-center gap-6 px-4">
                          <Database size={20} className="text-indigo-400" />
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic">Operational Payload Hash</label>
                       </div>
                       <div className="relative group">
                          <input type="text" value={newRequest.entityId} onChange={e => setNewRequest({ ...newRequest, entityId: e.target.value })}
                            className="w-full px-12 py-10 bg-black/60 border-4 border-white/5 rounded-[3.5rem] text-[20px] font-black uppercase text-white tracking-[0.3em] focus:outline-none focus:border-indigo-500/50 transition-all duration-1000 placeholder:text-slate-950 italic shadow-inner group-hover:border-white/10"
                            placeholder="BLAKE3_PAYLOAD_HASH..."
                          />
                          <Anchor size={32} className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-950 group-hover:text-indigo-400 transition-colors duration-1000 group-hover:-rotate-12" />
                       </div>
                    </div>

                    <div className="space-y-10">
                       <div className="flex items-center gap-6 px-4">
                          <Terminal size={20} className="text-indigo-400" />
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic">Resonance Objective Prompt</label>
                       </div>
                       <textarea value={newRequest.message} onChange={e => setNewRequest({ ...newRequest, message: e.target.value })}
                         className="w-full px-12 py-10 bg-black/60 border-4 border-white/5 rounded-[3.5rem] text-[18px] font-black uppercase text-white tracking-[0.2em] focus:outline-none focus:border-indigo-500/50 transition-all duration-1000 placeholder:text-slate-950 italic shadow-inner resize-none mb-8 group-hover:border-white/10"
                         rows={3} placeholder="DEFINE_CONSENSUS_GOAL..."
                       />
                       
                       <button 
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('token')
                              await axios.post(`${API_URL}/approvals`, newRequest, { headers: { Authorization: `Bearer ${token}` } })
                              showToast('PROTOCOL_INITIALIZED', 'success')
                              setShowInitializationModal(false)
                              setNewRequest({ entityType: 'content', entityId: '', requestedFrom: '', priority: 'medium', message: '' })
                              loadMatrixData()
                            } catch (err: any) {
                              showToast(err.response?.data?.error || 'INITIALIZATION_FAILED', 'error')
                            }
                          }}
                          className="w-full py-12 bg-indigo-600 text-white rounded-[4rem] text-[24px] font-black uppercase tracking-[0.8em] shadow-[0_60px_150px_rgba(79,70,229,0.5)] hover:bg-white hover:text-black hover:scale-105 active:scale-90 transition-all duration-1000 italic flex items-center justify-center gap-10 group/start relative overflow-hidden outline-none border-none"
                       >
                         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/start:translate-x-full transition-transform duration-[1.5s]" />
                         <Shield size={40} className="group-hover/start:rotate-12 transition-transform duration-700" /> START_GATE_PROTOCOL
                       </button>
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        .shadow-3xl { shadow: 0 40px 150px rgba(0,0,0,0.8); }
      `}</style>
    </div>
  )
}
