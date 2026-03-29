'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Terminal as TerminalIcon,
  Cpu,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileCode,
  Zap
} from 'lucide-react'

interface NeuralTrainingMatrixViewProps {
  onCancel: () => void
  onComplete: (mockData: any) => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

export const NeuralTrainingMatrixView: React.FC<NeuralTrainingMatrixViewProps> = ({
  onCancel,
  onComplete
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [logs, setLogs] = useState<{ id: string, text: string, status: 'pending' | 'loading' | 'done' }[]>([
    { id: '1', text: 'Initializing Neural Ingestion Node...', status: 'done' },
    { id: '2', text: 'Awaiting Style Matrix (.xml / .click)...', status: 'pending' },
  ])

  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const simulateTraining = async () => {
    setIsUploading(true)

    const newLogs: { id: string, text: string, status: 'pending' | 'loading' | 'done' }[] = [
      { id: '3', text: 'Decoding Fast Fourier Transform (FFT) Audio Symmetries...', status: 'loading' },
      { id: '4', text: 'Extracting Bezier Spline Easing Logics...', status: 'pending' },
      { id: '5', text: 'Mapping Vectorized Color Histogram Manifolds...', status: 'pending' },
      { id: '6', text: 'Analyzing Semantic Cutting Patterns (J-Cut/L-Cut Ratio)...', status: 'pending' },
      { id: '7', text: 'Finalizing Neural DNA Style Encoding...', status: 'pending' },
    ]

    setLogs(prev => [...prev.map(l => l.id === '2' ? { ...l, status: 'done' as const } : l), ...newLogs])

    for (let i = 0; i < newLogs.length; i++) {
      await new Promise(r => setTimeout(r, 1500))
      setLogs((prev) => prev.map(l => {
        if (l.id === newLogs[i].id) return { ...l, status: 'done' as const }
        if (i < newLogs.length - 1 && l.id === newLogs[i+1].id) return { ...l, status: 'loading' as const }
        return l
      }) as { id: string, text: string, status: 'pending' | 'loading' | 'done' }[])
    }

    await new Promise(r => setTimeout(r, 1000))
    onComplete({ /* mock extracted data */ })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateTraining()
    }
  }

  return (
    <div className="flex h-full gap-12 p-12 overflow-hidden relative">
      {/* Background Pulse */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[200px] rounded-full animate-pulse pointer-events-none" />

      {/* Main Dropzone Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative w-[600px] h-[600px] rounded-full border-2 border-dashed flex flex-col items-center justify-center gap-8 transition-all duration-700 cursor-pointer overflow-hidden ${dragActive ? 'border-indigo-500 bg-indigo-500/10 scale-105 shadow-[0_0_100px_rgba(99,102,241,0.2)]' : 'border-white/10 bg-white/[0.02]'}`}
        >
          {/* Liquid Ring Animation (CSS Only) */}
          <div className="absolute inset-4 rounded-full border border-white/5 animate-[spin_20s_linear_infinite]" />
          <div className="absolute inset-12 rounded-full border border-white/5 animate-[spin_15s_linear_infinite_reverse]" />

          <AnimatePresence mode="wait">
            {!isUploading ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-8 z-10"
              >
                <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
                  <Upload className="w-10 h-10 animate-bounce" />
                </div>
                <div className="text-center space-y-3">
                  <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Drop Style DNA</h3>
                  <p className="text-slate-500 text-sm font-medium">Export .xml from Premiere or drop .click project</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-8 z-10"
              >
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-40 h-40 rounded-full border-4 border-t-indigo-500 border-r-transparent border-l-transparent border-b-transparent"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-16 h-16 text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                   <h3 className="text-2xl font-black text-indigo-400 italic tracking-[0.3em] uppercase">Training Engine Active</h3>
                   <div className="mt-4 h-1 w-48 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "0%" }}
                        transition={{ duration: 10, ease: "linear" }}
                        className="h-full bg-indigo-500"
                      />
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <button
          onClick={onCancel}
          className="mt-12 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.4em] transition-colors italic"
        >
          [ Terminate Sequence ]
        </button>
      </div>

      {/* Right Terminal Sidebar */}
      <div className={`w-[450px] ${glassStyle} rounded-[3rem] p-8 flex flex-col`}>
        <div className="flex items-center gap-3 border-b border-white/10 pb-6 mb-8">
           <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TerminalIcon className="w-4 h-4" />
           </div>
           <h4 className="text-[10px] font-black text-white uppercase tracking-widest italic">Extraction Terminal v4.0</h4>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-4">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 group">
              <div className="pt-1">
                {log.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : log.status === 'loading' ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-white/10" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className={`text-[11px] font-black uppercase tracking-wider italic ${log.status === 'loading' ? 'text-white' : 'text-slate-500'}`}>
                  {log.text}
                </div>
                {log.status === 'loading' && (
                  <div className="text-[9px] text-indigo-400/50 font-mono">
                    Node: 0x4f...{Math.random().toString(16).slice(2, 6)} | CPU: 88.2%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
           <div className="flex items-center gap-2 text-indigo-400">
              <Zap className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest italic">Heuristic Engine Status</span>
           </div>
           <div className="flex justify-between items-end">
              <div className="space-y-1">
                 <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none">Current Load</div>
                 <div className="text-xl font-black text-white italic">0.428 FLOPs</div>
              </div>
              <div className="h-8 w-24 flex items-end gap-0.5">
                 {[...Array(12)].map((_, i) => (
                   <motion.div
                     key={i}
                     animate={{ height: [4, Math.random() * 24 + 4, 4] }}
                     transition={{ duration: 0.5 + Math.random(), repeat: Infinity }}
                     className="flex-1 bg-indigo-500/30 rounded-full"
                   />
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
