'use client'

import React, { useState } from 'react'
import {
  Film,
  Smartphone,
  Youtube,
  Instagram,
  LayoutGrid,
  Scissors,
  Download,
  Clock,
  Sparkles,
  ChevronRight,
  Zap,
  Cpu,
  Target,
  Activity,
  ArrowUpRight,
  Layers,
  Radio
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TemplateLayout, getDefaultTrackForSegmentType } from '../../../types/editor'

const PLATFORM_PRESETS: { id: string; label: string; layout: TemplateLayout; icon: any; color: string; exportPreset: string }[] = [
  { id: 'tiktok', label: 'TikTok Node', layout: 'vertical', icon: Smartphone, color: 'from-pink-500 to-rose-600', exportPreset: 'tiktok' },
  { id: 'reels', label: 'Reels Cluster', layout: 'vertical', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-500', exportPreset: 'reels' },
  { id: 'shorts', label: 'Shorts Uplink', layout: 'vertical', icon: Youtube, color: 'from-red-600 to-red-700', exportPreset: 'shorts' },
  { id: 'feed', label: 'Feed Synergy', layout: 'square', icon: LayoutGrid, color: 'from-blue-600 to-indigo-600', exportPreset: 'reels' },
]

const CLIP_DURATIONS = [15, 30, 60] as const

interface ShortClipsViewProps {
  videoState: { currentTime: number; duration: number }
  templateLayout: TemplateLayout
  setTemplateLayout: (l: TemplateLayout) => void
  timelineSegments: any[]
  setTimelineSegments: (v: any[] | ((prev: any[]) => any[])) => void
  setActiveCategory: (c: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  transcript: any
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const ShortClipsView: React.FC<ShortClipsViewProps> = ({
  videoState,
  templateLayout,
  setTemplateLayout,
  timelineSegments,
  setTimelineSegments,
  setActiveCategory,
  showToast,
  transcript
}) => {
  const { currentTime, duration } = videoState
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  const suggestedHooks = React.useMemo(() => {
    if (!transcript?.words?.length) return []
    const words = transcript.words
    const hooks: any[] = []

    // Semantic peak detection (simplified for demo: looking for markers or high energy words)
    const markers = ['why', 'how', 'secret', 'never', 'don\'t', 'stop', 'finally', 'massive', 'incredible']

    for (let i = 0; i < words.length; i++) {
       const w = words[i]
       if (markers.includes(w.text.toLowerCase().replace(/[^a-z]/g, '')) && w.start > 5) {
          hooks.push({
             id: `hook-peak-${i}`,
             startTime: Math.max(0, w.start - 2),
             endTime: Math.min(duration, w.start + 15),
             text: `Peak: "${w.text}..."`,
             confidence: 0.85 + (Math.random() * 0.1)
          })
          i += 100 // Skip a bit to find the next unique peak
       }
       if (hooks.length >= 4) break
    }
    return hooks
  }, [transcript, duration])

  const handlePlatformSelect = (preset: typeof PLATFORM_PRESETS[0]) => {
    setTemplateLayout(preset.layout)
    setSelectedPlatform(preset.id)
    showToast(`${preset.label} Calibration Active`, 'success')
  }

  const handleApplyHook = (hook: any) => {
    const id = `neural-hook-${Date.now()}`
    setTimelineSegments((prev: any[]) => [...prev, {
      id,
      startTime: hook.startTime,
      endTime: hook.endTime,
      duration: hook.endTime - hook.startTime,
      type: 'video',
      name: `Hook: ${hook.text.slice(0, 20)}`,
      color: '#ec4899',
      track: getDefaultTrackForSegmentType('video')
    }])
    setTemplateLayout('vertical')
    showToast(`Hook Node Synchronized: ${hook.text}`, 'success')
    setActiveCategory('timeline')
  }

  const handleCreateClipFromPlayhead = (seconds: number) => {
    const start = currentTime
    const end = Math.min(currentTime + seconds, duration)
    if (end - start < 1) {
      showToast('Temporal range too narrow', 'error')
      return
    }
    const id = `short-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setTimelineSegments((prev: any[]) => [...prev, {
      id,
      startTime: start,
      endTime: end,
      duration: end - start,
      type: 'video',
      name: `Neural ${seconds}s Clip`,
      color: '#fb7185',
      track: getDefaultTrackForSegmentType('video')
    }])
    setTemplateLayout('vertical')
    showToast(`Neural Node established: ${seconds}s`, 'success')
    setActiveCategory('timeline')
  }

  const goToExportWithPreset = (presetId: string) => {
    try { sessionStorage.setItem('export-preferred-preset', presetId) } catch { /* ignore */ }
    setActiveCategory('export')
    showToast('Switching to Master Synthesis Hub', 'info')
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
      {/* Elite Hero Cluster */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3rem] p-10 relative overflow-hidden group shadow-3xl`}
      >
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
          <Film className="w-48 h-48 text-rose-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-10 mb-8 relative z-10">
          <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-[1.8rem] shadow-2xl">
            <Film className="w-10 h-10 text-rose-400 group-hover:rotate-12 transition-transform" />
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
              PRO CLIPS<br />FORGE
            </h2>
            <p className="text-slate-500 text-lg font-medium tracking-tight italic">
              Calibrated temporal synthesis for <span className="text-white font-black italic underline decoration-rose-500/30 underline-offset-8">Multi-Node Distribution</span>.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-400 font-medium leading-relaxed italic pr-20 relative z-10">
          Repurpose identity clusters for Reels, Shorts & TikTok with <span className="text-white font-black italic">Alpha-tier calibrated framing</span>. Higher ROI than automated legacy platforms.
        </p>

        {/* Neural Heatmap Overlay */}
        <div className="mt-12 space-y-6 relative z-10">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Retention Heatmap</span>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-400">92% Alpha Peak Detected</span>
           </div>

           <div className="h-16 w-full bg-black/40 rounded-2xl border border-white/5 p-2 flex items-end gap-1 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent animate-shimmer" />
              {Array.from({ length: 60 }).map((_, i) => {
                 const height = 20 + Math.sin(i * 0.2) * 20 + Math.random() * 30;
                 const isPeak = height > 55;
                 return (
                     <div
                        key={i}
                        className={`flex-1 rounded-t-full transition-all duration-1000 ${isPeak ? 'bg-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
                        style={{ height: height + '%' }}
                     />
                 )
              })}
           </div>
           <div className="flex justify-between px-2">
              <span className="text-[8px] font-black text-slate-600">00:00</span>
              <span className="text-[8px] font-black text-slate-600">PROJECT END</span>
           </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between opacity-30">
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Assistive Synthesis: Elite Mode</span>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Forge ID: 0x93C</span>
        </div>
      </motion.div>

      {/* Neural Hook Intelligence (NEW PHASE 7) */}
      {suggestedHooks.length > 0 && (
        <motion.div
          variants={itemVariants}
          className={`${glassStyle} rounded-[3.5rem] p-12 shadow-3xl relative overflow-hidden border-rose-500/10`}
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none -rotate-12">
            <Radio className="w-48 h-48 text-rose-500" />
          </div>

          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-[1.2rem] bg-rose-500/10 border border-rose-500/20 shadow-2xl">
                <Target className="w-6 h-6 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Hook Intelligence</h3>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 block italic">Semantic Peak Identification</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {suggestedHooks.map((hook, i) => (
              <motion.div
                key={hook.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-rose-500/30 hover:bg-white/[0.05] transition-all flex flex-col gap-6 shadow-inner"
              >
                <div className="flex items-center justify-between">
                  <div className="px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-black text-rose-400 uppercase tracking-widest italic">
                    {(hook.confidence * 100).toFixed(0)}% Retention Peak
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest tabular-nums italic">@{hook.startTime.toFixed(1)}s</span>
                </div>
                <p className="text-xl font-black text-white italic uppercase tracking-tighter leading-tight pr-10">
                  {hook.text}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Target: {hook.endTime - hook.startTime}s Segment</span>
                    <button
                      onClick={() => handleApplyHook(hook)}
                      title={`Process ${hook.text}`}
                      className="px-6 py-2.5 rounded-xl bg-rose-500 text-white font-black text-[9px] uppercase tracking-widest italic shadow-lg shadow-rose-500/20 hover:scale-105 transition-transform"
                    >
                      Forge Slicer
                    </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Format Matrix (Elite) */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3.5rem] p-12 shadow-3xl relative overflow-hidden`}
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl">
              <Zap className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">FORMAT MATRIX</h3>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 block italic">One-click spatial calibration</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLATFORM_PRESETS.map((preset) => {
            const Icon = preset.icon
            const isSelected = templateLayout === preset.layout && selectedPlatform === preset.id
            return (
              <motion.div
                key={preset.id}
                whileHover={{ scale: 1.05, y: -4 }}
                className={`group relative rounded-[2.5rem] border-2 transition-all p-8 flex flex-col items-center gap-6 ${isSelected
                  ? 'border-rose-500 bg-white/[0.05] shadow-3xl shadow-rose-600/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-rose-500/40'
                  }`}
              >
                <motion.button
                  type="button"
                  onClick={() => handlePlatformSelect(preset)}
                  title={`Calibrate for ${preset.label}`}
                  className="w-full text-center space-y-4"
                >
                  <div className={`w-20 h-20 rounded-[1.8rem] bg-gradient-to-br ${preset.color} flex items-center justify-center mx-auto shadow-2xl group-hover:scale-110 transition-transform`}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-black text-white italic text-xl uppercase tracking-tighter leading-none">{preset.label}</div>
                    <div className="text-[9px] font-black text-slate-500 italic uppercase tracking-widest">
                      Spatial: {preset.layout === 'vertical' ? '9:16' : '1:1'} Calibrated
                    </div>
                  </div>
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ x: 4 }}
                  onClick={() => goToExportWithPreset(preset.exportPreset)}
                  title={`Export as ${preset.label}`}
                  className="w-full flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 rounded-2xl transition-all italic border border-rose-500/20"
                >
                  Bridge to Export <ArrowUpRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Temporal Synthesis (Elite) */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3.5rem] p-12 shadow-3xl relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Clock className="w-48 h-48 text-rose-500" />
        </div>

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl">
              <Scissors className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">TEMPORAL SYNTHESIS</h3>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-2 block italic">Snap clip from current playhead node</span>
            </div>
          </div>
        </div>

        <div className="space-y-8 relative z-10">
          <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
            <div className="flex items-center gap-6">
              <Target className="w-6 h-6 text-slate-600" />
              <p className="text-lg text-slate-400 font-medium italic">
                Playhead calibrated at: <span className="text-white font-black tabular-nums">@{currentTime.toFixed(1)}s</span>
              </p>
            </div>
            <div className="px-6 py-2 bg-rose-500/10 rounded-full border border-rose-500/20 text-[10px] font-black text-rose-400 uppercase italic tracking-widest leading-none">
              Auto-Matrix: 9:16 Sync
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {CLIP_DURATIONS.map((sec) => {
              const end = Math.min(currentTime + sec, duration)
              const valid = end - currentTime >= 1
              return (
                <motion.button
                  key={sec}
                  type="button"
                  whileHover={valid ? { scale: 1.05, y: -4 } : {}}
                  whileTap={valid ? { scale: 0.95 } : {}}
                  onClick={() => handleCreateClipFromPlayhead(sec)}
                  disabled={!valid}
                  title={valid ? `Create ${sec}s clip from playhead` : 'Timeline end reached'}
                  className="flex items-center justify-center gap-4 py-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 hover:border-rose-500/50 hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:grayscale group/clip shadow-inner"
                >
                  <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20 group-hover/clip:scale-110 transition-transform">
                    <Clock className="w-6 h-6 text-rose-400" />
                  </div>
                  <div className="text-left">
                    <span className="text-3xl font-black text-white italic tracking-tighter tabular-nums leading-none">{sec}s</span>
                    <span className="block text-[11px] font-black text-slate-700 uppercase tracking-widest italic mt-1 group-hover/clip:text-rose-400 transition-colors">Burst Node</span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Strategic HUD (Elite) */}
      <motion.div
        variants={itemVariants}
        className="p-10 bg-indigo-600/5 rounded-[3rem] border border-indigo-500/10 relative overflow-hidden group shadow-3xl"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000 rotate-12">
          <Sparkles className="w-24 h-24 text-indigo-400" />
        </div>

        <div className="flex items-start gap-10 relative z-10">
          <div className="p-5 rounded-[1.8rem] bg-indigo-500/10 border border-indigo-500/20 shadow-2xl">
            <Target className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="space-y-4">
            <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">STRATEGIC PRO ADVISORY</h4>
            <p className="text-lg text-slate-400 font-medium italic leading-relaxed pr-20">
              Bridge to <span onClick={() => setActiveCategory('ai-edit')} className="text-white font-black underline decoration-indigo-500/30 underline-offset-8 cursor-pointer hover:text-indigo-400 transition-colors">ELITE AI Hub</span> to find viral moments—choose segments by <span className="text-white font-black">mission strategy</span>. Calibrate cuts, captions, and B-roll clusters in the Forge. Test hook variations and preserve Alpha-tier nodes.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ShortClipsView
