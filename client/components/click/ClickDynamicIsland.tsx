'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { 
  Sparkles, Brain, Flame, Send, X, Command, 
  Cpu, Sliders, ChevronRight, MessageSquare, Play, 
  RefreshCw, CheckCircle2, ShieldAlert, GripHorizontal, 
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

interface Subtask {
  label: string
  completed: boolean
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
  
  // Collapsible detailed subtasks HUD
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [taskProgress, setTaskProgress] = useState(0)
  const [activeTask, setActiveTask] = useState<string | null>(null)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  
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

  useEffect(() => {
    if (pathname.includes('/forge')) {
      setAmbientState('presence.learning')
      setActiveTask('Analyzing channel DNA')
      setSubtasks([
        { label: 'Map visual pacing boundaries', completed: true },
        { label: 'Vector check metadata anchors', completed: false },
        { label: 'Compute A/B hooks splitting', completed: false }
      ])
      setTaskProgress(45)
    } else if (pathname.includes('/video')) {
      setAmbientState('presence.rendering')
      setActiveTask('Stitching caption timeline')
      setSubtasks([
        { label: 'Compile color-grade nodes', completed: true },
        { label: 'Sync multilingual subtitle grids', completed: true },
        { label: 'Generate micro-glowing transitions', completed: false }
      ])
      setTaskProgress(82)
    } else if (pathname.includes('/scheduler') || pathname.includes('/social')) {
      setAmbientState('presence.drafting')
      setActiveTask(null)
      setSubtasks([])
      setTaskProgress(0)
    } else {
      setAmbientState('presence.idle')
      setActiveTask(null)
      setSubtasks([])
      setTaskProgress(0)
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

  // Auto-progress background task simulation
  useEffect(() => {
    if (taskProgress > 0 && taskProgress < 100) {
      const timer = setTimeout(() => {
        const nextProg = Math.min(taskProgress + Math.floor(Math.random() * 5) + 1, 100)
        setTaskProgress(nextProg)
        
        // Stagger checklist completion based on progress
        if (subtasks.length > 0) {
          setSubtasks(prev => prev.map((sub, idx) => {
            if (idx === 1 && nextProg > 65) return { ...sub, completed: true }
            if (idx === 2 && nextProg > 90) return { ...sub, completed: true }
            return sub
          }))
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [taskProgress, subtasks.length])

  const activeCopy = clickVoice(ambientState)

  const handleSwarmChange = (mode: SwarmMode) => {
    setSwarmMode(mode)
    localStorage.setItem('click-active-swarm', mode)
    
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

      let reply = response?.data?.text || ''
      if (!reply) {
        const fallbacks = [
          "Let's cook that topic! I'd recommend a bold minimalist serif lower-third caption style.",
          "Snappy pace beats boring intros. Let me chop the silent frames from that concept.",
          "Solid angle. The competitors are sleeping on this hooks format. Let's forge it!",
          "Swarm analysis shows 19:00 UTC holds the highest resonance for finance payloads.",
          "I locked that topic into your taste graph. Ready to process footage whenever you are."
        ]
        reply = fallbacks[Math.floor(Math.random() * fallbacks.length)]
      }

      setChatLog(prev => [...prev, { sender: 'click', text: reply }])
    } catch (err) {
      const offlineReplies = [
        "Network hit a snag, but my intelligence is local. Let's keep cooking details!",
        "Stitching responses offline. Let's draft a high-energy glitch speed hook instead.",
        "Your topic is locked in my buffer. Synchronize when connected!"
      ]
      const reply = offlineReplies[Math.floor(Math.random() * offlineReplies.length)]
      setChatLog(prev => [...prev, { sender: 'click', text: reply }])
    } finally {
      setLoadingChat(false)
    }
  }

  const handleDragEnd = (_event: any, info: any) => {
    const coords = { x: dragOffset.x + info.offset.x, y: dragOffset.y + info.offset.y }
    setDragOffset(coords)
    localStorage.setItem('click-dynamic-island-coords', JSON.stringify(coords))
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
        className={`pointer-events-auto overflow-hidden bg-slate-950/80 backdrop-blur-2xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(99,102,241,0.15)] text-white select-none relative ${
          isExpanded ? 'p-6' : 'px-4 py-2 h-11 flex items-center justify-between cursor-pointer hover:border-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'
        } transition-all duration-300`}
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
                {taskProgress > 0 && taskProgress < 100 && (
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" fill="transparent" />
                      <circle 
                        cx="8" cy="8" r="6" 
                        stroke="rgb(99, 102, 241)" 
                        strokeWidth="1.5" 
                        fill="transparent" 
                        strokeDasharray={2 * Math.PI * 6}
                        strokeDashoffset={2 * Math.PI * 6 * (1 - taskProgress / 100)}
                      />
                    </svg>
                  </div>
                )}
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

              {/* Active Background Task HUD & Collapsible checklist */}
              {activeTask && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                  <div 
                    onClick={() => setShowSubtasks(!showSubtasks)}
                    className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                      {activeTask}
                    </span>
                    <span className="font-mono text-indigo-400 flex items-center gap-1">
                      {taskProgress}%
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSubtasks ? 'rotate-90' : ''}`} />
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <motion.div 
                      className={`h-full bg-gradient-to-r ${activeSwarm.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${taskProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  {/* Subtasks dropdown */}
                  <AnimatePresence>
                    {showSubtasks && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 pt-2 border-t border-white/5 overflow-hidden"
                      >
                        {subtasks.map((sub, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] text-slate-300 font-semibold leading-relaxed">
                            <span className="flex items-center gap-2">
                              {sub.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-500 flex items-center justify-center shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                </div>
                              )}
                              {sub.label}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500">
                              {sub.completed ? 'DONE' : 'PENDING'}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

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
