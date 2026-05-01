'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ArrowRight, Sparkles, Upload, FileText, Video, Send, BarChart3, type LucideIcon } from 'lucide-react'
import {
  useWorkflow, STAGE_ORDER, STAGE_META, stageFromPath, nextStageMeta,
  type WorkflowStage,
} from '../contexts/WorkflowContext'
import { useTranslation } from '../hooks/useTranslation'
import LanguagePicker from './LanguagePicker'

const STAGE_ICONS: Record<WorkflowStage, LucideIcon> = {
  ingest: Upload,
  script: FileText,
  edit: Video,
  schedule: Send,
  analyze: BarChart3,
}

export default function WorkflowRail() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, setStage, setPlatform, completeStage } = useWorkflow()
  const { t } = useTranslation()

  // Auto-advance: when the user navigates forward into a later stage's
  // route (e.g. moves from /dashboard/forge → /dashboard/scripts), mark
  // every stage they crossed over as completed. We only advance forward —
  // navigating backward shouldn't reset progress.
  useEffect(() => {
    if (!pathname) return
    const route = stageFromPath(pathname)
    if (!route) return
    const newIdx = STAGE_ORDER.indexOf(route)
    const curIdx = STAGE_ORDER.indexOf(state.stage)
    if (newIdx > curIdx) {
      // Mark every stage between (curIdx, newIdx) inclusive of curIdx as done.
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
  const stageDesc = (s: WorkflowStage) => {
    const k = `workflow.stages.${s}.description`
    const v = t(k)
    return v === k ? STAGE_META[s].description : v
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

  return (
    <div className="sticky top-0 z-30 backdrop-blur-[var(--glass-blur)] bg-[var(--glass-surface)] border-b border-[var(--glass-border)] transition-colors duration-500">
      <div className="px-4 lg:px-8 py-3 flex items-center gap-4 lg:gap-6 overflow-x-auto custom-scrollbar">
        {/* Niche pill */}
        <Link
          href="/dashboard/niche"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:border-[var(--tint-fuchsia-edge)] hover:bg-[var(--tint-fuchsia-bg)] transition-all flex-shrink-0 group"
        >
          <Sparkles size={12} className="text-[var(--tint-fuchsia-fg)] group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]">
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--glass-surface)] border border-[var(--glass-border)] hover:border-[var(--tint-indigo-edge)] hover:bg-[var(--tint-indigo-bg)] transition-all flex-shrink-0 group"
        >
          <Send size={12} className="text-[var(--tint-indigo-fg)] group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]">
            {PLATFORM_OPTIONS.find(p => p.id === state.platform)?.label || 'PICK'}
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
                    onClick={() => { setStage(s); router.push(meta.route) }}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      isCurrent
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/30'
                        : isDone
                          ? 'bg-[var(--tint-emerald-bg)] border-[var(--tint-emerald-edge)] text-[var(--tint-emerald-fg)]'
                          : isReachable
                            ? 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)]'
                            : 'bg-transparent border-transparent text-[var(--text-dim)] opacity-50'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check size={12} /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{stageLabel(s)}</span>
                  </button>
                </li>
                {i < STAGE_ORDER.length - 1 && (
                  <li aria-hidden="true" className={`h-px w-4 sm:w-8 flex-shrink-0 ${state.completed[s] ? 'bg-[var(--tint-emerald-edge)]' : 'bg-[var(--glass-border)]'}`} />
                )}
              </React.Fragment>
            )
          })}
        </ol>

        {/* Next CTA */}
        {next && (
          <Link
            href={next.route}
            onClick={() => setStage(next.stage)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 transition-all flex-shrink-0"
          >
            <span>NEXT: {stageLabel(next.stage)}</span>
            <ArrowRight size={12} />
          </Link>
        )}

        <LanguagePicker compact />
      </div>
    </div>
  )
}
