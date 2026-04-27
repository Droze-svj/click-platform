'use client'

import { useCallback, useState } from 'react'
import { apiPost, apiGet } from '../lib/api'
import { useWorkflow } from '../contexts/WorkflowContext'

/**
 * useCreatorPipeline — single autonomous "make this great" run that ties
 * every recently-added surface together:
 *
 *   1) ANALYZE        — POST /api/video/ai-editing/analyze        (niche/style hydrated server-side)
 *   2) SUGGESTIONS    — GET  /api/video/ai-editing/suggestions    (playbook-grounded next moves)
 *   3) AUTO-EDIT      — POST /api/video/ai-editing/auto-edit      (dev-mocked or real)
 *   4) POSTING WINDOW — GET  /api/marketing-intelligence/optimal-windows
 *
 * Returns a single object so the editor can render one unified "what Click
 * just did" panel instead of stitching four views together.
 */

export interface PipelineStage {
  id: 'analyze' | 'suggestions' | 'auto-edit' | 'posting'
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  error?: string
  startedAt?: number
  finishedAt?: number
}

export interface PipelineResult {
  analyze?: any
  suggestions?: any
  autoEdit?: any
  posting?: any
}

interface RunOpts {
  videoId: string
  /** Optional override — defaults to the workflow's niche. */
  niche?: string
  /** Optional override — defaults to the workflow's platform. */
  platform?: string
  /** When false, skip the auto-edit ffmpeg step (still runs analyze + suggestions). */
  withAutoEdit?: boolean
  onStage?: (s: PipelineStage) => void
}

const STAGES: Record<PipelineStage['id'], string> = {
  analyze:     'Analyzing the video',
  suggestions: 'Composing next moves',
  'auto-edit': 'Applying auto-edits',
  posting:     'Picking the best post time',
}

export function useCreatorPipeline() {
  const { state: workflow } = useWorkflow()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [result, setResult] = useState<PipelineResult>({})
  const [running, setRunning] = useState(false)

  const setStage = useCallback((id: PipelineStage['id'], patch: Partial<PipelineStage>, onStage?: RunOpts['onStage']) => {
    setStages(prev => {
      const idx = prev.findIndex(s => s.id === id)
      const updated: PipelineStage = idx === -1
        ? { id, label: STAGES[id], status: 'pending', ...patch }
        : { ...prev[idx], ...patch }
      const next = idx === -1 ? [...prev, updated] : prev.map(s => s.id === id ? updated : s)
      onStage?.(updated)
      return next
    })
  }, [])

  const run = useCallback(async ({
    videoId, niche, platform, withAutoEdit = true, onStage,
  }: RunOpts): Promise<PipelineResult> => {
    if (!videoId) throw new Error('videoId is required')
    setRunning(true)
    setStages([])
    setResult({})
    const out: PipelineResult = {}
    const targetNiche = niche || workflow.niche || undefined
    const targetPlatform = platform || workflow.platform || undefined

    // 1) Analyze
    setStage('analyze', { status: 'running', startedAt: Date.now() }, onStage)
    try {
      const r = await apiPost<{ data: any }>('/video/ai-editing/analyze', {
        videoId, niche: targetNiche, platform: targetPlatform,
      })
      out.analyze = (r as any)?.data || r
      setStage('analyze', { status: 'done', finishedAt: Date.now() }, onStage)
    } catch (e: any) {
      setStage('analyze', { status: 'failed', error: e?.message }, onStage)
    }

    // 2) Suggestions (independent of analyze; both can fail without aborting)
    setStage('suggestions', { status: 'running', startedAt: Date.now() }, onStage)
    try {
      const params = new URLSearchParams({ videoId })
      if (targetNiche)    params.set('niche', targetNiche)
      if (targetPlatform) params.set('platform', targetPlatform)
      const r = await apiGet<{ data: any }>(`/video/ai-editing/suggestions?${params.toString()}`)
      out.suggestions = (r as any)?.data || r
      setStage('suggestions', { status: 'done', finishedAt: Date.now() }, onStage)
    } catch (e: any) {
      setStage('suggestions', { status: 'failed', error: e?.message }, onStage)
    }

    // 3) Auto-edit (optional)
    if (withAutoEdit) {
      setStage('auto-edit', { status: 'running', startedAt: Date.now() }, onStage)
      try {
        const r = await apiPost<{ data: any }>('/video/ai-editing/auto-edit', {
          videoId, niche: targetNiche, platform: targetPlatform,
        })
        out.autoEdit = (r as any)?.data || r
        setStage('auto-edit', { status: 'done', finishedAt: Date.now() }, onStage)
      } catch (e: any) {
        setStage('auto-edit', { status: 'failed', error: e?.message }, onStage)
      }
    }

    // 4) Posting window
    setStage('posting', { status: 'running', startedAt: Date.now() }, onStage)
    try {
      const params = new URLSearchParams()
      if (targetNiche)    params.set('niche', targetNiche)
      if (targetPlatform) params.set('platform', targetPlatform)
      const r = await apiGet<{ data: any }>(`/marketing-intelligence/optimal-windows?${params.toString()}`)
      out.posting = (r as any)?.data || r
      setStage('posting', { status: 'done', finishedAt: Date.now() }, onStage)
    } catch (e: any) {
      setStage('posting', { status: 'failed', error: e?.message }, onStage)
    }

    setResult(out)
    setRunning(false)
    return out
  }, [workflow.niche, workflow.platform, setStage])

  return { run, stages, result, running }
}
