'use client'

import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import { useTranslation } from '../../../../hooks/useTranslation'
import { apiGet, apiPost, API_URL } from '../../../../lib/api'
import {
  Sparkles, ArrowLeft, Send, Copy, Check, Hash, Zap,
  ChevronRight, RefreshCw, ArrowUpRight, Layers, AlertCircle,
  CheckCircle, Radio, Cpu, Activity, Shield, Globe, Target, Flame, Terminal, X,
  LayoutGrid, LayoutList, FileText, Share2, Network, Gauge, Compass,
  Monitor, Boxes, Command, CircuitBoard, ActivitySquare, Database, Link2,
  Box, Fingerprint, History, MessageSquare, BarChart3, Languages, Star,
  Settings, Trash2, Edit3, ExternalLink, Heart, Award, Info, Search
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../../components/ToastContainer'

// Lazy load heavy components
const VersionHistory = lazy(() => import('../../../../components/VersionHistory'))
const CommentsSection = lazy(() => import('../../../../components/CommentsSection'))
const ContentPerformanceAnalytics = lazy(() => import('../../../../components/ContentPerformanceAnalytics'))
const LiveCollaboration = lazy(() => import('../../../../components/LiveCollaboration'))
const ContentInsights = lazy(() => import('../../../../components/ContentInsights'))
const ContentHealthChecker = lazy(() => import('../../../../components/ContentHealthChecker'))
const ContentSchedulingAssistant = lazy(() => import('../../../../components/ContentSchedulingAssistant'))
const ContentDuplicator = lazy(() => import('../../../../components/ContentDuplicator'))
const OneClickPublish = lazy(() => import('../../../../components/OneClickPublish'))
const ContentApprovalButton = lazy(() => import('../../../../components/ContentApprovalButton'))

interface Content {
  _id: string; title: string; description: string; type: string; status: string;
  transcript: string; body?: string; generatedContent: any; tags: string[];
  category: string; isFavorite: boolean;
  folderId?: { _id: string; name: string; color: string; };
  createdAt: string; updatedAt: string;
}

const glassStyle = 'backdrop-blur-xl bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-500'

export default function ContentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useTranslation()
  
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'comments' | 'performance' | 'translations'>('overview')
  const [translationList, setTranslationList] = useState<{ language: string; _id: string }[]>([])
  const [supportedLangs, setSupportedLangs] = useState<{ code: string; name: string }[]>([])
  const [viewingLang, setViewingLang] = useState<string | null>(null)
  const [translatedContent, setTranslatedContent] = useState<{ title: string; description: string; body: string; transcript: string; tags: string[] } | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('es')

  const loadContent = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/content/${params.id}`)
      const contentData = extractApiData<Content>(response) || (response.data && response.data._id ? response.data : null)
      if (contentData) setContent(contentData)
    } catch (error) {
      const errorObj = extractApiError(error)
      showToast(typeof errorObj === 'string' ? errorObj : errorObj?.message || 'Failed to load content', 'error')
      router.push('/dashboard/content')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (params.id) loadContent()
  }, [user, router, params.id, loadContent])

  const loadTranslations = useCallback(async () => {
    if (!content?._id) return
    try {
      const [listRes, langsRes] = await Promise.all([
        apiGet<{ translations?: { language: string; _id: string }[] }>('/translation/content/' + content._id + '/translations'),
        apiGet<{ languages?: { code: string; name: string }[] }>('/translation/languages')
      ])
      setTranslationList((listRes as any)?.translations || (listRes as any)?.data?.translations || [])
      setSupportedLangs((langsRes as any)?.languages || (langsRes as any)?.data?.languages || [])
    } catch {
      setTranslationList([])
      setSupportedLangs([])
    }
  }, [content?._id])

  useEffect(() => {
    if (activeTab === 'translations' && content?._id) loadTranslations()
  }, [activeTab, content?._id, loadTranslations])

  const handleTranslate = async () => {
    if (!content?._id || !targetLanguage || isTranslating) return
    setIsTranslating(true)
    try {
      await apiPost('/translation/translate', { contentId: content._id, targetLanguage })
      showToast(t('translation.translated'), 'success')
      await loadTranslations()
    } catch (e: any) {
      showToast(t('translation.translationFailed') + ': ' + (e?.response?.data?.error || e?.message || ''), 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleTranslateToAll = async () => {
    if (!content?._id || isTranslating) return
    setIsTranslating(true)
    try {
      const res = await apiPost<{ successful?: any[]; failed?: any[] }>('/translation/translate-multiple', {
        contentId: content._id, languages: ['es', 'fr', 'de']
      })
      const ok = (res as any)?.successful?.length || 0
      const fail = (res as any)?.failed?.length || 0
      showToast(t('translation.translated') + ` (${ok} ok${fail ? `, ${fail} failed` : ''})`, fail ? 'info' : 'success')
      await loadTranslations()
    } catch (e: any) {
      showToast(t('translation.translationFailed') + ': ' + (e?.response?.data?.error || e?.message || ''), 'error')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleViewInLanguage = async (lang: string) => {
    if (!content?._id) return
    try {
      const res = await apiGet<any>('/translation/content/' + content._id + '/' + lang + '?fallbackToOriginal=true')
      const d = (res as any)?.data || res
      if (d) {
        setViewingLang(lang)
        setTranslatedContent({
          title: d.title || '', description: d.description || '',
          body: d.body || '', transcript: d.transcript || '', tags: d.tags || []
        })
      }
    } catch {
      showToast(t('translation.translationFailed'), 'error')
    }
  }

  const handleToggleFavorite = async () => {
    if (!content) return
    try {
      await axios.put(`${API_URL}/library/content/${content._id}/organize`, { isFavorite: !content.isFavorite })
      setContent({ ...content, isFavorite: !content.isFavorite })
      showToast(!content.isFavorite ? 'Node added to favorites' : 'Node removed from favorites', 'success')
    } catch { showToast('Failed to update node importance', 'error') }
  }

  const handleAddTag = async (tag: string) => {
    if (!content || !tag.trim()) return
    const newTags = [...(content.tags || []), tag.trim()]
    try {
      await axios.put(`${API_URL}/library/content/${content._id}/organize`, { tags: newTags })
      setContent({ ...content, tags: newTags })
      showToast('Axiom tag mapped', 'success')
    } catch { showToast('Mapping failed', 'error') }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020205]">
      <Activity size={80} className="text-indigo-500 animate-pulse mb-8" />
      <span className="text-[14px] font-black text-slate-800 uppercase tracking-[1em] animate-pulse italic">Scanning Neural Patterns...</span>
    </div>
  )

  if (!content) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020205]">
      <div className="text-center space-y-8 p-20 rounded-[4rem] border border-white/5 bg-white/[0.02]">
        <AlertCircle size={100} className="text-rose-500 mx-auto" />
        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Node Not Found</h2>
        <button onClick={() => router.push('/dashboard/content')} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest italic hover:bg-indigo-500 transition-all">ABORT_TO_REPOSITORY</button>
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-48 px-10 pt-16 max-w-[1750px] mx-auto space-y-24">
        <ToastContainer />
        <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
           <Fingerprint size={800} className="text-white absolute -bottom-40 -left-40 rotate-12" />
        </div>

        {/* Diagnostic Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-16 relative z-50">
           <div className="flex items-center gap-12">
              <button onClick={() => router.push('/dashboard/content')} title="Back"
                className="w-16 h-16 rounded-[1.8rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-800 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <ArrowLeft size={36} />
              </button>
              <div className="w-24 h-24 bg-indigo-500/5 border border-indigo-500/20 rounded-[3rem] flex items-center justify-center shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-100" />
                <CircuitBoard size={48} className="text-indigo-400 relative z-10 group-hover:rotate-90 transition-transform duration-1000" />
              </div>
              <div>
                 <div className="flex items-center gap-6 mb-3">
                   <div className="flex items-center gap-3">
                      <Network size={16} className="text-indigo-400 animate-pulse" />
                      <span className="text-[12px] font-black uppercase tracking-[0.6em] text-indigo-400 italic leading-none">Cognitive Diagnostic v5.2</span>
                   </div>
                   <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                       <Radio size={14} className="text-emerald-400 animate-pulse" />
                       <span className="text-[10px] font-black text-emerald-400 tracking-widest uppercase italic leading-none">OP_INTEGRITY_STABLE</span>
                   </div>
                 </div>
                 <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">{content.title || 'NULL_NODE'}</h1>
                 <p className="text-slate-800 text-[16px] uppercase font-black tracking-[0.5em] italic leading-none">Analyzing spectral resonance and temporal deployment vectors for asset {content._id}.</p>
              </div>
           </div>

           <div className="flex items-center gap-8">
              <button onClick={handleToggleFavorite}
                className={`w-20 h-20 rounded-[2.2rem] flex items-center justify-center transition-all duration-1000 shadow-2xl ${content.isFavorite ? 'bg-amber-500 text-white' : 'bg-white/[0.03] border border-white/10 text-slate-800 hover:text-white'}`}>
                <Star size={36} className={content.isFavorite ? 'fill-current' : ''} />
              </button>
              <button onClick={() => router.push('/dashboard/library')}
                className="px-16 py-8 bg-white text-black hover:bg-indigo-500 hover:text-white rounded-[3.5rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-2xl transition-all duration-1000 flex items-center gap-8 italic active:scale-95 group border-none">
                <Box size={28} className="group-hover:rotate-12 transition-transform" />
                ORGANIZE_NODE
              </button>
           </div>
        </header>

        {/* Diagnostic Tabs */}
        <nav className="flex gap-12 relative z-10 border-b border-white/5 pb-8 overflow-x-auto custom-scrollbar">
           {[
             { id: 'overview', label: 'Spectral Overview', icon: LayoutGrid },
             { id: 'versions', label: 'Temporal Iterations', icon: History },
             { id: 'comments', label: 'Neural Feedback', icon: MessageSquare },
             { id: 'performance', label: 'Resonance Metrics', icon: BarChart3 },
             { id: 'translations', label: 'Transpositions', icon: Languages },
           ].map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id as any)}
               className={`flex items-center gap-6 px-10 py-6 rounded-[2.5rem] transition-all duration-1000 relative overflow-hidden group ${activeTab === t.id ? 'bg-white text-black shadow-[0_30px_60px_rgba(255,255,255,0.1)]' : 'bg-white/[0.02] border border-white/5 text-slate-800 hover:text-white hover:border-white/20'}`}>
               <t.icon size={28} className={activeTab === t.id ? 'text-black' : 'text-slate-900 group-hover:text-white transition-colors'} />
               <span className="text-[14px] font-black uppercase tracking-[0.2em] italic">{t.label}</span>
               {activeTab === t.id && <motion.div layoutId="tab-glow" className="absolute inset-0 bg-white/10" />}
             </button>
           ))}
        </nav>

        {/* Tab Content */}
        <div className="relative z-10 min-h-[1000px]">
           <AnimatePresence mode="wait">
             {activeTab === 'overview' && (
               <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="grid grid-cols-1 lg:grid-cols-3 gap-20">
                  <div className="lg:col-span-2 space-y-16">
                     {content.description && (
                        <div className={`${glassStyle} rounded-[5rem] p-16 space-y-10 group bg-black/40`}>
                           <div className="flex items-center gap-6 mb-4">
                              <Info size={32} className="text-indigo-400" />
                              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Strategic Intent</h2>
                           </div>
                           <p className="text-2xl font-black text-slate-300 italic leading-relaxed uppercase tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity duration-1000">{content.description}</p>
                        </div>
                     )}

                     {content.transcript && (
                        <div className={`${glassStyle} rounded-[5rem] p-16 space-y-10 group bg-black/40`}>
                           <div className="flex items-center gap-6 mb-4">
                              <CircuitBoard size={32} className="text-emerald-400" />
                              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Spectral Transcript</h2>
                           </div>
                           <p className="text-xl font-black text-slate-400 italic leading-relaxed uppercase tracking-tighter opacity-40 group-hover:opacity-80 transition-opacity duration-1000 whitespace-pre-wrap">{content.transcript}</p>
                        </div>
                     )}

                     {content.generatedContent && (
                        <div className={`${glassStyle} rounded-[6rem] p-16 space-y-16 group bg-black/40 border-indigo-500/10`}>
                           <div className="flex items-center justify-between border-b border-white/5 pb-10">
                              <div className="flex items-center gap-8">
                                 <Sparkles size={44} className="text-indigo-400" />
                                 <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Synthetic Manifests</h2>
                              </div>
                              <div className="px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">NEURAL_SYNC_SUCCESS</div>
                           </div>
                           {content.generatedContent.socialPosts && (
                              <div className="space-y-12">
                                 {content.generatedContent.socialPosts.map((post: any, idx: number) => (
                                    <div key={idx} className="p-10 bg-white/[0.02] border border-white/5 rounded-[4rem] group/post hover:bg-white/[0.04] transition-all duration-1000 shadow-2xl relative overflow-hidden">
                                       <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover/post:opacity-5 transition-opacity rotate-12"><Share2 size={150} /></div>
                                       <div className="flex justify-between items-center mb-10 relative z-10">
                                          <div className="flex items-center gap-6">
                                             <span className="px-8 py-3 bg-indigo-500 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.4em] italic shadow-2xl">{post.platform} NODE</span>
                                             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                                          </div>
                                          <button onClick={() => { navigator.clipboard.writeText(post.content); showToast('Logic Captured', 'success') }}
                                             className="w-16 h-16 rounded-[1.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
                                             <Copy size={24} />
                                          </button>
                                       </div>
                                       <p className="text-3xl font-black text-slate-200 italic leading-tight uppercase tracking-tighter mb-10 group-hover:text-indigo-400 transition-colors duration-1000 relative z-10">{post.content}</p>
                                       {post.hashtags && post.hashtags.length > 0 && (
                                          <div className="flex flex-wrap gap-4 relative z-10">
                                             {post.hashtags.map((tag: string, i: number) => (
                                                <span key={i} className="text-[12px] font-black text-indigo-400 bg-indigo-500/10 px-6 py-2 rounded-2xl border border-indigo-500/20 italic">#{tag.toUpperCase()}</span>
                                             ))}
                                          </div>
                                       )}
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  <aside className="space-y-12">
                     {/* Resonance Injection Control */}
                     <div className={`${glassStyle} rounded-[4.5rem] p-10 space-y-6 bg-black/60 shadow-[0_60px_100px_rgba(0,0,0,0.6)] border-indigo-500/10`}>
                        <div className="flex items-center gap-6 mb-4 px-4">
                           <Zap size={32} className="text-amber-400" />
                           <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">Resonance Injection</h3>
                        </div>
                        <div className="flex gap-4">
                           <ContentDuplicator contentId={content._id} onDuplicate={(newId) => router.push(`/dashboard/content/${newId}`)} className="flex-1" />
                           <OneClickPublish contentId={content._id} />
                        </div>
                     </div>

                     {/* Integrity Auditor HUD */}
                     <ContentHealthChecker
                        content={{
                           text: content.transcript || content.description || '',
                           title: content.title,
                           tags: content.tags,
                           description: content.description,
                           type: content.type,
                        }}
                        onFix={(issue, suggestion) => showToast(`Integrity Fix: ${suggestion}`, 'info')}
                     />

                     {/* Spectral Insights */}
                     <ContentInsights contentId={content._id} compact={true} />

                     {/* Temporal Deployment Sync */}
                     <ContentSchedulingAssistant
                        contentId={content._id}
                        content={{ text: content.transcript || content.description, type: content.type }}
                     />

                     {/* Node Metadata Diagnostic */}
                     <div className={`${glassStyle} rounded-[5rem] p-16 space-y-12 bg-black/40`}>
                        <div className="flex items-center gap-6 mb-4">
                           <Settings size={32} className="text-slate-800" />
                           <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Node Diagnostic</h2>
                        </div>
                        <div className="space-y-10">
                           {[
                              { label: 'Asset Type', val: content.type, icon: Box },
                              { label: 'Operational Status', val: content.status, icon: Radio },
                              { label: 'Spectral Category', val: content.category || 'General', icon: Target },
                              { label: 'Creation Vector', val: new Date(content.createdAt).toLocaleString(), icon: History },
                              { label: 'Last Sync', val: new Date(content.updatedAt).toLocaleString(), icon: RefreshCw },
                           ].map((s, i) => (
                              <div key={i} className="flex items-center justify-between group/stat">
                                 <div className="flex items-center gap-5">
                                    <s.icon size={18} className="text-slate-900 group-hover/stat:text-indigo-400 transition-colors" />
                                    <p className="text-[12px] font-black text-slate-800 uppercase tracking-[0.4em] italic leading-none">{s.label}</p>
                                 </div>
                                 <p className="text-[14px] font-black text-white uppercase tracking-widest italic group-hover/stat:text-indigo-400 transition-colors leading-none">{s.val}</p>
                              </div>
                           ))}
                        </div>
                     </div>

                     {/* Axiom Mapping */}
                     <div className={`${glassStyle} rounded-[5rem] p-16 space-y-12 bg-black/40`}>
                        <div className="flex items-center gap-6 mb-4">
                           <Hash size={32} className="text-indigo-400" />
                           <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">Axiom Mapping</h2>
                        </div>
                        <div className="flex flex-wrap gap-4">
                           {content.tags && content.tags.map((tag, index) => (
                              <span key={index} className="px-8 py-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-3xl text-[12px] font-black italic tracking-widest uppercase shadow-2xl hover:bg-indigo-500 hover:text-white transition-all duration-700">
                                 #{tag.toUpperCase()}
                              </span>
                           ))}
                        </div>
                        <div className="relative group/tag-in">
                           <input type="text" placeholder="INITIALIZE_TAG..." onKeyPress={(e) => { if (e.key === 'Enter') { handleAddTag(e.currentTarget.value); e.currentTarget.value = '' } }}
                              className="w-full bg-black/60 border-2 border-white/5 rounded-[2.5rem] px-10 py-6 text-xl font-black text-white uppercase italic tracking-tighter focus:border-indigo-500/50 transition-all placeholder:text-slate-950 shadow-inner" />
                           <Search size={24} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-950 group-focus-within/tag-in:text-indigo-500 transition-colors" />
                        </div>
                     </div>
                  </aside>
               </motion.div>
             )}

             {activeTab === 'versions' && (
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`${glassStyle} rounded-[6rem] p-20 bg-black/40 border-indigo-500/10`}>
                  <Suspense fallback={<div className="flex justify-center p-48"><RefreshCw size={64} className="animate-spin text-indigo-500" /></div>}>
                     <VersionHistory contentId={content._id} onRestore={loadContent} />
                  </Suspense>
               </motion.div>
             )}

             {activeTab === 'comments' && (
               <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className={`${glassStyle} rounded-[6rem] p-20 bg-black/40 border-indigo-500/10`}>
                  <Suspense fallback={<div className="flex justify-center p-48"><RefreshCw size={64} className="animate-spin text-indigo-500" /></div>}>
                     <CommentsSection entityType="content" entityId={content._id} teamId={undefined} />
                  </Suspense>
               </motion.div>
             )}

             {activeTab === 'performance' && (
               <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`${glassStyle} rounded-[6rem] p-20 bg-black/40 border-indigo-500/10`}>
                  <Suspense fallback={<div className="flex justify-center p-48"><RefreshCw size={64} className="animate-spin text-indigo-500" /></div>}>
                     <ContentPerformanceAnalytics contentId={content._id} />
                  </Suspense>
               </motion.div>
             )}

             {activeTab === 'translations' && (
               <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="space-y-16">
                  <div className={`${glassStyle} rounded-[6rem] p-20 space-y-16 bg-black/40 border-purple-500/10`}>
                     <div className="flex items-center justify-between border-b border-white/5 pb-12">
                        <div className="flex items-center gap-10">
                           <div className="w-20 h-20 rounded-[2.5rem] bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-2xl relative group overflow-hidden">
                              <Languages size={40} className="text-purple-400 group-hover:rotate-180 transition-transform duration-1000" />
                           </div>
                           <div>
                              <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">{t('translation.title')}</h2>
                              <p className="text-[14px] font-black text-slate-800 uppercase tracking-[0.5em] italic leading-none">{t('translation.translateTo')} operational nodes.</p>
                           </div>
                        </div>
                        <div className="flex gap-8">
                           <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}
                              className="px-8 py-5 bg-black/60 border-2 border-white/5 rounded-[2rem] text-xl font-black text-white uppercase italic tracking-tighter focus:border-purple-500/50 transition-all shadow-inner outline-none">
                              {(supportedLangs.length > 0 ? supportedLangs : [{ code: 'es', name: 'SPANISH' }, { code: 'fr', name: 'FRENCH' }, { code: 'de', name: 'GERMAN' }]).map((l) => (
                                 <option key={l.code} value={l.code}>{l.name.toUpperCase()}</option>
                              ))}
                           </select>
                           <button onClick={handleTranslate} disabled={isTranslating}
                              className="px-16 py-8 bg-purple-600 text-white rounded-[3rem] text-[15px] font-black uppercase tracking-[0.6em] shadow-[0_40px_100px_rgba(147,51,234,0.3)] hover:bg-white hover:text-black transition-all duration-1000 italic disabled:opacity-20 active:scale-95 group">
                              {isTranslating ? t('translation.translating') : <span><Zap className="inline mr-4 group-hover:scale-125 transition-transform" /> {t('translation.translate')}</span>}
                           </button>
                        </div>
                     </div>
                     
                     <div className="flex flex-wrap gap-6 items-center">
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-[1em] italic leading-none mr-6">SYNCHRONIZED_MATRICES:</span>
                        {viewingLang && (
                           <button onClick={() => setViewingLang(null)}
                              className="px-10 py-5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic shadow-inner hover:bg-amber-500 hover:text-white transition-all">
                              {t('translation.viewOriginal')}
                           </button>
                        )}
                        {translationList.map((tr) => (
                           <button key={tr._id} onClick={() => handleViewInLanguage(tr.language)}
                              className={`px-10 py-5 rounded-[2rem] text-[12px] font-black uppercase tracking-widest italic transition-all duration-1000 ${viewingLang === tr.language ? 'bg-purple-600 text-white shadow-2xl' : 'bg-white/[0.02] border border-white/5 text-slate-800 hover:text-white hover:border-white/20 shadow-inner'}`}>
                              {t('translation.viewIn')} {tr.language.toUpperCase()}_NODE
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                     {(() => {
                        const display = viewingLang && translatedContent
                           ? { ...translatedContent, _lang: viewingLang }
                           : { title: content.title, description: content.description, body: content.body || content.transcript, transcript: content.transcript, tags: content.tags || [], _lang: null }
                        return (
                           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${glassStyle} rounded-[6rem] p-20 bg-black/60 shadow-[0_80px_200px_rgba(0,0,0,0.8)] border-purple-500/10 group`}>
                              <div className="flex items-center gap-6 mb-12 border-l-8 border-purple-500 pl-8">
                                 <div>
                                    <h3 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-4 group-hover:text-purple-400 transition-colors duration-1000">{display.title || 'NULL_TITLE'}</h3>
                                    {display._lang && <span className="text-[12px] font-black text-purple-500 uppercase tracking-[0.8em] italic leading-none">{t('translation.viewIn')} {display._lang.toUpperCase()}_NODE</span>}
                                 </div>
                              </div>
                              <div className="space-y-16">
                                 {display.description && (
                                    <div className="space-y-6">
                                       <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none border-b border-white/5 pb-4">Logic Intent Mapping</h4>
                                       <p className="text-3xl font-black text-slate-300 italic leading-relaxed uppercase tracking-tighter drop-shadow-2xl opacity-80 group-hover:opacity-100 transition-opacity duration-1000">{display.description}</p>
                                    </div>
                                 )}
                                 {display.body && (
                                    <div className="space-y-6">
                                       <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-[0.8em] italic leading-none border-b border-white/5 pb-4">Manifest Payload Core</h4>
                                       <p className="text-2xl font-black text-slate-400 italic leading-relaxed uppercase tracking-tighter opacity-60 group-hover:opacity-90 transition-opacity duration-1000 whitespace-pre-wrap">{display.body}</p>
                                    </div>
                                 )}
                                 {display.tags && display.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-5 pt-10 border-t border-white/5">
                                       {display.tags.map((tag: string, i: number) => (
                                          <span key={i} className="px-10 py-4 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-3xl text-[14px] font-black italic tracking-widest uppercase shadow-inner">#{tag.toUpperCase()}</span>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </motion.div>
                        )
                     })()}
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Real-time Synergetic Matrix */}
        <Suspense fallback={<div className="fixed bottom-10 right-10 w-24 h-24 rounded-full bg-white/[0.03] animate-pulse" />}>
           <LiveCollaboration contentId={content._id} onContentChange={() => {}} />
        </Suspense>

        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: #020205; color: white; overflow-x: hidden; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
        `}</style>
      </div>
    </ErrorBoundary>
  )
}
