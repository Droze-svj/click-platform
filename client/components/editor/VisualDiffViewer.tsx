'use client'

import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Play, 
  Pause, 
  Split, 
  Eye, 
  Sparkles, 
  Info,
  ChevronRight,
  ArrowRight,
  Layers,
  Wand2,
  CheckCircle2
} from 'lucide-react'

interface VisualDiffViewerProps {
  originalUrl: string;
  originalTimeline?: any;
  v2Timeline?: any;
  v2Explanation?: string;
  onAccept: () => void;
  onClose: () => void;
}

const VisualDiffViewer: React.FC<VisualDiffViewerProps> = ({ 
  originalUrl, 
  originalTimeline, 
  v2Timeline, 
  v2Explanation, 
  onAccept, 
  onClose 
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const originalVideoRef = useRef<HTMLVideoElement>(null)
  
  // Sync logic if we had two videos, but here we have one video + proposed changes
  const handlePlayPause = () => {
    if (originalVideoRef.current) {
      if (isPlaying) originalVideoRef.current.pause()
      else originalVideoRef.current.play()
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col p-8 sm:p-12 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-[0.2em] italic text-violet-400 flex items-center gap-4">
            <Split className="w-8 h-8" />
            AI Revision Diff
          </h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
            Comparing Human Original vs. Click AI Proposal
          </p>
        </div>
        <div className="flex items-center gap-4">
           <button
             onClick={onClose}
             className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
           >
             [ Exit Comparison ]
           </button>
           <button
             onClick={onAccept}
             className="px-8 py-3 rounded-xl bg-violet-500 text-black text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-[0_10px_30px_rgba(139,92,246,0.4)] flex items-center gap-2"
           >
             <CheckCircle2 className="w-4 h-4" />
             Accept & Apply Revision
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 flex-1 min-h-0">
        {/* Master Original Panel */}
        <div className="flex flex-col gap-6">
           <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-slate-500" />
                 Source Authority
              </span>
              <span className="text-[9px] font-mono text-slate-600 uppercase">Version 1.0 (Current)</span>
           </div>
           <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[3rem] overflow-hidden relative group">
              <video 
                ref={originalVideoRef}
                src={originalUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                muted
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                 <button className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                    {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                 </button>
              </div>
           </div>
           {/* Timeline/Meta Summary for Original */}
           <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Structural Baseline</p>
              <div className="grid grid-cols-3 gap-4">
                 <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[8px] text-slate-500 uppercase">Transitions</span>
                    <p className="text-sm font-black text-white italic mt-1">Liner / Standard</p>
                 </div>
                 <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[8px] text-slate-500 uppercase">Color Grade</span>
                    <p className="text-sm font-black text-white italic mt-1">Raw / Rec.709</p>
                 </div>
                 <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <span className="text-[8px] text-slate-500 uppercase">FX Count</span>
                    <p className="text-sm font-black text-white italic mt-1">{originalTimeline?.effects?.length || 0} Nodes</p>
                 </div>
              </div>
           </div>
        </div>

        {/* AI Proposed V2 Panel */}
        <div className="flex flex-col gap-6">
           <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                 Click V2 Proposal
              </span>
              <span className="text-[9px] font-mono text-violet-500/60 uppercase">Heuristic Revision (Staging)</span>
           </div>
           
           <div className="flex-1 bg-violet-500/[0.02] border border-violet-500/20 rounded-[3rem] p-8 flex flex-col gap-8">
              <div className="flex items-start gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                    <Wand2 className="w-7 h-7 text-violet-400" />
                 </div>
                 <div className="flex-1">
                    <h4 className="text-xl font-black text-white italic uppercase tracking-tight">AI Enhancement Logic</h4>
                    <p className="text-slate-400 text-[11px] mt-2 leading-relaxed italic uppercase font-medium">
                       &quot;{v2Explanation || 'Autonomous structural realignment for maximum engagement velocity.'}&quot;
                    </p>
                 </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                 <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                       <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest">Logic Delta</span>
                    
                    <div className="space-y-3">
                       {[
                         { label: 'Timeline Structure', change: 'Hook-Optimized Pacing', intensity: 'High' },
                         { label: 'Motion Graphics', change: 'Neural-Match Overlay V4', intensity: 'Medium' },
                         { label: 'Color Space', change: 'Vibrant Cinematic LUT', intensity: 'High' },
                         { label: 'Sound Stage', change: 'Ducking-Aware Master', intensity: 'Low' },
                       ].map((delta, i) => (
                         <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                            <span className="text-[10px] font-black text-slate-500 uppercase">{delta.label}</span>
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] font-black text-white italic">{delta.change}</span>
                               <span className={`text-[7px] font-black px-2 py-0.5 rounded-full ${delta.intensity === 'High' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-500/10 text-slate-500'} uppercase`}>{delta.intensity} Shift</span>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex gap-4">
                    <Info className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div>
                       <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Confidence Score: 94%</p>
                       <p className="text-[9px] text-slate-400 uppercase leading-relaxed mt-1">This revision addresses requested feedback by implementing aggressive hook retention logic and smoothing out cadence inconsistencies.</p>
                    </div>
                 </div>
              </div>

              <button 
                onClick={onAccept}
                className="w-full py-5 rounded-2xl bg-white text-black text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-violet-500 hover:text-white transition-all flex items-center justify-center gap-3 group"
              >
                 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                 Commit AI Revision
              </button>
           </div>
        </div>
      </div>
    </div>
  )
}

export default VisualDiffViewer
