'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import {
  Cpu,
  Zap,
  Loader2,
  MessageSquare,
  Scissors,
  Sparkles,
  TrendingUp,
  Copy,
  Brain,
  Flame,
  AlertCircle,
  Type,
  Radio,
  Orbit,
  Fingerprint,
  Target,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Layers,
  MousePointer2
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { getDefaultTrackForSegmentType, Asset, StyleProfile } from '../../../types/editor'
import DirectorLog from '../DirectorLog'
import StyleMimicView from './StyleMimicView'
import VariantFactoryView from './VariantFactoryView'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'

interface EliteAIViewProps {
  videoId: string
  isTranscribing: boolean
  setIsTranscribing: (v: boolean) => void
  transcript: any
  setTranscript: (v: any) => void
  editingWords: any[]
  setEditingWords: (v: any[]) => void
  aiSuggestions: any[]
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (c: any) => void
  setTextOverlays?: (fn: (prev: any[]) => any[]) => void
  autoEditClips?: any[]
  onGenerateClips?: () => void
  onApplyClip?: (clip: any) => void
  engagementScore?: any
  userAssets?: Asset[]
  onForgeMaster?: (persona: string) => void
  onApplyStyleProfile?: (profile: StyleProfile) => void
  onBeatSync?: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]"

const EliteAIView: React.FC<EliteAIViewProps> = ({
  videoId, isTranscribing, setIsTranscribing, transcript, setTranscript, editingWords, setEditingWords, aiSuggestions, setTimelineSegments, showToast, setActiveCategory, setTextOverlays, autoEditClips = [], onGenerateClips, onApplyClip, engagementScore, userAssets = [], onForgeMaster, onApplyStyleProfile, onBeatSync
}) => {
  const [view, setView] = useState<'main' | 'mimic' | 'variant-factory'>('main')
  const [viralQuotes, setViralQuotes] = useState<any[]>([])
  const [isExtractingQuotes, setIsExtractingQuotes] = useState(false)
  const [isForging, setIsForging] = useState(false)
  const [requirementsReady, setRequirementsReady] = useState<boolean | null>(null)
  const [requirementsMessage, setRequirementsMessage] = useState<string>('')
  const [activeThought, setActiveThought] = useState('')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [activeEngine, setActiveEngine] = useState<'gpt4' | 'claude' | 'gemini'>('gpt4')
  const [activePersona, setActivePersona] = useState<'beast' | 'minimalist' | 'architect' | 'educator'>('beast')
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const engines = [
    { id: 'gpt4', name: 'GPT-4o', maker: 'OpenAI', icon: Cpu, color: 'fuchsia' },
    { id: 'claude', name: 'Claude 3', maker: 'Anthropic', icon: Fingerprint, color: 'orange' },
    { id: 'gemini', name: 'Gemini Pro', maker: 'Google', icon: Orbit, color: 'blue' },
  ] as const

  const personas = [
    { id: 'beast', name: 'The Beast', desc: 'High-Retention / MrBeast Style', icon: Flame, color: 'orange' },
    { id: 'minimalist', name: 'The Minimalist', desc: 'Clean / Apple Style', icon: ShieldCheck, color: 'slate' },
    { id: 'architect', name: 'The Architect', desc: 'Viral Hooks / Fast Paced', icon: Target, color: 'indigo' },
    { id: 'educator', name: 'The Educator', desc: 'Structured / Clarity First', icon: Sparkles, color: 'emerald' },
  ] as const

  const aiThoughts = useMemo(() => [
    "Analyzing pacing and engagement…",
    "Tuning viral hook detection…",
    "Extracting high-impact moments…",
    "Processing transcript layers…",
    "Optimizing for retention…",
    "Identifying top engagement segments…",
    "Syncing with trending signals…"
  ], [])

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setActiveThought(aiThoughts[Math.floor(Math.random() * aiThoughts.length)])
    }, 6000)
    setActiveThought(aiThoughts[0])

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      clearInterval(thoughtInterval)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [aiThoughts])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await apiGet<{ success?: boolean; data?: { openaiConfigured?: boolean; message?: string } }>('/video/transcribe-editor/status')
        const data = (res as any)?.data ?? (res as any)
        if (cancelled) return
        setRequirementsReady(!!data?.openaiConfigured)
        setRequirementsMessage(typeof data?.message === 'string' ? data.message : '')
      } catch {
        if (cancelled) return
        setRequirementsReady(false)
        setRequirementsMessage('AI engine verification failed. Check your configuration.')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleForge = async () => {
    if (!onForgeMaster) return
    setIsForging(true)
    try {
      await onForgeMaster(activePersona)
    } finally {
      setIsForging(false)
    }
  }


  const handleExtractQuotes = async () => {
    if (!transcript) {
      showToast('Transcribe the video first', 'error')
      return
    }

    setSwarmHUDTask('Extracting key quotes')
    setShowSwarmHUD(true)
    setPendingAction(() => executeExtractQuotes)
  }

  const executeExtractQuotes = async () => {
    try {
      setIsExtractingQuotes(true)
      showToast(`Extracting quotes via ${engines.find(e => e.id === activeEngine)?.name}…`, 'info')
      const fullText = editingWords.map(w => w.word).join(' ')
      const data = await apiPost<{ success?: boolean; quotes?: any[] }>('/ai/extract-quotes', {
        transcript: fullText,
        engine: activeEngine,
        persona: activePersona
      })
      if (data?.success && data.quotes) {
        setViralQuotes(data.quotes)
        showToast(`✓ Extracted ${data.quotes.length} key quotes`, 'success')
      }
    } catch (e) {
      showToast('Quote extraction failed', 'error')
    } finally {
      setIsExtractingQuotes(false)
    }
  }

  const applySemanticCaptions = () => {
    if (!transcript?.words || !setTextOverlays) return

    showToast('Generating styled captions…', 'info')

    const categories = {
      urgency: {
        words: ['secret', 'massive', 'crazy', 'insane', 'never', 'finally', 'stop', 'look', 'viral', 'now', 'quickly'],
        color: '#ff4d4d',
        glow: 'rgba(255, 77, 77, 0.6)'
      },
      curiosity: {
        words: ['why', 'how', 'hidden', 'unknown', 'mysterious', 'imagine', 'discover'],
        color: '#818cf8',
        glow: 'rgba(129, 140, 248, 0.6)'
      },
      authority: {
        words: ['verified', 'guaranteed', 'proof', 'expert', 'result', 'master', 'alpha'],
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.4)'
      }
    }

    const semanticOverlays = transcript.words.filter((_: any, i: number) => i % 6 === 0).map((w: any, i: number) => {
        const text = (w.text || w.word || '').trim().toLowerCase().replace(/[^\w\s]/gi, '')

        let style = {
            fontSize: 42,
            color: '#ffffff',
            glow: 'rgba(0,0,0,0.8)'
        }

        if (categories.urgency.words.includes(text)) {
            style = { fontSize: 72, color: categories.urgency.color, glow: categories.urgency.glow }
        } else if (categories.curiosity.words.includes(text)) {
            style = { fontSize: 54, color: categories.curiosity.color, glow: categories.curiosity.glow }
        } else if (categories.authority.words.includes(text)) {
            style = { fontSize: 54, color: categories.authority.color, glow: categories.authority.glow }
        }

        return {
          id: `semantic-cap-${Date.now()}-${i}`,
          text: (w.text || w.word || '').toUpperCase(),
          startTime: w.start,
          endTime: w.start + 1.2,
          style: {
            fontSize: style.fontSize,
            color: style.color,
            fontWeight: '900',
            fontFamily: 'Inter',
            textTransform: 'uppercase',
            textShadow: `0 0 30px ${style.glow}`
          }
        }
    })

    setTextOverlays((prev: any[]) => [...prev, ...semanticOverlays])
    showToast('Semantic Categories Synthesized', 'success')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Quote copied to neural clipboard', 'success')
  }

  const wordChunks = useMemo(() => {
    if (!editingWords || editingWords.length === 0) return []
    const chunks = []
    for (let i = 0; i < editingWords.length; i += 15) {
      chunks.push({ words: editingWords.slice(i, i + 15), startIndex: i })
    }
    return chunks
  }, [editingWords])

  const suggestedAssets = useMemo(() => {
    if (!userAssets?.length || !transcript?.words?.length) return []
    const scriptWords = transcript.words.map((w: any) => (w.text || w.word || '').toLowerCase().replace(/[^a-z]/g, '')).filter((w: string) => w.length > 5)
    return userAssets.filter(asset =>
      asset.autoTags?.some(tag => scriptWords.includes((tag || '').toLowerCase()))
    ).slice(0, 4)
  }, [userAssets, transcript])

  const handleInjectAsset = (asset: Asset) => {
    const firstWordMatch = transcript.words.find((w: any) =>
       asset.autoTags?.some(tag => (w.text || w.word || '').toLowerCase().includes((tag || '').toLowerCase()))
    )
    const startTime = firstWordMatch?.start ?? 0
    const duration = asset.type === 'broll' ? 5 : asset.duration || 30

    setTimelineSegments((prev: any[]) => [...prev, {
      id: `neural-inject-${asset.id}-${Date.now()}`,
      startTime,
      endTime: startTime + duration,
      duration,
      type: asset.type === 'music' ? 'audio' : 'video',
      name: `Neural: ${asset.title}`,
      color: asset.type === 'music' ? '#10B981' : '#F59E0B',
      track: asset.type === 'music' ? 3 : 2,
      sourceUrl: asset.url
    }])
    showToast(`Neural Link: ${asset.title} synchronized`, 'success')
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 max-w-[1400px] mx-auto pb-20 relative"
    >
      {/* ── SUBVIEW: THE MIMIC ── */}
      <AnimatePresence mode="wait">
        {view === 'mimic' && (
          <motion.div
            key="mimic-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0 z-[100] bg-[#020202] p-8 overflow-y-auto rounded-[3rem] border border-white/5 shadow-2xl"
          >
            <StyleMimicView
              onBack={() => setView('main')}
              onStyleMirror={(profile) => {
                onApplyStyleProfile?.(profile)
                showToast('Mimic DNA Applied to Timeline', 'success')
                setView('main')
              }}
            />
          </motion.div>
        )}

        {view === 'variant-factory' && (
          <motion.div
            key="factory-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0 z-[100] bg-[#020202] p-8 overflow-y-auto rounded-[3rem] border border-white/5 shadow-2xl"
          >
            <VariantFactoryView
              onBack={() => setView('main')}
              onApplyVariant={(variant) => {
                setTextOverlays?.(prev => [
                  ...prev,
                  {
                    id: `hook-variant-${Date.now()}`,
                    text: variant.text,
                    x: 50, y: 15,
                    fontSize: 42,
                    color: '#ffffff',
                    fontFamily: 'Inter',
                    startTime: 0,
                    endTime: 5,
                    style: 'shadow'
                  }
                ])
                showToast(`Applied: ${variant.type} Variant`, 'success')
                setView('main')
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <motion.div
          animate={{
            x: mousePos.x / 60,
            y: mousePos.y / 60,
          }}
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-600/10 blur-[150px] rounded-full opacity-60"
        />
        <motion.div
          animate={{
            x: -mousePos.x / 60,
            y: -mousePos.y / 60,
          }}
          className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[150px] rounded-full opacity-60"
        />
      </div>

      {/* Elite Header Node */}
      <motion.div variants={itemVariants} className="space-y-10">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-bold uppercase tracking-[0.3em] shadow-lg">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Elite AI · {String(activeEngine || 'idle')}
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter leading-[1.05]">
              AI Storyteller
            </h1>

            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={() => setView('mimic')}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center gap-3 group shadow-[0_0_20px_rgba(79,70,229,0.3)]"
              >
                <Fingerprint className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black text-white uppercase tracking-widest italic">The Mimic</span>
              </button>

              <button
                onClick={() => setView('variant-factory')}
                className="px-6 py-3 rounded-2xl bg-fuchsia-600/10 border border-fuchsia-500/20 hover:bg-fuchsia-600/20 transition-all flex items-center gap-3 group"
              >
                <Target className="w-4 h-4 text-fuchsia-400 group-hover:scale-125 transition-transform" />
                <span className="text-xs font-black text-fuchsia-400 uppercase tracking-widest italic">Variant Factory</span>
              </button>

              <button
                onClick={onBeatSync}
                className="px-6 py-3 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all flex items-center gap-3 group"
              >
                <Radio className="w-4 h-4 text-emerald-400 group-hover:animate-ping" />
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest italic">Beat-Sync</span>
              </button>
            </div>

              <div className="h-10 w-px bg-white/10 mx-2" />
              <div className="flex gap-2">
                {engines.map(engine => {
                const Icon = engine.icon
                const isActive = activeEngine === engine.id
                return (
                  <button
                    key={engine.id}
                    onClick={() => setActiveEngine(engine.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                      isActive
                        ? `bg-${engine.color}-500/20 border-${engine.color}-500/40 text-${engine.color}-400`
                        : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <div className="text-left">
                      <div className="text-[10px] font-black uppercase tracking-widest leading-none">{engine.name}</div>
                      <div className="text-[8px] uppercase tracking-tighter opacity-60 mt-0.5 leading-none">{engine.maker}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Persona Switcher */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Director Persona // Agentic Identity</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {personas.map(persona => {
                  const Icon = persona.icon
                  const isActive = activePersona === persona.id
                  return (
                    <button
                      key={persona.id}
                      onClick={() => setActivePersona(persona.id)}
                      className={`flex flex-col gap-3 p-4 rounded-2xl transition-all border text-left group ${
                        isActive
                          ? `bg-${persona.color}-500/10 border-${persona.color}-500/30 text-${persona.color}-400 ${
                              persona.color === 'orange' ? 'shadow-[0_0_30px_rgba(249,115,22,0.1)]' :
                              persona.color === 'indigo' ? 'shadow-[0_0_30px_rgba(99,102,241,0.1)]' :
                              'shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                            }`
                          : 'bg-white/[0.02] border-white/5 text-slate-500 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      <div className={`p-2 w-fit rounded-lg ${isActive ? `bg-${persona.color}-500/20` : 'bg-white/5'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest">{persona.name}</div>
                        <div className="text-[8px] font-medium opacity-50 mt-1">{persona.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className={`${glassStyle} p-8 rounded-[3rem] space-y-3 min-w-[320px] relative overflow-hidden group border-fuchsia-500/10`}>
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Orbit className="w-24 h-24 text-fuchsia-500" />
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Core Status: {requirementsReady ? 'ALPHA ACTIVE' : 'FAULT DETECTED'}</p>
             <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_15px] ${requirementsReady ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50'}`} />
                <p className="text-sm font-black text-white italic truncate max-w-[200px] uppercase">
                  {activeThought}
                </p>
             </div>

             {/* Agentic Forge Button */}
             <div className="pt-4">
                <button
                  onClick={handleForge}
                  disabled={isForging || !onForgeMaster}
                  className={`w-full p-8 rounded-[2.5rem] relative overflow-hidden group transition-all transform active:scale-95 ${
                    isForging
                      ? 'bg-indigo-600/50 cursor-wait'
                      : 'bg-gradient-to-br from-indigo-600 to-fuchsia-600 hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                  }`}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                     {isForging ? (
                       <Loader2 className="w-8 h-8 animate-spin text-white mb-2" />
                     ) : (
                       <Zap className="w-8 h-8 text-white mb-2 animate-bounce" />
                     )}
                     <div className="text-xl font-black text-white tracking-tight leading-tight">Agentic Forge</div>
                     <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1.5">One-click generate</div>
                  </div>

                  {/* Progress Bar (Mock) */}
                  {isForging && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 5, ease: 'linear' }}
                      className="absolute bottom-0 left-0 h-1 bg-white/40"
                    />
                  )}
                </button>
             </div>

             {/* Director Voice HUD */}
             <div className="pt-4">
                <DirectorLog
                  persona={activePersona}
                  currentTime={0}
                  metrics={{
                    cutsPerMinute: engagementScore?.cutsPerMinute || 6.5,
                    brollRatio: engagementScore?.brollRatio || 0.15,
                    hookStrength: engagementScore?.hookStrength || 78
                  }}
                />
             </div>
          </div>
        </div>
      </motion.div>

      {/* Suggested Assets Node */}
      {suggestedAssets.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-8">
           <div className="flex items-center gap-6">
              <div className="w-10 h-2 bg-indigo-500 rounded-full" />
              <h3 className="text-xl font-black text-white tracking-tight">Suggested Assets</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {suggestedAssets.map((asset, i) => (
                <motion.div
                  key={asset.id}
                  whileHover={{ y: -10, scale: 1.02 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all group/asset shadow-xl relative overflow-hidden"
                >
                  {asset.thumbnail && (
                    <img src={asset.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-110 transition-transform duration-1000" />
                  )}
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        {asset.type === 'music' ? <Radio className="w-4 h-4 text-indigo-400" /> : <Layers className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic bg-indigo-500/10 px-3 py-1 rounded-full">MATCHED</span>
                    </div>
                    <div>
                      <h5 className="text-lg font-black text-white italic truncate uppercase">{asset.title}</h5>
                      <div className="flex flex-wrap gap-2 mt-3">
                         {asset.autoTags?.slice(0, 2).map(t => (
                           <span key={t} className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">#{t}</span>
                         ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInjectAsset(asset)}
                      className="w-full py-4 rounded-xl bg-indigo-500 text-white font-black text-[10px] tracking-widest uppercase italic shadow-lg shadow-indigo-500/20 border border-white/10"
                    >
                      Inject Draft node
                    </button>
                  </div>
                </motion.div>
              ))}
           </div>
        </motion.div>
      )}

      {/* Initialize / Management Card */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} p-16 rounded-[4.5rem] relative overflow-hidden group shadow-3xl`}
      >
        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none rotate-12 group-hover:scale-110 transition-transform duration-1000">
          <Fingerprint className="w-64 h-64 text-fuchsia-500" />
        </div>

        <div className="space-y-12 relative z-10">
          {requirementsReady === false && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-10 p-10 rounded-[3rem] bg-amber-500/5 border border-amber-500/10 shadow-inner backdrop-blur-3xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black text-amber-400 uppercase tracking-widest italic">NEURAL READINESS FAULT</p>
                <p className="text-xl text-slate-400 font-medium italic">{requirementsMessage || 'Verify OPENAI_API_KEY in repository configuration.'}</p>
              </div>
            </motion.div>
          )}

          <div className="flex gap-6">
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={applySemanticCaptions}
              className="flex-1 p-10 bg-white shadow-2xl rounded-[3rem] border border-white/20 flex flex-col items-center justify-center gap-6 group/btn relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
              <div className="w-16 h-16 rounded-[1.4rem] bg-indigo-500/10 flex items-center justify-center group-hover/btn:bg-indigo-500 transition-colors duration-500 relative z-10">
                <Type className="w-8 h-8 text-indigo-500 group-hover/btn:text-white transition-colors duration-500" />
              </div>
              <div className="text-center space-y-2 relative z-10">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] italic group-hover/btn:text-indigo-500">Node Synthesis</p>
                <p className="text-xl font-black text-slate-800 uppercase tracking-tighter">Semantic Captions</p>
              </div>
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              if (!videoId) {
                showToast('No video loaded', 'error')
                return
              }
              if (requirementsReady === false) {
                showToast('AI Synthesis Unavailable', 'error')
                return
              }
              setIsTranscribing(true)
              showToast('Extracting neural transcript...', 'info')
              try {
                const res = await apiPost<{ success?: boolean; data?: { text: string; words: Array<{ word: string; start: number; end: number }> } }>(
                  '/video/transcribe-editor',
                  { videoId, language: 'en' }
                )
                const data = (res as any)?.data ?? (res as any)
                const words = data?.words ?? []
                const text = data?.text ?? ''
                if (words.length === 0) {
                  showToast('Neural detection empty', 'info')
                  setTranscript(null)
                  setEditingWords([])
                  return
                }
                setTranscript({ text, words })
                setEditingWords(words)
                showToast(`Synthesis Complete: ${words.length} nodes indexed`, 'success')
              } catch (e: any) {
                console.error('Transcribe error', e)
                showToast('Synthesis interrupted', 'error')
              } finally {
                setIsTranscribing(false)
              }
            }}
            disabled={isTranscribing || requirementsReady === false}
            className={`w-full py-10 rounded-[3rem] bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-black text-xs tracking-[0.6em] flex items-center justify-center gap-8 shadow-[0_40px_100px_rgba(217,70,239,0.3)] border border-white/20 uppercase transition-all disabled:opacity-30 disabled:grayscale relative overflow-hidden group/btn`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
            {isTranscribing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Fingerprint className="w-8 h-8" />}
            {isTranscribing ? 'Digitizing Neural Stream...' : requirementsReady === false ? 'Core Offline' : 'Initialize Semantic Extraction'}
          </motion.button>

          <div className="p-10 rounded-[3.5rem] bg-white/[0.02] border border-white/5 flex flex-col xl:flex-row items-center justify-between gap-10 hover:bg-white/[0.04] hover:border-fuchsia-500/20 transition-all shadow-inner group/exec">
            <div className="flex items-center gap-10">
              <div className="w-20 h-20 rounded-[2rem] bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20 shadow-2xl group-hover/exec:scale-110 group-hover/exec:rotate-6 transition-all duration-700">
                <Zap className="w-10 h-10 text-fuchsia-500 animate-pulse" />
              </div>
              <div className="space-y-1 text-center xl:text-left">
                <h4 className="text-2xl font-black text-white tracking-tight leading-tight">Apply all AI suggestions</h4>
                <p className="text-[12px] text-slate-400 font-medium mt-2">Auto-edit cuts, captions, and pacing in one click.</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, x: 10 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (viralQuotes.length && setTextOverlays) {
                  setTextOverlays((prev: any[]) => [...prev, ...viralQuotes.slice(0, 3).map((q: any) => ({
                    id: `quote-${Date.now()}-${Math.random()}`,
                    text: q.text,
                    x: 50, y: 50, fontSize: 28, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                    startTime: q.start ?? 0, endTime: q.end ?? 5, style: 'shadow'
                  }))])
                  showToast('Top alpha-nodes integrated', 'success')
                } else if (aiSuggestions?.length) {
                  const segments = aiSuggestions.map((s: any) => ({
                    id: s.id || `ai-${Date.now()}-${Math.random()}`,
                    startTime: s.time ?? 0,
                    endTime: (s.time ?? 0) + 2,
                    duration: 2,
                    type: 'text' as const,
                    name: s.description || 'AI suggestion',
                    color: '#8b5cf6',
                    track: getDefaultTrackForSegmentType('text')
                  }))
                  setTimelineSegments((prev: any[]) => [...prev, ...segments])
                  showToast('Applied global neural patches', 'success')
                } else {
                  showToast('Synthesis required for auto-execution', 'info')
                }
                setActiveCategory?.('timeline')
              }}
              title="Apply all AI suggestions"
              className="px-10 py-3.5 bg-fuchsia-500 text-white rounded-full font-bold text-[12px] uppercase tracking-[0.2em] hover:bg-fuchsia-600 transition-colors shadow-xl shadow-fuchsia-500/30"
            >
              Apply all
            </motion.button>
          </div>

          {/* AI AUTO-EDIT CLIPS SECTOR */}
          <div className="pt-12 border-t border-white/5 space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-xl">
                  <Layers className="w-7 h-7 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white tracking-tight leading-tight">Auto-edit clips</h4>
                  <span className="text-[11px] font-medium text-slate-400 mt-1.5 block">Generate short-form variations from your video</span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onGenerateClips}
                className="px-7 py-3 bg-white/5 border border-white/10 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-colors flex items-center gap-2.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                Generate clips
              </motion.button>
            </div>

            {autoEditClips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {autoEditClips.map((clip, i) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all group/clip shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Variation 0{i+1}</span>
                      <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                        {clip.engagementScore.overall}% RANK
                      </div>
                    </div>
                    <h5 className="text-xl font-black text-white italic truncate mb-4 uppercase">{clip.name}</h5>
                    <div className="flex items-center gap-4 mb-8">
                       <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${clip.engagementScore.viralPotential}%` }}
                            className="h-full bg-indigo-500"
                          />
                       </div>
                       <span className="text-[9px] font-bold text-slate-400">VIRAL:{clip.engagementScore.viralPotential}</span>
                    </div>
                    <button
                      onClick={() => onApplyClip?.(clip)}
                      className="w-full py-4 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all italic"
                    >
                      Apply To Timeline
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center rounded-[3rem] border-2 border-dashed border-white/5">
                 <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">No variants synthesized in current node</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => {
          setShowSwarmHUD(false)
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          }
        }}
      />

      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="space-y-12"
          >
            {/* Transcript Card */}
            <motion.div variants={itemVariants} className={`${glassStyle} p-16 rounded-[4.5rem] relative overflow-hidden group`}>
               <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                  <MessageSquare className="w-64 h-64 text-indigo-500" />
               </div>

               <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16 relative z-10">
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black text-white tracking-tight">Transcript</h3>
                     <p className="text-[12px] font-medium text-slate-400">Click any word to seek the player. Extract quotes for overlays.</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={handleExtractQuotes}
                    disabled={isExtractingQuotes}
                    className="px-7 py-3 bg-indigo-600 text-white rounded-full font-bold text-[11px] uppercase tracking-[0.2em] flex items-center gap-2.5 shadow-lg shadow-indigo-500/30 transition-colors disabled:opacity-50"
                  >
                    {isExtractingQuotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    {isExtractingQuotes ? 'Extracting…' : 'Extract key quotes'}
                  </motion.button>
               </div>

               <div className="h-[500px] w-full relative z-10 rounded-[3rem] overflow-hidden border border-white/5 bg-black/20 backdrop-blur-3xl shadow-inner">
                 <Virtuoso
                   data={wordChunks}
                   itemContent={(index, chunk) => (
                     <div className="p-8 border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors flex flex-wrap gap-4">
                        {chunk.words.map((w: any, i: number) => (
                          <motion.span
                            key={`${index}-${i}`}
                            whileHover={{ scale: 1.2, color: '#818cf8', rotate: 2 }}
                            className="text-2xl font-black text-slate-500 uppercase tracking-tighter cursor-pointer select-none transition-colors italic"
                          >
                            {w.word}
                          </motion.span>
                        ))}
                     </div>
                   )}
                 />
               </div>
            </motion.div>

            {/* Quotes Node */}
            <motion.div variants={itemVariants} className="space-y-12">
               <div className="flex items-center gap-8">
                  <div className="w-1.5 h-12 bg-orange-500 rounded-full" />
                  <h3 className="text-2xl font-black text-white tracking-tight">Viral-worthy quotes</h3>
               </div>

              <div className="relative z-10">
                {viralQuotes.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {viralQuotes.map((quote, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -12, scale: 1.02 }}
                        className="bg-white/[0.02] hover:bg-white/[0.04] rounded-[3.5rem] p-12 border border-white/5 hover:border-orange-500/30 transition-all group/quote relative shadow-3xl backdrop-blur-3xl"
                      >
                        <div className="flex items-start justify-between gap-8 mb-10">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <div className="inline-flex px-5 py-2.5 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] shadow-xl italic w-fit">
                                STRATEGIC WEIGHT: {quote.strategicWeight || (quote.score * 100).toFixed(0)}%
                              </div>
                              {quote.strategicWeight > 70 && (
                                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black border border-emerald-500/20 italic">
                                  GROWTH NODE
                                </div>
                              )}
                              {quote.integrityVerified && (
                                <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[8px] font-black border border-indigo-500/20 flex items-center gap-1.5 italic">
                                  <ShieldCheck className="w-3 h-3" />
                                  INTEGRITY VERIFIED
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                               <span className="text-[11px] text-slate-600 font-black uppercase tracking-[0.3em] italic group-hover/quote:text-orange-500 transition-colors">Top tier // Logic 0{i + 1}</span>
                               <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden relative" title={`Originality Score: ${quote.originalityScore}%`}>
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${quote.originalityScore || 70}%` }}
                                    className="h-full bg-gradient-to-r from-orange-500 to-indigo-500"
                                  />
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 opacity-0 group-hover/quote:opacity-100 transition-all">
                            {setTextOverlays && (
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                onClick={() => {
                                  setTextOverlays((prev: any[]) => [...prev, {
                                    id: `quote-${Date.now()}-${Math.random()}`,
                                    text: quote.text,
                                    x: 50, y: 50, fontSize: 32, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                                    startTime: quote.start ?? 0, endTime: quote.end ?? 5, style: 'shadow'
                                  }])
                                  showToast('Node projected to workspace', 'success')
                                }}
                                className="w-14 h-14 bg-orange-500/20 text-orange-400 rounded-[1.2rem] flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all border border-orange-500/20 shadow-2xl"
                              >
                                <ArrowUpRight className="w-6 h-6" />
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              onClick={() => copyToClipboard(quote.text)}
                              className="w-14 h-14 bg-white/5 text-slate-500 rounded-[1.2rem] flex items-center justify-center hover:bg-white/10 hover:text-white transition-all border border-white/10 shadow-2xl"
                            >
                              <Copy className="w-6 h-6" />
                            </motion.button>
                          </div>
                        </div>
                        <p className="text-3xl font-black text-white italic leading-[1.1] tracking-tighter uppercase mb-10 group-hover/quote:scale-[1.02] transition-transform origin-left">&quot;{quote.text}&quot;</p>
                        <div className="space-y-4">
                          {quote.reason && (
                            <div className="flex items-start gap-5 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 group-hover/quote:border-orange-500/20 transition-all">
                              <Target className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                              <p className="text-[13px] text-slate-500 font-medium italic leading-relaxed group-hover/quote:text-slate-300">
                                {quote.reason}
                              </p>
                            </div>
                          )}
                          {quote.nicheRelevance && (
                            <div className="flex items-start gap-5 p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 group-hover/quote:border-indigo-500/30 transition-all">
                              <Brain className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Niche Relevance</span>
                                <p className="text-[12px] text-indigo-200 font-medium italic leading-relaxed">
                                  {quote.nicheRelevance}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-32 flex flex-col items-center gap-10">
                    <div className="relative">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="w-32 h-32 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-slate-800" />
                      </motion.div>
                      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 bg-orange-500 blur-3xl rounded-full" />
                    </div>
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] italic">Processing // System Idle</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default EliteAIView
