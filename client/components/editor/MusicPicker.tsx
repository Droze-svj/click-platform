'use client'

import React from 'react'
import { Music, Sparkles, Play, Pause, Plus, RefreshCw, Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { AUDIO_TRACKS } from '../../types/editor'
import { Panel, Button, SectionHeader, EmptyState } from '../ui'
import { cn } from '../../lib/utils'

interface Track {
  _id: string
  title?: string
  artist?: string
  genre?: string
  mood?: string
  energy?: string
  usageContext?: string[]
  bpm?: number
  file?: { url?: string; duration?: number }
}
interface BrowseData {
  tracks: Track[]
  byGenre: Record<string, string[]>
  byMood: Record<string, string[]>
  byEnergy: Record<string, string[]>
  byUsage: Record<string, string[]>
}

interface MusicPickerProps {
  currentTime: number
  setTimelineSegments: (updater: (prev: any[]) => any[]) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

type Facet = 'genre' | 'mood' | 'energy' | 'usage'
const FACETS: { id: Facet; label: string; key: keyof BrowseData }[] = [
  { id: 'genre', label: 'Genre', key: 'byGenre' },
  { id: 'mood', label: 'Mood', key: 'byMood' },
  { id: 'energy', label: 'Energy', key: 'byEnergy' },
  { id: 'usage', label: 'Use for', key: 'byUsage' },
]

const GEN_GENRES = ['pop', 'electronic', 'hip-hop', 'ambient', 'energetic', 'calm']
const GEN_MOODS = ['energetic', 'happy', 'calm', 'dramatic', 'inspiring']

export default function MusicPicker({ currentTime, setTimelineSegments, showToast }: MusicPickerProps) {
  const [data, setData] = React.useState<BrowseData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [facet, setFacet] = React.useState<Facet>('genre')
  const [activeValue, setActiveValue] = React.useState<string | null>(null)
  const [playingId, setPlayingId] = React.useState<string | null>(null)
  const [genGenre, setGenGenre] = React.useState('energetic')
  const [genMood, setGenMood] = React.useState('energetic')
  const [generating, setGenerating] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<unknown>('/music/browse')
      const payload = ((res as { data?: unknown })?.data ?? res) as BrowseData
      setData(payload && Array.isArray(payload.tracks) ? payload : { tracks: [], byGenre: {}, byMood: {}, byEnergy: {}, byUsage: {} })
    } catch {
      setData({ tracks: [], byGenre: {}, byMood: {}, byEnergy: {}, byUsage: {} })
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => { load() }, [load])

  const groups = data ? (data[FACETS.find((f) => f.id === facet)!.key] as Record<string, string[]>) : {}
  const trackById = React.useMemo(() => {
    const m: Record<string, Track> = {}
    for (const t of data?.tracks || []) m[t._id] = t
    return m
  }, [data])
  const visible: Track[] = activeValue && groups[activeValue]
    ? groups[activeValue].map((id) => trackById[id]).filter(Boolean)
    : (data?.tracks || [])

  const preview = (t: Track) => {
    const url = t.file?.url
    if (!url) return
    if (playingId === t._id) { audioRef.current?.pause(); setPlayingId(null); return }
    if (audioRef.current) audioRef.current.pause()
    const el = new Audio(url)
    audioRef.current = el
    el.play().catch(() => showToast('Preview unavailable', 'info'))
    el.onended = () => setPlayingId(null)
    setPlayingId(t._id)
  }

  const use = (t: Track) => {
    const url = t.file?.url
    if (!url) { showToast('This track has no playable file', 'error'); return }
    const dur = t.file?.duration || 30
    const seg = {
      id: `seg-music-${t._id}-${Date.now()}`,
      startTime: currentTime, endTime: currentTime + dur, duration: dur,
      type: 'audio', name: t.title || 'Music', color: '#10B981',
      track: AUDIO_TRACKS[0].index, sourceUrl: url, properties: { volume: 0.5 },
    }
    setTimelineSegments((prev) => [...prev, seg])
    showToast('Music added to timeline', 'success')
    // Close the learning loop — a music pick biases future suggestions (best-effort).
    apiPost('/ai/feedback', { surface: 'music-picker', itemType: 'music', action: 'choose', value: t.genre || t.mood }).catch(() => {})
  }

  // Poll a generation to completion, then drop the new track into the list.
  const pollGeneration = async (id: string, attempt = 0) => {
    if (attempt > 40) { setGenerating(false); showToast('Generation is taking too long — check back later', 'info'); return }
    try {
      const res = await apiGet<unknown>(`/music/generate/${encodeURIComponent(id)}`)
      const payload = ((res as { data?: unknown })?.data ?? res) as { status?: string; track?: Track }
      if (payload?.status === 'completed' && payload.track) {
        setData((prev) => prev ? { ...prev, tracks: [payload.track as Track, ...prev.tracks] } : prev)
        setGenerating(false)
        showToast('AI track ready — added to your library', 'success')
        return
      }
      setTimeout(() => pollGeneration(id, attempt + 1), 3000)
    } catch {
      setGenerating(false)
      showToast('Could not check generation status', 'error')
    }
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await apiPost<unknown>('/music/generate', { genre: genGenre, mood: genMood, energy: 'medium', duration: 30 })
      const payload = ((res as { data?: unknown })?.data ?? res) as { generationId?: string; status?: string }
      if (payload?.generationId) { showToast('Generating your track…', 'info'); pollGeneration(payload.generationId) }
      else { setGenerating(false); showToast('Generation started', 'info') }
    } catch (e: any) {
      setGenerating(false)
      // Honest: the server returns 503 when no provider is configured.
      const reason = e?.response?.data?.reason || e?.data?.reason
      showToast(reason === 'provider-not-configured' ? 'AI music generation isn’t set up on this server yet' : 'Could not start generation', 'info')
    }
  }

  return (
    <div className="space-y-6 ds-anim-rise">
      {/* AI generate */}
      <Panel variant="glass" className="p-6">
        <SectionHeader
          className="mb-4"
          title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-fuchsia-500" aria-hidden /> Generate music with AI</span>}
          description="Make a royalty-free track for this video"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-theme-muted">Genre
            <select value={genGenre} onChange={(e) => setGenGenre(e.target.value)} className="rounded-lg ds-surface-subtle px-3 py-2 text-sm text-theme-primary">
              {GEN_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">Mood
            <select value={genMood} onChange={(e) => setGenMood(e.target.value)} className="rounded-lg ds-surface-subtle px-3 py-2 text-sm text-theme-primary">
              {GEN_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <Button variant="primary" size="md" onClick={generate} disabled={generating} leftIcon={generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}>
            {generating ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </Panel>

      {/* Browse */}
      <Panel variant="glass" className="p-6">
        <SectionHeader
          className="mb-4"
          title={<span className="flex items-center gap-2"><Music className="h-4 w-4 text-emerald-500" aria-hidden /> Your music library</span>}
          actions={<Button variant="ghost" size="sm" onClick={load} leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>Refresh</Button>}
        />

        {/* Facet tabs */}
        <div className="mb-3 flex flex-wrap gap-2">
          {FACETS.map((f) => (
            <button key={f.id} type="button" onClick={() => { setFacet(f.id); setActiveValue(null) }} className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', facet === f.id ? 'bg-emerald-500/15 text-emerald-500' : 'text-theme-muted hover:text-theme-primary')}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Category values */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveValue(null)} className={cn('rounded-md px-2.5 py-1 text-[11px] capitalize transition-colors', !activeValue ? 'bg-theme-muted/15 text-theme-primary' : 'text-theme-muted hover:text-theme-primary')}>All</button>
          {Object.keys(groups).sort().map((v) => (
            <button key={v} type="button" onClick={() => setActiveValue(v)} className={cn('rounded-md px-2.5 py-1 text-[11px] capitalize transition-colors', activeValue === v ? 'bg-emerald-500/15 text-emerald-500' : 'text-theme-muted hover:text-theme-primary')}>
              {v} <span className="opacity-60">({groups[v].length})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-theme-muted/10" />)}</div>
        ) : visible.length === 0 ? (
          <EmptyState icon={Music} title="No music yet" description="Generate a track above, or upload your own to build a categorized library." />
        ) : (
          <ul className="space-y-2">
            {visible.map((t) => (
              <li key={t._id} className="ds-surface-subtle flex items-center gap-3 p-3">
                <button type="button" aria-label={playingId === t._id ? 'Pause' : 'Preview'} onClick={() => preview(t)} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  {playingId === t._id ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate ds-text-label text-theme-primary">{t.title || 'Untitled'}</p>
                  <p className="truncate text-[11px] text-theme-muted">
                    {[t.genre, t.mood, t.energy && `${t.energy} energy`, t.bpm && `${t.bpm} bpm`].filter(Boolean).join(' · ') || t.artist || ''}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => use(t)} leftIcon={<Plus size={14} aria-hidden />}>Use</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
