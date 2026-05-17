'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import { apiPost } from '../../../lib/api'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import {
  Sparkles, Download, RefreshCw, Quote, ArrowLeft,
  Target, Radio, Layers, Terminal, ArrowUpRight, Hexagon, Fingerprint, Boxes
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, AnimatePresence } from 'framer-motion'

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
  // Use current page origin as fallback so this works in any deployment
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`
  return path
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
      showToast('Could not sync: FISCAL_OVERLOAD', 'error')
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
      <div className="min-h-screen relative z-10 pb-32 px-4 sm:px-10 pt-16 max-w-[1700px] mx-auto space-y-24 font-inter bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.01]">
           <Hexagon size={1200} className="text-surface-900 dark:text-white absolute -bottom-40 -left-60 rotate-12 blur-[1px]" />
           <Target size={1000} className="text-surface-900 dark:text-white absolute -top-80 -right-60 rotate-[32deg] blur-[2px]" />
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
                type="button"
                onClick={() => router.push('/dashboard')} 
                title="Abort Session"
                className="w-20 h-20 rounded-[2.5rem] bg-surface-card border-2 border-surface-200 dark:border-white/10 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all duration-700 hover:scale-110 active:scale-90 shadow-lg hover:border-primary-500/50 backdrop-blur-3xl group"
              >
                <ArrowLeft size={36} className="group-hover:-translate-x-2 transition-transform duration-700" />
              </button>
              <div className="w-24 h-24 bg-primary-500/5 border-2 border-primary-500/20 rounded-[3rem] flex items-center justify-center shadow-lg relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-100" />
                <Quote size={48} className="text-primary-500 relative z-10 group-hover:scale-125 group-hover:-rotate-12 transition-transform duration-300 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-4">
                   <div className="flex items-center gap-3">
                      <Fingerprint size={16} className="text-primary-500 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.8em] text-primary-500 italic leading-none">Fiscal Engine v8.2.1</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-surface-card/60 border-2 border-surface-200 dark:border-white/5 shadow-inner">
                       <Radio size={14} className="text-primary-500 animate-pulse" />
                       <span className="text-[10px] font-black text-surface-400 tracking-widest uppercase italic leading-none">MARKET_SYMPATHY_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-5xl md:text-6xl font-black text-surface-900 dark:text-white tracking-tight leading-[1.05] mb-3">Quotes</h1>
                 <p className="text-surface-500 dark:text-surface-400 text-sm md:text-base font-medium leading-relaxed max-w-2xl mt-3">Generate and send client quotes — line items, deliverables, totals — all niche-templated. Edit, re-send, or accept right from this page.</p>
              </div>
           </div>
        </header>

        {/* Proposal Ingress Terminal */}
        <div className="max-w-5xl mx-auto relative z-10 w-full pt-10">
           <div className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-primary-500/20 rounded-[6rem] overflow-hidden group shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-b from-primary-500/[0.02] to-transparent pointer-events-none" />
              <div className="px-8 sm:px-16 py-12 border-b-2 border-surface-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between bg-surface-page/30 dark:bg-white/[0.01] relative overflow-hidden gap-6">
                 <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-transparent opacity-30" />
                 <div className="flex items-center gap-8 relative z-10">
                    <div className="w-16 h-16 bg-primary-500/10 rounded-[2rem] flex items-center justify-center border-2 border-primary-500/20 shadow-xl group-hover:scale-110 transition-transform duration-300"><Terminal size={32} className="text-primary-500" /></div>
                    <h2 className="font-black text-surface-900 dark:text-white italic uppercase tracking-tighter text-4xl sm:text-5xl leading-none">Economic Ingress</h2>
                 </div>
                 <div className="flex items-center gap-5 relative z-10">
                    <span className="text-[12px] font-black text-surface-400 uppercase tracking-[0.4em] italic leading-none">SYCHRONIZED_INPUT_STREAM</span>
                    <div className="w-3 h-3 rounded-full bg-primary-500 shadow-[0_0_20px_rgba(16,185,129,1)] animate-ping" />
                 </div>
              </div>

              <div className="p-8 sm:p-20 space-y-20 relative z-10">
                 <div className="space-y-10">
                    <div className="flex items-center gap-6 border-l-8 border-primary-500 pl-8 py-2">
                       <label htmlFor="wisdom-id" className="text-[14px] font-black text-surface-400 uppercase tracking-[0.8em] italic leading-none">Economic Directive Payload</label>
                    </div>
                    <textarea
                      id="wisdom-id"
                      value={wisdomPayload}
                      onChange={(e) => setWisdomPayload(e.target.value)}
                      placeholder="INPUT_MARKET_LOGIC_PARTICLE..."
                      rows={6}
                      className="w-full bg-surface-page dark:bg-black/80 border-2 border-surface-200 dark:border-white/5 rounded-[4rem] px-8 sm:px-20 py-16 text-2xl sm:text-3xl font-black text-surface-900 dark:text-white uppercase tracking-widest italic focus:outline-none focus:border-primary-500/50 transition-all placeholder:text-surface-300 dark:placeholder:text-slate-600 leading-relaxed resize-none shadow-inner backdrop-blur-3xl"
                      disabled={loading}
                      title="Directive Ingress"
                    />
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-20">
                    <div className="space-y-12">
                       <div className="flex items-center gap-6 border-l-4 border-surface-200 dark:border-slate-900 pl-6 py-1">
                          <label className="text-[14px] font-black text-surface-400 uppercase tracking-[0.6em] italic leading-none">Fiscal Resonance Bias</label>
                       </div>
                       <div className="flex flex-wrap gap-6">
                          {FISCAL_POLARITY.map((s) => (
                             <button
                               type="button"
                               key={s.value}
                               onClick={() => setSpectralPolarity(s.value)}
                               disabled={loading}
                               className={`px-12 sm:px-16 py-6 sm:py-8 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.6em] border-2 transition-all duration-300 italic shadow-lg relative overflow-hidden group/pol ${spectralPolarity === s.value ? 'bg-surface-900 dark:bg-white text-white dark:text-black border-transparent scale-105 shadow-primary-500/40' : 'bg-surface-page/40 dark:bg-white/[0.02] border-surface-200 dark:border-white/5 text-surface-400 hover:text-surface-900 dark:hover:text-white hover:border-primary-500/30'}`}
                             >
                                 <span className="relative z-10">{s.label}</span>
                                 <div className={`absolute inset-0 bg-primary-500/10 opacity-0 group-hover/pol:opacity-100 transition-opacity duration-300 ${spectralPolarity === s.value ? 'hidden' : ''}`} />
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="flex items-end">
                       <button
                         type="button"
                         onClick={handleWisdomSynthesis}
                         disabled={loading || !wisdomPayload.trim()}
                         className="w-full h-24 flex items-center justify-center gap-10 bg-surface-900 dark:bg-white border-8 border-transparent hover:border-primary-500/30 text-white dark:text-black rounded-[4rem] font-black text-[18px] sm:text-[22px] shadow-xl hover:shadow-primary-500/50 transition-all duration-300 active:scale-95 italic uppercase tracking-[0.8em] group/forge disabled:opacity-20"
                       >
                         {loading ? <RefreshCw className="w-10 h-10 animate-spin" /> : <Sparkles size={40} className="group-hover:rotate-12 transition-transform duration-300 fill-current" />}
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
               <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-surface-100 dark:border-white/5 pb-8 gap-8">
                  <div className="flex items-center gap-10">
                     <div className="w-16 h-16 bg-primary-500/10 border-2 border-primary-500/20 rounded-[2rem] flex items-center justify-center shadow-lg"><Layers size={32} className="text-primary-500" /></div>
                     <div>
                        <h2 className="text-4xl sm:text-6xl font-black text-surface-900 dark:text-white italic uppercase tracking-tighter leading-none mb-2">Fiscal Manifests</h2>
                        <p className="text-[12px] font-black text-surface-400 uppercase tracking-[0.6em] italic leading-none">Synthesized economic directives calibrated for high- resonance output.</p>
                     </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setWisdomPayload(''); setFractals([]) }}
                    className="px-12 py-6 bg-surface-card border-2 border-surface-200 dark:border-white/10 rounded-[3rem] text-[13px] font-black uppercase tracking-[0.4em] text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-page transition-all italic active:scale-95 shadow-lg group"
                  >
                    <RefreshCw size={20} className="inline mr-4 group-hover:rotate-180 transition-transform duration-300" /> REBOOT_FISCAL_FORGE
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20">
                  {fractals.map((fractal, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      key={idx}
                      className="bg-surface-card backdrop-blur-3xl border border-surface-200 dark:border-white/10 rounded-[5rem] overflow-hidden group hover:border-primary-500/40 hover:bg-surface-page/50 dark:hover:bg-white/[0.04] shadow-2xl flex flex-col relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="aspect-[4/5] relative overflow-hidden bg-black border-b-2 border-surface-100 dark:border-white/5">
                        <img
                          src={getImageUrl(fractal.imageUrl)}
                          alt={fractal.quote}
                          className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-300" />
                        
                        <div className="absolute top-10 right-10 p-6 rounded-[2.5rem] bg-black/80 backdrop-blur-3xl border-2 border-white/10 opacity-0 group-hover:opacity-100 transition-all translate-y-6 group-hover:translate-y-0 duration-300 shadow-xl">
                           <Target size={36} className="text-primary-500 group-hover:rotate-[360deg] transition-transform duration-500" />
                        </div>
                        <div className="absolute bottom-10 left-10 p-6 rounded-[2.5rem] bg-primary-600/20 backdrop-blur-3xl border-2 border-primary-500/20 opacity-0 group-hover:opacity-100 transition-all -translate-x-6 group-hover:translate-x-0 duration-300 shadow-xl">
                           <Boxes size={36} className="text-white animate-pulse" />
                        </div>
                      </div>
                      
                      <div className="p-8 sm:p-16 space-y-12 flex-1 flex flex-col justify-between relative z-10">
                         <div className="space-y-8">
                            <div className="flex items-center gap-5">
                               <div className="w-2 h-12 bg-primary-500 rounded-full shadow-[0_0_30px_rgba(16,185,129,1)]" />
                               <p className="text-[13px] font-black text-primary-500 uppercase tracking-[0.8em] italic leading-none">ECON_DIRECTIVE_ALPHA</p>
                            </div>
                            <p className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white italic leading-tight tracking-tighter uppercase group-hover:text-primary-500 transition-colors duration-300 line-clamp-4">
                             &ldquo;{fractal.quote.toUpperCase()}&rdquo;
                            </p>
                            <p className="text-[14px] font-black text-surface-400 uppercase tracking-[0.4em] italic leading-none border-t-2 border-surface-100 dark:border-white/5 pt-8">— AUTH_ID: {fractal.author.toUpperCase() || 'ANONYMOUS_AGENT'}</p>
                         </div>
                         
                         <div className="pt-12 flex gap-8">
                            <button
                              type="button"
                              onClick={() => handleFractalExtraction(fractal)}
                              className="flex-1 flex items-center justify-center gap-6 py-6 sm:py-8 bg-surface-900 dark:bg-white text-white dark:text-black hover:bg-primary-600 hover:text-white rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] transition-all duration-300 italic shadow-xl group/ext active:scale-95 border-none"
                            >
                              <Download size={28} className="group-hover/ext:translate-y-2 transition-transform duration-700" /> EXTRACT_MANIFEST
                            </button>
                            <button
                               type="button"
                               className="w-20 sm:w-24 h-20 sm:h-24 bg-surface-page dark:bg-white/[0.03] border-2 border-surface-200 dark:border-white/10 text-surface-400 hover:text-surface-900 dark:hover:text-white rounded-[2.5rem] flex items-center justify-center transition-all duration-300 hover:rotate-12 hover:bg-surface-card active:scale-90 hover:border-primary-500/50 backdrop-blur-3xl group/res"
                               title="Analyze"
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
             <div className="w-56 h-56 bg-surface-page dark:bg-white/5 rounded-[6rem] border-4 border-dashed border-surface-200 dark:border-white/10 flex items-center justify-center shadow-2xl relative">
                <Boxes size={120} className="text-surface-900 dark:text-white animate-pulse" />
             </div>
             <div className="space-y-10">
                <p className="text-5xl sm:text-7xl font-black text-surface-900 dark:text-white uppercase tracking-[1em] italic leading-none">Fiscal Void</p>
                <p className="text-[16px] sm:text-[20px] font-black text-surface-400 uppercase tracking-[0.8em] italic leading-relaxed">No strategic manifests detected in current sector.<br/>Initiate synthesis to activate economic phantoms.</p>
             </div>
          </motion.div>
        )}
      </div>
    </ErrorBoundary>
  )
}
