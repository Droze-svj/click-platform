'use client'

/**
 * SmartCleanupPanel — in-editor surface for the three video-tools that
 * used to live behind a separate /dashboard/tools page:
 *   • Remove silence       → POST /video/tools/remove-silence
 *   • Remove filler words  → POST /video/tools/remove-fillers
 *   • Edit-by-text ranges  → POST /video/tools/edit-by-text
 *
 * The panel runs against the videoId currently open in the editor so the
 * user never leaves their workspace to run "AI tools" on a video they
 * already had loaded. The output is a URL the user can preview, open, or
 * download — the original project stays untouched (the server writes the
 * cleaned variant as a new asset).
 */

import { useState, useEffect } from 'react'
import { X, Scissors, Wand2, Type, Download, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiPost } from '../../lib/api'
import { Button, IconButton, Slider, Textarea, FormField } from '../ui'

type ToolId = 'silence' | 'fillers' | 'edit-by-text'
type Intensity = 'gentle' | 'medium' | 'aggressive'

interface Props {
  open: boolean
  videoId?: string | null
  /**
   * When set (e.g. from a /dashboard/tools deep-link), the panel opens
   * with this tool already selected. Cleared by the editor on close so
   * subsequent reopens land on the user's last-picked tool, not the
   * deep-link.
   */
  initialTool?: ToolId | null
  onClose: () => void
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void
}

const TOOL_DEFS: Array<{ id: ToolId; label: string; icon: any; blurb: string }> = [
  { id: 'silence',      label: 'Remove silences',       icon: Scissors, blurb: 'Cut silent gaps and dead-air pauses. Three intensity levels.' },
  { id: 'fillers',      label: 'Cut "um" / "uh"',       icon: Wand2,    blurb: 'Strip filler words plus dead air via the auto-edit pipeline.' },
  { id: 'edit-by-text', label: 'Edit by text ranges',   icon: Type,     blurb: 'Descript-style. Type seconds ranges to keep — everything else is dropped.' },
]

export default function SmartCleanupPanel({ open, videoId, initialTool, onClose, showToast }: Props) {
  const [tool, setTool] = useState<ToolId>(initialTool || 'silence')

  // Honor late-arriving deep-links: if the parent passes a new initialTool
  // while the panel is open (e.g. user clicked another /dashboard/tools
  // card without closing the editor), switch tabs.
  useEffect(() => {
    if (initialTool) setTool(initialTool)
  }, [initialTool])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultMeta, setResultMeta] = useState<string | null>(null)

  // Tool-specific knobs
  const [silenceThreshold, setSilenceThreshold] = useState<number>(-30) // dB
  const [silenceMinDuration, setSilenceMinDuration] = useState<number>(0.5) // seconds
  const [fillerIntensity, setFillerIntensity] = useState<Intensity>('aggressive')
  const [keepRanges, setKeepRanges] = useState<string>('')

  const reset = () => {
    setError(null)
    setResultUrl(null)
    setResultMeta(null)
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const switchTool = (next: ToolId) => {
    if (busy) return
    setTool(next)
    reset()
  }

  const run = async () => {
    if (!videoId) {
      setError('No video is loaded in the editor.')
      return
    }
    setBusy(true)
    setError(null)
    setResultUrl(null)
    setResultMeta(null)
    try {
      let res: any
      if (tool === 'silence') {
        res = await apiPost('/video/tools/remove-silence', {
          videoId,
          threshold: silenceThreshold,
          minDuration: silenceMinDuration,
        })
      } else if (tool === 'fillers') {
        res = await apiPost('/video/tools/remove-fillers', {
          videoId,
          intensity: fillerIntensity,
        })
      } else {
        // edit-by-text: parse "0-3.5\n6.2-12" or "0,3.5;6.2,12" → [[s,e], ...]
        const parsed = keepRanges
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.split(/[\s\-]+/).map(Number))
          .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > p[0])
        if (parsed.length === 0) {
          throw new Error('Enter at least one keep range like "0-3.5" or "10,18".')
        }
        res = await apiPost('/video/tools/edit-by-text', { videoId, keepRanges: parsed })
      }
      const data = res?.data ?? res
      const url = data?.url || data?.editedVideoUrl || null
      if (!url) throw new Error('Pipeline finished but returned no output URL.')
      setResultUrl(url)
      const editsApplied: string[] | undefined = Array.isArray(data?.editsApplied) ? data.editsApplied : undefined
      const keptDuration: number | undefined = typeof data?.keptDuration === 'number' ? data.keptDuration : undefined
      const meta = editsApplied?.length
        ? `${editsApplied.length} edit${editsApplied.length === 1 ? '' : 's'} applied`
        : (typeof keptDuration === 'number' ? `${keptDuration.toFixed(1)}s kept` : null)
      setResultMeta(meta)
      showToast?.('Cleanup ready — preview or download from the panel.', 'success')
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Cleanup failed.'
      setError(msg)
      showToast?.(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const ToolIcon = TOOL_DEFS.find((t) => t.id === tool)?.icon ?? Scissors

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Smart cleanup"
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="ds-surface-elevated ds-elev-3 ds-anim-rise w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="ds-text-label text-primary">Smart cleanup</p>
            <h2 className="ds-text-h3 text-theme-primary truncate">AI tools on this video</h2>
          </div>
          <IconButton
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={close}
            disabled={busy}
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {/* Tool tabs */}
        <div className="flex gap-2 p-3 border-b border-border ds-surface-subtle">
          {TOOL_DEFS.map((t) => {
            const Icon = t.icon
            const active = tool === t.id
            return (
              <Button
                key={t.id}
                variant={active ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => switchTool(t.id)}
                disabled={busy}
                leftIcon={<Icon className="w-3.5 h-3.5" />}
                className="flex-1"
              >
                {t.label}
              </Button>
            )
          })}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {!videoId && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-4 py-3 ds-text-body text-amber-700 dark:text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Open a project first — these tools run on the currently loaded video.</span>
            </div>
          )}

          <p className="ds-text-body text-theme-secondary leading-relaxed flex items-start gap-2">
            <ToolIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
            <span>{TOOL_DEFS.find((t) => t.id === tool)?.blurb}</span>
          </p>

          {tool === 'silence' && (
            <div className="space-y-4">
              <FormField label="Silence threshold (dB)" hint={`${silenceThreshold} dB — ${silenceThreshold <= -35 ? 'looser (only true silence)' : silenceThreshold >= -25 ? 'tighter (cuts breath pauses)' : 'balanced'}`}>
                <Slider
                  min={-50} max={-15} step={1}
                  value={silenceThreshold}
                  onValueChange={setSilenceThreshold}
                />
              </FormField>
              <FormField label="Min silence duration (s)" hint={`${silenceMinDuration.toFixed(1)}s — gaps shorter than this stay in.`}>
                <Slider
                  min={0.2} max={2} step={0.1}
                  value={silenceMinDuration}
                  onValueChange={setSilenceMinDuration}
                />
              </FormField>
            </div>
          )}

          {tool === 'fillers' && (
            <div className="grid grid-cols-3 gap-2">
              {(['gentle', 'medium', 'aggressive'] as Intensity[]).map((k) => (
                <Button
                  key={k}
                  variant={fillerIntensity === k ? 'destructive' : 'secondary'}
                  size="md"
                  onClick={() => setFillerIntensity(k)}
                  disabled={busy}
                  className="capitalize"
                >
                  {k}
                </Button>
              ))}
            </div>
          )}

          {tool === 'edit-by-text' && (
            <FormField
              label="Keep ranges (seconds)"
              hint={<>One range per line. Examples: <code>0-3.5</code> or <code>10,18</code>. Anything outside these ranges is dropped from the output.</>}
            >
              <Textarea
                value={keepRanges}
                onChange={(e) => setKeepRanges(e.target.value)}
                placeholder={'0-3.5\n6.2-12\n20-28'}
                rows={5}
                className="font-mono"
              />
            </FormField>
          )}

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 px-4 py-3 ds-text-body text-rose-700 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {resultUrl && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-4 py-3 ds-text-body text-emerald-700 dark:text-emerald-200 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Done. {resultMeta ? `(${resultMeta})` : ''} The original is untouched — this is a new asset.</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <a href={resultUrl} target="_blank" rel="noreferrer">
                  <Button variant="primary" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>Open</Button>
                </a>
                <a href={resultUrl} download>
                  <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>Download</Button>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border ds-surface-subtle">
          <Button variant="ghost" size="md" onClick={close} disabled={busy}>
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={run}
            disabled={!videoId || busy}
            loading={busy}
          >
            {busy ? 'Running…' : 'Run on this video'}
          </Button>
        </div>
      </div>
    </div>
  )
}
