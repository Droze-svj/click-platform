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
  Shield
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiPost } from '../lib/api'
import { useHardenedRequest } from '../hooks/useHardenedRequest'
import { useToast } from '../contexts/ToastContext'

const STAGES = [
  { id: 'intelligence', label: 'Intelligence Gathering', icon: Brain },
  { id: 'script',       label: 'Script Generation',     icon: Terminal },
  { id: 'refinery',     label: 'Swarm Consensus',       icon: Orbit },
  { id: 'anatomy',      label: 'Video Anatomy',         icon: Layers },
  { id: 'blueprint',    label: 'Timeline Blueprint',    icon: Command },
]

const TONES = [
  { id: 'educational', label: 'AUTHORITATIVE', icon: Shield },
  { id: 'motivational', label: 'ELEVATED', icon: Zap },
  { id: 'storytelling', label: 'NARRATIVE', icon: Film },
  { id: 'controversial', label: 'DISRUPTIVE', icon: AlertCircle },
]

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border-2 border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-700'

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

  const runFactory = async (pivot?: string) => {
    if (!prompt.trim()) {
      showToast('Please enter a creative prompt to initialize the forge.', 'warning')
      return
    }

    if (pivot) setStylePivot(pivot)

    setLoading(true)
    setError(null)
    setResult(null)
    setCompletedStages([])
    setCurrentStage('intelligence')

    try {
      // Stage sequence for UX narrative
      const stages = ['intelligence', 'script', 'refinery', 'anatomy', 'blueprint']
      
      for (const stage of stages) {
        setCurrentStage(stage)
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 600))
        setCompletedStages(prev => [...prev, stage])
      }

      const res = await executeHardened(() => apiPost('/intelligence/factory/create', {
        prompt,
        targetPlatform: platform,
        tone: tone,
        stylePivot: pivot || stylePivot,
        useCreatorDNA: true
      }))

      if (res.success) {
        const newVariant = { ...res, id: `variant-${Date.now()}`, pivot: pivot || stylePivot }
        setVariants(prev => [newVariant, ...prev].slice(0, 3))
        setResult(newVariant)
        setActiveVariantIndex(0)
        showToast('✦ Synthesis Manifest Complete', 'success')
      } else {
        setError(res.error || 'NEURAL_COLLAPSE: Unknown exception')
      }
    } catch (err: any) {
      setError(err.message || 'SYSTEM_HALT: Uplink diffraction')
      showToast('Neural link interrupted during synthesis.', 'error')
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
          <div className="w-24 h-24 md:w-32 md:h-32 bg-indigo-500/5 border-2 border-indigo-500/20 rounded-[3rem] md:rounded-[4rem] flex items-center justify-center shadow-[0_40px_150px_rgba(99,102,241,0.3)] relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
             <Target size={48} className="text-indigo-400 relative z-10 group-hover:scale-125 transition-transform duration-1000 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-col md:flex-row items-center gap-5 mb-5">
              <div className="flex items-center gap-3">
                 <Binary size={14} className="text-indigo-400 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400 italic leading-none">Forge_Module_v4.2.1</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                  <Activity size={12} className="text-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">CORE_SYNC_ACTIVE</span>
              </div>
            </div>
            <h2 className="text-[clamp(2.5rem,8vw,5.5rem)] font-black text-white italic uppercase tracking-tighter leading-[0.85] mb-4 drop-shadow-2xl">One-Click Forge</h2>
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.6em] italic leading-none opacity-60">Autonomous Creative Synthesis Hub (2026 Sovereign Edition)</p>
          </div>
        </div>
      </div>

      {/* Main Creation Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 relative z-10">
        
        {/* Input Chamber */}
        <div className="xl:col-span-8 flex flex-col gap-12">
           <div className={`${glassStyle} p-12 lg:p-16 rounded-[5rem] space-y-12 relative overflow-hidden group`}>
              <div className="absolute -top-60 -right-60 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-1000" />
              
              <div className="space-y-8 relative z-10">
                <div className="flex items-center justify-between px-4">
                  <label className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic flex items-center gap-4">
                    <Terminal size={18} className="text-indigo-400" /> PROMPT_INJECTION
                  </label>
                  {loading && (
                    <div className="flex items-center gap-4">
                       {(rateLimitCountdown ?? 0) > 0 ? (
                         <span className="text-[10px] font-black text-rose-400 uppercase italic tracking-widest animate-pulse">冷却 (COOLING): {rateLimitCountdown}S</span>
                       ) : (
                         <span className="text-[10px] font-black text-indigo-400 uppercase italic tracking-widest">COGNITIVE_LOAD: {Math.round(cognitiveLoad)}%</span>
                       )}
                       <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                          <motion.div 
                            animate={{ 
                              width: (rateLimitCountdown ?? 0) > 0 ? '100%' : `${cognitiveLoad}%`,
                              backgroundColor: (rateLimitCountdown ?? 0) > 0 ? '#fb7185' : '#6366f1'
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
                  placeholder="Inject your creative vision. The Forge will synthesize the narrative, b-roll, and branding automatically..."
                  className="w-full bg-black/60 border-2 border-white/5 rounded-[4rem] p-16 text-[1.8rem] font-black italic text-white placeholder:text-slate-900 focus:outline-none focus:border-indigo-500/40 transition-all resize-none h-72 shadow-[inset_0_20px_50px_rgba(0,0,0,0.8)] leading-[1.2] uppercase tracking-tighter"
                />
              </div>

              {/* Dynamic Controls Lattice */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10 border-t border-white/5 pt-12">
                 
                 {/* Target Platform Logic */}
                 <div className="md:col-span-12 lg:col-span-8 space-y-8">
                    <div className="flex items-center gap-6 px-4">
                       <Globe size={16} className="text-indigo-400" />
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6rem] italic">TARGET_MATRIX_DEPLOYMENT</span>
                    </div>
                    <div className="flex flex-wrap gap-4 px-4 pb-4">
                      {['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin', 'twitter'].map(p => (
                        <button
                          key={p}
                          onClick={() => setPlatform(p)}
                          disabled={loading}
                          className={`px-10 py-5 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all border-2 italic relative group/btn ${
                            platform === p 
                            ? 'bg-white text-black border-white shadow-[0_30px_80px_rgba(255,255,255,0.2)] scale-110 z-20' 
                            : 'bg-white/5 text-slate-700 border-white/5 hover:border-white/20 hover:text-white'
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
                       <Mic2 size={16} className="text-indigo-400" />
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6rem] italic">VOICE_DNA_TONE</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                      {[
                        { id: 'educational', label: 'AUTHORITATIVE', icon: Shield },
                        { id: 'motivational', label: 'ELEVATED', icon: Zap },
                        { id: 'storytelling', label: 'NARRATIVE', icon: Film },
                        { id: 'controversial', label: 'DISRUPTIVE', icon: AlertCircle },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTone(t.id)}
                          disabled={loading}
                          className={`flex items-center justify-between gap-4 px-8 py-6 rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.4em] transition-all border-2 italic ${
                            tone === t.id 
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_30px_70px_rgba(99,102,241,0.4)] scale-105' 
                            : 'bg-white/5 text-slate-700 border-white/5 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {t.label}
                          <t.icon size={16} className={tone === t.id ? 'text-white' : 'text-slate-800'} />
                        </button>
                      ))}
                    </div>
                 </div>
              </div>

              <button
                onClick={() => runFactory()}
                disabled={loading || !prompt.trim()}
                className={`w-full py-16 rounded-[4.5rem] font-black text-4xl uppercase tracking-[0.8em] transition-all duration-1000 italic active:scale-95 group relative overflow-hidden flex items-center justify-center gap-10 ${
                  loading 
                  ? 'bg-indigo-600/30 cursor-wait text-indigo-300' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_60px_150px_rgba(99,102,241,0.6)]'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                {loading ? (
                  <>
                    <Loader2 size={48} className="animate-spin text-indigo-400" />
                    SYNTHESIZING_SEQUENCE...
                  </>
                ) : (
                   <>
                     <Zap size={48} className="group-hover:scale-125 transition-transform duration-[1.5s]" />
                     Initialise Manifest
                   </>
                )}
              </button>
           </div>
        </div>

        {/* Sidebar Intelligence & Presets */}
        <div className="xl:col-span-4 space-y-12">
           {/* Current Strategy Cluster */}
           <div className={`${glassStyle} p-12 rounded-[5rem] space-y-10 bg-black/60 shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] border-white/5`}>
              <div className="flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"><Brain size={28} className="text-indigo-400" /></div>
                 <div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Strategy Cluster</h3>
                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic mt-1 leading-none">ORACLE_VERIFIED_VECTORS</p>
                 </div>
              </div>
              <div className="space-y-4">
                 {[
                   { label: 'PATTERN_INTERRUPT_v18', value: 'High' },
                   { label: 'NICHE_RESONANCE_SCAN', value: '98.4%' },
                   { label: 'ALGO_RETENTION_LOCK', value: 'Enabled' },
                 ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-6 rounded-[2rem] bg-white/[0.03] border border-white/5">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">{s.label}</span>
                       <span className="text-[11px] font-black text-white italic uppercase tracking-tighter">{s.value}</span>
                    </div>
                 ))}
              </div>
           </div>

           {/* Quick Style Pivots (Advanced) */}
           <div className={`${glassStyle} p-12 rounded-[5rem] space-y-10 border-white/5`}>
              <div className="flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Zap size={28} className="text-amber-400" /></div>
                 <div>
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Style Pivots</h3>
                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic mt-1 leading-none">AESTHETIC_STEERING_NODES</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 {['AGGRESSIVE', 'MINIMAL', 'CINEMATIC', 'URGENT', 'VIRAL', 'ELEVATED'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setStylePivot(p)}
                      className={`px-6 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] italic border-2 transition-all ${
                        stylePivot === p ? 'bg-amber-500 border-amber-400 text-black shadow-3xl' : 'bg-white/5 border-white/10 text-slate-700 hover:text-white'
                      }`}
                    >
                       {p}
                    </button>
                 ))}
                 {/* Phase 8: UGC Raw Pivot */}
                 <button
                   onClick={() => setStylePivot('UGC_RAW')}
                   className={`col-span-2 px-6 py-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.2em] italic border-2 transition-all duration-700 flex items-center justify-between ${
                     stylePivot === 'UGC_RAW'
                       ? 'bg-gradient-to-r from-orange-600 to-amber-500 border-orange-400 text-white shadow-[0_0_40px_rgba(234,88,12,0.3)]'
                       : 'bg-white/5 border-white/10 text-slate-600 hover:text-white hover:border-orange-500/30'
                   }`}
                 >
                   <span className="flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                     UGC_RAW // Authentic Mode
                   </span>
                   <span className={`text-[8px] font-black tracking-widest px-3 py-1 rounded-full border ${
                     stylePivot === 'UGC_RAW' ? 'text-white border-white/30 bg-white/10' : 'text-slate-600 border-slate-700'
                   }`}>
                     HUMANIZE
                   </span>
                 </button>
              </div>
              {stylePivot === 'UGC_RAW' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-[2rem] bg-orange-500/5 border border-orange-500/20 mt-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Authenticity Engine Active</p>
                    <span className="text-[9px] font-black text-white tabular-nums">~85% Auth Score</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 1.5, ease: 'circOut' }}
                      className="h-full bg-gradient-to-r from-orange-600 to-amber-400"
                    />
                  </div>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-3">
                    Injecting: SSML Fillers // Handheld Shake // Phone Color Science // Irregular BPM
                  </p>
                </motion.div>
              )}
           </div>

           {/* Pipeline Trace Visualizer */}
           <div className={`${glassStyle} p-12 rounded-[5rem] border-white/5 relative overflow-hidden group h-[400px]`}>
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none p-12"><Orbit size={400} className="text-indigo-400 animate-spin-slow rotate-45" /></div>
              <div className="flex flex-col h-full relative z-10">
                 <div className="flex items-center gap-6 mb-12">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-pulse"><Waves size={24} className="text-emerald-400" /></div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.4em] italic leading-none">Neural_Uplink_Trace</span>
                 </div>
                 <div className="flex-1 space-y-8">
                    {STAGES.map((s, i) => (
                       <div key={s.id} className="flex items-center gap-8 relative">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center group-hover:scale-110 transition-transform ${
                            completedStages.includes(s.id) ? 'bg-emerald-500 border-emerald-400 text-white' : currentStage === s.id ? 'bg-indigo-500 border-indigo-400 text-white animate-pulse' : 'bg-black/60 border-white/10 text-slate-800'
                          }`}>
                             {completedStages.includes(s.id) ? <CheckCircle2 size={14} /> : (i + 1)}
                          </div>
                          <div>
                             <p className={`text-[12px] font-black uppercase tracking-tighter italic leading-none ${completedStages.includes(s.id) ? 'text-white' : currentStage === s.id ? 'text-indigo-400' : 'text-slate-800'}`}>{s.label}</p>
                             {currentStage === s.id && <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="text-[8px] font-black text-indigo-500 uppercase italic mt-1 tracking-widest">Inference_In_Progress...</motion.div>}
                          </div>
                          {i < STAGES.length - 1 && <div className={`absolute top-8 left-4 w-0.5 h-4 ${completedStages.includes(s.id) ? 'bg-emerald-500' : 'bg-white/5'}`} />}
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
            transition={{ duration: 0.8 }}
            className={`${glassStyle} p-16 lg:p-24 rounded-[6rem] bg-emerald-500/5 border-emerald-500/20 shadow-[0_80px_200px_rgba(0,0,0,1)] relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none rotate-12 group-hover:opacity-[0.1] transition-opacity duration-[2s]">
               <Box size={500} className="text-emerald-400" />
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-16 border-b-2 border-white/5 pb-20 relative z-10">
              <div className="flex items-center gap-12">
                <div className="w-28 h-28 rounded-[3rem] bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-3xl group-hover:rotate-12 transition-transform duration-1000">
                  <CheckCircle2 size={56} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-5xl md:text-7xl font-black text-white italic uppercase tracking-tighter leading-[0.85] mb-4 drop-shadow-2xl">Pattern Synthesized</h3>
                  <div className="flex flex-wrap gap-4">
                     <div className="px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase italic tracking-widest leading-none">MANIFEST_STABLE</div>
                     <div className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 uppercase italic tracking-widest leading-none">VARIANT_{activeVariantIndex + 1}</div>
                     <div className="px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase italic tracking-widest leading-none">PIVOT: {result.pivot || 'BALANCED'}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-8">
                 {variants.length > 1 && (
                    <div className="flex gap-4 px-10 py-4 bg-black/60 rounded-[3rem] border border-white/5 shadow-inner">
                       {variants.map((v, i) => (
                          <button
                            key={v.id}
                            onClick={() => {
                              setActiveVariantIndex(i)
                              setResult(variants[i])
                            }}
                            className={`w-14 h-14 rounded-2xl border-2 font-black italic transition-all uppercase flex items-center justify-center text-[12px] ${
                               activeVariantIndex === i 
                               ? 'bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-110' 
                               : 'bg-white/5 border-white/10 text-slate-800 hover:text-white hover:border-white/30'
                            }`}
                          >
                             {String.fromCharCode(945 + i).toUpperCase()} {/* Alpha, Beta, Gamma symbols could be used but Greek characters might not render globally as same style */}
                             {['α', 'β', 'γ'][i]}
                          </button>
                       ))}
                    </div>
                 )}
                 <button 
                  onClick={() => runFactory()}
                  disabled={loading}
                  className="px-10 py-6 rounded-[2.5rem] bg-indigo-500/10 border-2 border-indigo-500/40 text-indigo-400 font-black text-[12px] uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all italic active:scale-95 flex items-center gap-5 shadow-inner"
                 >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCw className="w-5 h-5" />} REGENERATE_v4
                 </button>
                 <button 
                  onClick={() => router.push(`/dashboard/video`)}
                  className="px-16 py-8 rounded-[3rem] bg-emerald-600 text-white font-black text-sm uppercase tracking-[0.5em] shadow-[0_40px_100px_rgba(16,185,129,0.5)] hover:bg-emerald-500 transition-all flex items-center gap-8 italic active:scale-95 border-none"
                 >
                    <Film size={28} /> Deploy to Hub
                 </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-24 relative z-10 pt-12">
               {/* Script Detail Cluster */}
               <div className="space-y-16">
                  <div className="space-y-8">
                     <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic flex items-center gap-5">
                        <Fingerprint size={16} className="text-emerald-400 animate-pulse" /> MANIFESTED_IDENTITY
                     </p>
                     <div className="text-5xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.9] drop-shadow-2xl">
                       {result.stages?.script?.title || 'Sequence Alpha'}
                     </div>
                  </div>
                  <div className="space-y-8">
                     <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic flex items-center gap-5">
                        <Command size={16} className="text-indigo-400" /> STRATEGIC_HOOK_v12
                     </p>
                     <p className="text-3xl md:text-4xl text-slate-300 leading-tight italic border-l-[10px] border-emerald-500/30 pl-12 font-bold uppercase tracking-tight group-hover:text-white transition-colors duration-1000">
                        &quot;{result.stages?.script?.hook || result.stages?.script?.rawScript?.hook || 'Predictive retention model applied to high-velocity vectors.'}&quot;
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-12 pt-8">
                    <div className="p-10 rounded-[3.5rem] bg-black/40 border-2 border-white/5 space-y-5 shadow-inner group hover:border-emerald-500/30 transition-all">
                       <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] italic group-hover:text-emerald-400 transition-colors">TEMPORAL_DURATION</p>
                       <p className="text-5xl font-black text-white italic tabular-nums leading-none tracking-tighter">
                         {result.stages?.blueprint?.totalDuration || result.stages?.anatomy?.totalDuration || '0'} <span className="text-2xl text-slate-800 border-none">SEC</span>
                       </p>
                    </div>
                    <div className="p-10 rounded-[3.5rem] bg-black/40 border-2 border-white/5 space-y-5 shadow-inner group hover:border-emerald-500/30 transition-all">
                       <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.4em] italic group-hover:text-emerald-400 transition-colors">DOMAIN_LATTICE</p>
                       <p className="text-5xl font-black text-white italic uppercase leading-none tracking-tighter">{platform.replace('reels', 'RLS').toUpperCase()}</p>
                    </div>
                  </div>
               </div>

               {/* Oracle Mastery Cluster */}
               <div className="space-y-12">
                  <div className={`${glassStyle} p-12 lg:p-14 rounded-[4.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 space-y-8 shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative overflow-hidden group/advice`}>
                     <div className="absolute top-0 right-0 p-12 opacity-0 group-hover/advice:opacity-10 transition-opacity duration-1000">
                        <Brain size={180} className="text-indigo-400" />
                     </div>
                     <div className="flex items-center justify-between relative z-10">
                        <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.8em] italic flex items-center gap-5">
                           <Sparkle size={18} className="animate-pulse" /> STRATEGIC_ORACLE_ADVICE
                        </p>
                        <div className="px-5 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 italic">v2026.4_LATTICE</div>
                     </div>
                     <div className="space-y-6 relative z-10">
                        <p className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight group-hover:scale-[1.02] transition-transform duration-700">
                           &quot;{result.summary?.strategicAdvice || result.summary?.advice || 'Optimizing for high-velocity retention vectors. Deploy pattern-interrupt sequences at the 0:03 mark.'}&quot;
                        </p>
                        <div className="flex flex-wrap gap-6 pt-4">
                           <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black text-slate-800 uppercase italic">RESONANCE_PROBABILITY</span>
                              <span className="text-4xl font-black text-emerald-400 italic tabular-nums leading-none shadow-emerald-500/20 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{result.summary?.globalConsensus || '98.4%'}</span>
                           </div>
                           <div className="flex flex-col gap-2 border-l border-white/5 pl-8">
                              <span className="text-[9px] font-black text-slate-800 uppercase italic">SWARM_AGREEMENT</span>
                              <span className="text-4xl font-black text-white italic leading-none drop-shadow-2xl italic tracking-tighter">SURGE</span>
                           </div>
                           <div className="flex flex-col gap-2 border-l border-white/5 pl-8">
                              <span className="text-[9px] font-black text-slate-800 uppercase italic">STYLE_PIVOT_SYNC</span>
                              <span className="text-2xl font-black text-indigo-400 italic leading-none uppercase tracking-widest">{stylePivot}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Post-Generation Action: Go to Editor */}
                  <div className="p-12 rounded-[4.5rem] bg-gradient-to-br from-indigo-500/20 via-violet-800/20 to-transparent border-2 border-indigo-500/30 flex flex-col md:flex-row items-center text-center md:text-left gap-12 shadow-[0_60px_180px_rgba(0,0,0,1)] relative overflow-hidden group">
                     <div className="absolute inset-0 bg-white/5 animate-shimmer opacity-20 pointer-events-none" />
                     <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-1000 group-hover:rotate-12">
                        <Film size={44} className="text-indigo-400" />
                     </div>
                     <div className="flex-1 space-y-4">
                        <p className="text-3xl font-black text-white uppercase tracking-tight italic leading-none">Manifest Blueprint Locked</p>
                        <p className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.4em] opacity-60 leading-relaxed italic">Sequence has been mapped to spectral nodes. Deploy to the Forge Chamber for final kinetic synthesis.</p>
                     </div>
                     <button 
                        onClick={() => router.push('/dashboard/video')}
                        className="px-12 py-8 rounded-[3rem] bg-white text-black font-black text-sm uppercase tracking-[0.5em] italic shadow-[0_40px_100px_rgba(255,255,255,0.2)] hover:bg-slate-100 transition-all flex items-center justify-center gap-6 border-none active:scale-95 shrink-0"
                     >
                        Open Forge <ArrowRight size={24} />
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
          className="p-16 rounded-[4.5rem] bg-rose-500/5 border-2 border-rose-500/20 flex flex-col md:flex-row items-center gap-12 shadow-2xl backdrop-blur-3xl relative z-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-rose-500/[0.02] animate-pulse pointer-events-none" />
          <div className="w-24 h-24 rounded-[3rem] bg-rose-500/20 flex items-center justify-center shadow-xl border-2 border-rose-500/30 relative z-10">
             <AlertCircle size={48} className="text-rose-400 animate-pulse" />
          </div>
          <div className="flex-1 relative z-10">
            <p className="text-[12px] font-black text-rose-500 uppercase tracking-[0.8em] italic mb-3">SYSTEM_ABORT // UPLINK_DIFFRACTION</p>
            <p className="text-4xl font-black text-white italic uppercase tracking-tighter leading-tight drop-shadow-2xl">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="px-14 py-8 rounded-[3.5rem] bg-rose-600 text-white font-black text-xs uppercase tracking-[0.4em] italic shadow-xl hover:bg-rose-500 transition-all active:scale-95 border-none relative z-10"
          >
            Acknowledge & Sync
          </button>
        </motion.div>
      )}

      {/* Heuristic Wisdom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 relative opacity-20 hover:opacity-100 transition-opacity duration-1000 pt-16">
        {[
          { icon: Brain,  title: 'Consensus Logic',   desc: 'AI Swarm cross-validates hooks with real-time saturation heatmaps.' },
          { icon: Target, title: 'Engagement Aim',   desc: 'Mapping script vectors against niche-specific retention peaks per region.' },
          { icon: Sparkle, title: 'Identity DNA',    desc: 'Each sequence is filtered through your sovereign brand essence and voice.' },
        ].map(tip => (
          <div key={tip.title} className={`${glassStyle} p-12 rounded-[4rem] group hover:bg-white/[0.05] transition-all cursor-crosshair border-white/5`}>
             <div className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center mb-10 shadow-inner group-hover:rotate-12 group-hover:scale-110 transition-all duration-1000">
                <tip.icon size={32} className="text-slate-800 group-hover:text-indigo-400 transition-colors" />
             </div>
             <p className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 group-hover:text-indigo-400 transition-colors leading-none">{tip.title}</p>
             <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.3em] leading-relaxed italic opacity-40 group-hover:opacity-100 transition-opacity duration-1000">{tip.desc}</p>
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
