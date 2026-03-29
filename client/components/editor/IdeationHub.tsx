'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Search,
  Zap,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  Maximize2,
  Lock,
  SearchCode,
  Globe,
  PieChart
} from 'lucide-react'

const glassStyle = "backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl"

interface ContentGap {
  niche: string
  demand: number
  supply: number
  opportunity: string
}

const gaps: ContentGap[] = [
  { niche: 'AI Workflow Ops', demand: 92, supply: 12, opportunity: 'Huge underserved technical audience' },
  { niche: 'Personal Finance for Gen Alpha', demand: 78, supply: 45, opportunity: 'Fast growing interest, low quality content' },
  { niche: 'No-Code Agency Scaling', demand: 85, supply: 22, opportunity: 'B2B high-ticket potential' },
]

export default function IdeationHub() {
  const [activeTab, setActiveTab] = useState<'gaps' | 'forcing' | 'autopsy'>('gaps')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [autopsyData, setAutopsyData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAutopsy = async () => {
    setIsAnalyzing(true)
    // Simulation of heavy neural analysis
    setTimeout(() => {
      setAutopsyData({
        hook: 'Visual pattern interrupt at 1.2s',
        pacing: '16 cuts/minute (Top 1% intensity)',
        psychology: 'FOMO + Logic-Defying Visuals',
        score: 96
      })
      setIsAnalyzing(false)
    }, 2500)
  }

  return (
    <div className="flex flex-col gap-10 py-10">
      {/* Header Area */}
      <div className="flex items-end justify-between px-2">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
            <Brain size={12} />
            Strategic Nerve Center
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">
            IDEATION HUB
          </h1>
        </div>

        {/* Tab Control */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/10">
          {(['gaps', 'forcing', 'autopsy'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              {tab === 'gaps' ? 'Content Gaps' : tab === 'forcing' ? 'Format Forcing' : 'Autopsy'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'gaps' && (
          <motion.div
            key="gaps"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-8">
              <div className={`${glassStyle} p-10 rounded-[3rem] relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:rotate-12 transition-transform">
                  <PieChart size={200} />
                </div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-black italic text-white uppercase">Content Gap Analysis</h2>
                </div>

                <div className="space-y-4">
                  {gaps.map((gap, i) => (
                    <div key={i} className="flex items-center gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black italic text-white uppercase">{gap.niche}</span>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10">
                            +{(gap.demand - gap.supply)}% Potential
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold">{gap.opportunity}</p>
                        <div className="flex items-center gap-4 mt-4">
                           <div className="flex-1 space-y-1">
                              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase">
                                 <span>Demand</span>
                                 <span>{gap.demand}%</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${gap.demand}%` }} className="h-full bg-indigo-500" />
                              </div>
                           </div>
                           <div className="flex-1 space-y-1">
                              <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase">
                                 <span>Supply</span>
                                 <span>{gap.supply}%</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${gap.supply}%` }} className="h-full bg-rose-500/40" />
                              </div>
                           </div>
                        </div>
                      </div>
                      <button className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all group-hover:scale-105">
                        <ArrowRight size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
               <div className={`${glassStyle} p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/10 to-transparent`}>
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-black text-white italic uppercase">Market Heat</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Niche Velocity</div>
                      <div className="text-2xl font-black text-white italic">+42.8%</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Saturation Index</div>
                      <div className="text-2xl font-black text-rose-400 italic">LOW</div>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'forcing' && (
          <motion.div
            key="forcing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { id: 'pas', name: 'Problem-Agitate-Solve', desc: 'Best for direct response and selling digital products.', color: 'from-orange-600 to-rose-600' },
              { id: 'aida', name: 'Attention-Interest-Desire-Action', desc: 'The classic framework for storytelling and engagement.', color: 'from-violet-600 to-indigo-600' },
              { id: 'hook-payoff', name: 'Loop-The-Loop (Loop Hook)', desc: 'Optimized for high-retention short form loops.', color: 'from-emerald-600 to-teal-600' },
            ].map((framework, i) => (
              <motion.div
                key={framework.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`${glassStyle} p-8 rounded-[2.5rem] flex flex-col group cursor-pointer hover:border-white/20 transition-all`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${framework.color} shadow-lg mb-6 flex items-center justify-center text-white`}>
                  <Zap size={24} />
                </div>
                <h3 className="text-xl font-black italic text-white uppercase mb-4">{framework.name}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8 flex-1">
                  {framework.desc}
                </p>
                <button 
                  title={`Apply ${framework.name} framework`}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all"
                >
                  Apply Framework
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'autopsy' && (
          <motion.div
            key="autopsy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className={`${glassStyle} p-12 rounded-[3rem] flex flex-col items-center text-center max-w-4xl mx-auto`}>
               <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-8">
                  <SearchCode className="w-10 h-10 text-indigo-400" />
               </div>
               <h2 className="text-3xl font-black italic text-white uppercase mb-4">Competitor Autopsy</h2>
               <p className="text-slate-400 text-sm font-medium mb-10 max-w-lg">
                  Analyze viral videos to strip away the creative and reveal the raw marketing DNA behind their success.
               </p>
               
               <div className="w-full flex gap-3 relative max-w-2xl">
                  <input
                    type="text"
                    value={competitorUrl}
                    onChange={(e) => setCompetitorUrl(e.target.value)}
                    placeholder="Paste TikTok or YouTube Link..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white font-bold text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all"
                  />
                  <button
                    onClick={handleAutopsy}
                    disabled={isAnalyzing || !competitorUrl}
                    className="px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    {isAnalyzing ? <Activity className="animate-spin" /> : 'Autopsy'}
                  </button>
               </div>
            </div>

            {autopsyData && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Hook DNA', val: autopsyData.hook, icon: Zap, color: 'text-orange-400' },
                  { label: 'Pacing Ratios', val: autopsyData.pacing, icon: Activity, color: 'text-indigo-400' },
                  { label: 'Psych Trigger', val: autopsyData.psychology, icon: Brain, color: 'text-purple-400' },
                  { label: 'Viral Score', val: autopsyData.score + '%', icon: Target, color: 'text-emerald-400' },
                ].map((stat, i) => (
                  <div key={i} className={`${glassStyle} p-6 rounded-3xl border border-white/5 flex flex-col gap-2`}>
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
                    <div className="text-sm font-black text-white italic uppercase truncate">{stat.val}</div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
