'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  Sparkles, 
  Scissors, 
  Layers, 
  Video, 
  Type, 
  User, 
  Box, 
  Cpu, 
  Shield,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Music,
  ExternalLink,
  Info,
  Activity,
  Globe,
  Terminal,
  Fingerprint,
  Orbit,
  Mic2,
  Film
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/5 shadow-3xl transition-all duration-700'

interface Tool {
  id: string;
  name: string;
  description: string;
  implementation: string;
  upgrade: string;
  roi?: number;
}

// Tools that operate on a specific source video and therefore require a videoId.
const VIDEO_DEPENDENT_TOOLS = new Set([
  'silence-removal',
  'auto-cut',
  'bg-swap',
  'auto-captions',
  'text-editor',
  'ai-avatar',
  'cinematic-3d'
])

export default function SovereignToolbox({ videoId }: { videoId?: string } = {}) {
  const { showToast } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [executingToolId, setExecutingToolId] = useState<string | null>(null)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiGet('/toolbox')
      if (res.success) {
        setTools(res.tools)
      }
    } catch (err) {
      console.error('Failed to fetch tools:', err)
      showToast('Neural link failed during tool indexing.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const executeTool = async (toolId: string) => {
    // Video-dependent tools cannot run without a real source video.
    if (VIDEO_DEPENDENT_TOOLS.has(toolId) && !videoId) {
      showToast('Select or upload a video before running this tool.', 'error')
      return
    }

    try {
      setExecutingToolId(toolId)
      showToast(`Initializing ${toolId} Sovereign Upgrade...`, 'info')

      const res = await apiPost('/toolbox/execute', {
        toolId,
        ...(videoId ? { videoId } : {}),
        options: {
          intensity: 'aggressive',
          sovereign: true
        }
      })

      if (res.success) {
        showToast(`✦ ${toolId} Synthesis Complete`, 'success')
      } else {
        throw new Error(res.error || 'Execution diffraction')
      }
    } catch (err: any) {
      showToast(`Tool execution failed: ${err.message}`, 'error')
    } finally {
      setExecutingToolId(null)
    }
  }

  const getIcon = (id: string) => {
    switch (id) {
      case 'silence-removal': return Scissors
      case 'viral-clips': return Zap
      case 'auto-cut': return Wand2
      case 'bg-swap': return Layers
      case 'blog-to-video': return ExternalLink
      case 'auto-captions': return Type
      case 'text-editor': return Cpu
      case 'ai-avatar': return User
      case 'cinematic-3d': return Box
      case 'script-to-video': return Video
      default: return Sparkles
    }
  }

  const getColor = (id: string) => {
    switch (id) {
      case 'silence-removal': return 'text-amber-400'
      case 'viral-clips': return 'text-primary-400'
      case 'auto-cut': return 'text-emerald-400'
      case 'bg-swap': return 'text-rose-400'
      case 'blog-to-video': return 'text-blue-400'
      case 'auto-captions': return 'text-violet-400'
      case 'text-editor': return 'text-orange-400'
      case 'ai-avatar': return 'text-cyan-400'
      case 'cinematic-3d': return 'text-fuchsia-400'
      case 'script-to-video': return 'text-sky-400'
      default: return 'text-white'
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 space-y-12 bg-transparent min-h-[600px]">
        <Loader2 size={80} className="text-primary-500 animate-spin" />
        <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic animate-pulse">Syncing_Elite_Modules...</p>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-12 lg:p-20 space-y-12 sm:space-y-16 bg-black/40 backdrop-blur-3xl rounded-[3rem] sm:rounded-[5rem] border-2 border-white/5 relative overflow-hidden shadow-2xl">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 border-b-2 border-white/5 pb-12 relative z-10">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="w-20 h-20 rounded-[2.5rem] bg-primary-500/5 border-2 border-primary-500/20 flex items-center justify-center shadow-inner group overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
             <Box size={40} className="text-primary-400 relative z-10" />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start">
               <Cpu size={14} className="text-primary-400 animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Forge_Matrix_v12.0</span>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">Sovereign Forge</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 px-8 py-4 rounded-full bg-emerald-500/5 border-2 border-emerald-500/20 shadow-inner group hover:bg-emerald-500/10 transition-colors">
           <Shield size={16} className="text-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
           <span className="text-[11px] font-black text-emerald-400 tracking-[0.3em] uppercase italic leading-none">QUANTUM_SECURE_ENABLED</span>
        </div>
      </div>

      {/* Grid Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 sm:gap-12 relative z-10">
        {tools.map((tool, i) => {
          const Icon = getIcon(tool.id)
          const colorClass = getColor(tool.id)
          const isExecuting = executingToolId === tool.id

          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedToolId(tool.id)}
              className="bg-white/[0.02] backdrop-blur-3xl border-2 border-white/5 rounded-[3.5rem] p-8 sm:p-10 cursor-pointer hover:border-primary-500/30 hover:bg-white/[0.04] transition-all duration-700 active:scale-[0.98] group relative overflow-hidden shadow-xl hover:shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
            >
              <div className={`absolute -top-32 -right-32 w-64 h-64 blur-[100px] rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none bg-current ${colorClass}`} />

              <div className="flex items-start justify-between relative z-10 mb-8">
                <div className="w-16 h-16 rounded-[2rem] bg-black/40 border-2 border-white/5 flex items-center justify-center group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-700 shadow-2xl">
                   <Icon size={32} className={`${colorClass}`} />
                </div>
                <div className="px-4 py-2 rounded-2xl bg-black/40 border-2 border-white/5 flex items-center gap-2 shadow-inner">
                   <div className={`w-2 h-2 rounded-full bg-emerald-500 ${isExecuting ? 'animate-ping shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'shadow-[0_0_4px_rgba(16,185,129,0.5)]'}`} />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Status: Ready</span>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <h3 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter leading-none flex items-center gap-4 truncate">
                  {tool.name}
                  {tool.id === 'ai-avatar' && (
                    <span className="text-[9px] font-black bg-primary-500/20 text-primary-400 px-3 py-1 rounded-full border border-primary-500/20 animate-pulse">ELITE</span>
                  )}
                </h3>
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed line-clamp-2 h-10 italic">
                  {tool.description}
                </p>

                <div className="flex items-center gap-4 mt-8 pt-8 border-t-2 border-white/5">
                  {typeof tool.roi === 'number' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 shadow-sm">
                      <Zap size={14} className="text-emerald-400" />
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">+{tool.roi.toFixed(1)}% ROI</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500/5 border border-primary-500/10 shadow-sm">
                    <Cpu size={14} className="text-primary-400" />
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest italic">ULTRA_SYNC</span>
                  </div>
                </div>
              </div>

              {/* Upgrade HUD Section */}
              <div className="mt-8 pt-8 border-t-2 border-white/5 relative z-10 group/upgrade">
                 <div className="flex items-center gap-3 mb-4">
                    <Sparkles size={14} className="text-primary-400 group-hover/upgrade:rotate-180 transition-transform duration-1000" />
                    <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.4em] italic">SOVEREIGN_SYNTHESIS</span>
                 </div>
                 <p className="text-[11px] font-black text-slate-400 italic leading-relaxed uppercase opacity-80 group-hover:text-white group-hover:opacity-100 transition-all duration-500">
                    {tool.upgrade}
                 </p>
              </div>

              {isExecuting && (
                <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-md flex items-center justify-center z-50 transition-all duration-500">
                   <div className="flex flex-col items-center gap-6">
                      <Loader2 size={48} className="text-primary-400 animate-spin" />
                      <span className="text-[12px] font-black text-white uppercase tracking-[0.5em] italic animate-pulse">SYNTHESIZING...</span>
                   </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedToolId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedToolId(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-black/80 backdrop-blur-3xl border-2 border-white/5 max-w-5xl w-full rounded-[4rem] sm:rounded-[6rem] p-8 sm:p-16 lg:p-24 relative overflow-hidden shadow-[0_80px_150px_rgba(0,0,0,0.6)]"
            >
              <div className="absolute -top-60 -right-60 w-[800px] h-[800px] bg-primary-600/5 blur-[200px] rounded-full pointer-events-none" />

              {(() => {
                const tool = tools.find(t => t.id === selectedToolId)
                if (!tool) return null
                const Icon = getIcon(tool.id)
                const colorClass = getColor(tool.id)

                return (
                  <div className="space-y-12 sm:space-y-16 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-12">
                       <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[3rem] sm:rounded-[3.5rem] bg-black/60 border-2 border-white/10 flex items-center justify-center shadow-3xl group hover:rotate-12 transition-transform duration-700">
                          <Icon size={56} className={`${colorClass} sm:w-16 sm:h-16`} />
                       </div>
                       <div className="text-center md:text-left">
                          <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.8em] italic mb-4">MODULE_SIG: {tool.id.toUpperCase()}</p>
                          <h2 className="text-5xl sm:text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{tool.name}</h2>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                       <div className="p-8 sm:p-10 rounded-[3rem] sm:rounded-[3.5rem] bg-white/[0.02] border-2 border-white/5 space-y-6 shadow-inner">
                          <div className="flex items-center gap-4">
                             <Info size={16} className="text-slate-500" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Diagnostic_Trace</span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-black text-slate-300 leading-tight uppercase tracking-tighter italic">
                             {tool.description}
                          </p>
                       </div>

                       <div className="p-8 sm:p-10 rounded-[3rem] sm:rounded-[3.5rem] bg-primary-500/5 border-2 border-primary-500/20 space-y-6 shadow-[0_40px_100px_rgba(99,102,241,0.2)]">
                          <div className="flex items-center gap-4">
                             <Sparkles size={16} className="text-primary-400" />
                             <span className="text-[10px] font-black text-primary-400 uppercase tracking-[0.4em] italic leading-none">Sovereign_Logic_v12</span>
                          </div>
                          <p className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase tracking-tighter italic">
                             {tool.upgrade}
                          </p>
                       </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 pt-8">
                       <button
                         onClick={() => executeTool(tool.id)}
                         disabled={executingToolId === tool.id}
                         className="flex-[2] py-8 sm:py-10 rounded-[2.5rem] sm:rounded-[3rem] bg-primary-600 text-white font-black text-lg sm:text-xl uppercase tracking-[0.6em] italic shadow-[0_40px_100px_rgba(99,102,241,0.4)] hover:bg-primary-500 active:scale-95 transition-all flex items-center justify-center gap-6 sm:gap-10 border-none group"
                       >
                          {executingToolId === tool.id ? <Loader2 size={32} className="animate-spin" /> : <Zap size={32} className="group-hover:scale-125 transition-transform" />}
                          INITIALISE_SYNTHESIS
                       </button>
                       <button
                         onClick={() => setSelectedToolId(null)}
                         className="flex-1 px-8 sm:px-12 py-8 sm:py-10 rounded-[2.5rem] sm:rounded-[3rem] bg-white/5 border-2 border-white/10 text-slate-500 font-black text-lg sm:text-xl uppercase tracking-[0.4em] italic hover:text-white hover:bg-white/10 transition-all active:scale-95"
                       >
                          Close_Link
                       </button>
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
