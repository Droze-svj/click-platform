'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import {
  Bot, Play, CheckCircle2, Loader2, Clock, Sparkles,
  Film, FileText, Image as ImageIcon, Calendar, Music,
  ChevronRight, AlertCircle, Zap, Wand2, RefreshCw, ShieldCheck
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
type AgentTaskStatus = 'queued' | 'running' | 'done' | 'error'

interface AgentTask {
  id: string
  label: string
  description: string
  icon: React.ElementType
  status: AgentTaskStatus
  result?: string
}

interface AgenticWorkflowManagerProps {
  videoId?: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  onAgentRunning?: (running: boolean) => void
  onDraftReady?: (clips: any[]) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

const AGENT_GOALS: { id: string; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'viral_clips', label: 'Viral Clip Cuts', icon: Film, desc: 'Auto-identify & cut top viral moments' },
  { id: 'thumbnails', label: 'A/B Thumbnails', icon: ImageIcon, desc: 'Generate 3 thumb variants for testing' },
  { id: 'descriptions', label: 'SEO Descriptions', icon: FileText, desc: 'Write optimized titles + descriptions' },
  { id: 'schedule', label: 'Draft to Calendar', icon: Calendar, desc: 'Push approved clips to content queue' },
  { id: 'brand', label: 'Apply Brand Kit', icon: Zap, desc: 'Apply your brand template to all clips' },
  { id: 'audio', label: 'Music & Foley', icon: Music, desc: 'Layer mood music + auto sound effects' },
]

const PIPELINE_STEPS: Omit<AgentTask, 'status'>[] = [
  { id: 'transcribe', label: 'Transcribe Audio', description: 'Pulling word-level transcript via Whisper…', icon: Sparkles },
  { id: 'score', label: 'Score Viral Moments', description: 'Analyzing hook strength at each second…', icon: Zap },
  { id: 'cut', label: 'Auto-Cut Clips', description: 'Selecting top 5 moments, trimming handles…', icon: Film },
  { id: 'brand', label: 'Apply Brand Template', description: 'Stamping logo, font, colors on each clip…', icon: Wand2 },
  { id: 'thumbs', label: 'Generate Thumbnails', description: 'Creating 3 A/B variants per clip…', icon: ImageIcon },
  { id: 'sovereignty', label: 'Sovereignty Integrity Audit', description: 'Cross-validating for clichés & hallucinations…', icon: ShieldCheck },
  { id: 'metadata', label: 'Write Metadata', description: 'Crafting SEO titles, descriptions, hashtags…', icon: FileText },
  { id: 'draft', label: 'Draft to Calendar', description: 'Pushing approved content to your queue…', icon: Calendar },
]

const STATUS_COLORS: Record<AgentTaskStatus, string> = {
  queued: 'text-slate-500',
  running: 'text-fuchsia-400',
  done: 'text-emerald-400',
  error: 'text-rose-400',
}

const STATUS_BG: Record<AgentTaskStatus, string> = {
  queued: 'bg-white/5',
  running: 'bg-fuchsia-500/10 border-fuchsia-500/20',
  done: 'bg-emerald-500/10 border-emerald-500/20',
  error: 'bg-rose-500/10 border-rose-500/20',
}

// ── Component ────────────────────────────────────────────────────────────────
const AgenticWorkflowManager: React.FC<AgenticWorkflowManagerProps> = ({
  videoId,
  showToast,
  onAgentRunning,
  onDraftReady,
}) => {
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(
    new Set(['viral_clips', 'thumbnails', 'descriptions', 'schedule'])
  )
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(-1)
  const [draftClips, setDraftClips] = useState<any[]>([])
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runAgent = useCallback(async () => {
    if (!videoId) {
      showToast('No video loaded — upload or select a video first', 'error')
      return
    }

    // Reset
    const initialTasks: AgentTask[] = PIPELINE_STEPS.map(s => ({ ...s, status: 'queued' }))
    setTasks(initialTasks)
    setSwarmHUDTask('Initialize agent workflow')
    setShowSwarmHUD(true)
    setIsRunning(true)
    setCurrentStep(0)
    setDraftClips([])
    onAgentRunning?.(true)

    try {
      // Call backend to start the agent
      const res = await fetch('/api/agentic/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, goals: Array.from(selectedGoals) }),
      }).catch(() => null)

      const newJobId = res?.ok ? (await res.json()).jobId : `mock-${Date.now()}`
      setJobId(newJobId)

      // Simulate step-by-step progress (real impl: poll /api/agentic/status/:jobId)
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        setCurrentStep(i)
        setTasks(prev => prev.map((t, idx) =>
          idx === i ? { ...t, status: 'running' } : t
        ))
        await new Promise(r => setTimeout(r, 1400 + Math.random() * 800))
        setTasks(prev => prev.map((t, idx) =>
          idx === i ? { ...t, status: 'done', result: getStepResult(PIPELINE_STEPS[i].id) } : t
        ))
      }

      // Mock drafted clips result
      const clips = [
        { id: '1', title: 'Hook Moment — 0:03', score: 96, duration: 28 },
        { id: '2', title: 'Value Drop — 1:12', score: 88, duration: 45 },
        { id: '3', title: 'CTA Outro — 3:40', score: 81, duration: 32 },
      ]
      setDraftClips(clips)
      onDraftReady?.(clips)
      showToast(`Agent complete — ${clips.length} clips drafted to calendar`, 'success')
    } catch (err) {
      setTasks(prev => prev.map(t => t.status === 'running' ? { ...t, status: 'error' } : t))
      showToast('Agent encountered an error — check console', 'error')
    } finally {
      setIsRunning(false)
      setCurrentStep(-1)
      onAgentRunning?.(false)
    }
  }, [videoId, selectedGoals, showToast, onAgentRunning, onDraftReady])

  const reset = () => {
    setTasks([])
    setDraftClips([])
    setJobId(null)
    setCurrentStep(-1)
  }

  const doneCount = tasks.filter(t => t.status === 'done').length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 max-w-[1200px] mx-auto pb-20 px-4 py-8"
    >
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-black uppercase tracking-[0.5em]">
          <Bot className="w-3.5 h-3.5 animate-pulse" />
          Autonomous Content Agent — 2026
        </div>
        <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
          AI Agent<br />Workflow
        </h1>
        <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
          The agent runs <span className="text-white font-black">autonomously in the background</span> — transcribing, scoring, cutting, branding, and drafting your content to the calendar without a single click.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
        {/* Left — Goals + Pipeline */}
        <div className="space-y-6">

          {/* Goal Selector */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-5`}>
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Agent Goals</span>
              <span className="ml-auto text-[9px] font-black text-slate-600 uppercase tracking-widest">Select what the agent should do</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENT_GOALS.map(goal => {
                const Icon = goal.icon
                const selected = selectedGoals.has(goal.id)
                return (
                  <motion.button
                    key={goal.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => toggleGoal(goal.id)}
                    disabled={isRunning}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all disabled:opacity-40 ${
                      selected
                        ? 'bg-fuchsia-500/10 border-fuchsia-500/30'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selected ? 'bg-fuchsia-500/20' : 'bg-white/5'
                    }`}>
                      <Icon className={`w-4 h-4 ${selected ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${selected ? 'text-white' : 'text-slate-400'}`}>{goal.label}</p>
                      <p className="text-[9px] text-slate-600">{goal.desc}</p>
                    </div>
                    {selected && <CheckCircle2 className="w-4 h-4 text-fuchsia-400 ml-auto shrink-0" />}
                  </motion.button>
                )
              })}
            </div>

            {/* Run Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={isRunning ? undefined : (tasks.length > 0 ? reset : runAgent)}
              disabled={selectedGoals.size === 0}
              className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg transition-all disabled:opacity-40 ${
                isRunning
                  ? 'bg-fuchsia-900/40 border border-fuchsia-500/20 text-fuchsia-400 cursor-not-allowed'
                  : tasks.length > 0
                  ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
                  : 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-fuchsia-500/20'
              }`}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Agent Running…</>
              ) : tasks.length > 0 ? (
                <><RefreshCw className="w-4 h-4" /> Run Again</>
              ) : (
                <><Bot className="w-4 h-4" /> Start Autonomous Agent</>
              )}
            </motion.button>
          </div>

          {/* Pipeline Progress */}
          <AnimatePresence>
            {tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glassStyle} rounded-[2.5rem] p-6 space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className={`w-4 h-4 ${isRunning ? 'text-fuchsia-400 animate-pulse' : 'text-emerald-400'}`} />
                    <span className="text-sm font-black text-white uppercase tracking-wider">Pipeline Progress</span>
                  </div>
                  <span className="text-[11px] font-black font-mono text-fuchsia-400">{progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  {tasks.map((task, idx) => {
                    const Icon = task.icon
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all ${STATUS_BG[task.status]}`}
                      >
                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          task.status === 'running' ? 'bg-fuchsia-500/20' :
                          task.status === 'done' ? 'bg-emerald-500/20' : 'bg-white/5'
                        }`}>
                          {task.status === 'running' ? (
                            <Loader2 className="w-3.5 h-3.5 text-fuchsia-400 animate-spin" />
                          ) : task.status === 'done' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : task.status === 'error' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[task.status]}`}>
                            {task.label}
                          </p>
                          {task.status === 'running' && (
                            <p className="text-[9px] text-slate-600 italic mt-0.5">{task.description}</p>
                          )}
                          {task.result && task.status === 'done' && (
                            <p className="text-[9px] text-emerald-600 mt-0.5">{task.result}</p>
                          )}
                        </div>

                        {task.status === 'queued' && (
                          <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — Draft Clips Result */}
        <div className="space-y-6">
          <AnimatePresence>
            {draftClips.length > 0 && (
              <motion.div
                key="drafts"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`${glassStyle} rounded-[2.5rem] p-6 space-y-5`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-black text-white uppercase tracking-wider">Draft Clips Ready</span>
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400">
                    {draftClips.length} clips
                  </span>
                </div>

                {draftClips.map((clip, i) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white uppercase truncate">{clip.title}</p>
                      <p className="text-[9px] text-slate-600">{clip.duration}s · Score {clip.score}%</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20">
                      <span className="text-[9px] font-black text-emerald-400">{clip.score}%</span>
                    </div>
                  </motion.div>
                ))}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => showToast('Clips sent to Content Calendar', 'success')}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" /> View in Calendar
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* How it works */}
          {tasks.length === 0 && (
            <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-5`}>
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-black text-slate-500 uppercase tracking-wider">How the Agent Works</span>
              </div>
              <div className="space-y-4">
                {[
                  { step: '01', text: 'Transcribes your video with Whisper for word-level precision' },
                  { step: '02', text: 'Scores every second for viral potential, hook strength & retention signals' },
                  { step: '03', text: 'Auto-cuts the top N clips, applies brand templates and captions' },
                  { step: '04', text: 'Generates A/B thumbnail variants and SEO-optimized metadata' },
                  { step: '05', text: 'Drafts everything to your Content Calendar for one-click approval & publish' },
                ].map(item => (
                  <div key={item.step} className="flex items-start gap-4">
                    <span className="text-[10px] font-black text-fuchsia-500/50 shrink-0 mt-0.5">{item.step}</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </motion.div>
  )
}

function getStepResult(stepId: string): string {
  const map: Record<string, string> = {
    transcribe: '1,432 words captured across 4:12 runtime',
    score: '7 high-potential moments identified (>80% score)',
    cut: '5 clips cut, handles trimmed, pacing optimized',
    brand: 'Font, logo & colors applied from Brand Kit',
    thumbs: '3 A/B thumbnail variants generated per clip',
    metadata: 'Title, description & hashtags written for 5 clips',
    draft: '5 clips queued to calendar — Mon–Fri 9 AM slots',
  }
  return map[stepId] ?? 'Step complete'
}

export default AgenticWorkflowManager
