'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { 
  Sparkles, Brain, Flame, Send, X, Command,
  Cpu, Sliders, MessageSquare, Play,
  RefreshCw, ShieldAlert, GripHorizontal,
  Volume2, Check, ArrowRight
} from 'lucide-react'
import { apiPost } from '../../lib/api'
import { clickVoice, type ClickIntent } from '../../lib/clickVoice'

type SwarmMode = 'viral' | 'trust' | 'coach' | 'authority'

interface SwarmConfig {
  label: string
  icon: React.ElementType
  desc: string
  color: string
  voice: string
}

const SWARM_CONFIGS: Record<SwarmMode, SwarmConfig> = {
  viral: {
    label: 'Viral Swarm',
    icon: Flame,
    desc: 'High-energy pacing, dynamic speed ramps, emoji injections.',
    color: 'from-orange-500 to-rose-500',
    voice: 'Hyper-Growth mode active. Click is targeting raw retention.'
  },
  trust: {
    label: 'Trust Swarm',
    icon: Brain,
    desc: 'Cinematic grades, slower authoritative pacing, clean serif captions.',
    color: 'from-emerald-500 to-teal-500',
    voice: 'Authority locked. Suggesting logical layout structures.'
  },
  coach: {
    label: 'Witty Coach',
    icon: Sparkles,
    desc: 'Clever hooks, snappy cuts, responsive caption micro-bursts.',
    color: 'from-indigo-500 to-violet-500',
    voice: 'Sassy coach mode active. Let\'s make this one pop!'
  },
  authority: {
    label: 'ExpertSwarm',
    icon: Cpu,
    desc: 'Deep industry context, competitor positioning metrics, AIDA hooks.',
    color: 'from-cyan-500 to-blue-500',
    voice: 'Enterprise swarm online. Benchmarking opponent channels.'
  }
}

// Neural sound-wave visualizer when Click is thinking
function NeuralSoundWave({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 h-5 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full bg-gradient-to-t ${color}`}
          animate={{
            height: [4, 20, 4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

export default function ClickDynamicIsland() {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [swarmMode, setSwarmMode] = useState<SwarmMode>('coach')
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'click'; text: string }[]>([])
  const [loadingChat, setLoadingChat] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Drag coordinates state
  const dragControls = useDragControls()
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Context-aware state detection based on pathname
  const [ambientState, setAmbientState] = useState<ClickIntent>('presence.idle')
  
  // Dynamic screen width measuring to guarantee mobile scalability
  const [screenWidth, setScreenWidth] = useState(1200)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setScreenWidth(window.innerWidth)
    const handleResize = () => setScreenWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const expandedWidth = Math.min(440, screenWidth - 32)
  const compactWidth = Math.min(280, screenWidth - 32)
  
  // Hydrate custom swarm and drag coordinates from local storage
  useEffect(() => {
    const savedSwarm = localStorage.getItem('click-active-swarm') as SwarmMode
    if (savedSwarm && SWARM_CONFIGS[savedSwarm]) setSwarmMode(savedSwarm)

    try {
      const savedCoords = localStorage.getItem('click-dynamic-island-coords')
      if (savedCoords) {
        setDragOffset(JSON.parse(savedCoords))
      }
    } catch (e) {
      // Catch corrupt coords
    }
  }, [])

  // Reflect swarm mode on root element for dynamic theme styling
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-swarm', swarmMode)
    }
  }, [swarmMode])

  // Reflect an ambient presence mood based on the current route. This only
  // drives Click's voice/glow — it does NOT fabricate task progress. (A previous
  // version simulated fake task percentages/subtasks here; that was removed in
  // favour of showing real state only.)
  useEffect(() => {
    if (pathname.includes('/forge')) {
      setAmbientState('presence.learning')
    } else if (pathname.includes('/video')) {
      setAmbientState('presence.rendering')
    } else if (pathname.includes('/scheduler') || pathname.includes('/social')) {
      setAmbientState('presence.drafting')
    } else {
      setAmbientState('presence.idle')
    }
  }, [pathname])

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom()
    }
  }, [chatLog, loadingChat, isExpanded])

  // Click outside to collapse
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeCopy = clickVoice(ambientState)

  const handleSwarmChange = (mode: SwarmMode) => {
    setSwarmMode(mode)
    localStorage.setItem('click-active-swarm', mode)
    
    // Dispatch custom event for cross-component reactive personalization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('click-swarm-change', { detail: mode }))
    }
    
    setChatLog(prev => [
      ...prev,
      { sender: 'click', text: SWARM_CONFIGS[mode].voice }
    ])
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return

    setChatLog(prev => [...prev, { sender: 'user', text }])
    setChatInput('')
    setLoadingChat(true)

    try {
      const response = await apiPost<{ success: boolean; data?: { text?: string } }>('/ai/generate', {
        prompt: `You are Click, a brilliant, highly professional but slightly sassy AI video editor and marketing swarm assistant. Reply in one short, impactful, witty sentence (creator coach style) to: "${text}"`,
        taskType: 'chat',
        options: {
          temperature: 0.8,
          maxTokens: 60
        }
      })

      const reply = response?.data?.text?.trim()
      // Be honest when the model returns nothing — don't fabricate an "AI" reply.
      const message = reply || "I couldn't generate a response just now. Try rephrasing or send that again."
      setChatLog(prev => [...prev, { sender: 'click', text: message }])
    } catch (err) {
      // Surface a clear connection error instead of a canned fake reply.
      setChatLog(prev => [...prev, { sender: 'click', text: "I can't reach the assistant right now — check your connection and try again." }])
    } finally {
      setLoadingChat(false)
    }
  }

  const handleDragEnd = (_event: any, info: any) => {
    const coords = { x: dragOffset.x + info.offset.x, y: dragOffset.y + info.offset.y }
    setDragOffset(coords)
    localStorage.setItem('click-dynamic-island-coords', JSON.stringify(coords))
  }

const SWARM_SHADOWS: Record<SwarmMode, string> = {
  viral: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(244,63,94,0.25)] border-rose-500/30',
  trust: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(20,184,166,0.25)] border-teal-500/30',
  coach: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(99,102,241,0.25)] border-indigo-500/30',
  authority: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(6,182,212,0.25)] border-cyan-500/30'
}

  const activeSwarm = SWARM_CONFIGS[swarmMode]

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none w-full max-w-[1200px] px-4 flex justify-center">
      <motion.div
        ref={containerRef}
        layout
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        animate={{ 
          x: dragOffset.x,
          y: dragOffset.y,
          width: isExpanded ? expandedWidth : compactWidth,
          borderRadius: isExpanded ? 36 : 9999
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 220, 
          damping: 24
        }}
        className={`pointer-events-auto overflow-hidden bg-slate-950/80 backdrop-blur-2xl text-white select-none relative border transition-all duration-500 ${SWARM_SHADOWS[swarmMode]} ${
          isExpanded ? 'p-6' : 'px-4 py-2 h-11 flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
        }`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // COMPACT STATE
            <motion.div
              key="compact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between w-full h-full"
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${activeSwarm.color} p-[1px] flex items-center justify-center`}>
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <activeSwarm.icon className="w-3.5 h-3.5 text-slate-200 animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Click Coach</span>
                  <span className="text-[10px] font-bold text-slate-300 truncate max-w-[140px] italic">{activeCopy}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
              </div>
            </motion.div>
          ) : (
            // EXPANDED STATE (SWARM CONSOLE)
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 w-full text-left"
            >
              {/* Drag Grip + Header HUD */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5 relative">
                <div 
                  onPointerDown={(e) => dragControls.start(e)}
                  className="absolute top-[-10px] left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing p-1 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 flex items-center justify-center transition-all z-50"
                >
                  <GripHorizontal className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest italic text-white leading-none">Click HUD</h3>
                    <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Autonomous Swarm Integration</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {loadingChat && <NeuralSoundWave color={activeSwarm.color} />}
                  <button
                    type="button"
                    title="Close Console"
                    aria-label="Close Console"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(false)
                    }}
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:rotate-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Context Coach Advice */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <activeSwarm.icon className="w-20 h-20 text-indigo-500" />
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase tracking-wider italic leading-none">
                  Context Insight
                </span>
                <p className="text-xs font-semibold text-slate-200 leading-relaxed italic">
                  "{activeCopy}"
                </p>
              </div>

              {/* Swarm presets selection */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Swarm Strategy</label>
                <div className="grid grid-cols-4 gap-2 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
                  {(['viral', 'trust', 'coach', 'authority'] as SwarmMode[]).map((mode) => {
                    const cfg = SWARM_CONFIGS[mode]
                    const isActive = swarmMode === mode
                    const Icon = cfg.icon
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleSwarmChange(mode)}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                          isActive 
                            ? `bg-gradient-to-r ${cfg.color} text-white shadow-lg scale-105` 
                            : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-wider">{mode}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[9px] font-bold text-slate-500 ml-1 leading-snug">
                  {activeSwarm.desc}
                </p>
              </div>

              {/* Mini Assistant Console */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Ask Click Assistant</label>
                <div className="max-h-[140px] overflow-y-auto space-y-3 px-1 custom-scrollbar">
                  {chatLog.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic py-2 text-center uppercase tracking-widest">
                      Ask me to draft hooks, suggest themes, or check telemetry.
                    </div>
                  ) : (
                    chatLog.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex gap-3 text-xs leading-relaxed ${
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.sender === 'click' && (
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${activeSwarm.color} flex items-center justify-center text-[9px] font-black italic`}>
                            C
                          </div>
                        )}
                        <div className={`p-3 rounded-2xl max-w-[80%] break-words whitespace-pre-wrap ${
                          msg.sender === 'user' 
                            ? 'bg-indigo-500 text-white rounded-tr-none shadow-[0_10px_20px_rgba(99,102,241,0.3)]' 
                            : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  {loadingChat && (
                    <div className="flex gap-3 text-xs justify-start items-center">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${activeSwarm.color} flex items-center justify-center`}>
                        <RefreshCw className="w-3 h-3 text-white animate-spin" />
                      </div>
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 italic">
                        Click is thinking...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2 relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Click..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    title="Send Prompt"
                    disabled={!chatInput.trim() || loadingChat}
                    className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all absolute right-1.5 top-1 shadow-lg shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Offset Reset HUD */}
              {dragOffset.x !== 0 || dragOffset.y !== 0 ? (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDragOffset({ x: 0, y: 0 })
                      localStorage.setItem('click-dynamic-island-coords', JSON.stringify({ x: 0, y: 0 }))
                    }}
                    className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[8px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all"
                  >
                    Reset HUD Position
                  </button>
                </div>
              ) : null}

              {/* Hotkeys Deck */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2.5">
                  <Command className="w-3 h-3" />
                  Press <kbd className="font-mono text-indigo-400">⌘K</kbd> for commands
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                  Online
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
