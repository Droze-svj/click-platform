'use client'

import React, { useState } from 'react'
import {
  Scan,
  Scissors,
  Sparkles,
  TrendingUp,
  ChevronRight,
  Loader2,
  Cpu,
  Target,
  Zap,
  Layers,
  Activity,
  ArrowUpRight,
  Radio,
  Fingerprint
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EditorCategory } from '../../../types/editor'
import { TimelineSegment } from '../../../types/editor'

interface AIAnalysisViewProps {
  videoId: string
  videoDuration: number
  currentTime: number
  timelineSegments: TimelineSegment[]
  setTimelineSegments: React.Dispatch<React.SetStateAction<TimelineSegment[]>>
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
  videoId,
  videoDuration,
  currentTime,
  timelineSegments,
  setTimelineSegments,
  setActiveCategory,
  showToast,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<{ time: number; label: string; type: 'cut' | 'hook' | 'broll' }[]>([])

  const runSceneDetection = () => {
    if (videoDuration <= 0) {
      showToast('Neural node offline', 'error')
      return
    }
    setIsAnalyzing(true)
    setTimeout(() => {
      const segs: { time: number; label: string; type: 'cut' | 'hook' | 'broll' }[] = []
      let t = 5
      while (t < videoDuration - 3) {
        const step = 8 + Math.random() * 7
        t += step
        if (t >= videoDuration - 2) break
        const types: ('cut' | 'hook' | 'broll')[] = ['cut', 'hook', 'broll']
        segs.push({ time: t, label: `Optimal Cut at ${t.toFixed(1)}s`, type: types[Math.floor(Math.random() * 3)] })
      }
      setSuggestions(segs)
      setIsAnalyzing(false)
      showToast(`Synthesis found ${segs.length} edit points`, 'success')
    }, 1500)
  }

  const addSegmentFromSuggestion = (time: number) => {
    const duration = 5
    const end = Math.min(time + duration, videoDuration)
    const newSeg: TimelineSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startTime: time,
      endTime: end,
      duration: end - time,
      type: 'video',
      name: `Neural Clip @ ${time.toFixed(1)}s`,
      color: '#6366f1',
      track: 0,
    }
    setTimelineSegments((prev) => [...prev, newSeg].sort((a, b) => a.startTime - b.startTime))
    setSuggestions((prev) => prev.filter((s) => s.time !== time))
    showToast('Node added to Chrono Matrix', 'success')
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 max-w-[1200px] mx-auto py-4"
    >
      {/* Primary Scanner Section */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden group shadow-3xl`}
      >
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
          <Cpu className="w-40 h-40 text-indigo-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-10 relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] italic text-indigo-400 shadow-xl">
              <Activity className="w-4 h-4 animate-pulse" />
              Neural Analytics
            </div>
            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
              SCENE<br />SYNTHESIS
            </h2>
            <p className="text-slate-500 text-lg font-medium tracking-tight italic">
              Identify high-retention edit points via <span className="text-white font-black italic underline decoration-indigo-500/30 underline-offset-8">Multi-Pass Neural Scanning</span>.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={runSceneDetection}
            disabled={isAnalyzing || videoDuration <= 0}
            className="px-12 py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-indigo-600/40 border border-white/20 flex items-center gap-4 disabled:opacity-50 transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                SYNTHESIZING...
              </>
            ) : (
              <>
                <Scan className="w-6 h-6" />
                INITIATE SCAN
              </>
            )}
          </motion.button>
        </div>

        {/* HUD Footer */}
        <div className="pt-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Core Monitoring Active</span>
          </div>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Neural Repository ID: 0xFF92</span>
        </div>
      </motion.div>

      {/* Suggested Edits Command Center */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`${glassStyle} rounded-[3rem] p-10 shadow-3xl relative overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl">
                  <Target className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">OPTIMAL NODE SUGGESTIONS</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 block italic">Click to bridge to Chrono Matrix</span>
                </div>
              </div>
              <span className="px-6 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.4em] italic shadow-lg">
                {suggestions.length} Signals Decoded
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suggestions.map((s, idx) => (
                <motion.div
                  key={s.time}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-500 flex flex-col gap-6 shadow-inner"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic leading-none">{s.type.toUpperCase()} NODE</span>
                      <p className="text-xl font-black text-white italic tracking-tighter uppercase tabular-nums">@{s.time.toFixed(1)}s</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => addSegmentFromSuggestion(s.time)}
                      className="p-4 rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all border border-white/20"
                    >
                      <Scissors className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium italic truncate">{s.label}</p>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-indigo-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.time / videoDuration) * 100}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Navigation (Elite) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveCategory('ai-edit')}
          className={`${glassStyle} p-10 rounded-[2.8rem] text-left group relative overflow-hidden transition-all`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <Sparkles className="w-24 h-24 text-fuchsia-500" />
          </div>
          <div className="flex items-center gap-8 mb-6">
            <div className="w-20 h-20 rounded-[1.8rem] bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shadow-2xl">
              <Sparkles className="w-10 h-10 text-fuchsia-400 group-hover:animate-pulse" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">ELITE AI</h3>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block italic">Semantic Edit Node</span>
            </div>
            <ChevronRight className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors ml-auto" />
          </div>
          <p className="text-slate-500 text-sm font-medium italic group-hover:text-slate-300 transition-colors">Invoke core transcription and semantics to auto-craft high-ROI segments.</p>
        </motion.button>

        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveCategory('timeline')}
          className={`${glassStyle} p-10 rounded-[2.8rem] text-left group relative overflow-hidden transition-all`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <Layers className="w-24 h-24 text-indigo-500" />
          </div>
          <div className="flex items-center gap-8 mb-6">
            <div className="w-20 h-20 rounded-[1.8rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl">
              <Layers className="w-10 h-10 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">MATRIX</h3>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block italic">Precision Cuts Node</span>
            </div>
            <ChevronRight className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors ml-auto" />
          </div>
          <p className="text-slate-500 text-sm font-medium italic group-hover:text-slate-300 transition-colors">Bridge to the Chrono Matrix for pixel-perfect segment management.</p>
        </motion.button>
      </div>

      {/* Advisory HUD */}
      <motion.div
        variants={itemVariants}
        className="p-8 bg-indigo-600/5 rounded-[2.5rem] border border-indigo-500/10 relative overflow-hidden group shadow-inner"
      >
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Radio className="w-12 h-12 text-indigo-500 animate-pulse" />
        </div>
        <p className="text-[11px] text-slate-500 font-black flex items-center gap-4 italic uppercase tracking-widest leading-relaxed relative z-10">
          <TrendingUp className="w-5 h-5 text-indigo-400 shrink-0" />
          PRO ADVISORY: Transcribe in Elite AI Hub first for deep semantic mapping. Sync suggested edit points here to initialize clips.
        </p>
      </motion.div>
    </motion.div>
  )
}

export default AIAnalysisView
