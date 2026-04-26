'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
    e.dataTransfer.setData('application/json', JSON.stringify(asset))
    e.dataTransfer.setData('text/plain', asset.id || '')
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
              url: m.url || m.fileUrl || `/uploads/music/${m.filename}`,
              title: m.title || m.name,
              duration: m.duration
            }))
            setAssets(prev => [...prev.filter(a => a.type !== 'music'), ...musicAssets])
          }
        } catch (err) {
          console.warn('Failed to load music:', err)
        }
      }

      if (selectedType === 'all' || selectedType === 'image' || selectedType === 'broll' || selectedType === 'hook') {
        const mockAssets: Asset[] = []
        if (selectedType === 'all' || selectedType === 'image') {
          for (let i = 1; i <= 12; i++) {
            mockAssets.push({
              id: `image-${i}`,
              type: 'image',
              url: `https://picsum.photos/400/300?random=${i}`,
              title: `Neural Visualization ${i}`,
              tags: ['neural', 'cosmic', 'asset'],
              thumbnail: `https://picsum.photos/200/150?random=${i}`
            })
          }
        }
        if (selectedType === 'all' || selectedType === 'broll' || selectedType === 'hook') {
          for (let i = 1; i <= 8; i++) {
            mockAssets.push({
              id: `broll-${i}`,
              type: i % 2 === 0 ? 'broll' : 'hook',
              url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
              title: `${i % 2 === 0 ? 'B-Roll' : 'Hook-Node'} ${i}`,
              duration: 10 + Math.random() * 20,
              tags: [i % 2 === 0 ? 'broll' : 'hook', 'video'],
              thumbnail: `https://picsum.photos/400/300?random=${i + 20}`
            })
          }
        }
        setAssets(prev => {
          const existing = prev.filter(a =>
            (selectedType === 'all' || selectedType === 'image') && a.type === 'image' ||
            (selectedType === 'all' || selectedType === 'broll' || selectedType === 'hook') && (a.type === 'broll' || a.type === 'hook')
          )
          return [...existing, ...mockAssets]
        })
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
      showToast('Neural repository sync failed', 'error')
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
          showToast('Waveform digitized and uploaded', 'success')
          const newAsset = { ...res.data, isUserUpload: true };
          setAssets(prev => [newAsset, ...prev]);
        }
      } else {
        showToast(`${type.toUpperCase()} node successfully synchronized`, 'success')
        loadAssets()
      }
    } catch (error) {
      console.error('Upload failed:', error)
      showToast(`Neural intake failed for ${type}`, 'error')
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
    <div className={`h-full flex flex-col bg-[#020202] text-slate-200 selection:bg-indigo-500/30 relative overflow-hidden`}>
      {/* Reactive Nebula */}
      <motion.div
        animate={{
          x: mousePos.x / 80,
          y: mousePos.y / 80,
        }}
        className="fixed inset-0 pointer-events-none opacity-30 mix-blend-screen z-0"
      >
        <div className={`absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-${currentTheme.accent}/10 blur-[130px] rounded-full animate-pulse`} />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-600/5 blur-[160px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </motion.div>

      {/* Header Panel */}
      <div className={`p-8 border-b border-white/5 relative z-10 ${glassStyle} border-none`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
          <div className="space-y-4">
            <div className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-${currentTheme.accent}/10 border border-${currentTheme.accent}/20 text-${currentTheme.accent} text-[9px] font-black uppercase tracking-[0.4em]`}>
              <Orbit className="w-3.5 h-3.5 animate-spin-slow" />
              Repository Indexer
            </div>
            <h3 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-4">
              Intelligence Library
            </h3>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80 group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Analyze repository..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all font-medium text-sm"
              />
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-3.5 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] rounded-2xl transition-all"
            >
              {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3x3 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Categories / Navigation */}
        <div className="flex flex-wrap gap-3 mb-8">
          {(['all', 'music', 'image', 'broll', 'hook', 'favorites', 'recent', 'uploads'] as AssetType[]).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3 border shadow-2xl ${selectedType === type
                ? `bg-${platformThemes[type].accent} border-white/20 text-white shadow-${platformThemes[type].accent}/20 scale-105 -translate-y-0.5`
                : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
            >
              {type === 'all' && <Sparkles className="w-3.5 h-3.5" />}
              {type === 'music' && <Music className="w-3.5 h-3.5" />}
              {type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
              {(type === 'broll' || type === 'hook') && <Video className="w-3.5 h-3.5" />}
              {type === 'favorites' && <Star className="w-3.5 h-3.5" />}
              {type === 'recent' && <History className="w-3.5 h-3.5" />}
              {type === 'uploads' && <Upload className="w-3.5 h-3.5" />}
              {type === 'favorites' ? 'Favorites' : type === 'recent' ? 'Recent' : type === 'uploads' ? 'My Nodes' : type}
            </button>
          ))}
        </div>

        {/* Digital Intake Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { type: 'music', label: 'DIGITIZE WAVEFORM', color: 'bg-blue-600', icon: Music },
            { type: 'image', label: 'SYNCHRONIZE VISUALS', color: 'bg-emerald-600', icon: ImageIcon },
            { type: 'broll', label: 'INDEX REPOSITORY', color: 'bg-purple-600', icon: Video }
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
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center justify-center gap-4 px-6 py-4 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer relative overflow-hidden shadow-inner`}
              >
                <upload.icon className={`w-5 h-5 text-slate-500 group-hover:text-white transition-colors`} />
                <span className="text-[10px] font-black text-slate-500 group-hover:text-white uppercase tracking-[0.3em]">{upload.label}</span>
              </motion.div>
            </label>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-10 relative z-10 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 rounded-full border-2 border-dashed border-indigo-500/30 flex items-center justify-center"
            >
              <Cpu className="w-10 h-10 text-indigo-400" />
            </motion.div>
            <div className={`text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] animate-pulse`}>Analyzing Neural Strands...</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-slate-700" />
            </div>
            <div className="space-y-2">
              <h4 className="text-2xl font-black text-white italic tracking-tight">Repository Empty</h4>
              <p className="text-slate-500 text-sm font-medium">Synchronize new neural nodes to populate your library.</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8"
          >
            {filteredAssets.map(asset => (
              <motion.div
                key={asset.id}
                variants={itemVariants}
                draggable
                onDragStart={(e) => handleDragStart(e as any, asset)}
                whileHover={{ y: -10, scale: 1.02 }}
                className={`group relative ${glassStyle} rounded-[2rem] overflow-hidden cursor-pointer transition-all border-white/5 hover:border-white/20 hover:shadow-indigo-500/10 ${selectedAsset?.id === asset.id ? 'ring-2 ring-indigo-500 border-transparent shadow-[0_0_40px_rgba(99,102,241,0.2)]' : ''}`}
                onClick={() => {
                  setSelectedAsset(asset)
                  onSelectAsset(asset)
                }}
              >
                {/* Visual Area */}
                <div className="aspect-[4/3] bg-black relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img
                      src={asset.thumbnail || asset.url}
                      alt={asset.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                  ) : asset.type === 'music' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-700 relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E')] opacity-20" />
                      <Music className="w-16 h-16 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]" />
                      <div className="absolute bottom-0 inset-x-0 h-16 bg-white/10 backdrop-blur-md flex items-center px-4">
                        <div className="flex gap-1 items-end h-8">
                          {[...Array(12)].map((_, i) => (
                            <motion.div
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
                      <img src={asset.thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity group-hover/video:opacity-40" />
                      <div className="absolute inset-0 bg-black/20" />
                      <Video className="w-16 h-16 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] relative z-10" />
                      {asset.duration && (
                        <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-black px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10 tracking-widest">
                          {formatDuration(asset.duration)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* High-Fidelity Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-4 backdrop-blur-sm">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); handlePreview(asset); }}
                      className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-2xl"
                    >
                      <Maximize2 className="w-5 h-5 text-white" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id || ''); }}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-2xl ${favorites.has(asset.id || '') ? 'bg-amber-500/80 text-white border-amber-500' : 'bg-white/10 text-white'}`}
                    >
                      <Star className={`w-5 h-5 ${favorites.has(asset.id || '') ? 'fill-white' : ''}`} />
                    </motion.button>
                    {onAddToTimeline && (
                      <motion.button
                        whileHover={{ scale: 1.1, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToTimeline(asset, currentTime)
                          addToRecent(asset)
                          showToast('Asset integrated into timeline', 'success')
                        }}
                        className={`w-12 h-12 bg-indigo-600 hover:bg-indigo-500 rounded-2xl flex items-center justify-center text-white border border-white/20 transition-all shadow-[0_0_30px_rgba(99,102,241,0.5)]`}
                      >
                        <Plus className="w-6 h-6" />
                      </motion.button>
                    )}
                  </div>

                  {/* Neural ID Tag */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <div className={`px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/10 flex items-center gap-2.5 backdrop-blur-xl shadow-2xl`}>
                      <div className={`w-1.5 h-1.5 rounded-full bg-${platformThemes[asset.type]?.accent || 'white'} animate-pulse`} />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">{asset.type}</span>
                    </div>
                    {!(asset as any).isUserUpload && (
                      <div className="bg-indigo-600/90 text-[8px] font-black text-white px-2 py-1 rounded-lg uppercase tracking-tighter shadow-lg backdrop-blur-md self-start border border-white/10">
                        NEURAL NODE
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Area */}
                <div className="p-6 space-y-3">
                  <h4 className="text-lg font-black text-white tracking-tight italic truncate group-hover:text-indigo-400 transition-colors">
                    {asset.title || 'UNTITLED NODE'}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(asset.duration)}
                    </div>
                    <div className="flex items-center gap-2 group-hover:text-slate-300 transition-colors">
                      <Fingerprint className="w-3.5 h-3.5" />
                      ID: {asset.id?.slice(-4)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="space-y-4">
            {filteredAssets.map(asset => (
              <motion.div
                key={asset.id}
                whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}
                className={`flex items-center gap-8 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 cursor-pointer transition-all group ${selectedAsset?.id === asset.id ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`}
                onClick={() => {
                  setSelectedAsset(asset)
                  onSelectAsset(asset)
                }}
              >
                <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center flex-shrink-0 transition-all duration-700 ${asset.type === 'music' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {getAssetIcon(asset.type)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-2xl font-black text-white italic tracking-tight group-hover:text-indigo-400 transition-colors">
                    {asset.title || 'UNTITLED NODE'}
                  </h4>
                  <div className="flex items-center gap-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {formatDuration(asset.duration)}</span>
                    <span className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5" /> {asset.type}</span>
                    <span className="opacity-40">{asset.artist || 'NEURAL GENERATED'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  {onAddToTimeline && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToTimeline(asset, currentTime)
                        showToast('Asset integrated', 'success')
                      }}
                      className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-xl shadow-indigo-500/20 hover:scale-110 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Intake Progress Overlay */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-10 inset-x-0 mx-auto max-w-sm z-[100]"
          >
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(99,102,241,0.3)] flex items-center gap-6">
              <div className="relative">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-[10px] rounded-full" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-black text-white uppercase tracking-widest leading-none">Neural Intake Active</div>
                <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Digitizing Repository Strands...</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Overlay (Simplified for brevity, maintained logic) */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-8 backdrop-blur-xl"
            onClick={() => setPreviewAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`max-w-5xl w-full rounded-[4rem] overflow-hidden ${glassStyle} border-white/5 relative`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Custom Preview UI... */}
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter">{previewAsset.title}</h2>
                  <button onClick={() => setPreviewAsset(null)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><X className="w-6 h-6" /></button>
                </div>
                <div className="aspect-video bg-black/50 rounded-[3rem] border border-white/5 flex items-center justify-center relative overflow-hidden shadow-inner">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
                  {previewAsset.type === 'image' ? (
                    <img src={previewAsset.url} className="max-h-full object-contain relative z-10" />
                  ) : (
                    <div className="text-white relative z-10 flex flex-col items-center gap-6">
                      <Play className="w-20 h-20 opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">Neural Player Node</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-6 pt-4">
                  <button className="px-10 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs shadow-3xl shadow-indigo-600/30 border border-white/10">Integrate Into Workspace</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
