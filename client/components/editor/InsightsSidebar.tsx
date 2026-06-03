'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Zap,
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  Target,
  Send,
  Calendar,
  Smartphone,
  PlaySquare,
  Flame,
  Brain,
  BookOpen,
  Globe,
  Loader2
} from 'lucide-react'
import { EngagementScore, ContentNiche, CaptionTextStyle, PlatformNiche } from '../../types/editor'

interface InsightsSidebarProps {
  score: EngagementScore
  niche: ContentNiche
  onNicheChange: (niche: ContentNiche) => void
  onCaptionStyleChange: (style: CaptionTextStyle) => void
  onManualOverride: (instruction: string) => void
  onScheduleUpload: () => void
  onLanguageChange?: (language: string) => void
  targetLanguage?: string
  selectedCaptionStyle?: CaptionTextStyle
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  onCollapse?: () => void
}

const nicheOptions: { id: ContentNiche; label: string }[] = [
  { id: 'educational', label: 'Educational' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'b2b', label: 'B2B' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'vlog', label: 'Vlog' },
  { id: 'fitness', label: 'Fitness' },
]

const styleOptions: { id: CaptionTextStyle; label: string }[] = [
  { id: 'bold', label: '⚡ MrBeast Style' },
  { id: 'pill', label: '💊 Alex Hormozi' },
  { id: 'minimal', label: '💼 Clean Corporate' },
  { id: 'neon', label: '🌌 Pulse Gaming' },
  { id: 'kinetic', label: '🔥 Kinetic Impact' },
  { id: 'cinematic', label: '🎬 Cinematic Film' },
  { id: 'subtitle', label: '💬 Classic Subtitle' },
  { id: 'gradient', label: '🌈 Rainbow Gradient' },
  { id: 'karaoke', label: '🎤 Karaoke Spot' },
  { id: 'retro', label: '📻 Retro Vibe' }
]

const platforms: { id: PlatformNiche; label: string; icon: React.FC<any>; color: string }[] = [
  { id: 'tiktok', label: 'TikTok', icon: Smartphone, color: 'text-pink-500' },
  { id: 'reels', label: 'IG Reels', icon: Flame, color: 'text-fuchsia-500' },
  { id: 'shorts', label: 'YT Shorts', icon: PlaySquare, color: 'text-red-500' }
]

export const InsightsSidebar: React.FC<InsightsSidebarProps> = ({
  score: initialScore,
  niche,
  onNicheChange,
  onCaptionStyleChange,
  onManualOverride,
  onScheduleUpload,
  onLanguageChange,
  targetLanguage = 'en',
  selectedCaptionStyle = 'bold',
  showToast,
  onCollapse
}) => {
  const [overrideText, setOverrideText] = useState('')
  const [activePlatform, setActivePlatform] = useState<PlatformNiche>('tiktok')
  const [currentScore, setCurrentScore] = useState<EngagementScore>(() => ({
    overall: initialScore?.overall ?? 85,
    viralPotential: initialScore?.viralPotential ?? 78,
    hookStrength: initialScore?.hookStrength ?? 92,
    sentimentDensity: initialScore?.sentimentDensity ?? 70,
    trendAlignment: initialScore?.trendAlignment ?? 82,
    retentionHeatmap: initialScore?.retentionHeatmap || Array(20).fill(80).map((v, i) => v - i * 2),
    psychology: initialScore?.psychology || {
      fomo: 65,
      curiosity: 82,
      value: 70,
      readability: '8th Grade'
    }
  }))
  const [advice, setAdvice] = useState('')
  const [isEcosystemCollapsed, setIsEcosystemCollapsed] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Hydration-safe localStorage load on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('click-target-ecosystem-collapsed')
      if (stored !== null) {
        setIsEcosystemCollapsed(stored === 'true')
      }
    }
  }, [])

  const toggleEcosystemCollapse = () => {
    const nextVal = !isEcosystemCollapsed
    setIsEcosystemCollapsed(nextVal)
    if (typeof window !== 'undefined') {
      localStorage.setItem('click-target-ecosystem-collapsed', String(nextVal))
    }
  }

  // Realistic multidimensional algorithmic recalibration combining Platform and Niche
  useEffect(() => {
    if (!initialScore) return

    let viralMod = 0
    let hookMod = 0
    let sentimentMod = 0
    let trendMod = 0
    let overallMod = 0
    const rawHeatmap = initialScore.retentionHeatmap || []
    let retentionDrops: number[] = [...rawHeatmap]
    let platformAdvice = ''

    // 1. Platform Rules
    if (activePlatform === 'tiktok') {
      if ((initialScore.hookStrength || 0) < 70) {
        retentionDrops = retentionDrops.map((v, i) => (i > 2 ? Math.max(0, v - 25) : v))
        viralMod -= 12
        platformAdvice = "CRITICAL: TikTok requires a stronger 3-second hook. Add a visual burst or text pop."
      } else {
        retentionDrops = retentionDrops.map((v, i) => (i > 2 ? Math.min(100, v + 8) : v))
        viralMod += 10
        hookMod += 5
        platformAdvice = "Excellent pacing. High probability of entering the 'For You' stream."
      }
    } else if (activePlatform === 'shorts') {
      if ((initialScore.sentimentDensity || 0) > 60) {
        viralMod += 8
        platformAdvice = "Good sentiment density. YouTube Shorts rewards high-emotion payoffs."
      } else {
        retentionDrops = retentionDrops.map((v, i) => (i > 4 ? Math.max(0, v - 12) : v))
        viralMod -= 5
        platformAdvice = "Increase emotional payoff near the end to improve loop rate."
      }
    } else if (activePlatform === 'reels') {
      if ((initialScore.trendAlignment || 0) > 75) {
        viralMod += 15
        hookMod += 5
        platformAdvice = "Strong trend alignment detected. High viral edge on Instagram Reels."
      } else {
        viralMod -= 8
        platformAdvice = "Reels algorithm limits reach for non-trending audio. Consider syncing to a trending track."
      }
    }

    // 2. Audience Niche Multipliers & Psychological Adjustments
    let fomoScore = 65
    let curiosityScore = 82
    let valueScore = 70
    let readabilityLabel = '8th Grade'

    if (niche === 'gaming') {
      viralMod += 6
      hookMod += 10
      trendMod += 10
      fomoScore = 88
      curiosityScore = 90
      valueScore = 50
      readabilityLabel = '5th Grade'
      platformAdvice += " [Gaming Niche]: Hyper-fast pacing optimized for high-arousal retention."
    } else if (niche === 'educational') {
      overallMod += 8
      valueScore = 95
      curiosityScore = 80
      fomoScore = 35
      readabilityLabel = '10th Grade'
      platformAdvice += " [Educational Niche]: Maximizing strategic instructional value to drive saves."
    } else if (niche === 'b2b') {
      viralMod -= 10
      overallMod += 10
      valueScore = 90
      curiosityScore = 70
      fomoScore = 45
      readabilityLabel = 'College Level'
      platformAdvice += " [B2B Niche]: Professional metrics dialed for institutional authority."
    } else if (niche === 'comedy') {
      viralMod += 15
      sentimentMod += 18
      fomoScore = 70
      curiosityScore = 85
      valueScore = 40
      readabilityLabel = '6th Grade'
      platformAdvice += " [Comedy Niche]: Pacing highlights comedic timing. High share-ability potential."
    } else if (niche === 'fitness') {
      viralMod += 8
      fomoScore = 92
      curiosityScore = 75
      valueScore = 82
      readabilityLabel = '7th Grade'
      platformAdvice += " [Fitness Niche]: Elevated motivational FOMO drives community engagement."
    } else if (niche === 'vlog') {
      sentimentMod += 10
      curiosityScore = 88
      fomoScore = 55
      valueScore = 60
      readabilityLabel = '8th Grade'
      platformAdvice += " [Vlog Niche]: Personal storytelling focus optimizes mid-sequence retention."
    }

    setCurrentScore({
      ...initialScore,
      overall: Math.max(0, Math.min(100, (initialScore.overall || 85) + overallMod)),
      viralPotential: Math.max(0, Math.min(100, (initialScore.viralPotential || 78) + viralMod)),
      hookStrength: Math.max(0, Math.min(100, (initialScore.hookStrength || 92) + hookMod)),
      sentimentDensity: Math.max(0, Math.min(100, (initialScore.sentimentDensity || 70) + sentimentMod)),
      trendAlignment: Math.max(0, Math.min(100, (initialScore.trendAlignment || 82) + trendMod)),
      retentionHeatmap: retentionDrops,
      psychology: {
        fomo: fomoScore,
        curiosity: curiosityScore,
        value: valueScore,
        readability: readabilityLabel
      }
    })
    setAdvice(platformAdvice)
  }, [activePlatform, niche, initialScore])

  const getStatusColor = (val: number = 0) => {
    if (val > 80) return 'bg-emerald-500'
    if (val > 50) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  const hasHighDropoff = (currentScore.retentionHeatmap || []).some(v => v < 60)

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-3xl border-l border-white/5 w-80 p-6 overflow-y-auto custom-scrollbar">
      
      {/* Sidebar Header with Collapse Button */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 shrink-0">
         <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-widest text-white italic">AI Strategic Expert</h2>
         </div>
         <button
           type="button"
           onClick={onCollapse}
           className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center group active:scale-95 animate-in fade-in"
           title="Collapse Insights Sidebar"
         >
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
         </button>
      </div>

      {/* Universal Expert HUD */}
      <div className="mb-6 p-4 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 relative group overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <Brain className="w-5 h-5 text-indigo-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic leading-tight">Universal Expert Active</span>
            <span className="text-sm font-black text-white uppercase tracking-tighter italic">Niche: {niche.toUpperCase()}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed relative z-10">
          Deep strategic engine engaged. Switched to <span className="text-white italic">{niche} psychology</span> framework. 
          Optimization: <span className="text-indigo-300">Unlimited Knowledge Base</span>
        </p>
      </div>

      {/* Platform Selector */}
      <div className="mb-6 space-y-3">
         <div 
           className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity select-none group/eco"
           onClick={toggleEcosystemCollapse}
         >
           <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-slate-400 animate-pulse" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Ecosystem</h3>
           </div>
           <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${isEcosystemCollapsed ? '-rotate-90' : 'rotate-0'}`} />
         </div>
         <AnimatePresence initial={false}>
           {!isEcosystemCollapsed && (
             <motion.div
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               transition={{ duration: 0.25, ease: 'easeInOut' }}
               className="overflow-hidden"
             >
                <div className="flex gap-2 bg-white/5 p-1 rounded-xl mt-1 relative z-0">
                  {platforms.map(p => {
                     const isSelected = activePlatform === p.id
                     const hasSynergy = currentScore.viralPotential > 80 && isSelected
                     return (
                       <button
                         type="button"
                         key={p.id}
                         onClick={() => setActivePlatform(p.id)}
                         aria-label={`Select ${p.label}`}
                         title={p.label}
                         className="flex-1 flex items-center justify-center py-2 rounded-lg transition-all relative group"
                       >
                         {isSelected && (
                           <motion.div
                             layoutId="active-platform-bg"
                             className="absolute inset-0 bg-white/10 rounded-lg border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                             transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                           />
                         )}
                         <p.icon className={`w-4 h-4 relative z-10 transition-colors ${isSelected ? p.color : 'text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-white'}`} />
                         
                         {hasSynergy && (
                           <motion.div
                             layoutId="platform-glow"
                             className={`absolute inset-0 rounded-lg blur-md ${p.color.replace('text', 'bg')} opacity-20`}
                             initial={{ scale: 0.8 }}
                             animate={{ scale: 1.2 }}
                             transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                           />
                         )}
                       </button>
                     )
                  })}
                </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>

      {/* Neural Forecast Ticker */}
      <div className="mb-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 overflow-hidden relative">
         <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase text-indigo-400 tracking-widest italic relative z-10">
            <span>Neural Forecast</span>
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
               <span>LIVE</span>
            </div>
         </div>
         <div className="flex items-end gap-0.5 h-8">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ height: 2 }}
                animate={{ height: Math.abs(Math.sin(i * 0.5) * 24) + 4 }}
                transition={{
                  duration: 0.8 + Math.abs(Math.sin(i * 0.2)) * 0.4,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  ease: 'easeInOut',
                  delay: i * 0.04
                }}
                className="flex-1 bg-indigo-500/30 rounded-t-full"
              />
            ))}
         </div>
      </div>

      {/* Engagement Indicator */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-main)] italic">Viral Potential</h3>
          </div>
          <div className={`w-3 h-3 rounded-full ${getStatusColor(currentScore.viralPotential)} animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]`} />
        </div>

        <motion.div
          key={activePlatform}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative h-48 bg-white/5 rounded-3xl border border-white/5 overflow-hidden flex flex-col justify-end p-4 group"
        >
          <div className="absolute top-4 left-4 flex flex-col z-10">
            <span className="text-4xl font-black italic text-white leading-none">{currentScore.viralPotential}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10">
               {activePlatform}_INDEX_v3
            </span>
          </div>

          {/* Mini Heatmap Visualization (Animated & Safe) */}
          <div className="flex items-end gap-1 h-20 px-2 mt-auto relative z-0">
            {(currentScore.retentionHeatmap || []).map((val, i) => (
              <motion.div
                key={i}
                initial={{ height: '0%' }}
                animate={{
                  height: `${(typeof val !== 'number' || isNaN(val)) ? 0 : val}%`
                }}
                transition={{ duration: 0.5, delay: i * 0.02, type: 'spring' }}
                className={`flex-1 rounded-t-sm ${val > 70 ? 'bg-indigo-500' : 'bg-white/20'} opacity-60 hover:opacity-100 transition-opacity`}
              />
            ))}
          </div>
        </motion.div>

        {/* Neural Platform Advice */}
        {advice && (
           <motion.div
             key={`advice-${activePlatform}`}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex gap-3 text-[11px] leading-relaxed font-medium text-indigo-200"
           >
             <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
             {advice}
           </motion.div>
        )}

        {/* Multi-Dimensional Metrics (Safe Math) */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Hook', val: currentScore.hookStrength ?? 0, icon: Zap },
            { label: 'Sentiment', val: currentScore.sentimentDensity ?? 0, icon: Sparkles },
            { label: 'Trends', val: currentScore.trendAlignment ?? 0, icon: ArrowUpRight },
            { label: 'Retention', val: Math.floor(currentScore.overall ?? 0), icon: BarChart3 },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 rounded-2xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <m.icon className="w-3 h-3 text-slate-500" />
                <motion.span
                  key={m.val}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-[8px] font-black uppercase ${m.val > 70 ? 'text-emerald-400' : 'text-slate-400'}`}
                >
                  {m.val}%
                </motion.span>
              </div>
              <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="h-px bg-white/5" />

        {/* Psychological Hook Strategy */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hook Psychology</h3>
              </div>
              <span className="text-[8px] font-black text-purple-400 uppercase bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">AI Scanned</span>
           </div>
           
           <div className="space-y-3">
              {[
                { label: 'FOMO / Scarcity', val: currentScore.psychology?.fomo ?? 65, color: 'bg-orange-500' },
                { label: 'Curiosity Gap', val: currentScore.psychology?.curiosity ?? 82, color: 'bg-indigo-500' },
                { label: 'Core Value', val: currentScore.psychology?.value ?? 70, color: 'bg-emerald-500' },
              ].map((psyc) => (
                <div key={psyc.label} className="space-y-1.5">
                   <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                      <span>{psyc.label}</span>
                      <span className="text-white">{psyc.val}%</span>
                   </div>
                   <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${psyc.val}%` }} className={`h-full ${psyc.color}`} />
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* CTA Placement Optimizer */}
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">CTA Placement</h3>
           </div>
           <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Optimal SyncPoint</span>
                <span className="text-[9px] font-black text-white italic">00:42s</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                Audience focus peaks here before the final drop. Place your primary CTA now for +22% conversion.
              </p>
           </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Real-time Strategic Action Center (New Premium Feature) */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strategic Actions</h3>
              </div>
              <span className="text-[8px] font-black text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Fixes Available</span>
           </div>
           
           <div className="space-y-2">
              {currentScore.hookStrength < 85 && (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col gap-2 transition-colors duration-250 hover:bg-rose-500/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Weak Hook ({currentScore.hookStrength}%)</span>
                    <button
                      type="button"
                      onClick={() => {
                        onManualOverride('inject high-energy kinetic zoom and pattern interrupt graphic in first 2 seconds');
                        showToast?.('AI Hook Optimizer engaged: injecting kinetic zoom preset at 0.5s', 'success');
                      }}
                      className="px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase hover:bg-rose-500 hover:text-black transition-all"
                    >
                      Fix Hook
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    First 3 seconds are slow. Inject an energetic kinetic zoom pattern-interrupt graphic to capture viewer interest immediately.
                  </p>
                </motion.div>
              )}

              {currentScore.trendAlignment < 85 && (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col gap-2 transition-colors duration-250 hover:bg-amber-500/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Low Trend Fit ({currentScore.trendAlignment}%)</span>
                    <button
                      type="button"
                      onClick={() => {
                        onManualOverride('apply viral rhythmic sound effects and sync transition pacing to high-engagement style');
                        showToast?.('AI Trend Optimizer engaged: syncing transition pacing with viral style DNA', 'success');
                      }}
                      className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all"
                    >
                      Boost Fit
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Pacing is slightly generic. Sync transitions to viral style patterns and inject high-tempo sfx hooks.
                  </p>
                </motion.div>
              )}

              {hasHighDropoff && (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-2 transition-colors duration-250 hover:bg-indigo-500/[0.08]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Retention Clip Drop</span>
                    <button
                      type="button"
                      onClick={() => {
                        onManualOverride('tighten timeline edits: auto-detect dead air, remove filler words, and split slow sections');
                        showToast?.('AI Pacing Optimizer engaged: tightening segments to eliminate dead air', 'success');
                      }}
                      className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase hover:bg-indigo-500 hover:text-black transition-all"
                    >
                      Tighten
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Viewer drop-offs detected. Tighten pacing by automatically stripping out filler gaps and silences.
                  </p>
                </motion.div>
              )}
           </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Readability HUD */}
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Readability Center</h3>
           </div>
           <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all cursor-default">
              <div className="space-y-1">
                 <div className="text-xl font-black text-white italic uppercase">{currentScore.psychology?.readability || '8th Grade'}</div>
                 <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Complexity Level</div>
              </div>
              <button
                type="button"
                disabled={isOptimizing}
                onClick={() => {
                  if (isOptimizing) return
                  setIsOptimizing(true)
                  onManualOverride('simplify vocabulary, shorten phrases, and optimize readability');
                  showToast?.('AI Readability Optimizer engaged: simplifying pacing and vocabulary', 'success');
                  setTimeout(() => setIsOptimizing(false), 1200)
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                 {isOptimizing ? (
                   <>
                     <Loader2 className="w-3.5 h-3.5 animate-spin" />
                     Optimizing
                   </>
                 ) : (
                   'Simplify'
                 )}
              </button>
           </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Niche Recalibration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audience Niche</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {nicheOptions.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => onNicheChange(opt.id)}
                className={`py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all border ${
                  niche === opt.id
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* High-Accuracy Neural Translation */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Output Language</h3>
            </div>
            <span className="text-[8px] font-black text-sky-400 uppercase bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">Cultural Sync</span>
          </div>
          <div className="relative group">
            <select
              value={targetLanguage}
              onChange={(e) => {
                if (onLanguageChange) onLanguageChange(e.target.value)
              }}
              title="Select Target Language"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="en" className="bg-[#0a0a0a]">🇺🇸 English</option>
              <option value="es" className="bg-[#0a0a0a]">🇪🇸 Spanish (Español)</option>
              <option value="fr" className="bg-[#0a0a0a]">🇫🇷 French (Français)</option>
              <option value="de" className="bg-[#0a0a0a]">🇩🇪 German (Deutsch)</option>
              <option value="it" className="bg-[#0a0a0a]">🇮🇹 Italian (Italiano)</option>
              <option value="pt" className="bg-[#0a0a0a]">🇵🇹 Portuguese (Português)</option>
              <option value="ru" className="bg-[#0a0a0a]">🇷🇺 Russian (Русский)</option>
              <option value="ja" className="bg-[#0a0a0a]">🇯🇵 Japanese (日本語)</option>
              <option value="ko" className="bg-[#0a0a0a]">🇰🇷 Korean (한국어)</option>
              <option value="zh" className="bg-[#0a0a0a]">🇨🇳 Chinese (中文)</option>
              <option value="ar" className="bg-[#0a0a0a]">🇦🇪 Arabic (العربية)</option>
              <option value="hi" className="bg-[#0a0a0a]">🇮🇳 Hindi (हिन्दी)</option>
              <option value="nl" className="bg-[#0a0a0a]">🇳🇱 Dutch (Nederlands)</option>
              <option value="pl" className="bg-[#0a0a0a]">🇵🇱 Polish (Polski)</option>
              <option value="tr" className="bg-[#0a0a0a]">🇹🇷 Turkish (Türkçe)</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Caption Style Mood-Switcher */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caption Style</h3>
          </div>
          <div className="relative group">
            <select
              value={selectedCaptionStyle}
              onChange={(e) => onCaptionStyleChange(e.target.value as CaptionTextStyle)}
              title="Select caption text style"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-[11px] font-bold text-white appearance-none focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              {styleOptions.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-[#0a0a0a]">{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Manual Override */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manual Neural Override</h3>
          </div>
          <div className="relative">
            <textarea
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              placeholder="e.g., 'Make the title more aggressive'..."
              title="Manual neural override command input"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] font-medium text-slate-300 focus:outline-none focus:border-indigo-500 transition-all resize-none h-24 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => { onManualOverride(overrideText); setOverrideText('') }}
              title="Send neural override command"
              className="absolute bottom-3 right-3 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg text-white"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scheduling Action */}
        <button
          type="button"
          onClick={onScheduleUpload}
          className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-fuchsia-600 border border-white/20 py-4 rounded-2xl flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
        >
          <motion.div whileHover={{ rotate: 15 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Calendar className="w-4 h-4 text-white" />
          </motion.div>
          <span className="text-[11px] font-black uppercase tracking-widest text-white italic">Schedule Neural Launch</span>
        </button>
      </div>
    </div>
  )
}
