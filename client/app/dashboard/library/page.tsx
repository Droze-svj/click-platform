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
  Plus, Tag, Star, X,
  Trash2, Download, Layers,
  Folder as FolderIcon, FolderPlus,
  Video, ChevronRight, CheckSquare,
} from 'lucide-react'
import ToastContainer from '../../../components/ToastContainer'
import { API_URL } from '../../../lib/api'
import { StatsCardSkeleton, CardSkeleton } from '@/components/LoadingSkeleton'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  FormField,
  Modal,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

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

  const handleBatchDelete = async () => {
    if (!confirm(t('libraryPage.confirmDelete', { count: selectedItems.length }))) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/batch/delete`, { contentIds: selectedItems }, { headers: { Authorization: `Bearer ${token}` } })
      showToast(t('libraryPage.deletedItems', { count: selectedItems.length }), 'success')
      setSelectedItems([]); await loadLibrary()
    } catch { showToast(t('libraryPage.errorDeletingItems'), 'error') }
    finally { setBusy(false) }
  }

  if (loading) return (
    <div className="min-h-screen ds-bg-mesh-soft px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-6" aria-busy="true" aria-label={t('libraryPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
        <SectionHeader
          as="h1"
          title={t('libraryPage.title')}
          description={t('libraryPage.subtitle')}
          className="mb-6"
          actions={
            <>
              <Button
                variant={selectMode ? 'primary' : 'secondary'}
                size="md"
                leftIcon={<CheckSquare size={16} aria-hidden />}
                onClick={() => setSelectMode(!selectMode)}
              >
                {selectMode ? t('libraryPage.doneSelecting') : t('libraryPage.batchSelect')}
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus size={16} aria-hidden />}
                onClick={() => setShowCreateFolder(true)}
              >
                {t('libraryPage.newFolder')}
              </Button>
            </>
          }
        />

        {/* ── Main Layout Grid ── */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar / Filters */}
          <aside className="lg:col-span-1">
            <Panel variant="bento" className="space-y-7 sticky top-6">

              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                <Input
                  type="text"
                  placeholder={t('libraryPage.searchAssetsPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Folders */}
              <div className="space-y-2">
                <h3 className="ds-text-label text-theme-muted flex items-center gap-2">
                  <Folder size={14} aria-hidden /> {t('libraryPage.folders')}
                </h3>
                <div className="space-y-1">
                  <button onClick={() => setSelectedFolder(null)}
                    className={cn('w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      selectedFolder === null ? 'bg-primary/10 text-primary' : 'text-theme-secondary hover:bg-accent hover:text-theme-primary')}
                  >
                    {t('libraryPage.allAssets')}
                  </button>
                  {folders.map((folder) => (
                    <button key={folder._id} onClick={() => setSelectedFolder(folder._id)}
                      className={cn('w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2.5',
                        selectedFolder === folder._id ? 'bg-primary/10 text-primary' : 'text-theme-secondary hover:bg-accent hover:text-theme-primary')}
                    >
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: folder.color || '#6366f1' }} />
                      <span className="truncate flex-1">{folder.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <h3 className="ds-text-label text-theme-muted flex items-center gap-2">
                    <Tag size={14} aria-hidden /> {t('libraryPage.tags')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                        className={cn('rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                          selectedTag === tag ? 'bg-primary text-primary-foreground' : 'ds-surface-subtle text-theme-secondary hover:text-theme-primary')}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <h3 className="ds-text-label text-theme-muted flex items-center gap-2">
                    <Layers size={14} aria-hidden /> {t('libraryPage.categories')}
                  </h3>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <button key={category} onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                        className={cn('w-full text-left rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                          selectedCategory === category ? 'bg-primary/10 text-primary' : 'text-theme-secondary hover:bg-accent hover:text-theme-primary')}
                      >
                        {category.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorites Toggle */}
              <div className="pt-5 border-t border-[var(--border-subtle)]">
                <button onClick={() => setShowFavorites(!showFavorites)}
                  className={cn('w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    showFavorites ? 'bg-amber-500/10 text-amber-500' : 'ds-surface-subtle text-theme-secondary hover:text-theme-primary')}
                >
                  <Star size={16} fill={showFavorites ? 'currentColor' : 'none'} aria-hidden /> {t('libraryPage.favorites')}
                </button>
              </div>
            </Panel>
          </aside>

          {/* Content Area */}
          <main className="lg:col-span-3 min-w-0">
            <Panel variant="bento" className="min-h-[600px] flex flex-col">

              <SectionHeader
                as="h2"
                title={t('libraryPage.assets')}
                description={t('libraryPage.itemsFound', { count: content.length })}
                className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
              />

              {content.length === 0 ? (
                <EmptyState
                  icon={FolderIcon}
                  title={t('libraryPage.noAssetsFound')}
                  description={t('libraryPage.noAssetsFoundDesc')}
                  className="flex-1"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 content-start">
                  {content.map((item) => (
                    <article key={item._id}
                      className={cn('ds-surface-subtle ds-hover-lift relative p-4 flex flex-col min-h-[220px] transition-colors',
                        selectMode && selectedItems.includes(item._id) && 'border-primary ring-2 ring-primary/20')}
                    >
                      {selectMode && (
                        <div className="absolute top-4 left-4 z-10">
                          <input type="checkbox" checked={selectedItems.includes(item._id)}
                            onChange={() => setSelectedItems(prev => prev.includes(item._id) ? prev.filter(x => x !== item._id) : [...prev, item._id])}
                            aria-label={t('libraryPage.selectItem', { title: item.title || t('libraryPage.itemFallback') })}
                            className="h-5 w-5 rounded border-input text-primary focus:ring-ring cursor-pointer"
                          />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col">
                        <header className="flex justify-between items-start mb-4 gap-2">
                          <div className={cn('flex-1 min-w-0', selectMode && 'pl-8')}>
                            <h3 className="ds-text-label text-theme-primary truncate" title={item.title}>{item.title || t('libraryPage.untitledAsset')}</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Video size={12} className="text-indigo-500" aria-hidden />
                              <span className="ds-text-caption capitalize">{item.type}</span>
                            </div>
                          </div>
                          <IconButton
                            variant="ghost" size="sm"
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item._id, item.isFavorite) }}
                            aria-label={item.isFavorite ? t('libraryPage.removeFromFavourites') : t('libraryPage.addToFavourites')}
                            className={item.isFavorite ? 'text-amber-500' : 'text-theme-muted'}
                          >
                            <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} aria-hidden />
                          </IconButton>
                        </header>

                        <div className="space-y-2.5 mt-auto">
                          {item.folderId && (
                            <div className="ds-surface-card flex items-center gap-2 px-2.5 py-1 w-fit">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.folderId.color || '#6366f1' }} />
                              <span className="ds-text-caption truncate max-w-[120px]">{item.folderId.name}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {item.tags.slice(0, 3).map((tg) => (
                              <span key={tg} className="ds-text-caption ds-surface-card px-2 py-0.5">#{tg}</span>
                            ))}
                            {item.tags.length > 3 && (
                              <span className="ds-text-caption rounded-md bg-primary/10 px-2 py-0.5 text-primary">+{item.tags.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[var(--border-subtle)]">
                        <Button
                          variant="primary" size="sm"
                          className="w-full"
                          rightIcon={<ChevronRight size={14} aria-hidden />}
                          onClick={() => router.push(`/dashboard/content/${item._id}`)}
                        >
                          {t('libraryPage.open')}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </main>
        </section>

        {/* ── Batch Operations Bar ── */}
        {selectedItems.length > 0 && (
          <div className="ds-anim-rise fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-[90]">
            <div className="ds-surface-elevated flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 pr-3 border-r border-[var(--border-subtle)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold tabular-nums">
                  {selectedItems.length}
                </span>
                <span className="ds-text-label text-theme-primary hidden sm:inline">{t('libraryPage.selected')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IconButton variant="ghost" size="md" onClick={() => setTagModalIds(selectedItems)} aria-label={t('libraryPage.addTags')}><Tag size={18} aria-hidden /></IconButton>
                <IconButton variant="ghost" size="md" onClick={() => setMoveModalIds(selectedItems)} aria-label={t('libraryPage.moveToFolder')}><Folder size={18} aria-hidden /></IconButton>
                <IconButton variant="ghost" size="md" onClick={() => setExportModalIds(selectedItems)} aria-label={t('libraryPage.exportSelected')}><Download size={18} aria-hidden /></IconButton>
                <Button variant="destructive" size="sm" loading={busy} onClick={handleBatchDelete} leftIcon={!busy ? <Trash2 size={16} aria-hidden /> : undefined}>
                  {t('libraryPage.delete')}
                </Button>
              </div>
              <IconButton variant="ghost" size="md" onClick={() => setSelectedItems([])} aria-label={t('libraryPage.clearSelection')}><X size={18} aria-hidden /></IconButton>
            </div>
          </div>
        )}

        {/* ── Tag Modal ── */}
        <Modal open={tagModalIds !== null} onClose={() => setTagModalIds(null)} title={t('libraryPage.addTags')}>
          <p className="ds-text-caption mb-4">{t('libraryPage.addingTagTo', { count: tagModalIds?.length ?? 0 })}</p>
          <Input
            type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            placeholder={t('libraryPage.tagInputPlaceholder')}
            aria-label={t('libraryPage.tagName')}
            onKeyDown={e => { if (e.key === 'Enter') handleTagInjection() }}
          />
          <div className="flex gap-3 mt-5">
            <Button variant="ghost" className="flex-1" onClick={() => setTagModalIds(null)}>{t('libraryPage.cancel')}</Button>
            <Button variant="primary" className="flex-1" onClick={handleTagInjection} loading={busy} disabled={!tagInput.trim()} leftIcon={!busy ? <Tag size={14} aria-hidden /> : undefined}>
              {t('libraryPage.applyTag')}
            </Button>
          </div>
        </Modal>

        {/* ── Move to Folder Modal ── */}
        <Modal open={moveModalIds !== null} onClose={() => setMoveModalIds(null)} title={t('libraryPage.moveToFolder')}>
          <p className="ds-text-caption mb-4">{t('libraryPage.movingItems', { count: moveModalIds?.length ?? 0 })}</p>
          <FormField label={t('libraryPage.selectDestinationFolder')}>
            <select
              value={moveFolderId} onChange={e => setMoveFolderId(e.target.value)}
              aria-label={t('libraryPage.selectDestinationFolder')}
              className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="none">{t('libraryPage.noFolderRoot')}</option>
              {folders.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
            </select>
          </FormField>
          <div className="flex gap-3 mt-5">
            <Button variant="ghost" className="flex-1" onClick={() => setMoveModalIds(null)}>{t('libraryPage.cancel')}</Button>
            <Button variant="primary" className="flex-1" onClick={handleLatticeTransfer} loading={busy} leftIcon={!busy ? <Folder size={14} aria-hidden /> : undefined}>
              {t('libraryPage.move')}
            </Button>
          </div>
        </Modal>

        {/* ── Export Modal ── */}
        <Modal open={exportModalIds !== null} onClose={() => setExportModalIds(null)} title={t('libraryPage.exportAssets')}>
          <p className="ds-text-caption mb-4">{t('libraryPage.exportingItems', { count: exportModalIds?.length ?? 0 })}</p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {(['json', 'csv'] as const).map(f => (
              <button key={f} type="button" onClick={() => setExportFormat(f)}
                className={cn('rounded-lg border py-2.5 text-sm font-medium uppercase transition-colors',
                  exportFormat === f ? 'border-primary bg-primary/10 text-primary' : 'border-input text-theme-secondary hover:bg-accent')}
              >{f}</button>
            ))}
          </div>
          <div className="flex gap-3 mt-5">
            <Button variant="ghost" className="flex-1" onClick={() => setExportModalIds(null)}>{t('libraryPage.cancel')}</Button>
            <Button variant="primary" className="flex-1" onClick={handleExtraction} loading={busy} leftIcon={!busy ? <Download size={14} aria-hidden /> : undefined}>
              {t('libraryPage.export')}
            </Button>
          </div>
        </Modal>

        {/* ── Create Folder Modal ── */}
        <Modal open={showCreateFolder} onClose={() => setShowCreateFolder(false)}
          title={<span className="inline-flex items-center gap-2"><FolderPlus size={18} className="text-indigo-500" aria-hidden /> {t('libraryPage.newFolder')}</span>}
        >
          <Input
            type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            placeholder={t('libraryPage.folderNamePlaceholder')}
            aria-label={t('libraryPage.folderName')}
            onKeyDown={e => { if (e.key === 'Enter') handleInitCapsule() }}
          />
          <div className="flex gap-3 mt-5">
            <Button variant="ghost" className="flex-1" onClick={() => setShowCreateFolder(false)}>{t('libraryPage.cancel')}</Button>
            <Button variant="primary" className="flex-1" onClick={handleInitCapsule} disabled={!newFolderName.trim()}>{t('libraryPage.create')}</Button>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
