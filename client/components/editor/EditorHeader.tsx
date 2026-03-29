'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Download,
  RefreshCw,
  LayoutGrid,
  Check,
  ShieldCheck,
  Cpu,
  Orbit,
  Sparkles,
  Zap,
  Fingerprint,
  Activity,
  Radio,
  Target,
  Brain,
  TrendingUp,
  Flame
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import type { EditorLayoutPreferences, PreviewSize, TimelineDensity, FocusMode } from '../../types/editor'

interface EditorHeaderProps {
  projectName: string
  setProjectName: (name: string) => void
  autosaveStatus: {
    status: 'idle' | 'saving' | 'saved' | 'error'
    lastSaved: Date | null
    message?: string
  }
  getStatusIcon: () => React.ReactNode
  retrySave?: () => void
  historyIndex: number
  historyLength: number
  handleUndo: () => void
  handleRedo: () => void
  setShowKeyboardHelp: (show: boolean) => void
  contentPanelCollapsed: boolean
  setContentPanelCollapsed: (collapsed: boolean) => void
  activeCategory: EditorCategory
  activeCategoryLabel?: string
  featuresCount: number
  isOledTheme?: boolean
  videoId?: string
  layoutPrefs?: EditorLayoutPreferences
  onLayoutChange?: (patch: Partial<EditorLayoutPreferences>) => void
  defaultLayout?: EditorLayoutPreferences
  viralScore?: number
  scoreTrend?: 'up' | 'down' | 'flat'
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-3xl"

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  setProjectName,
  autosaveStatus,
  getStatusIcon,
  historyIndex,
  historyLength,
  handleUndo,
  handleRedo,
  setShowKeyboardHelp,
  contentPanelCollapsed,
  setContentPanelCollapsed,
  activeCategory,
  activeCategoryLabel,
  featuresCount,
  isOledTheme,
  videoId,
  layoutPrefs,
  onLayoutChange,
  defaultLayout,
  viralScore = 72,
  scoreTrend = 'flat',
}) => {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const layoutMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) setLayoutMenuOpen(false)
    }
    if (layoutMenuOpen) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [layoutMenuOpen])

  return (
    <header className="relative z-50 p-3 flex items-center justify-between gap-4">
      {/* Principal Navigation Cluster */}
      <div className={`${glassStyle} rounded-[2rem] px-6 py-3 flex items-center gap-6 flex-1 relative overflow-hidden group`}>
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
          <Orbit className="w-24 h-24 text-indigo-500 animate-spin-slow" />
        </div>

        <motion.button
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setContentPanelCollapsed(!contentPanelCollapsed)}
          className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all shadow-inner"
        >
          {contentPanelCollapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </motion.button>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-[0.4em] italic text-indigo-400 shadow-xl">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              Neural Workspace Hub
            </div>
            <AnimatePresence>
              {autosaveStatus.status === 'saving' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[9px] font-black text-amber-400 uppercase tracking-widest italic"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing Nodes
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <h1
              contentEditable
              onBlur={(e) => setProjectName(e.currentTarget.textContent || 'UNTITLED MASTERPIECE')}
              suppressContentEditableWarning
              className="text-3xl font-black text-white italic tracking-tighter truncate outline-none focus:text-indigo-400 transition-colors cursor-text leading-none uppercase"
            >
              {projectName}
            </h1>
            {activeCategoryLabel && (
              <div className="px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] italic shadow-2xl">
                {activeCategoryLabel.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Global Diagnostics */}
        <div className="hidden 2xl:flex items-center gap-8 px-6 border-l border-white/5 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-[10px] font-black text-white italic uppercase tracking-[0.3em]">Integrity Verified</span>
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic leading-none">Core ID: 0xFF02A</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-black text-white italic uppercase tracking-[0.3em]">{featuresCount} STRANDS ACTIVE</span>
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic leading-none">Load: 12.4% Neural</span>
          </div>
          {/* Live AI Viral Score Badge */}
          <div className="flex flex-col items-center gap-1 pl-6 border-l border-white/5">
            <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center ${
              viralScore >= 85 ? 'border-emerald-500 bg-emerald-500/10' :
              viralScore >= 65 ? 'border-amber-500 bg-amber-500/10' :
                                 'border-rose-500 bg-rose-500/10'
            } ${scoreTrend === 'up' ? 'shadow-[0_0_20px_rgba(16,185,129,0.25)]' : ''}`}>
              <span className={`text-lg font-black italic ${
                viralScore >= 85 ? 'text-emerald-400' : viralScore >= 65 ? 'text-amber-400' : 'text-rose-400'
              }`}>{viralScore}</span>
            </div>
            <div className="flex items-center gap-1">
              <Brain className="w-2.5 h-2.5 text-indigo-400" />
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Neural</span>
              {scoreTrend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />}
              {scoreTrend === 'down' && <Flame className="w-2.5 h-2.5 text-rose-400" />}
            </div>
          </div>
        </div>
      </div>

      {/* Action Command Cluster */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1.5 rounded-[1.5rem] bg-white/[0.03] border border-white/10 shadow-xl">
          <motion.button
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${historyIndex <= 0 ? 'opacity-20 grayscale' : 'hover:bg-indigo-600/20 text-slate-400 hover:text-white'}`}
          >
            <RotateCcw className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleRedo}
            disabled={historyIndex >= historyLength - 1}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${historyIndex >= historyLength - 1 ? 'opacity-20 grayscale' : 'hover:bg-indigo-600/20 text-slate-400 hover:text-white'}`}
          >
            <RotateCw className="w-5 h-5" />
          </motion.button>
        </div>

        {layoutPrefs && onLayoutChange && (
          <div className="relative" ref={layoutMenuRef}>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLayoutMenuOpen((o) => !o)}
              className={`h-12 px-6 rounded-[1.5rem] flex items-center gap-3 transition-all ${layoutMenuOpen ? 'bg-indigo-600 text-white shadow-3xl shadow-indigo-600/40' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/10 shadow-xl'}`}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] italic leading-none">Matrix Control</span>
            </motion.button>

            <AnimatePresence>
              {layoutMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  className={`${glassStyle} absolute right-0 top-full mt-6 w-80 p-6 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.9)] z-[100] border-white/10`}
                >
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Target className="w-4 h-4 text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Projection Scale</span>
                      </div>
                      <div className="space-y-1 mt-2">
                        {([
                          { id: 'auto' as const, label: 'Adaptive Synthesis' },
                          { id: 'small' as const, label: 'Compact Matrix' },
                          { id: 'medium' as const, label: 'Balanced Grid' },
                          { id: 'large' as const, label: 'High Resolution' },
                          { id: 'fill' as const, label: 'Immersive Fill' },
                        ]).map(({ id, label }) => (
                          <button key={id} onClick={() => onLayoutChange({ previewSize: id })} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${layoutPrefs.previewSize === id ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-white/5 text-slate-400'}`}>
                            <span className="text-[11px] font-black italic uppercase tracking-tighter">{label}</span>
                            {layoutPrefs.previewSize === id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Radio className="w-4 h-4 text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Neural Focus</span>
                      </div>
                      <div className="space-y-1 mt-2">
                        {([
                          { id: 'balanced' as const, label: 'Symmetric Logic' },
                          { id: 'preview' as const, label: 'Visual Priority' },
                          { id: 'timeline' as const, label: 'Flow Dominance' },
                        ]).map(({ id, label }) => (
                          <button key={id} onClick={() => onLayoutChange({ focusMode: id })} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${layoutPrefs.focusMode === id ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-white/5 text-slate-400'}`}>
                            <span className="text-[11px] font-black italic uppercase tracking-tighter">{label}</span>
                            {layoutPrefs.focusMode === id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="h-12 px-8 rounded-[1.5rem] bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.3em] italic shadow-3xl shadow-indigo-600/40 border border-white/20 flex items-center gap-2 transition-all"
        >
          <Download className="w-4 h-4" />
          SYNTHESIZE & EXPORT
        </motion.button>
      </div>
    </header>
  )
}
