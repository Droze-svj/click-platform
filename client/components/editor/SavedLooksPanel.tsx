'use client'

import React from 'react'
import { Bookmark, Plus, Trash2, Check } from 'lucide-react'
import type { VideoFilter } from '../../types/editor'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import { Panel, Button, SectionHeader } from '../ui'

interface SavedLook {
  id: string
  name: string
  settings: { filters?: Partial<VideoFilter>; colorGrade?: string }
  createdAt?: string
}

interface SavedLooksPanelProps {
  /** The current editor filters (the visual "look" to save). */
  currentFilters: VideoFilter
  /** Apply a saved look back onto the editor. */
  onApply: (filters: VideoFilter) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

/**
 * "My Looks" — save the current grade/filters as a named preset and re-apply it
 * later. Backed by /api/editor/presets (per-user, allowlisted). Best-effort UI.
 */
export default function SavedLooksPanel({ currentFilters, onApply, showToast }: SavedLooksPanelProps) {
  const [looks, setLooks] = React.useState<SavedLook[]>([])
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [appliedId, setAppliedId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      const res = await apiGet<unknown>('/editor/presets')
      const payload = ((res as { data?: unknown })?.data ?? res) as { presets?: SavedLook[] }
      setLooks(Array.isArray(payload?.presets) ? payload.presets : [])
    } catch {
      setLooks([])
    }
  }, [])
  React.useEffect(() => { load() }, [load])

  const save = async () => {
    setBusy(true)
    try {
      const res = await apiPost<unknown>('/editor/presets', { name: name.trim() || 'My Look', settings: { filters: currentFilters } })
      const payload = ((res as { data?: unknown })?.data ?? res) as { preset?: SavedLook }
      if (payload?.preset) {
        setLooks((prev) => [payload.preset as SavedLook, ...prev])
        setName('')
        showToast('Look saved', 'success')
      }
    } catch {
      showToast('Could not save this look', 'error')
    } finally {
      setBusy(false)
    }
  }

  const apply = (look: SavedLook) => {
    if (look.settings?.filters) {
      onApply({ ...currentFilters, ...look.settings.filters } as VideoFilter)
      setAppliedId(look.id)
      showToast(`Applied "${look.name}"`, 'success')
    }
  }

  const remove = async (id: string) => {
    setLooks((prev) => prev.filter((l) => l.id !== id))
    try { await apiDelete(`/editor/presets/${encodeURIComponent(id)}`) } catch { /* best effort */ }
  }

  return (
    <Panel variant="glass" className="p-6">
      <SectionHeader
        className="mb-4"
        title={<span className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-indigo-500" aria-hidden /> My Looks</span>}
        description="Save this grade and reuse it on any video"
      />
      <div className="mb-4 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this look…"
          maxLength={60}
          className="flex-1 rounded-lg ds-surface-subtle px-3 py-2 text-sm text-theme-primary placeholder:text-theme-muted"
        />
        <Button variant="primary" size="md" onClick={save} disabled={busy} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
          Save look
        </Button>
      </div>

      {looks.length === 0 ? (
        <p className="text-xs text-theme-muted">No saved looks yet — tune the grade above and save it.</p>
      ) : (
        <ul className="space-y-2">
          {looks.map((l) => (
            <li key={l.id} className="ds-surface-subtle flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1 truncate ds-text-label text-theme-primary">{l.name}</span>
              <Button variant="secondary" size="sm" onClick={() => apply(l)} leftIcon={appliedId === l.id ? <Check size={14} aria-hidden /> : undefined}>
                Apply
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(l.id)} aria-label={`Delete ${l.name}`} className="h-8 w-8 p-0 text-theme-muted hover:text-rose-500">
                <Trash2 size={15} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
