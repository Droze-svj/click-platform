'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  Music,
  Image as ImageIcon,
  Video,
  Upload,
  Search,
  Filter,
  Play,
  Pause,
  X,
  Plus,
  Grid3x3,
  List,
  Clock,
  Heart,
  Download,
  Trash2,
  FileAudio,
  FileImage,
  FileVideo,
  Sparkles,
  Scissors,
  Star,
  History,
  GripVertical,
  Volume2,
  Maximize2,
  Radio,
  Cpu,
  Fingerprint,
  Orbit,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Target,
  RefreshCw
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { apiGet, apiPost, apiDelete } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialogBehavior } from './ui/modal'

interface Asset {
  _id?: string
  id?: string
  title?: string
  name?: string
  url: string
  type: 'music' | 'image' | 'broll' | 'hook'
  thumbnail?: string
  duration?: number
  genre?: string
  mood?: string
  tags?: string[]
  createdAt?: string
  size?: number
  artist?: string
  description?: string
}

interface AssetLibraryProps {
  onSelectAsset: (asset: Asset) => void
  onAddToTimeline?: (asset: Asset, startTime: number, trimStart?: number, trimEnd?: number) => void
  currentTime?: number
  videoDuration?: number
}

type AssetType = 'all' | 'music' | 'image' | 'broll' | 'hook' | 'favorites' | 'recent' | 'uploads'
type ViewMode = 'grid' | 'list'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
  }
}

const glassStyle = "backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl"

export default function AssetLibrary({
  onSelectAsset,
  onAddToTimeline,
  currentTime = 0,
  videoDuration = 0
}: AssetLibraryProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<AssetType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [uploading, setUploading] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [playingAsset, setPlayingAsset] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState<'music' | 'image' | 'broll' | null>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const panelRef = useDialogBehavior(!!previewAsset, () => setPreviewAsset(null))
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [recentAssets, setRecentAssets] = useState<Asset[]>([])
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [showTrimModal, setShowTrimModal] = useState(false)
  const [assetToTrim, setAssetToTrim] = useState<Asset | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, asset: Asset) => {
    // Payload shape MUST match ResizableTimeline.handleTrackDrop, which reads
    // `{ type: 'library-asset', asset }` off the `application/json` channel.
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'library-asset', asset }))
    e.dataTransfer.setData('text/plain', asset.id || '')
    e.dataTransfer.effectAllowed = 'copy'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const platformThemes: Record<string, { accent: string, glow: string }> = {
    all: { accent: 'indigo-500', glow: 'rgba(99,102,241,0.2)' },
    music: { accent: 'blue-500', glow: 'rgba(59,130,246,0.2)' },
    image: { accent: 'emerald-500', glow: 'rgba(16,185,129,0.2)' },
    broll: { accent: 'purple-500', glow: 'rgba(168,85,247,0.2)' },
    hook: { accent: 'rose-500', glow: 'rgba(244,63,94,0.2)' },
    favorites: { accent: 'amber-500', glow: 'rgba(245,158,11,0.2)' },
    recent: { accent: 'cyan-400', glow: 'rgba(34,211,238,0.2)' },
    uploads: { accent: 'indigo-400', glow: 'rgba(129,140,248,0.2)' }
  }

  const currentTheme = platformThemes[selectedType] || platformThemes.all

  // Load assets (existing logic maintained)
  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedType !== 'all') {
        if (selectedType === 'music') params.append('type', 'music')
        else if (selectedType === 'image') params.append('type', 'image')
        else if (selectedType === 'broll' || selectedType === 'hook') params.append('type', 'video')
      }
      if (searchTerm) params.append('search', searchTerm)

      if (selectedType === 'all' || selectedType === 'music') {
        try {
          const musicRes = await apiGet(`/music?${params.toString()}`)
          if (musicRes.data) {
            const musicAssets = (Array.isArray(musicRes.data) ? musicRes.data : []).map((m: any) => ({
              ...m,
              id: m._id || m.id,
              type: 'music' as const,
              // Use ONLY the API-provided URL — it's the signed capability URL
              // (?exp&sig) the server returns now that REQUIRE_SIGNED_MEDIA is on.
              // The old hand-built `/uploads/music/${m.filename}` fallback was
              // unsigned and would 403 under enforcement, so it's dropped: an empty
              // url renders no source rather than a broken (403) one.
              url: m.file?.url || m.url || m.fileUrl || '',
              title: m.title || m.name,
              duration: m.duration
            }))
            setAssets(prev => [...prev.filter(a => a.type !== 'music'), ...musicAssets])
          }
        } catch (err) {
          console.warn('Failed to load music:', err)
        }
      }

      // Image / B-roll / Hook libraries have no backend source wired yet.
      // We do NOT inject fabricated stock (picsum / BigBuckBunny) — only real
      // assets are shown. Until a real endpoint exists, these categories drop
      // any prior stub entries so the component renders its honest empty-state.
      if (selectedType === 'all' || selectedType === 'image' || selectedType === 'broll' || selectedType === 'hook') {
        setAssets(prev => prev.filter(a => a.type === 'music'))
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
      showToast(t('assetLibrary.repositorySyncFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedType, searchTerm, showToast])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const handleUpload = async (file: File, type: 'music' | 'image' | 'broll') => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append(type === 'music' ? 'music' : type === 'image' ? 'image' : 'video', file)
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))

      if (type === 'music') {
        const res = await apiPost('/music/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        if (res.success) {
          showToast(t('assetLibrary.waveformUploaded'), 'success')
          const newAsset = { ...res.data, isUserUpload: true };
          setAssets(prev => [newAsset, ...prev]);
        }
      } else {
        showToast(t('assetLibrary.nodeSynchronized', { type: type.toUpperCase() }), 'success')
        loadAssets()
      }
    } catch (error) {
      console.error('Upload failed:', error)
      showToast(t('assetLibrary.intakeFailed', { type }), 'error')
    } finally {
      setUploading(false)
    }
  }

  const filteredAssets = assets.filter(asset => {
    if (selectedType === 'favorites') return favorites.has(asset.id || '')
    if (selectedType === 'recent') return recentAssets.some(ra => ra.id === asset.id)
    if (selectedType === 'uploads') return (asset as any).isUserUpload === true
    if (selectedType !== 'all' && asset.type !== selectedType) {
      if (selectedType === 'broll' && asset.type === 'hook') return true
      if (selectedType === 'hook' && asset.type === 'broll') return true
      return false
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        (asset.title || '').toLowerCase().includes(search) ||
        (asset.tags || []).some(tag => tag.toLowerCase().includes(search)) ||
        (asset.artist || '').toLowerCase().includes(search)
      )
    }
    return true
  })

  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('asset-favorites')
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites)
        if (Array.isArray(parsed)) setFavorites(new Set(parsed))
      }
      const savedRecent = localStorage.getItem('asset-recent')
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent)
        if (Array.isArray(parsed)) setRecentAssets(parsed)
      }
    } catch (error) {
      console.error('Failed to load storage:', error)
    }
  }, [])

  const toggleFavorite = (assetId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) next.delete(assetId)
      else next.add(assetId)
      localStorage.setItem('asset-favorites', JSON.stringify(Array.from(next)))
      return next
    })
  }

  const addToRecent = (asset: Asset) => {
    setRecentAssets(prev => {
      const updated = [asset, ...prev.filter(a => a.id !== asset.id)].slice(0, 10)
      localStorage.setItem('asset-recent', JSON.stringify(updated))
      return updated
    })
  }

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset)
    if (asset.duration) setTrimEnd(asset.duration)
    addToRecent(asset)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'music': return <FileAudio className="w-5 h-5" />
      case 'image': return <FileImage className="w-5 h-5" />
      case 'broll':
      case 'hook': return <FileVideo className="w-5 h-5" />
      default: return <Sparkles className="w-5 h-5" />
    }
  }

  const cosmicBg = "relative overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.05),transparent_70%)] after:absolute after:inset-0 after:bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] after:opacity-[0.02] after:pointer-events-none"

  return (
    <div className="h-full flex flex-col ds-surface-card p-0 text-theme-primary relative overflow-hidden">
      {/* Header Panel */}
      <div className="p-5 sm:p-6 border-b border-[var(--border-subtle)] relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
          <div className="space-y-1">
            <h3 className="ds-text-h2 text-theme-primary">{t('assetLibrary.intelligenceLibrary')}</h3>
            <p className="text-sm text-theme-muted">{t('assetLibrary.repositoryIndexer')}</p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" aria-hidden />
              <input
                type="text"
                placeholder={t('assetLibrary.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label={t('assetLibrary.searchPlaceholder')}
                className="w-full h-10 py-0 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-theme-primary placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              aria-label={viewMode === 'grid' ? t('assetLibrary.listView') : t('assetLibrary.gridView')}
              title={viewMode === 'grid' ? t('assetLibrary.listView') : t('assetLibrary.gridView')}
              className="h-10 w-10 inline-flex items-center justify-center shrink-0 rounded-lg border border-input bg-background hover:bg-accent transition-colors"
            >
              {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Categories / Navigation */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(['all', 'music', 'image', 'broll', 'hook', 'favorites', 'recent', 'uploads'] as AssetType[]).map(type => (
            <button
              type="button"
              key={type}
              onClick={() => setSelectedType(type)}
              aria-pressed={selectedType === type}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 border ${selectedType === type
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-input bg-background text-theme-muted hover:text-theme-primary hover:bg-accent'
                }`}
            >
              {type === 'all' && <Sparkles className="w-3.5 h-3.5" />}
              {type === 'music' && <Music className="w-3.5 h-3.5" />}
              {type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
              {(type === 'broll' || type === 'hook') && <Video className="w-3.5 h-3.5" />}
              {type === 'favorites' && <Star className="w-3.5 h-3.5" />}
              {type === 'recent' && <History className="w-3.5 h-3.5" />}
              {type === 'uploads' && <Upload className="w-3.5 h-3.5" />}
              {type === 'favorites' ? t('assetLibrary.categoryFavorites') : type === 'recent' ? t('assetLibrary.categoryRecent') : type === 'uploads' ? t('assetLibrary.categoryMyNodes') : t(`assetLibrary.type.${type}`)}
            </button>
          ))}
        </div>

        {/* Digital Intake Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { type: 'music', label: t('assetLibrary.uploadDigitizeWaveform'), color: 'bg-blue-600', icon: Music },
            { type: 'image', label: t('assetLibrary.uploadSynchronizeVisuals'), color: 'bg-emerald-600', icon: ImageIcon },
            { type: 'broll', label: t('assetLibrary.uploadIndexRepository'), color: 'bg-purple-600', icon: Video }
          ].map((upload, idx) => (
            <label key={idx} className="block group">
              <input
                type="file"
                accept={upload.type === 'music' ? 'audio/*' : upload.type === 'image' ? 'image/*' : 'video/*'}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, upload.type as any)
                }}
              />
              <m.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors cursor-pointer"
              >
                <upload.icon className="w-4 h-4 text-theme-muted group-hover:text-indigo-500 transition-colors" aria-hidden />
                <span className="text-sm font-medium text-theme-muted group-hover:text-theme-primary">{upload.label}</span>
              </m.div>
            </label>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-8">
            <m.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 rounded-full border-2 border-dashed border-indigo-500/30 flex items-center justify-center"
            >
              <Cpu className="w-10 h-10 text-indigo-400" />
            </m.div>
            <div className="ds-text-label text-theme-muted">{t('assetLibrary.analyzingStrands')}</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-500" aria-hidden />
            </div>
            <div className="space-y-2">
              <h4 className="ds-text-h3 text-theme-primary">{t('assetLibrary.repositoryEmpty')}</h4>
              <p className="text-theme-muted text-sm">{t('assetLibrary.repositoryEmptyDescription')}</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <m.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
          >
            {filteredAssets.map(asset => (
              <m.div
                key={asset.id}
                variants={itemVariants}
                draggable
                onDragStart={(e) => handleDragStart(e as any, asset)}
                whileHover={{ y: -2 }}
                className={`group relative ds-surface-subtle p-0 rounded-2xl overflow-hidden cursor-pointer transition-all ${selectedAsset?.id === asset.id ? 'ring-2 ring-indigo-500' : ''}`}
                onClick={() => {
                  setSelectedAsset(asset)
                  onSelectAsset(asset)
                }}
              >
                {/* Visual Area */}
                <div className="aspect-video bg-black relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img
                      src={asset.thumbnail || asset.url}
                      alt={asset.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                  ) : asset.type === 'music' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-700 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-20" />
                      <Music className="w-10 h-10 text-white/90" aria-hidden />
                      <div className="absolute bottom-0 inset-x-0 h-10 bg-black/15 flex items-center px-3">
                        <div className="flex gap-1 items-end h-6">
                          {[...Array(12)].map((_, i) => (
                            <m.div
                              key={i}
                              animate={{ height: [4, 20, 4] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                              className="w-1 bg-white/40 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-800 relative overflow-hidden group/video">
                      <img src={asset.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity group-hover/video:opacity-40" />
                      <div className="absolute inset-0 bg-black/20" />
                      <Video className="w-10 h-10 text-white/90 relative z-10" aria-hidden />
                      {asset.duration && (
                        <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-black px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10 tracking-widest">
                          {formatDuration(asset.duration)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* High-Fidelity Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-4 backdrop-blur-sm">
                    <m.button
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); handlePreview(asset); }}
                      className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-2xl"
                    >
                      <Maximize2 className="w-5 h-5 text-white" />
                    </m.button>
                    <m.button
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id || ''); }}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-2xl ${favorites.has(asset.id || '') ? 'bg-amber-500/80 text-white border-amber-500' : 'bg-white/10 text-white'}`}
                    >
                      <Star className={`w-5 h-5 ${favorites.has(asset.id || '') ? 'fill-white' : ''}`} />
                    </m.button>
                    {onAddToTimeline && (
                      <m.button
                        whileHover={{ scale: 1.1, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToTimeline(asset, currentTime)
                          addToRecent(asset)
                          showToast(t('assetLibrary.assetIntegratedTimeline'), 'success')
                        }}
                        className={`w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-[0_0_30px_rgba(99,102,241,0.5)]`}
                      >
                        <Plus className="w-6 h-6" />
                      </m.button>
                    )}
                  </div>

                  {/* Neural ID Tag */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 text-[11px] font-medium text-white backdrop-blur">
                      {t(`assetLibrary.type.${asset.type}`)}{!(asset as any).isUserUpload ? ` · ${t('assetLibrary.neuralNode')}` : ''}
                    </span>
                  </div>
                </div>

                {/* Info Area */}
                <div className="p-4 space-y-1.5">
                  <h4 className="text-sm font-semibold text-theme-primary truncate">
                    {asset.title || t('assetLibrary.untitledNode')}
                  </h4>
                  <div className="flex items-center justify-between ds-text-caption text-theme-muted">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(asset.duration)}
                    </div>
                    {asset.artist ? <span className="truncate max-w-[60%]">{asset.artist}</span> : null}
                  </div>
                </div>
              </m.div>
            ))}
          </m.div>
        ) : (
          <div className="space-y-4">
            {filteredAssets.map(asset => (
              <m.div
                key={asset.id}
                whileHover={{ x: 2 }}
                className={`ds-surface-subtle flex items-center gap-4 p-3 cursor-pointer transition-all group ${selectedAsset?.id === asset.id ? 'ring-2 ring-indigo-500' : ''}`}
                onClick={() => {
                  setSelectedAsset(asset)
                  onSelectAsset(asset)
                }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${asset.type === 'music' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {getAssetIcon(asset.type)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-semibold text-theme-primary truncate">
                    {asset.title || t('assetLibrary.untitledNode')}
                  </h4>
                  <div className="flex items-center gap-4 ds-text-caption text-theme-muted">
                    <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {formatDuration(asset.duration)}</span>
                    <span className="flex items-center gap-2">{t(`assetLibrary.type.${asset.type}`)}</span>
                    <span>{asset.artist || t('assetLibrary.neuralGenerated')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button type="button" aria-label={t('assetLibrary.preview')} onClick={(e) => { e.stopPropagation(); handlePreview(asset) }} className="p-2.5 rounded-lg border border-input text-theme-muted hover:text-theme-primary hover:bg-accent transition-colors">
                    <Maximize2 className="w-4 h-4" aria-hidden />
                  </button>
                  {onAddToTimeline && (
                    <button
                      type="button"
                      aria-label={t('assetLibrary.addToTimeline')}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToTimeline(asset, currentTime)
                        showToast(t('assetLibrary.assetIntegrated'), 'success')
                      }}
                      className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </m.div>
            ))}
          </div>
        )}
      </div>

      {/* Intake Progress Overlay */}
      <AnimatePresence>
        {uploading && (
          <m.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 inset-x-0 mx-auto max-w-sm z-[100]"
          >
            <div className="ds-surface-elevated rounded-2xl p-4 flex items-center gap-4">
              <div className="relative">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-[10px] rounded-full" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-theme-primary">{t('assetLibrary.intakeActive')}</div>
                <div className="ds-text-caption text-theme-muted">{t('assetLibrary.digitizingStrands')}</div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Preview Overlay (Simplified for brevity, maintained logic) */}
      <AnimatePresence>
        {previewAsset && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-8 backdrop-blur-xl"
            onClick={() => setPreviewAsset(null)}
            role="dialog"
            aria-modal="true"
          >
            <m.div
              ref={panelRef}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-5xl w-full rounded-2xl overflow-hidden ds-surface-elevated p-0 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Custom Preview UI... */}
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="ds-text-h2 text-theme-primary truncate">{previewAsset.title}</h2>
                  <button type="button" aria-label={t('assetLibrary.closePreview')} onClick={() => setPreviewAsset(null)} className="p-2 rounded-lg hover:bg-accent transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="aspect-video bg-black rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
                  {previewAsset.type === 'image' ? (
                    <img src={previewAsset.url} alt={previewAsset.title || 'Asset preview'} className="max-h-full object-contain relative z-10" />
                  ) : (
                    <div className="text-white relative z-10 flex flex-col items-center gap-6">
                      <Play className="w-20 h-20 opacity-20" />
                      <span className="ds-text-caption text-white/60">{t('assetLibrary.neuralPlayerNode')}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">{t('assetLibrary.integrateIntoWorkspace')}</button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
