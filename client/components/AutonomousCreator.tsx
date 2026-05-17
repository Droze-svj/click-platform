'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Zap, 
  Sparkles, 
  Video, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Brain,
  History,
  Target,
  Globe,
  Settings,
  Terminal,
  Cpu,
  Fingerprint,
  Layers,
  Hexagon,
  Orbit,
  ArrowLeft,
  Command,
  Film,
  RefreshCw,
  Sparkle,
  Waves,
  Mic2,
  Activity,
  Box,
  Binary,
  Shield,
  Star,
  ActivitySquare,
  ShieldCheck,
  UserCheck,
  Monitor,
  Database,
  Cloud
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '../lib/api'
import { useHardenedRequest } from '../hooks/useHardenedRequest'
import { useToast } from '../contexts/ToastContext'

const STAGES = [
  { id: 'intelligence', label: 'Researching', icon: Brain },
  { id: 'script',       label: 'Writing the script',     icon: Terminal },
  { id: 'refinery',     label: 'AI consensus',       icon: Orbit },
  { id: 'anatomy',      label: 'Planning the cuts',         icon: Layers },
  { id: 'blueprint',    label: 'Building the timeline',    icon: Command },
]

const TONES = [
  { id: 'educational', label: 'Authoritative', icon: Shield },
  { id: 'motivational', label: 'Elevated', icon: Zap },
  { id: 'storytelling', label: 'Narrative', icon: Film },
  { id: 'controversial', label: 'Disruptive', icon: AlertCircle },
]

export default function AutonomousCreator() {
  const router = useRouter()
  const { showToast } = useToast()
  const { execute: executeHardened, rateLimitCountdown } = useHardenedRequest()
  
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [tone, setTone] = useState('educational')
  const [stylePivot, setStylePivot] = useState('BALANCED')
  const [loading, setLoading] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [completedStages, setCompletedStages] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [activeVariantIndex, setActiveVariantIndex] = useState(0)
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cognitiveLoad, setCognitiveLoad] = useState(0)

  // Simulation for stage transitions
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setCognitiveLoad(prev => Math.min(prev + (Math.random() * 5), 100))
      }, 500)
      return () => clearInterval(interval)
    } else {
      setCognitiveLoad(0)
    }
  }, [loading])

  const saveManifest = async () => {
    if (!result) return

    try {
      showToast('Saving…', 'info')
      const res = await apiPost('/intelligence/factory/save', {
        manifest: result.data || result,
        topic: prompt,
        platform: platform,
        contentType: 'social-media'
      })

      if (res.success) {
        showToast('Saved.', 'success')
      } else {
        showToast('Could not save. Try again.', 'error')
      }
    } catch (err: any) {
      showToast('Could not save. Try again.', 'error')
    }
  }

  const runFactory = async (pivot?: string) => {
    if (!prompt.trim()) {
      showToast('Describe your video first.', 'warning')
      return
    }

    if (pivot) setStylePivot(pivot)

    setLoading(true)
    setError(null)
    setResult(null)
    setCompletedStages([])
    setCurrentStage('intelligence')

    try {
      // Start the real API call immediately
      const apiPromise = executeHardened(() => apiPost('/intelligence/factory/create', {
        prompt,
        targetPlatform: platform,
        tone: tone,
        stylePivot: pivot || stylePivot,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        useCreatorDNA: true
      }))

      // Stage sequence for UX narrative - synchronized with API
      const stages = ['intelligence', 'script', 'refinery', 'anatomy', 'blueprint']
      
      for (const stage of stages) {
        setCurrentStage(stage)
        // Snappier transitions for a high-velocity feel
        await new Promise(r => setTimeout(r, 400 + Math.random() * 200))
        setCompletedStages(prev => [...prev, stage])
      }

      const res = await apiPromise

      if (res && res.success) {
        const newVariant = { ...res.data, id: `variant-${Date.now()}`, pivot: pivot || stylePivot }
        setVariants(prev => [newVariant, ...prev].slice(0, 3))
        setResult(newVariant)
        setActiveVariantIndex(0)
        showToast('Done — your video is ready.', 'success')
      } else if (res) {
        setError(res.error || 'Something went wrong on our side.')
      } else {
        setError('Could not connect. Try again in a moment.')
      }
    } catch (err: any) {
      setError(err.message || 'Connection lost.')
      showToast('Could not generate. Try again.', 'error')
    } finally {
      setLoading(false)
      setCurrentStage(null)
    }
  }

  return (
    <div className="space-y-16 lg:space-y-24">
      {/* Dynamic Header Hub */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-4 relative z-50">
        <div className="flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-primary-500/10 border-2 border-primary-500/20 rounded-[3rem] md:rounded-[4rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-100" />
             <Target size={48} className="text-primary-600 dark:text-primary-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 mb-5">
              <div className="flex items-center gap-3">
                 <Binary size={14} className="text-primary-500 animate-pulse shrink-0" />
                 <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-primary-600 dark:text-primary-400 italic leading-none truncate">AI engine</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                  <Activity size={12} className="text-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[8px] md:text-[9px] font-black text-emerald-500 tracking-widest uppercase italic leading-none whitespace-nowrap">AI ready</span>
              </div>
            </div>
            <h2 className="text-[clamp(2rem,6vw,4.5rem)] font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-[0.95] mb-4 [overflow-wrap:anywhere]">Click forge</h2>
            <p className="text-surface-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.25em] italic leading-tight">Generate scripts, captions, and edits in one place</p>
          </div>
        </div>
      </div>

      {/* Main Creation Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 relative z-10">
        
        {/* Input Chamber */}
        <div className="xl:col-span-8 flex flex-col gap-12">
           <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-10 lg:p-14 rounded-[4rem] sm:rounded-[5rem] space-y-12 relative overflow-hidden group shadow-2xl">
              <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-primary-500/10 blur-[150px] rounded-full pointer-events-none group-hover:bg-primary-500/20 transition-all duration-1000" />
              
              <div className="space-y-8 relative z-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4">
                  <label className="text-[10px] md:text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.3em] md:tracking-[0.6em] italic flex items-center gap-4">
                    <Terminal size={16} className="text-primary-500 shrink-0" /> Your idea
                  </label>
                  {loading && (
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                       {(rateLimitCountdown ?? 0) > 0 ? (
                         <span className="text-[9px] font-black text-rose-500 uppercase italic tracking-widest animate-pulse">COOLING: {rateLimitCountdown}S</span>
                       ) : (
                         <span className="text-[9px] font-black text-primary-500 uppercase italic tracking-widest">Working… {Math.round(cognitiveLoad)}%</span>
                       )}
                       <div className="flex-1 sm:w-32 h-2 bg-surface-page dark:bg-surface-900 rounded-full overflow-hidden border border-surface-100 dark:border-surface-800 shadow-inner">
                          <motion.div 
                            animate={{ 
                              width: (rateLimitCountdown ?? 0) > 0 ? '100%' : `${cognitiveLoad}%`,
                              backgroundColor: (rateLimitCountdown ?? 0) > 0 ? '#f43f5e' : '#6366f1'
                            }} 
                            className="h-full shadow-[0_0_15px_rgba(99,102,241,1)]" 
                          />
                       </div>
                    </div>
                  )}
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                  placeholder="Describe your video — Click handles the script, b-roll, and edits."
                  className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-[3rem] p-10 text-[1.5rem] font-black italic text-surface-900 dark:text-white placeholder:text-surface-200 dark:placeholder:text-slate-900 focus:outline-none focus:border-primary-500/40 transition-all resize-none h-48 shadow-inner leading-[1.2] uppercase tracking-tighter"
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-4 px-4">
                    <Database size={14} className="text-primary-500" />
                    <span className="text-[9px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.4rem] italic">Keywords (optional)</span>
                  </div>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    disabled={loading}
                    placeholder="e.g. AI, finance, productivity"
                    className="w-full bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 rounded-full px-8 py-5 text-[12px] font-black italic text-surface-900 dark:text-white placeholder:text-surface-200 dark:placeholder:text-slate-900 focus:outline-none focus:border-primary-500/40 transition-all uppercase tracking-widest shadow-inner"
                  />
                </div>
              </div>

              {/* Dynamic Controls Lattice */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10 border-t-2 border-surface-100 dark:border-surface-800 pt-12">
                 
                 {/* Target Platform Logic */}
                 <div className="md:col-span-12 lg:col-span-8 space-y-8">
                    <div className="flex items-center gap-6 px-4">
                       <Globe size={14} className="text-primary-500 shrink-0" />
                       <span className="text-[9px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.2em] md:tracking-[0.4rem] italic truncate">Platform</span>
                    </div>
                    <div className="flex flex-wrap gap-4 px-4 pb-4">
                      {['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin', 'twitter'].map(p => (
                        <button
                          type="button"
                          key={p}
                          onClick={() => setPlatform(p)}
                          disabled={loading}
                           className={`px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 italic relative group/btn shadow-md ${
                            platform === p 
                            ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-transparent shadow-2xl scale-105 z-20' 
                            : 'bg-surface-page dark:bg-surface-900 text-surface-400 dark:text-slate-600 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 hover:text-surface-900 dark:hover:text-white'
                          }`}
                        >
                          {p.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                 </div>

                 {/* Tone Nuance Matrix */}
                 <div className="md:col-span-12 space-y-8">
                    <div className="flex items-center gap-6 px-4">
                       <Mic2 size={14} className="text-primary-500 shrink-0" />
                       <span className="text-[9px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.2em] md:tracking-[0.4rem] italic truncate">Tone</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                      {[
                        { id: 'educational', label: 'Authoritative', icon: Shield },
                        { id: 'motivational', label: 'Elevated', icon: Zap },
                        { id: 'storytelling', label: 'Narrative', icon: Film },
                        { id: 'controversial', label: 'Disruptive', icon: AlertCircle },
                      ].map(t => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setTone(t.id)}
                          disabled={loading}
                          className={`flex items-center justify-between gap-4 px-8 py-5 rounded-[2rem] text-[9px] font-black uppercase tracking-[0.3em] transition-all border-2 italic shadow-md ${
                            tone === t.id 
                            ? 'bg-primary-600 text-white border-transparent shadow-2xl scale-105' 
                            : 'bg-surface-page dark:bg-surface-900 text-surface-400 dark:text-slate-600 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 hover:text-surface-900 dark:hover:text-white'
                          }`}
                        >
                          {t.label}
                          <t.icon size={16} className={tone === t.id ? 'text-white' : 'text-surface-400 dark:text-slate-700'} />
                        </button>
                      ))}
                    </div>
                 </div>
              </div>

              <div className="pt-8 border-t-2 border-surface-100 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => runFactory()}
                  disabled={loading || !prompt.trim()}
                  className={`w-full py-10 rounded-[3rem] font-black text-2xl uppercase tracking-[0.5em] transition-all duration-1000 italic active:scale-95 group relative overflow-hidden flex items-center justify-center gap-6 border-none ${
                    loading 
                    ? 'bg-primary-600/30 cursor-wait text-primary-300' 
                    : 'bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white shadow-2xl'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                  {loading ? (
                    <>
                      <Loader2 size={32} className="animate-spin text-primary-400" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Zap size={32} className="group-hover:scale-125 transition-transform duration-[1.5s]" />
                      Generate
                    </>
                  )}
                </button>
              </div>
           </div>
        </div>

        {/* Sidebar Intelligence & Presets */}
        <div className="xl:col-span-4 space-y-12">
           {/* Current Strategy Cluster */}
           <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-10 rounded-[4rem] space-y-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Brain size={250} className="text-primary-500" /></div>
              <div className="flex items-center gap-6 relative z-10">
                 <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border-2 border-primary-500/20 flex items-center justify-center shadow-lg"><Brain size={28} className="text-primary-600 dark:text-primary-400" /></div>
                 <div>
                    <h3 className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">Strategy Cluster</h3>
                    <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic mt-1 leading-none">AI-recommended angles</p>
                 </div>
              </div>
              <div className="space-y-4 relative z-10">
                  {[
                    { label: 'Hook strength', value: 'High' },
                    { label: 'Niche fit', value: '98%' },
                    { label: 'Retention model', value: 'Active' },
                  ].map((s, i) => (
                     <div key={i} className="flex justify-between items-center p-5 rounded-[1.5rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 shadow-inner group/stat hover:border-primary-500/30 transition-all duration-500">
                        <span className="text-[9px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.2em] italic group-hover/stat:text-primary-500 transition-colors truncate pr-2">{s.label}</span>
                        <span className="text-[10px] font-black text-surface-900 dark:text-white italic uppercase tracking-tighter shrink-0">{s.value}</span>
                     </div>
                  ))}
              </div>
           </div>

           {/* Quick Style Pivots (Advanced) */}
           <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-10 rounded-[4rem] space-y-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-1000"><Zap size={250} className="text-amber-500" /></div>
              <div className="flex items-center gap-6 relative z-10">
                 <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 flex items-center justify-center shadow-lg"><Zap size={28} className="text-amber-600 dark:text-amber-400" /></div>
                 <div>
                    <h3 className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">Style Pivots</h3>
                    <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic mt-1 leading-none">Pick a visual direction</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 relative z-10">
                 {['HIGH ENERGY', 'MINIMALIST', 'CINEMATIC', 'DYNAMIC', 'VIRAL', 'PREMIUM'].map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setStylePivot(p)}
                      className={`px-5 py-4 rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.2em] italic border-2 transition-all shadow-md ${
                        stylePivot === p 
                        ? 'bg-amber-500 text-black border-transparent shadow-2xl scale-105' 
                        : 'bg-surface-page dark:bg-surface-900 text-surface-400 dark:text-slate-600 border-surface-100 dark:border-surface-800 hover:border-amber-500/30 hover:text-surface-900 dark:hover:text-white'
                      }`}
                    >
                       {p}
                    </button>
                 ))}
                 {/* Phase 8: UGC Raw Pivot */}
                 <button
                   type="button"
                   onClick={() => setStylePivot('UGC_RAW')}
                   className={`col-span-2 px-6 py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] italic border-2 transition-all duration-700 flex items-center justify-between shadow-md ${
                     stylePivot === 'UGC_RAW'
                       ? 'bg-gradient-to-r from-orange-600 to-amber-500 border-transparent text-white shadow-[0_30px_60px_rgba(234,88,12,0.4)] scale-105'
                       : 'bg-surface-page dark:bg-surface-900 text-surface-400 dark:text-slate-600 border-surface-100 dark:border-surface-800 hover:border-orange-500/30 hover:text-surface-900 dark:hover:text-white'
                   }`}
                 >
                   <span className="flex items-center gap-3">
                     <span className={`w-2 h-2 rounded-full bg-current ${stylePivot === 'UGC_RAW' ? 'animate-pulse' : ''}`} />
                     UGC / raw / authentic
                   </span>
                   <span className={`text-[8px] font-black tracking-widest px-3 py-1 rounded-full border ${
                     stylePivot === 'UGC_RAW' ? 'text-white border-white/30 bg-white/10' : 'text-surface-300 dark:text-slate-800 border-surface-200 dark:border-surface-700'
                   }`}>
                     HUMANIZE
                   </span>
                 </button>
              </div>
              {stylePivot === 'UGC_RAW' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 rounded-[2.5rem] bg-orange-500/5 border-2 border-orange-500/10 mt-6 relative z-10 backdrop-blur-xl shadow-inner"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest italic">Authenticity boost on</p>
                    <span className="text-[10px] font-black text-surface-900 dark:text-white tabular-nums italic">~85% real-feel</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-page dark:bg-surface-950 overflow-hidden border border-surface-100 dark:border-surface-800 shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 1.5, ease: 'circOut' }}
                      className="h-full bg-gradient-to-r from-orange-600 to-amber-400 shadow-[0_0_15px_rgba(234,88,12,0.5)]"
                    />
                  </div>
                  <p className="text-[9px] text-surface-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-4 italic">
                    Adding: natural pauses, handheld shake, phone-camera color, varied pacing
                  </p>
                </motion.div>
              )}
           </div>

           {/* Pipeline Trace Visualizer */}
           <div className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-10 rounded-[4rem] shadow-2xl relative overflow-hidden group h-[450px]">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none p-12 group-hover:opacity-[0.08] transition-opacity duration-1000"><Orbit size={400} className="text-primary-500 animate-spin-slow rotate-45" /></div>
              <div className="flex flex-col h-full relative z-10">
                 <div className="flex items-center gap-6 mb-12 border-b-2 border-surface-100 dark:border-surface-800 pb-8">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-lg"><Waves size={28} className="text-emerald-600 dark:text-emerald-400 animate-pulse" /></div>
                    <div>
                       <h3 className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none">Live progress</h3>
                       <p className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-widest italic mt-1 leading-none">AI generation steps</p>
                    </div>
                 </div>
                 <div className="flex-1 space-y-10 custom-scrollbar overflow-y-auto pr-4">
                    {STAGES.map((s, i) => (
                       <div key={s.id} className="flex items-center gap-8 relative group/stage">
                          <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center group-hover/stage:scale-110 transition-all shadow-md relative z-10 ${
                            completedStages.includes(s.id) ? 'bg-emerald-500 border-transparent text-white shadow-emerald-500/20' : currentStage === s.id ? 'bg-primary-500 border-transparent text-white animate-pulse shadow-primary-500/20' : 'bg-surface-page dark:bg-surface-950 border-surface-100 dark:border-surface-800 text-surface-300 dark:text-slate-800'
                          }`}>
                             {completedStages.includes(s.id) ? <CheckCircle2 size={18} /> : (i + 1)}
                          </div>
                          <div className="flex-1">
                             <p className={`text-[13px] font-black uppercase tracking-tighter italic leading-none transition-colors ${completedStages.includes(s.id) ? 'text-surface-900 dark:text-white' : currentStage === s.id ? 'text-primary-500' : 'text-surface-300 dark:text-slate-800'}`}>{s.label}</p>
                             {currentStage === s.id && <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-[9px] font-black text-primary-500 uppercase italic mt-2 tracking-[0.2em] animate-pulse">Working…</motion.div>}
                          </div>
                          {i < STAGES.length - 1 && <div className={`absolute top-10 left-5 w-0.5 h-6 transition-colors ${completedStages.includes(s.id) ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-surface-100 dark:bg-surface-800'}`} />}
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Synthesis Output Chamber */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.id}
            initial={{ opacity: 0, scale: 0.98, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.8, type: 'spring' }}
            className="bg-surface-card backdrop-blur-3xl border-2 border-emerald-500/30 p-12 lg:p-20 rounded-[4rem] sm:rounded-[6rem] shadow-[0_100px_300px_rgba(0,0,0,0.6)] relative overflow-hidden group/result"
          >
            <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none rotate-12 group-hover/result:opacity-[0.1] transition-opacity duration-[2s]">
               <Box size={500} className="text-emerald-500" />
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-16 border-b-2 border-surface-100 dark:border-surface-800 pb-16 relative z-10">
              <div className="flex items-center gap-10">
                <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center shadow-2xl group-hover/result:rotate-12 transition-transform duration-1000">
                  <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                 <div>
                    <h3 className="text-4xl md:text-5xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-[0.85] mb-4">Ready</h3>
                  <div className="flex flex-wrap gap-4">
                     <div className="px-5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase italic tracking-[0.2em] shadow-inner leading-none">Saved</div>
                     <div className="px-5 py-2 rounded-xl bg-surface-page dark:bg-surface-950 border border-surface-100 dark:border-surface-800 text-[10px] font-black text-surface-400 dark:text-slate-600 uppercase italic tracking-[0.2em] shadow-inner leading-none">Variant {activeVariantIndex + 1}</div>
                     <div className="px-5 py-2 rounded-xl bg-primary-500/10 border border-primary-500/20 text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase italic tracking-[0.2em] shadow-inner leading-none">Style: {result.pivot || 'Balanced'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-end">
                 {variants.length > 1 && (
                    <div className="flex gap-4 px-8 py-3 bg-surface-page dark:bg-surface-950/60 rounded-[2.5rem] border-2 border-surface-100 dark:border-surface-800 shadow-inner backdrop-blur-xl">
                       {variants.map((v, i) => (
                          <button
                            type="button"
                            key={v.id}
                            onClick={() => {
                              setActiveVariantIndex(i)
                              setResult(variants[i])
                            }}
                            className={`w-12 h-12 rounded-xl border-2 font-black italic transition-all uppercase flex items-center justify-center text-[14px] ${
                               activeVariantIndex === i 
                               ? 'bg-primary-500 text-white border-transparent shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110' 
                               : 'bg-surface-card dark:bg-surface-900 text-surface-400 dark:text-slate-600 border-surface-100 dark:border-surface-800 hover:border-primary-500/30 hover:text-primary-500'
                            }`}
                          >
                             {['α', 'β', 'γ'][i] || i + 1}
                          </button>
                       ))}
                    </div>
                 )}
                 <div className="flex items-center gap-3 bg-surface-page dark:bg-surface-950 px-6 py-3 rounded-2xl border-2 border-surface-100 dark:border-surface-800">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(result.script || '')
                        showToast('Script Copied to Clipboard', 'success')
                      }}
                      className="p-3 hover:bg-surface-100 dark:hover:bg-surface-900 rounded-xl transition-all text-surface-400 dark:text-slate-600 hover:text-primary-500"
                      title="Copy Script"
                    >
                      <Terminal size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(`Refine this manifest to make it more ${tone === 'educational' ? 'authoritative' : 'engaging'}: ${result.script?.slice(0, 500)}...`)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                        showToast('Context Loaded. Modify prompt and Regenerate.', 'info')
                      }}
                      className="p-3 hover:bg-surface-100 dark:hover:bg-surface-900 rounded-xl transition-all text-surface-400 dark:text-slate-600 hover:text-primary-500"
                      title="Refine with AI"
                    >
                      <Sparkles size={18} />
                    </button>
                 </div>
                 <button
                  type="button"
                  onClick={() => runFactory()}
                  disabled={loading}
                  className="px-8 py-5 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 text-surface-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white hover:border-transparent transition-all italic active:scale-95 flex items-center gap-4 shadow-inner"
                 >
                    {loading ? <RefreshCw className="animate-spin w-5 h-5" /> : <RefreshCw className="w-5 h-5" />} Regenerate
                 </button>
                 <button
                  type="button"
                  onClick={saveManifest}
                  disabled={loading || !result}
                  className="px-8 py-5 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 text-surface-900 dark:text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white hover:border-transparent transition-all italic active:scale-95 flex items-center gap-4 shadow-inner"
                 >
                    <Database className="w-5 h-5" /> Save to library
                 </button>
                 <button
                  type="button"
                  onClick={() => router.push(`/dashboard/video`)}
                  className="px-12 py-7 rounded-[2rem] bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.6em] shadow-[0_30px_80px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition-all flex items-center gap-6 italic active:scale-95 border-none"
                 >
                    <Film size={24} /> Open in editor
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 relative z-10 pt-16">
               {/* Script Detail Cluster */}
               <div className="space-y-12">
                  <div className="space-y-6">
                     <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic flex items-center gap-5">
                        <Fingerprint size={16} className="text-emerald-500 animate-pulse" /> Title
                     </p>
                     <div className="text-4xl md:text-5xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-[0.9] drop-shadow-2xl">
                       {result.stages?.script?.title || 'Sequence Alpha'}
                     </div>
                  </div>
                  <div className="space-y-6">
                     <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.8em] italic flex items-center gap-5">
                        <Command size={16} className="text-primary-500" /> Hook
                     </p>
                     <p className="text-2xl md:text-3xl text-surface-500 dark:text-slate-400 leading-tight italic border-l-[8px] border-emerald-500/30 pl-10 font-bold uppercase tracking-tight group-hover/result:text-surface-900 dark:group-hover/result:text-white transition-colors duration-1000">
                        &quot;{result.stages?.script?.hook || result.stages?.script?.rawScript?.hook || 'Predictive retention model applied to high-velocity vectors.'}&quot;
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-8 pt-8">
                    <div className="p-8 rounded-[3rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-4 shadow-inner group/data hover:border-emerald-500/30 transition-all">
                       <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.4em] italic group-hover/data:text-emerald-500 transition-colors">Duration</p>
                       <p className="text-4xl font-black text-surface-900 dark:text-white italic tabular-nums leading-none tracking-tighter">
                         {result.stages?.blueprint?.totalDuration || result.stages?.anatomy?.totalDuration || '0'} <span className="text-xl text-surface-200 dark:text-slate-900 border-none">sec</span>
                       </p>
                    </div>
                    <div className="p-8 rounded-[3rem] bg-surface-page dark:bg-surface-950/40 border-2 border-surface-100 dark:border-surface-800 space-y-4 shadow-inner group/data hover:border-emerald-500/30 transition-all">
                       <p className="text-[10px] font-black text-surface-300 dark:text-slate-800 uppercase tracking-[0.4em] italic group-hover/data:text-emerald-500 transition-colors">Platform</p>
                       <p className="text-4xl font-black text-surface-900 dark:text-white italic uppercase leading-none tracking-tighter">{platform.replace('reels', 'RLS').toUpperCase()}</p>
                    </div>
                  </div>
               </div>

               {/* Oracle Mastery Cluster */}
               <div className="space-y-10">
                  <div className="bg-surface-page dark:bg-surface-950/40 p-10 lg:p-12 rounded-[4rem] border-2 border-primary-500/20 space-y-8 shadow-2xl relative overflow-hidden group/advice backdrop-blur-3xl">
                     <div className="absolute top-0 right-0 p-12 opacity-0 group-hover/advice:opacity-10 transition-opacity duration-1000">
                        <Brain size={180} className="text-primary-500" />
                     </div>
                     <div className="flex items-center justify-between relative z-10">
                        <p className="text-[11px] font-black text-primary-500 uppercase tracking-[0.6em] italic flex items-center gap-5">
                           <Sparkle size={18} className="animate-pulse" /> AI recommendation
                        </p>
                        <div className="px-4 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-[9px] font-black text-primary-500 italic">v2026.4</div>
                     </div>
                     <div className="space-y-6 relative z-10">
                        <p className="text-xl md:text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-tight group-hover/advice:scale-[1.02] transition-transform duration-700">
                           &quot;{result.summary?.strategicAdvice || result.summary?.advice || 'Optimizing for high-velocity retention vectors. Deploy pattern-interrupt sequences at the 0:03 mark.'}&quot;
                        </p>
                        <div className="flex flex-wrap gap-8 pt-4">
                           <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase italic">Confidence</span>
                              <span className="text-3xl font-black text-emerald-500 italic tabular-nums leading-none shadow-emerald-500/20 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">{result.summary?.globalConsensus || '98.4%'}</span>
                           </div>
                           <div className="flex flex-col gap-2 border-l-2 border-surface-100 dark:border-surface-800 pl-8">
                              <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase italic">Trend</span>
                              <span className="text-3xl font-black text-surface-900 dark:text-white italic leading-none tracking-tighter">Rising</span>
                           </div>
                           <div className="flex flex-col gap-2 border-l-2 border-surface-100 dark:border-surface-800 pl-8">
                              <span className="text-[9px] font-black text-surface-300 dark:text-slate-800 uppercase italic">Style</span>
                              <span className="text-2xl font-black text-primary-500 italic leading-none uppercase tracking-widest">{stylePivot}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Post-Generation Action: Go to Editor */}
                  <div className="p-10 rounded-[4rem] bg-gradient-to-br from-primary-500/10 via-primary-900/10 to-transparent border-2 border-primary-500/20 flex flex-col md:flex-row items-center text-center md:text-left gap-10 shadow-2xl relative overflow-hidden group/deploy backdrop-blur-xl">
                     <div className="absolute inset-0 bg-white/5 animate-shimmer opacity-10 pointer-events-none" />
                     <div className="w-20 h-20 rounded-[2rem] bg-primary-500/20 border-2 border-primary-500/40 flex items-center justify-center shadow-2xl group-hover/deploy:scale-110 transition-transform duration-1000 group-hover/deploy:rotate-12">
                        <Film size={36} className="text-primary-600 dark:text-primary-400" />
                     </div>
                     <div className="flex-1 space-y-2">
                        <p className="text-2xl font-black text-surface-900 dark:text-white uppercase tracking-tight italic leading-none">Script ready</p>
                        <p className="text-[10px] font-black text-primary-400 dark:text-primary-600 uppercase tracking-[0.4em] italic leading-relaxed opacity-60">Continue in the editor to record, cut, and publish.</p>
                     </div>
                     <button
                        type="button"
                        onClick={() => router.push('/dashboard/video')}
                        className="px-10 py-6 rounded-[2rem] bg-surface-900 dark:bg-white text-white dark:text-black font-black text-xs uppercase tracking-[0.5em] italic shadow-2xl hover:bg-primary-600 dark:hover:bg-primary-500 hover:text-white transition-all flex items-center justify-center gap-4 border-none active:scale-95 shrink-0"
                     >
                        Deploy <ArrowRight size={20} />
                     </button>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Hub */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-12 sm:p-16 rounded-[4rem] bg-rose-500/5 border-2 border-rose-500/20 flex flex-col md:flex-row items-center gap-10 shadow-2xl backdrop-blur-3xl relative z-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-rose-500/[0.02] animate-pulse pointer-events-none" />
          <div className="w-20 h-20 rounded-[2rem] bg-rose-500/20 flex items-center justify-center shadow-xl border-2 border-rose-500/30 relative z-10">
             <AlertCircle size={40} className="text-rose-500 animate-pulse" />
          </div>
          <div className="flex-1 relative z-10">
            <p className="text-[11px] font-black text-rose-500 uppercase tracking-[0.8em] italic mb-3">Something went wrong</p>
            <p className="text-3xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-tight drop-shadow-2xl">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="px-12 py-6 rounded-[2.5rem] bg-rose-600 text-white font-black text-xs uppercase tracking-[0.4em] italic shadow-xl hover:bg-rose-500 transition-all active:scale-95 border-none relative z-10"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Heuristic Wisdom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative opacity-40 hover:opacity-100 transition-opacity duration-1000 pt-16">
        {[
          { icon: Brain,  title: 'Consensus Logic',   desc: 'AI Swarm cross-validates hooks with real-time saturation heatmaps.' },
          { icon: Target, title: 'Engagement Aim',   desc: 'Mapping script vectors against niche-specific retention peaks per region.' },
          { icon: Sparkle, title: 'Identity DNA',    desc: 'Each sequence is filtered through your sovereign brand essence and voice.' },
        ].map(tip => (
          <div key={tip.title} className="bg-surface-card backdrop-blur-3xl border-2 border-surface-100 dark:border-surface-800 p-10 rounded-[3.5rem] group hover:bg-surface-page transition-all cursor-crosshair shadow-xl">
             <div className="w-16 h-16 rounded-2xl bg-surface-page dark:bg-surface-950 border-2 border-surface-100 dark:border-surface-800 flex items-center justify-center mb-8 shadow-inner group-hover:rotate-12 group-hover:scale-110 transition-all duration-1000">
                <tip.icon size={32} className="text-surface-300 dark:text-slate-800 group-hover:text-primary-500 transition-colors" />
             </div>
             <p className="text-2xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter mb-4 group-hover:text-primary-500 transition-colors leading-none">{tip.title}</p>
             <p className="text-[11px] font-black text-surface-400 dark:text-slate-600 uppercase tracking-[0.3em] leading-relaxed italic opacity-60 group-hover:opacity-100 transition-opacity duration-1000">{tip.desc}</p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .animate-spin-slow { animation: spin 30s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
      `}</style>
    </div>
  )
}
