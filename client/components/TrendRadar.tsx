'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Zap, Activity, Target, ChevronDown, ChevronUp, Sparkles, TrendingUp, Layers } from 'lucide-react'

interface TrendAlert {
  id: string
  platform: string
  niche: string
  topic: string
  urgency: 'high' | 'medium' | 'low'
  message: string
  hashtags: string[]
  contentSuggestion: string
}

interface TrendingFormat {
  format: string
  description: string
  engagement_multiplier: number
  longevity: string
}

interface TrendRadarProps {
  niche?: string
  platforms?: string[]
  onCreateContent?: (topic: string) => void
  className?: string
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵', instagram_reels: '📸', youtube_shorts: '▶️',
  linkedin: '💼', twitter: '🐦', facebook: '👥'
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
}

export default function TrendRadar({ niche = 'general', platforms = ['tiktok', 'instagram_reels'], onCreateContent, className = '' }: TrendRadarProps) {
  const [alerts, setAlerts] = useState<TrendAlert[]>([])
  const [formats, setFormats] = useState<TrendingFormat[]>([])
  const [activePlatform, setActivePlatform] = useState(platforms[0])
  const [loading, setLoading] = useState(true)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const loadTrendData = async () => {
    setLoading(true)
    try {
      const [alertRes, formatRes] = await Promise.all([
        fetch(`/api/intelligence/trend-alerts?niche=${niche}&platforms=${platforms.join(',')}`),
        fetch(`/api/intelligence/trending-formats/${activePlatform}`)
      ])
      const [alertData, formatData] = await Promise.all([alertRes.json(), formatRes.json()])
      if (alertData.success) setAlerts(alertData.alerts || [])
      if (formatData.success) setFormats(formatData.formats || [])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrendData()
  }, [niche, activePlatform])

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`${glassStyle} rounded-[3rem] overflow-hidden ${className} p-10 space-y-10`}
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-6">
          <div className="p-5 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 shadow-xl shadow-indigo-600/5">
            <Radio className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">TREND RADAR <span className="text-indigo-500">2.0</span></h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic pl-1">Neural Niche Surveillance: {niche}</p>
          </div>
        </div>

        {alerts.some(a => a.urgency === 'high') && (
          <div className="flex items-center gap-4 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl shadow-xl shadow-rose-600/5 animate-pulse">
            <Zap className="w-4 h-4 text-rose-500" />
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{alerts.filter(a => a.urgency === 'high').length} CRITICAL ANOMALIES DETECTED</span>
          </div>
        )}
      </div>

      {/* PLATFORM SELECTOR */}
      <div className="flex flex-wrap gap-3">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
              activePlatform === p 
                ? 'bg-white text-black border-white shadow-xl' 
                : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/20'
            }`}
          >
            {PLATFORM_ICONS[p]} {p.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-50">
             <Activity className="w-10 h-10 text-indigo-500 animate-spin" />
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scanning Neural Pathways...</span>
          </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* LEFT: ALERTS */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Viral Signal Matrix</h3>
            </div>
            
            <div className="space-y-4">
               {alerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`group cursor-pointer rounded-[2rem] border transition-all overflow-hidden ${
                      expandedAlert === alert.id 
                        ? 'bg-white/[0.06] border-white/20 shadow-2xl p-8' 
                        : 'bg-white/[0.02] border-white/5 hover:border-indigo-500/30 p-6'
                    }`}
                    onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                  >
                     <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                           <div className={`w-3 h-3 rounded-full shadow-lg ${
                              alert.urgency === 'high' ? 'bg-rose-500 shadow-rose-500/50' : 
                              alert.urgency === 'medium' ? 'bg-amber-500 shadow-amber-500/50' : 
                              'bg-emerald-500 shadow-emerald-500/50'
                           }`} />
                           <div className="space-y-1">
                              <h4 className="text-sm font-black text-white uppercase italic tracking-tight">{alert.topic}</h4>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{alert.platform.replace('_', ' ')} · {alert.urgency} URGENCY</p>
                           </div>
                        </div>
                        {expandedAlert === alert.id ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                     </div>

                     <AnimatePresence>
                        {expandedAlert === alert.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pt-6 space-y-6"
                          >
                             <div className="p-5 bg-black/40 rounded-2xl border border-white/5 italic">
                                <p className="text-[12px] text-indigo-200 font-medium leading-relaxed">
                                   <Sparkles className="w-3 h-3 inline mr-2 mb-1" />
                                   {alert.contentSuggestion}
                                </p>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                {alert.hashtags.map(h => (
                                  <span key={h} className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-full text-[9px] font-black text-slate-400 uppercase italic">#{h}</span>
                                ))}
                             </div>
                             {onCreateContent && (
                               <button
                                 onClick={(e) => { e.stopPropagation(); onCreateContent(alert.topic); }}
                                 className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                               >
                                 ⚡ INITIALIZE CONTENT SEQUENCE
                               </button>
                             )}
                          </motion.div>
                        )}
                     </AnimatePresence>
                  </motion.div>
                ))}
            </div>
          </div>

          {/* RIGHT: FORMATS */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Engagement Architecture</h3>
            </div>

            <div className="space-y-4">
              {formats.map((fmt, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-emerald-500/30 transition-all hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-2xl font-black text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors uppercase italic tracking-tighter">#{i+1}</div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-white uppercase tracking-tight">{fmt.format}</h4>
                      <p className="text-[10px] font-medium text-slate-500 max-w-[200px]">{fmt.description}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm font-black text-emerald-400 italic">+{Math.round((fmt.engagement_multiplier - 1) * 100)}%</div>
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">{fmt.longevity} ROI</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI PREDICTION CARD */}
            <div className="p-8 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-[2.5rem] relative overflow-hidden group/ai">
               <Layers className="absolute -right-10 -bottom-10 w-40 h-40 text-indigo-500/5 group-hover/ai:rotate-12 transition-transform duration-700" />
               <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                     <Cpu className="w-5 h-5 text-indigo-400" />
                     <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Neural Projection</span>
                  </div>
                  <p className="text-xs text-white/60 font-medium leading-relaxed italic">
                    Based on current velocity, {activePlatform.replace('_', ' ')} is trending towards long-form educational hybrids. Recommendation: Deploy authentic storytelling nodes within next 48h.
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

const Cpu = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
