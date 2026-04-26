'use client'

import React, { useState } from 'react'
import { Pipette, Sparkles, RotateCcw, Fingerprint, Eye, Scissors, BoxSelect } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ChromaKeySettings {
  enabled: boolean
  color: string
  tolerance: number
  spill: number
  edge: number
  opacity: number
}

const DEFAULT_CHROMA: ChromaKeySettings = {
  enabled: false,
  color: '#00ff00',
  tolerance: 0.40,
  spill: 0.50,
  edge: 0.25,
  opacity: 1,
}

const PRESET_COLORS = [
  { name: 'Green', hex: '#00ff00' },
  { name: 'Blue', hex: '#0000ff' },
  { name: 'Magenta', hex: '#ff00ff' },
  { name: 'Custom', hex: '' },
]

interface ChromakeyViewProps {
  chromaKey: ChromaKeySettings
  setChromaKey: (v: ChromaKeySettings | ((prev: ChromaKeySettings) => ChromaKeySettings)) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ChromakeyView: React.FC<ChromakeyViewProps> = ({ chromaKey, setChromaKey, showToast }) => {
  const [customColor, setCustomColor] = useState(chromaKey.color)
  const [activePreview, setActivePreview] = useState<boolean>(false)
  const [samMode, setSamMode] = useState<boolean>(false)
  const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

  const setPreset = (hex: string) => {
    if (hex) {
      setChromaKey((prev) => ({ ...prev, color: hex }))
      setCustomColor(hex)
      showToast('Neural chroma target locked', 'info')
    }
  }

  const reset = () => {
    setChromaKey(DEFAULT_CHROMA)
    setCustomColor(DEFAULT_CHROMA.color)
    showToast('Chroma extraction reset', 'info')
  }

  return (
    <div className="space-y-8 pb-6 max-w-5xl mx-auto">
      {/* Elite Sub-Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-left pt-4">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.4em] italic text-emerald-400 shadow-xl">
            <Sparkles className="w-4 h-4 animate-pulse" />
            Neural Extraction
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
            CHROMA<br />ENGINE
          </h1>
          <p className="text-slate-500 text-lg font-medium tracking-tight max-w-md">
            Execute <span className="text-white font-black italic underline decoration-emerald-500/30 underline-offset-8">computational</span> background removal to composite subjects flawlessly in the Neural Distribution Matrix.
          </p>
        </div>
      </div>

      <div className={`relative p-8 rounded-[3rem] border transition-all duration-700 overflow-hidden ${glassStyle} ${chromaKey.enabled ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.15)]' : 'border-white/10'}`}>
        <div className="absolute top-8 right-8 flex gap-3">
          <button
            onClick={() => setActivePreview(!activePreview)}
            title={activePreview ? "Disable AI Preview" : "Enable AI Preview"}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[9px] font-black uppercase italic transition-all ${activePreview ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
          >
            <Eye className={`w-3 h-3 ${activePreview ? 'animate-pulse' : ''}`} />
            AI Render Preview
          </button>
        </div>

        <div className="flex items-center gap-6 mb-8 mt-4">
          <div className={`w-20 h-20 rounded-[1.8rem] shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center justify-center border transition-colors duration-500 ${chromaKey.enabled ? 'bg-gradient-to-br from-emerald-400 to-teal-600 border-white/20' : 'bg-black/50 border-white/5 grayscale'}`}>
            <Pipette className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Subject Isolation</h3>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Green Screen Engine</p>
          </div>
        </div>

        <AnimatePresence>
          {activePreview && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-8">
              <div className="h-64 rounded-[2.5rem] bg-black/60 border border-white/10 shadow-inner relative flex items-center justify-center overflow-hidden p-6 group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,theme(colors.emerald.900/40),transparent_70%)] opacity-30 group-hover:opacity-60 transition-opacity" />
                {/* Simulated Matrix Background Extraction */}
                <div className="absolute inset-0 z-0 bg-transparent flex items-center justify-center">
                  <div className={`absolute inset-0 backdrop-blur-sm transition-all duration-[2s] ${chromaKey.enabled ? 'bg-emerald-500/5' : 'bg-[#00ff00]'}`} style={{ backgroundColor: chromaKey.enabled ? 'transparent' : chromaKey.color }} />
                  <div className={`absolute inset-0 border-[4px] border-dashed rounded-[2rem] m-6 transition-all duration-[2s] ${chromaKey.enabled ? 'border-emerald-500/30 rotate-3 scale-105 opacity-100' : 'border-black/20 opacity-30'}`} />
                </div>
                {/* Subject Placeholder */}
                <div className="relative z-10 w-32 h-48 bg-gradient-to-b from-white/90 to-slate-400/90 rounded-[2rem] border border-white/20 shadow-2xl flex items-center justify-center mt-12 group-hover:scale-105 transition-transform">
                  <Fingerprint className={`w-12 h-12 ${chromaKey.enabled ? 'text-emerald-500/50' : 'text-black/20'}`} />
                </div>
                {/* Holographic readout */}
                {chromaKey.enabled && (
                  <div className="absolute top-6 left-8 z-20 space-y-2">
                    <div className="px-3 py-1 rounded bg-black/40 border border-emerald-500/30 text-[9px] font-mono text-emerald-400">TOL: {(chromaKey.tolerance * 100).toFixed(0)}%</div>
                    <div className="px-3 py-1 rounded bg-black/40 border border-emerald-500/30 text-[9px] font-mono text-emerald-400">SPL: {(chromaKey.spill * 100).toFixed(0)}%</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-10 relative z-10">
          <div className="p-6 bg-black/40 rounded-[2rem] border border-white/5 flex items-center justify-between">
            <div>
              <h4 className="text-white font-bold text-lg mb-1">Engage Isolation Matrix</h4>
              <p className="text-xs text-slate-500">Activates realtime background extraction on render</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer group" title="Enable Isolation Matrix">
              <input type="checkbox" className="sr-only peer" checked={chromaKey.enabled} onChange={(e) => setChromaKey((prev) => ({ ...prev, enabled: e.target.checked }))} title="Toggle Chroma Key" />
              <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 border border-white/20 shadow-inner overflow-hidden">
                <div className={`absolute inset-0 bg-emerald-400/30 blur-md ${chromaKey.enabled ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
              </div>
            </label>
          </div>

          <div className={`transition-opacity duration-500 ${chromaKey.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 ml-2">Target Extraction Color</h4>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {PRESET_COLORS.filter((p) => p.hex).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPreset(p.hex)}
                  className={`w-14 h-14 rounded-2xl border-2 transition-all shadow-xl hover:scale-110 ${chromaKey.color.toLowerCase() === p.hex.toLowerCase() ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10 hover:border-white/30'}`}
                  style={{ backgroundColor: p.hex }}
                  title={p.name}
                />
              ))}
              <div className="w-px h-10 bg-white/10 mx-2" />
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={chromaKey.color}
                    onChange={(e) => { setChromaKey((prev) => ({ ...prev, color: e.target.value })); setCustomColor(e.target.value) }}
                    title="Select Custom Chroma Color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className={`w-14 h-14 rounded-2xl border-2 transition-all shadow-xl ${!PRESET_COLORS.some(p => p.hex.toLowerCase() === chromaKey.color.toLowerCase()) ? 'border-white scale-110 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'border-white/10'}`} style={{ backgroundColor: chromaKey.color }} />
                </div>
                <input
                  type="text"
                  value={chromaKey.color}
                  onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) { setChromaKey((prev) => ({ ...prev, color: v })); setCustomColor(v) } }}
                  title="Hex Color Code"
                  className="w-28 px-4 py-3 rounded-xl border border-white/5 bg-black/40 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-emerald-500/50"
                  placeholder="#00ff00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Tolerance', prop: 'tolerance' as keyof ChromaKeySettings, desc: 'Color match breadth' },
                { label: 'Spill Suppression', prop: 'spill' as keyof ChromaKeySettings, desc: 'Color bounce removal' },
                { label: 'Edge Softness', prop: 'edge' as keyof ChromaKeySettings, desc: 'Border feathering' }
              ].map((slider) => (
                <div key={slider.prop} className="bg-black/40 p-5 rounded-[1.5rem] border border-white/5 group hover:border-emerald-500/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{slider.label}</span>
                      <span className="block text-[9px] text-slate-600 uppercase tracking-wider">{slider.desc}</span>
                    </div>
                    <span className="text-white font-mono text-xs bg-white/5 px-2 py-1 rounded">{(chromaKey[slider.prop] as number).toFixed(2)}</span>
                  </div>
                   <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={chromaKey[slider.prop] as number}
                    onChange={(e) => setChromaKey((prev) => ({ ...prev, [slider.prop]: Number(e.target.value) }))}
                    title={`Adjust ${slider.label}`}
                    aria-label={`Adjust ${slider.label}`}
                    className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none"
                    style={{ background: `linear-gradient(to right, #10b981 ${(chromaKey[slider.prop] as number) * 100}%, rgba(255,255,255,0.05) ${(chromaKey[slider.prop] as number) * 100}%)` }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={reset}
                  title="Reset Chroma Engine Parameters"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Parameters
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* SAM Neural Segment Module */}
      <div className={`${glassStyle} rounded-[3rem] p-10 mt-8 relative overflow-hidden group`}>
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
           <Scissors className="w-40 h-40 text-blue-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-[1.2rem] transition-all ${samMode ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-white/5 text-slate-500'}`}>
              <BoxSelect className={`w-6 h-6 ${samMode ? 'animate-pulse' : ''}`} />
            </div>
            <div>
               <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none uppercase">SAM ENGINE v4</h2>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block italic">Neural Subject Isolation (No Green Screen)</span>
            </div>
          </div>
          <div className="flex gap-4">
            {samMode && (
              <button
                onClick={() => showToast('Optimization routine running...', 'info')}
                title="Optimize Neural Weights"
                className="px-6 py-4 rounded-[1.5rem] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
              >
                Optimize Weights
              </button>
            )}
            <button
              onClick={() => {
                setSamMode(!samMode)
                showToast(samMode ? 'SAM Node Offline' : 'SAM Model Loaded - Points Initialized', 'success')
              }}
              title={samMode ? 'Disengage SAM Engine' : 'Engage SAM Engine'}
              className={`px-10 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] italic transition-all border ${samMode ? 'bg-blue-600 text-white border-blue-400 shadow-2xl' : 'bg-white/5 text-slate-500 border-white/10 hover:bg-white/10 hover:text-white'}`}
            >
              {samMode ? 'DISENGAGE ENGINE' : 'ENGAGE SAM MATRIX'}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {samMode && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-8 relative z-10">
               {/* SAM Point Map Visualization */}
               <div className="h-48 rounded-[2rem] bg-black/40 border border-white/10 relative overflow-hidden group/points flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),transparent_70%)]" />
                  <div className="grid grid-cols-12 gap-2 w-full max-w-2xl opacity-40 group-hover/points:opacity-100 transition-opacity">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.2, 0.6, 0.2]
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                          delay: Math.random() * 2
                        }}
                        className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-16 h-16 border-2 border-blue-500 rounded-full animate-ping opacity-20" />
                     <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.5em] italic bg-black/80 px-4 py-2 rounded-full border border-blue-500/30">Targeting Subject Matrix</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Neural Points', val: '1,024', sub: 'Active Sampling', color: 'text-blue-500' },
                    { label: 'Prompt Type', val: 'Automatic', sub: 'Zero-Click Isolation', color: 'text-emerald-500' },
                    { label: 'Mask Refinement', val: 'Extreme', sub: 'Edge Anti-Aliasing', color: 'text-amber-500' },
                    { label: 'Inference Time', val: '42ms', sub: 'Real-time Feed', color: 'text-rose-500' }
                  ].map((stat, i) => (
                    <div key={i} className="p-6 bg-black/40 rounded-[1.8rem] border border-white/5 space-y-2 group/stat hover:border-white/10 transition-colors">
                       <span className="block text-[8px] font-black uppercase tracking-widest text-slate-600 group-hover/stat:text-slate-400">{stat.label}</span>
                       <span className="block text-2xl font-black text-white italic tracking-tighter">{stat.val}</span>
                       <span className={`block text-[9px] ${stat.color} font-bold uppercase tracking-widest`}>{stat.sub}</span>
                    </div>
                  ))}
               </div>

               <div className="p-8 bg-blue-500/5 border border-blue-500/20 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                     <div className="relative">
                       <div className="w-12 h-12 rounded-full border-4 border-white/5" />
                       <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-t-blue-500 animate-spin" />
                     </div>
                     <div className="space-y-1">
                        <p className="text-xs text-slate-200 font-black italic uppercase tracking-wider">Subject Continuity Active</p>
                        <p className="text-[10px] text-slate-500 font-medium italic">Scanning frames for temporal stability. Alpha mask consistency: 99.8%</p>
                     </div>
                  </div>
                   <div className="flex gap-4 w-full md:w-auto">
                     <button title="Refine Segmentation Edges" className="flex-1 md:flex-none px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase rounded-xl transition-all border border-white/5">Refine Edges</button>
                     <button title="Extract Alpha Mask" className="flex-1 md:flex-none px-6 py-3 bg-blue-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-400 transition-colors">Extract Alpha</button>
                   </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!samMode && (
          <div className="text-center py-12 relative">
             <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <BoxSelect className="w-64 h-64 text-slate-800" />
             </div>
             <p className="text-[10px] text-slate-700 font-black uppercase tracking-[0.3em] italic relative z-10">Waiting for Engine Initiation...</p>
             <button
               onClick={() => { setSamMode(true); showToast('SAM Model Initialized', 'success') }}
               className="mt-6 px-10 py-3 rounded-full bg-white/5 border border-white/5 text-[9px] font-black text-slate-500 hover:text-white hover:border-white/10 transition-all uppercase tracking-[0.2em] relative z-10"
             >
               Initialize Model
             </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChromakeyView
