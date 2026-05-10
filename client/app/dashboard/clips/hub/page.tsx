'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Filter, Loader2, Video, Search, CheckSquare, Square, Download, Trash2 } from 'lucide-react'
import { apiGet, apiDelete } from '../../../../lib/api'
import ClipCard, { type Clip } from '../../../../components/clips/ClipCard'
import ClipLightbox from '../../../../components/clips/ClipLightbox'
import { confirmDialog } from '../../../../components/ui/ConfirmDialog'

type SortKey = 'viralScore' | 'rating' | 'newest' | 'duration'
type ClipWithSource = Clip & { 
  parentTitle?: string; 
  parentThumbnail?: string | null;
  folder?: { id: string; name: string; color: string } | null;
}

interface PlanLimits {
  label: string
  aiClipCount: number
  retentionDays: number
}

export default function ClipHubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clips, setClips] = useState<ClipWithSource[]>([])
  const [sort, setSort] = useState<SortKey>('newest')
  const [groupBySource, setGroupBySource] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [query, setQuery] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res: any = await apiGet('/video/clips/hub?page=1&pageSize=60')
      const data = res?.data || res
      setClips(data?.items || [])
      setPlanLimits(data?.planLimits || null)
    } catch (err: any) {
      setError(err?.message || 'Could not load your clips')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const q = query.trim().toLowerCase()
  const sorted = [...clips]
    .filter(c => !q || (c.caption || '').toLowerCase().includes(q) || (c.parentTitle || '').toLowerCase().includes(q) || (c.hookText || '').toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === 'viralScore') return (b.viralScore || 0) - (a.viralScore || 0)
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sort === 'duration') return (a.duration || 0) - (b.duration || 0)
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedIds(new Set(sorted.map(c => c.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const bulkDownload = () => {
    sorted.filter(c => selectedIds.has(c.id)).forEach((c, i) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = c.url
        a.download = ''
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, i * 200)
    })
  }

  const bulkDelete = async () => {
    if (bulkBusy || selectedIds.size === 0) return
    const count = selectedIds.size
    const ok = await confirmDialog({
      title: `Delete ${count} clip${count === 1 ? '' : 's'}?`,
      description: 'Removed clips can be restored from Trash within the retention window. Cannot be undone after that.',
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return

    setBulkBusy(true)
    const ids = Array.from(selectedIds)
    // Snapshot the clips we're about to optimistically remove so we can
    // restore exactly the ones whose server-side delete fails. The
    // previous Promise.all swallowed errors and never rolled back, so a
    // partial failure left the UI claiming clips were deleted that still
    // existed on the server (and would reappear on next page load).
    const targets = clips.filter(c => selectedIds.has(c.id))
    const survivors = clips.filter(c => !selectedIds.has(c.id))
    setClips(survivors)
    clearSelection()
    setSelectMode(false)

    const results = await Promise.allSettled(
      targets.map((clip) => apiDelete(`/video/clips/${clip.contentId}/${clip.id}`))
    )
    const failures: ClipWithSource[] = []
    results.forEach((r, i) => { if (r.status === 'rejected') failures.push(targets[i]) })

    if (failures.length > 0) {
      // Roll back the failed clips into local state so the UI doesn't lie.
      setClips((prev) => {
        const have = new Set(prev.map(c => c.id))
        return [...prev, ...failures.filter(f => !have.has(f.id))]
      })
      window.dispatchEvent(new CustomEvent('toast', {
        detail: {
          type: failures.length === ids.length ? 'error' : 'warning',
          message: failures.length === ids.length
            ? `Couldn't delete any clips. Try again.`
            : `Deleted ${ids.length - failures.length} of ${ids.length}. ${failures.length} failed and were restored.`,
        },
      }))
    } else {
      window.dispatchEvent(new CustomEvent('toast', {
        detail: { type: 'success', message: `Deleted ${ids.length} clip${ids.length === 1 ? '' : 's'}.` },
      }))
    }
    setBulkBusy(false)
  }

  // Group clips by parent source video for the "folder" view.
  const grouped = sorted.reduce<Record<string, ClipWithSource[]>>((acc, c) => {
    const key = c.contentId
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)] pb-16">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12 pt-10 space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.back()}
              title="Back"
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-[var(--text-dim)] hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">AI Clip Hub</p>
              <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight truncate">All AI clips</h1>
              <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest mt-1">
                {planLimits ? `${planLimits.label} plan · ${planLimits.aiClipCount} clips/video · ${planLimits.retentionDays}-day retention` : 'Auto-saved · organized by source'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-indigo-500/40 transition-colors">
              <Search className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search captions or videos"
                aria-label="Search clips"
                className="bg-transparent outline-none text-[11px] font-medium text-white placeholder:text-slate-600 w-44"
              />
            </div>
            {/* Multi-select */}
            <button
              type="button"
              onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection() }}
              className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${selectMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-[var(--text-main)] hover:bg-white/10'}`}
              title="Toggle multi-select"
            >
              {selectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              Select
            </button>
            <button
              type="button"
              onClick={() => setGroupBySource(v => !v)}
              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${groupBySource ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-[var(--text-main)] hover:bg-white/10'}`}
              title="Toggle source-video grouping"
            >
              <Video className="w-3.5 h-3.5" /> {groupBySource ? 'Grouped' : 'Flat'}
            </button>
            <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Filter className="w-3 h-3 text-[var(--text-dim)]" />
              <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mr-1">Sort</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none"
                title="Sort clips"
              >
                <option value="newest" className="bg-[#05080c]">Newest</option>
                <option value="viralScore" className="bg-[#05080c]">Viral score</option>
                <option value="rating" className="bg-[#05080c]">Your rating</option>
                <option value="duration" className="bg-[#05080c]">Duration</option>
              </select>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-rose-300 text-sm">
            {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">No AI clips yet</h2>
            <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">
              Upload a video and run the AI Auto Edit. Your generated clips will land here with virality ratings, captions, and styles.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/video')}
              className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all"
            >
              Upload a video
            </button>
          </div>
        ) : groupBySource ? (
          <div className="space-y-10">
            {Object.entries(grouped).map(([cid, list]) => (
              <section key={cid} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">
                      Source · {list.length} clip{list.length === 1 ? '' : 's'}
                      {list[0]?.folder && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[var(--text-dim)]">
                          Folder: {list[0].folder.name}
                        </span>
                      )}
                    </p>
                    <h2 className="text-lg font-black uppercase italic tracking-tight truncate">{list[0]?.parentTitle || 'Untitled'}</h2>
                  </div>
                  <a
                    href={`/dashboard/clips/hub/${cid}`}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-[var(--text-main)] transition-all flex-shrink-0"
                  >
                    Open
                  </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {list.map(clip => {
                    const flatIdx = sorted.findIndex(c => c.id === clip.id)
                    return (
                      <ClipCard
                        key={clip.id}
                        clip={clip}
                        onOpen={() => setLightboxIndex(flatIdx)}
                        selected={selectMode ? selectedIds.has(clip.id) : undefined}
                        onToggleSelect={selectMode ? () => toggleSelect(clip.id) : undefined}
                        onChange={(next) => setClips(prev => prev.map(c => c.id === next.id ? { ...c, ...next } : c))}
                        onRemoved={(id) => setClips(prev => prev.filter(c => c.id !== id))}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {sorted.map((clip, i) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onOpen={() => setLightboxIndex(i)}
                selected={selectMode ? selectedIds.has(clip.id) : undefined}
                onToggleSelect={selectMode ? () => toggleSelect(clip.id) : undefined}
                onChange={(next) => setClips(prev => prev.map(c => c.id === next.id ? { ...c, ...next } : c))}
                onRemoved={(id) => setClips(prev => prev.filter(c => c.id !== id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-2xl bg-[#0a0a0c] border border-white/10 shadow-2xl flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">{selectedIds.size} selected</span>
          <button type="button" onClick={selectAll} className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors">Select all</button>
          <button type="button" onClick={clearSelection} className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors">Clear</button>
          <div className="w-px h-5 bg-white/10" />
          <button type="button" onClick={bulkDownload} className="px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-transform">
            <Download className="w-3 h-3" /> Download
          </button>
          <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <ClipLightbox
          clips={sorted}
          index={Math.max(0, Math.min(sorted.length - 1, lightboxIndex))}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onClipChange={(next) => setClips(prev => prev.map(c => c.id === next.id ? { ...c, ...next } : c))}
          onClipRemoved={(id) => setClips(prev => prev.filter(c => c.id !== id))}
          onOpenInEditor={(c) => router.push(`/dashboard/video/edit/${c.contentId}`)}
        />
      )}
    </div>
  )
}
