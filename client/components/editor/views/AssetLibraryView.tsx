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
  Cpu,
  Target,
  Activity,
  ArrowUpRight,
  Layers,
  Radio,
  Fingerprint
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import {
  ShapeOverlay,
  ImageOverlay,
  GradientOverlay,
  Asset,
  AssetType,
  AUDIO_TRACKS,
  VIDEO_TRACKS
} from '../../../types/editor'

interface AssetLibraryViewProps {
  currentTime: number
  videoDuration: number
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  myMusic?: Asset[]
  myBroll?: Asset[]
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

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

const AssetLibraryView: React.FC<AssetLibraryViewProps> = (props) => {
  const {
    currentTime,
    videoDuration,
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
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const fileInputMusic = useRef<HTMLInputElement>(null)
  const fileInputImages = useRef<HTMLInputElement>(null)
  const fileInputBroll = useRef<HTMLInputElement>(null)
  const fileInputSfx = useRef<HTMLInputElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const fetchMyAssets = useCallback(async () => {
    try {
      // Fetch user videos (B-roll)
      const videoRes = await apiGet('/video')
      const videoData = videoRes?.data || videoRes || []
      const brollAssets: Asset[] = (Array.isArray(videoData) ? videoData : []).map((v: any) => ({
        id: v._id,
        url: v.originalFile?.url,
        title: v.title || v.originalFile?.filename || 'Uploaded Video',
        type: 'broll',
        thumbnail: v.generatedContent?.shortVideos?.[0]?.thumbnail || v.originalFile?.url,
        source: 'upload',
        createdAt: v.createdAt
      }))

      // Fetch user music
      const musicRes = await apiGet('/music/user-uploads')
      const musicData = musicRes?.data?.tracks || musicRes?.tracks || []
      const musicAssets: Asset[] = (Array.isArray(musicData) ? musicData : []).map((m: any) => ({
        id: m._id,
        url: m.file?.url,
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
      setClickMusic(FALLBACK_MUSIC)
      setClickImages(FALLBACK_IMAGES)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, search, mapStockItem])

  useEffect(() => {
    if (tab === 'click') loadClickStock(1, false)
    else fetchMyAssets()
  }, [tab, filter, fetchMyAssets])

  const handleFileUpload = async (file: File, type: 'music' | 'image' | 'broll' | 'sfx') => {
    setUploading(true)
    showToast(`Injecting ${file.name} into Neural Space...`, 'info')

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

      showToast('Neural Pattern Synced', 'success')
      fetchMyAssets()
    } catch (error: any) {
      console.error('Upload failed:', error)
      showToast(error.message || 'Transmission Failed', 'error')
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
    showToast('Asset Bridge Complete', 'success')
    setPreviewAsset(null)
  }, [currentTime, setTimelineSegments, showToast, saveRecent])

  const handleDrop = (e: React.DragEvent, zone: 'music' | 'images' | 'broll' | 'sfx') => {
    e.preventDefault(); setDragOver(null);
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files || []);
    showToast(`Ingesting ${files.length} Node(s)`, 'info');
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  }

  const renderAssetCard = (asset: Asset, opts: { showDelete?: boolean } = {}) => {
    const isMusic = asset.type === 'music' || asset.type === 'sfx'
    const accent = asset.type === 'music' ? 'emerald' : asset.type === 'sfx' ? 'orange' : asset.type === 'broll' ? 'amber' : 'indigo'

    return (
      <motion.div
        key={`${asset.id}-${asset.url}`}
        variants={itemVariants}
        whileHover={{ scale: 1.05, y: -4 }}
        className={`group relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-white/[0.03] transition-all duration-500 shadow-2xl hover:border-${accent}-500/50 hover:bg-white/[0.05] cursor-grab active:cursor-grabbing`}
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
          className="aspect-video relative cursor-pointer overflow-hidden"
          onClick={() => setPreviewAsset(asset)}
        >
          {isMusic ? (
            <div className={`absolute inset-0 flex items-center justify-center bg-${accent}-500/5`}>
              <div className={`w-16 h-16 rounded-full bg-${accent}-500/20 flex items-center justify-center shadow-3xl`}>
                {asset.type === 'sfx' ? <Zap className="w-8 h-8 text-orange-400" /> : <Music className="w-8 h-8 text-emerald-400" />}
              </div>
            </div>
          ) : (
            <img src={asset.thumbnail || asset.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {asset.duration && <span className="text-[10px] font-black text-white italic uppercase tracking-widest tabular-nums">{formatDuration(asset.duration)}</span>}
            <div className="flex gap-2 pointer-events-auto">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); addToTimeline(asset); }}
                className="p-3 bg-white text-black rounded-xl shadow-3xl"
                title="Add to Chrono Matrix"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
              {opts.showDelete && (
                <button onClick={(e) => { e.stopPropagation(); showToast('Node Removed', 'info'); }} className="p-3 bg-rose-600 text-white rounded-xl shadow-3xl" title="Remove Node"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          </div>

          {asset.source === 'click' && (
            <span className="absolute top-4 left-6 px-4 py-1.5 rounded-full bg-indigo-600/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest italic border border-white/20">ELITE CORE</span>
          )}
        </div>
        <div className="p-6 space-y-2">
          <p className="text-sm font-black text-white italic truncate uppercase tracking-tighter">{asset.title || 'Untitled Node'}</p>
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full bg-${accent}-500 shadow-[0_0_8px_rgba(var(--${accent}-rgb),0.8)]`} />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{asset.type.replace('image', 'vision')}</p>
          </div>
          {asset.autoTags && asset.autoTags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {asset.autoTags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter bg-white/5 px-2 py-0.5 rounded-md">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-10 h-full flex flex-col max-w-[1400px] mx-auto py-4">
      <div className="flex flex-col xl:flex-row items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-[0.4em] italic text-indigo-400 shadow-xl">
            <Cpu className="w-4 h-4 animate-pulse" />
            Resource Repository
          </div>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">NEURAL<br />REPOSITORY</h2>
        </div>

        <div className="flex items-center gap-4 p-2 bg-white/[0.03] border border-white/10 rounded-[2.5rem] shadow-3xl">
          <button onClick={() => setTab('uploads')} className={`px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest italic transition-all ${tab === 'uploads' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-slate-500 hover:text-white'}`}>Identity Nodes</button>
          <button onClick={() => setTab('click')} className={`px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest italic transition-all ${tab === 'click' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-slate-500 hover:text-white'}`}>Elite Core Lib</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {(['all', 'music', 'images', 'broll', 'sfx'] as const).map(f => (
          <motion.button
            key={f}
            whileHover={{ scale: 1.05, y: -4 }}
            onClick={() => setFilter(f)}
            className={`p-6 rounded-[2.2rem] border transition-all text-center flex flex-col items-center gap-4 ${filter === f ? 'bg-white/[0.08] border-indigo-500 shadow-3xl' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
          >
            <div className={`p-4 rounded-2xl bg-white/5 ${filter === f ? 'text-indigo-400' : 'text-slate-700'}`}>
              {f === 'music' ? <Music className="w-6 h-6" /> : f === 'images' ? <ImageIcon className="w-6 h-6" /> : f === 'broll' ? <Film className="w-6 h-6" /> : f === 'sfx' ? <Zap className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest italic">{f === 'broll' ? 'Vision Flux' : f === 'sfx' ? 'Zap Node' : f}</span>
          </motion.button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-12 pr-4">
        {tab === 'uploads' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <input
              ref={fileInputMusic}
              type="file"
              className="hidden"
              accept="audio/*"
              title="Upload Music"
              placeholder="Upload Music File"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'music')}
            />
            <input
              ref={fileInputImages}
              type="file"
              className="hidden"
              accept="image/*"
              title="Upload Image"
              placeholder="Upload Image File"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')}
            />
            <input
              ref={fileInputBroll}
              type="file"
              className="hidden"
              accept="video/*"
              title="Upload Video"
              placeholder="Upload Video File"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'broll')}
            />
            <input
              ref={fileInputSfx}
              type="file"
              className="hidden"
              accept="audio/*"
              title="Upload SFX"
              placeholder="Upload SFX File"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'sfx')}
            />

            {[
              { label: 'Ingest Audio', icon: Music, color: 'emerald', ref: fileInputMusic },
              { label: 'Ingest Vision', icon: ImageIcon, color: 'indigo', ref: fileInputImages },
              { label: 'Ingest Flux', icon: Film, color: 'amber', ref: fileInputBroll },
              { label: 'Ingest Zaps', icon: Zap, color: 'orange', ref: fileInputSfx }
            ].map(zone => (
              <motion.div
                key={zone.label}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => !uploading && zone.ref.current?.click()}
                className={`p-10 rounded-[3rem] border-2 border-dashed border-white/10 hover:border-${zone.color}-500/50 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer flex flex-col items-center gap-6 group ${uploading ? 'opacity-50 cursor-wait' : ''}`}
              >
                <div className={`p-5 rounded-full bg-${zone.color}-500/10 group-hover:scale-110 transition-transform`}>
                  <zone.icon className={`w-8 h-8 text-${zone.color}-400`} />
                </div>
                <span className="text-xs font-black text-white italic uppercase tracking-widest text-center">{zone.label}</span>
              </motion.div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.4em] italic leading-none pl-4">Node Inventory</h3>
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {recent.length > 0 && recent.map(a => renderAssetCard(a))}
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
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-black/90 backdrop-blur-3xl"
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`${glassStyle} rounded-[4rem] p-16 max-w-4xl w-full shadow-3xl text-center space-y-10`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">{previewAsset.title}</h2>
                <button onClick={() => setPreviewAsset(null)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all" title="Close Preview"><X className="w-8 h-8" /></button>
              </div>

              <div className="aspect-video w-full rounded-[3rem] bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center">
                {(previewAsset.type === 'music' || previewAsset.type === 'sfx') ? (
                  <div className="p-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 animate-pulse-slow">
                    <Music className="w-24 h-24 text-indigo-400" />
                  </div>
                ) : (
                  <img src={previewAsset.url} alt={previewAsset.title || 'Preview Asset'} className="w-full h-full object-contain" title={previewAsset.title || 'Preview Asset'} />
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => addToTimeline(previewAsset)}
                className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-3xl shadow-indigo-600/40 uppercase tracking-[0.5em] italic flex items-center justify-center gap-6"
              >
                <Plus className="w-6 h-6" />
                LINK TO CHRONO MATRIX
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AssetLibraryView
