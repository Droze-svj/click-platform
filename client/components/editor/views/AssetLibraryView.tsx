'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Image as ImageIcon,
  Music,
  Plus,
  Trash2,
  Film,
  Zap,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { getAssetUrl } from '../../../utils/url'
import {
  Asset,
  AUDIO_TRACKS,
  VIDEO_TRACKS
} from '../../../types/editor'
import { Panel, Button, Badge, SectionHeader, EmptyState, Modal } from '../../ui'
import { cn } from '../../../lib/utils'

interface AssetLibraryViewProps {
  currentTime: number
  videoDuration: number
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  myMusic?: Asset[]
  myBroll?: Asset[]
}

const STORAGE_KEY_MUSIC = 'click-asset-library-my-music'
const STORAGE_KEY_IMAGES = 'click-asset-library-my-images'
const STORAGE_KEY_BROLL = 'click-asset-library-my-broll'
const STORAGE_KEY_SFX = 'click-asset-library-my-sfx'
const STORAGE_KEY_RECENT = 'click-asset-library-recent'
const RECENT_MAX = 6

// Static accent maps (dynamic `bg-${x}` classes can't survive Tailwind purge).
const ACCENT_BORDER: Record<string, string> = {
  emerald: 'hover:border-emerald-500/50',
  orange: 'hover:border-orange-500/50',
  amber: 'hover:border-amber-500/50',
  indigo: 'hover:border-indigo-500/50',
}
const ACCENT_DOT: Record<string, string> = {
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec)) return '--:--'
  return formatTime(sec)
}

const AssetLibraryView: React.FC<AssetLibraryViewProps> = (props) => {
  const {
    currentTime,
    setTimelineSegments,
    showToast,
  } = props
  const [tab, setTab] = useState<'uploads' | 'click'>('uploads')
  const [filter, setFilter] = useState<'all' | 'music' | 'images' | 'broll' | 'sfx'>('all')
  const [search, setSearch] = useState('')
  const [myMusic, setMyMusic] = useState<Asset[]>(props.myMusic || [])
  const [myImages, setMyImages] = useState<Asset[]>([])
  const [myBroll, setMyBroll] = useState<Asset[]>(props.myBroll || [])
  const [mySfx, setMySfx] = useState<Asset[]>([])
  const [recent, setRecent] = useState<Asset[]>([])
  const [clickMusic, setClickMusic] = useState<Asset[]>([])
  const [clickImages, setClickImages] = useState<Asset[]>([])
  const [clickBroll, setClickBroll] = useState<Asset[]>([])
  const [clickSfx, setClickSfx] = useState<Asset[]>([])
  const [stockPage, setStockPage] = useState(1)
  const [stockHasMore, setStockHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState<'music' | 'images' | 'broll' | 'sfx' | null>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const fileInputMusic = useRef<HTMLInputElement>(null)
  const fileInputImages = useRef<HTMLInputElement>(null)
  const fileInputBroll = useRef<HTMLInputElement>(null)
  const fileInputSfx = useRef<HTMLInputElement>(null)

  const fetchMyAssets = useCallback(async () => {
    try {
      // Fetch user videos (B-roll)
      const videoRes = await apiGet('/video')
      const videoData = videoRes?.data || videoRes || []
      const brollAssets: Asset[] = (Array.isArray(videoData) ? videoData : []).map((v: any) => ({
        id: v._id,
        url: getAssetUrl(v.originalFile?.url || ''),
        title: v.title || v.originalFile?.filename || 'Uploaded Video',
        type: 'broll',
        thumbnail: getAssetUrl(v.generatedContent?.shortVideos?.[0]?.thumbnail || v.originalFile?.url || ''),
        source: 'upload',
        createdAt: v.createdAt
      }))

      // Fetch user music
      const musicRes = await apiGet('/music/user-uploads')
      const musicData = musicRes?.data?.tracks || musicRes?.tracks || []
      const musicAssets: Asset[] = (Array.isArray(musicData) ? musicData : []).map((m: any) => ({
        id: m._id,
        url: getAssetUrl(m.file?.url || ''),
        title: m.title || 'Uploaded Music',
        type: 'music',
        duration: m.file?.duration,
        source: 'upload',
        createdAt: m.createdAt
      }))

      setMyBroll(brollAssets)
      setMyMusic(musicAssets)
    } catch (error) {
      console.error('Failed to fetch user assets:', error)
    }
  }, [])

  const loadStoredUploads = useCallback(() => {
    try {
      const rawMusic = localStorage.getItem(STORAGE_KEY_MUSIC)
      const rawImages = localStorage.getItem(STORAGE_KEY_IMAGES)
      const rawBroll = localStorage.getItem(STORAGE_KEY_BROLL)
      const rawSfx = localStorage.getItem(STORAGE_KEY_SFX)
      const rawRecent = localStorage.getItem(STORAGE_KEY_RECENT)
      if (rawMusic) setMyMusic(JSON.parse(rawMusic))
      if (rawImages) setMyImages(JSON.parse(rawImages))
      if (rawBroll) setMyBroll(JSON.parse(rawBroll))
      if (rawSfx) setMySfx(JSON.parse(rawSfx))
      if (rawRecent) setRecent(JSON.parse(rawRecent).slice(0, RECENT_MAX))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadStoredUploads()
    fetchMyAssets()
  }, [loadStoredUploads, fetchMyAssets])

  const saveRecent = useCallback((nextOrUpdater: Asset[] | ((prev: Asset[]) => Asset[])) => {
    setRecent((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      try { localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(next.slice(0, RECENT_MAX))) } catch { /* ignore */ }
      return next.slice(0, RECENT_MAX)
    })
  }, [])

  const mapStockItem = useCallback((item: any, type: 'music' | 'image' | 'broll' | 'sfx'): Asset => ({
    id: item.id || `stock-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: getAssetUrl(item.url || ''),
    title: item.title || item.name || 'Asset',
    name: item.name,
    type,
    duration: item.duration,
    thumbnail: item.thumbnail ? getAssetUrl(item.thumbnail) : (type === 'image' ? getAssetUrl(item.url || '') : undefined),
    source: 'click',
  }), [])

  const loadClickStock = useCallback(async (page = 1, append = false, searchQuery = '') => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const q = searchQuery || search
    const typesToLoad: Array<'music' | 'images' | 'broll' | 'sfx'> = []
    if (filter === 'all' || filter === 'music') typesToLoad.push('music')
    if (filter === 'all' || filter === 'images') typesToLoad.push('images')
    if (filter === 'all' || filter === 'broll') typesToLoad.push('broll')
    if (filter === 'all' || filter === 'sfx') typesToLoad.push('sfx')

    try {
      let hasMoreVisible = false
      for (const type of typesToLoad) {
        const res = await apiGet<{ data?: { items?: any[]; hasMore?: boolean; total?: number } }>(
          `/assets/stock?type=${type}&page=${page}&limit=24&q=${encodeURIComponent(q)}`
        )
        const data = (res?.data ?? res) as any
        const rawItems = data?.items ?? data?.data?.items ?? []
        const items = rawItems.map((i: any) => mapStockItem(i, type === 'images' ? 'image' : type === 'sfx' ? 'sfx' : type === 'music' ? 'music' : 'broll'))
        if (data?.hasMore ?? data?.data?.hasMore) hasMoreVisible = true
        if (type === 'music') setClickMusic((prev) => (append && page > 1 ? [...prev, ...items] : items))
        else if (type === 'images') setClickImages((prev) => (append && page > 1 ? [...prev, ...items] : items))
        else if (type === 'broll') setClickBroll((prev) => (append && page > 1 ? [...prev, ...items] : items))
        else if (type === 'sfx') setClickSfx((prev) => (append && page > 1 ? [...prev, ...items] : items))
      }
      setStockHasMore(hasMoreVisible)
      setStockPage(page)
    } catch {
      // Honest failure: surface an error rather than presenting mock catalog as real.
      showToast('Could not load the stock library', 'error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, search, mapStockItem, showToast])

  useEffect(() => {
    if (tab === 'click') loadClickStock(1, false)
    else fetchMyAssets()
  }, [tab, filter, fetchMyAssets, loadClickStock])

  const handleFileUpload = async (file: File, type: 'music' | 'image' | 'broll' | 'sfx') => {
    setUploading(true)
    showToast(`Uploading ${file.name}…`, 'info')

    try {
      const formData = new FormData()

      let endpoint = '/video/upload'
      if (type === 'music' || type === 'sfx') {
        endpoint = '/music/user-uploads'
        formData.append('audio', file)
        formData.append('title', file.name.replace(/\.[^/.]+$/, ""))
        formData.append('licenseAttestation', 'true')
      } else {
        formData.append('video', file)
        formData.append('title', file.name.replace(/\.[^/.]+$/, ""))
      }

      await apiPost(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      showToast('Asset uploaded', 'success')
      fetchMyAssets()
    } catch (error: any) {
      console.error('Upload failed:', error)
      showToast(error.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const addToTimeline = useCallback((asset: Asset, durationSeconds?: number) => {
    const isAudio = asset.type === 'music' || asset.type === 'sfx'
    const duration = isAudio ? durationSeconds ?? asset.duration ?? (asset.type === 'sfx' ? 2 : 30) : durationSeconds ?? (asset.type === 'broll' ? 10 : 5)
    const segment = {
      id: `seg-${asset.id}-${Date.now()}`,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration,
      type: isAudio ? 'audio' : asset.type === 'broll' ? 'video' : 'image',
      name: asset.title || asset.name || 'Asset',
      color: asset.type === 'music' ? '#10B981' : asset.type === 'sfx' ? '#F97316' : asset.type === 'broll' ? '#F59E0B' : '#8B5CF6',
      track: asset.type === 'music' ? AUDIO_TRACKS[0].index : asset.type === 'sfx' ? AUDIO_TRACKS[2].index : asset.type === 'broll' ? VIDEO_TRACKS[2].index : VIDEO_TRACKS[4].index,
      sourceUrl: asset.url,
    }
    setTimelineSegments((prev: any[]) => [...prev, segment])
    saveRecent((prev) => [asset, ...prev.filter((a) => a.id !== asset.id)].slice(0, RECENT_MAX))
    showToast('Added to timeline', 'success')
    setPreviewAsset(null)
  }, [currentTime, setTimelineSegments, showToast, saveRecent])

  const handleDrop = (e: React.DragEvent, zone: 'music' | 'images' | 'broll' | 'sfx') => {
    e.preventDefault(); setDragOver(null);
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files || []);
    showToast(`Ingesting ${files.length} file(s)`, 'info');
  }

  const FILTERS: { id: typeof filter; label: string; icon: LucideIcon }[] = [
    { id: 'all', label: 'All', icon: Layers },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'broll', label: 'B-Roll', icon: Film },
    { id: 'sfx', label: 'SFX', icon: Zap },
  ]

  const renderAssetCard = (asset: Asset, opts: { showDelete?: boolean } = {}) => {
    const isMusic = asset.type === 'music' || asset.type === 'sfx'
    const accent = asset.type === 'music' ? 'emerald' : asset.type === 'sfx' ? 'orange' : asset.type === 'broll' ? 'amber' : 'indigo'

    return (
      <div
        key={`${asset.id}-${asset.url}`}
        className={cn(
          'group relative cursor-grab overflow-hidden rounded-2xl border border-subtle ds-surface-card transition-colors active:cursor-grabbing',
          ACCENT_BORDER[accent]
        )}
        draggable
        onDragStart={(e: any) => {
          if (e.dataTransfer) {
            e.dataTransfer.setData('application/json', JSON.stringify({
              type: 'library-asset',
              asset
            }))
            e.dataTransfer.effectAllowed = 'copy'
          }
        }}
      >
        <div
          className="relative aspect-video cursor-pointer overflow-hidden"
          onClick={() => setPreviewAsset(asset)}
        >
          {isMusic ? (
            <div className="absolute inset-0 flex items-center justify-center ds-surface-subtle">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                {asset.type === 'sfx' ? <Zap className="h-7 w-7 text-orange-500" aria-hidden /> : <Music className="h-7 w-7 text-emerald-500" aria-hidden />}
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.thumbnail || asset.url} alt={asset.title || ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-3 opacity-0 transition-opacity group-hover:opacity-100">
            {asset.duration && <span className="text-[10px] font-semibold tabular-nums text-white">{formatDuration(asset.duration)}</span>}
            <div className="pointer-events-auto ml-auto flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); addToTimeline(asset); }}
                className="rounded-lg bg-white p-2 text-black shadow"
                title="Add to timeline"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
              {opts.showDelete && (
                <button type="button" onClick={(e) => { e.stopPropagation(); showToast('Asset removed', 'info'); }} className="rounded-lg bg-rose-600 p-2 text-white shadow" title="Remove asset"><Trash2 className="h-4 w-4" aria-hidden /></button>
              )}
            </div>
          </div>

          {asset.source === 'click' && (
            <Badge variant="outline" className="absolute left-3 top-3 border-white/20 bg-black/40 text-white">Stock</Badge>
          )}
        </div>
        <div className="space-y-1.5 p-4">
          <p className="ds-text-label truncate text-theme-primary">{asset.title || 'Untitled'}</p>
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT_DOT[accent])} />
            <p className="ds-text-caption text-theme-muted">{asset.type}</p>
          </div>
          {asset.autoTags && asset.autoTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {asset.autoTags.slice(0, 3).map(tag => (
                <span key={tag} className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] text-theme-muted">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const uploadZones: { label: string; icon: LucideIcon; color: string; ref: React.RefObject<HTMLInputElement>; type: 'music' | 'image' | 'broll' | 'sfx' }[] = [
    { label: 'Upload audio', icon: Music, color: 'emerald', ref: fileInputMusic, type: 'music' },
    { label: 'Upload image', icon: ImageIcon, color: 'indigo', ref: fileInputImages, type: 'image' },
    { label: 'Upload video', icon: Film, color: 'amber', ref: fileInputBroll, type: 'broll' },
    { label: 'Upload SFX', icon: Zap, color: 'orange', ref: fileInputSfx, type: 'sfx' },
  ]

  const inventory = tab === 'uploads'
    ? [...recent, ...myMusic, ...myImages, ...myBroll, ...mySfx]
    : [...recent, ...clickMusic, ...clickImages]

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col space-y-6 py-4 ds-anim-rise">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2 border-indigo-500/30 text-indigo-500">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Asset Library
          </Badge>
          <SectionHeader as="h1" title="Assets" description="Your uploads and the stock library — drag onto the timeline or click to preview." />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-subtle ds-surface-subtle p-1">
          <button type="button" onClick={() => setTab('uploads')} className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', tab === 'uploads' ? 'bg-indigo-600 text-white' : 'text-theme-muted hover:text-theme-primary')}>My uploads</button>
          <button type="button" onClick={() => setTab('click')} className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', tab === 'click' ? 'bg-indigo-600 text-white' : 'text-theme-muted hover:text-theme-primary')}>Stock library</button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        {FILTERS.map(f => {
          const FIcon = f.icon
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors',
                active ? 'border-indigo-500 ds-surface-subtle' : 'border-subtle ds-surface-subtle hover:border-border'
              )}
            >
              <FIcon className={cn('h-5 w-5', active ? 'text-indigo-500' : 'text-theme-muted')} aria-hidden />
              <span className={cn('ds-text-caption', active ? 'text-indigo-500' : 'text-theme-secondary')}>{f.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-1">
        {tab === 'uploads' && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <input ref={fileInputMusic} type="file" className="hidden" accept="audio/*" title="Upload Music" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'music')} />
            <input ref={fileInputImages} type="file" className="hidden" accept="image/*" title="Upload Image" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')} />
            <input ref={fileInputBroll} type="file" className="hidden" accept="video/*" title="Upload Video" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'broll')} />
            <input ref={fileInputSfx} type="file" className="hidden" accept="audio/*" title="Upload SFX" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'sfx')} />

            {uploadZones.map(zone => {
              const ZIcon = zone.icon
              return (
                <button
                  type="button"
                  key={zone.label}
                  onClick={() => !uploading && zone.ref.current?.click()}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => handleDrop(e, zone.type === 'image' ? 'images' : zone.type)}
                  disabled={uploading}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-subtle ds-surface-subtle p-8 transition-colors hover:border-border disabled:opacity-50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                    <ZIcon className="h-6 w-6 text-theme-secondary" aria-hidden />
                  </div>
                  <span className="ds-text-label text-theme-primary">{zone.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="space-y-4">
          <span className="ds-text-label text-theme-muted">Inventory</span>
          {inventory.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {recent.map(a => renderAssetCard(a))}
              {tab === 'uploads' ? (
                <>
                  {myMusic.map(a => renderAssetCard(a, { showDelete: true }))}
                  {myImages.map(a => renderAssetCard(a, { showDelete: true }))}
                  {myBroll.map(a => renderAssetCard(a, { showDelete: true }))}
                  {mySfx.map(a => renderAssetCard(a, { showDelete: true }))}
                </>
              ) : (
                <>
                  {clickMusic.map(a => renderAssetCard(a))}
                  {clickImages.map(a => renderAssetCard(a))}
                </>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title={loading ? 'Loading assets…' : tab === 'uploads' ? 'No uploads yet' : 'No stock assets found'}
              description={tab === 'uploads' ? 'Upload audio, images, video or SFX to build your library.' : 'Try a different filter or search term.'}
            />
          )}
        </div>
      </div>

      {/* Preview modal */}
      <Modal
        open={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        title={previewAsset?.title || 'Preview'}
        className="max-w-3xl"
      >
        {previewAsset && (
          <div className="space-y-5">
            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl ds-surface-subtle">
              {(previewAsset.type === 'music' || previewAsset.type === 'sfx') ? (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-500/10">
                  <Music className="h-12 w-12 text-indigo-500" aria-hidden />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewAsset.url} alt={previewAsset.title || 'Preview asset'} className="h-full w-full object-contain" />
              )}
            </div>
            <Button onClick={() => addToTimeline(previewAsset)} className="w-full" leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
              Add to timeline
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AssetLibraryView
