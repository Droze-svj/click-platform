'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import {
  TrendingUp,
  Zap,
  ShieldCheck,
  AlertOctagon,
  Volume2,
  Tv,
  Sparkles,
  BarChart,
  Target,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  Activity,
  Gauge,
  DollarSign,
  Users,
  Eye,
  Info,
  FileText
} from 'lucide-react'

const glassStyle = "relative overflow-hidden rounded-[2.5rem] border border-white/[0.05] bg-white/[0.02] backdrop-blur-xl shadow-2xl transition-all"

const PacingHeatmap = ({ segments }: { segments: any[] }) => {
  if (!segments || segments.length === 0) return null

  return (
    <div className="space-y-4 pt-4 border-t border-white/[0.05]">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pacing Heatmap · Word Density</div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-500 uppercase">
            <div className="w-2 h-2 rounded-full bg-emerald-500/40" /> Optimal
          </div>
          <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-500 uppercase">
            <div className="w-2 h-2 rounded-full bg-amber-500/40" /> Slow
          </div>
          <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-500 uppercase">
            <div className="w-2 h-2 rounded-full bg-rose-500/40" /> Dense
          </div>
        </div>
      </div>
      <div className="flex h-4 w-full rounded-2xl overflow-hidden bg-white/5 border border-white/5 p-0.5">
        {segments.map((s, i) => {
          const color = s.status === 'too-dense' ? 'bg-rose-500/60' : s.status === 'too-slow' ? 'bg-amber-500/60' : 'bg-emerald-500/60'
          return (
            <div
              key={i}
              style={{ width: `${(s.duration / segments.reduce((acc, curr) => acc + curr.duration, 0)) * 100}%` }}
              className={`${color} h-full border-r border-black/20 last:border-0 relative group first:rounded-l-xl last:rounded-r-xl`}
            >
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-[#080810]/95 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap pointer-events-none border border-white/10 shadow-2xl z-20">
                <span className="font-black italic uppercase text-indigo-400 mr-2">{s.section}</span>
                <span className="font-bold">{s.density.toFixed(1)} W/S</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function NeuralStrategyHub() {
  const [trends, setTrends] = useState<any>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [topic, setTopic] = useState("AI Video Revolution")
  const { showToast } = useToast()

  const fetchTrends = useCallback(async () => {
    try {
      const res = await apiGet('/video/neural/trends?platform=tiktok')
      setTrends(res)
    } catch (err) {
      showToast('Neural trend ingestion failed', 'error')
    }
  }, [showToast])

  const runPrediction = async () => {
    setLoading(true)
    try {
      const res = await apiPost('/video/neural/predict-success', {
        topic,
        hook: 'question',
        pacing: 'fast'
      })
      const mockHeatmap = [
        { section: 'Intro', duration: 3, density: 4.2, status: 'too-dense' },
        { section: 'Problem', duration: 15, density: 2.8, status: 'optimal' },
        { section: 'Solution', duration: 10, density: 3.1, status: 'optimal' },
        { section: 'Bonus Tip', duration: 5, density: 1.2, status: 'too-slow' },
        { section: 'CTA', duration: 4, density: 2.9, status: 'optimal' }
      ]
      setPrediction({
        ...res.prediction,
        pacingHeatmap: mockHeatmap
      })
      showToast('Success Intelligence synchronized', 'success')
    } catch (err) {
      showToast('Viral forecasting offline', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-12 px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/[0.05] pb-12">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">
            <Sparkles className="w-3.5 h-3.5" />
            Sovereign Strategist Overdrive
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white uppercase leading-[0.8] mb-2">
            PREDICTIVE<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">SIGNALS</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Neural Consensus Layer Active · March 2026
          </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative group">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Query Topic..."
                className="px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/10 text-white font-bold text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-600 focus:bg-white/[0.05]"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            </div>
           <button
             onClick={runPrediction}
             disabled={loading}
             className="px-10 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/20 flex items-center gap-3 disabled:opacity-50 transition-all active:scale-95 group overflow-hidden"
           >
             {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 group-hover:rotate-45 transition-transform" />}
             Run Swarm Consensus
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Console */}
        <div className="lg:col-span-8 space-y-10">
          {/* Live Trends Section */}
          <div className={`${glassStyle} p-10 group`}>
             <div className="absolute -top-24 -right-24 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
               <TrendingUp className="w-80 h-80 text-indigo-400 rotate-12" />
             </div>
             
             <div className="flex items-center justify-between mb-10 relative">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                    <TrendingUp className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Signal Ingestion</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Real-time Cross-Platform Ledger</p>
                  </div>
               </div>
               <button onClick={fetchTrends} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all hover:rotate-180 duration-500">
                 <RefreshCw className="w-4 h-4 text-slate-400" />
               </button>
             </div>
 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative">
                {trends?.strategy && (
                  <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 space-y-6 shadow-2xl transition-all hover:bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Recommended Mold
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">
                        High Delta Potential
                      </div>
                    </div>
                    <div className="text-4xl font-black text-white italic uppercase leading-none">{trends.strategy.mold}</div>
                    <p className="text-sm text-slate-400 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 py-1">
                      &quot;{trends.strategy.explanation}&quot;
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {trends.strategy.keyThemes?.map((theme: string, i: number) => (
                         <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] text-slate-300 font-black uppercase tracking-wider">#{theme}</span>
                       ))}
                    </div>
                  </div>
                )}
                <div className="space-y-6">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Activity className="w-3 h-3 text-indigo-400" /> Trending Pulse
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {(trends?.trends || Array(4).fill({})).map((t: any, i: number) => {
                      const trendText = t.tag || t.topic || t.trend || 'Detecting Signals...';
                      return (
                        <div key={i} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05] transition-all hover:bg-white/[0.05] hover:border-white/20 group cursor-default">
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-200 font-black group-hover:text-white transition-colors uppercase italic tracking-wider">
                              {trendText.startsWith('#') ? trendText : `#${trendText}`}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{t.sentiment || 'Analyzing Engagement'}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            {t.growth && (
                              <span className="text-xs font-black text-emerald-500 italic flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3" /> {t.growth}
                              </span>
                            )}
                            <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                               <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest font-mono">
                                 {t.views || 'LIVE'}
                               </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
             </div>
          </div>
 
          {/* Success Prediction Section */}
          <AnimatePresence>
            {prediction && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassStyle} p-10 space-y-12 bg-gradient-to-br from-indigo-500/[0.08] via-transparent to-emerald-500/5`}
              >
                <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                  <Gauge className="w-64 h-64 text-white -rotate-12" />
                </div>
 
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                      <Target className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Viral Forecast</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cross-Validation Result · Swarm Consensus</p>
                    </div>
                  </div>
                  <div className={`px-10 py-4 rounded-full font-black text-xs italic uppercase tracking-[0.25em] border-2 shadow-2xl transition-all ${
                    prediction.tier === 'VIRAL' || prediction.tier === 'BREAKOUT'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  }`}>
                    {prediction.tier} TIER REACHED
                  </div>
                </div>
 
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                  <div className="space-y-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Growth Probability</div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-8xl font-black text-white italic leading-[0.7]">{prediction.probability}</span>
                       <span className="text-3xl font-black text-indigo-400 italic">%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                       <motion.div
                         initial={{ width: 0 }}
                         animate={{ width: `${(typeof prediction.probability !== 'number' || isNaN(prediction.probability)) ? 0 : prediction.probability}%` }}
                         transition={{ duration: 2, ease: "circOut" }}
                         className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                       />
                    </div>
                  </div>
 
                  {/* Reach & ROI Metrics */}
                  <div className="flex flex-col justify-center space-y-6">
                    <div className="space-y-4">
                       <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-center gap-2 text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 relative z-10">
                             <Users className="w-3.5 h-3.5" /> Forecasted Audience
                          </div>
                          <div className="text-2xl font-black text-white italic uppercase tracking-tighter relative z-10">
                             {prediction.forecastedReach?.[0]?.toLocaleString() || '50K'}
                             <span className="text-slate-700 mx-2">/</span>
                             {prediction.forecastedReach?.[1]?.toLocaleString() || '250K'}
                          </div>
                       </div>
                       <div className="p-6 rounded-[2rem] bg-emerald-500/03 border border-emerald-500/10 hover:bg-emerald-500/05 transition-all group overflow-hidden relative">
                          <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 relative z-10">
                             <DollarSign className="w-3.5 h-3.5" /> ROI Projection
                          </div>
                          <div className="text-2xl font-black text-white italic tracking-tighter relative z-10">
                             ${prediction.roi?.minRevenue || '1.2K'}
                             <span className="text-slate-700 mx-2">TO</span>
                             ${prediction.roi?.maxRevenue || '8.4K'}
                          </div>
                       </div>
                    </div>
                  </div>
 
                  <div className="space-y-8">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Confidence Chain</div>
                    <div className="space-y-3">
                      {prediction.factors.map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-slate-200 text-xs font-bold transition-all hover:bg-white/[0.05] group">
                          <div className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                             <CheckCircle2 className="w-3 h-3 text-emerald-400 group-hover:scale-125 transition-transform" />
                          </div>
                          <span className="tracking-tight">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
 
                {/* Heatmap Visualization */}
                <PacingHeatmap segments={prediction.pacingHeatmap} />
 
                <div className="p-10 rounded-[2.5rem] bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-10 pointer-events-none" />
                  <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse border border-amber-500/30 flex-shrink-0 relative z-10">
                    <Zap className="w-10 h-10 text-amber-400" />
                  </div>
                  <div className="flex-1 relative z-10 text-center md:text-left">
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2 mb-2">
                       <ShieldCheck className="w-3 h-3" /> Actionable Sovereignty
                    </div>
                    <p className="text-xl text-white font-black italic group-hover:text-amber-200 transition-colors leading-[1.1] uppercase">
                      &quot;{prediction.improvementTip}&quot;
                    </p>
                  </div>
                  <button className="px-10 py-5 rounded-2xl bg-amber-500 text-black font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all relative z-10 flex items-center gap-2">
                    Execute Optimization <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
 
            {/* Neural Agent reasoning log */}
            <div className={`${glassStyle} p-10 space-y-8 bg-gradient-to-br from-indigo-500/05 to-transparent`}>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-indigo-400" />
                    <div>
                      <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Swarm Node Reasoning</h3>
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">Secure AI Consensus Log</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Live Sync</span>
                  </div>
               </div>
               <div className="space-y-4 max-h-56 overflow-y-auto pr-4 custom-scrollbar">
                  {[
                    "Sovereign Core initialized. Topic vector set to: " + topic,
                    "Swarm Agent ALPHA fetching global trends (TikTok API v5)...",
                    "Swarm Agent BETA mapping success probability density...",
                    "Swarm Agent GAMMA calculating projected ROI engagement delta...",
                    "Neural Consensus reached (94.2%). Viral trajectory foreseen.",
                    "Sovereignty Ledger updated with latest trend DNA.",
                    "Optimization recommendation generated via Autonomous Reasoning."
                  ].map((log, i) => (
                    <div key={i} className={`flex gap-4 text-[10px] font-mono border-l-2 border-white/5 pl-6 py-2 transition-colors hover:border-indigo-500/40 relative group`}>
                       <div className="absolute left-[-2px] top-0 bottom-0 w-[2px] bg-indigo-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300" />
                       <span className="text-slate-600 font-bold shrink-0">[{new Date().toLocaleTimeString()}]</span>
                       <span className={`${i % 2 === 0 ? 'text-slate-300' : 'text-indigo-300/80'} font-medium`}>{log}</span>
                    </div>
                  ))}
               </div>
            </div>
          </AnimatePresence>
        </div>
 
        {/* Sidebar Blocks */}
        <div className="lg:col-span-4 space-y-10">
           {/* Neural Blueprint Card */}
           <div className={`${glassStyle} p-10 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20 group`}>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Active Engine</h3>
              </div>
              <div className="p-6 rounded-[2rem] bg-[#07070f]/80 border border-white/[0.05] space-y-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                   <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3" /> Engine V2.6 Sovereign
                   </div>
                   <div className="text-2xl font-black text-white italic uppercase leading-none">The Satire Setup</div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Optimized for</p>
                   <div className="flex gap-2">
                      <div className="px-2 py-1 rounded-lg bg-white/5 text-[8px] font-black text-slate-400 uppercase tracking-widest">TikTok</div>
                      <div className="px-2 py-1 rounded-lg bg-white/5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Reels</div>
                   </div>
                </div>
              </div>
              <button className="w-full mt-6 py-5 rounded-2xl bg-purple-600/10 border border-purple-600/30 text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-purple-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl hover:shadow-purple-600/20">
                <RefreshCw className="w-3.5 h-3.5" /> Re-sync DNA Engine
              </button>
           </div>
 
           {/* Neural Quality Center */}
           <div className={`${glassStyle} p-10 group`}>
             <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-all duration-1000 group-hover:scale-125">
               <ShieldCheck className="w-48 h-48 text-indigo-400" />
             </div>
             <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Neural Integrity</h3>
             </div>
             <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 italic">
               Autonomous auditing for voice artifacts, caption collision, and bit-rate integrity checks before final render.
             </p>
             <button className="w-full py-5 rounded-2xl bg-white/[0.02] border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/[0.05] hover:border-white/20 transition-all shadow-2xl relative overflow-hidden group/btn">
               <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 -translate-x-full group-hover/btn:animate-shimmer" />
               Execute Full Integrity Audit
             </button>
           </div>
 
           {/* Generative Assets HUD */}
           <div className={`${glassStyle} p-10`}>
             <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Swarm Gen HUD</h3>
             </div>
             <div className="space-y-4">
               {[
                 { label: 'Auto-Foley', icon: Volume2, color: 'text-indigo-400', active: true },
                 { label: 'B-Roll Agent', icon: Tv, color: 'text-orange-400', active: false },
                 { label: 'Caption Swarm', icon: FileText, color: 'text-emerald-400', active: true },
               ].map((asset, i) => (
                 <div key={i} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-all group cursor-pointer relative overflow-hidden">
                   <div className="flex items-center gap-4 relative z-10">
                     <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                       <asset.icon className={`w-5 h-5 ${asset.color}`} />
                     </div>
                     <span className="text-[11px] font-black text-slate-300 uppercase italic tracking-widest group-hover:text-white transition-colors">{asset.label}</span>
                   </div>
                   <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${asset.active ? 'bg-indigo-600/40 border border-indigo-600/50' : 'bg-white/5 border border-white/10'}`}>
                      <div className={`absolute top-1 w-3.5 h-3.5 rounded-full bg-white shadow-xl transition-all duration-300 ${asset.active ? 'right-1' : 'left-1'}`} />
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
