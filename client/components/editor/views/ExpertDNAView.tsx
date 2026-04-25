'use client'

import React, { useState, useEffect } from 'react'
import { 
  Dna, 
  Sparkles, 
  Terminal, 
  Cpu, 
  BarChart3, 
  Settings2, 
  Maximize2, 
  TrendingUp, 
  Activity,
  Infinity,
  Split,
  ChevronRight, RefreshCw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'

interface GeneticMarker {
  id: string
  markerName: string
  strength: number
  attributes: Record<string, string>
  timestamp: string
  isMutated?: boolean
}

interface DNAAnalysis {
  niche: string
  geneticMarkers: GeneticMarker[]
  consensusStability: number
  recommendation: string
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const ExpertDNAView: React.FC = () => {
    const [dna, setDna] = useState<DNAAnalysis | null>(null)
    const [loading, setLoading] = useState(true)
    const [randomness, setRandomness] = useState(0.2)
    const [isMining, setIsMining] = useState(false)

    useEffect(() => {
        fetchDNA()
    }, [])

    const fetchDNA = async () => {
        setLoading(true)
        try {
            const data = await apiGet(`/phase16_18/dna/mine?randomness=${randomness}`)
            setDna(data)
        } catch (err) {
            console.error('DNA Mining failed')
        } finally {
            setLoading(false)
        }
    }

    const mineDNA = async () => {
        setIsMining(true)
        // In real use, this would trigger a deep analysis of the swarm Intelligence store
        setTimeout(() => {
            fetchDNA()
            setIsMining(false)
        }, 1500)
    }

    const handleRandomnessChange = (val: number) => {
        setRandomness(val)
        // Throttle would be better here, but we'll do simple state for now
    }

    if (loading && !dna) return <div className="h-96 flex items-center justify-center"><Dna className="w-8 h-8 animate-spin text-indigo-500" /></div>

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-[1.2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                        <Dna className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none uppercase">Expert Style DNA</h4>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 block italic text-indigo-500/70">Autonomous Stylistic Extraction Engine</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                   <div className={`${glassStyle} px-6 py-3 rounded-2xl flex items-center gap-8`}>
                      <div className="space-y-2 flex-1 min-w-[120px]">
                         <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Creative Randomness</span>
                             <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">{(randomness * 100).toFixed(0)}%</span>
                         </div>
                         <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.05"
                            value={randomness}
                            onChange={(e) => handleRandomnessChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                         />
                      </div>
                   </div>
                   <button 
                    onClick={mineDNA}
                    disabled={isMining}
                    className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] italic shadow-2xl transition-all"
                   >
                       {isMining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                       Mine Expert DNA
                   </button>
                </div>
            </div>

            {/* DNA Visualization */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left: Genetic Markers */}
                <div className="xl:col-span-2 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-10 space-y-8`}>
                        <div className="flex items-center justify-between">
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Genetic Markers</h5>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{dna?.geneticMarkers.length} Patterns Extracted</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {dna?.geneticMarkers.map((marker, idx) => (
                                <motion.div 
                                    key={idx}
                                    layout
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="p-6 bg-black/40 border border-white/5 rounded-3xl group hover:border-indigo-500/30 transition-all relative overflow-hidden"
                                >
                                    <div className="flex flex-col gap-4 relative z-10">
                                       <div className="flex items-center justify-between">
                                          <h6 className="text-xs font-black text-white uppercase tracking-widest italic truncate max-w-[140px]">{marker.markerName}</h6>
                                          {marker.isMutated && <Split className="w-3 h-3 text-amber-500" />}
                                       </div>
                                       
                                       <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[8px] font-black text-slate-600 uppercase">Viral Affinity</span>
                                             <span className="text-[8px] font-black text-indigo-400 uppercase">{(marker.strength * 100).toFixed(0)}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                             <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${marker.strength * 100}%` }}
                                                className={`h-full ${marker.isMutated ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                             />
                                          </div>
                                       </div>

                                       <div className="flex flex-wrap gap-2 pt-2">
                                          {Object.entries(marker.attributes).map(([k, v], i) => (
                                              <span key={i} className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[7px] font-black text-slate-400 uppercase tracking-widest">
                                                  {v}
                                              </span>
                                          ))}
                                       </div>
                                    </div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] -mr-16 -mt-16 pointer-events-none" />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Stability & Recommendation */}
                <div className="xl:col-span-1 space-y-6">
                    <div className={`${glassStyle} rounded-[2.5rem] p-8 space-y-8`}>
                        <div className="flex items-center gap-4">
                            <Activity className="w-6 h-6 text-emerald-400" />
                            <h5 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">Stability Analaysis</h5>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 bg-black/40 border border-white/5 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consensus Stability</span>
                                <h3 className={`text-5xl font-black italic tracking-tighter leading-none uppercase ${
                                    (dna?.consensusStability ?? 0) > 0.7 ? 'text-emerald-400' : 'text-amber-400'
                                }`}>
                                    {((dna?.consensusStability ?? 0) * 100).toFixed(0)}%
                                </h3>
                            </div>

                            <div className="p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-4 relative overflow-hidden">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Growth Recommendation</span>
                                </div>
                                <p className="text-xs font-bold text-white italic leading-relaxed relative z-10">
                                    {dna?.recommendation}
                                </p>
                                <div className="absolute bottom-0 right-0 p-4 opacity-5">
                                    <TrendingUp className="w-16 h-16" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-indigo-600 rounded-[2.5rem] space-y-4 text-white hover:scale-[1.02] transition-all cursor-pointer group">
                        <div className="flex items-center justify-between">
                            <Infinity className="w-8 h-8 opacity-80" />
                            <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic tracking-tighter leading-none uppercase">Aesthetic Drift Hub</h3>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Predict future stylistic shifts</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
