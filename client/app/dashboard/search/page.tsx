'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  Terminal,
  Database,
  Target,
  Zap,
  Activity,
  Radio,
  Shield,
  Fingerprint,
  Compass,
  Boxes,
  Layout,
  Layers,
  Timer,
  Box,
  Monitor,
  ChevronRight,
  Eye,
  AlertCircle
} from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-300'

interface SearchResult {
  _id: string
  title: string
  type: string
  status: string
  [key: string]: any
}

export default function SignalInterceptionGridPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
  }, [user])

  const handleRecon = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query) params.append('q', query)
      if (type) params.append('type', type)
      if (status) params.append('status', status)
      const response = await apiGet<any>(`/search/content?${params.toString()}`)
      const data = response?.data || response
      setResults(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const e = extractApiError(err)
      setError(typeof e === 'string' ? e : e?.message || 'RECON_FAILED: UPLINK_TIMEOUT')
    } finally {
      setLoading(false)
    }
  }

  if (loading && results.length === 0) return (
    <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen gap-12 backdrop-blur-3xl">
       <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
          <Compass size={80} className="text-indigo-500 animate-spin relative z-10" />
       </div>
       <div className="space-y-4 text-center">
          <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Probing Registry Lattice...</p>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">HIGH_BANDWIDTH_INTERCEPTION_ACTIVE</p>
       </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1500px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Search size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Recon Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button 
                onClick={() => router.push('/dashboard')} 
                title="Abort Session"
                className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border-2 border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl hover:border-rose-500/50">
                <ArrowLeft size={40} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Compass size={48} className="text-indigo-400 relative z-10 group-hover:rotate-180 transition-transform duration-500 ease-in-out" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Signal Interception Grid v12.8</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] animate-ping" />
                       <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase italic leading-none">SCANNER_READY</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Interception Grid</h1>
                 <p className="text-slate-500 text-[14px] uppercase font-black tracking-[0.4em] mt-6 italic leading-none">Deep-spectrum lattice synchronization and multi-node registry identification.</p>
              </div>
           </div>

           <button 
             onClick={handleRecon}
             title="Execute Grid Probe"
             className="px-16 py-8 bg-white text-black rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_50px_150px_rgba(255,255,255,0.05)] hover:bg-indigo-500 hover:text-white transition-all duration-300 flex items-center gap-8 italic active:scale-95 group overflow-hidden relative"
           >
             <div className="absolute inset-0 bg-indigo-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
             <div className="relative z-10 flex items-center gap-6">
               <RefreshCw size={32} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'} /> 
               EXECUTE_GRID_PROBE
             </div>
           </button>
        </div>

        {/* Recon Scanning HUD */}
        <div className={`${glassStyle} rounded-[6rem] p-20 border-white/5 shadow-[0_100px_250px_rgba(0,0,0,1)] relative z-10 overflow-hidden`}>
           <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700"><Terminal size={400} className="text-white" /></div>
           
           <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 relative z-10">
              <div className="xl:col-span-2 relative group/input">
                 <Search className="absolute left-16 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-all duration-300" size={40} />
                 <input
                   id="intercept-input"
                   type="text"
                   placeholder="INTERCEPT_SIGNAL_OR_PACKET_ID..."
                   title="Intercept Signal"
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   onKeyPress={(e) => e.key === 'Enter' && handleRecon()}
                   className="w-full bg-black/60 border-2 border-white/5 rounded-[5rem] pl-32 pr-20 py-12 text-4xl font-black text-white uppercase italic tracking-widest focus:outline-none focus:border-indigo-500/50 transition-all duration-300 shadow-inner placeholder:text-slate-500"
                 />
              </div>

              <div className="relative group/sel">
                 <select 
                   id="modality-select"
                   value={type} 
                   onChange={(e) => setType(e.target.value)} 
                   title="Emission Modalities"
                   className="w-full appearance-none bg-black/60 border-2 border-white/5 px-16 py-12 rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] text-white focus:outline-none cursor-pointer italic shadow-inner hover:border-indigo-500/50 transition-all duration-300">
                    <option value="">ALL_MODALITIES</option>
                    <option value="video" className="bg-[#050505]">VISUAL_SYNTHESIS</option>
                    <option value="article" className="bg-[#050505]">LINGUISTIC_MATRIX</option>
                    <option value="podcast" className="bg-[#050505]">AUDITORY_RESONANCE</option>
                 </select>
                 <ChevronRight size={32} className="absolute right-16 top-1/2 -translate-y-1/2 text-white/20 rotate-90 pointer-events-none group-hover/sel:text-indigo-400 transition-colors duration-300" />
              </div>

              <div className="relative group/stat">
                 <select 
                   id="phase-select"
                   value={status} 
                   onChange={(e) => setStatus(e.target.value)} 
                   title="Process Phases"
                   className="w-full appearance-none bg-black/60 border-2 border-white/5 px-16 py-12 rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] text-white focus:outline-none cursor-pointer italic shadow-inner hover:border-indigo-500/50 transition-all duration-300">
                    <option value="">ALL_PHASES</option>
                    <option value="completed" className="bg-[#050505]">SECURED_FINAL</option>
                    <option value="processing" className="bg-[#050505]">SYNTHESIS_ACTIVE</option>
                    <option value="failed" className="bg-[#050505]">SIGNAL_DIFFRACTED</option>
                 </select>
                 <ChevronRight size={32} className="absolute right-16 top-1/2 -translate-y-1/2 text-white/20 rotate-90 pointer-events-none group-hover/stat:text-indigo-400 transition-colors duration-300" />
              </div>
           </div>
        </div>

        {/* Recon Result Lattice */}
        <div className="space-y-10 relative z-10">
           {error && (
             <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-10 bg-rose-500/5 border border-rose-500/20 rounded-[3rem] flex items-center gap-8 shadow-2xl">
                <AlertCircle size={40} className="text-rose-500 animate-pulse" />
                <div>
                   <p className="text-[12px] font-black text-rose-500 uppercase tracking-[0.6em] italic leading-none mb-2">RECON_FATAL_ERROR</p>
                   <p className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">{error}</p>
                </div>
             </motion.div>
           )}

            {loading ? (
              <div className="py-64 text-center">
                 <div className="inline-block w-40 h-40 border-8 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin mb-12 shadow-[0_0_50px_rgba(99,102,241,0.2)]" />
                 <p className="text-4xl font-black text-slate-500 uppercase tracking-[0.8em] italic leading-none">PROBING_NODES...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="py-64 flex flex-col items-center justify-center text-center opacity-[0.05] gap-20">
                 <div className="relative">
                    <div className="absolute inset-0 bg-white blur-3xl opacity-20" />
                    <Compass size={200} className="text-white animate-pulse relative z-10" />
                 </div>
                 <div className="space-y-8">
                    <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter">NULL_SIGNATURE</h3>
                    <p className="text-[24px] font-black text-slate-400 uppercase tracking-[1em] italic leading-none">{query ? `NO_MATCHES_IDENTIFIED_FOR [${query.toUpperCase()}]` : "ENTER_PROBE_PARAMETERS_TO_BEGIN_INTERCEPTION"}</p>
                 </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                 {results.map((item, i) => (
                   <motion.div
                     initial={{ opacity: 0, scale: 0.9, y: 30 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     transition={{ delay: i * 0.05, duration: 1 }}
                     key={item._id}
                     onClick={() => router.push(`/dashboard/content/${item._id}`)}
                     className="p-16 rounded-[6rem] bg-white/[0.02] border-2 border-white/5 hover:border-indigo-500/50 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group shadow-3xl relative overflow-hidden active:scale-95"
                   >
                      <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.1] transition-opacity duration-500 rotate-12 group-hover:rotate-0"><Boxes size={250} /></div>
                      <div className="flex items-center justify-between mb-12">
                         <span className="px-6 py-2 rounded-2xl bg-indigo-500/10 text-indigo-400 border-2 border-indigo-500/20 text-[12px] font-black uppercase tracking-widest italic shadow-inner">{item.type.toUpperCase()} // MODALITY</span>
                         <div className={`w-4 h-4 rounded-full ${item.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)]' : 'bg-amber-500 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.5)]'}`} />
                      </div>
                      <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-10 group-hover:text-indigo-400 transition-colors duration-300 leading-none truncate">{item.title || 'UNNAMED_NODE'}</h3>
                      <div className="flex items-center justify-between pt-10 border-t-2 border-white/5">
                         <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest italic">{item.status.toUpperCase()} // SIG_LOCKED</span>
                         <div className="w-16 h-16 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-slate-500 group-hover:text-white group-hover:scale-110 transition-all duration-300">
                            <Eye size={32} />
                         </div>
                      </div>
                   </motion.div>
                 ))}
              </div>
            )}
        </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.3); border: 2px solid transparent; background-clip: content-box; }
        select { -webkit-appearance: none; appearance: none; cursor: pointer; }
      `}</style>
      </div>
    </ErrorBoundary>
  )
}
