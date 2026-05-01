'use client'

import React from 'react'
import {
  Sparkles,
  Type,
  Film,
  Target,
  Zap,
  ChevronRight,
  CheckCircle2,
  Cpu,
  Target as TargetIcon,
  Activity,
  ArrowUpRight,
  Layers,
  Radio,
  Scissors,
  Wand2,
  ArrowDownToLine,
  Volume2,
  Undo2,
  CheckCheck,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { EditorCategory, AIDirectorSuggestion } from '../../../types/editor'

import { useState } from 'react'
import { apiPost } from '../../../lib/api'

const CREATIVITY_TIPS = [
  { icon: TargetIcon, title: 'Hook Velocity', desc: 'Secure retention in the first 3s. Grab attention with a bold semantic claim.', id: 'edit' as EditorCategory, color: 'text-[var(--tint-rose-fg)]', bg: 'bg-[var(--tint-rose-bg)]' },
  { icon: Type, title: 'Conversion Matrix', desc: 'Add "Subscribe" or "Link in Bio" nodes as calibrated text overlays.', id: 'edit' as EditorCategory, color: 'text-[var(--tint-indigo-fg)]', bg: 'bg-[var(--tint-indigo-bg)]' },
  { icon: Film, title: 'B-Roll Clusters', desc: 'Saturate dead air with visual variety. Inject B-roll from Neural Repository.', id: 'assets' as EditorCategory, color: 'text-[var(--tint-emerald-fg)]', bg: 'bg-[var(--tint-emerald-bg)]' },
  { icon: Zap, title: 'Semantic Sync', desc: 'Use Elite AI to bridge transcription and trim dead air nodes.', id: 'ai-edit' as EditorCategory, color: 'text-[var(--tint-fuchsia-fg)]', bg: 'bg-[var(--tint-fuchsia-bg)]' },
]

interface AIAssistViewProps {
  videoId?: string
  transcript?: any
  aiSuggestions?: any[]
  setAiSuggestions?: (suggestions: any[]) => void
  /** Typed suggestion list — owns the new Apply path. */
  directorSuggestions?: AIDirectorSuggestion[]
  /** Set of suggestion ids already applied — used to grey out applied cards. */
  appliedIds?: Set<string>
  /** Apply a single suggestion to the timeline. Wired from useTimelineActions. */
  onApplyOne?: (s: AIDirectorSuggestion) => boolean
  /** Apply all unapplied suggestions in one history-restorable batch. */
  onApplyAll?: (list: AIDirectorSuggestion[]) => { applied: number; skipped: number }
  /** Undo the last apply (single suggestion or whole batch). */
  onUndoLast?: () => boolean
  canUndo?: boolean
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const SUGGESTION_ICON: Record<AIDirectorSuggestion['type'], React.ComponentType<{ className?: string }>> = {
  cut: Scissors,
  broll: Film,
  hook: Target,
  transition: ArrowDownToLine,
  audio: Volume2,
  effect: Wand2,
}

const IMPACT_TONE: Record<AIDirectorSuggestion['impact'], { bar: string; text: string; bg: string }> = {
  high: { bar: 'bg-rose-500', text: 'text-rose-300', bg: 'bg-[var(--tint-rose-bg)]' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-300', bg: 'bg-[var(--tint-amber-bg)]' },
  low: { bar: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' },
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

const AIAssistView: React.FC<AIAssistViewProps> = ({
  videoId,
  transcript,
  aiSuggestions,
  setAiSuggestions,
  directorSuggestions = [],
  appliedIds,
  onApplyOne,
  onApplyAll,
  onUndoLast,
  canUndo = false,
  setActiveCategory,
  showToast,
}) => {
  const [isFindingCuts, setIsFindingCuts] = useState(false)

  const handleFindSmartCuts = async () => {
    if (!videoId) {
      showToast('No video ID available for analysis', 'error')
      return
    }

    try {
      setIsFindingCuts(true)
      showToast('Initializing Semantic Analysis Engine...', 'info')
      
      const response = await apiPost<{ data: any }>('/video/manual-editing/ai-assist/smart-cuts', {
        videoId,
        transcript,
        metadata: {}
      })
      
      const suggestions = response?.data?.suggestions || []
      if (suggestions.length > 0) {
        setAiSuggestions?.(suggestions)
        showToast(`Identified ${suggestions.length} dead-air/smart-cut nodes. Check the timeline.`, 'success')
      } else {
        showToast('No sub-optimal clips detected. Pacing is optimal.', 'info')
      }
    } catch (err: any) {
      console.error('Smart cut error', err)
      showToast(err?.message || 'Cognitive analysis failed', 'error')
    } finally {
      setIsFindingCuts(false)
    }
  }
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  // Director Suggestions panel — applies AIDirectorSuggestion records to
  // the manual timeline through useTimelineActions in ModernVideoEditor.
  // Surfaced as the first card so the most-actionable AI output is at the
  // top of the AI tab instead of buried below the tips card.
  const pendingSuggestions = directorSuggestions.filter(s => !appliedIds?.has(s.id))
  const appliedCount = directorSuggestions.length - pendingSuggestions.length

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 max-w-[1200px] mx-auto py-4"
    >
      {/* Director Suggestions — apply AI decisions to the timeline in one click */}
      {directorSuggestions.length > 0 && (
        <motion.div
          variants={itemVariants}
          className={`${glassStyle} rounded-3xl p-6 md:p-8 relative overflow-hidden`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tint-fuchsia-bg)] border border-[var(--tint-fuchsia-edge)] text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">
                <Sparkles className="w-3 h-3" />
                Director Suggestions
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {pendingSuggestions.length > 0
                  ? `${pendingSuggestions.length} suggestion${pendingSuggestions.length === 1 ? '' : 's'} ready to apply`
                  : appliedCount > 0
                    ? `All ${appliedCount} suggestion${appliedCount === 1 ? '' : 's'} applied`
                    : 'No suggestions yet'}
              </h2>
              <p className="text-slate-400 text-sm">
                One click pipes the AI's call directly into your timeline. Undo any time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canUndo && (
                <button
                  type="button"
                  onClick={() => onUndoLast?.()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo last
                </button>
              )}
              <button
                type="button"
                disabled={pendingSuggestions.length === 0}
                onClick={() => onApplyAll?.(pendingSuggestions)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-fuchsia-500/30"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Apply all
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {directorSuggestions.map((s) => {
              const Icon = SUGGESTION_ICON[s.type] || Sparkles
              const tone = IMPACT_TONE[s.impact] || IMPACT_TONE.low
              const applied = !!appliedIds?.has(s.id)
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${applied
                    ? 'bg-emerald-500/5 border-[var(--tint-emerald-edge)] opacity-60'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/15'}`}
                >
                  <div className={`w-10 h-10 rounded-xl ${tone.bg} border border-white/5 flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${tone.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-white">{s.label}</span>
                      <span className="text-[10px] tabular-nums text-slate-500">@ {s.time.toFixed(1)}s</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tone.text}`}>{s.impact}</span>
                      {applied && <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--tint-emerald-fg)]">Applied</span>}
                    </div>
                    <p className="text-sm text-slate-400 truncate">{s.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold tabular-nums text-slate-500">{Math.round(s.confidence * 100)}%</span>
                    <button
                      type="button"
                      disabled={applied}
                      onClick={() => onApplyOne?.(s)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${applied
                        ? 'bg-[var(--tint-emerald-bg)] text-[var(--tint-emerald-fg)] cursor-default'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                    >
                      {applied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Applied
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Apply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Primary Intelligence Section */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3rem] p-12 relative overflow-hidden group shadow-3xl`}
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-12">
          <Cpu className="w-48 h-48 text-emerald-500" />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-12 relative z-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-[var(--tint-emerald-bg)] border border-[var(--tint-emerald-edge)] text-[10px] font-black uppercase tracking-[0.4em] italic text-[var(--tint-emerald-fg)] shadow-xl">
              <Activity className="w-4 h-4 animate-pulse" />
              Cognitive Support
            </div>
            <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
              NEURAL<br />COGNITION
            </h2>
            <p className="text-slate-500 text-lg font-medium tracking-tight italic">
              Calibrated editing insights to maximize <span className="text-white font-black italic underline decoration-emerald-500/30 underline-offset-8">Engagement Alpha</span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {CREATIVITY_TIPS.map((tip, idx) => {
            const Icon = tip.icon
            return (
              <motion.button
                key={tip.title}
                type="button"
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveCategory(tip.id); showToast(`Opening ${tip.id}`, 'info') }}
                className="group w-full flex items-start gap-6 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-[var(--tint-emerald-edge)] hover:bg-white/[0.05] transition-all duration-500 text-left shadow-inner"
              >
                <div className={`w-16 h-16 rounded-[1.2rem] ${tip.bg} flex items-center justify-center shrink-0 border border-white/5 shadow-2xl transition-transform group-hover:scale-110`}>
                  <Icon className={`w-7 h-7 ${tip.color}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xl font-black text-white italic uppercase tracking-tighter">{tip.title}</p>
                  <p className="text-sm text-slate-500 font-medium italic group-hover:text-slate-300 transition-colors leading-relaxed">{tip.desc}</p>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-800 group-hover:text-[var(--tint-emerald-fg)] transition-colors shrink-0" />
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Primary Gateway Section */}
      <motion.div
        variants={itemVariants}
        className="p-10 bg-fuchsia-600/5 rounded-[3rem] border border-fuchsia-500/10 relative overflow-hidden group shadow-3xl"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
          <Sparkles className="w-32 h-32 text-fuchsia-500" />
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-4 text-[var(--tint-fuchsia-fg)]">
              <CheckCircle2 className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] italic shadow-inner">Elite Node Protocol</span>
            </div>
            <p className="text-lg text-slate-400 font-medium italic pr-10">
              For complete autonomous workflows including <span className="text-white font-black italic underline decoration-fuchsia-500/30">viral quote extraction</span> and auto-segments, initialize the Elite AI core.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveCategory('ai-edit')}
            className="px-12 py-6 bg-fuchsia-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] italic shadow-3xl shadow-fuchsia-600/40 border border-white/20 flex items-center gap-4 transition-all"
          >
            <Sparkles className="w-6 h-6" />
            OPEN ELITE AI CORE
          </motion.button>
        </div>
      </motion.div>

      {/* Smart Cuts Module */}
      <motion.div
        variants={itemVariants}
        className={`${glassStyle} rounded-[3rem] p-12 relative overflow-hidden group shadow-3xl flex flex-col items-center justify-center text-center`}
      >
         <div className="absolute top-0 left-0 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000 rotate-[-12deg]">
          <Target className="w-48 h-48 text-indigo-500" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto space-y-6">
           <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-[var(--tint-indigo-bg)] border border-[var(--tint-indigo-edge)] text-[10px] font-black uppercase tracking-[0.4em] italic text-[var(--tint-indigo-fg)] shadow-xl mx-auto">
              <Zap className="w-4 h-4" />
              Timeline Polish
            </div>
            
            <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase">
              Semantic Smart Cuts
            </h3>
            <p className="text-slate-400 font-medium italic text-lg pb-6">
              Autonomously scan the timeline for dead air, repetitive phrases, and awkward pauses. We will mark the timeline with AI nodes for one-click removal.
            </p>

            <motion.button
              disabled={isFindingCuts || !videoId}
              onClick={handleFindSmartCuts}
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.4em] italic shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] border border-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
            >
              {isFindingCuts ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  Analyzing Pacing...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Find Smart Cuts
                </>
              )}
            </motion.button>
        </div>
      </motion.div>

      {/* Status HUD */}
      <motion.div variants={itemVariants} className="flex items-center justify-between px-10 opacity-20 invisible md:visible">
        <div className="flex items-center gap-4">
          <Radio className="w-4 h-4 text-slate-500" />
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Uplink Stable</span>
        </div>
        <div className="flex items-center gap-4">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Cognitive Node: 0x82A</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default AIAssistView
