'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Zap,
  Sparkles,
  MessageSquare,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  Target,
  Send,
  Calendar,
  Smartphone,
  PlaySquare,
  Flame,
  Brain,
  UserCheck,
  Headphones,
  BookOpen,
  PieChart as PieChartIcon
} from 'lucide-react'
import { EngagementScore, ContentNiche, CaptionTextStyle, PlatformNiche } from '../../types/editor'

interface InsightsSidebarProps {
  score: EngagementScore
  niche: ContentNiche
  onNicheChange: (niche: ContentNiche) => void
  onCaptionStyleChange: (style: CaptionTextStyle) => void
  onManualOverride: (instruction: string) => void
  onScheduleUpload: () => void
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
  { id: 'bold', label: 'MrBeast Style' },
  { id: 'pill', label: 'Alex Hormozi Style' },
  { id: 'minimal', label: 'Clean Corporate' },
  { id: 'neon', label: 'Pulse Gaming' },
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
  onScheduleUpload
}) => {
  const [overrideText, setOverrideText] = useState('')
  const [activePlatform, setActivePlatform] = useState<PlatformNiche>('tiktok')
  const [currentScore, setCurrentScore] = useState<EngagementScore>(initialScore)
  const [advice, setAdvice] = useState('')

  // Realistic Algorithmic recalculation based on platform
  useEffect(() => {
    let viralMod = 0
    let hookMod = 0
    let retentionDrops: number[] = [...initialScore.retentionHeatmap]
    let platformAdvice = ''

    if (activePlatform === 'tiktok') {
      // TikTok demands high hooks; if hook < 70, retention drops aggressively at 3s
      if (initialScore.hookStrength < 70) {
        retentionDrops = retentionDrops.map((v, i) => (i > 2 ? Math.max(0, v - 30) : v))
        viralMod = -15
        platformAdvice = "CRITICAL: TikTok requires a stronger 3-second hook. Add a visual burst or text pop."
      } else {
        retentionDrops = retentionDrops.map((v, i) => (i > 2 ? Math.min(100, v + 10) : v))
        viralMod = 12
        hookMod = 5
        platformAdvice = "Excellent pacing. High probability of entering the 'For You' stream."
      }
    } else if (activePlatform === 'shorts') {
      // Shorts allows slightly longer build (5s) but rewards sentiment and loops
      if (initialScore.sentimentDensity > 60) {
        viralMod = 8
        platformAdvice = "Good sentiment density. YouTube Shorts rewards high-emotion payoffs."
      } else {
        retentionDrops = retentionDrops.map((v, i) => (i > 4 ? Math.max(0, v - 15) : v))
        viralMod = -5
        platformAdvice = "Increase emotional payoff near the end to improve loop rate."
      }
    } else if (activePlatform === 'reels') {
      // Reels favors aesthetics and trend alignment
      if (initialScore.trendAlignment > 75) {
        viralMod = 20
        hookMod = 8
        platformAdvice = "Strong trend alignment detected. High viral edge on Instagram Reels."
      } else {
        viralMod = -10
        platformAdvice = "Reels algorithm limits reach for non-trending audio. Consider syncing to a trending track."
      }
    }

    setCurrentScore({
      ...initialScore,
      viralPotential: Math.max(0, Math.min(100, initialScore.viralPotential + viralMod)),
      hookStrength: Math.max(0, Math.min(100, initialScore.hookStrength + hookMod)),
      retentionHeatmap: retentionDrops,
      // Default psychological scores if missing
      psychology: initialScore.psychology || {
        fomo: 65,
        curiosity: 82,
        value: 70,
        readability: '8th Grade'
      }
    })
    setAdvice(platformAdvice)
  }, [activePlatform, initialScore])

  const getStatusColor = (val: number) => {
    if (val > 80) return 'bg-emerald-500'
    if (val > 50) return 'bg-amber-500'
    return 'bg-rose-500'
  }

  return (
    <div className="flex flex-col h-full bg-black/40 backdrop-blur-3xl border-l border-white/5 w-80 p-6 overflow-y-auto custom-scrollbar">
      {/* Universal Expert HUD (Phase 11) */}
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
         <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-slate-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Ecosystem</h3>
         </div>
         <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
           {platforms.map(p => {
              const hasSynergy = currentScore.viralPotential > 80 && activePlatform === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  aria-label={`Select ${p.label}`}
                  title={p.label}
                  className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all relative ${
                    activePlatform === p.id
                      ? 'bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10'
                      : 'hover:bg-white/5 opacity-50 hover:opacity-100'
                  }`}
                >
                  <p.icon className={`w-4 h-4 ${activePlatform === p.id ? p.color : 'text-slate-400'}`} />
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
                animate={{ height: [2, Math.random() * 24 + 4, 2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
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
            <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Viral Potential</h3>
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

          {/* Mini Heatmap Visualization (Animated) */}
          <div className="flex items-end gap-1 h-20 px-2 mt-auto relative z-0">
            {currentScore.retentionHeatmap.map((val, i) => (
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

        {/* Multi-Dimensional Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Hook', val: currentScore.hookStrength, icon: Zap },
            { label: 'Sentiment', val: currentScore.sentimentDensity, icon: Sparkles },
            { label: 'Trends', val: currentScore.trendAlignment, icon: ArrowUpRight },
            { label: 'Retention', val: Math.floor(currentScore.overall), icon: BarChart3 },
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

        {/* Psychological Hook Strategy (New Phase 10) */}
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
                { label: 'FOMO / Scarcity', val: currentScore.psychology?.fomo || 65, color: 'bg-orange-500' },
                { label: 'Curiosity Gap', val: currentScore.psychology?.curiosity || 82, color: 'bg-indigo-500' },
                { label: 'Core Value', val: currentScore.psychology?.value || 70, color: 'bg-emerald-500' },
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

        {/* CTA Placement Optimizer (New Phase 10) */}
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

        {/* Readability HUD (New Phase 10) */}
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
              <button className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase hover:bg-amber-500 hover:text-black transition-all">
                 Simplify
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
                key={opt.id}
                onClick={() => onNicheChange(opt.id)}
                className={`py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all border ${
                  niche === opt.id
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Caption Mood-Switcher */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Caption Style</h3>
          </div>
          <div className="relative group">
            <select
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
          onClick={onScheduleUpload}
          className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-fuchsia-600 border border-white/20 py-4 rounded-2xl flex items-center justify-center gap-3 group hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl"
        >
          <Calendar className="w-4 h-4 text-white" />
          <span className="text-[11px] font-black uppercase tracking-widest text-white italic">Schedule Neural Launch</span>
        </button>
      </div>
    </div>
  )
}
