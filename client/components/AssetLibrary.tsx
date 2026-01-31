'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Maximize2
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

  // Load assets
  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedType !== 'all') {
        if (selectedType === 'music') {
          params.append('type', 'music')
        } else if (selectedType === 'image') {
          params.append('type', 'image')
        } else if (selectedType === 'broll' || selectedType === 'hook') {
          params.append('type', 'video')
        }
      }
      if (searchTerm) {
        params.append('search', searchTerm)
      }

      // Load music
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

      // For images and B-rolls, we'll use mock data for now
      // In production, these would come from an assets API
      if (selectedType === 'all' || selectedType === 'image' || selectedType === 'broll' || selectedType === 'hook') {
        const mockAssets: Asset[] = []

        if (selectedType === 'all' || selectedType === 'image') {
          // Mock image assets
          for (let i = 1; i <= 12; i++) {
            mockAssets.push({
              id: `image-${i}`,
              type: 'image',
              url: `https://picsum.photos/400/300?random=${i}`,
              title: `Stock Image ${i}`,
              tags: ['stock', 'photo', 'image'],
              thumbnail: `https://picsum.photos/200/150?random=${i}`
            })
          }
        }

        if (selectedType === 'all' || selectedType === 'broll' || selectedType === 'hook') {
          // Mock B-roll/hook assets
          for (let i = 1; i <= 8; i++) {
            mockAssets.push({
              id: `broll-${i}`,
              type: i % 2 === 0 ? 'broll' : 'hook',
              url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
              title: `${i % 2 === 0 ? 'B-Roll' : 'Hook'} Clip ${i}`,
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
      showToast('Failed to load assets', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedType, searchTerm, showToast])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  // Handle file upload
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
          showToast('Music uploaded successfully!', 'success')
          // Mark as user upload in local state after successful server response
          const newAsset = { ...res.data, isUserUpload: true };
          setAssets(prev => [newAsset, ...prev]);
        }
      } else {
        // For images and B-rolls, use a generic upload endpoint
        showToast(`${type === 'image' ? 'Image' : 'B-Roll'} uploaded successfully!`, 'success')
        loadAssets()
      }
    } catch (error) {
      console.error('Upload failed:', error)
      showToast(`Failed to upload ${type}`, 'error')
    } finally {
      setUploading(false)
      setUploadType(null)
    }
  }

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    // Handle favorites, recent, and uploads filters
    if (selectedType === 'favorites') {
      return favorites.has(asset.id || '')
    }
    if (selectedType === 'recent') {
      return recentAssets.some(ra => ra.id === asset.id)
    }
    if (selectedType === 'uploads') {
      return (asset as any).isUserUpload === true
    }

    if (selectedType !== 'all' && asset.type !== selectedType) {
      if (selectedType === 'broll' && asset.type === 'hook') return true
      if (selectedType === 'hook' && asset.type === 'broll') return true
      return false
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        (asset.title || '').toLowerCase().includes(search) ||
        (asset.description || '').toLowerCase().includes(search) ||
        (asset.tags || []).some(tag => tag.toLowerCase().includes(search)) ||
        (asset.artist || '').toLowerCase().includes(search)
      )
    }
    return true
  })

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Load favorites and recent from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('asset-favorites')
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites)
        if (Array.isArray(parsed)) {
          setFavorites(new Set(parsed))
        }
      }
    } catch (error) {
      console.error('Failed to load favorites:', error)
    }

    try {
      const savedRecent = localStorage.getItem('asset-recent')
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent)
        if (Array.isArray(parsed)) {
          setRecentAssets(parsed)
        }
      }
    } catch (error) {
      console.error('Failed to load recent assets:', error)
    }
  }, [])

  // Save favorites
  const toggleFavorite = (assetId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(assetId)) {
        next.delete(assetId)
      } else {
        next.add(assetId)
      }
      try {
        localStorage.setItem('asset-favorites', JSON.stringify(Array.from(next)))
      } catch (error) {
        console.error('Failed to save favorites:', error)
      }
      return next
    })
  }

  // Add to recent
  const addToRecent = (asset: Asset) => {
    setRecentAssets(prev => {
      const updated = [asset, ...prev.filter(a => a.id !== asset.id)].slice(0, 10)
      try {
        localStorage.setItem('asset-recent', JSON.stringify(updated))
      } catch (error) {
        console.error('Failed to save recent assets:', error)
      }
      return updated
    })
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'asset',
      asset: asset
    }))
    e.dataTransfer.setData('text/plain', asset.url)
  }

  // Preview asset
  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset)
    if (asset.duration) {
      setTrimEnd(asset.duration)
    }
    addToRecent(asset)
  }

  // Handle add with trim
  const handleAddWithTrim = () => {
    if (assetToTrim && onAddToTimeline) {
      onAddToTimeline(assetToTrim, currentTime, trimStart, trimEnd)
      showToast('Asset added to timeline with trim', 'success')
      setShowTrimModal(false)
      setAssetToTrim(null)
    }
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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Asset Library
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={viewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all', 'music', 'image', 'broll', 'hook', 'favorites', 'recent', 'uploads'] as AssetType[]).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${selectedType === type
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
            >
              {type === 'all' && <Sparkles className="w-3.5 h-3.5" />}
              {type === 'music' && <Music className="w-3.5 h-3.5" />}
              {type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
              {(type === 'broll' || type === 'hook') && <Video className="w-3.5 h-3.5" />}
              {type === 'favorites' && <Star className="w-3.5 h-3.5" />}
              {type === 'recent' && <History className="w-3.5 h-3.5" />}
              {type === 'uploads' && <Upload className="w-3.5 h-3.5" />}
              {type === 'favorites' ? 'Favorites' : type === 'recent' ? 'Recent' : type === 'uploads' ? 'My Uploads' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Upload Buttons */}
        <div className="flex gap-2">
          <label className="flex-1">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, 'music')
              }}
            />
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
              <Upload className="w-4 h-4" />
              Music
            </div>
          </label>
          <label className="flex-1">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, 'image')
              }}
            />
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
              <Upload className="w-4 h-4" />
              Image
            </div>
          </label>
          <label className="flex-1">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file, 'broll')
              }}
            />
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg cursor-pointer transition-colors text-sm font-medium">
              <Upload className="w-4 h-4" />
              B-Roll
            </div>
          </label>
        </div>
      </div>

      {/* Assets Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No assets found</p>
            <p className="text-sm mt-1">Upload assets to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredAssets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  try {
                    handleDragStart(e, asset)
                  } catch (error) {
                    console.error('Drag start error:', error)
                  }
                }}
                className={`group relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer transition-all hover:shadow-lg ${selectedAsset?.id === asset.id ? 'ring-2 ring-purple-500' : ''
                  }`}
                onClick={() => {
                  try {
                    setSelectedAsset(asset)
                    onSelectAsset(asset)
                  } catch (error) {
                    console.error('Asset selection error:', error)
                  }
                }}
              >
                {/* Thumbnail/Preview */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img
                      src={asset.thumbnail || asset.url}
                      alt={asset.title || 'Asset'}
                      className="w-full h-full object-cover"
                    />
                  ) : asset.type === 'music' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500">
                      <Music className="w-12 h-12 text-white opacity-80" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-500 to-teal-500 relative">
                      <Video className="w-12 h-12 text-white opacity-80" />
                      {asset.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                          {formatDuration(asset.duration)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePreview(asset)
                      }}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-colors"
                      title="Preview"
                    >
                      <Maximize2 className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(asset.id || '')
                      }}
                      className={`p-2 rounded-full backdrop-blur-sm transition-colors ${favorites.has(asset.id || '')
                        ? 'bg-yellow-500/80 hover:bg-yellow-500'
                        : 'bg-white/20 hover:bg-white/30'
                        }`}
                      title="Favorite"
                    >
                      <Star className={`w-4 h-4 ${favorites.has(asset.id || '') ? 'text-white fill-white' : 'text-white'}`} />
                    </button>
                    {onAddToTimeline && (asset.type === 'music' || asset.type === 'broll' || asset.type === 'hook') && asset.duration ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssetToTrim(asset)
                          setTrimStart(0)
                          setTrimEnd(asset.duration || 0)
                          setShowTrimModal(true)
                        }}
                        className="p-2 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors"
                        title="Add with trim"
                      >
                        <Scissors className="w-4 h-4 text-white" />
                      </button>
                    ) : onAddToTimeline ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToTimeline(asset, currentTime)
                          addToRecent(asset)
                          showToast('Added to timeline', 'success')
                        }}
                        className="p-2 bg-purple-500 hover:bg-purple-600 rounded-full transition-colors"
                        title="Add to timeline"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    ) : null}
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <div className="bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1 backdrop-blur-md">
                      {getAssetIcon(asset.type)}
                      <span className="capitalize">{asset.type}</span>
                    </div>
                    {!(asset as any).isUserUpload && (
                      <div className="bg-purple-600/90 text-white text-[10px] px-2 py-0.5 rounded font-black tracking-tighter uppercase backdrop-blur-md self-start">
                        CLICK LIB
                      </div>
                    )}
                  </div>
                </div>

                {/* Asset Info */}
                <div className="p-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {asset.title || asset.name || 'Untitled'}
                  </h4>
                  {asset.artist && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{asset.artist}</p>
                  )}
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {asset.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(asset.duration)}
                      </span>
                    )}
                    {asset.size && <span>{formatSize(asset.size)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(selectedType === 'favorites'
              ? assets.filter(a => favorites.has(a.id || ''))
              : selectedType === 'recent'
                ? recentAssets
                : filteredAssets).map(asset => (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer transition-all hover:bg-gray-200 dark:hover:bg-gray-700 ${selectedAsset?.id === asset.id ? 'ring-2 ring-purple-500' : ''
                      }`}
                    onClick={() => {
                      setSelectedAsset(asset)
                      onSelectAsset(asset)
                    }}
                  >
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                      {getAssetIcon(asset.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {asset.title || asset.name || 'Untitled'}
                      </h4>
                      {asset.artist && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{asset.artist}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {asset.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(asset.duration)}
                          </span>
                        )}
                        {asset.size && <span>{formatSize(asset.size)}</span>}
                        {asset.genre && <span>{asset.genre}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onAddToTimeline && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddToTimeline(asset, currentTime)
                            showToast('Added to timeline', 'success')
                          }}
                          className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                          title="Add to timeline"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            Uploading...
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preview: {previewAsset.title || previewAsset.name || 'Asset'}
              </h3>
              <button
                onClick={() => setPreviewAsset(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {previewAsset.type === 'image' ? (
                <img
                  src={previewAsset.url}
                  alt={previewAsset.title || 'Preview'}
                  className="w-full h-auto rounded-lg"
                />
              ) : previewAsset.type === 'music' ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg p-8 flex items-center justify-center">
                    <Music className="w-24 h-24 text-white opacity-80" />
                  </div>
                  <audio
                    ref={previewAudioRef}
                    src={previewAsset.url}
                    controls
                    className="w-full"
                    onLoadedMetadata={() => {
                      if (previewAudioRef.current) {
                        setTrimEnd(previewAudioRef.current.duration)
                      }
                    }}
                  />
                </div>
              ) : (
                <video
                  ref={previewVideoRef}
                  src={previewAsset.url}
                  controls
                  className="w-full rounded-lg"
                  onLoadedMetadata={() => {
                    if (previewVideoRef.current) {
                      setTrimEnd(previewVideoRef.current.duration)
                    }
                  }}
                />
              )}
              <div className="mt-4 flex items-center gap-4">
                {onAddToTimeline && (
                  <button
                    onClick={() => {
                      if (previewAsset.duration && (previewAsset.type === 'music' || previewAsset.type === 'broll' || previewAsset.type === 'hook')) {
                        setAssetToTrim(previewAsset)
                        setTrimStart(0)
                        setTrimEnd(previewAsset.duration)
                        setShowTrimModal(true)
                        setPreviewAsset(null)
                      } else {
                        onAddToTimeline(previewAsset, currentTime)
                        addToRecent(previewAsset)
                        showToast('Added to timeline', 'success')
                        setPreviewAsset(null)
                      }
                    }}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Add to Timeline
                  </button>
                )}
                <button
                  onClick={() => toggleFavorite(previewAsset.id || '')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${favorites.has(previewAsset.id || '')
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                >
                  <Star className={`w-4 h-4 ${favorites.has(previewAsset.id || '') ? 'fill-white' : ''}`} />
                  {favorites.has(previewAsset.id || '') ? 'Favorited' : 'Favorite'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trim Modal */}
      {showTrimModal && assetToTrim && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowTrimModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Trim {assetToTrim.type === 'music' ? 'Audio' : 'Video'}
              </h3>
              <button
                onClick={() => {
                  setShowTrimModal(false)
                  setAssetToTrim(null)
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {assetToTrim.type === 'music' ? (
                <audio
                  src={assetToTrim.url}
                  controls
                  className="w-full"
                />
              ) : (
                <video
                  src={assetToTrim.url}
                  controls
                  className="w-full rounded-lg"
                />
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Start Time</span>
                  <span className="font-mono text-gray-900 dark:text-white">{formatDuration(trimStart)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={assetToTrim.duration || 0}
                  step="0.1"
                  value={trimStart}
                  onChange={(e) => {
                    const newStart = parseFloat(e.target.value)
                    if (newStart < trimEnd) {
                      setTrimStart(newStart)
                    }
                  }}
                  className="w-full accent-purple-500"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">End Time</span>
                  <span className="font-mono text-gray-900 dark:text-white">{formatDuration(trimEnd)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={assetToTrim.duration || 0}
                  step="0.1"
                  value={trimEnd}
                  onChange={(e) => {
                    const newEnd = parseFloat(e.target.value)
                    if (newEnd > trimStart) {
                      setTrimEnd(newEnd)
                    }
                  }}
                  className="w-full accent-purple-500"
                />
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Duration: {formatDuration(trimEnd - trimStart)}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAddWithTrim}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  Add to Timeline
                </button>
                <button
                  onClick={() => {
                    setShowTrimModal(false)
                    setAssetToTrim(null)
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
