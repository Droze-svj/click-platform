'use client'

import React from 'react'
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

/**
 * Compact horizontal rail that lives at the top of every dashboard page.
 * Shows the 5-stage workflow, marks completed steps, highlights the current
 * stage based on the route, and surfaces a one-tap "Next:" CTA so users
 * always know what to do next.
 */
export default function WorkflowRail() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, setStage } = useWorkflow()
  const { t } = useTranslation()

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

  // Don't render on the full-screen video editor page or auth pages
  if (!pathname || pathname === '/' || pathname === '/login' || pathname === '/register') return null
  if (/^\/dashboard\/video\/edit\/[^/]+$/.test(pathname)) return null
  if (!pathname.startsWith('/dashboard')) return null

  const routeStage = stageFromPath(pathname)
  const activeStage = routeStage ?? state.stage
  const next = nextStageMeta(activeStage)

  return (
    <div className="sticky top-0 z-30 backdrop-blur-2xl bg-[#020205]/80 border-b border-white/[0.05]">
      <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3 lg:gap-5 overflow-x-auto custom-scrollbar">
        {/* Niche pill (left) */}
        <Link
          href="/dashboard/niche"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.06] transition-all flex-shrink-0 group"
          title={stageDesc('script')}
        >
          <Sparkles size={11} className="text-fuchsia-400 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">{t('workflow.niche') || 'Niche'}</span>
          <span className="text-[10px] font-bold text-white max-w-[120px] truncate">
            {state.niche || (t('workflow.setNiche') || 'Set niche')}
          </span>
        </Link>

        {/* Stages */}
        <ol className="flex items-center gap-1 flex-1 min-w-0">
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
                    title={stageDesc(s)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-bold transition-all whitespace-nowrap ${
                      isCurrent
                        ? 'bg-gradient-to-r from-fuchsia-500/20 to-violet-500/20 border-fuchsia-500/40 text-white shadow-md shadow-fuchsia-500/10'
                        : isDone
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : isReachable
                            ? 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05]'
                            : 'bg-white/[0.01] border-white/5 text-slate-600'
                    }`}
                  >
                    {isDone && !isCurrent
                      ? <Check size={11} className="text-emerald-400" />
                      : <Icon size={11} className={isCurrent ? 'text-fuchsia-300' : ''} />}
                    <span className="uppercase tracking-[0.14em]">{stageLabel(s)}</span>
                  </button>
                </li>
                {i < STAGE_ORDER.length - 1 && (
                  <li aria-hidden className={`h-px w-3 lg:w-5 flex-shrink-0 ${
                    state.completed[s] ? 'bg-emerald-500/40' : 'bg-white/10'
                  }`} />
                )}
              </React.Fragment>
            )
          })}
        </ol>

        {/* Next CTA (right) */}
        {next && (
          <Link
            href={next.route}
            onClick={() => setStage(next.stage)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white text-[10px] font-black uppercase tracking-[0.16em] shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 transition-all flex-shrink-0"
          >
            <span>{(t('workflow.next') || 'Next')}: {stageLabel(next.stage)}</span>
            <ArrowRight size={11} />
          </Link>
        )}

        {/* Language picker (far right) */}
        <LanguagePicker compact />
      </div>
    </div>
  )
}
