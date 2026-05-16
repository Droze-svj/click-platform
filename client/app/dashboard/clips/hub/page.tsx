'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Sparkles, Filter, Video, Search, CheckSquare, Square, Download, Trash2 } from 'lucide-react'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import ClickEmptyState from '@/components/click/ClickEmptyState'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiDelete } from '../../../../lib/api'
import ClipCard, { type Clip } from '../../../../components/clips/ClipCard'
import ClipLightbox from '../../../../components/clips/ClipLightbox'
import { confirmDialog } from '../../../../components/ui/ConfirmDialog'
import ToastContainer from '../../../../components/ToastContainer'

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

  const grouped = sorted.reduce<Record<string, ClipWithSource[]>>((acc, c) => {
    const key = c.contentId
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 transition-colors duration-500 font-inter pb-32">
      <ToastContainer />
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-12 pt-10 space-y-12">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8 pb-8 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-5 min-w-0">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              title="Back to Dashboard"
              aria-label="Back to Dashboard"
              className="w-12 h-12 rounded-xl bg-surface-card border border-surface-200 dark:border-surface-800 flex items-center justify-center text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                  Media Hub
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-surface-900 dark:text-white tracking-tight leading-tight sm:leading-none mt-1 break-words">All AI clips</h1>
              <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mt-2">
                {planLimits ? `${planLimits.label} plan · ${planLimits.aiClipCount} clips/video · ${planLimits.retentionDays}-day retention` : 'Auto-saved · organized by source'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative group w-full sm:w-56 md:w-64 lg:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 group-focus-within:text-primary-500 transition-colors" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search captions..."
                className="w-full bg-surface-card border border-surface-200 dark:border-surface-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shadow-inner"
              />
            </div>
            
            {/* Multi-select */}
            <button
              type="button"
              onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection() }}
              className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${selectMode ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-card border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
            >
              {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              Select
            </button>
            
            <button
              type="button"
              onClick={() => setGroupBySource(v => !v)}
              className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${groupBySource ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-card border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
            >
              <Video className="w-4 h-4" /> {groupBySource ? 'Grouped' : 'Flat'}
            </button>
            
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-card border border-surface-200 dark:border-surface-800 shadow-sm">
              <Filter className="w-4 h-4 text-surface-400" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                aria-label="Sort clips"
                title="Sort clips"
                className="bg-transparent text-xs font-bold uppercase tracking-wider text-surface-900 dark:text-white outline-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="viralScore">Viral score</option>
                <option value="rating">Your rating</option>
                <option value="duration">Duration</option>
              </select>
            </div>
          </div>
        </header>

        {loading ? (
          <ClickLoadingState intent="loading.analyzing" />
        ) : error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-8 text-rose-500 flex items-center gap-6 shadow-xl">
             <AlertTriangle size={32} />
             <p className="font-bold text-lg">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <ClickEmptyState
            intent="empty.clips"
            title="No AI clips yet"
            icon={<Sparkles className="w-7 h-7 text-primary-500 animate-pulse" />}
            action={
              <button
                type="button"
                onClick={() => router.push('/dashboard/video')}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-500 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 border-none"
              >
                Initiate Upload
              </button>
            }
          />
        ) : groupBySource ? (
          <div className="space-y-16">
            {Object.entries(grouped).map(([cid, list]) => (
              <section key={cid} className="space-y-6">
                <div className="flex items-center justify-between gap-6 px-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                       <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest italic leading-none">
                        Source · {list.length} clip{list.length === 1 ? '' : 's'}
                      </p>
                      {list[0]?.folder && (
                        <span className="px-2 py-0.5 rounded bg-surface-card border border-surface-200 dark:border-surface-800 text-[9px] font-bold text-surface-500 uppercase tracking-widest">
                          {list[0].folder.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight text-surface-900 dark:text-white truncate">{list[0]?.parentTitle || 'Untitled Archive'}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/clips/hub/${cid}`)}
                    className="px-6 py-2 rounded-xl bg-surface-card border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 text-xs font-bold uppercase tracking-widest text-surface-900 dark:text-white transition-all shadow-sm shrink-0"
                  >
                    Manage Archive
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
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
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+3rem)] left-1/2 -translate-x-1/2 z-50 px-4 sm:px-8 py-4 rounded-[3rem] bg-surface-card border-2 border-primary-500/30 dark:border-primary-500/20 shadow-[0_50px_100px_rgba(0,0,0,0.5)] flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8 backdrop-blur-3xl max-w-[calc(100vw-2rem)]"
          >
            <div className="flex flex-col">
               <span className="text-xs font-black uppercase tracking-widest text-primary-500 leading-none mb-1">{selectedIds.size} SELECTIONS</span>
               <div className="flex items-center gap-4">
                  <button type="button" onClick={selectAll} className="text-[10px] font-bold uppercase tracking-widest text-surface-400 hover:text-primary-500 transition-colors border-none bg-transparent p-0">Select all</button>
                  <button type="button" onClick={clearSelection} className="text-[10px] font-bold uppercase tracking-widest text-surface-400 hover:text-rose-500 transition-colors border-none bg-transparent p-0">Clear</button>
               </div>
            </div>
            <div className="w-px h-10 bg-surface-200 dark:bg-white/10" />
            <div className="flex items-center gap-3">
              <button type="button" onClick={bulkDownload} className="px-6 py-3 rounded-2xl bg-surface-900 dark:bg-white text-white dark:text-black text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-lg border-none">
                <Download className="w-4 h-4" /> Download
              </button>
              <button type="button" onClick={bulkDelete} disabled={bulkBusy} className="px-6 py-3 rounded-2xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-rose-700 transition-all disabled:opacity-50 shadow-lg active:scale-95 border-none">
                <Trash2 className="w-4 h-4" /> {bulkBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
