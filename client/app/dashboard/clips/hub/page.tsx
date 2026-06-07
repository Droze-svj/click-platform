'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Sparkles, Filter, Video, Search, CheckSquare, Square, Download, Trash2 } from 'lucide-react'
import ClickLoadingState from '@/components/click/ClickLoadingState'
import ClickEmptyState from '@/components/click/ClickEmptyState'
import { apiGet, apiDelete } from '../../../../lib/api'
import ClipCard, { type Clip } from '../../../../components/clips/ClipCard'
import ClipLightbox from '../../../../components/clips/ClipLightbox'
import { confirmDialog } from '../../../../components/ui/ConfirmDialog'
import ToastContainer from '../../../../components/ToastContainer'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, Panel, SectionHeader, Badge, Input } from '../../../../components/ui'

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
  const { t } = useTranslation()
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
      setError(err?.message || t('clipsHubPage.errorLoad'))
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
      title: t('clipsHubPage.confirmDeleteTitle', { count }),
      description: t('clipsHubPage.confirmDeleteDescription'),
      confirmText: t('clipsHubPage.delete'),
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
            ? t('clipsHubPage.deleteAllFailed')
            : t('clipsHubPage.deletePartial', { deleted: ids.length - failures.length, total: ids.length, failed: failures.length }),
        },
      }))
    } else {
      window.dispatchEvent(new CustomEvent('toast', {
        detail: { type: 'success', message: t('clipsHubPage.deleteSuccess', { count: ids.length }) },
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
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-32 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title={t('clipsHubPage.title')}
        description={planLimits ? t('clipsHubPage.planSummary', { plan: planLimits.label, count: planLimits.aiClipCount, days: planLimits.retentionDays }) : t('clipsHubPage.autoSaved')}
        className="mb-6"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" aria-hidden />
              <Input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('clipsHubPage.searchPlaceholder')}
                className="pl-9"
              />
            </div>

            <Button
              variant={selectMode ? 'primary' : 'secondary'}
              size="md"
              leftIcon={selectMode ? <CheckSquare className="w-4 h-4" aria-hidden /> : <Square className="w-4 h-4" aria-hidden />}
              onClick={() => { setSelectMode(v => !v); if (selectMode) clearSelection() }}
            >
              {t('clipsHubPage.select')}
            </Button>

            <Button
              variant={groupBySource ? 'primary' : 'secondary'}
              size="md"
              leftIcon={<Video className="w-4 h-4" aria-hidden />}
              onClick={() => setGroupBySource(v => !v)}
            >
              {groupBySource ? t('clipsHubPage.grouped') : t('clipsHubPage.flat')}
            </Button>

            <div className="flex items-center gap-2 px-3 h-10 rounded-lg ds-surface-subtle">
              <Filter className="w-4 h-4 text-theme-muted" aria-hidden />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                aria-label={t('clipsHubPage.sortClips')}
                title={t('clipsHubPage.sortClips')}
                className="bg-transparent text-sm font-medium text-theme-primary outline-none cursor-pointer"
              >
                <option value="newest">{t('clipsHubPage.sortNewest')}</option>
                <option value="viralScore">{t('clipsHubPage.sortViralScore')}</option>
                <option value="rating">{t('clipsHubPage.sortRating')}</option>
                <option value="duration">{t('clipsHubPage.sortDuration')}</option>
              </select>
            </div>
          </div>
        }
      />

      {loading ? (
        <ClickLoadingState intent="loading.analyzing" />
      ) : error ? (
        <Panel variant="subtle" className="border border-rose-500/20 bg-rose-500/5 flex items-center gap-4 text-rose-500">
          <AlertTriangle size={28} aria-hidden />
          <p className="font-medium">{error}</p>
        </Panel>
      ) : sorted.length === 0 ? (
        <ClickEmptyState
          intent="empty.clips"
          title={t('clipsHubPage.emptyTitle')}
          icon={<Sparkles className="w-7 h-7 text-primary" />}
          action={
            <Button variant="primary" size="md" onClick={() => router.push('/dashboard/video')}>
              {t('clipsHubPage.initiateUpload')}
            </Button>
          }
        />
      ) : groupBySource ? (
        <div className="space-y-12">
          {Object.entries(grouped).map(([cid, list]) => (
            <section key={cid} className="space-y-5">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="ds-text-caption text-primary font-semibold">
                      {t('clipsHubPage.sourceClips', { count: list.length })}
                    </span>
                    {list[0]?.folder && (
                      <Badge variant="secondary">{list[0].folder.name}</Badge>
                    )}
                  </div>
                  <h2 className="ds-text-h3 text-theme-primary truncate">{list[0]?.parentTitle || t('clipsHubPage.untitledArchive')}</h2>
                </div>
                <Button variant="secondary" size="sm" className="shrink-0" onClick={() => router.push(`/dashboard/clips/hub/${cid}`)}>
                  {t('clipsHubPage.manageArchive')}
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="ds-anim-rise fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] left-1/2 -translate-x-1/2 z-[90] px-4 sm:px-6 py-3 ds-surface-elevated flex flex-wrap items-center justify-center gap-4 sm:gap-6 max-w-[calc(100vw-2rem)]">
          <div className="flex flex-col">
            <span className="ds-text-label text-primary leading-none mb-1">{t('clipsHubPage.selectionsCount', { count: selectedIds.size })}</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={selectAll} className="ds-text-caption font-medium text-theme-muted hover:text-primary transition-colors">{t('clipsHubPage.selectAll')}</button>
              <button type="button" onClick={clearSelection} className="ds-text-caption font-medium text-theme-muted hover:text-rose-500 transition-colors">{t('clipsHubPage.clear')}</button>
            </div>
          </div>
          <div className="w-px h-8 bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" leftIcon={<Download className="w-4 h-4" aria-hidden />} onClick={bulkDownload}>
              {t('clipsHubPage.download')}
            </Button>
            <Button variant="destructive" size="md" leftIcon={<Trash2 className="w-4 h-4" aria-hidden />} onClick={bulkDelete} loading={bulkBusy} disabled={bulkBusy}>
              {bulkBusy ? t('clipsHubPage.deleting') : t('clipsHubPage.delete')}
            </Button>
          </div>
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
          onOpenInEditor={(c) =>
            router.push(`/dashboard/video/edit/${c.contentId}?mode=manual${c.url ? `&clipUrl=${encodeURIComponent(c.url)}` : ''}`)
          }
        />
      )}
    </div>
  )
}
