'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Sparkles, Filter, Loader2, FolderOpen, Search, CheckSquare, Square, Download, Trash2 } from 'lucide-react'
import { apiGet, apiDelete } from '../../../../../lib/api'
import ClipCard, { type Clip } from '../../../../../components/clips/ClipCard'
import ClipLightbox from '../../../../../components/clips/ClipLightbox'

type SortKey = 'viralScore' | 'rating' | 'newest' | 'duration'

export default function ClipHubByContentPage() {
  const params = useParams<{ contentId: string }>()
  const router = useRouter()
  const contentId = params?.contentId

  const [loading, setLoading] = useState(true)
  const [clips, setClips] = useState<Clip[]>([])
  const [parentTitle, setParentTitle] = useState('')
  const [sort, setSort] = useState<SortKey>('viralScore')
  const [styleFilter, setStyleFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    if (!contentId) return
    setLoading(true)
    setError(null)
    try {
      const res: any = await apiGet(`/video/clips/hub/${contentId}`)
      const data = res?.data || res
      setClips(data?.items || [])
      setParentTitle(data?.title || '')
    } catch (err: any) {
      setError(err?.message || 'Could not load your clips')
    } finally {
      setLoading(false)
    }
  }, [contentId])

  useEffect(() => { load() }, [load])

  const styles = Array.from(new Set(clips.map(c => c.style).filter(Boolean))) as string[]

  const q = query.trim().toLowerCase()
  const visible = clips
    .filter(c => styleFilter === 'all' || c.style === styleFilter)
    .filter(c => !q || (c.caption || '').toLowerCase().includes(q) || (c.hookText || '').toLowerCase().includes(q))
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

  const selectAll = () => {
    setSelectedIds(new Set(visible.map(c => c.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const bulkDownload = () => {
    // Browser-native: trigger one download per selected clip. Most browsers
    // queue them sequentially; we space requests by 200ms so they don't all
    // trigger the same "allow multiple downloads" prompt.
    visible.filter(c => selectedIds.has(c.id)).forEach((c, i) => {
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
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${selectedIds.size} clip${selectedIds.size === 1 ? '' : 's'}? They’ll be removed from your hub.`)) return
    setBulkBusy(true)
    const ids = Array.from(selectedIds)
    const survivors = clips.filter(c => !selectedIds.has(c.id))
    setClips(survivors)
    clearSelection()
    setSelectMode(false)
    await Promise.all(ids.map(async id => {
      const clip = clips.find(c => c.id === id)
      if (!clip) return
      try { await apiDelete(`/video/clips/${clip.contentId}/${id}`) } catch (_) { /* keep going */ }
    }))
    setBulkBusy(false)
  }

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
              <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight truncate">{parentTitle || 'Your AI clips'}</h1>
              <p className="text-xs font-bold text-[var(--text-dim)] uppercase tracking-widest mt-1">Auto-saved · 14-day retention · {clips.length} clip{clips.length === 1 ? '' : 's'}</p>
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
                placeholder="Search captions"
                aria-label="Search clip captions"
                className="bg-transparent outline-none text-[11px] font-medium text-white placeholder:text-slate-600 w-32"
              />
            </div>
            {/* Multi-select toggle */}
            <button
              type="button"
              onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection() }}
              className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${selectMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-[var(--text-main)] hover:bg-white/10'}`}
              title="Toggle multi-select"
            >
              {selectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              Select
            </button>
            <a
              href="/dashboard/clips/hub"
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] flex items-center gap-2 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" /> All clips
            </a>
            <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <Filter className="w-3 h-3 text-[var(--text-dim)]" />
              <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mr-1">Sort</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none"
                title="Sort clips"
              >
                <option value="viralScore" className="bg-[#05080c]">Viral score</option>
                <option value="rating" className="bg-[#05080c]">Your rating</option>
                <option value="newest" className="bg-[#05080c]">Newest</option>
                <option value="duration" className="bg-[#05080c]">Duration</option>
              </select>
            </div>
            {styles.length > 1 && (
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mr-1">Style</label>
                <select
                  value={styleFilter}
                  onChange={e => setStyleFilter(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none"
                  title="Filter by style"
                >
                  <option value="all" className="bg-[#05080c]">All</option>
                  {styles.map(s => (
                    <option key={s} value={s} className="bg-[#05080c]">{s}</option>
                  ))}
                </select>
              </div>
            )}
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
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-xl font-black uppercase italic tracking-tight mb-2">No clips yet</h2>
            <p className="text-sm text-[var(--text-dim)] max-w-md mx-auto">
              Run the AI Auto Edit on this video to generate your first batch of clips.
              They&apos;ll show up here automatically with virality ratings.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/video/edit/${contentId}`)}
              className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all"
            >
              Open AI Auto Edit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {visible.map((clip, i) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onOpen={() => setLightboxIndex(i)}
                selected={selectMode ? selectedIds.has(clip.id) : undefined}
                onToggleSelect={selectMode ? () => toggleSelect(clip.id) : undefined}
                onChange={(next) => setClips(prev => prev.map(c => c.id === next.id ? next : c))}
                onRemoved={(id) => setClips(prev => prev.filter(c => c.id !== id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar — pinned to the bottom when items are selected. */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-2xl bg-[#0a0a0c] border border-white/10 shadow-2xl flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)] hover:text-white transition-colors"
          >
            Clear
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button
            type="button"
            onClick={bulkDownload}
            className="px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-transform"
          >
            <Download className="w-3 h-3" /> Download
          </button>
          <button
            type="button"
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <ClipLightbox
          clips={visible}
          index={Math.max(0, Math.min(visible.length - 1, lightboxIndex))}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onClipChange={(next) => setClips(prev => prev.map(c => c.id === next.id ? next : c))}
          onClipRemoved={(id) => setClips(prev => prev.filter(c => c.id !== id))}
          onOpenInEditor={(c) => router.push(`/dashboard/video/edit/${c.contentId}`)}
        />
      )}
    </div>
  )
}
