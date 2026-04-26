'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import {
  Layout, Hexagon, Zap, Target, Shield, Activity, Cpu, Globe, 
  Terminal, ArrowLeft, Palette, Layers, Type, Image, X,
  RefreshCw, CheckCircle, ChevronRight, Sparkles, Hash, Search,
  Compass, Radio, Gauge, Fingerprint, Network, Calendar, ArrowRight,
  Workflow, Binary, Orbit, Scan, Command, Wind, Ghost,
  Signal, ShieldCheck, ActivityIcon, CpuIcon, HardDrive,
  UserCheck, Key, Anchor, Sparkle, Box
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../../../contexts/ToastContext'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { ErrorBoundary } from '../../../components/ErrorBoundary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

const sectors = [
  'health', 'finance', 'education', 'technology',
  'lifestyle', 'business', 'entertainment', 'other'
]

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-3xl transition-all duration-300'

export default function SectorResonanceMatrixPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const { setNiche } = useWorkflow()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userSector, setUserSector] = useState('other')
  const [sectorPacks, setSectorPacks] = useState<any>(null)
  const [identitySettings, setIdentitySettings] = useState({
    primaryColor: '#8b5cf6',
    secondaryColor: '#ffffff',
    logo: '',
    font: 'Arial'
  })

  const loadLattice = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }
      const [userRes, packRes] = await Promise.all([
        axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/niche/packs`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      const u = userRes.data.user || userRes.data.data?.user
      setUserSector(u.niche || 'other')
      if (u.niche) setNiche(u.niche)
      setIdentitySettings(u.brandSettings || identitySettings)
      setSectorPacks(packRes.data.data || packRes.data)
    } catch {
      setError('UPLINK_ERR: SECTOR_ACCESS_DENIED')
    } finally {
      setLoading(false)
    }
  }, [router, identitySettings, setNiche])

  useEffect(() => {
    loadLattice()
  }, [loadLattice])

  const handleSectorChange = async (sector: string) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await axios.put(`${API_URL}/niche/select`, { niche: sector }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      setUserSector(sector)
      setNiche(sector)
      showToast('✓ SECTOR_UPLINK_SECURED', 'success')
      setSuccess('NEURAL_SECTOR_DESIGNATED_READY')
    } catch {
      setError('SECTOR_ERR: REDESIGNATION_FAILED')
    } finally { setSaving(false) }
  }

  const handleIdentityUpdate = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await axios.put(`${API_URL}/niche/brand`, identitySettings, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      showToast('✓ IDENTITY_SYNC_COMPLETE', 'success')
      setSuccess('IDENTITY_HASH_INITIALIZED_SUCCESS')
    } catch {
      setError('IDENTITY_ERR: CONFIGURATION_SYNC_FAILED')
    } finally { setSaving(false) }
  }

  const currentPack = sectorPacks?.[userSector]

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen font-inter">
        <Target size={64} className="text-amber-500 animate-pulse mb-8" />
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.6em] animate-pulse italic">Calibrating Sector Intelligence...</span>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        
        {/* Background Sector Layer */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Compass size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Target size={1000} className="text-white absolute -top-80 -right-60 rotate-[32deg] blur-[2px]" />
        </div>

        {/* Sector Header HUD */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-amber-500/50 backdrop-blur-3xl group">
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-amber-500/5 border-2 border-amber-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(245,158,11,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-100" />
                <Target size={48} className="text-amber-400 relative z-10 group-hover:scale-125 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-amber-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-amber-400 italic leading-none">Sector Intelligence v24.1.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,1)]" />
                       <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic leading-none">SECTOR_LOCK_OPTIMAL</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Resonance</h1>
                 <p className="text-slate-400 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Deep-scanning heuristic architectures and neural market mapping architectures.</p>
              </div>
           </div>

           <div className="flex items-center gap-12">
              <div className={`${glassStyle} px-12 py-8 rounded-[3.5rem] flex items-center gap-8 border-amber-500/20 bg-amber-500/5 shadow-3xl group`}>
                 <div className="w-16 h-16 rounded-[1.8rem] bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/20 shadow-2xl group-hover:rotate-12 transition-transform duration-700">
                    <Activity size={32} className="text-amber-400 animate-pulse" />
                 </div>
                 <div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic leading-none opacity-40">MATRIX_SCAN_STATUS</span>
                    <p className="text-2xl font-black text-amber-400 uppercase tracking-[0.4em] italic leading-none mt-2">ACTIVE_SCANNING</p>
                 </div>
              </div>
              <button onClick={() => loadLattice()} className={`${glassStyle} w-20 h-20 rounded-[2.5rem] border-2 flex items-center justify-center group shadow-3xl active:scale-90 border-white/5 bg-black/40 backdrop-blur-3xl`}>
                <RefreshCw size={32} className={`text-slate-500 group-hover:text-amber-400 transition-colors duration-700 ${saving ? 'animate-spin' : ''}`} />
              </button>
           </div>
        </header>

        <AnimatePresence>
           {error && (
             <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} 
               className="p-10 rounded-[4rem] bg-rose-500/10 border-2 border-rose-500/30 flex items-center gap-10 shadow-3xl backdrop-blur-3xl"
             >
                <X size={48} className="text-rose-500 animate-pulse bg-rose-500/10 p-2 rounded-2xl" />
                <p className="text-[16px] font-black text-rose-500 uppercase tracking-[0.8em] italic leading-none">{error}</p>
             </motion.div>
           )}
           {success && (
             <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} 
               className="p-10 rounded-[4rem] bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center gap-10 shadow-3xl backdrop-blur-3xl"
             >
                <CheckCircle size={48} className="text-emerald-500 bg-emerald-500/10 p-2 rounded-2xl" />
                <p className="text-[16px] font-black text-emerald-500 uppercase tracking-[0.8em] italic leading-none">{success}</p>
             </motion.div>
           )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
           {/* Sector Mapping Matrix */}
           <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }}
             className={`${glassStyle} rounded-[7rem] p-16 border-amber-500/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col bg-black/40`}
           >
              <div className="p-16 border-b-2 border-white/5 flex items-center justify-between mb-12 bg-white/[0.02] rounded-t-[6rem]">
                 <div className="flex items-center gap-8">
                    <div className="w-16 h-16 rounded-[1.8rem] bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center shadow-3xl"><Terminal size={28} className="text-amber-400" /></div>
                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Lattice Matrix</h2>
                 </div>
                 <div className="px-8 py-3 rounded-full bg-black/60 border-2 border-white/5 text-amber-500 text-[10px] font-black uppercase tracking-[0.5em] italic">HEURISTIC_SECTOR_LOCK</div>
              </div>
              <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none group-hover:rotate-45 transition-transform duration-[10s]"><Terminal size={600} className="text-amber-400" /></div>
              
              <div className="p-10 space-y-16 relative z-10 flex-1 flex flex-col">
                 <div className="space-y-8">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none ml-10 border-l-4 border-amber-500/20 pl-6">Sector Designations</label>
                    <div className="grid grid-cols-2 gap-8">
                       {sectors.map((sector) => (
                         <motion.button
                           whileHover={{ scale: 1.05, y: -10 }}
                           key={sector}
                           onClick={() => handleSectorChange(sector)}
                           disabled={saving}
                           className={`px-12 py-10 rounded-[4rem] text-[18px] font-black uppercase tracking-[0.4em] border-2 transition-all duration-300 italic shadow-3xl relative overflow-hidden flex items-center justify-between group/cell ${
                             userSector === sector
                               ? 'bg-white text-black border-white shadow-[0_60px_150px_rgba(255,255,255,0.1)]'
                               : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:border-amber-500/40'
                           }`}
                         >
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500/30 scale-x-0 group-hover/cell:scale-x-100 transition-transform" />
                            {sector.toUpperCase()}
                            {userSector === sector ? <CheckCircle size={32} className="text-emerald-600" /> : <ArrowRight size={24} className="opacity-10 group-hover/cell:opacity-40 transition-opacity translate-x-4" />}
                         </motion.button>
                       ))}
                    </div>
                 </div>

                 {currentPack && (
                   <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} 
                     className="p-16 bg-black/60 border-4 border-amber-500/10 rounded-[6rem] shadow-inner relative overflow-hidden mt-auto group/pack"
                   >
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent opacity-0 group-hover/pack:opacity-100 transition-opacity duration-300" />
                      <div className="flex items-center gap-10 mb-12 pb-12 border-b-2 border-white/5 relative z-10">
                         <div className="w-24 h-24 bg-amber-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-3xl border-4 border-white/20 group-hover/pack:rotate-12 transition-transform duration-300"><Layers size={48} /></div>
                         <div>
                            <p className="text-[12px] font-black text-amber-500 uppercase tracking-[1em] italic leading-none mb-3">SECTOR_INTEL_ARCHIVE</p>
                            <h3 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-2xl">{currentPack.name}</h3>
                         </div>
                      </div>
                      <p className="text-[20px] text-slate-700 font-black uppercase tracking-widest italic leading-relaxed mb-12 relative z-10 px-6 border-l-8 border-amber-500/20">{currentPack.description.toUpperCase()}</p>
                      <div className="space-y-8 relative z-10">
                         <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic leading-none ml-6">Operational Schematics</p>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-4">
                            {(currentPack.templates || []).map((t: any, idx: number) => (
                               <div key={idx} className="flex items-center gap-6 px-10 py-6 bg-black/80 border-2 border-white/5 rounded-[3rem] text-[15px] font-black text-white uppercase italic tracking-[0.2em] hover:border-amber-500/40 hover:scale-105 transition-all cursor-default shadow-3xl">
                                  <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,1)] animate-pulse" />
                                  {t.name.toUpperCase()}
                               </div>
                            ))}
                         </div>
                      </div>
                   </motion.div>
                 )}
              </div>
           </motion.div>

           {/* Identity Calibration Matrix */}
           <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1 }}
             className={`${glassStyle} rounded-[7rem] p-16 border-indigo-500/10 shadow-[0_100px_300px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col bg-black/40`}
           >
              <div className="p-16 border-b-2 border-white/5 flex items-center justify-between mb-12 bg-white/[0.02] rounded-t-[6rem]">
                 <div className="flex items-center gap-8">
                    <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-3xl"><Palette size={28} className="text-indigo-400" /></div>
                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Identity Hash</h2>
                 </div>
                 <div className="px-8 py-3 rounded-full bg-black/60 border-2 border-white/5 text-indigo-500 text-[10px] font-black uppercase tracking-[0.5em] italic">VISUAL_SIGNATURE_SYNC</div>
              </div>
              <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none -rotate-12 translate-x-1/2 -translate-y-1/2"><Palette size={800} className="text-indigo-400" /></div>
              
              <div className="p-10 space-y-16 relative z-10 flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                       <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none ml-10 border-l-4 border-indigo-500/20 pl-6">Resonance Polarity</label>
                       <div className="flex items-center gap-8 p-4 rounded-[4rem] bg-black/60 border-2 border-white/5 shadow-inner group/color focus-within:border-indigo-500/40 transition-all">
                          <div className="w-24 h-24 rounded-[3rem] shadow-3xl relative overflow-hidden border-4 border-white/10 cursor-pointer active:scale-90 transition-transform">
                             <input type="color" value={identitySettings.primaryColor} onChange={e => setIdentitySettings({ ...identitySettings, primaryColor: e.target.value })} className="absolute inset-0 scale-[5] cursor-pointer" />
                          </div>
                          <input type="text" value={identitySettings.primaryColor.toUpperCase()} onChange={e => setIdentitySettings({ ...identitySettings, primaryColor: e.target.value })} className="flex-1 bg-transparent text-4xl font-black text-white uppercase tracking-tighter italic focus:outline-none placeholder:text-slate-600 font-mono" />
                       </div>
                    </div>
                    <div className="space-y-8">
                       <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none ml-10 border-l-4 border-indigo-500/20 pl-6">Diffraction Baseline</label>
                       <div className="flex items-center gap-8 p-4 rounded-[4rem] bg-black/60 border-2 border-white/5 shadow-inner group/color focus-within:border-indigo-500/40 transition-all">
                          <div className="w-24 h-24 rounded-[3rem] shadow-3xl relative overflow-hidden border-4 border-white/10 cursor-pointer active:scale-90 transition-transform">
                             <input type="color" value={identitySettings.secondaryColor} onChange={e => setIdentitySettings({ ...identitySettings, secondaryColor: e.target.value })} className="absolute inset-0 scale-[5] cursor-pointer" />
                          </div>
                          <input type="text" value={identitySettings.secondaryColor.toUpperCase()} onChange={e => setIdentitySettings({ ...identitySettings, secondaryColor: e.target.value })} className="flex-1 bg-transparent text-4xl font-black text-white uppercase tracking-tighter italic focus:outline-none placeholder:text-slate-600 font-mono" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none ml-10 border-l-4 border-indigo-500/20 pl-6">Logic Topography</label>
                    <div className="relative group/sel">
                       <select value={identitySettings.font} onChange={e => setIdentitySettings({ ...identitySettings, font: e.target.value })} className="w-full appearance-none bg-black/60 border-4 border-white/10 rounded-[4rem] px-16 py-12 text-5xl font-black text-white italic uppercase focus:border-indigo-500/50 transition-all shadow-inner cursor-pointer hover:bg-black/80 hover:shadow-[inset_0_0_50px_rgba(255,255,255,0.02)]">
                          <option value="Arial" className="bg-[#050505]">ARIAL_LOGIC</option>
                          <option value="Helvetica" className="bg-[#050505]">HELVETICA_PROTOCOL</option>
                          <option value="Verdana" className="bg-[#050505]">VERDANA_FLOW</option>
                          <option value="Georgia" className="bg-[#050505]">GEORGIA_ARRAY</option>
                       </select>
                       <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/sel:text-indigo-400 transition-all bg-black/40 p-4 rounded-3xl border border-white/5 backdrop-blur-3xl shadow-3xl">
                          <ChevronRight size={48} className="rotate-90" />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-[0.8em] italic leading-none ml-10 border-l-4 border-indigo-500/20 pl-6">Visual Signature Uplink</label>
                    <div className="flex items-center gap-8 bg-black/60 border-4 border-white/10 rounded-[4rem] px-16 py-6 shadow-inner group/url focus-within:border-indigo-500/60 transition-all hover:bg-black/80">
                       <Globe size={48} className="text-slate-500 group-focus-within/url:text-indigo-400 transition-all group-hover/url:rotate-12" />
                       <input type="url" value={identitySettings.logo} onChange={e => setIdentitySettings({ ...identitySettings, logo: e.target.value })} className="flex-1 bg-transparent py-6 text-2xl font-black text-white uppercase tracking-tighter italic focus:outline-none placeholder:text-slate-600 font-mono" placeholder="HTTPS://IDENTITY_UPLINK..." />
                    </div>
                 </div>

                 <button onClick={handleIdentityUpdate} disabled={saving} className="w-full py-12 bg-white text-black hover:bg-indigo-600 hover:text-white rounded-[4.5rem] text-[20px] font-black uppercase tracking-[1em] shadow-[0_60px_150px_rgba(255,255,255,0.1)] hover:shadow-indigo-500/60 transition-all duration-300 italic disabled:opacity-20 flex items-center justify-center gap-10 active:scale-95 group/save relative overflow-hidden border-none outline-none">
                    <div className="absolute inset-x-0 bottom-0 h-2 bg-indigo-300 scale-x-0 group-hover/save:scale-x-100 transition-transform" />
                    {saving ? <RefreshCw className="animate-spin" size={48} /> : <ShieldCheck size={48} className="group-hover/save:scale-125 transition-transform" />} INITIALIZE_IDENTITY_HASH
                 </button>

                 {/* Rendering Buffer Preview */}
                 <div className="space-y-8 pt-16 border-t-2 border-white/5 mt-12 bg-black/20 p-8 rounded-[5rem] shadow-inner">
                    <div className="flex justify-between items-center px-10 mb-6">
                       <p className="text-[12px] font-black text-slate-500 uppercase tracking-[1em] italic leading-none">Identity Render Buffer</p>
                       <Gauge size={24} className="text-indigo-500/30 animate-pulse" />
                    </div>
                    <div className="p-4 border-2 border-white/5 rounded-[6rem] shadow-3xl bg-black/40 relative overflow-hidden">
                       <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-[0.05] pointer-events-none" />
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-96 rounded-[5.2rem] flex flex-col items-center justify-center gap-8 relative overflow-hidden group/preview shadow-[0_60px_150px_rgba(0,0,0,1)] border-4 border-white/10" style={{ background: `linear-gradient(135deg, ${identitySettings.primaryColor}, ${identitySettings.secondaryColor})`, fontFamily: identitySettings.font }}>
                          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/preview:opacity-30 transition-opacity duration-300" />
                          <div className="w-32 h-32 bg-white/20 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-center border-4 border-white/40 shadow-3xl group-hover/preview:scale-125 group-hover/preview:rotate-12 transition-transform duration-500">
                             <Box size={72} className="text-white drop-shadow-[0_0_40px_rgba(0,0,0,0.4)]" />
                          </div>
                          <div className="text-center relative z-10 px-8">
                             <p className="text-6xl font-black text-white uppercase tracking-tighter italic leading-none drop-shadow-[0_0_40px_rgba(0,0,0,0.6)] group-hover/preview:scale-110 transition-transform duration-300">Sovereign Axiom</p>
                             <div className="h-1.5 w-48 bg-white/40 mx-auto mt-8 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-white w-[60%] animate-pulse" /></div>
                             <p className="text-[14px] text-white/50 font-black uppercase tracking-[0.5em] italic mt-6 drop-shadow-2xl">Neural Wisdom Synthesis Node v2.0</p>
                          </div>
                       </motion.div>
                    </div>
                 </div>
              </div>
           </motion.div>
        </div>

        {/* Neural Lattice Navigation Swarm */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10 pt-24 border-t-2 border-white/5">
           {[
             { label: 'Neural Forge', desc: 'Synthetic logic crafting.', icon: Sparkles, color: 'text-indigo-400', href: '/dashboard/content' },
             { label: 'Temporal Hub', desc: 'Optimal node deployment.', icon: Calendar, color: 'text-amber-400', href: '/dashboard/scheduler' },
             { label: 'Axiom Vault', desc: 'Wisdom fractal repository.', icon: Network, color: 'text-purple-400', href: '/dashboard/library' },
             { label: 'Blueprint Array', desc: 'Operational prototypes.', icon: Layers, color: 'text-emerald-400', href: '/dashboard/templates' },
           ].map((a, i) => (
             <motion.button 
               whileHover={{ y: -20, scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }} 
               initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: i * 0.1 }}
               key={a.label} onClick={() => router.push(a.href)} 
               className={`${glassStyle} p-14 rounded-[5.5rem] group text-center flex flex-col items-center gap-10 border-white/5 hover:border-indigo-500/30 transition-all duration-300 shadow-[0_40px_100px_rgba(0,0,0,0.6)] bg-black/60`}
             >
                <div className="w-24 h-24 bg-white/[0.03] border-2 border-white/10 rounded-[2.5rem] flex items-center justify-center group-hover:rotate-[30deg] group-hover:scale-110 transition-all duration-300 shadow-3xl">
                   <a.icon size={48} className={a.color} />
                </div>
                <div className="space-y-3">
                   <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-400 transition-colors">{a.label}</h4>
                   <p className="text-[13px] text-slate-400 font-black uppercase tracking-widest italic leading-none opacity-40 group-hover:opacity-100 transition-opacity">{a.desc}</p>
                </div>
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-4 shadow-3xl">
                   <ArrowRight size={32} />
                </div>
             </motion.button>
           ))}
        </section>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin-slow { animation: spin-slow 20s linear infinite; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); border-radius: 10px; }
          ::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.2); border-radius: 10px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(245, 158, 11, 0.4); }
          select { -webkit-appearance: none; appearance: none; cursor: pointer; }
          input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
          input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2.2rem; }
          .shadow-3xl { filter: drop-shadow(0 40px 100px rgba(0,0,0,0.8)); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
