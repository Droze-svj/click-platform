'use client'

import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../contexts/ToastContext'
import {
  Video,
  FileText,
  Mic,
  File,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Music,
  Zap,
  TrendingUp,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Fingerprint,
  Radio,
  Orbit,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Target,
  Box,
  Layers,
  Send,
  ZapOff,
  Activity,
  Fingerprint as FingerprintIcon
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface PipelineProps {
  contentId: string
  contentType: 'video' | 'article' | 'podcast' | 'transcript'
  onComplete?: (pipeline: any) => void
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

const glassStyle = "backdrop-blur-[40px] bg-white/[0.03] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]"

export default function UnifiedContentPipeline({ contentId, contentType, onComplete }: PipelineProps) {
  const [pipeline, setPipeline] = useState<any>(null)
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'
  ])
  const [autoSchedule, setAutoSchedule] = useState(false)
  const [enableRecycling, setEnableRecycling] = useState(true)
  const [processingLog, setProcessingLog] = useState<string[]>([])
  const [activeThought, setActiveThought] = useState('')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const { showToast } = useToast()

  const platformThemes: Record<string, { accent: string, glow: string, bg: string, accentHex: string }> = {
    twitter: { accent: 'indigo-500', glow: 'rgba(99,102,241,0.4)', bg: 'from-indigo-600/10', accentHex: '#6366f1' },
    linkedin: { accent: 'blue-500', glow: 'rgba(59,130,246,0.4)', bg: 'from-blue-600/10', accentHex: '#3b82f6' },
    facebook: { accent: 'blue-600', glow: 'rgba(37,99,235,0.4)', bg: 'from-blue-700/10', accentHex: '#2563eb' },
    instagram: { accent: 'fuchsia-500', glow: 'rgba(217,70,239,0.4)', bg: 'from-fuchsia-600/10', accentHex: '#d946ef' },
    youtube: { accent: 'rose-600', glow: 'rgba(225,29,72,0.4)', bg: 'from-rose-700/10', accentHex: '#e11d48' },
    tiktok: { accent: 'cyan-400', glow: 'rgba(34,211,238,0.4)', bg: 'from-cyan-500/10', accentHex: '#22d3ee' }
  }

  const currentTheme = selectedPlatforms.length > 0
    ? (platformThemes[selectedPlatforms[0]] || platformThemes.twitter)
    : platformThemes.twitter

  const aiThoughts = [
    "Optimizing narrative nodes for cross-platform resonance...",
    "Extracting high-engagement clusters from source material...",
    "Neural thread processing: Multi-network synthesis active...",
    "Calibrating engagement velocity across 6 dimensions...",
    "Synchronizing autonomous repository with tactical roadmap..."
  ]

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
  }, [])

  const platforms = [
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: `text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]` },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: `text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]` },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: `text-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]` },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: `text-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.4)]` },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: `text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]` },
    { id: 'tiktok', name: 'TikTok', icon: Music, color: `text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]` }
  ]

  const contentTypeIcons = {
    video: Video,
    article: FileText,
    podcast: Mic,
    transcript: File
  }

  const ContentIcon = contentTypeIcons[contentType] || FileText

  const addLog = (msg: string) => {
    setProcessingLog(prev => [...prev.slice(-4), msg])
  }

  const processPipeline = async () => {
    try {
      setStatus('processing')
      setProcessingLog([])
      addLog("Initializing Neural Engine...")

      const token = localStorage.getItem('token')

      setTimeout(() => addLog("Analyzing Source Integrity..."), 800)
      setTimeout(() => addLog("Extracting Narrative Clusters..."), 1600)
      setTimeout(() => addLog("Neural Synthesis: Multi-Node Active..."), 2400)

      const response = await axios.post(
        `${API_URL}/pipeline/process`,
        {
          contentId,
          platforms: selectedPlatforms,
          autoSchedule,
          enableRecycling,
          includePerformancePrediction: true,
          includeAnalytics: true
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setPipeline(response.data.data)
        setStatus('completed')
        showToast('Pipeline Synchronized Successfully', 'success')
        if (onComplete) {
          onComplete(response.data.data)
        }
      }
    } catch (error: any) {
      setStatus('error')
      showToast(error.response?.data?.message || 'Neural synchronization failed', 'error')
    }
  }

  const publishAll = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/pipeline/${contentId}/publish`,
        {
          platforms: selectedPlatforms,
          schedule: autoSchedule
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        showToast('Successfully broadcasted to ecosystem', 'success')
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Broadcast failed', 'error')
    }
  }

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/pipeline/${contentId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success && response.data.data) {
        setPipeline(response.data.data)
        setStatus(response.data.data.status === 'completed' ? 'completed' : 'processing')
      }
    } catch (error) {
      // Not started
    }
  }

  useEffect(() => {
    if (contentId) {
      loadStatus()
    }
  }, [contentId])

  const cosmicBg = "relative overflow-hidden selection:bg-indigo-500/30"

  return (
    <div className={`rounded-[4.5rem] overflow-hidden border border-white/5 shadow-3xl bg-[#020202] text-slate-200 ${cosmicBg}`}>
      {/* Immersive Interior Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
        <div className={`absolute top-0 right-0 w-[500px] h-[500px] bg-${currentTheme.accent}/5 blur-[120px] rounded-full`} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 p-12 md:p-20 space-y-16">
        {/* Elite Pipeline Header */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-12">
          <div className="space-y-8 flex-1">
            <div className={`inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 text-${currentTheme.accent} text-[11px] font-black uppercase tracking-[0.5em] italic shadow-lg`}>
              <Radio className="w-4 h-4 animate-pulse" />
              Intelligence Pipeline Alpha
            </div>
            <div className="space-y-4">
              <h1 className="text-[8rem] md:text-[12rem] font-black tracking-tighter bg-gradient-to-b from-white via-white to-white/10 bg-clip-text text-transparent italic leading-[0.75]">
                NEURAL<br />FLOW
              </h1>
              <p className="text-slate-500 text-3xl font-medium tracking-tight mt-10 max-w-4xl">
                Synthesizing <span className="text-white font-black italic underline underline-offset-8 decoration-4 decoration-white/10">{contentType}</span> into a multi-network <span className={`text-${currentTheme.accent} font-black italic`}>Autonomous Ecosystem</span>.
              </p>
            </div>
          </div>

          {/* AI Thinking Ticker (Elite) */}
          <div className="flex items-center gap-6 px-10 py-7 rounded-[3rem] bg-white/[0.03] border border-white/5 backdrop-blur-3xl min-w-[450px] shadow-3xl">
            <div className={`w-14 h-14 rounded-2xl bg-${currentTheme.accent}/10 flex items-center justify-center border border-${currentTheme.accent}/20`}>
              <Sparkles className={`w-7 h-7 text-${currentTheme.accent} animate-bounce`} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeThought}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-[13px] font-black text-slate-400 uppercase tracking-[0.3em] italic"
              >
                {activeThought}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Global Progress Track (Elite) */}
        <div className={`relative ${glassStyle} p-12 rounded-[3.5rem] border-white/5 overflow-hidden group shadow-3xl`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.bg} via-transparent to-transparent opacity-10 group-hover:opacity-20 transition-opacity duration-1000`} />
          <div className="flex flex-col lg:flex-row items-center justify-between relative z-10 gap-12">
            <div className="flex items-center gap-12 flex-1 w-full">
              <motion.div
                animate={{
                  scale: status === 'processing' ? [1, 1.15, 1] : 1,
                  rotate: status === 'processing' ? 360 : 0
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className={`w-28 h-28 rounded-[2.5rem] bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 flex items-center justify-center shadow-3xl shadow-${currentTheme.accent}/5 relative`}
              >
                <ContentIcon className={`w-12 h-12 text-${currentTheme.accent} relative z-10`} />
                {status === 'processing' && (
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-spin" />
                )}
              </motion.div>

              <div className="flex-1 space-y-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-600 block italic">Neural Transformation Velocity</span>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">{status === 'completed' ? 'Synchronization Complete' : status === 'processing' ? 'Synthesis Active' : 'Idle State'}</h3>
                  </div>
                  <div className={`text-6xl font-black italic tracking-tighter tabular-nums ${status === 'completed' ? 'text-emerald-400' : `text-${currentTheme.accent}`}`}>
                    {status === 'completed' ? '100' : status === 'processing' ? '65' : '0'}<span className="text-xl not-italic ml-2 opacity-40">%</span>
                  </div>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: status === 'completed' ? '100%' : status === 'processing' ? '65%' : '0%' }}
                    transition={{ duration: 2, ease: "circOut" }}
                    className={`h-full bg-gradient-to-r from-${currentTheme.accent} via-white to-purple-500 rounded-full shadow-[0_0_40px_${currentTheme.glow}]`}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 px-10 py-6 rounded-[2.5rem] bg-black/40 border border-white/5 backdrop-blur-xl">
              {platforms.filter(p => selectedPlatforms.includes(p.id)).slice(0, 4).map((platform, idx) => {
                const Icon = platform.icon
                return (
                  <motion.div
                    key={platform.id}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, type: 'spring' }}
                    className={`p-4 rounded-2xl bg-white/[0.03] border border-white/5 ${platform.color} shadow-2xl scale-110`}
                  >
                    <Icon className="w-6 h-6" />
                  </motion.div>
                )
              })}
              {selectedPlatforms.length > 4 && (
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  +{selectedPlatforms.length - 4}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Configuration Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Action / Configuration Column */}
          <div className="lg:col-span-12 space-y-12">
            <AnimatePresence mode="wait">
              {status === 'idle' ? (
                <motion.div
                  key="setup"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -40 }}
                  className="space-y-16"
                >
                  {/* Elite Platform Selection */}
                  <div className="space-y-10">
                    <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-6">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                        <h3 className="text-[12px] font-black uppercase tracking-[0.5em] text-slate-500 italic">Target Cluster Repositories</h3>
                      </div>
                      <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] italic bg-indigo-500/5 px-6 py-2 rounded-full border border-indigo-500/20">{selectedPlatforms.length} Ecosystems Active</div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-8">
                      {platforms.map(platform => {
                        const Icon = platform.icon
                        const isSelected = selectedPlatforms.includes(platform.id)
                        const pTheme = platformThemes[platform.id] || currentTheme
                        return (
                          <motion.button
                            key={platform.id}
                            whileHover={{ y: -12, scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform.id))
                              } else {
                                setSelectedPlatforms([...selectedPlatforms, platform.id])
                              }
                            }}
                            className={`p-10 rounded-[3rem] border-2 transition-all duration-700 group relative overflow-hidden ${isSelected
                              ? `border-${pTheme.accent} bg-${pTheme.accent}/5 shadow-[0_40px_80px_rgba(0,0,0,0.4),0_0_40px_${pTheme.glow}]`
                              : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] grayscale opacity-40'
                              }`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-br from-${pTheme.accent}/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                            <Icon className={`w-12 h-12 mx-auto mb-6 relative z-10 transition-all duration-700 ${isSelected ? platform.color + ' scale-125' : 'text-slate-500'}`} />
                            <span className={`text-[11px] font-black uppercase tracking-[0.3em] relative z-10 block italic transition-all duration-700 ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                              {platform.name}
                            </span>
                            {isSelected && (
                              <motion.div layoutId={`glow-${platform.id}`} className={`absolute -bottom-8 -right-8 w-16 h-16 bg-${pTheme.accent} blur-2xl rounded-full opacity-40`} />
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Elite Options Matrix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <motion.div
                      whileHover={{ y: -8, scale: 1.02 }}
                      className={`relative p-12 rounded-[3.5rem] bg-white/[0.02] border-2 transition-all duration-700 cursor-pointer overflow-hidden group/opt ${autoSchedule ? 'border-emerald-500/30 bg-emerald-500/5 shadow-3xl' : 'border-white/5'}`}
                      onClick={() => setAutoSchedule(!autoSchedule)}
                    >
                      <div className="flex items-center gap-10 relative z-10">
                        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 ${autoSchedule ? 'bg-emerald-500 shadow-3xl shadow-emerald-500/40 text-white' : 'bg-slate-900 border border-white/5 text-slate-700'}`}>
                          <Clock className={`w-10 h-10 ${autoSchedule ? 'animate-pulse' : ''}`} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <h4 className="text-3xl font-black text-white italic uppercase leading-none">Neural Scheduling</h4>
                          <p className="text-sm text-slate-500 font-medium tracking-tight">Deploy predictive broadcast timing for peak engagement velocity.</p>
                        </div>
                        <div className={`w-16 h-8 rounded-full p-1.5 transition-all duration-700 ${autoSchedule ? 'bg-emerald-500' : 'bg-white/5'} flex items-center border border-white/5 shadow-inner`}>
                          <motion.div animate={{ x: autoSchedule ? 32 : 0 }} className="w-5 h-5 bg-white rounded-full shadow-2xl" />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ y: -8, scale: 1.02 }}
                      className={`relative p-12 rounded-[3.5rem] bg-white/[0.02] border-2 transition-all duration-700 cursor-pointer overflow-hidden group/opt ${enableRecycling ? `border-${currentTheme.accent}/30 bg-${currentTheme.accent}/5 shadow-3xl` : 'border-white/5'}`}
                      onClick={() => setEnableRecycling(!enableRecycling)}
                    >
                      <div className="flex items-center gap-10 relative z-10">
                        <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 ${enableRecycling ? `bg-${currentTheme.accent} shadow-3xl shadow-${currentTheme.accent}/40 text-white` : 'bg-slate-900 border border-white/5 text-slate-700'}`}>
                          <RefreshCw className={`w-10 h-10 ${enableRecycling ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <h4 className="text-3xl font-black text-white italic uppercase leading-none">Evergreen Synthesis</h4>
                          <p className="text-sm text-slate-500 font-medium tracking-tight">Activate self-healing content recycling for infinite repository ROI.</p>
                        </div>
                        <div className={`w-16 h-8 rounded-full p-1.5 transition-all duration-700 ${enableRecycling ? `bg-${currentTheme.accent}` : 'bg-white/5'} flex items-center border border-white/5 shadow-inner`}>
                          <motion.div animate={{ x: enableRecycling ? 32 : 0 }} className="w-5 h-5 bg-white rounded-full shadow-2xl" />
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Elite Action Control */}
                  <div className="flex justify-center pt-8">
                    <motion.button
                      whileHover={{ scale: 1.05, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={processPipeline}
                      className={`relative group px-20 py-10 rounded-[3rem] bg-${currentTheme.accent} text-white transition-all duration-700 shadow-[0_40px_100px_${currentTheme.glow}] overflow-hidden overflow-hidden border border-white/30`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
                      <div className="flex items-center gap-8 relative z-10">
                        <FingerprintIcon className="w-12 h-12" />
                        <div className="text-left">
                          <div className="text-[11px] font-black uppercase tracking-[0.5em] opacity-60 mb-1 italic">Initiate Sequence</div>
                          <div className="text-4xl font-black uppercase tracking-tighter italic leading-none">Neural Processing</div>
                        </div>
                      </div>
                      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-white/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rotate-45 pointer-events-none" />
                    </motion.button>
                  </div>
                </motion.div>
              ) : status === 'processing' ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-16 py-20"
                >
                  <div className="flex flex-col items-center gap-16 text-center">
                    <div className="relative">
                      <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className={`w-64 h-64 rounded-[4rem] border-4 border-dashed border-${currentTheme.accent}/40 flex items-center justify-center relative shadow-[0_0_80px_${currentTheme.glow}]`}
                      >
                        <Cpu className={`w-32 h-32 text-${currentTheme.accent} animate-pulse`} />
                      </motion.div>
                      <div className="absolute -inset-10 border border-white/5 rounded-full animate-ping opacity-20" />
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-none">Synthesis Active</h3>
                      <div className="flex items-center justify-center gap-6">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Ecosystem Calibration in progress</span>
                        <div className="flex items-center gap-2">
                          {[1, 2, 3].map(i => (
                            <motion.div
                              key={i}
                              animate={{ opacity: [0.2, 1, 0.2] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                              className={`w-2 h-2 rounded-full bg-${currentTheme.accent}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-3xl bg-black/40 border border-white/5 rounded-[3rem] p-12 backdrop-blur-3xl shadow-3xl text-left font-mono relative overflow-hidden group">
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
                      <div className="flex items-center gap-6 mb-10 pb-6 border-b border-white/5">
                        <Activity className={`w-7 h-7 text-${currentTheme.accent}`} />
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] italic leading-none">Neural Feed // Processing Log</span>
                      </div>
                      <div className="space-y-6 relative z-10 transition-all duration-500">
                        {processingLog.map((log, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-8 text-emerald-400 font-bold"
                          >
                            <span className="text-slate-700 font-black tabular-nums text-sm">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse" />
                            <span className="text-xl tracking-tight uppercase italic">{log}</span>
                          </motion.div>
                        ))}
                      </div>
                      <div className="absolute bottom-6 right-10 text-[10px] text-slate-700 font-black uppercase tracking-[0.5em] animate-pulse italic">Cortex Channel // Alpha Active</div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="completed"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-16"
                >
                  {/* Completed Status HUD */}
                  <div className={`p-20 rounded-[4.5rem] ${glassStyle} border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden text-center`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
                    <div className="relative z-10 space-y-12">
                      <div className="w-32 h-32 rounded-[3rem] bg-emerald-500 flex items-center justify-center mx-auto shadow-[0_30px_60px_rgba(16,185,129,0.4)] border border-white/20">
                        <CheckCircle2 className="w-16 h-16 text-white" />
                      </div>
                      <div className="space-y-6">
                        <h3 className="text-8xl font-black text-white italic tracking-tighter leading-[0.8]">SYNCHRONIZATION<br />VERIFIED</h3>
                        <p className="text-slate-500 text-2xl font-medium tracking-tight mt-8 uppercase italic">Ecosystem broadast nodes are <span className="text-white font-black">primed</span> for deployment.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-10">
                        <div className="p-10 rounded-[3rem] bg-black/40 border border-white/5 shadow-2xl">
                          <div className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4 italic">Estimated Yield</div>
                          <div className="text-6xl font-black text-emerald-400 tracking-tighter italic tabular-nums">+42<span className="text-2xl ml-1 opacity-40">%</span></div>
                        </div>
                        <div className="p-10 rounded-[3rem] bg-black/40 border border-white/5 shadow-2xl">
                          <div className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4 italic">Neural Integrity</div>
                          <div className="text-6xl font-black text-white tracking-tighter italic tabular-nums">98.4<span className="text-2xl ml-1 opacity-40">%</span></div>
                        </div>
                        <div className="p-10 rounded-[3rem] bg-black/40 border border-white/5 shadow-2xl">
                          <div className="text-[11px] font-black text-slate-700 uppercase tracking-[0.4em] mb-4 italic">Nodes Active</div>
                          <div className="text-6xl font-black text-white tracking-tighter italic tabular-nums">{selectedPlatforms.length}</div>
                        </div>
                      </div>

                      <div className="flex justify-center gap-10 pt-16">
                        <motion.button
                          whileHover={{ scale: 1.05, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setStatus('idle')}
                          className="px-12 py-7 rounded-[2.5rem] bg-white text-black font-black text-sm uppercase tracking-[0.4em] italic shadow-3xl"
                        >
                          Reconfigure Flow
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={publishAll}
                          className={`px-16 py-7 rounded-[2.5rem] bg-emerald-500 text-white font-black text-sm uppercase tracking-[0.4em] italic shadow-[0_30px_80px_rgba(16,185,129,0.5)] border border-white/20 flex items-center gap-6`}
                        >
                          <Send className="w-5 h-5 fill-white" />
                          Broadcast to Ecosystem
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
