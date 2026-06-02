'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Check, ArrowRight, Sparkles, Upload, FileText, Video, Send,
  BarChart3, ChevronDown, ChevronUp, Bot, AlertTriangle,
  type LucideIcon
} from 'lucide-react'
import {
  useWorkflow, STAGE_ORDER, STAGE_META, stageFromPath, nextStageMeta,
  type WorkflowStage,
} from '../contexts/WorkflowContext'
import { useTranslation } from '../hooks/useTranslation'
import LanguagePicker from './LanguagePicker'
import { motion, AnimatePresence } from 'framer-motion'

const STAGE_ICONS: Record<WorkflowStage, LucideIcon> = {
  ingest: Upload,
  script: FileText,
  edit: Video,
  schedule: Send,
  analyze: BarChart3,
}

interface CoPilotContent {
  headline: string
  actionLabel: string
  actionRoute: string
  desc: string
  nicheTip: string
  color: string
}

const STAGE_COPILOTS: Record<WorkflowStage, CoPilotContent> = {
  ingest: {
    headline: 'Initialize Raw Ingestion',
    actionLabel: 'Browse Forge assets',
    actionRoute: '/dashboard/forge',
    desc: 'Upload standard mp4/mov footage or paste direct uplinks. I will map pause timestamps and execute professional speed ramping.',
    nicheTip: 'Auto-ramping highlights verbal emphasis, boosting short-form saturation metrics by ~15%.',
    color: 'from-orange-500/20 to-rose-500/20 border-orange-500/30 text-orange-400'
  },
  script: {
    headline: 'Refine Hook Matrix',
    actionLabel: 'Draft Hooks',
    actionRoute: '/dashboard/scripts',
    desc: 'AI drafts Attention/Interest/Desire/Action matrices based on your taste graph. Let\'s make sure your opening 3 seconds holds absolute grip.',
    nicheTip: 'A/B title tests are pre-loaded in your Mongo metadata ledger.',
    color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400'
  },
  edit: {
    headline: 'Brand Subtitle Outline & VFX',
    actionLabel: 'Open Video Studio',
    actionRoute: '/dashboard/video',
    desc: 'Cinematic luma grading, chromatic-displacement glitch transitions, and semantic unicode emoji captions are ready to concatenate.',
    nicheTip: 'Verify subtitle color-bias in the properties slider drawer.',
    color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-400'
  },
  schedule: {
    headline: 'Platform Swarm Schedule',
    actionLabel: 'Open Scheduler',
    actionRoute: '/dashboard/scheduler',
    desc: 'Connected substrates online. TikTok, YT Shorts, and X are pre-queued. Peak chronological audience saturation is approaching.',
    nicheTip: 'Optimal post window calculated at 19:00 UTC.',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400'
  },
  analyze: {
    headline: 'Telemetry & Swarm Learning',
    actionLabel: 'View Diagnostics',
    actionRoute: '/dashboard/analytics',
    desc: 'Reach, affinity, and diffusion scores are synced. I am updating your stylistic taste graph to lock in successful elements.',
    nicheTip: 'Glitch transitions in last cycle generated +12% view resonance.',
    color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400'
  }
}

export default function WorkflowRail() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, setStage, setPlatform, completeStage } = useWorkflow()
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)

  const flashError = useCallback((msg: string) => {
    setStageError(msg)
    setTimeout(() => setStageError(null), 2500)
  }, [])

  // Auto-advance: when the user navigates forward into a later stage's
  // route (e.g. moves from /dashboard/forge → /dashboard/scripts), mark
  // every stage they crossed over as completed.
  useEffect(() => {
    if (!pathname) return
    const route = stageFromPath(pathname)
    if (!route) return
    const newIdx = STAGE_ORDER.indexOf(route)
    const curIdx = STAGE_ORDER.indexOf(state.stage)
    if (newIdx > curIdx) {
      for (let i = curIdx; i < newIdx; i++) {
        if (!state.completed[STAGE_ORDER[i]]) completeStage(STAGE_ORDER[i])
      }
      setStage(route)
    }
  }, [pathname, state.stage, state.completed, completeStage, setStage])

  const stageLabel = (s: WorkflowStage) => {
    const k = `workflow.stages.${s}.label`
    const v = t(k)
    return v === k ? STAGE_META[s].label : v
  }

  if (!pathname || pathname === '/' || pathname === '/login' || pathname === '/register') return null
  if (/^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null
  if (!pathname.startsWith('/dashboard')) return null

  const routeStage = stageFromPath(pathname)
  const activeStage = routeStage ?? state.stage
  const next = nextStageMeta(activeStage)
  
  const PLATFORM_OPTIONS: { id: NonNullable<ReturnType<typeof useWorkflow>['state']['platform']>; label: string }[] = [
    { id: 'tiktok',          label: 'TikTok' },
    { id: 'instagram',       label: 'Instagram' },
    { id: 'youtube-shorts',  label: 'YT Shorts' },
    { id: 'youtube',         label: 'YouTube' },
    { id: 'twitter',         label: 'X/Twitter' },
    { id: 'linkedin',        label: 'LinkedIn' },
    { id: 'facebook',        label: 'Facebook' },
  ]

  const cop = STAGE_COPILOTS[activeStage]

  return (
    <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-surface-200/50 dark:border-white/10 transition-all duration-500 shadow-sm flex flex-col">
      <div className="px-4 lg:px-8 py-3 flex items-center gap-4 lg:gap-6 overflow-x-auto custom-scrollbar w-full scroll-smooth"
           style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {/* Niche pill */}
        <Link
          href="/dashboard/niche"
          className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full bg-surface-50 dark:bg-slate-900 border border-surface-200 dark:border-white/10 hover:border-indigo-500/40 transition-all flex-shrink-0 group"
        >
          <Sparkles size={12} className="text-indigo-400 group-hover:scale-110 transition-transform animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-900 dark:text-white">
            {state.niche || 'SET_NICHE'}
          </span>
        </Link>

        {/* Platform picker */}
        <button
          type="button"
          onClick={() => {
            const idx = PLATFORM_OPTIONS.findIndex(p => p.id === state.platform)
            const next = PLATFORM_OPTIONS[(idx + 1) % PLATFORM_OPTIONS.length]
            setPlatform(next.id)
          }}
          title="Pick platform"
          aria-label="Pick platform"
          className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full bg-surface-50 dark:bg-slate-900 border border-surface-200 dark:border-white/10 hover:border-indigo-500/40 transition-all flex-shrink-0 group"
        >
          <Send size={12} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-900 dark:text-white">
            {PLATFORM_OPTIONS.find(p => p.id === state.platform)?.label || 'PICK_PLATFORM'}
          </span>
        </button>

        {/* Stages */}
        <ol className="flex items-center gap-2 flex-1 min-w-0">
          {STAGE_ORDER.map((s, i) => {
            const Icon = STAGE_ICONS[s]
            const meta = STAGE_META[s]
            const isCurrent = s === activeStage
            const isDone = state.completed[s]
            const isReachable = isDone || isCurrent || (i > 0 && state.completed[STAGE_ORDER[i - 1]])

            return (
              <React.Fragment key={s}>
                <li className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isReachable) { setStage(s); router.push(meta.route) }
                      else flashError(`Complete previous stages to unlock ${stageLabel(s)}`)
                    }}
                    disabled={!isReachable}
                    aria-current={isCurrent ? 'step' : undefined}
                    title={stageLabel(s)}
                    aria-label={stageLabel(s)}
                    className={`group flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ease-out whitespace-nowrap ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105 ring-2 ring-indigo-500/30'
                        : isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                          : isReachable
                            ? 'bg-white/50 dark:bg-slate-900/50 border-surface-200 dark:border-white/10 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:border-surface-300 dark:hover:border-indigo-500/40 hover:scale-105'
                            : 'bg-transparent border-transparent text-surface-400 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check size={12} className="group-hover:scale-110 transition-transform" /> : <Icon size={12} className="group-hover:scale-110 transition-transform" />}
                    <span className="hidden sm:inline">{stageLabel(s)}</span>
                  </button>
                </li>
                {i < STAGE_ORDER.length - 1 && (
                  <li aria-hidden="true" className={`h-px w-4 sm:w-8 flex-shrink-0 ${state.completed[s] ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-white/10'}`} />
                )}
              </React.Fragment>
            )
          })}
        </ol>

        {/* Co-Pilot Toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          title="Toggle Co-Pilot"
          aria-label="Toggle Co-Pilot"
          className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all ${
            drawerOpen 
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-inner' 
              : 'bg-slate-900 border-white/10 text-slate-400 hover:border-indigo-500/40 hover:text-white'
          }`}
        >
          <Bot size={12} className={drawerOpen ? 'animate-pulse' : ''} />
          <span>Co-Pilot</span>
          {drawerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Next CTA */}
        {next && (
          <Link
            href={next.route}
            onClick={(e) => {
              if (!state.completed[activeStage]) {
                e.preventDefault()
              } else {
                setStage(next.stage)
              }
            }}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all duration-300 ease-out flex-shrink-0 ${
              state.completed[activeStage] 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-md'
                : 'bg-surface-200 dark:bg-slate-900 text-surface-400 cursor-not-allowed border border-white/5'
            }`}
          >
            <span>NEXT: {stageLabel(next.stage)}</span>
            <ArrowRight size={12} />
          </Link>
        )}

        <LanguagePicker compact />
      </div>

      {/* Stage error flash */}
      <AnimatePresence>
        {stageError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 z-50 flex items-center gap-2 px-4 py-2 bg-rose-950/90 border-b border-rose-500/30 text-rose-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
          >
            <AlertTriangle size={12} className="shrink-0" />
            {stageError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Co-Pilot Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="overflow-hidden border-t border-white/5 bg-slate-950/40 backdrop-blur-xl w-full"
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-8 flex items-start gap-4">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${cop.color} flex items-center justify-center shrink-0 border`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-white leading-none">
                    {cop.headline}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    {cop.desc}
                  </p>
                  <p className="text-[10px] font-semibold text-indigo-400 italic">
                    💡 Swarm Tip: {cop.nicheTip}
                  </p>
                </div>
              </div>

              <div className="md:col-span-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    try { completeStage(activeStage) }
                    catch { flashError('Could not advance stage — please try again') }
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-900 border border-white/10 hover:border-emerald-500/40 hover:text-emerald-400 text-slate-300 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Skip step
                </button>
                <Link
                  href={cop.actionRoute}
                  className="px-6 py-3 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-glow-primary"
                >
                  {cop.actionLabel} <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
