'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import EnhancedBatchOperations from '../../../components/EnhancedBatchOperations'
import BulkActions from '../../../components/BulkActions'
import EmptyState from '../../../components/EmptyState'
import { 
  Database, HardDrive, Folder, File, Search, 
  Plus, Tag, Star, Copy, Eye, MoreHorizontal, 
  Trash2, Move, Download, Globe, Shield, 
  Activity, Cpu, Radio, Lock, Unlock, 
  ChevronRight, Target, Terminal, Layers, 
  X, Filter, Zap, LayoutGrid, LayoutList, ArrowLeft,
  Box, Maximize2, Minimize2, Trash, Check, AlertCircle, RefreshCw,
  Archive, Briefcase, Boxes, Network, Monitor, Fingerprint,
  MonitorCheck, CircuitBoard, ActivitySquare, Link2, Key
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../components/ToastContainer'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'
const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

interface Content {
  _id: string; title: string; type: string; status: string;
  folderId?: { _id: string; name: string; color: string; };
  tags: string[]; category: string; isFavorite: boolean; createdAt: string;
}

interface Folder {
  _id: string; name: string; color: string; description?: string;
}

export default function AxiomRepositoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [content, setContent] = useState<Content[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
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

  const loadLedger = useCallback(async () => {
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
    } catch (error) { showToast('SYNC_ERR: REPOSITORY_LINK_VOID', 'error') }
    finally { setLoading(false) }
  }, [selectedFolder, selectedTag, selectedCategory, showFavorites, searchQuery, showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadLedger()
  }, [user, router, loadLedger])

  const handleTagInjection = async () => {
    if (!tagModalIds?.length || !tagInput.trim()) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/batch/tag`, { contentIds: tagModalIds, tags: [tagInput.trim()], action: 'add' }, { headers: { Authorization: `Bearer ${token}` } })
      showToast('METADATA_INJECTED: NODES_RE-MAPPED', 'success')
      setTagModalIds(null); setTagInput(''); loadLedger()
    } catch { showToast('INJECTION_ERR: PROTOCOL_DENIED', 'error') }
    finally { setBusy(false) }
  }

  const handleLatticeTransfer = async () => {
    if (!moveModalIds?.length) return
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      const folderId = moveFolderId === 'none' || !moveFolderId ? null : moveFolderId
      await axios.post(`${API_URL}/batch/update`, { contentIds: moveModalIds, updates: { folderId } }, { headers: { Authorization: `Bearer ${token}` } })
      showToast('LATTICE_SHIFT_COMPLETE: TOPOLOGY_RE-INDEXED', 'success')
      setMoveModalIds(null); setMoveFolderId(''); loadLedger()
    } catch { showToast('MOVE_ERR: LATTICE_SHIFT_ABORTED', 'error') }
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
      const a = document.createElement('a'); a.href = url; a.download = `axiom-extract-${Date.now()}.${exportFormat}`; a.click()
      window.URL.revokeObjectURL(url)
      showToast('EXTRACTION_COMPLETE: ARTIFACTS_DECRYPTED', 'success')
      setExportModalIds(null)
    } catch { showToast('EXTRACTION_ERR: BUFFER_VOID', 'error') }
    finally { setBusy(false) }
  }

  const handleInitCapsule = async () => {
    if (!newFolderName.trim()) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/library/folders`, { name: newFolderName }, { headers: { Authorization: `Bearer ${token}` } })
      showToast('LATTICE_CAPSULE_INITIALIZED', 'success')
      setShowCreateFolder(false); setNewFolderName(''); await loadLedger()
    } catch { showToast('INIT_FAILED: UPLINK_ABORTED', 'error') }
  }

  const handleToggleAxiom = async (contentId: string, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await axios.put(`${API_URL}/library/content/${contentId}/organize`, { isFavorite: !currentValue }, { headers: { Authorization: `Bearer ${token}` } })
      await loadLedger()
      showToast(!currentValue ? 'PINNED_TO_AXIOMATIC_PRIME' : 'RELEASED_FROM_AXIOM', 'success')
    } catch { showToast('AXIOM_ERR: SYNC_DIFFRACTION', 'error') }
  }

  const handleMatrixClone = async (contentId: string) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/library/content/${contentId}/duplicate`, {}, { headers: { Authorization: `Bearer ${token}` } })
      showToast('PAYLOAD_CLONED: MATRIX_DUPLICATION_SUCCESS', 'success'); await loadLedger()
    } catch { showToast('CLONE_ERR: MATRIX_VOID', 'error') }
  }

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 bg-[#020205] min-h-screen">
        <Database size={80} className="text-indigo-500 animate-pulse mb-12 drop-shadow-[0_0_40px_rgba(99,102,241,0.5)]" />
        <span className="text-[16px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Scanning Axiom Index...</span>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Repository Header */}
        <header className="flex flex-col lg:flex-row items-center justify-between gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard')} title="Abort"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <Archive size={48} className="text-indigo-400 relative z-10 group-hover:scale-110 transition-transform duration-1000 animate-pulse" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <CircuitBoard size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Axiom Repository v12.4.8</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                       <Radio size={14} className="text-emerald-400 animate-pulse" />
                       <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">REPOSITORY_SYNC_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Axiom Repository</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">High-fidelity archival matrix for persistent cognitive nodes and lattice-wide logic storage.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={() => setSelectMode(!selectMode)}
                className={`px-16 py-8 border-[3px] rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] transition-all duration-1000 italic shadow-2xl active:scale-95 ${selectMode ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_40px_100px_rgba(99,102,241,0.4)] scale-105' : 'bg-white/[0.02] border-white/10 text-slate-800 hover:text-white hover:bg-white/10'}`}
              >
                {selectMode ? 'ABORT_NODE_SELECT' : 'SEQUENTIAL_NODE_SELECT'}
              </button>
              <button onClick={() => setShowCreateFolder(true)}
                className="px-16 py-8 bg-white text-black rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_60px_120px_rgba(255,255,255,0.1)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 flex items-center gap-8 italic active:scale-95 border-none group">
                <Plus size={28} className="group-hover:rotate-180 transition-transform duration-1000" />
                INITIALIZE_CAPSULE
              </button>
           </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-20 relative z-10">
          {/* Repository Topology Matrix (Sidebar) */}
          <aside className="lg:col-span-1 space-y-16">
             <div className={`${glassStyle} p-12 rounded-[6rem] space-y-20 border-white/5 shadow-[0_60px_100px_rgba(0,0,0,0.6)] bg-black/40`}>
                {/* Search Index */}
                <div className="relative group/search">
                   <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                      <Search size={28} className="text-slate-950 group-focus-within/search:text-indigo-400 transition-colors" />
                   </div>
                   <input type="text" placeholder="SCAN_REPOSITORY_INDEX..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-black/60 border-2 border-white/5 rounded-[3.5rem] pl-24 pr-10 py-8 text-[16px] font-black text-white uppercase tracking-widest placeholder:text-slate-950 focus:outline-none focus:border-indigo-500/50 transition-all italic shadow-inner" 
                   />
                </div>

                {/* Lattice Index */}
                <div className="space-y-12">
                   <div className="flex items-center gap-6 mb-4 border-l-8 border-indigo-500/20 pl-6">
                      <Target size={24} className="text-indigo-400" />
                      <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">Lattice_Structure</h3>
                   </div>
                   <div className="space-y-6">
                     <button onClick={() => setSelectedFolder(null)}
                       className={`w-full group text-left px-10 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-1000 flex items-center justify-between italic ${selectedFolder === null ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-800 hover:text-white hover:bg-white/[0.04]'}`}
                     >
                       FULL_MATRIX_GRID
                       <Globe size={24} className={selectedFolder === null ? 'text-black' : 'text-slate-950 group-hover:text-indigo-400 transition-colors'} />
                     </button>
                     {folders.map((folder) => (
                       <button key={folder._id} onClick={() => setSelectedFolder(folder._id)}
                         className={`w-full group text-left px-10 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-1000 flex items-center gap-8 italic ${selectedFolder === folder._id ? 'bg-white text-black shadow-2xl scale-105' : 'text-slate-800 hover:text-white hover:bg-white/[0.04]'}`}
                       >
                         <div className="w-6 h-6 rounded-full border-2 border-white/10 shadow-2xl transition-transform group-hover:scale-125" style={{ backgroundColor: folder.color || '#4f46e5', boxShadow: `0 0 30px ${folder.color || '#4f46e5'}80` }} />
                         <span className="truncate flex-1">{folder.name.toUpperCase()}</span>
                         <ChevronRight size={24} className={`opacity-0 transition-opacity duration-1000 ${selectedFolder === folder._id ? 'opacity-100' : 'group-hover:opacity-40'}`} />
                       </button>
                     ))}
                   </div>
                </div>

                {/* Metadata Keys */}
                <div className="space-y-10">
                   <div className="flex items-center gap-6 mb-4 border-l-8 border-indigo-500/20 pl-6">
                      <Tag size={24} className="text-indigo-400" />
                      <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">Metadata_Axioms</h3>
                   </div>
                   <div className="flex flex-wrap gap-4">
                     {tags.map((tag) => (
                       <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                         className={`px-8 py-4 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] transition-all duration-1000 border-2 italic ${selectedTag === tag ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.5)]' : 'bg-black/40 text-slate-800 border-white/5 hover:border-white/20 hover:text-white'}`}
                       >
                         #{tag.toUpperCase()}
                       </button>
                     ))}
                   </div>
                </div>

                {/* Archetype Filter */}
                <div className="space-y-10">
                   <div className="flex items-center gap-6 mb-4 border-l-8 border-indigo-500/20 pl-6">
                      <Layers size={24} className="text-indigo-400" />
                      <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">Logic_Archetypes</h3>
                   </div>
                   <div className="space-y-6">
                     {categories.map((category) => (
                       <button key={category} onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                         className={`w-full text-left px-10 py-6 rounded-[2.5rem] text-[13px] font-black uppercase tracking-[0.4em] transition-all duration-1000 italic ${selectedCategory === category ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-2xl' : 'text-slate-800 hover:text-white hover:bg-white/[0.04]'}`}
                       >
                         {category.toUpperCase().replace('_', ' ')}_TYPE
                       </button>
                     ))}
                   </div>
                </div>

                {/* Axiomatic Selection */}
                <div className="pt-12 border-t border-white/10">
                  <button onClick={() => setShowFavorites(!showFavorites)}
                    className={`w-full group flex items-center gap-8 px-12 py-8 rounded-[3.5rem] text-[14px] font-black uppercase tracking-[0.6em] transition-all duration-1000 italic shadow-[0_40px_100px_rgba(0,0,0,0.6)] ${showFavorites ? 'bg-amber-500 text-black shadow-[0_30px_80px_rgba(245,158,11,0.5)] scale-105 border-none' : 'bg-black/40 text-slate-800 hover:text-amber-500 border border-white/5'}`}
                  >
                    <Star size={32} fill={showFavorites ? 'currentColor' : 'none'} className={showFavorites ? 'animate-pulse' : 'group-hover:rotate-180 transition-transform duration-1000'} /> AXIOMATIC_PRIMARIES
                  </button>
                </div>
             </div>
          </aside>

          {/* Cognitive Node Buffer (Main Content) */}
          <main className="lg:col-span-3 space-y-16">
             <div className={`${glassStyle} p-20 rounded-[7rem] min-h-[1100px] border-white/5 relative overflow-hidden shadow-[0_80px_200px_rgba(0,0,0,0.8)] flex flex-col bg-black/40`}>
                <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none group-hover:rotate-6 transition-transform duration-1000"><MonitorCheck size={800} className="text-white" /></div>
                
                <header className="flex flex-col md:flex-row items-center justify-between mb-24 relative z-10 border-b border-white/5 pb-16 gap-12">
                   <div className="flex items-center gap-12">
                      <div className="w-24 h-24 rounded-[3rem] bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-center shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group/box">
                         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                         <Boxes size={48} className="text-indigo-400 relative z-10 group-hover/box:scale-125 transition-transform duration-1000" />
                      </div>
                      <div>
                        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Axiom Node Buffer</h2>
                        <p className="text-slate-800 text-[16px] font-black uppercase tracking-[0.6em] italic leading-none">({content.length}_NODES_STABILIZED_IN_CURRENT_LATTICE)</p>
                      </div>
                   </div>
                   <div className="hidden xl:flex flex-col items-end gap-4 text-[12px] font-black text-slate-900 uppercase tracking-[0.5em] italic leading-none opacity-40 hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-6 px-10 py-4 bg-white/5 rounded-full border border-white/10"><ActivitySquare size={20} className="text-indigo-500 animate-pulse" /> SYNC_LATTICE: ALPHA_7_PRIME</div>
                      <div className="flex items-center gap-6 px-10 py-4 bg-white/5 rounded-full border border-white/10"><Database size={20} className="text-indigo-500" /> DEPLOYMENT_READY: 100%</div>
                   </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-16 relative z-10 flex-1 content-start">
                  <AnimatePresence mode="popLayout">
                    {content.map((item, idx) => (
                      <motion.article layout key={item._id} initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: idx * 0.05, duration: 1 }}
                        className={`relative p-12 rounded-[5.5rem] border-2 transition-all duration-1000 group flex flex-col justify-between min-h-[500px] shadow-[0_60px_150px_rgba(0,0,0,0.6)] bg-black/60 ${selectMode && selectedItems.includes(item._id) ? 'border-indigo-500 shadow-[0_0_120px_rgba(99,102,241,0.4)] ring-8 ring-indigo-500/20' : 'border-white/[0.03] hover:border-indigo-500/40 hover:bg-white/[0.04]'}`}
                      >
                        {selectMode && (
                          <div className="absolute top-12 left-12 z-20">
                            <input type="checkbox" checked={selectedItems.includes(item._id)} onChange={() => setSelectedItems(prev => prev.includes(item._id) ? prev.filter(x => x !== item._id) : [...prev, item._id])}
                              className="w-12 h-12 rounded-[1.5rem] bg-black/60 border-2 border-white/10 text-indigo-500 focus:ring-12 focus:ring-indigo-500/20 cursor-pointer appearance-none checked:bg-indigo-500 checked:border-white transition-all shadow-2xl" 
                            />
                          </div>
                        )}
                        
                        <div className="p-4">
                          <header className="flex justify-between items-start mb-12 relative z-10">
                             <div className="flex-1 min-w-0 pr-8">
                                <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter truncate group-hover:text-indigo-400 transition-all duration-1000 mb-6 leading-none drop-shadow-2xl">{item.title || 'NULL_PAYLOAD'}</h3>
                                <div className="flex items-center gap-4">
                                  <Cpu size={18} className="text-indigo-400/40" />
                                  <span className="text-[12px] font-black text-slate-800 uppercase tracking-[0.6em] italic leading-none">{item.type.toUpperCase()}_LOGIC_CORE</span>
                                </div>
                             </div>
                             <button onClick={(e) => { e.stopPropagation(); handleToggleAxiom(item._id, item.isFavorite) }}
                               className={`w-16 h-16 flex items-center justify-center rounded-[2rem] transition-all duration-1000 shadow-[0_30px_60px_rgba(0,0,0,0.8)] ${item.isFavorite ? 'text-amber-500 bg-amber-500/10 border-2 border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.4)] scale-125' : 'text-slate-950 hover:text-white hover:bg-white/10 border border-white/5'}`}>
                               <Star size={32} fill={item.isFavorite ? 'currentColor' : 'none'} className={item.isFavorite ? 'animate-pulse' : ''} />
                             </button>
                          </header>

                          <div className="space-y-10 mb-20 relative z-10">
                             {item.folderId && (
                               <div className="flex items-center gap-6 px-8 py-4 bg-white/[0.02] rounded-[2.2rem] border-2 border-white/5 w-fit shadow-2xl group-hover:border-indigo-500/20 transition-all duration-1000 group-hover:translate-x-4">
                                  <div className="w-4 h-4 rounded-full border-2 border-white/20 shadow-2xl" style={{ backgroundColor: item.folderId.color || '#4f46e5', boxShadow: `0 0 25px ${item.folderId.color || '#4f46e5'}` }} />
                                  <span className="text-[12px] font-black text-slate-500 uppercase tracking-[0.5em] italic truncate max-w-[180px]">{item.folderId.name.toUpperCase()}</span>
                               </div>
                             )}

                             <div className="flex flex-wrap gap-5">
                                {item.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none group-hover:text-indigo-400 transition-colors duration-1000">#{t.toUpperCase()}</span>
                                ))}
                                {item.tags.length > 3 && <span className="text-[10px] font-black text-white bg-indigo-500/20 px-5 py-2 rounded-full border border-indigo-500/20 shadow-2xl">+{item.tags.length - 3} ARCHE_KEYS</span>}
                             </div>
                          </div>
                        </div>

                        <div className="flex gap-8 pt-12 border-t border-white/5 mt-auto relative z-10">
                          <button onClick={() => router.push(`/dashboard/content/${item._id}`)}
                            className="flex-1 bg-white text-black py-8 rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] hover:bg-indigo-500 hover:text-white transition-all duration-1000 shadow-[0_40px_100px_rgba(255,255,255,0.1)] italic scale-100 group-hover:scale-105 active:scale-95 group/access relative overflow-hidden border-none"
                          >
                            <div className="absolute inset-0 bg-indigo-500 translate-y-full group-hover/access:translate-y-0 transition-transform duration-700" />
                            <span className="relative z-10 flex items-center justify-center gap-6">ACCESS_PAYLOAD <ChevronRight size={24} className="group-hover/access:translate-x-4 transition-transform duration-700" /></span>
                          </button>
                          <button onClick={() => handleMatrixClone(item._id)}
                            className="w-24 h-24 bg-white/[0.02] border border-white/10 text-slate-900 hover:text-white hover:bg-white/10 flex items-center justify-center rounded-[3.5rem] transition-all duration-1000 group/clone shadow-2xl hover:scale-110 active:scale-90" title="Clone Matrix">
                            <Copy size={36} className="group-hover/clone:rotate-12 transition-transform duration-1000" />
                          </button>
                        </div>
                      </motion.article>
                    ))}
                  </AnimatePresence>
                </div>

                {content.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-32 opacity-10 gap-16 group/empty">
                     <div className="w-64 h-64 bg-white/5 rounded-[6rem] border-4 border-white/5 flex items-center justify-center shadow-inner relative group-hover/empty:scale-110 transition-transform duration-1000 animate-pulse">
                        <Target size={120} className="text-white opacity-40" />
                     </div>
                     <div className="space-y-10 max-w-4xl">
                        <h3 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">Horizon Quiescent</h3>
                        <p className="text-2xl font-black text-slate-800 uppercase tracking-[0.8em] italic leading-relaxed">No Payload Matrix detected in current sector.<br/>Initialize an archival capsule to establish permanent storage.</p>
                     </div>
                  </div>
                )}
             </div>
          </main>
        </section>

        {/* Mass Operation Terminals */}
        <AnimatePresence>
           {selectedItems.length > 0 && (
             <motion.div initial={{ y: 300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 300, opacity: 0 }} className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[1200px] px-12 z-[100]">
                <div className={`${glassStyle} rounded-[6rem] p-12 flex items-center justify-between border-indigo-500/60 shadow-[0_100px_250px_rgba(0,0,0,1)] bg-black/90 backdrop-blur-3xl ring-[12px] ring-black/40`}>
                   <div className="flex items-center gap-16 px-16 border-r-2 border-white/5 h-24">
                      <div className="relative">
                         <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-80 animate-pulse" />
                         <div className="relative w-28 h-28 bg-white text-black rounded-[4rem] flex items-center justify-center shadow-2xl text-5xl font-black italic scale-125 border-8 border-black/40">
                            {selectedItems.length}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <p className="text-[18px] font-black text-white uppercase tracking-[0.6em] leading-none">NODES_ARRAYED</p>
                         <div className="flex items-center gap-4">
                            <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                            <p className="text-[12px] font-black text-indigo-400 uppercase tracking-[1em] italic leading-none">LATTICE_BUFFER_READY</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-10 flex-1 px-16 justify-center">
                      {[
                        { icon: Tag, title: 'Inject Metadata', action: () => setTagModalIds(selectedItems) },
                        { icon: Network, title: 'Lattice Re-Index', action: () => setMoveModalIds(selectedItems) },
                        { icon: Download, title: 'Extract Logic', action: () => setExportModalIds(selectedItems) },
                      ].map(op => (
                        <button key={op.title} onClick={op.action} className="w-24 h-24 bg-white/5 border-2 border-white/10 text-slate-900 hover:text-white hover:bg-white/10 rounded-[3.5rem] flex items-center justify-center transition-all duration-1000 hover:scale-110 shadow-2xl group/op border-none" title={op.title}>
                          <op.icon size={40} className="group-hover/op:rotate-12 group-hover/op:scale-125 transition-all duration-700" />
                        </button>
                      ))}
                      <div className="w-1 h-20 bg-white/5 mx-8 rounded-full" />
                      <button 
                         onClick={async () => {
                            if (!confirm(`CRITICAL: PURGE ${selectedItems.length} PERMANENT PAYLOADS? THIS ACTION IS IRREVERSIBLE IN THE CURRENT TIMELINE.`)) return
                            setBusy(true)
                            try {
                              const token = localStorage.getItem('token')
                              await axios.post(`${API_URL}/batch/delete`, { contentIds: selectedItems }, { headers: { Authorization: `Bearer ${token}` } })
                              showToast(`✓ LEDGER_PURGED: ${selectedItems.length} ASSETS_DE-EXISTED`, 'success')
                              setSelectedItems([]); await loadLedger()
                            } catch { showToast('PURGE_ERR: SYSTEM_PROTECTION_FAULT', 'error') }
                            finally { setBusy(false) }
                         }}
                         disabled={busy}
                         className="px-20 py-10 bg-rose-600 text-white rounded-[4rem] text-[18px] font-black uppercase tracking-[0.6em] hover:bg-rose-500 transition-all duration-1000 shadow-[0_40px_100px_rgba(225,29,72,0.4)] italic flex items-center gap-8 border-none scale-110 hover:scale-120 active:scale-95 group/purge"
                      >
                        {busy ? <RefreshCw className="animate-spin" size={36} /> : <Trash2 size={36} className="group-hover/purge:rotate-12 transition-transform duration-700" />}
                        PURGE_IMMUTABLE_NODES
                      </button>
                   </div>
                   <button onClick={() => setSelectedItems([])} className="w-20 h-20 bg-white/5 border-2 border-white/10 text-slate-950 hover:text-white rounded-[3rem] transition-all mr-12 hover:scale-110 shadow-2xl hover:bg-rose-500/20 active:scale-90 flex items-center justify-center border-none"><X size={44}/></button>
                </div>
             </motion.div>
           )}

           {/* Capsule Initialization Terminal */}
           {showCreateFolder && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/98 backdrop-blur-3xl" onClick={() => setShowCreateFolder(false)}>
                <div className={`${glassStyle} rounded-[10rem] p-32 max-w-5xl w-full border-white/30 relative overflow-hidden shadow-[0_0_500px_rgba(0,0,0,1)] ring-2 ring-white/10`} onClick={e => e.stopPropagation()}>
                   <div className="absolute top-0 right-0 p-32 opacity-[0.03] pointer-events-none rotate-12 scale-150"><Folder size={800} className="text-white" /></div>
                   <div className="flex items-center gap-16 mb-32 relative z-10 border-b border-white/5 pb-20">
                      <div className="w-32 h-32 rounded-[5rem] bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center shadow-[0_0_100px_rgba(99,102,241,0.5)]"><Plus size={64} className="text-indigo-400 animate-pulse" /></div>
                      <div>
                         <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-6">Initialize Capsule</h2>
                         <p className="text-[16px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none">Establishing isolated archival sector v12.8.4_PRIME</p>
                      </div>
                   </div>
                   <div className="space-y-24 relative z-10">
                      <div className="space-y-12">
                         <label className="text-[18px] font-black text-slate-800 uppercase tracking-[1em] italic leading-none ml-10">Capsule Designation Identity</label>
                         <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                           className="w-full bg-black/80 border-4 border-white/5 rounded-[6rem] px-24 py-16 text-6xl font-black text-white uppercase tracking-tighter focus:outline-none focus:border-indigo-500/50 transition-all italic shadow-inner text-center placeholder:text-slate-950 font-mono"
                           placeholder="OMEGA_ARCHIVE_NODE..." autoFocus 
                         />
                      </div>
                      <div className="flex gap-16 items-center pt-16">
                         <button onClick={() => setShowCreateFolder(false)} className="px-16 py-8 text-[18px] font-black text-slate-800 uppercase tracking-[0.6em] hover:text-white transition-all italic border-2 border-white/5 rounded-[3.5rem] hover:bg-white/5 border-none">Abort_Sync</button>
                         <button onClick={handleInitCapsule} className="flex-1 py-16 bg-white text-black rounded-[6rem] text-[24px] font-black uppercase tracking-[0.8em] shadow-[0_60px_150px_rgba(255,255,255,0.2)] hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic scale-105 active:scale-95 border-none group">
                            <Box className="inline mr-8 group-hover:rotate-180 transition-transform duration-1000" size={40} /> Establish Archival Capsule
                         </button>
                      </div>
                   </div>
                </div>
             </motion.div>
           )}
           
           {/* Modals (Tag/Move/Export) follow similar ultra-sovereign pattern */}
           {tagModalIds && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/98 backdrop-blur-3xl" onClick={() => setTagModalIds(null)}>
                  <div className={`${glassStyle} rounded-[10rem] p-32 max-w-5xl w-full border-white/30 relative overflow-hidden shadow-2xl`} onClick={e => e.stopPropagation()}>
                     <div className="flex items-center gap-12 mb-20 border-b border-white/5 pb-16">
                        <Tag size={64} className="text-indigo-400" />
                        <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">Metadata Array Injection</h2>
                     </div>
                     <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="ENTER_METADATA_SEQUENCE..."
                       className="w-full bg-black/80 border-4 border-white/5 rounded-[6rem] px-24 py-20 text-6xl font-black text-white uppercase tracking-tighter focus:outline-none focus:border-indigo-500/50 transition-all italic shadow-inner mb-32 text-center placeholder:text-slate-950 font-mono" 
                     />
                     <div className="flex gap-16 items-center">
                        <button onClick={() => setTagModalIds(null)} className="px-16 py-8 text-[18px] font-black text-slate-800 uppercase tracking-[0.6em] hover:text-white transition-all italic border-none">ABORT_INJECTION</button>
                        <button onClick={handleTagInjection} disabled={busy} className="flex-1 py-16 bg-white text-black rounded-[6rem] text-[24px] font-black uppercase tracking-[0.8em] shadow-2xl hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic scale-105 active:scale-95 border-none group">
                           <Key className="inline mr-8 group-hover:rotate-45 transition-transform" size={40} /> Execute Injection Protocol
                        </button>
                     </div>
                  </div>
               </motion.div>
           )}

           {moveModalIds && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/98 backdrop-blur-3xl" onClick={() => setMoveModalIds(null)}>
                  <div className={`${glassStyle} rounded-[10rem] p-32 max-w-5xl w-full border-white/30 relative overflow-hidden shadow-2xl`} onClick={e => e.stopPropagation()}>
                     <div className="flex items-center gap-12 mb-20 border-b border-white/5 pb-16">
                        <Network size={64} className="text-indigo-400" />
                        <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">Lattice Re-Indexing</h2>
                     </div>
                     <div className="relative mb-32">
                        <select value={moveFolderId} onChange={(e) => setMoveFolderId(e.target.value)}
                           className="w-full bg-black/80 border-4 border-white/5 rounded-[6rem] px-24 py-20 text-5xl font-black text-white uppercase tracking-tighter focus:outline-none appearance-none cursor-pointer italic shadow-inner text-center hover:border-indigo-500/50 transition-all font-mono"
                        >
                           <option value="none">NULL_SECTOR_PRIME</option>
                           {folders.map((f) => <option key={f._id} value={f._id} className="bg-[#020205]">{f.name.toUpperCase()}</option>)}
                        </select>
                        <ChevronRight size={64} className="absolute right-20 top-1/2 -translate-y-1/2 text-white rotate-90 pointer-events-none opacity-20" />
                     </div>
                     <div className="flex gap-16 items-center">
                        <button onClick={() => setMoveModalIds(null)} className="px-16 py-8 text-[18px] font-black text-slate-800 uppercase tracking-[0.6em] hover:text-white transition-all italic border-none">ABORT_SHIFT</button>
                        <button onClick={handleLatticeTransfer} disabled={busy} className="flex-1 py-16 bg-white text-black rounded-[6rem] text-[24px] font-black uppercase tracking-[0.8em] shadow-2xl hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic scale-105 active:scale-95 border-none group">
                           <Link2 className="inline mr-8 group-hover:rotate-45 transition-transform" size={40} /> Initiate Lattice Shift
                        </button>
                     </div>
                  </div>
               </motion.div>
           )}

           {exportModalIds && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-black/98 backdrop-blur-3xl" onClick={() => setExportModalIds(null)}>
                  <div className={`${glassStyle} rounded-[10rem] p-32 max-w-5xl w-full border-white/30 relative overflow-hidden shadow-2xl`} onClick={e => e.stopPropagation()}>
                     <div className="flex items-center gap-12 mb-20 border-b border-white/5 pb-16">
                        <Download size={64} className="text-indigo-400" />
                        <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">Logic Extraction Matrix</h2>
                     </div>
                     <div className="relative mb-32">
                        <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                           className="w-full bg-black/80 border-4 border-white/5 rounded-[6rem] px-24 py-20 text-5xl font-black text-white uppercase tracking-tighter focus:outline-none appearance-none cursor-pointer italic shadow-inner text-center hover:border-indigo-500/50 transition-all font-mono"
                        >
                           <option value="json" className="bg-[#020205]">ENCRYPTED_JSON_PAYLOAD</option>
                           <option value="csv" className="bg-[#020205]">RAW_CSV_LATTICE</option>
                        </select>
                        <ChevronRight size={64} className="absolute right-20 top-1/2 -translate-y-1/2 text-white rotate-90 pointer-events-none opacity-20" />
                     </div>
                     <div className="flex gap-16 items-center">
                        <button onClick={() => setExportModalIds(null)} className="px-16 py-8 text-[18px] font-black text-slate-800 uppercase tracking-[0.6em] hover:text-white transition-all italic border-none">ABORT_EXTRACTION</button>
                        <button onClick={handleExtraction} disabled={busy} className="flex-1 py-16 bg-white text-black rounded-[6rem] text-[24px] font-black uppercase tracking-[0.8em] shadow-2xl hover:bg-indigo-500 hover:text-white transition-all duration-1000 italic scale-105 active:scale-95 border-none group">
                           <Download className="inline mr-8 group-hover:translate-y-4 transition-transform" size={40} /> Decipher & Extract
                        </button>
                     </div>
                  </div>
               </motion.div>
           )}
        </AnimatePresence>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          button:disabled { cursor: not-allowed; opacity: 0.1; }
          select { border: none; outline: none; appearance: none; background: transparent; }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
