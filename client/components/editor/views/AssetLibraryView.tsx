'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Image as ImageIcon,
  Music,
  Upload,
  Plus,
  FolderOpen,
  Sparkles,
  Loader2,
  FileAudio,
  FileImage,
  Search,
  Trash2,
  Play,
  Pause,
  X,
  Clock,
  Film,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../../lib/api'
import { AUDIO_TRACKS, VIDEO_TRACKS } from '../../../types/editor'

interface Asset {
  id: string
  url: string
  title?: string
  name?: string
  type: 'music' | 'image' | 'broll' | 'sfx'
  duration?: number
  thumbnail?: string
  source?: 'upload' | 'click'
}

interface AssetLibraryViewProps {
  currentTime: number
  videoDuration: number
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

// Fallback when API unavailable
const FALLBACK_MUSIC: Asset[] = [
  { id: 'click-music-1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: 'Upbeat Creative', type: 'music', duration: 180, source: 'click' },
  { id: 'click-music-2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Calm Focus', type: 'music', duration: 240, source: 'click' },
  { id: 'click-music-3', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', title: 'Corporate Pulse', type: 'music', duration: 200, source: 'click' },
  { id: 'click-music-4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', title: 'Dramatic Build', type: 'music', duration: 190, source: 'click' },
  { id: 'click-music-5', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', title: 'Minimal Loop', type: 'music', duration: 120, source: 'click' },
]

const FALLBACK_IMAGES: Asset[] = Array.from({ length: 12 }, (_, i) => ({
  id: `click-img-${i + 1}`,
  url: `https://picsum.photos/id/${i}/800/600`,
  title: `Stock ${i + 1}`,
  type: 'image' as const,
  thumbnail: `https://picsum.photos/id/${i}/400/300`,
  source: 'click' as const,
}))

const STORAGE_KEY_MUSIC = 'click-asset-library-my-music'
const STORAGE_KEY_IMAGES = 'click-asset-library-my-images'
const STORAGE_KEY_BROLL = 'click-asset-library-my-broll'
const STORAGE_KEY_SFX = 'click-asset-library-my-sfx'
const STORAGE_KEY_RECENT = 'click-asset-library-recent'
const RECENT_MAX = 6

function getAuthHeaders(): Record<string, string> {
  let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !token) {
    token = 'dev-jwt-token-' + Date.now()
    localStorage.setItem('token', token)
  }
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function getUploadBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL
  if (api) {
    const base = api.replace(/\/api\/?$/, '').trim()
    if (base) return base
  }
  if (typeof window !== 'undefined' && (window.location.port === '3010' || window.location.hostname === 'localhost'))
    return 'http://localhost:5001'
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001'
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

const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  currentTime,
  videoDuration,
  setTimelineSegments,
  showToast,
}) => {
  const [tab, setTab] = useState<'uploads' | 'click'>('uploads')
  const [filter, setFilter] = useState<'all' | 'music' | 'images' | 'broll' | 'sfx'>('all')
  const [search, setSearch] = useState('')
  const [myMusic, setMyMusic] = useState<Asset[]>([])
  const [myImages, setMyImages] = useState<Asset[]>([])
  const [myBroll, setMyBroll] = useState<Asset[]>([])
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
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const fileInputMusic = useRef<HTMLInputElement>(null)
  const fileInputImages = useRef<HTMLInputElement>(null)
  const fileInputBroll = useRef<HTMLInputElement>(null)
  const fileInputSfx = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const loadStoredUploads = useCallback(() => {
    try {
      const rawMusic = localStorage.getItem(STORAGE_KEY_MUSIC)
      const rawImages = localStorage.getItem(STORAGE_KEY_IMAGES)
      const rawBroll = localStorage.getItem(STORAGE_KEY_BROLL)
      const rawSfx = localStorage.getItem(STORAGE_KEY_SFX)
      const rawRecent = localStorage.getItem(STORAGE_KEY_RECENT)
      if (rawMusic) {
        const parsed = JSON.parse(rawMusic)
        if (Array.isArray(parsed)) setMyMusic(parsed)
      }
      if (rawImages) {
        const parsed = JSON.parse(rawImages)
        if (Array.isArray(parsed)) setMyImages(parsed)
      }
      if (rawBroll) {
        const parsed = JSON.parse(rawBroll)
        if (Array.isArray(parsed)) setMyBroll(parsed)
      }
      if (rawSfx) {
        const parsed = JSON.parse(rawSfx)
        if (Array.isArray(parsed)) setMySfx(parsed)
      }
      if (rawRecent) {
        const parsed = JSON.parse(rawRecent)
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, RECENT_MAX))
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadStoredUploads()
  }, [loadStoredUploads])

  const saveRecent = useCallback((nextOrUpdater: Asset[] | ((prev: Asset[]) => Asset[])) => {
    setRecent((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      try {
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(next.slice(0, RECENT_MAX)))
      } catch {
        /* ignore */
      }
      return next.slice(0, RECENT_MAX)
    })
  }, [])

  const mapStockItem = useCallback((item: any, type: 'music' | 'image' | 'broll' | 'sfx'): Asset => ({
    id: item.id || `stock-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: item.url,
    title: item.title || item.name || 'Asset',
    name: item.name,
    type,
    duration: item.duration,
    thumbnail: item.thumbnail || (type === 'image' ? item.url : undefined),
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
    if (typesToLoad.length === 0) typesToLoad.push('music', 'images', 'broll', 'sfx')

    try {
      let hasMore = false
      for (const type of typesToLoad) {
        const res = await apiGet<{ data?: { items?: any[]; hasMore?: boolean; total?: number } }>(
          `/assets/stock?type=${type}&page=${page}&limit=24&q=${encodeURIComponent(q)}`
        )
        const data = (res?.data ?? res) as { items?: any[]; hasMore?: boolean; data?: { items?: any[]; hasMore?: boolean } } | undefined
        const rawItems = data?.items ?? data?.data?.items ?? []
        const items = rawItems.map((i: any) =>
          mapStockItem(i, type === 'images' ? 'image' : type === 'sfx' ? 'sfx' : type === 'music' ? 'music' : 'broll')
        )
        if (data?.hasMore ?? data?.data?.hasMore) hasMore = true
        if (type === 'music') {
          setClickMusic((prev) => (append && page > 1 ? [...prev, ...items] : items))
        } else if (type === 'images') {
          setClickImages((prev) => (append && page > 1 ? [...prev, ...items] : items))
        } else if (type === 'broll') {
          setClickBroll((prev) => (append && page > 1 ? [...prev, ...items] : items))
        } else {
          setClickSfx((prev) => (append && page > 1 ? [...prev, ...items] : items))
        }
      }
      setStockHasMore(hasMore)
      setStockPage(page)
    } catch {
      setClickMusic(FALLBACK_MUSIC)
      setClickImages(FALLBACK_IMAGES)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, search, mapStockItem])

  const loadMoreStock = useCallback(() => {
    loadClickStock(stockPage + 1, true)
  }, [stockPage, loadClickStock])

  useEffect(() => {
    if (tab === 'click') loadClickStock(1, false)
  }, [tab, filter])

  useEffect(() => {
    if (tab === 'click') {
      const t = setTimeout(() => loadClickStock(1, false, search), 300)
      return () => clearTimeout(t)
    }
  }, [search, tab])

  const addToTimeline = useCallback(
    (asset: Asset, durationSeconds?: number) => {
      const isMusic = asset.type === 'music'
      const isSfx = asset.type === 'sfx'
      const isBroll = asset.type === 'broll'
      const isAudio = isMusic || isSfx
      const duration = isAudio
        ? durationSeconds ?? asset.duration ?? (isSfx ? 2 : Math.max(30, (videoDuration || 0) - currentTime))
        : durationSeconds ?? (isBroll ? 10 : 5)
      const start = currentTime
      const end = start + duration
      const segType = isAudio ? 'audio' : isBroll ? 'video' : 'image'
      const label = isMusic ? 'Music' : isSfx ? 'SFX' : isBroll ? 'B-roll' : 'Image'
      const segment = {
        id: `seg-${asset.id}-${Date.now()}`,
        startTime: start,
        endTime: end,
        duration,
        type: segType,
        name: asset.title || asset.name || label,
        color: isMusic ? '#10B981' : isSfx ? '#F97316' : isBroll ? '#F59E0B' : '#8B5CF6',
        track: isMusic ? AUDIO_TRACKS[0].index : isSfx ? AUDIO_TRACKS[2].index : isBroll ? VIDEO_TRACKS[2].index : VIDEO_TRACKS[4].index,
        sourceUrl: asset.url,
      }
      setTimelineSegments((prev: any[]) => [...prev, segment])
      saveRecent((prev) => [asset, ...prev.filter((a) => a.id !== asset.id || a.url !== asset.url)].slice(0, RECENT_MAX))
      showToast(`${label} added at ${formatTime(currentTime)}`, 'success')
      setPreviewAsset(null)
      setPreviewPlaying(false)
      previewAudioRef.current?.pause()
    },
    [currentTime, videoDuration, setTimelineSegments, showToast, saveRecent]
  )

  const handleUploadMusic = useCallback(
    async (file: File) => {
      const allowed = /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name) || /^audio\//.test(file.type)
      if (!allowed) {
        showToast('Use MP3, WAV, M4A, AAC, or OGG', 'error')
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('music', file)
        const res = await fetch('/api/music/upload', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Upload failed')
        const d = data?.data
        const url =
          d?.file?.url ||
          d?.url ||
          data?.fileUrl ||
          (d?.file?.filename ? `/uploads/music/${d.file.filename}` : d?.filename ? `/uploads/music/${d.filename}` : '')
        if (!url) throw new Error('No file URL returned')
        const base = getUploadBaseUrl()
        const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`
        const n: Asset = {
          id: (d?._id || d?.id || `upload-music-${Date.now()}`).toString(),
          url: fullUrl,
          title: d?.title || file.name.replace(/\.[^/.]+$/, ''),
          type: 'music',
          duration: d?.duration,
          source: 'upload',
        }
        setMyMusic((prev) => {
          const next = [n, ...prev.filter((x) => x.id !== n.id)]
          try {
            localStorage.setItem(STORAGE_KEY_MUSIC, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
        showToast('Music uploaded', 'success')
      } catch (err: any) {
        showToast(err?.message || 'Music upload failed', 'error')
      } finally {
        setUploading(false)
        if (fileInputMusic.current) fileInputMusic.current.value = ''
      }
    },
    [showToast]
  )

  const handleUploadSfx = useCallback(
    async (file: File) => {
      const allowed = /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name) || /^audio\//.test(file.type)
      if (!allowed) {
        showToast('Use MP3, WAV, M4A, AAC, or OGG', 'error')
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('music', file)
        const res = await fetch('/api/music/upload', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Upload failed')
        const d = data?.data
        const url =
          d?.file?.url ||
          d?.url ||
          data?.fileUrl ||
          (d?.file?.filename ? `/uploads/music/${d.file.filename}` : d?.filename ? `/uploads/music/${d.filename}` : '')
        if (!url) throw new Error('No file URL returned')
        const base = getUploadBaseUrl()
        const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`
        const n: Asset = {
          id: (d?._id || d?.id || `upload-sfx-${Date.now()}`).toString(),
          url: fullUrl,
          title: d?.title || file.name.replace(/\.[^/.]+$/, ''),
          type: 'sfx',
          duration: d?.duration ?? 2,
          source: 'upload',
        }
        setMySfx((prev) => {
          const next = [n, ...prev.filter((x) => x.id !== n.id)]
          try {
            localStorage.setItem(STORAGE_KEY_SFX, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
        showToast('Sound effect uploaded', 'success')
      } catch (err: any) {
        showToast(err?.message || 'SFX upload failed', 'error')
      } finally {
        setUploading(false)
        if (fileInputSfx.current) fileInputSfx.current.value = ''
      }
    },
    [showToast]
  )

  const handleUploadImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      const allowed = files.every((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.name) || /^image\//.test(f.type))
      if (!allowed) {
        showToast('Use PNG, JPG, WebP, or GIF', 'error')
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        files.forEach((f) => form.append('images', f))
        const base = getUploadBaseUrl()
        const res = await fetch('/api/video/manual-editing/upload-assets', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Upload failed')
        const images = data?.data?.uploadedAssets?.images || []
        const newAssets: Asset[] = images.map((img: any) => {
          const fullUrl = img.url?.startsWith('http') ? img.url : `${base}${img.url?.startsWith('/') ? '' : '/'}${img.url || ''}`
          return {
            id: img.id || `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            url: fullUrl,
            title: img.name || 'Image',
            type: 'image' as const,
            thumbnail: fullUrl,
            source: 'upload' as const,
          }
        })
        setMyImages((prev) => {
          const next = [...newAssets, ...prev]
          try {
            localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
        showToast(`${newAssets.length} image(s) uploaded`, 'success')
      } catch (err: any) {
        showToast(err?.message || 'Image upload failed', 'error')
      } finally {
        setUploading(false)
        if (fileInputImages.current) fileInputImages.current.value = ''
      }
    },
    [showToast]
  )

  const handleUploadBroll = useCallback(
    async (file: File) => {
      const allowed = /\.(mp4|mov|mkv|webm)$/i.test(file.name) || /^video\//.test(file.type)
      if (!allowed) {
        showToast('Use MP4, MOV, MKV, or WebM', 'error')
        return
      }
      setUploading(true)
      try {
        const form = new FormData()
        form.append('broll', file)
        const base = getUploadBaseUrl()
        const res = await fetch('/api/video/manual-editing/upload-broll', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'B-roll upload failed')
        const d = data?.data
        const fullUrl = d?.url?.startsWith('http') ? d.url : `${getUploadBaseUrl()}${d?.url?.startsWith('/') ? '' : '/'}${d?.url || ''}`
        const n: Asset = {
          id: d?.id || `broll-${Date.now()}`,
          url: fullUrl,
          title: d?.name || file.name.replace(/\.[^/.]+$/, ''),
          type: 'broll',
          source: 'upload',
        }
        setMyBroll((prev) => {
          const next = [n, ...prev.filter((x) => x.id !== n.id)]
          try {
            localStorage.setItem(STORAGE_KEY_BROLL, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
        showToast('B-roll clip uploaded', 'success')
      } catch (err: any) {
        showToast(err?.message || 'B-roll upload failed', 'error')
      } finally {
        setUploading(false)
        if (fileInputBroll.current) fileInputBroll.current.value = ''
      }
    },
    [showToast]
  )

  const onMusicInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleUploadMusic(f)
  }
  const onImagesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) handleUploadImages(files)
  }
  const onBrollInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleUploadBroll(f)
  }
  const onSfxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleUploadSfx(f)
  }

  const removeUpload = useCallback(
    (asset: Asset, list: 'music' | 'images' | 'broll' | 'sfx') => {
      if (list === 'music') {
        setMyMusic((prev) => {
          const next = prev.filter((a) => a.id !== asset.id || a.url !== asset.url)
          try {
            localStorage.setItem(STORAGE_KEY_MUSIC, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      } else if (list === 'images') {
        setMyImages((prev) => {
          const next = prev.filter((a) => a.id !== asset.id || a.url !== asset.url)
          try {
            localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      } else if (list === 'sfx') {
        setMySfx((prev) => {
          const next = prev.filter((a) => a.id !== asset.id || a.url !== asset.url)
          try {
            localStorage.setItem(STORAGE_KEY_SFX, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      } else {
        setMyBroll((prev) => {
          const next = prev.filter((a) => a.id !== asset.id || a.url !== asset.url)
          try {
            localStorage.setItem(STORAGE_KEY_BROLL, JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      }
      showToast('Removed from library', 'info')
    },
    [showToast]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, zone: 'music' | 'images' | 'broll' | 'sfx') => {
      e.preventDefault()
      setDragOver(null)
      if (uploading) return
      const files = Array.from(e.dataTransfer.files || [])
      if (zone === 'music') {
        const f = files.find((x) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(x.name) || /^audio\//.test(x.type))
        if (f) handleUploadMusic(f)
      } else if (zone === 'sfx') {
        const f = files.find((x) => /\.(mp3|wav|m4a|aac|ogg)$/i.test(x.name) || /^audio\//.test(x.type))
        if (f) handleUploadSfx(f)
      } else if (zone === 'images') {
        const imgFiles = files.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.name) || /^image\//.test(f.type))
        if (imgFiles.length) handleUploadImages(imgFiles)
      } else {
        const f = files.find((x) => /\.(mp4|mov|mkv|webm)$/i.test(x.name) || /^video\//.test(x.type))
        if (f) handleUploadBroll(f)
      }
    },
    [uploading, handleUploadMusic, handleUploadSfx, handleUploadImages, handleUploadBroll]
  )

  const uploadsMusic = filter === 'all' || filter === 'music' ? myMusic : []
  const uploadsImages = filter === 'all' || filter === 'images' ? myImages : []
  const uploadsBroll = filter === 'all' || filter === 'broll' ? myBroll : []
  const uploadsSfx = filter === 'all' || filter === 'sfx' ? mySfx : []
  const searchLower = search.trim().toLowerCase()
  const clickMusicFiltered =
    filter === 'all' || filter === 'music'
      ? clickMusic.filter((a) => !searchLower || (a.title || '').toLowerCase().includes(searchLower))
      : []
  const clickImagesFiltered =
    filter === 'all' || filter === 'images'
      ? clickImages.filter((a) => !searchLower || (a.title || '').toLowerCase().includes(searchLower))
      : []
  const clickBrollFiltered =
    filter === 'all' || filter === 'broll'
      ? clickBroll.filter((a) => !searchLower || (a.title || '').toLowerCase().includes(searchLower))
      : []
  const clickSfxFiltered =
    filter === 'all' || filter === 'sfx'
      ? clickSfx.filter((a) => !searchLower || (a.title || '').toLowerCase().includes(searchLower))
      : []

  const recentFiltered = recent.filter((a) => {
    if (filter === 'music' && a.type !== 'music') return false
    if (filter === 'images' && a.type !== 'image') return false
    if (filter === 'broll' && a.type !== 'broll') return false
    if (filter === 'sfx' && a.type !== 'sfx') return false
    return true
  })

  const renderAssetCard = (
    asset: Asset,
    opts: { showAdd?: boolean; showDelete?: boolean; isRecent?: boolean } = {}
  ) => {
    const { showAdd = true, showDelete = false, isRecent = false } = opts
    return (
      <motion.div
        key={`${asset.id}-${asset.url}`}
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 shadow-lg hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
      >
        <div
          className="aspect-video relative bg-gray-200 dark:bg-gray-900 cursor-pointer"
          onClick={() => setPreviewAsset(asset)}
        >
          {asset.type === 'music' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <FileAudio className="w-7 h-7 text-emerald-500" />
              </div>
            </div>
          ) : asset.type === 'sfx' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                <Zap className="w-7 h-7 text-orange-500" />
              </div>
            </div>
          ) : asset.type === 'broll' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                <Film className="w-7 h-7 text-amber-500" />
              </div>
            </div>
          ) : (
            <img
              src={asset.thumbnail || asset.url}
              alt={asset.title || ''}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {(asset.type === 'music' || asset.type === 'sfx') && asset.duration != null && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-white/90">
                <Clock className="w-3 h-3" />
                {formatDuration(asset.duration)}
              </span>
            )}
            {showAdd && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addToTimeline(asset)
                }}
                className="ml-auto p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-full shadow-xl hover:scale-110 transition-transform"
                title="Add to timeline"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          {showDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const list = asset.type === 'music' ? 'music' : asset.type === 'broll' ? 'broll' : 'images'
                if (confirm('Remove this from your library?')) removeUpload(asset, asset.type === 'music' ? 'music' : asset.type === 'sfx' ? 'sfx' : asset.type === 'broll' ? 'broll' : 'images')
              }}
              className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {asset.source === 'click' && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-indigo-500/90 text-white text-[10px] font-bold uppercase">
              Click
            </span>
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
            {asset.title || asset.name || 'Asset'}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {asset.type === 'music'
              ? asset.duration != null
                ? formatDuration(asset.duration)
                : 'Audio'
              : asset.type === 'sfx'
                ? 'SFX'
                : asset.type === 'broll'
                  ? 'B-roll'
                  : 'Image'}
            {asset.source === 'click' && ' · Click'}
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-black uppercase text-gray-900 dark:text-white tracking-widest">
          Music, Images, B-Roll &amp; SFX
        </h3>
      </div>

      <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1 flex-shrink-0">
        <button
          onClick={() => setTab('uploads')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === 'uploads'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          <FolderOpen className="w-4 h-4" />
          Your uploads
        </button>
        <button
          onClick={() => setTab('click')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${tab === 'click'
            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          Click library
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap flex-shrink-0">
        {(['all', 'music', 'images', 'broll', 'sfx'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            {f === 'broll' ? 'B-roll' : f === 'sfx' ? 'SFX' : f}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-amber-600 dark:text-amber-400 flex-shrink-0">
        <strong>Premium audio:</strong> Music—fit the emotion, cut visuals to the beat. SFX—use sparingly: whooshes on cuts, hits on key words; intentional, not spammy.
      </p>

      {tab === 'click' && (
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search Click library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      )}

      {tab === 'uploads' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
            <input
              ref={fileInputMusic}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*"
              className="hidden"
              onChange={onMusicInputChange}
            />
            <input
              ref={fileInputImages}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,image/*"
              multiple
              className="hidden"
              onChange={onImagesInputChange}
            />
            <input
              ref={fileInputBroll}
              type="file"
              accept=".mp4,.mov,.mkv,.webm,video/*"
              className="hidden"
              onChange={onBrollInputChange}
            />
            <input
              ref={fileInputSfx}
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*"
              className="hidden"
              onChange={onSfxInputChange}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver('music')
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, 'music')}
              onClick={() => fileInputMusic.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragOver === 'music'
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-500/5'
                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              ) : (
                <Music className="w-6 h-6 text-emerald-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {dragOver === 'music' ? 'Drop music here' : 'Upload music'}
              </span>
              <span className="text-[10px] text-gray-500">MP3, WAV, M4A</span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver('images')
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, 'images')}
              onClick={() => fileInputImages.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragOver === 'images'
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-500/5'
                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              ) : (
                <ImageIcon className="w-6 h-6 text-violet-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {dragOver === 'images' ? 'Drop images here' : 'Upload images'}
              </span>
              <span className="text-[10px] text-gray-500">PNG, JPG, WebP</span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver('broll')
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, 'broll')}
              onClick={() => fileInputBroll.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragOver === 'broll'
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-500/5'
                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              ) : (
                <Film className="w-6 h-6 text-amber-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {dragOver === 'broll' ? 'Drop B-roll here' : 'Upload B-roll'}
              </span>
              <span className="text-[10px] text-gray-500">MP4, MOV, MKV</span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver('sfx')
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, 'sfx')}
              onClick={() => fileInputSfx.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragOver === 'sfx'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-500/5'
                } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              ) : (
                <Zap className="w-6 h-6 text-orange-500" />
              )}
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {dragOver === 'sfx' ? 'Drop SFX here' : 'Upload SFX'}
              </span>
              <span className="text-[10px] text-gray-500">MP3, WAV</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            Drag & drop or click. Add to timeline at current playhead.
          </p>
        </>
      )}

      {tab === 'click' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          Use Click’s music and stock images. Click to preview, then add to timeline.
        </p>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-4">
        {recentFiltered.length > 0 && (
          <div>
            <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2">
              Recently used
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence>
                {recentFiltered.map((a) => renderAssetCard(a, { showAdd: true }))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {tab === 'uploads' && (
          <div>
            <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2">
              Your library
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence>
                {uploadsMusic.map((a) => renderAssetCard(a, { showAdd: true, showDelete: true }))}
                {uploadsImages.map((a) => renderAssetCard(a, { showAdd: true, showDelete: true }))}
                {uploadsBroll.map((a) => renderAssetCard(a, { showAdd: true, showDelete: true }))}
                {uploadsSfx.map((a) => renderAssetCard(a, { showAdd: true, showDelete: true }))}
              </AnimatePresence>
              {uploadsMusic.length === 0 && uploadsImages.length === 0 && uploadsBroll.length === 0 && uploadsSfx.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700">
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No uploads yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Drag & drop or use the upload zones above
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'click' && (
          <div>
            <h4 className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider mb-2">
              Click library
            </h4>
            {loading && clickMusicFiltered.length === 0 && clickImagesFiltered.length === 0 && clickBrollFiltered.length === 0 && clickSfxFiltered.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {clickMusicFiltered.map((a) => renderAssetCard(a))}
                    {clickImagesFiltered.map((a) => renderAssetCard(a))}
                    {clickBrollFiltered.map((a) => renderAssetCard(a))}
                    {clickSfxFiltered.map((a) => renderAssetCard(a))}
                  </AnimatePresence>
                  {clickMusicFiltered.length === 0 && clickImagesFiltered.length === 0 && clickBrollFiltered.length === 0 && clickSfxFiltered.length === 0 && !loading && (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-dashed border-gray-200 dark:border-gray-700">
                      <Search className="w-10 h-10 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No results</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search or filter</p>
                    </div>
                  )}
                </div>
                {stockHasMore && !loading && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={loadMoreStock}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setPreviewAsset(null)
              setPreviewPlaying(false)
              previewAudioRef.current?.pause()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white truncate">
                  {previewAsset.title || previewAsset.name || 'Preview'}
                </h4>
                <button
                  onClick={() => {
                    setPreviewAsset(null)
                    setPreviewPlaying(false)
                    previewAudioRef.current?.pause()
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {(previewAsset.type === 'music' || previewAsset.type === 'sfx') ? (
                  <div className="space-y-4">
                    <div className={`flex items-center justify-center w-24 h-24 mx-auto rounded-full ${previewAsset.type === 'sfx' ? 'bg-orange-500/20' : 'bg-emerald-500/20'}`}>
                      {previewAsset.type === 'sfx' ? <Zap className="w-12 h-12 text-orange-500" /> : <FileAudio className="w-12 h-12 text-emerald-500" />}
                    </div>
                    <audio
                      ref={previewAudioRef}
                      src={previewAsset.url}
                      onPlay={() => setPreviewPlaying(true)}
                      onPause={() => setPreviewPlaying(false)}
                      onEnded={() => setPreviewPlaying(false)}
                    />
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          const el = previewAudioRef.current
                          if (!el) return
                          if (previewPlaying) el.pause()
                          else el.play()
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold text-sm"
                      >
                        {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {previewPlaying ? 'Pause' : 'Play'}
                      </button>
                      <button
                        onClick={() => addToTimeline(previewAsset)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add to timeline
                      </button>
                    </div>
                    {previewAsset.duration != null && (
                      <p className="text-center text-xs text-gray-500">
                        Duration {formatDuration(previewAsset.duration)}
                      </p>
                    )}
                  </div>
                ) : previewAsset.type === 'broll' ? (
                  <div className="space-y-4">
                    <div className="aspect-video rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <video
                        src={previewAsset.url}
                        controls
                        className="w-full h-full object-contain"
                        playsInline
                      />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => addToTimeline(previewAsset)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add B-roll to timeline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <img
                      src={previewAsset.thumbnail || previewAsset.url}
                      alt={previewAsset.title || ''}
                      className="w-full aspect-video object-contain rounded-xl bg-gray-100 dark:bg-gray-800"
                    />
                    <div className="flex justify-center">
                      <button
                        onClick={() => addToTimeline(previewAsset)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add to timeline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AssetLibraryView
