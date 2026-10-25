'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Zap,
  Sparkles,
  Scissors,
  Layers,
  Video,
  Type,
  User,
  Box,
  Cpu,
  Loader2,
  Wand2,
  ExternalLink,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialogBehavior } from './ui/modal'
import { Button, EmptyState } from './ui'

interface Tool {
  id: string;
  name: string;
  description: string;
  implementation?: string;
  upgrade?: string;
  roi?: number;
}

// Tools that operate on a specific source video and therefore require a videoId.
const VIDEO_DEPENDENT_TOOLS = new Set([
  'silence-removal',
  'auto-cut',
  'bg-swap',
  'auto-captions',
  'text-editor',
  'ai-avatar',
  'cinematic-3d'
])

export default function SovereignToolbox({ videoId }: { videoId?: string } = {}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { showToast } = useToast()
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [executingToolId, setExecutingToolId] = useState<string | null>(null)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const panelRef = useDialogBehavior(!!selectedToolId, () => setSelectedToolId(null))

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiGet('/toolbox')
      if (res.success) {
        setTools(res.tools)
      }
    } catch (err) {
      console.error('Failed to fetch tools:', err)
      showToast(t('sovereignToolbox.indexingFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    fetchTools()
  }, [fetchTools])

  const executeTool = async (toolId: string) => {
    // Video-dependent tools cannot run without a real source video. The
    // toolbox page has no video picker, so send the user to pick one (these
    // tools are in the editor) instead of a dead-end error toast.
    if (VIDEO_DEPENDENT_TOOLS.has(toolId) && !videoId) {
      showToast(t('sovereignToolbox.selectVideoFirst'), 'info')
      router.push('/dashboard/video')
      return
    }

    try {
      setExecutingToolId(toolId)
      showToast(t('sovereignToolbox.initializing', { tool: labelFor(toolId) }), 'info')

      const res = await apiPost('/toolbox/execute', {
        toolId,
        ...(videoId ? { videoId } : {}),
        options: {
          intensity: 'aggressive',
          sovereign: true
        }
      })

      if (res.success) {
        showToast(t('sovereignToolbox.synthesisComplete', { tool: labelFor(toolId) }), 'success')
      } else {
        throw new Error(res.error || 'Execution diffraction')
      }
    } catch (err: any) {
      showToast(t('sovereignToolbox.executionFailed', { error: err.message }), 'error')
    } finally {
      setExecutingToolId(null)
    }
  }

  const getIcon = (id: string) => {
    switch (id) {
      case 'silence-removal': return Scissors
      case 'viral-clips': return Zap
      case 'auto-cut': return Wand2
      case 'bg-swap': return Layers
      case 'blog-to-video': return ExternalLink
      case 'auto-captions': return Type
      case 'text-editor': return Cpu
      case 'ai-avatar': return User
      case 'cinematic-3d': return Box
      case 'script-to-video': return Video
      default: return Sparkles
    }
  }

  // The API names these tools after other companies' products ("Wisecut Elite",
  // "Opus Sovereign", "Descript V3", "Synthesia Gaze"…) and attaches an invented
  // "next upgrade" to each. Showing a competitor's brand on a Click feature is
  // misleading, so the page names each tool by what it does, from en.json, and
  // drops the upgrade blurbs. Unknown ids fall back to the API description.
  const KNOWN = new Set(['silence-removal', 'viral-clips', 'auto-cut', 'bg-swap', 'blog-to-video', 'auto-captions', 'text-editor', 'ai-avatar', 'cinematic-3d', 'script-to-video'])
  const toolKey = (id: string) => id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  const toolName = (tool: Tool) => (KNOWN.has(tool.id) ? t(`sovereignToolbox.tool.${toolKey(tool.id)}.name`) : tool.id)
  const labelFor = (id: string) => { const found = tools.find((x) => x.id === id); return found ? toolName(found) : id }
  const toolDesc = (tool: Tool) => (KNOWN.has(tool.id) ? t(`sovereignToolbox.tool.${toolKey(tool.id)}.desc`) : tool.description)

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-32">
        <Loader2 size={32} className="text-primary animate-spin" aria-hidden="true" />
        <p className="text-sm text-theme-muted">{t('sovereignToolbox.syncingModules')}</p>
      </div>
    )
  }

  const selected = tools.find((item) => item.id === selectedToolId) || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-text-h1 text-theme-primary">{t('sovereignToolbox.sovereignForge')}</h1>
        <p className="mt-1 max-w-2xl ds-text-body text-theme-muted">{t('sovereignToolbox.intro')}</p>
      </div>

      {tools.length === 0 ? (
        <EmptyState icon={Box} title={t('sovereignToolbox.emptyTitle')} description={t('sovereignToolbox.indexingFailed')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = getIcon(tool.id)
            const isExecuting = executingToolId === tool.id
            const needsVideo = VIDEO_DEPENDENT_TOOLS.has(tool.id) && !videoId
            return (
              <div key={tool.id} className="ds-surface-card p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="ds-text-h3 text-theme-primary">{toolName(tool)}</h2>
                    <p className="mt-1 text-sm text-theme-muted">{toolDesc(tool)}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isExecuting}
                    disabled={isExecuting}
                    onClick={() => executeTool(tool.id)}
                  >
                    {needsVideo ? t('sovereignToolbox.pickVideo') : t('sovereignToolbox.run')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedToolId(tool.id)}>
                    {t('sovereignToolbox.details')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div
          onClick={() => setSelectedToolId(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="toolbox-dialog-title"
        >
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className="ds-surface-elevated w-full max-w-lg p-6 space-y-5"
          >
            <div className="flex items-start gap-3">
              {(() => { const Icon = getIcon(selected.id); return (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={22} aria-hidden="true" /></span>
              ) })()}
              <div className="min-w-0 flex-1">
                <h2 id="toolbox-dialog-title" className="ds-text-h2 text-theme-primary">{toolName(selected)}</h2>
                <p className="mt-1 text-sm text-theme-secondary">{toolDesc(selected)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedToolId(null)}
                aria-label={t('sovereignToolbox.closeLink')}
                className="rounded-lg p-1.5 text-theme-muted hover:bg-muted hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {VIDEO_DEPENDENT_TOOLS.has(selected.id) && !videoId ? (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-theme-secondary">{t('sovereignToolbox.needsVideoHint')}</p>
            ) : null}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedToolId(null)}>{t('sovereignToolbox.closeLink')}</Button>
              <Button
                variant="primary"
                loading={executingToolId === selected.id}
                disabled={executingToolId === selected.id}
                onClick={() => executeTool(selected.id)}
              >
                {VIDEO_DEPENDENT_TOOLS.has(selected.id) && !videoId ? t('sovereignToolbox.pickVideo') : t('sovereignToolbox.run')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
