'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Copy, Download, Trash2, Eye, CopyPlus, Sparkles, X, Check,
  ArrowLeft, FileText, RefreshCw, Clock, Hash, Plus, ChevronDown,
  Terminal, Cpu, Activity, Shield, Globe, Target, Radio, Layers,
  Zap, Share2, ArrowRight, Gauge, Database, Network, BookOpen,
  Feather, PenTool, Type, MessageSquare, Fingerprint
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import { apiGet, apiPost, apiDelete, api } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

interface Script {
  _id: string; title: string; type: string; topic: string
  wordCount: number; duration?: number; status: string
  createdAt: string; script?: string
}

const CONCEPTUAL_SEEDLINGS = [
  'QUANTUM_GROWTH_MODEL', 'SOVEREIGN_NARRATIVE_V4',
  'NEURAL_ORCHESTRATION', 'KINETIC_RHETORIC_STRATUM',
  'LATTICE_LOGIC_SCAN', 'RESONANCE_GEOMETRY',
]

const DEPLOYMENT_VECTORS: Record<string, { gradient: string; label: string; icon: any }> = {
  youtube:      { gradient: 'from-rose-600 to-rose-950',         label: 'Cinematic_Node',      icon: Radio },
  podcast:      { gradient: 'from-violet-600 to-indigo-950',   label: 'Auditory_Resonance',       icon: MessageSquare },
  'social-media': { gradient: 'from-emerald-500 to-teal-700',  label: 'Resonance_Cap',  icon: Globe },
  blog:         { gradient: 'from-blue-600 to-slate-900',     label: 'Linguistic_Array',          icon: Feather },
  email:        { gradient: 'from-amber-600 to-orange-950',    label: 'Uplink_Direct',         icon: Zap },
}

const TONAL_ALIGNMENTS = ['authoritative','inspiring','educational','visionary','precise','cascading','strategic']
const DOMAIN_MAP: Record<string, string> = { 'social-media': 'instagram', instagram: 'instagram', tiktok: 'tiktok', linkedin: 'linkedin', twitter: 'twitter' }

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

export default function NarrativeLogicMatrixPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [synthesizing, setSynthesizing] = useState(false)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [latestPhantomId, setLatestPhantomId] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)

  const [seed, setSeed] = useState('')
  const [vector, setVector] = useState('youtube')
  const [magnitude, setMagnitude] = useState(10)
  const [alignment, setAlignment] = useState('authoritative')
  const [archetypeReceptor, setArchetypeReceptor] = useState('')
  const [linguisticParticles, setLinguisticParticles] = useState('')

  const loadNarrativeMatrix = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await apiGet('/scripts')
      const data = res?.data ?? (Array.isArray(res) ? res : [])
      setScripts(data)
    } catch {
      showToast('MATRIX_SYNC_ERR: UPLINK_DIFFRACTED', 'error')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { if (!user) router.push('/login'); else loadNarrativeMatrix() }, [user, router, loadNarrativeMatrix])

  const handleLinguisticSynthesis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!seed.trim()) return
    setSynthesizing(true)
    try {
      const options: Record<string, any> = {
        duration: (vector === 'youtube' || vector === 'podcast') ? magnitude : undefined,
        tone: alignment, targetAudience: archetypeReceptor || (user as any)?.niche || 'universal_archetype',
      }
      if (vector === 'social-media') options.platform = DOMAIN_MAP[vector] || 'instagram'
      if (linguisticParticles.trim()) options.keywords = linguisticParticles.split(/[\s,]+/).filter(Boolean).slice(0, 10)

      const res: any = await apiPost('/scripts/generate', { topic: seed.trim(), type: vector, options })
      const data = res?.data || res
      if (data?._id) {
        showToast('✓ LINGUISTIC_SYNTHESIS_COMPLETE', 'success')
        setLatestPhantomId(data._id); await loadNarrativeMatrix(); setShowTerminal(false); setSeed('')
      }
    } catch {
      showToast('SYNTH_FAIL: NARRATIVE_COLLAPSE', 'error')
    } finally { setSynthesizing(false) }
  }

  const handlePacketExtraction = async (id: string) => {
    try {
      const res = await api.get(`/scripts/${id}/export?format=txt`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      Object.assign(document.createElement('a'), { href: url, download: `narrative-packet-${id}.txt` }).click()
      URL.revokeObjectURL(url)
      showToast('✓ PACKET_EXTRACTED_FROM_LEDGER', 'success')
    } catch { showToast('EXTRACTION_ERR: DATA_VOID', 'error') }
  }

  const handleSequenceCapture = async (s: Script) => {
    let text = s.script
    if (!text) {
      try {
        const res: any = await apiGet(`/scripts/${s._id}`)
        text = (res?.data || res)?.script
      } catch { return }
    }
    if (text) {
      await navigator.clipboard.writeText(text)
      setCopyId(s._id); showToast('✓ SEQUENCE_CAPTURED_TO_BUFFER', 'success')
      setTimeout(() => setCopyId(null), 2000)
    }
  }

  const handlePhantomDuplication = async (id: string) => {
    try {
      await apiPost(`/scripts/${id}/duplicate`, {})
      showToast('✓ NARRATIVE_PHANTOM_CLONED', 'success'); await loadNarrativeMatrix()
    } catch { showToast('CLONE_ERR: MATRIX_REJECTION', 'error') }
  }

  const handlePhantomPurge = async (id: string) => {
    if (!confirm('Purge this narrative phantom?')) return
    try { 
      await apiDelete(`/scripts/${id}`)
      showToast('✓ PHANTOM_DE-EXISTED', 'success')
      if (latestPhantomId === id) setLatestPhantomId(null); await loadNarrativeMatrix() 
    } catch { showToast('PURGE_ERR: SYSTEM_LOCK', 'error') }
  }

  const activePhantom = latestPhantomId ? scripts.find(s => s._id === latestPhantomId) : null

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen gap-10 backdrop-blur-3xl">
       <div className="relative">
          <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
          <PenTool size={80} className="text-emerald-500 animate-spin relative z-10" />
       </div>
       <div className="space-y-4 text-center">
          <p className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Synchronizing Narrative Matrix...</p>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] leading-none">HEURISTIC_ORCHESTRATION_IN_PROGRESS</p>
       </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1700px] mx-auto space-y-20">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
            <Feather size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Narrative Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button 
                onClick={() => router.push('/dashboard')} 
                title="Abort Protocol"
                className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl hover:border-rose-500/50">
                <ArrowLeft size={40} />
              </button>
              <div className="w-24 h-24 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-100" />
                <BookOpen size={48} className="text-emerald-400 relative z-10 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-1000" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-emerald-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-emerald-400 italic leading-none">Narrative Logic Matrix v14.2.8</span>
                   </div>
                   <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-ping" />
                       <span className="text-[10px] font-black text-slate-900 tracking-widest uppercase italic leading-none">SYNTHESIS_ENGINE_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Narrative Matrix</h1>
                 <p className="text-slate-900 text-[14px] uppercase font-black tracking-[0.4em] mt-6 italic leading-none">Central orchestration node for linguistic synthesis and sovereign narrative structures.</p>
              </div>
           </div>

           <button 
             onClick={() => setShowTerminal(!showTerminal)}
             title={showTerminal ? 'Abort Synthesis' : 'Init Particle'}
             className={`px-16 py-8 rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-3xl transition-all duration-1000 flex items-center gap-8 italic active:scale-95 ${showTerminal ? 'bg-white/5 text-slate-800 border-2 border-white/10 hover:text-white hover:bg-white/10 hover:border-rose-500/50' : 'bg-white text-black hover:bg-emerald-500 hover:text-white hover:scale-105'}`}>
             {showTerminal ? <X size={32} /> : <Sparkles size={32} />}
             {showTerminal ? 'ABORT_SYNTHESIS' : 'INITIALIZE_HEURISTIC_PARTICLE'}
           </button>
        </div>

        {/* Narrative Insight HUD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
          {[
            { label: 'Logic Particles', value: scripts.length, color: 'text-white', icon: Layers, bg: 'bg-white/5' },
            { label: 'Cinematic Flows', value: scripts.filter(s => s.type === 'youtube').length, color: 'text-rose-400', icon: Radio, bg: 'bg-rose-500/5' },
            { label: 'Archetypal Loops', value: scripts.filter(s => s.type === 'social-media').length, color: 'text-emerald-400', icon: Gauge, bg: 'bg-emerald-500/5' },
            { label: 'Direct Uplinks', value: scripts.filter(s => s.type === 'email').length, color: 'text-amber-400', icon: Zap, bg: 'bg-amber-500/5' },
          ].map((s, i) => (
            <motion.div 
               initial={{ opacity: 0, y: 30 }} 
               animate={{ opacity: 1, y: 0 }} 
               transition={{ delay: i * 0.1 }}
               key={s.label} 
               className={`${glassStyle} rounded-[5rem] p-16 flex flex-col items-center text-center group border-white/5 hover:bg-white/[0.04] shadow-inner hover:scale-105 transition-all duration-1000`}
            >
               <div className={`w-24 h-24 ${s.bg} rounded-[2.5rem] flex items-center justify-center mb-10 border-2 border-white/10 group-hover:rotate-12 group-hover:scale-110 transition-all duration-1000 shadow-3xl`}>
                  <s.icon size={44} className={s.color} />
               </div>
               <div className={`text-7xl font-black italic tracking-tighter mb-6 tabular-nums leading-none ${s.color}`}>{s.value}</div>
               <div className="text-[12px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Linguistic Synthesis Terminal */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 100 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.95, y: 100 }} 
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 border-emerald-500/30 shadow-[0_100px_250px_rgba(0,0,0,1)]`}
            >
               <div className="bg-emerald-600/10 p-20 border-b-2 border-emerald-600/20 flex flex-col xl:flex-row items-center justify-between gap-16 relative overflow-hidden backdrop-blur-3xl">
                <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #10b981, transparent 60%)' }} />
                <div className="relative flex items-center gap-12">
                   <div className="w-24 h-24 bg-white/10 rounded-[3rem] flex items-center justify-center shadow-3xl shadow-emerald-500/20 border-2 border-white/20 group-hover:scale-110 transition-transform"><Cpu size={48} className="text-emerald-400" /></div>
                   <div>
                      <p className="text-emerald-500/60 text-[12px] font-black uppercase tracking-[0.8em] mb-3 leading-none italic">HEURISTIC_SYNTH_ENGINE_V6.0</p>
                      <h2 className="text-white font-black italic uppercase tracking-tighter text-7xl leading-none">Heuristic Synthesis Core</h2>
                   </div>
                </div>
                <div className="flex items-center gap-8 px-12 py-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                   <div className="w-4 h-4 rounded-full bg-emerald-500 animate-ping shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                   <span className="text-[15px] font-black text-emerald-400 uppercase tracking-[0.6em] italic">CORE_STATUS_STABLE</span>
                </div>
              </div>
              
              <form onSubmit={handleLinguisticSynthesis} className="p-20 space-y-24 bg-black/80">
                <div className="space-y-12">
                  <div className="flex items-center gap-6 border-b-2 border-white/5 pb-6">
                     <Target size={24} className="text-emerald-400" />
                     <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Conceptual Seedlings</label>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    {CONCEPTUAL_SEEDLINGS.map(q => (
                      <button 
                        key={q} 
                        type="button" 
                        onClick={() => setSeed(q)}
                        title={`Select ${q}`}
                        className={`px-8 py-4 text-[12px] font-black uppercase tracking-widest rounded-full border-2 transition-all duration-700 italic shadow-3xl ${seed === q ? 'bg-emerald-600 text-white border-transparent shadow-[0_0_50px_rgba(16,185,129,0.4)] scale-110 -translate-y-2' : 'bg-white/[0.02] border-white/5 text-slate-800 hover:text-white hover:border-white/20'}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-24">
                  <div className="xl:col-span-2 space-y-12">
                    <div className="flex items-center gap-6 border-b-2 border-white/5 pb-6">
                       <Terminal size={24} className="text-emerald-400" />
                       <label htmlFor="seed-input" className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Narrative Focal Designation</label>
                    </div>
                    <div className="relative group/input">
                       <input 
                         id="seed-input"
                         type="text" 
                         value={seed} 
                         onChange={e => setSeed(e.target.value)} 
                         required
                         title="Narrative Identifier"
                         placeholder="ASSIGN_NARRATIVE_IDENTIFIER..."
                         className="w-full bg-black/60 border-2 border-white/5 rounded-[4rem] px-20 py-16 text-4xl font-black text-white uppercase tracking-widest focus:outline-none focus:border-emerald-500/50 transition-all italic shadow-inner placeholder:text-slate-950 pr-40" 
                       />
                       <PenTool size={48} className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-950 group-focus-within/input:text-emerald-500 transition-colors duration-1000" />
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="flex items-center gap-6 border-b-2 border-white/5 pb-6">
                       <Radio size={24} className="text-emerald-400" />
                       <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Deployment Vector</label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {Object.entries(DEPLOYMENT_VECTORS).map(([id, cfg]) => (
                        <button 
                          key={id} 
                          type="button" 
                          onClick={() => setVector(id)}
                          title={`Vector: ${cfg.label}`}
                          className={`flex items-center gap-8 px-10 py-8 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.4em] border-2 transition-all duration-1000 italic shadow-3xl relative overflow-hidden group/v active:scale-95 ${vector === id ? `bg-white text-black border-transparent scale-[1.05] shadow-emerald-500/20` : 'bg-white/[0.02] border-white/5 text-slate-800 hover:text-white hover:bg-white/[0.05]'}`}>
                          <cfg.icon size={44} className={`relative z-10 transition-transform duration-1000 ${vector === id ? 'text-black' : 'text-slate-900 group-hover/v:scale-125 group-hover/v:rotate-6'}`} /> 
                          <span className="relative z-10 uppercase tracking-tighter">{cfg.label}</span>
                          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-0 group-hover/v:opacity-[0.05] transition-opacity duration-1000`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-20">
                     <div className="space-y-12">
                        <div className="flex items-center gap-6 border-b-2 border-white/5 pb-6">
                           <Activity size={24} className="text-emerald-400" />
                           <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Tonal Alignment (Signal Modulation)</label>
                        </div>
                        <div className="flex flex-wrap gap-6">
                          {TONAL_ALIGNMENTS.map(t => (
                            <button 
                              key={t} 
                              type="button" 
                              onClick={() => setAlignment(t)}
                              title={`Alignment: ${t}`}
                              className={`px-8 py-4 rounded-[2rem] text-[12px] font-black uppercase tracking-widest border-2 transition-all duration-700 italic shadow-3xl ${alignment === t ? 'bg-emerald-600 text-white border-transparent shadow-[0_0_50px_rgba(16,185,129,0.4)] scale-110 -translate-y-2' : 'bg-white/[0.02] border-white/5 text-slate-800 hover:text-white hover:bg-white/[0.05]'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-16 pt-4">
                        {(vector === 'youtube' || vector === 'podcast') && (
                          <div className="space-y-10">
                            <div className="flex items-center gap-6">
                               <Clock size={20} className="text-emerald-400" />
                               <label htmlFor="magnitude-input" className="text-[12px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none">Temporal Magnitude (Mins)</label>
                            </div>
                            <input 
                              id="magnitude-input"
                              type="number" 
                              value={magnitude} 
                              onChange={e => setMagnitude(parseInt(e.target.value,10)||10)} 
                              min={1} 
                              max={120}
                              title="Temporal Magnitude"
                              className="w-full bg-black/60 border-2 border-white/5 rounded-[2.5rem] px-12 py-8 text-3xl font-black text-white uppercase italic focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner tabular-nums" 
                            />
                          </div>
                        )}
                        <div className="space-y-10">
                           <div className="flex items-center gap-6">
                              <Target size={20} className="text-emerald-400" />
                              <label htmlFor="receptor-input" className="text-[12px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none">Archetypal Receptors (Target)</label>
                           </div>
                           <input 
                              id="receptor-input"
                              type="text" 
                              value={archetypeReceptor} 
                              onChange={e => setArchetypeReceptor(e.target.value)}
                              placeholder="UNIVERSAL_ARCHETYPE..."
                              title="Archetypal Receptors"
                              className="w-full bg-black/60 border-2 border-white/5 rounded-[2.5rem] px-12 py-8 text-3xl font-black text-white uppercase tracking-[0.4em] italic focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner placeholder:text-slate-950" 
                           />
                        </div>
                     </div>
                  </div>
                </div>

                <div className="pt-24 border-t-2 border-white/5 mt-16 flex justify-center">
                   <button 
                     type="submit" 
                     disabled={synthesizing}
                     title="Initiate Synthesis"
                     className="max-w-4xl w-full flex items-center justify-center gap-12 py-12 bg-white text-black hover:bg-emerald-500 hover:text-white disabled:opacity-20 rounded-[5rem] text-[24px] font-black uppercase tracking-[1em] shadow-[0_50px_150px_rgba(255,255,255,0.1)] transition-all duration-1000 hover:-translate-y-5 active:translate-y-0 italic active:scale-[0.98] group relative overflow-hidden"
                   >
                     <div className="absolute inset-0 bg-emerald-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-1000" />
                     {synthesizing ? (
                       <div className="relative z-10 flex items-center gap-10">
                         <RefreshCw size={48} className="animate-spin" /> SYNCHRONIZING_LINGUISTICS...
                       </div>
                     ) : (
                       <div className="relative z-10 flex items-center gap-10">
                         <Sparkles size={48} className="group-hover:scale-125 group-hover:rotate-12 transition-transform duration-1000" /> INITIATE_SYNTHESIS
                       </div>
                     )}
                   </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicator HUB */}
        <AnimatePresence>
          {activePhantom && (
            <motion.div 
               initial={{ opacity: 0, x: -50 }} 
               animate={{ opacity: 1, x: 0 }} 
               exit={{ opacity: 0, x: -50 }}
               className="flex flex-col md:flex-row items-center justify-between gap-12 p-12 bg-emerald-500/5 border border-emerald-500/20 rounded-[5rem] relative z-20 shadow-[0_40px_100px_rgba(16,185,129,0.1)] backdrop-blur-3xl overflow-hidden group"
            >
              <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500 group-hover:h-2 transition-all duration-700" />
              <div className="flex items-center gap-12">
                 <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-40 animate-pulse" />
                    <div className="relative w-20 h-20 bg-emerald-500 text-black rounded-[2.2rem] flex items-center justify-center shadow-2xl border border-white/20"><Zap size={40} /></div>
                 </div>
                 <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.7em] text-emerald-500 mb-3 leading-none italic">LATEST_NARRATIVE_PHANTOM_DETECTED</p>
                    <p className="text-4xl font-black text-white uppercase italic tracking-tighter truncate max-w-3xl leading-none group-hover:text-emerald-400 transition-colors duration-700">{activePhantom.title}</p>
                 </div>
              </div>
              <div className="flex items-center gap-8 w-full md:w-auto">
                <button onClick={() => router.push(`/dashboard/scripts/${activePhantom._id}`)}
                  className="flex-1 md:flex-none px-16 py-7 bg-white text-black rounded-[2.5rem] text-[14px] font-black uppercase tracking-[0.5em] hover:bg-emerald-500 hover:text-white transition-all duration-700 shadow-2xl italic active:scale-95">
                  ACTIVATE_LOGIC
                </button>
                <button onClick={() => handlePacketExtraction(activePhantom._id)}
                  className="w-20 h-20 bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white rounded-[2rem] flex items-center justify-center transition-all bg-white/[0.05] shadow-2xl group/ex">
                  <Download size={32} className="group-hover/ex:translate-y-2 transition-transform duration-700" />
                </button>
                <button onClick={() => setLatestPhantomId(null)} className="p-6 bg-white/5 border border-white/10 text-slate-900 hover:text-white rounded-[1.8rem] transition-all"><X size={32} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Narrative Matrix Results */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 flex flex-col min-h-[850px] border-2 border-white/5 shadow-[0_100px_250px_rgba(0,0,0,1)]`}>
          <div className="flex flex-col md:flex-row items-center justify-between px-20 py-20 border-b-2 border-white/5 bg-white/[0.01] gap-16 relative overflow-hidden backdrop-blur-3xl">
            <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-[3s]"><Database size={400} className="text-white" /></div>
            <div className="flex items-center gap-12 relative z-10">
               <div className="w-24 h-24 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-transform duration-1000"><Network size={48} className="text-indigo-400" /></div>
               <div>
                  <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Narrative Matrix</h2>
                  <p className="text-[14px] text-slate-900 font-black uppercase tracking-[0.6em] italic leading-none">Continuous surveillance of sovereign logic particles</p>
               </div>
            </div>
            
            <div className="flex items-center gap-8 relative z-10">
               <div className="px-10 py-5 rounded-full bg-black/60 border-2 border-white/5 text-[12px] font-black text-slate-900 uppercase tracking-widest italic flex items-center gap-6 shadow-3xl">
                  <Database size={20} className="text-indigo-400" /> {scripts.length} PARTICLES_DETECTED
               </div>
               <div className="px-10 py-5 rounded-full bg-indigo-500/10 border-2 border-indigo-500/20 text-[12px] font-black text-indigo-400 uppercase tracking-widest italic flex items-center gap-6 shadow-[0_0_50px_rgba(79,70,229,0.2)]">
                  <Radio size={20} className="animate-pulse" /> SURVEILLANCE_ACTIVE_V9
               </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-black/20">
            {scripts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-64 opacity-[0.05] gap-16">
                <div className="w-48 h-48 bg-white/5 rounded-[6rem] border border-white/10 flex items-center justify-center shadow-2xl relative animate-pulse">
                   <Activity size={100} className="text-white" />
                </div>
                <div className="text-center space-y-6">
                   <p className="text-5xl font-black text-white uppercase tracking-[0.6em] italic leading-none">Matrix Void</p>
                   <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none">Initiate linguistic synthesis to activate neural instructional phantoms.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {scripts.map((s, idx) => {
                  const cfg = DEPLOYMENT_VECTORS[s.type] || { gradient: 'from-slate-600 to-black', label: s.type, icon: FileText }
                  const isNew = s._id === latestPhantomId
                  return (
                    <motion.div 
                      key={s._id}
                      initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.7 }}
                      className={`group flex flex-col xl:flex-row items-center gap-16 px-20 py-14 hover:bg-white/[0.04] transition-all duration-700 relative overflow-hidden ${isNew ? 'bg-emerald-500/5' : ''}`}
                    >
                      {isNew && <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,1)]" />}
                      <div className="absolute top-0 right-0 p-16 opacity-[0.01] group-hover:opacity-[0.05] transition-opacity duration-1000"><cfg.icon size={250} /></div>
                      
                      <div className={`w-24 h-24 rounded-[3rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-black text-4xl shadow-2xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700 border border-white/20`}>
                        <cfg.icon size={44} />
                      </div>
                      
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center gap-8 mb-4">
                          <p className="text-[36px] font-black text-white italic uppercase tracking-tighter truncate group-hover:text-emerald-400 transition-all duration-700 leading-none">{s.topic?.toUpperCase() || s.title?.toUpperCase() || 'PHANTOM_PARTICLE'}</p>
                          {isNew && <span className="text-[11px] font-black px-5 py-2 rounded-full bg-emerald-500 text-black uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-pulse scale-110">ACTIVE_PHANTOM</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-12 text-[12px] font-black text-slate-800 uppercase tracking-widest italic">
                          <span className={`px-5 py-2 bg-black/40 rounded-xl border border-white/5 transition-colors duration-700 group-hover:border-emerald-500/30 group-hover:text-emerald-400`}>{cfg.label.toUpperCase()}</span>
                          <div className="w-2 h-2 rounded-full bg-slate-950" />
                          <span className="flex items-center gap-4 group-hover:text-white transition-colors duration-700"><Database size={18} className="text-indigo-400" /> {s.wordCount} BITS_LOGIC</span>
                          {s.duration != null && <><div className="w-2 h-2 rounded-full bg-slate-950" /><span className="flex items-center gap-4 group-hover:text-white transition-colors duration-700"><Gauge size={18} className="text-indigo-400" /> {s.duration} MINS_EXEC</span></>}
                          <div className="w-2 h-2 rounded-full bg-slate-950" />
                          <span className="flex items-center gap-4 opacity-40 group-hover:opacity-100 transition-opacity duration-700"><Clock size={20} /> SYNC: {new Date(s.createdAt).toLocaleDateString().toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 xl:opacity-0 xl:group-hover:opacity-100 transition-all duration-700 xl:translate-x-12 xl:group-hover:translate-x-0 relative z-10">
                        <button onClick={() => router.push(`/dashboard/scripts/${s._id}`)}
                          className="w-16 h-16 bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white rounded-[1.8rem] flex items-center justify-center transition-all duration-700 hover:scale-110 shadow-2xl active:scale-95 group/exv" title="Visual Interface">
                          <Eye size={28} className="group-hover/exv:scale-125 transition-transform" />
                        </button>
                        <button onClick={() => handlePacketExtraction(s._id)}
                          className="w-16 h-16 bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white rounded-[1.8rem] flex items-center justify-center transition-all duration-700 hover:scale-110 shadow-2xl active:scale-95 group/exp" title="Extract Logic">
                          <Download size={28} className="group-hover/exp:translate-y-2 transition-transform" />
                        </button>
                        <button onClick={() => handleSequenceCapture(s)}
                          className="w-16 h-16 bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white rounded-[1.8rem] flex items-center justify-center transition-all duration-700 hover:scale-110 shadow-2xl active:scale-95" title="Inertial Capture">
                          {copyId === s._id ? <Check size={28} className="text-emerald-400 animate-pulse" /> : <Copy size={28} className="hover:scale-110" />}
                        </button>
                        <button onClick={() => handlePhantomPurge(s._id)}
                          className="w-16 h-16 bg-rose-500/5 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1.8rem] flex items-center justify-center transition-all duration-700 hover:scale-110 shadow-2xl active:scale-95 group/purge" title="Purge Node">
                          <Trash2 size={28} className="group-hover/purge:rotate-12 transition-transform" />
                        </button>
                        <div className="w-[1px] h-16 bg-white/10 mx-6" />
                        <button onClick={() => router.push(`/dashboard/scripts/${s._id}`)}
                          className="px-16 py-8 bg-white text-black rounded-[3rem] text-[15px] font-black uppercase tracking-[0.5em] hover:bg-emerald-500 hover:text-white transition-all duration-700 shadow-[0_30px_70px_rgba(255,255,255,0.15)] italic flex items-center gap-6 active:scale-95 group/act">
                          ACTIVATE_PHANTOM <ArrowRight size={24} className="group-hover/act:translate-x-3 transition-transform duration-700" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        
        body { font-family: 'Outfit', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.1); border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.3); border: 2px solid transparent; background-clip: content-box; }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </ErrorBoundary>
  )
}
