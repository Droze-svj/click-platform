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
    <div className="sticky top-0 z-30 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 transition-colors duration-500 shadow-sm">
      <div className="px-4 lg:px-8 py-3 flex items-center gap-4 lg:gap-6 overflow-x-auto custom-scrollbar">
        {/* Niche pill */}
        <Link
          href="/dashboard/niche"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex-shrink-0 group"
        >
          <Sparkles size={12} className="text-[var(--tint-fuchsia-fg)] group-hover:scale-110 transition-transform" />
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all flex-shrink-0 group"
        >
          <Send size={12} className="text-[var(--tint-indigo-fg)] group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-900 dark:text-white">
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                      isCurrent
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : isDone
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400'
                          : isReachable
                            ? 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white'
                            : 'bg-transparent border-transparent text-surface-400 opacity-50'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check size={12} /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{stageLabel(s)}</span>
                  </button>
                </li>
                {i < STAGE_ORDER.length - 1 && (
                  <li aria-hidden="true" className={`h-px w-4 sm:w-8 flex-shrink-0 ${state.completed[s] ? 'bg-emerald-500' : 'bg-surface-200 dark:bg-surface-800'}`} />
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
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-primary-700 transition-all flex-shrink-0"
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
