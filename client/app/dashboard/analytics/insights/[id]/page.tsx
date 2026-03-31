'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain, Zap, Target, TrendingUp, Shield, Cpu, 
  ArrowLeft, RefreshCw, Sparkles, Network, Fingerprint,
  ActivitySquare, Terminal, Monitor, MessageSquare, 
  Flame, Globe, BarChart3, AlertCircle
} from 'lucide-react'
import { apiPost, apiGet } from '../../../../../lib/api'
import { ErrorBoundary } from '../../../../../components/ErrorBoundary'
import ToastContainer from '../../../../../components/ToastContainer'
import SpectralLoader from '../../../../../components/SpectralLoader'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border-2 border-white/5 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-700'
const premiumCard = 'backdrop-blur-2xl bg-black/60 border-2 border-white/5 rounded-[4rem] shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] hover:border-indigo-500/20 transition-all duration-500'

interface InsightMatrix {
  potencyScore: number;
  predictiveROI: number;
  specificAdvice: string;
  signalGaps: string[];
  kineticResonance: string;
  headline: string;
  platform_context: string;
}

export default function StrategicSynthesisHub() {
  const params = useParams()
  const router = useRouter()
  const [matrix, setMatrix] = useState<InsightMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initiateScan = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiPost(`/analytics/process-insights/${params.id}`, {})
      if (res.success) {
        // Extract matrix from wrapped response
        const data = res.matrix.metadata || res.matrix;
        setMatrix(data)
      } else {
        throw new Error(res.error || 'SCAN_INTERRUPTED')
      }
    } catch (err: any) {
      console.error('Neural Scan Failure:', err)
      setError(err.message || 'NEURAL_LINK_ERROR')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) initiateScan()
  }, [params.id, initiateScan])

  if (loading) return <SpectralLoader message="Synthesizing Strategic Blueprint..." subMessage="NEURAL_CORRELATION_IN_PROGRESS" />

  if (error) return (
    <div className="min-h-screen bg-[#020205] flex flex-col items-center justify-center p-12 text-center">
      <AlertCircle size={80} className="text-rose-500 mb-8 animate-pulse" />
      <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-6">Link Error</h1>
      <p className="text-slate-800 text-[14px] uppercase font-black tracking-[0.4em] mb-12">{error}</p>
      <button onClick={() => router.back()} className="px-12 py-6 bg-white text-black font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] transition-all hover:bg-rose-500 hover:text-white">
        Return to Matrix
      </button>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24 bg-[#020205]">
        <ToastContainer />
        
        {/* Spectral Background Layers */}
        <div className="fixed inset-0 pointer-events-none">
           <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-600/10 blur-[250px] rounded-full animate-pulse" />
           <div className="absolute bottom-[-5%] left-[-5%] w-[50%] h-[50%] bg-indigo-600/10 blur-[200px] rounded-full" />
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12 opacity-[0.03]" />
        </div>

        {/* Synthesis Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button 
                onClick={() => router.back()}
                title="Go Back"
                className="w-24 h-24 bg-white/5 border border-white/10 rounded-[3rem] flex items-center justify-center hover:bg-white/10 transition-all group"
              >
                <ArrowLeft size={32} className="text-white group-hover:-translate-x-2 transition-transform" />
              </button>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Zap size={16} className="text-violet-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-violet-400 italic leading-none">Scanning Engine v2.0</span>
                   </div>
                   <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-black/40 border border-white/5 shadow-inner">
                       <Sparkles size={12} className="text-white animate-pulse" />
                       <span className="text-[9px] font-black text-slate-800 tracking-widest uppercase italic leading-none">{matrix?.headline || 'MANIFESTING'}</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Strategic Synthesis</h1>
                 <p className="text-slate-800 text-[14px] uppercase font-black tracking-[0.4em] italic leading-none">Deep-scan complete. Heuristic optimization manifest generated.</p>
              </div>
           </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-16 relative z-10">
           {/* Primary Yield & ROI Modeling */}
           <div className="xl:col-span-2 space-y-12">
              <div className={`${premiumCard} p-20 relative overflow-hidden h-full flex flex-col min-h-[600px]`}>
                 <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none"><Network size={600} className="text-white" /></div>
                 
                 <div className="flex items-center gap-8 mb-16 relative z-10 px-8">
                    <div className="p-6 rounded-[2.5rem] bg-violet-500/5 border border-violet-500/20 shadow-2xl"><TrendingUp size={40} className="text-violet-400" /></div>
                    <div>
                       <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-1">Predictive ROI Projection</h3>
                       <p className="text-[10px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">Heuristic outcome modeling for next 30 global cycles.</p>
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col justify-center items-center gap-12 relative z-10">
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="w-96 h-96 rounded-full border-[20px] border-violet-500/20 flex flex-col items-center justify-center bg-black/40 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] relative"
                    >
                       <div className="absolute inset-0 rounded-full border border-violet-500/50 animate-ping opacity-20" />
                       <div className="text-[120px] font-black italic text-white tracking-tighter tabular-nums leading-none">
                          +{matrix?.predictiveROI || 0}%
                       </div>
                       <div className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] mt-4">Growth Resonance</div>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                       <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 flex items-start gap-8 group hover:bg-white/[0.05] transition-all">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform"><Target size={32} className="text-indigo-400" /></div>
                          <div>
                             <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2 italic">STRATEGIC_DIRECTIVE</div>
                             <p className="text-[18px] font-black text-white italic leading-tight uppercase tracking-tight">{matrix?.specificAdvice}</p>
                          </div>
                       </div>
                       <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 flex items-start gap-8 group hover:bg-white/[0.05] transition-all">
                          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 group-hover:scale-110 transition-transform"><Flame size={32} className="text-rose-400" /></div>
                          <div>
                             <div className="text-[10px] font-black text-rose-400 uppercase tracking-[0.4em] mb-2 italic">KINETIC_FLOW</div>
                             <p className="text-[18px] font-black text-white italic leading-tight uppercase tracking-tight">{matrix?.kineticResonance}</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Heuristic Gaps & Node Identity */}
           <div className="xl:col-span-1 space-y-12 h-full">
              <div className={`${premiumCard} p-24 h-full relative overflow-hidden flex flex-col`}>
                 <div className="absolute top-0 right-0 p-24 opacity-0.02 pointer-events-none border-none"><Cpu size={400} className="text-white opacity-[0.02]" /></div>
                 
                 <div className="flex items-center gap-6 mb-16 relative z-10">
                    <div className="p-5 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20"><Brain size={32} className="text-indigo-400" /></div>
                    <div>
                       <h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-1">Signal Diagnostic</h3>
                       <p className="text-[10px] text-slate-800 font-black uppercase tracking-[0.4em] italic leading-none">Detected resonance gaps in content DNA.</p>
                    </div>
                 </div>

                 <div className="space-y-10 flex-1 relative z-10">
                    <div className="space-y-6">
                       <span className="text-[12px] font-black text-white uppercase tracking-[0.5em] italic">Potency Score</span>
                       <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${matrix?.potencyScore || 0}%` }}
                             transition={{ duration: 1.5, ease: "easeOut" }}
                             className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                          />
                       </div>
                       <div className="flex justify-between items-center text-[14px] font-black text-slate-800 italic uppercase">
                          <span>Neutral</span>
                          <span className="text-white text-3xl tracking-tighter">{matrix?.potencyScore || 0}/100</span>
                          <span>Overdrive</span>
                       </div>
                    </div>

                    <div className="space-y-6 pt-10 border-t border-white/5">
                       <span className="text-[12px] font-black text-white uppercase tracking-[0.5em] italic">Signal Gaps Detected</span>
                       <div className="flex flex-wrap gap-4">
                          {(matrix?.signalGaps || ['Data Missing']).map(gap => (
                            <div key={gap} className="px-8 py-4 rounded-[2rem] bg-black/60 border border-white/10 flex items-center gap-4 group hover:border-indigo-500/40 transition-all">
                               <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,1)]" />
                               <span className="text-[14px] font-black text-white uppercase tracking-tight italic">{gap}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="mt-12 p-8 rounded-[3rem] bg-white/[0.01] border border-white/5 space-y-4">
                       <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.5em] italic">Manifest Platform</span>
                       <div className="flex items-center gap-6">
                          <div className={`w-14 h-14 rounded-2xl bg-black/80 border border-white/10 flex items-center justify-center text-white text-2xl uppercase font-black italic`}>
                             {matrix?.platform_context === 'tiktok' ? '♪' : matrix?.platform_context === 'instagram' ? '◈' : '▶'}
                          </div>
                          <span className="text-[20px] font-black text-white uppercase italic tracking-widest">{matrix?.platform_context?.toUpperCase()}_SYNCED</span>
                       </div>
                    </div>
                 </div>

                 <button 
                  onClick={initiateScan}
                  className="w-full mt-16 py-8 bg-white text-black hover:bg-violet-600 hover:text-white font-black uppercase text-[15px] tracking-[0.6em] italic rounded-[3rem] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-6 group relative z-10"
                 >
                    <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-1000" />
                    RE_INITIALIZE_SCAN
                 </button>
              </div>
           </div>
        </div>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
