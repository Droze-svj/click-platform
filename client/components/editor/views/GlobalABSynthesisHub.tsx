'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Split,
  Globe,
  Zap,
  ChevronRight,
  Layers,
  Play,
  ShieldCheck,
  Cpu,
  BarChart3,
  Fingerprint,
  Users
} from 'lucide-react'

interface ABMetadata {
  region: string;
  style: string;
  fidelity: number;
  coherence: number;
  latency: string;
  color: string;
  engagement: number[]; // 0-100 scores across 10 segments
}

const GlobalABSynthesisHub: React.FC<{
  onClose: () => void;
  onStyleFix?: (region: string, segments: number[]) => void;
  onExportWhop?: (region: string) => void;
  onSyncFeedback?: (region: string, engagement: number[]) => void;
}> = ({ onClose, onStyleFix, onExportWhop, onSyncFeedback }) => {
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [showHeatMap, setShowHeatMap] = useState(false)
  const [fixedRegions, setFixedRegions] = useState<string[]>([])
  const [exportedRegions, setExportedRegions] = useState<string[]>([])
  const [syncedRegions, setSyncedRegions] = useState<string[]>([])

  const naMeta: ABMetadata = {
    region: 'North America',
    style: 'Minimalist',
    fidelity: 0.9842,
    coherence: 0.991,
    latency: '12ms',
    color: '#60a5fa',
    engagement: [85, 92, 45, 88, 76, 95, 82, 90, 88, 94]
  }

  const apacMeta: ABMetadata = {
    region: 'Asia Pacific',
    style: 'Cyberpunk',
    fidelity: 0.9755,
    coherence: 0.988,
    latency: '18ms',
    color: '#c084fc',
    engagement: [72, 85, 96, 91, 98, 88, 94, 99, 92, 95]
  }

  const handleFixed = (region: string, segments: number[]) => {
    setFixedRegions(prev => [...prev, region]);
    if (onStyleFix) onStyleFix(region, segments);
  }

  const handleExport = (region: string) => {
    setExportedRegions(prev => [...prev, region]);
    if (onExportWhop) onExportWhop(region);
  }

  const handleSync = (region: string, engagement: number[]) => {
    setSyncedRegions(prev => [...prev, region]);
    if (onSyncFeedback) onSyncFeedback(region, engagement);
  }

  const handleRunTest = () => {
    setIsSynthesizing(true)
    setTimeout(() => setIsSynthesizing(false), 4000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-8 h-full bg-black/40 backdrop-blur-3xl rounded-[4rem] border border-white/10 p-12 overflow-hidden relative"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-6">
          <div className="p-4 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Split className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black uppercase tracking-[0.3em] italic text-white flex items-center gap-4">
              A/B Synthesis Hub
              <span className="text-[10px] px-3 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 non-italic tracking-widest">LAB_NODE_0X</span>
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">
                Regional Style-Bridge Contrast Analysis // Cross-Border Performance Modeling
              </p>
              <div className="h-3 w-[1px] bg-white/10" />
              <button
                onClick={() => setShowHeatMap(!showHeatMap)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest ${showHeatMap ? 'bg-indigo-500 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-white/5 border-white/10 text-slate-500'}`}
              >
                <Fingerprint className="w-2.5 h-2.5" />
                Performance Heatmap {showHeatMap ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleRunTest}
            disabled={isSynthesizing}
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all relative overflow-hidden group ${
              isSynthesizing ? 'bg-white/5 text-slate-500 animate-pulse cursor-wait' : 'bg-white text-black hover:bg-indigo-400 hover:scale-105 active:scale-95'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isSynthesizing ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  Synthesizing
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Initialize Test
                </>
              )}
            </span>
          </button>
          <button
            onClick={onClose}
            title="Close A/B Studio"
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Grid: Viewports */}
      <div className="flex-1 grid grid-cols-2 gap-12 relative z-10 min-h-0">
        <Viewport
          metadata={naMeta}
          active={isSynthesizing}
          showHeatMap={showHeatMap}
          onStyleFix={handleFixed}
          onExportWhop={handleExport}
          onSyncFeedback={handleSync}
          isFixed={fixedRegions.includes(naMeta.region)}
          isExported={exportedRegions.includes(naMeta.region)}
          isSynced={syncedRegions.includes(naMeta.region)}
        />
        <Viewport
          metadata={apacMeta}
          active={isSynthesizing}
          showHeatMap={showHeatMap}
          onStyleFix={handleFixed}
          onExportWhop={handleExport}
          onSyncFeedback={handleSync}
          isFixed={fixedRegions.includes(apacMeta.region)}
          isExported={exportedRegions.includes(apacMeta.region)}
          isSynced={syncedRegions.includes(apacMeta.region)}
        />

        {/* Comparison HUD Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-black border border-indigo-500/40 backdrop-blur-3xl flex flex-col items-center justify-center gap-2 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
           <Zap className="w-6 h-6 text-indigo-400" />
           <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">VS</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Aesthetic Conflict</span>
           </div>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between border-t border-white/5 pt-8 relative z-10">
         <div className="flex gap-12">
            <Stat label="Strategy Consistency" value="99.4%" sub="Shared Latent Origin" icon={ShieldCheck} />
            <Stat label="Total Variations" value="12,044" sub="Neural Permutations" icon={Layers} />
            <Stat label="Conversion Lift" value="+14.2%" sub="Predicted Delta" icon={BarChart3} />
         </div>
         <p className="text-[9px] text-slate-500 max-w-sm text-right italic leading-relaxed font-black uppercase tracking-widest">
           Comparing &ldquo;Aggressive Growth&rdquo; strategy across NA/APAC bridges.
           <br />
           <span className="text-white opacity-40">Style-DNA Injection: [Minimalist v Cyberpunk]</span>
         </p>
      </div>
    </motion.div>
  )
}

const Viewport: React.FC<{
  metadata: ABMetadata;
  active: boolean;
  showHeatMap: boolean;
  onStyleFix?: (region: string, segments: number[]) => void;
  onExportWhop?: (region: string) => void;
  onSyncFeedback?: (region: string, engagement: number[]) => void;
  isFixed?: boolean;
  isExported?: boolean;
  isSynced?: boolean;
}> = ({ metadata, active, showHeatMap, onStyleFix, onExportWhop, onSyncFeedback, isFixed, isExported, isSynced }) => {
  const [sliderPos, setSliderPos] = useState(50)

  return (
    <div className="flex flex-col gap-6 group">
      <div className="relative aspect-video rounded-[3rem] bg-white/[0.02] border border-white/5 overflow-hidden shadow-2xl transition-all duration-700 group-hover:border-indigo-500/30">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>

        {/* Simulation Content */}
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key="synthesizing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col p-12 justify-center items-center gap-6"
            >
                <div className="flex items-center gap-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [20, 60, 20] }}
                      transition={{ duration: 0.5 + Math.random(), repeat: Infinity, delay: i * 0.1 }}
                      className="w-1.5 rounded-full"
                      style={{ backgroundColor: metadata.color }}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-mono text-white tracking-[0.4em] uppercase">Synthesizing {metadata.style}...</p>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col justify-between p-10"
            >
                {/* Top Labels */}
                <div className="flex justify-between items-start relative z-20">
                  <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span className="text-[12px] font-black text-white uppercase tracking-widest italic">{metadata.region}</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{metadata.style} DNA</span>
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase">
                      Seed: 0x{metadata.region.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                {/* Media Content Area */}
                <div className="w-full h-32 rounded-[2rem] bg-white/[0.03] border border-white/[0.05] flex items-end justify-center relative group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden">
                  {/* Before/After Slider Container */}
                  {isFixed && !showHeatMap ? (
                    <div
                      className="absolute inset-0 cursor-ew-resize select-none"
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = ((e.clientX - rect.left) / rect.width) * 100
                          setSliderPos(Math.max(0, Math.min(100, x)))
                        }
                      }}
                    >
                      {/* After State (Full) */}
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center">
                         <div className="flex items-center gap-1 opacity-20">
                            {Array.from({ length: 40 }).map((_, i) => (
                               <motion.div
                                 key={i}
                                 animate={{ height: [10, 30, 10] }}
                                 transition={{ duration: 1, repeat: Infinity, delay: i * 0.05 }}
                                 className="w-0.5 bg-violet-400 rounded-full"
                               />
                            ))}
                         </div>
                      </div>

                      {/* Before State (Clipped) */}
                      <div
                        className="absolute inset-0 bg-slate-900/40 border-r border-white/20 overflow-hidden"
                        style={{ width: `${sliderPos}%` }}
                      >
                         <div className="w-[1000%] h-full flex items-center justify-center opacity-10">
                            <div className="flex items-center gap-1 bg-white/5 p-20 rounded-full">
                               <Play className="w-20 h-20 text-white fill-current opacity-5" />
                            </div>
                         </div>
                      </div>

                      {/* Slider Handle */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white z-30"
                        style={{ left: `${sliderPos}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-2xl border-4 border-black border-opacity-20 animate-pulse">
                          <Split className="w-4 h-4 rotate-90" />
                        </div>
                        <div className="absolute top-4 left-4 whitespace-nowrap px-2 py-1 bg-black/80 rounded text-[7px] font-black text-white uppercase tracking-tighter">
                          Before Style-Fix
                        </div>
                        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                          <div className="whitespace-nowrap px-2 py-1 bg-violet-600 rounded text-[7px] font-black text-white uppercase tracking-tighter">
                            After Fix (Motion+)
                          </div>
                          {onExportWhop && (
                            <div className="flex gap-2">
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   if (!isExported) onExportWhop(metadata.region);
                                 }}
                                 className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[8px] font-black uppercase tracking-widest ${
                                   isExported
                                     ? 'bg-white/10 border-white/20 text-white/40 cursor-default'
                                     : 'bg-white text-black border-white hover:bg-indigo-400 hover:text-white hover:scale-105 active:scale-95 shadow-xl'
                                 }`}
                               >
                                 {isExported ? (
                                   <>
                                     <ShieldCheck className="w-3 h-3" />
                                     Exported
                                   </>
                                 ) : (
                                   <>
                                     <Zap className="w-3 h-3 fill-current" />
                                     Export to Whop
                                   </>
                                 )}
                               </button>

                               {isExported && onSyncFeedback && (
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     if (!isSynced) onSyncFeedback(metadata.region, metadata.engagement);
                                   }}
                                   className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-[8px] font-black uppercase tracking-widest ${
                                     isSynced
                                       ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.6)] animate-pulse'
                                       : 'bg-indigo-600 text-white border-indigo-400 hover:bg-white hover:text-black hover:scale-105 shadow-xl'
                                   }`}
                                 >
                                   <BarChart3 className="w-3 h-3" />
                                   {isSynced ? 'DNA Evolved' : 'Sync Community DNA'}
                                 </button>
                               )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                      {/* Play Button */}
                      {!showHeatMap && (
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white z-10"
                        >
                            <Play className="w-5 h-5 fill-current" />
                        </motion.div>
                      )}

                      {/* HeatMap Overlay */}
                      <AnimatePresence>
                        {showHeatMap && (
                          <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="w-full h-full p-6 flex flex-col justify-end gap-2 relative z-10"
                          >
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <Fingerprint className="w-2 h-2 text-indigo-400" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Demographic Heatmap</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {onStyleFix && !isFixed && (
                                      <button
                                        onClick={() => onStyleFix(metadata.region, metadata.engagement.map((s, i) => s < 70 ? i : -1).filter(i => i !== -1))}
                                        className="px-2 py-0.5 rounded bg-violet-500 text-white text-[7px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-[0_0_10px_rgba(139,92,241,0.5)]"
                                      >
                                        Style Fix // Motion+
                                      </button>
                                    )}
                                    {isFixed && (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[7px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck className="w-2 h-2" />
                                        FIXED
                                      </span>
                                    )}
                                    <span className="text-[8px] font-mono text-indigo-400 uppercase">Attention Score</span>
                                </div>
                              </div>
                              <div className="flex items-end gap-1 h-12">
                                {metadata.engagement.map((score, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ height: '0%' }}
                                    animate={{ height: `${Number.isNaN(score) ? 0 : score}%` }}
                                    transition={{ delay: i * 0.05, duration: 1 }}
                                    className="flex-1 rounded-sm relative group/bar"
                                    style={{
                                      backgroundColor: score > 90 ? '#bef264' : score > 70 ? metadata.color : '#475569',
                                      opacity: 0.6 + (score / 200)
                                    }}
                                  >
                                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black border border-white/10 text-[7px] font-mono text-white opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20">
                                        {score}%
                                      </div>
                                  </motion.div>
                                ))}
                              </div>
                              <div className="flex justify-between text-[6px] font-mono text-slate-500 uppercase mt-1">
                                <span>0:00</span>
                                <span>Retention Zone</span>
                                <span>0:30</span>
                              </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                {/* Bottom Stats Grid */}
                <div className="grid grid-cols-2 gap-4 relative z-20">
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-600 uppercase">Neural Fidelity</span>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-black text-white italic">{metadata.fidelity}</span>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${metadata.fidelity * 100}%` }} className="h-full bg-indigo-500" />
                        </div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-600 uppercase">Coherence</span>
                      <div className="flex items-end gap-2">
                        <span className="text-xl font-black text-white italic">{metadata.coherence}</span>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${metadata.coherence * 100}%` }} className="h-full bg-violet-500" />
                        </div>
                      </div>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const Stat: React.FC<{ label: string, value: string, sub: string, icon: any }> = ({ label, value, sub, icon: Icon }) => (
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex flex-col">
       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
       <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white italic">{value}</span>
          <span className="text-[8px] font-black text-slate-600 uppercase">{sub}</span>
       </div>
    </div>
  </div>
)

export default GlobalABSynthesisHub
