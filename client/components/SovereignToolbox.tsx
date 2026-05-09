'use client'

import React, { useState, useEffect } from 'react'
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

export default function SovereignToolbox() {
  const { showToast } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [executingToolId, setExecutingToolId] = useState<string | null>(null)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async () => {
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
  }

  const executeTool = async (toolId: string) => {
    try {
      setExecutingToolId(toolId)
      showToast(`Initializing ${toolId} Sovereign Upgrade...`, 'info')
      
      const res = await apiPost('/toolbox/execute', {
        toolId,
        videoId: 'placeholder-v1',
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
      case 'viral-clips': return 'text-indigo-400'
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
      <div className="flex flex-col items-center justify-center py-32 space-y-10">
        <Loader2 size={64} className="text-indigo-500 animate-spin" />
        <p className="text-[12px] font-black text-slate-500 uppercase tracking-[1em] italic animate-pulse">Syncing_Elite_Modules...</p>
      </div>
    )
  }

  return (
    <div className="p-12 lg:p-20 space-y-16 bg-[#050505] rounded-[5rem] border border-white/5 relative overflow-hidden">
      {/* HUD Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-12 border-b border-white/5 pb-12 relative z-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shadow-inner group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <Box size={36} className="text-indigo-400 relative z-10" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
               <Cpu size={14} className="text-indigo-400 animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Click_Toolbox_v7.0</span>
            </div>
            <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">Sovereign Modules</h2>
          </div>
        </div>
        <div className="flex items-center gap-4 px-8 py-4 rounded-full bg-emerald-500/5 border border-emerald-500/20 shadow-inner">
           <Shield size={16} className="text-emerald-400 animate-pulse" />
           <span className="text-[11px] font-black text-emerald-400 tracking-[0.3em] uppercase italic leading-none">QUANTUM_SECURE_BYPASS</span>
        </div>
      </div>

      {/* Grid Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-12 relative z-10">
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
              className={`${glassStyle} group relative overflow-hidden rounded-[4rem] p-10 cursor-pointer hover:border-indigo-500/30 hover:bg-white/[0.04] active:scale-[0.98]`}
            >
              <div className={`absolute -top-32 -right-32 w-64 h-64 blur-[100px] rounded-full opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none bg-current ${colorClass}`} />

              <div className="flex items-start justify-between relative z-10 mb-8">
                <div className={`w-16 h-16 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:rotate-[15deg] group-hover:scale-110 transition-all duration-700 shadow-2xl`}>
                   <Icon size={32} className={`${colorClass}`} />
                </div>
                <div className="px-4 py-1 rounded-full bg-white/[0.05] border border-white/10 flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full bg-emerald-500 ${isExecuting ? 'animate-ping' : ''}`} />
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Active</span>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none flex items-center gap-4">
                  {tool.name}
                  {tool.id === 'ai-avatar' && (
                    <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20">NEXT_GEN</span>
                  )}
                </h3>
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-tight leading-relaxed line-clamp-2">
                  {tool.description}
                </p>

                <div className="flex items-center gap-4 mt-6 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                    <Zap size={14} className="text-emerald-400" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">+{(tool.roi || (Math.random() * 15 + 20).toFixed(1))}% ROI</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <Cpu size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">LOW_LOAD</span>
                  </div>
                </div>
              </div>

              {/* Upgrade HUD Section */}
              <div className="mt-8 pt-8 border-t border-white/5 relative z-10 group/upgrade">
                 <div className="flex items-center gap-3 mb-4">
                    <Sparkles size={14} className="text-indigo-400 group-hover/upgrade:rotate-180 transition-transform duration-1000" />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] italic">SOVEREIGN_UPGRADE</span>
                 </div>
                 <p className="text-[11px] font-black text-slate-400 italic leading-relaxed uppercase opacity-80 group-hover:text-white transition-colors">
                    {tool.upgrade}
                 </p>
              </div>

              {isExecuting && (
                <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-sm flex items-center justify-center z-50">
                   <div className="flex flex-col items-center gap-4">
                      <Loader2 size={32} className="text-indigo-400 animate-spin" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest italic animate-pulse">SYNTHESIZING...</span>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className={`${glassStyle} max-w-4xl w-full rounded-[5rem] p-16 lg:p-24 relative overflow-hidden`}
            >
              <div className="absolute -top-60 -right-60 w-[800px] h-[800px] bg-indigo-600/5 blur-[200px] rounded-full pointer-events-none" />

              {(() => {
                const tool = tools.find(t => t.id === selectedToolId)
                if (!tool) return null
                const Icon = getIcon(tool.id)
                const colorClass = getColor(tool.id)

                return (
                  <div className="space-y-16 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-12">
                       <div className="w-32 h-32 rounded-[3.5rem] bg-white/[0.03] border-2 border-white/5 flex items-center justify-center shadow-3xl">
                          <Icon size={72} className={`${colorClass}`} />
                       </div>
                       <div className="text-center md:text-left">
                          <p className="text-[12px] font-black text-slate-500 uppercase tracking-[1em] italic mb-4">MODULE_ID: {tool.id}</p>
                          <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{tool.name}</h2>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                       <div className="p-10 rounded-[3.5rem] bg-white/[0.02] border border-white/5 space-y-6">
                          <div className="flex items-center gap-4">
                             <Info size={16} className="text-slate-500" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Technical_Profile</span>
                          </div>
                          <p className="text-3xl font-black text-slate-300 leading-tight uppercase tracking-tighter italic">
                             {tool.description}
                          </p>
                       </div>

                       <div className="p-10 rounded-[3.5rem] bg-indigo-500/5 border-2 border-indigo-500/20 space-y-6 shadow-[0_40px_100px_rgba(99,102,241,0.2)]">
                          <div className="flex items-center gap-4">
                             <Sparkles size={16} className="text-indigo-400" />
                             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] italic">Autonomous_Logic_v7</span>
                          </div>
                          <p className="text-4xl font-black text-white leading-tight uppercase tracking-tighter italic">
                             {tool.upgrade}
                          </p>
                       </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 pt-8">
                       <button
                         onClick={() => executeTool(tool.id)}
                         disabled={executingToolId === tool.id}
                         className="flex-[2] py-10 rounded-[3rem] bg-indigo-600 text-white font-black text-lg uppercase tracking-[0.6em] italic shadow-[0_40px_100px_rgba(99,102,241,0.4)] hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-10"
                       >
                          {executingToolId === tool.id ? <Loader2 size={32} className="animate-spin" /> : <Zap size={32} />}
                          INITIALISE_SYNTHESIS
                       </button>
                       <button
                         onClick={() => setSelectedToolId(null)}
                         className="flex-1 px-12 py-10 rounded-[3rem] bg-white/5 border border-white/10 text-slate-500 font-black text-lg uppercase tracking-[0.4em] italic hover:text-white hover:bg-white/10 transition-all"
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
