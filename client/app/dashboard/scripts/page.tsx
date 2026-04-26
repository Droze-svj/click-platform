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
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { apiGet, apiPost, apiDelete, api } from '../../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

interface Script {
  _id: string; title: string; type: string; topic: string
  wordCount: number; duration?: number; status: string
  createdAt: string; script?: string
}

const SAMPLE_PROMPTS = [
  'How I grew from 0 → 10K followers',
  'My morning routine breakdown',
  '3 mistakes beginners make',
  'Behind the scenes of a launch',
  'Tools I use every single day',
  'Lessons from my biggest failure',
]

const DEPLOYMENT_VECTORS: Record<string, { gradient: string; label: string; icon: any }> = {
  youtube:        { gradient: 'from-rose-600 to-rose-950',     label: 'YouTube',      icon: Radio },
  podcast:        { gradient: 'from-violet-600 to-indigo-950', label: 'Podcast',      icon: MessageSquare },
  'social-media': { gradient: 'from-emerald-500 to-teal-700',  label: 'Social Media', icon: Globe },
  blog:           { gradient: 'from-blue-600 to-slate-900',    label: 'Blog',         icon: Feather },
  email:          { gradient: 'from-amber-600 to-orange-950',  label: 'Email',        icon: Zap },
}

const TONAL_ALIGNMENTS = ['authoritative','inspiring','educational','visionary','precise','cascading','strategic']
const DOMAIN_MAP: Record<string, string> = { 'social-media': 'instagram', instagram: 'instagram', tiktok: 'tiktok', linkedin: 'linkedin', twitter: 'twitter' }

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-300'

export default function NarrativeLogicMatrixPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { state: workflow, completeStage } = useWorkflow()

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

  const [search, setSearch] = useState('')
  const [filterVector, setFilterVector] = useState<string>('all')
  const [purgeTargetId, setPurgeTargetId] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)

  const loadNarrativeMatrix = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await apiGet('/scripts')
      const data = res?.data ?? (Array.isArray(res) ? res : [])
      setScripts(data)
    } catch {
      showToast('Failed to load scripts', 'error')
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
        tone: alignment,
        targetAudience: archetypeReceptor || workflow.niche || (user as any)?.niche || 'general audience',
        platform: workflow.platform || DOMAIN_MAP[vector] || 'instagram',
      }
      if (linguisticParticles.trim()) options.keywords = linguisticParticles.split(/[\s,]+/).filter(Boolean).slice(0, 10)

      const res: any = await apiPost('/scripts/generate', { topic: seed.trim(), type: vector, options })
      const data = res?.data || res
      if (data?._id) {
        showToast('✓ Script generated', 'success')
        setLatestPhantomId(data._id); await loadNarrativeMatrix(); setShowTerminal(false); setSeed('')
        completeStage('script')
      }
    } catch {
      showToast('Generation failed', 'error')
    } finally { setSynthesizing(false) }
  }

  const handlePacketExtraction = async (id: string) => {
    try {
      const res = await api.get(`/scripts/${id}/export?format=txt`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      Object.assign(document.createElement('a'), { href: url, download: `narrative-packet-${id}.txt` }).click()
      URL.revokeObjectURL(url)
      showToast('✓ Exported', 'success')
    } catch { showToast('Export failed', 'error') }
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
      setCopyId(s._id); showToast('✓ Copied to clipboard', 'success')
      setTimeout(() => setCopyId(null), 2000)
    }
  }

  const handlePhantomDuplication = async (id: string) => {
    try {
      await apiPost(`/scripts/${id}/duplicate`, {})
      showToast('✓ Duplicated', 'success'); await loadNarrativeMatrix()
    } catch { showToast('Duplicate failed', 'error') }
  }

  const handlePhantomPurge = async (id: string) => {
    setPurging(true)
    try {
      await apiDelete(`/scripts/${id}`)
      showToast('✓ Deleted', 'success')
      if (latestPhantomId === id) setLatestPhantomId(null)
      await loadNarrativeMatrix()
    } catch { showToast('Delete failed', 'error') }
    finally { setPurging(false); setPurgeTargetId(null) }
  }

  const activePhantom = latestPhantomId ? scripts.find(s => s._id === latestPhantomId) : null
  const purgeTarget = purgeTargetId ? scripts.find(s => s._id === purgeTargetId) : null

  const filteredScripts = scripts.filter(s => {
    if (filterVector !== 'all' && s.type !== filterVector) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (s.topic || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-10 backdrop-blur-3xl">
       <div className="relative">
          <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
          <PenTool size={80} className="text-emerald-500 animate-spin relative z-10" />
       </div>
       <div className="space-y-4 text-center">
          <p className="text-[12px] font-bold text-emerald-400 uppercase tracking-[0.4em] animate-pulse leading-none">Loading scripts…</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.3em] leading-none">Please wait</p>
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
                className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-3xl hover:border-rose-500/50">
                <ArrowLeft size={40} />
              </button>
              <div className="w-24 h-24 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[3rem] flex items-center justify-center shadow-3xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-100" />
                <BookOpen size={48} className="text-emerald-400 relative z-10 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-4">
                      <Fingerprint size={16} className="text-emerald-400 animate-pulse" />
                      <span className="text-[12px] font-bold uppercase tracking-[0.4em] text-emerald-400 leading-none">Click · Scripts</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/60 border border-white/5 shadow-inner">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                       <span className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase leading-none">AI engine ready</span>
                   </div>
                 </div>
                 <h1 className="text-6xl font-black text-white tracking-tighter leading-none mb-4">Scripts</h1>
                 <p className="text-slate-400 text-[14px] font-medium tracking-wide mt-3 leading-relaxed">Generate, edit, and export AI scripts for every platform — YouTube, podcast, social, blog, email.</p>
              </div>
           </div>

           <button
             type="button"
             onClick={() => setShowTerminal(!showTerminal)}
             title={showTerminal ? 'Cancel' : 'Generate a new script'}
             className={`px-10 py-5 rounded-[2rem] text-[13px] font-bold uppercase tracking-[0.2em] shadow-xl transition-colors flex items-center gap-3 active:scale-95 ${showTerminal ? 'bg-white/5 text-slate-300 border-2 border-white/10 hover:text-white hover:bg-white/10 hover:border-rose-500/50' : 'bg-white text-black hover:bg-emerald-500 hover:text-white'}`}>
             {showTerminal ? <X size={18} /> : <Sparkles size={18} />}
             {showTerminal ? 'Cancel' : 'New Script'}
           </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
          {[
            { label: 'Total Scripts', value: scripts.length, color: 'text-white', icon: Layers, bg: 'bg-white/5' },
            { label: 'YouTube',       value: scripts.filter(s => s.type === 'youtube').length, color: 'text-rose-400', icon: Radio, bg: 'bg-rose-500/5' },
            { label: 'Social Media',  value: scripts.filter(s => s.type === 'social-media').length, color: 'text-emerald-400', icon: Gauge, bg: 'bg-emerald-500/5' },
            { label: 'Email',         value: scripts.filter(s => s.type === 'email').length, color: 'text-amber-400', icon: Zap, bg: 'bg-amber-500/5' },
          ].map((s, i) => (
            <motion.div 
               initial={{ opacity: 0, y: 30 }} 
               animate={{ opacity: 1, y: 0 }} 
               transition={{ delay: i * 0.1 }}
               key={s.label} 
               className={`${glassStyle} rounded-[5rem] p-16 flex flex-col items-center text-center group border-white/5 hover:bg-white/[0.04] shadow-inner hover:scale-105 transition-all duration-300`}
            >
               <div className={`w-24 h-24 ${s.bg} rounded-[2.5rem] flex items-center justify-center mb-10 border-2 border-white/10 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300 shadow-3xl`}>
                  <s.icon size={44} className={s.color} />
               </div>
               <div className={`text-6xl font-black tracking-tighter mb-4 tabular-nums leading-none ${s.color}`}>{s.value}</div>
               <div className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.3em] leading-none">{s.label}</div>
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
                <div className="relative flex items-center gap-8">
                   <div className="w-16 h-16 bg-white/10 rounded-[1.6rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 border-2 border-white/20"><Cpu size={28} className="text-emerald-400" /></div>
                   <div>
                      <p className="text-emerald-400 text-[11px] font-bold uppercase tracking-[0.3em] mb-2 leading-none">AI Script Generator</p>
                      <h2 className="text-white font-black tracking-tighter text-4xl leading-tight">Generate a new script</h2>
                   </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Engine ready</span>
                </div>
              </div>

              <form onSubmit={handleLinguisticSynthesis} className="p-12 space-y-12 bg-black/80">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                     <Target size={18} className="text-emerald-400" />
                     <label className="text-[12px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Quick start prompts</label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {SAMPLE_PROMPTS.map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSeed(q)}
                        title={`Use prompt: ${q}`}
                        className={`px-5 py-2.5 text-[12px] font-medium rounded-full border transition-colors ${seed === q ? 'bg-emerald-600 text-white border-transparent shadow-[0_8px_30px_rgba(16,185,129,0.3)]' : 'bg-white/[0.02] border-white/10 text-slate-300 hover:text-white hover:border-white/30'}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                  <div className="xl:col-span-2 space-y-5">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                       <Terminal size={18} className="text-emerald-400" />
                       <label htmlFor="seed-input" className="text-[12px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">What&apos;s your script about?</label>
                    </div>
                    <div className="relative group/input">
                       <input
                         id="seed-input"
                         type="text"
                         value={seed}
                         onChange={e => setSeed(e.target.value)}
                         required
                         title="Script topic"
                         placeholder="Enter your topic, hook, or angle..."
                         className="w-full bg-black/60 border-2 border-white/10 rounded-[1.5rem] px-8 py-6 text-2xl font-bold text-white tracking-tight focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner placeholder:text-slate-500 pr-20"
                       />
                       <PenTool size={28} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-emerald-500 transition-colors duration-300" />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                       <Radio size={18} className="text-emerald-400" />
                       <label className="text-[12px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Platform</label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(DEPLOYMENT_VECTORS).map(([id, cfg]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setVector(id)}
                          title={cfg.label}
                          className={`flex items-center gap-4 px-5 py-4 rounded-[1.5rem] text-[13px] font-bold border-2 transition-colors relative overflow-hidden group/v active:scale-95 ${vector === id ? `bg-white text-black border-transparent shadow-lg shadow-emerald-500/20` : 'bg-white/[0.02] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.05]'}`}>
                          <cfg.icon size={20} className={`relative z-10 ${vector === id ? 'text-black' : 'text-slate-400 group-hover/v:text-white'}`} />
                          <span className="relative z-10">{cfg.label}</span>
                          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-0 group-hover/v:opacity-[0.08] transition-opacity duration-300`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-10">
                     <div className="space-y-5">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                           <Activity size={18} className="text-emerald-400" />
                           <label className="text-[12px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Tone</label>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {TONAL_ALIGNMENTS.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAlignment(t)}
                              title={`Tone: ${t}`}
                              className={`px-5 py-2.5 rounded-full text-[12px] font-medium capitalize border transition-colors ${alignment === t ? 'bg-emerald-600 text-white border-transparent shadow-[0_8px_30px_rgba(16,185,129,0.3)]' : 'bg-white/[0.02] border-white/10 text-slate-300 hover:text-white hover:border-white/30'}`}>
                              {t}
                            </button>
                          ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                        {(vector === 'youtube' || vector === 'podcast') && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                               <Clock size={16} className="text-emerald-400" />
                               <label htmlFor="magnitude-input" className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Duration (minutes)</label>
                            </div>
                            <input
                              id="magnitude-input"
                              type="number"
                              value={magnitude}
                              onChange={e => setMagnitude(parseInt(e.target.value,10)||10)}
                              min={1}
                              max={120}
                              title="Duration"
                              className="w-full bg-black/60 border-2 border-white/10 rounded-[1rem] px-5 py-3.5 text-xl font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner tabular-nums"
                            />
                          </div>
                        )}
                        <div className="space-y-3">
                           <div className="flex items-center gap-3">
                              <Target size={16} className="text-emerald-400" />
                              <label htmlFor="receptor-input" className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Target audience</label>
                           </div>
                           <input
                              id="receptor-input"
                              type="text"
                              value={archetypeReceptor}
                              onChange={e => setArchetypeReceptor(e.target.value)}
                              placeholder="e.g. solo creators, busy parents, finance newbies"
                              title="Target audience"
                              className="w-full bg-black/60 border-2 border-white/10 rounded-[1rem] px-5 py-3.5 text-base font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner placeholder:text-slate-500"
                           />
                        </div>
                     </div>

                     <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-3">
                           <Hash size={16} className="text-emerald-400" />
                           <label htmlFor="particles-input" className="text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-none">Keywords (max 10)</label>
                        </div>
                        <input
                           id="particles-input"
                           type="text"
                           value={linguisticParticles}
                           onChange={e => setLinguisticParticles(e.target.value)}
                           placeholder="growth, productivity, mindset"
                           title="Keywords"
                           className="w-full bg-black/60 border-2 border-white/10 rounded-[1rem] px-5 py-3.5 text-base font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner placeholder:text-slate-500"
                        />
                        <p className="text-[10px] font-medium text-slate-500 pl-2">Comma- or space-separated. Optional.</p>
                     </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex justify-center">
                   <button
                     type="submit"
                     disabled={synthesizing}
                     title="Generate script"
                     className="max-w-2xl w-full flex items-center justify-center gap-4 py-5 bg-white text-black hover:bg-emerald-500 hover:text-white disabled:opacity-40 rounded-[2rem] text-[14px] font-bold uppercase tracking-[0.3em] shadow-[0_30px_80px_rgba(255,255,255,0.1)] transition-colors active:scale-[0.98] group relative overflow-hidden"
                   >
                     <div className="absolute inset-0 bg-emerald-600 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                     {synthesizing ? (
                       <div className="relative z-10 flex items-center gap-3">
                         <RefreshCw size={18} className="animate-spin" /> Generating…
                       </div>
                     ) : (
                       <div className="relative z-10 flex items-center gap-3">
                         <Sparkles size={18} /> Generate Script
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
              <div className="flex items-center gap-6">
                 <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-30 animate-pulse" />
                    <div className="relative w-14 h-14 bg-emerald-500 text-black rounded-[1.4rem] flex items-center justify-center shadow-xl border border-white/20"><Zap size={22} /></div>
                 </div>
                 <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-400 mb-2 leading-none">Latest script</p>
                    <p className="text-2xl font-black text-white tracking-tight truncate max-w-3xl leading-tight group-hover:text-emerald-400 transition-colors">{activePhantom.title}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button type="button" onClick={() => router.push(`/dashboard/scripts/${activePhantom._id}`)}
                  className="flex-1 md:flex-none px-8 py-3.5 bg-white text-black rounded-[1.5rem] text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-colors shadow-lg active:scale-95">
                  Open script
                </button>
                <button type="button" title="Export" onClick={() => handlePacketExtraction(activePhantom._id)}
                  className="w-12 h-12 bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:border-white/30 rounded-[1.2rem] flex items-center justify-center transition-colors">
                  <Download size={18} />
                </button>
                <button type="button" title="Dismiss" onClick={() => setLatestPhantomId(null)} className="w-12 h-12 bg-white/5 border border-white/10 text-slate-500 hover:text-white rounded-[1.2rem] flex items-center justify-center transition-colors"><X size={18} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Narrative Matrix Results */}
        <div className={`${glassStyle} rounded-[6rem] overflow-hidden relative z-10 flex flex-col min-h-[850px] border-2 border-white/5 shadow-[0_100px_250px_rgba(0,0,0,1)]`}>
          <div className="flex flex-col md:flex-row items-center justify-between px-20 py-20 border-b-2 border-white/5 bg-white/[0.01] gap-16 relative overflow-hidden backdrop-blur-3xl">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700"><Database size={400} className="text-white" /></div>
            <div className="flex items-center gap-6 relative z-10">
               <div className="w-14 h-14 bg-indigo-500/10 border-2 border-indigo-500/20 rounded-[1.6rem] flex items-center justify-center shadow-lg"><Network size={26} className="text-indigo-400" /></div>
               <div>
                  <h2 className="text-3xl font-black text-white tracking-tighter leading-none mb-2">Your scripts</h2>
                  <p className="text-[13px] text-slate-400 font-medium leading-none">Browse, edit, duplicate, and export.</p>
               </div>
            </div>

            <div className="flex items-center gap-3 relative z-10">
               <div className="px-5 py-2.5 rounded-full bg-black/60 border border-white/5 text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-3">
                  <Database size={14} className="text-indigo-400" /> {filteredScripts.length} / {scripts.length} scripts
               </div>
            </div>
          </div>

          {/* Search + Platform Filter Bar */}
          {scripts.length > 0 && (
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 px-10 py-5 border-b border-white/5 bg-black/40 relative z-10">
               <div className="relative flex-1 group/search">
                  <Target size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-emerald-400 transition-colors" />
                  <input
                     type="text"
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                     placeholder="Search scripts by topic or title…"
                     className="w-full bg-black/60 border border-white/10 rounded-full pl-12 pr-10 py-3 text-[13px] font-medium text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-500"
                  />
                  {search && (
                     <button type="button" onClick={() => setSearch('')} title="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500/20">
                        <X size={12} />
                     </button>
                  )}
               </div>
               <div className="flex items-center gap-2 flex-wrap">
                  {[{ id: 'all', label: 'All' }, ...Object.entries(DEPLOYMENT_VECTORS).map(([id, cfg]) => ({ id, label: cfg.label }))].map(opt => (
                     <button
                        type="button"
                        key={opt.id}
                        onClick={() => setFilterVector(opt.id)}
                        className={`px-4 py-2 rounded-full text-[11px] font-medium border transition-colors ${filterVector === opt.id ? 'bg-emerald-600 text-white border-transparent' : 'bg-white/[0.02] border-white/10 text-slate-300 hover:text-white hover:border-white/30'}`}
                     >
                        {opt.label}
                     </button>
                  ))}
               </div>
            </div>
          )}

          <div className="flex-1 flex flex-col bg-black/20">
            {scripts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-24 gap-8">
                <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center">
                   <Activity size={44} className="text-slate-500" />
                </div>
                <div className="text-center space-y-3">
                   <p className="text-3xl font-black text-white tracking-tight leading-tight">No scripts yet</p>
                   <p className="text-[13px] font-medium text-slate-400 max-w-md leading-relaxed">Generate your first AI script — pick a platform, set the tone, and let Click write it for you.</p>
                </div>
                <button type="button" onClick={() => setShowTerminal(true)} className="px-8 py-3.5 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-3">
                   <Sparkles size={16} /> Generate first script
                </button>
              </div>
            ) : filteredScripts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6">
                <Target size={40} className="text-slate-500" />
                <div className="text-center space-y-2">
                   <p className="text-2xl font-black text-white tracking-tight leading-tight">No matches</p>
                   <p className="text-[12px] font-medium text-slate-400 leading-relaxed">Adjust filters or clear your search.</p>
                </div>
                <button type="button" onClick={() => { setSearch(''); setFilterVector('all') }} className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:text-white hover:border-emerald-500/50 transition-colors">
                   Reset filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {filteredScripts.map((s, idx) => {
                  const cfg = DEPLOYMENT_VECTORS[s.type] || { gradient: 'from-slate-600 to-black', label: s.type, icon: FileText }
                  const isNew = s._id === latestPhantomId
                  return (
                    <motion.div 
                      key={s._id}
                      initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.7 }}
                      className={`group flex flex-col xl:flex-row items-center gap-16 px-20 py-14 hover:bg-white/[0.04] transition-all duration-700 relative overflow-hidden ${isNew ? 'bg-emerald-500/5' : ''}`}
                    >
                      {isNew && <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,1)]" />}
                      <div className="absolute top-0 right-0 p-16 opacity-[0.01] group-hover:opacity-[0.05] transition-opacity duration-300"><cfg.icon size={250} /></div>
                      
                      <div className={`w-24 h-24 rounded-[3rem] bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white font-black text-4xl shadow-2xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700 border border-white/20`}>
                        <cfg.icon size={44} />
                      </div>
                      
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center gap-4 mb-2">
                          <p className="text-2xl font-black text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors leading-tight">{s.topic || s.title || 'Untitled script'}</p>
                          {isNew && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500 text-black uppercase tracking-[0.2em] shadow-lg">New</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[12px] font-medium text-slate-400">
                          <span className="px-3 py-1 bg-black/40 rounded-md border border-white/5 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-400 text-[11px] font-bold uppercase tracking-[0.2em]">{cfg.label}</span>
                          <div className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="flex items-center gap-2 group-hover:text-white transition-colors"><Database size={14} className="text-indigo-400" /> {s.wordCount.toLocaleString()} words</span>
                          {s.duration != null && <><div className="w-1 h-1 rounded-full bg-slate-700" /><span className="flex items-center gap-2 group-hover:text-white transition-colors"><Gauge size={14} className="text-indigo-400" /> {s.duration} min read</span></>}
                          <div className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><Clock size={14} /> {new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 xl:opacity-0 xl:group-hover:opacity-100 transition-all duration-300 xl:translate-x-4 xl:group-hover:translate-x-0 relative z-10">
                        <button type="button" onClick={() => router.push(`/dashboard/scripts/${s._id}`)}
                          className="w-11 h-11 bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white hover:border-white/30 rounded-[1rem] flex items-center justify-center transition-colors active:scale-95" title="View script">
                          <Eye size={16} />
                        </button>
                        <button type="button" onClick={() => handlePacketExtraction(s._id)}
                          className="w-11 h-11 bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white hover:border-white/30 rounded-[1rem] flex items-center justify-center transition-colors active:scale-95" title="Export">
                          <Download size={16} />
                        </button>
                        <button type="button" onClick={() => handleSequenceCapture(s)}
                          className="w-11 h-11 bg-white/[0.03] border border-white/10 text-slate-300 hover:text-white hover:border-white/30 rounded-[1rem] flex items-center justify-center transition-colors active:scale-95" title="Copy script">
                          {copyId === s._id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                        </button>
                        <button type="button" onClick={() => setPurgeTargetId(s._id)}
                          className="w-11 h-11 bg-rose-500/5 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-[1rem] flex items-center justify-center transition-colors active:scale-95" title="Delete">
                          <Trash2 size={16} />
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-2" />
                        <button type="button" onClick={() => router.push(`/dashboard/scripts/${s._id}`)}
                          className="px-7 py-3 bg-white text-black rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-colors shadow-lg flex items-center gap-2 active:scale-95 group/act">
                          Open <ArrowRight size={14} className="group-hover/act:translate-x-1 transition-transform" />
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

      {/* Purge Confirmation Modal */}
      <AnimatePresence>
        {purgeTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-12 bg-[#020205]/90 backdrop-blur-2xl" onClick={() => !purging && setPurgeTargetId(null)}>
            <motion.div
               initial={{ opacity: 0, scale: 0.92, y: 24 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.92, y: 24 }}
               transition={{ type: 'spring', damping: 22, stiffness: 240 }}
               onClick={e => e.stopPropagation()}
               className={`${glassStyle} rounded-[4rem] p-12 max-w-2xl w-full border-rose-500/20 shadow-[0_60px_180px_rgba(244,63,94,0.15)] relative overflow-hidden`}
            >
               <div className="absolute top-0 right-0 p-12 opacity-[0.04] pointer-events-none"><Trash2 size={220} className="text-rose-500" /></div>
               <div className="flex items-start gap-5 mb-8 relative z-10">
                  <div className="w-12 h-12 rounded-[1.2rem] bg-rose-500/10 border-2 border-rose-500/30 flex items-center justify-center shrink-0">
                     <Trash2 size={20} className="text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.3em] mb-2">Permanent action</p>
                     <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">Delete this script?</h3>
                     <p className="text-[13px] font-medium text-slate-400 leading-relaxed">
                        <span className="text-white font-bold">{purgeTarget.topic || purgeTarget.title || 'Untitled script'}</span> will be permanently deleted. This cannot be undone.
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-3 justify-end relative z-10">
                  <button
                     type="button"
                     onClick={() => setPurgeTargetId(null)}
                     disabled={purging}
                     className="px-6 py-3 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                  >
                     Cancel
                  </button>
                  <button
                     type="button"
                     onClick={() => handlePhantomPurge(purgeTarget._id)}
                     disabled={purging}
                     className="px-8 py-3 bg-rose-600 text-white rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-rose-500 transition-colors shadow-[0_20px_60px_rgba(244,63,94,0.3)] disabled:opacity-40 flex items-center gap-2.5"
                  >
                     {purging ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                     {purging ? 'Deleting…' : 'Delete script'}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
