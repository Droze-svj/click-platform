'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import { 
  Sparkles, Download, RefreshCw, Quote, ArrowLeft,
  Cpu, Activity, Shield, Globe, Target, Radio, Layers,
  Zap, Terminal, X, ArrowUpRight, Hexagon, Fingerprint,
  Eye, Boxes, Shrink, Maximize2, Minimize2, Check
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)] transition-all duration-1000'

const FISCAL_POLARITY = [
  { value: 'modern', label: 'NEO_FISCAL' },
  { value: 'minimal', label: 'VOID_PROTOCOL' },
  { value: 'bold', label: 'HIGH_LEVERAGE' }
]

interface AxiomaticFractal {
  imageUrl: string
  quote: string
  author: string
  style: string
}

function getImageUrl(path: string): string {
  if (!path || !path.startsWith('/')) return path
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''
  const base = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : ''
  if (base) return `${base}${path}`
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5001${path}`
  }
  return `http://localhost:5001${path}`
}

export default function FiscalProposalMatrixPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  const [wisdomPayload, setWisdomPayload] = useState('')
  const [spectralPolarity, setSpectralPolarity] = useState('modern')
  const [loading, setLoading] = useState(false)
  const [fractals, setFractals] = useState<AxiomaticFractal[]>([])
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const handleWisdomSynthesis = async () => {
    const text = wisdomPayload.trim()
    if (!text) {
      showToast('REQUIRED: ECONOMIC_DIRECTIVE_EMPTY', 'error')
      return
    }

    setLoading(true)
    setSwarmHUDTask('Instantiating Fiscal Proposal Matrix')
    setShowSwarmHUD(true)
    try {
      const res = await apiPost<{ quoteCards: AxiomaticFractal[] }>('/quote/generate', {
        quoteText: text,
        style: spectralPolarity
      })
      const list = res?.quoteCards || []
      setFractals(list)
      showToast(list.length ? `✓ PROPOSALS_COLLECTED: ${list.length}` : 'SIGNAL_LOST: SECTOR_EMPTY', list.length ? 'success' : 'info')
    } catch (err: any) {
      showToast('SYNC_ERR: FISCAL_OVERLOAD', 'error')
      setFractals([])
    } finally {
      setLoading(false)
    }
  }

  const handleFractalExtraction = (card: AxiomaticFractal) => {
    const url = getImageUrl(card.imageUrl)
    const a = document.createElement('a')
    a.href = url
    a.download = `fiscal-proposal-${Date.now()}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    showToast('✓ DOWNLOADING_FISCAL_MANIFEST', 'success')
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-32 px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Hexagon size={1200} className="text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Target size={1000} className="text-white absolute -top-80 -right-60 rotate-[32deg] blur-[2px]" />
        </div>

        <SwarmConsensusHUD 
          isVisible={showSwarmHUD} 
          taskName={swarmHUDTask} 
          onComplete={() => setShowSwarmHUD(false)} 
        />

        {/* Fiscal Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-50">
           <div className="flex items-center gap-10">
              <button 
                onClick={() => router.push('/dashboard')} 
                title="Abort Session"
                className="w-20 h-20 rounded-[2.5rem] bg-white/[0.03] border-2 border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-3xl hover:border-emerald-500/50 backdrop-blur-3xl group"
              >
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-emerald-500/5 border-2 border-emerald-500/20 rounded-[3rem] flex items-center justify-center shadow-[0_40px_150px_rgba(16,185,129,0.3)] relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-100" />
                <Quote size={48} className="text-emerald-400 relative z-10 group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-emerald-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-emerald-400 italic leading-none">Fiscal Engine v8.2.1</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-black/60 border-2 border-white/5 shadow-inner">
                       <Radio size={14} className="text-emerald-400 animate-pulse" />
                       <span className="text-[10px] font-black text-slate-800 tracking-widest uppercase italic leading-none">MARKET_SYMPATHY_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-3 drop-shadow-2xl">Fiscal Matrix</h1>
                 <p className="text-slate-800 text-[13px] uppercase font-black tracking-[0.6em] mt-5 italic leading-none">Synthesis terminal for high-leverage fiscal proposals and strategic axiomatic manifests.</p>
              </div>
           </div>
        </header>

        {/* Proposal Ingress Terminal */}
        <div className="max-w-5xl mx-auto relative z-10 w-full pt-10">
           <div className={`${glassStyle} rounded-[6rem] overflow-hidden group border-emerald-500/20 shadow-[0_100px_250px_rgba(0,0,0,1)] backdrop-blur-3xl relative`}>
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent pointer-events-none" />
              <div className="px-16 py-12 border-b-2 border-white/5 flex items-center justify-between bg-white/[0.01] relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-30" />
                 <div className="flex items-center gap-8 relative z-10">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center border-2 border-emerald-500/20 shadow-3xl group-hover:scale-110 transition-transform duration-1000"><Terminal size={32} className="text-emerald-400" /></div>
                    <h2 className="font-black text-white italic uppercase tracking-tighter text-5xl leading-none">Economic Ingress</h2>
                 </div>
                 <div className="flex items-center gap-5 relative z-10">
                    <span className="text-[12px] font-black text-slate-900 uppercase tracking-[0.4em] italic leading-none">SYCHRONIZED_INPUT_STREAM</span>
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,1)] animate-ping" />
                 </div>
              </div>

              <div className="p-20 space-y-20 relative z-10">
                 <div className="space-y-10">
                    <div className="flex items-center gap-6 border-l-8 border-emerald-500 pl-8 py-2">
                       <label htmlFor="wisdom-id" className="text-[14px] font-black text-slate-900 uppercase tracking-[0.8em] italic leading-none">Economic Directive Payload</label>
                    </div>
                    <textarea
                      id="wisdom-id"
                      value={wisdomPayload}
                      onChange={(e) => setWisdomPayload(e.target.value)}
                      placeholder="INPUT_MARKET_LOGIC_PARTICLE..."
                      rows={6}
                      className="w-full bg-black/80 border-2 border-white/5 rounded-[4rem] px-20 py-16 text-3xl font-black text-white uppercase tracking-widest italic focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-950 leading-relaxed resize-none shadow-inner backdrop-blur-3xl"
                      disabled={loading}
                      title="Directive Ingress"
                    />
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-20">
                    <div className="space-y-12">
                       <div className="flex items-center gap-6 border-l-4 border-slate-900 pl-6 py-1">
                          <label className="text-[14px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Fiscal Resonance Bias</label>
                       </div>
                       <div className="flex flex-wrap gap-6">
                          {FISCAL_POLARITY.map((s) => (
                             <button
                               key={s.value}
                               onClick={() => setSpectralPolarity(s.value)}
                               disabled={loading}
                               className={`px-16 py-8 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] border-2 transition-all duration-1000 italic shadow-3xl relative overflow-hidden group/pol ${spectralPolarity === s.value ? 'bg-white text-black border-transparent scale-110 shadow-emerald-500/40' : 'bg-white/[0.02] border-white/5 text-slate-800 hover:text-white hover:border-emerald-500/30'}`}
                             >
                                <span className="relative z-10">{s.label}</span>
                                <div className={`absolute inset-0 bg-emerald-500/10 opacity-0 group-hover/pol:opacity-100 transition-opacity duration-1000 ${spectralPolarity === s.value ? 'hidden' : ''}`} />
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="flex items-end">
                       <button
                         onClick={handleWisdomSynthesis}
                         disabled={loading || !wisdomPayload.trim()}
                         className="w-full h-24 flex items-center justify-center gap-10 bg-white border-8 border-transparent hover:border-emerald-500/30 text-black rounded-[4rem] font-black text-[22px] shadow-[0_60px_150px_rgba(255,255,255,0.1)] hover:shadow-emerald-500/50 transition-all duration-1000 active:scale-95 italic uppercase tracking-[0.8em] group/forge disabled:opacity-20"
                       >
                         {loading ? <RefreshCw className="w-10 h-10 animate-spin" /> : <Sparkles size={40} className="group-hover:rotate-12 transition-transform duration-1000 fill-current" />}
                         {loading ? 'SYNTHESIZING...' : 'INSTANTIATE_PROPOSAL'}
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Fiscal Response Matrix */}
        <AnimatePresence>
          {fractals.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} className="space-y-16 relative z-10 pt-10">
               <div className="flex items-center justify-between border-b-2 border-white/5 pb-8">
                  <div className="flex items-center gap-10">
                     <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2rem] flex items-center justify-center shadow-3xl"><Layers size={32} className="text-emerald-400" /></div>
                     <div>
                        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">Fiscal Manifests</h2>
                        <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.6em] italic leading-none">Synthesized economic directives calibrated for high- resonance output.</p>
                     </div>
                  </div>
                  <button
                    onClick={() => { setWisdomPayload(''); setFractals([]) }}
                    className="px-12 py-6 bg-white/[0.03] border-2 border-white/10 rounded-[3rem] text-[13px] font-black uppercase tracking-[0.4em] text-slate-800 hover:text-white hover:bg-white/10 transition-all italic active:scale-95 shadow-3xl group"
                  >
                    <RefreshCw size={20} className="inline mr-4 group-hover:rotate-180 transition-transform duration-1000" /> REBOOT_FISCAL_FORGE
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20">
                  {fractals.map((fractal, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      key={idx}
                      className={`${glassStyle} rounded-[5rem] overflow-hidden group hover:border-emerald-500/40 hover:bg-white/[0.04] shadow-[0_80px_200px_rgba(0,0,0,0.8)] flex flex-col relative`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                      <div className="aspect-[4/5] relative overflow-hidden bg-black border-b-2 border-white/5">
                        <img
                          src={getImageUrl(fractal.imageUrl)}
                          alt={fractal.quote}
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-1000" />
                        
                        <div className="absolute top-10 right-10 p-6 rounded-[2.5rem] bg-black/80 backdrop-blur-3xl border-2 border-white/10 opacity-0 group-hover:opacity-100 transition-all translate-y-6 group-hover:translate-y-0 duration-1000 shadow-3xl">
                           <Target size={36} className="text-emerald-400 group-hover:rotate-[360deg] transition-transform duration-[2s]" />
                        </div>
                        <div className="absolute bottom-10 left-10 p-6 rounded-[2.5rem] bg-emerald-600/20 backdrop-blur-3xl border-2 border-emerald-500/20 opacity-0 group-hover:opacity-100 transition-all -translate-x-6 group-hover:translate-x-0 duration-1000 shadow-3xl">
                           <Boxes size={36} className="text-white animate-pulse" />
                        </div>
                      </div>
                      
                      <div className="p-16 space-y-12 flex-1 flex flex-col justify-between relative z-10">
                         <div className="space-y-8">
                            <div className="flex items-center gap-5">
                               <div className="w-2 h-12 bg-emerald-500 rounded-full shadow-[0_0_30px_rgba(16,185,129,1)]" />
                               <p className="text-[13px] font-black text-emerald-400 uppercase tracking-[0.8em] italic leading-none">ECON_DIRECTIVE_ALPHA</p>
                            </div>
                            <p className="text-3xl font-black text-white italic leading-tight tracking-tighter uppercase group-hover:text-emerald-400 transition-colors duration-1000 line-clamp-4">
                             &ldquo;{fractal.quote.toUpperCase()}&rdquo;
                            </p>
                            <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none border-t-2 border-white/5 pt-8">— AUTH_ID: {fractal.author.toUpperCase() || 'ANONYMOUS_AGENT'}</p>
                         </div>
                         
                         <div className="pt-12 flex gap-8">
                            <button
                              onClick={() => handleFractalExtraction(fractal)}
                              className="flex-1 flex items-center justify-center gap-6 py-8 bg-white text-black hover:bg-emerald-500 hover:text-white rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] transition-all duration-1000 italic shadow-3xl group/ext active:scale-95"
                            >
                              <Download size={28} className="group-hover/ext:translate-y-2 transition-transform duration-700" /> EXTRACT_MANIFEST
                            </button>
                            <button 
                               className="w-24 h-24 bg-white/[0.03] border-2 border-white/10 text-slate-800 hover:text-white rounded-[2.5rem] flex items-center justify-center transition-all duration-1000 hover:rotate-12 hover:bg-white/10 active:scale-90 hover:border-emerald-500/50 backdrop-blur-3xl group/res"
                               title="Spatial Resonance Analysis"
                            >
                               <ArrowUpRight size={40} className="group-hover/res:translate-x-1 group-hover/res:-translate-y-1 transition-transform" />
                            </button>
                         </div>
                      </div>
                    </motion.div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!fractals.length && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-72 text-center opacity-[0.05] relative z-10 flex flex-col items-center gap-16 grayscale pointer-events-none">
             <div className="w-56 h-56 bg-white/5 rounded-[6rem] border-4 border-dashed border-white/10 flex items-center justify-center shadow-3xl relative">
                <Boxes size={120} className="text-white animate-pulse" />
             </div>
             <div className="space-y-10">
                <p className="text-7xl font-black text-white uppercase tracking-[1em] italic leading-none">Fiscal Void</p>
                <p className="text-[20px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-relaxed">No strategic manifests detected in current sector.<br/>Initiate synthesis to activate economic phantoms.</p>
             </div>
          </motion.div>
        )}

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16, 185, 129, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.4); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
