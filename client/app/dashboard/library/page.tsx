'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import {
  Folder, Search,
  Plus, Tag, Star, X, ArrowLeft,
  Trash2, Download, Layers,
  Boxes, RefreshCw, FolderPlus,
  Activity, Video, ChevronRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'
import { API_URL } from '../../../lib/api'
import { StatsCardSkeleton, CardSkeleton } from '@/components/LoadingSkeleton'

interface Content {
  _id: string; title: string; type: string; status: string;
  folderId?: { _id: string; name: string; color: string; };
  tags: string[]; category: string; isFavorite: boolean; createdAt: string;
}

interface FolderType {
  _id: string; name: string; color: string; description?: string;
}

export default function LibraryPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [content, setContent] = useState<Content[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectMode, setSelectMode] = useState(false)
  
  const [tagModalIds, setTagModalIds] = useState<string[] | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [moveModalIds, setMoveModalIds] = useState<string[] | null>(null)
  const [moveFolderId, setMoveFolderId] = useState('')
  const [exportModalIds, setExportModalIds] = useState<string[] | null>(null)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [busy, setBusy] = useState(false)

  const loadLibrary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (selectedFolder) params.append('folderId', selectedFolder)
      if (selectedTag) params.append('tag', selectedTag)
      if (selectedCategory) params.append('category', selectedCategory)
      if (showFavorites) params.append('isFavorite', 'true')
      if (searchQuery) params.append('search', searchQuery)

      const [contentRes, foldersRes, tagsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_URL}/library/content?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/library/folders`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/library/tags`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/library/categories`, { headers: { Authorization: `Bearer ${token}` } })
      ])

      if (contentRes.data.success) setContent(contentRes.data.data.content || [])
      if (foldersRes.data.success) setFolders(foldersRes.data.data || [])
      if (tagsRes.data.success) setTags(tagsRes.data.data || [])
      if (categoriesRes.data.success) setCategories(categoriesRes.data.data || [])
    } catch (error) {
      showToast(t('libraryPage.errorSyncing'), 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedFolder, selectedTag, selectedCategory, showFavorites, searchQuery, showToast, t])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadLibrary()
  }, [user, router, loadLibrary])

  const handleTagInjection = async () => {
    if (!tagModalIds?.length || !tagInput.trim()) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/batch/tag`, { contentIds: tagModalIds, tags: [tagInput.trim()], action: 'add' }, { headers: { Authorization: `Bearer ${token}` } })
      showToast(t('libraryPage.tagsApplied'), 'success')
      setTagModalIds(null); setTagInput(''); loadLibrary()
    } catch { showToast(t('libraryPage.errorApplyingTags'), 'error') }
    finally { setBusy(false) }
  }

  const handleLatticeTransfer = async () => {
    if (!moveModalIds?.length) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      const folderId = moveFolderId === 'none' || !moveFolderId ? null : moveFolderId
      await axios.post(`${API_URL}/batch/update`, { contentIds: moveModalIds, updates: { folderId } }, { headers: { Authorization: `Bearer ${token}` } })
      showToast(t('libraryPage.assetsMoved'), 'success')
      setMoveModalIds(null); setMoveFolderId(''); loadLibrary()
    } catch { showToast(t('libraryPage.errorMovingAssets'), 'error') }
    finally { setBusy(false) }
  }

  const handleExtraction = async () => {
    if (!exportModalIds?.length) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(`${API_URL}/library/export`, { assetIds: exportModalIds, format: exportFormat }, { headers: { Authorization: `Bearer ${token}` }, responseType: exportFormat === 'csv' ? 'blob' : 'json' })
      const blob = exportFormat === 'csv' ? new Blob([res.data], { type: 'text/csv' }) : new Blob([JSON.stringify(res.data?.data || res.data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `click-export-${Date.now()}.${exportFormat}`; a.click()
      window.URL.revokeObjectURL(url)
      showToast(t('libraryPage.exportSuccessful'), 'success')
      setExportModalIds(null)
    } catch { showToast(t('libraryPage.exportFailed'), 'error') }
    finally { setBusy(false) }
  }

  const handleInitCapsule = async () => {
    if (!newFolderName.trim()) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/library/folders`, { name: newFolderName }, { headers: { Authorization: `Bearer ${token}` } })
      showToast(t('libraryPage.folderCreated'), 'success')
      setShowCreateFolder(false); setNewFolderName(''); await loadLibrary()
    } catch { showToast(t('libraryPage.errorCreatingFolder'), 'error') }
  }

  const handleToggleFavorite = async (contentId: string, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/library/content/${contentId}/organize`, { isFavorite: !currentValue }, { headers: { Authorization: `Bearer ${token}` } })
      await loadLibrary()
      showToast(!currentValue ? t('libraryPage.addedToFavorites') : t('libraryPage.removedFromFavorites'), 'success')
    } catch { showToast(t('libraryPage.errorUpdatingFavorite'), 'error') }
  }

  if (loading) return (
     <div className="min-h-screen bg-surface-50 dark:bg-surface-950 transition-colors duration-500 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-8" aria-busy="true" aria-label={t('libraryPage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-4 sm:px-6 lg:px-12 pt-8 max-w-[1900px] mx-auto space-y-8 bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-50 transition-colors duration-500">
        <ToastContainer />

        {/* ── Header ── */}
        <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6 pb-6 border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => router.push('/dashboard')} title={t('libraryPage.backToDashboard')} aria-label={t('libraryPage.backToDashboard')} className="w-12 h-12 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors shadow-sm">
              <ArrowLeft size={20} />
            </button>
            <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/40 border border-primary-200 dark:border-primary-800 flex items-center justify-center shadow-sm">
              <Boxes size={32} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 uppercase tracking-wide border border-primary-200 dark:border-primary-800">
                  {t('libraryPage.assetLibraryBadge')}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  <Activity size={12} /> {t('libraryPage.syncActive')}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none mt-2">
                {t('libraryPage.title')}
              </h1>
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400 mt-2 max-w-xl">
                {t('libraryPage.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            <button onClick={() => setSelectMode(!selectMode)}
              className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border shadow-sm ${
                selectMode ? 'bg-primary-600 text-white border-primary-500' : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {selectMode ? t('libraryPage.doneSelecting') : t('libraryPage.batchSelect')}
            </button>
            <button onClick={() => setShowCreateFolder(true)}
              className="px-6 py-3 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-surface-800 dark:hover:bg-surface-100 transition-all flex items-center gap-2">
              <Plus size={16} /> {t('libraryPage.newFolder')}
            </button>
          </div>
        </header>

        {/* ── Main Layout Grid ── */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
          
          {/* Sidebar / Filters */}
          <aside className="lg:col-span-1 space-y-6">
             <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6 space-y-8">
                
                {/* Search */}
                <div className="relative">
                   <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search size={18} className="text-surface-400" />
                   </div>
                   <input type="text" placeholder={t('libraryPage.searchAssetsPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all" 
                   />
                </div>

                {/* Folders */}
                <div className="space-y-3">
                   <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                      <Folder size={14} /> {t('libraryPage.folders')}
                   </h3>
                   <div className="space-y-1">
                     <button onClick={() => setSelectedFolder(null)}
                       className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${selectedFolder === null ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                     >
                       {t('libraryPage.allAssets')}
                     </button>
                     {folders.map((folder) => (
                       <button key={folder._id} onClick={() => setSelectedFolder(folder._id)}
                         className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-3 ${selectedFolder === folder._id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                       >
                         <div className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color || '#6366f1' }} />
                         <span className="truncate flex-1">{folder.name}</span>
                       </button>
                     ))}
                   </div>
                </div>

                {/* Tags */}
                <div className="space-y-3">
                   <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                      <Tag size={14} /> {t('libraryPage.tags')}
                   </h3>
                   <div className="flex flex-wrap gap-2">
                     {tags.map((tag) => (
                       <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                         className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedTag === tag ? 'bg-primary-600 text-white border-primary-600' : 'bg-surface-50 dark:bg-surface-950 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'}`}
                       >
                         #{tag}
                       </button>
                     ))}
                   </div>
                </div>

                {/* Categories */}
                <div className="space-y-3">
                   <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                      <Layers size={14} /> {t('libraryPage.categories')}
                   </h3>
                   <div className="space-y-1">
                     {categories.map((category) => (
                       <button key={category} onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                         className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${selectedCategory === category ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}`}
                       >
                         {category.replace('_', ' ')}
                       </button>
                     ))}
                   </div>
                </div>

                {/* Favorites Toggle */}
                <div className="pt-6 border-t border-surface-200 dark:border-surface-800">
                  <button onClick={() => setShowFavorites(!showFavorites)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${showFavorites ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 border-amber-200 dark:border-amber-800' : 'bg-surface-50 dark:bg-surface-950 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                  >
                    <Star size={16} fill={showFavorites ? 'currentColor' : 'none'} /> {t('libraryPage.favorites')}
                  </button>
                </div>
             </div>
          </aside>

          {/* Content Area */}
          <main className="lg:col-span-3">
             <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6 min-h-[600px] flex flex-col">
                
                <header className="flex items-center justify-between mb-8 pb-6 border-b border-surface-200 dark:border-surface-800">
                   <div>
                     <h2 className="text-2xl font-black text-surface-900 dark:text-surface-50">{t('libraryPage.assets')}</h2>
                     <p className="text-sm font-medium text-surface-500 mt-1">{t('libraryPage.itemsFound', { count: content.length })}</p>
                   </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 flex-1 content-start">
                  <AnimatePresence mode="popLayout">
                    {content.map((item, idx) => (
                      <motion.article layout key={item._id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05, duration: 0.3 }}
                        className={`relative p-5 rounded-2xl border transition-all duration-300 group flex flex-col min-h-[240px] bg-surface-50 dark:bg-surface-950 ${selectMode && selectedItems.includes(item._id) ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-sm' : 'border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-800/50'}`}
                      >
                        {selectMode && (
                          <div className="absolute top-4 left-4 z-20">
                            <input type="checkbox" checked={selectedItems.includes(item._id)} onChange={() => setSelectedItems(prev => prev.includes(item._id) ? prev.filter(x => x !== item._id) : [...prev, item._id])}
                              aria-label={t('libraryPage.selectItem', { title: item.title || t('libraryPage.itemFallback') })}
                              className="w-5 h-5 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 flex flex-col">
                          <header className="flex justify-between items-start mb-4">
                             <div className={`flex-1 min-w-0 pr-4 ${selectMode ? 'pl-8' : ''}`}>
                                <h3 className="text-base font-bold text-surface-900 dark:text-white truncate" title={item.title}>{item.title || t('libraryPage.untitledAsset')}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Video size={12} className="text-primary-500" />
                                  <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">{item.type}</span>
                                </div>
                             </div>
                             <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item._id, item.isFavorite) }}
                               title={item.isFavorite ? t('libraryPage.removeFromFavourites') : t('libraryPage.addToFavourites')}
                               aria-label={item.isFavorite ? t('libraryPage.removeFromFavourites') : t('libraryPage.addToFavourites')}
                               className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${item.isFavorite ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                               <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
                             </button>
                          </header>

                          <div className="space-y-3 mt-auto">
                             {item.folderId && (
                               <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-800 w-fit">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.folderId.color || '#6366f1' }} />
                                  <span className="text-[10px] font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider truncate max-w-[120px]">{item.folderId.name}</span>
                               </div>
                             )}

                             <div className="flex flex-wrap gap-1.5">
                                {item.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[10px] font-bold text-surface-500 dark:text-surface-400 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 px-2 py-0.5 rounded-md">#{t}</span>
                                ))}
                                {item.tags.length > 3 && <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-md">+{item.tags.length - 3}</span>}
                             </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4 mt-4 border-t border-surface-200 dark:border-surface-800">
                          <button type="button" onClick={() => router.push(`/dashboard/content/${item._id}`)}
                            title={t('libraryPage.openAsset')}
                            className="flex-1 bg-surface-900 dark:bg-white text-white dark:text-surface-900 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover:bg-surface-800 dark:hover:bg-surface-100 flex items-center justify-center gap-2"
                          >
                            {t('libraryPage.open')} <ChevronRight size={14} />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>

                {content.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                     <div className="w-20 h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center mb-6">
                        <Folder size={32} className="text-surface-400" />
                     </div>
                     <h3 className="text-xl font-black text-surface-900 dark:text-white mb-2">{t('libraryPage.noAssetsFound')}</h3>
                     <p className="text-sm font-medium text-surface-500 max-w-sm">{t('libraryPage.noAssetsFoundDesc')}</p>
                  </div>
                )}
             </div>
          </main>
        </section>

        {/* ── Batch Operations Bar ── */}
        <AnimatePresence>
           {selectedItems.length > 0 && (
             <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-[100]">
                <div className="bg-surface-900 dark:bg-white rounded-2xl p-4 flex items-center justify-between shadow-2xl border border-surface-800 dark:border-surface-200">
                   <div className="flex items-center gap-4 px-4 border-r border-surface-800 dark:border-surface-200">
                      <div className="w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center font-black">
                         {selectedItems.length}
                      </div>
                      <span className="text-sm font-bold text-white dark:text-surface-900 uppercase tracking-wider">{t('libraryPage.selected')}</span>
                   </div>
                   
                   <div className="flex items-center gap-2 px-4">
                      <button type="button" onClick={() => setTagModalIds(selectedItems)} className="p-2.5 text-surface-400 hover:text-white dark:hover:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-100 rounded-xl transition-colors" title={t('libraryPage.addTags')} aria-label={t('libraryPage.addTags')}>
                        <Tag size={20} />
                      </button>
                      <button type="button" onClick={() => setMoveModalIds(selectedItems)} className="p-2.5 text-surface-400 hover:text-white dark:hover:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-100 rounded-xl transition-colors" title={t('libraryPage.moveToFolder')} aria-label={t('libraryPage.moveToFolder')}>
                        <Folder size={20} />
                      </button>
                      <button type="button" onClick={() => setExportModalIds(selectedItems)} className="p-2.5 text-surface-400 hover:text-white dark:hover:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-100 rounded-xl transition-colors" title={t('libraryPage.exportSelected')} aria-label={t('libraryPage.exportSelected')}>
                        <Download size={20} />
                      </button>
                      <div className="w-px h-6 bg-surface-800 dark:bg-surface-200 mx-2" />
                      <button type="button"
                         onClick={async () => {
                            if (!confirm(t('libraryPage.confirmDelete', { count: selectedItems.length }))) return
                            setBusy(true)
                            try {
                              const token = localStorage.getItem('token')
                              await axios.post(`${API_URL}/batch/delete`, { contentIds: selectedItems }, { headers: { Authorization: `Bearer ${token}` } })
                              showToast(t('libraryPage.deletedItems', { count: selectedItems.length }), 'success')
                              setSelectedItems([]); await loadLibrary()
                            } catch { showToast(t('libraryPage.errorDeletingItems'), 'error') }
                            finally { setBusy(false) }
                         }}
                         disabled={busy}
                         className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-500 transition-colors flex items-center gap-2"
                      >
                        {busy ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                        {t('libraryPage.delete')}
                      </button>
                   </div>
                   <button type="button" onClick={() => setSelectedItems([])} title={t('libraryPage.clearSelection')} aria-label={t('libraryPage.clearSelection')} className="p-2 text-surface-400 hover:text-white dark:hover:text-surface-900 mr-2"><X size={20}/></button>
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      {/* ── Tag Modal ── */}
      <AnimatePresence>
        {tagModalIds !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setTagModalIds(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-surface-200 dark:border-surface-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-surface-900 dark:text-white uppercase tracking-tight">{t('libraryPage.addTags')}</h3>
                <button type="button" onClick={() => setTagModalIds(null)} title={t('libraryPage.close')} aria-label={t('libraryPage.closeTagModal')} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-surface-500 mb-4">{t('libraryPage.addingTagTo', { count: tagModalIds.length })}</p>
              <input
                type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                placeholder={t('libraryPage.tagInputPlaceholder')}
                aria-label={t('libraryPage.tagName')} title={t('libraryPage.tagName')}
                className="w-full border border-surface-200 dark:border-surface-700 rounded-2xl px-4 py-3 text-sm bg-white dark:bg-surface-950 text-surface-900 dark:text-white focus:outline-none focus:border-primary-500 mb-4"
                onKeyDown={e => { if (e.key === 'Enter') handleTagInjection() }}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setTagModalIds(null)} className="flex-1 py-3 rounded-2xl border border-surface-200 dark:border-surface-700 text-sm font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">{t('libraryPage.cancel')}</button>
                <button type="button" onClick={handleTagInjection} disabled={busy || !tagInput.trim()} className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {busy ? <RefreshCw size={14} className="animate-spin" /> : <Tag size={14} />} {t('libraryPage.applyTag')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Move to Folder Modal ── */}
      <AnimatePresence>
        {moveModalIds !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setMoveModalIds(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-surface-200 dark:border-surface-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-surface-900 dark:text-white uppercase tracking-tight">{t('libraryPage.moveToFolder')}</h3>
                <button type="button" onClick={() => setMoveModalIds(null)} title={t('libraryPage.close')} aria-label={t('libraryPage.closeMoveModal')} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-surface-500 mb-4">{t('libraryPage.movingItems', { count: moveModalIds.length })}</p>
              <select
                value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)}
                aria-label={t('libraryPage.selectDestinationFolder')} title={t('libraryPage.selectDestinationFolder')}
                className="w-full border border-surface-200 dark:border-surface-700 rounded-2xl px-4 py-3 text-sm bg-white dark:bg-surface-950 text-surface-900 dark:text-white focus:outline-none focus:border-primary-500 mb-4"
              >
                <option value="none">{t('libraryPage.noFolderRoot')}</option>
                {folders.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setMoveModalIds(null)} className="flex-1 py-3 rounded-2xl border border-surface-200 dark:border-surface-700 text-sm font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">{t('libraryPage.cancel')}</button>
                <button type="button" onClick={handleLatticeTransfer} disabled={busy} className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {busy ? <RefreshCw size={14} className="animate-spin" /> : <Folder size={14} />} {t('libraryPage.move')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Export Modal ── */}
      <AnimatePresence>
        {exportModalIds !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setExportModalIds(null)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-surface-200 dark:border-surface-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-surface-900 dark:text-white uppercase tracking-tight">{t('libraryPage.exportAssets')}</h3>
                <button type="button" onClick={() => setExportModalIds(null)} title={t('libraryPage.close')} aria-label={t('libraryPage.closeExportModal')} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <p className="text-sm text-surface-500 mb-4">{t('libraryPage.exportingItems', { count: exportModalIds.length })}</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['json', 'csv'] as const).map(fmt => (
                  <button key={fmt} type="button" onClick={() => setExportFormat(fmt)}
                    className={`py-3 rounded-2xl border-2 text-sm font-bold uppercase tracking-wider transition-all ${exportFormat === fmt ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'}`}
                  >{fmt}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setExportModalIds(null)} className="flex-1 py-3 rounded-2xl border border-surface-200 dark:border-surface-700 text-sm font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">{t('libraryPage.cancel')}</button>
                <button type="button" onClick={handleExtraction} disabled={busy} className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} {t('libraryPage.export')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Folder Modal ── */}
      <AnimatePresence>
        {showCreateFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreateFolder(false)}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-surface-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-surface-200 dark:border-surface-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-surface-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                  <FolderPlus size={20} className="text-primary-500" /> {t('libraryPage.newFolder')}
                </h3>
                <button type="button" onClick={() => setShowCreateFolder(false)} title={t('libraryPage.close')} aria-label={t('libraryPage.closeCreateFolderModal')} className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"><X size={18} /></button>
              </div>
              <input
                type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder={t('libraryPage.folderNamePlaceholder')}
                aria-label={t('libraryPage.folderName')} title={t('libraryPage.folderName')}
                className="w-full border border-surface-200 dark:border-surface-700 rounded-2xl px-4 py-3 text-sm bg-white dark:bg-surface-950 text-surface-900 dark:text-white focus:outline-none focus:border-primary-500 mb-4"
                onKeyDown={e => { if (e.key === 'Enter') handleInitCapsule() }}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreateFolder(false)} className="flex-1 py-3 rounded-2xl border border-surface-200 dark:border-surface-700 text-sm font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">{t('libraryPage.cancel')}</button>
                <button type="button" onClick={handleInitCapsule} disabled={!newFolderName.trim()} className="flex-1 py-3 rounded-2xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-500 transition-colors disabled:opacity-40">{t('libraryPage.create')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
  )
}
