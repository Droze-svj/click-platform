'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type WorkflowStage =
  | 'ingest'    // pick / upload source video
  | 'script'    // generate / refine script + hooks
  | 'edit'      // cut, captions, motion
  | 'schedule'  // pick platforms + post times
  | 'analyze'   // measure + iterate

export interface WorkflowProject {
  id: string
  title: string
  videoId?: string
  thumbnailUrl?: string
  updatedAt: number
}

export interface WorkflowState {
  niche: string | null
  platform: 'tiktok' | 'instagram' | 'youtube-shorts' | 'youtube' | 'twitter' | 'linkedin' | null
  stage: WorkflowStage
  project: WorkflowProject | null
  /** Per-stage completion. Allows the rail to show check marks. */
  completed: Record<WorkflowStage, boolean>
}

const DEFAULT_STATE: WorkflowState = {
  niche: null,
  platform: null,
  stage: 'ingest',
  project: null,
  completed: { ingest: false, script: false, edit: false, schedule: false, analyze: false },
}

const STORAGE_KEY = 'click.workflow.v1'

interface WorkflowContextValue {
  state: WorkflowState
  setNiche: (niche: string | null) => void
  setPlatform: (p: WorkflowState['platform']) => void
  setProject: (p: WorkflowProject | null) => void
  setStage: (s: WorkflowStage) => void
  /** Mark a stage complete and advance to the next one. */
  completeStage: (s: WorkflowStage) => void
  reset: () => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

export const STAGE_ORDER: WorkflowStage[] = ['ingest', 'script', 'edit', 'schedule', 'analyze']

export const STAGE_META: Record<WorkflowStage, { label: string; route: string; description: string }> = {
  ingest:   { label: 'Ingest',   route: '/dashboard/forge',     description: 'Bring footage in — upload, paste a link, or record live.' },
  script:   { label: 'Script',   route: '/dashboard/scripts',   description: 'AI drafts hook, body, and CTA tuned to your niche.' },
  edit:     { label: 'Edit',     route: '/dashboard/video',     description: 'Cut, caption, and brand the video with style intelligence.' },
  schedule: { label: 'Schedule', route: '/dashboard/scheduler', description: 'Queue across platforms at optimal post times.' },
  analyze:  { label: 'Analyze',  route: '/dashboard/analytics', description: 'Measure performance and learn what to repeat.' },
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkflowState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WorkflowState>
        setState(prev => ({ ...prev, ...parsed, completed: { ...prev.completed, ...(parsed.completed || {}) } }))
      }
    } catch {
      // localStorage unavailable / corrupted — fall through to default
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state, hydrated])

  const setNiche = useCallback((niche: string | null) => {
    setState(prev => ({ ...prev, niche }))
  }, [])

  const setPlatform = useCallback((platform: WorkflowState['platform']) => {
    setState(prev => ({ ...prev, platform }))
  }, [])

  const setProject = useCallback((project: WorkflowProject | null) => {
    setState(prev => ({ ...prev, project }))
  }, [])

  const setStage = useCallback((stage: WorkflowStage) => {
    setState(prev => ({ ...prev, stage }))
  }, [])

  const completeStage = useCallback((stage: WorkflowStage) => {
    setState(prev => {
      const idx = STAGE_ORDER.indexOf(stage)
      const next = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : prev.stage
      return {
        ...prev,
        completed: { ...prev.completed, [stage]: true },
        stage: next,
      }
    })
  }, [])

  const reset = useCallback(() => setState(DEFAULT_STATE), [])

  const value = useMemo<WorkflowContextValue>(() => ({
    state, setNiche, setPlatform, setProject, setStage, completeStage, reset,
  }), [state, setNiche, setPlatform, setProject, setStage, completeStage, reset])

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext)
  if (!ctx) throw new Error('useWorkflow must be used inside <WorkflowProvider>')
  return ctx
}

/** Resolve which stage a given pathname maps to. Used by the rail and CTAs. */
export function stageFromPath(pathname: string | null | undefined): WorkflowStage | null {
  if (!pathname) return null
  if (pathname.startsWith('/dashboard/forge')) return 'ingest'
  if (pathname.startsWith('/dashboard/scripts')) return 'script'
  if (pathname.startsWith('/dashboard/video')) return 'edit'
  if (pathname.startsWith('/dashboard/scheduler') || pathname.startsWith('/dashboard/calendar')) return 'schedule'
  if (pathname.startsWith('/dashboard/analytics') || pathname.startsWith('/dashboard/insights')) return 'analyze'
  return null
}

/** Given the current stage, return the next stage's metadata for "Next:" CTAs. */
export function nextStageMeta(stage: WorkflowStage) {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null
  const next = STAGE_ORDER[idx + 1]
  return { stage: next, ...STAGE_META[next] }
}
