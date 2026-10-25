'use client'

import { loginPathForCurrentPage } from '../../../../lib/authRedirect'
import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import VideoCaptionEditor from '../../../../components/VideoCaptionEditor'
import { RemediationHUD } from '../../../../components/editor/views/RemediationHUD'
import AIContentAnalysis from '../../../../components/AIContentAnalysis'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import { useTranslation } from '../../../../hooks/useTranslation'
import { apiGet, apiPost, API_URL } from '../../../../lib/api'
import {
  Sparkles, ArrowLeft, Send, Copy, Check, Hash, Zap,
  ChevronRight, RefreshCw, ArrowUpRight, Layers, AlertCircle,
  CheckCircle, Radio, Cpu, Shield, Globe, Target, Flame, Terminal, X,
  LayoutGrid, LayoutList, FileText, Share2, Network, Gauge, Compass,
  Monitor, Boxes, Command, CircuitBoard, ActivitySquare, Database, Link2,
  Box, Fingerprint, History, MessageSquare, BarChart3, Languages, Star,
  Settings, Trash2, Edit3, ExternalLink, Heart, Award, Info, Search
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import ToastContainer from '../../../../components/ToastContainer'
import { ContentSkeleton } from '../../../../components/LoadingSkeleton'
import { PageShell, PageHeader, DetailLayout, Panel, SectionHeader, Button, IconButton, Input, EmptyState } from '../../../../components/ui'
import ContentBenchmarking from '../../../../components/ContentBenchmarking'

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
  // The API returns the whole document; the page simply had not declared this.
  // AIContentAnalysis needs the source file to analyse.
  originalFile?: { url?: string };
  createdAt: string; updatedAt: string;
}


export default function ContentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
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
      showToast(typeof errorObj === 'string' ? errorObj : errorObj?.message || t('contentDetailPage.loadFailed'), 'error')
      router.push('/dashboard/content')
    } finally {
      setLoading(false)
    }
  }, [params.id, router, showToast, t])

  useEffect(() => {
    if (authLoading) return // user is null until /auth/me answers
    if (!user) { router.push(loginPathForCurrentPage()); return }
    if (params.id) loadContent()
  }, [user, authLoading, router, params.id, loadContent])

  const loadTranslations = useCallback(async () => {
    if (!content?._id) return
    try {
      const [listRes, langsRes] = await Promise.all([
        apiGet<{ translations?: { language: string; _id: string }[] }>('/translation/content/' + content._id + '/translations', undefined, false),
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
      showToast(t('translation.translationFailedWith', { error: e?.response?.data?.error || e?.message || '' }), 'error')
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
      // The route answers the {success, data: {successful, failed, skipped}} envelope.
      const summary = (res as any)?.data ?? res
      const ok = (summary?.successful?.length || 0) + (summary?.skipped?.length || 0)
      const fail = summary?.failed?.length || 0
      // Interpolated so RTL/word-order languages can position {{ok}} and
      // {{fail}} naturally in their sentence — concatenation broke Arabic.
      showToast(
        fail > 0
          ? t('translation.translatedWithFailures', { ok, fail })
          : t('translation.translatedWithCount', { ok }),
        fail ? 'info' : 'success'
      )
      await loadTranslations()
    } catch (e: any) {
      showToast(t('translation.translationFailedWith', { error: e?.response?.data?.error || e?.message || '' }), 'error')
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
      showToast(!content.isFavorite ? t('contentDetailPage.favoriteAdded') : t('contentDetailPage.favoriteRemoved'), 'success')
    } catch { showToast(t('contentDetailPage.favoriteFailed'), 'error') }
  }

  const handleAddTag = async (tag: string) => {
    if (!content || !tag.trim()) return
    const newTags = [...(content.tags || []), tag.trim()]
    try {
      await axios.put(`${API_URL}/library/content/${content._id}/organize`, { tags: newTags })
      setContent({ ...content, tags: newTags })
      showToast(t('contentDetailPage.tagAdded'), 'success')
    } catch { showToast(t('contentDetailPage.tagFailed'), 'error') }
  }

  if (loading) return (
    <PageShell width="wide" aria-busy="true" aria-label={t('common.loading')}>
      <ContentSkeleton />
    </PageShell>
  )

  if (!content) return (
    <PageShell width="narrow">
      <EmptyState
        icon={AlertCircle}
        title={t('contentDetailPage.notFound')}
        description={t('contentDetailPage.notFoundDesc')}
        action={
          <Button variant="primary" onClick={() => router.push('/dashboard/content')} leftIcon={<ArrowLeft size={16} aria-hidden />}>
            {t('contentDetailPage.backToContent')}
          </Button>
        }
      />
    </PageShell>
  )

  const TABS = [
    { id: 'overview', label: t('contentDetailPage.tabOverview'), icon: LayoutGrid },
    { id: 'versions', label: t('contentDetailPage.tabVersions'), icon: History },
    { id: 'comments', label: t('contentDetailPage.tabComments'), icon: MessageSquare },
    { id: 'performance', label: t('contentDetailPage.tabPerformance'), icon: BarChart3 },
    { id: 'translations', label: t('contentDetailPage.tabTranslations'), icon: Languages },
  ] as const

  const statusKey = (content.status || 'draft').toLowerCase()
  const spinner = (
    <div className="flex justify-center p-12"><RefreshCw size={28} className="animate-spin text-indigo-500" aria-hidden /></div>
  )

  return (
    <ErrorBoundary>
      <PageShell width="wide">
        <ToastContainer />

        <PageHeader
          as="h2"
          breadcrumbs={[
            { label: t('contentDetailPage.breadcrumbContent'), href: '/dashboard/content' },
            { label: content.title || t('contentDetailPage.untitled') },
          ]}
          title={<span className="break-words">{content.title || t('contentDetailPage.untitled')}</span>}
          meta={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {t(`dashboard.recent.status.${statusKey}`)}
            </span>
          }
          description={t('contentDetailPage.subtitle', { type: content.type || 'content', date: new Date(content.createdAt).toLocaleDateString() })}
          actions={
            <>
              <Button variant="ghost" size="md" onClick={() => router.push('/dashboard/content')} leftIcon={<ArrowLeft size={16} aria-hidden />}>
                {t('common.back')}
              </Button>
              <IconButton
                variant="secondary"
                size="md"
                onClick={handleToggleFavorite}
                aria-pressed={content.isFavorite}
                aria-label={content.isFavorite ? t('contentDetailPage.unfavorite') : t('contentDetailPage.favorite')}
                title={content.isFavorite ? t('contentDetailPage.unfavorite') : t('contentDetailPage.favorite')}
              >
                <Star size={18} className={content.isFavorite ? 'fill-amber-400 text-amber-400' : ''} aria-hidden />
              </IconButton>
              <Button variant="secondary" size="md" onClick={() => router.push('/dashboard/library')} leftIcon={<Box size={16} aria-hidden />}>
                {t('contentDetailPage.organize')}
              </Button>
            </>
          }
        />

        {/* Tabs */}
        <nav aria-label={t('contentDetailPage.sections')} className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-1">
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'border-indigo-500 text-theme-primary' : 'border-transparent text-theme-muted hover:text-theme-primary'}`}
              >
                <tab.icon size={16} aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Tab Content */}
        <div>
           <AnimatePresence mode="wait">
             {activeTab === 'overview' && (
               <m.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                 <DetailLayout
                   aside={
                     <>
                       <Panel>
                         <SectionHeader as="h3" title={t('contentDetailPage.quickActions')} className="mb-4" />
                         <div className="flex flex-wrap gap-2">
                           <ContentDuplicator contentId={content._id} onDuplicate={(newId) => router.push(`/dashboard/content/${newId}`)} className="flex-1" />
                           <OneClickPublish contentId={content._id} />
                         </div>
                       </Panel>

                       <ContentHealthChecker
                          content={{
                             text: content.transcript || content.description || '',
                             title: content.title,
                             tags: content.tags,
                             description: content.description,
                             type: content.type,
                          }}
                          onFix={(issue, suggestion) => showToast(t('contentDetailPage.suggestionToast', { suggestion }), 'info')}
                       />

                       <ContentInsights contentId={content._id} compact={true} />

                       <ContentSchedulingAssistant
                          contentId={content._id}
                          content={{ text: content.transcript || content.description, type: content.type, platform: (content as any).platform || (content as any).platforms?.[0] }}
                       />

                       <Panel>
                         <SectionHeader as="h3" title={t('contentDetailPage.details')} className="mb-4" />
                         <dl className="space-y-3">
                           {[
                             { label: t('contentDetailPage.fieldType'), val: content.type, icon: Box },
                             { label: t('contentDetailPage.fieldStatus'), val: t(`dashboard.recent.status.${statusKey}`), icon: Radio },
                             { label: t('contentDetailPage.fieldCategory'), val: content.category || t('contentDetailPage.categoryGeneral'), icon: Target },
                             { label: t('contentDetailPage.fieldCreated'), val: new Date(content.createdAt).toLocaleString(), icon: History },
                             { label: t('contentDetailPage.fieldUpdated'), val: new Date(content.updatedAt).toLocaleString(), icon: RefreshCw },
                           ].map((s, i) => (
                             <div key={i} className="flex items-center justify-between gap-4">
                               <dt className="flex items-center gap-2 ds-text-caption text-theme-muted">
                                 <s.icon size={14} aria-hidden />
                                 {s.label}
                               </dt>
                               <dd className="text-sm font-medium text-theme-primary text-right first-letter:uppercase">{s.val}</dd>
                             </div>
                           ))}
                         </dl>
                       </Panel>

                       <Panel>
                         <SectionHeader as="h3" title={t('contentDetailPage.tags')} className="mb-4" />
                         {content.tags && content.tags.length > 0 ? (
                           <div className="mb-4 flex flex-wrap gap-2">
                             {content.tags.map((tag, index) => (
                               <span key={index} className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                                 #{tag}
                               </span>
                             ))}
                           </div>
                         ) : (
                           <p className="mb-4 ds-text-caption text-theme-muted">{t('contentDetailPage.noTags')}</p>
                         )}
                         <div className="relative">
                           <Hash size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" aria-hidden />
                           <Input
                             type="text"
                             aria-label={t('contentDetailPage.addTag')}
                             placeholder={t('contentDetailPage.addTag')}
                             className="pl-9"
                             onKeyDown={(e) => { if (e.key === 'Enter') { handleAddTag(e.currentTarget.value); e.currentTarget.value = '' } }}
                           />
                         </div>
                       </Panel>
                     </>
                   }
                 >
                   <div className="flex flex-col gap-6">
                     {content.description && (
                       <Panel>
                         <SectionHeader as="h3" title={t('contentDetailPage.description')} className="mb-3" />
                         <p className="ds-text-body text-theme-secondary whitespace-pre-wrap">{content.description}</p>
                       </Panel>
                     )}

                     {content.transcript && (
                       <Panel>
                         <SectionHeader as="h3" title={t('contentDetailPage.transcript')} className="mb-3" />
                         <p className="ds-text-body text-theme-secondary whitespace-pre-wrap max-h-96 overflow-y-auto">{content.transcript}</p>
                       </Panel>
                     )}

                     {content.generatedContent && (
                       <Panel>
                         <SectionHeader
                           as="h3"
                           title={t('contentDetailPage.generatedContent')}
                           actions={<span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{t('contentDetailPage.aiGenerated')}</span>}
                           className="mb-4"
                         />
                         {Array.isArray(content.generatedContent.socialPosts) && content.generatedContent.socialPosts.length > 0 ? (
                           <div className="space-y-3">
                             {content.generatedContent.socialPosts.map((post: any, idx: number) => (
                               <div key={idx} className="ds-surface-subtle p-4">
                                 <div className="mb-2 flex items-center justify-between gap-3">
                                   <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold capitalize text-indigo-600 dark:text-indigo-300">{post.platform}</span>
                                   <IconButton
                                     variant="ghost"
                                     size="sm"
                                     aria-label={t('contentDetailPage.copy')}
                                     title={t('contentDetailPage.copy')}
                                     onClick={() => { navigator.clipboard.writeText(post.content); showToast(t('contentDetailPage.copied'), 'success') }}
                                   >
                                     <Copy size={16} aria-hidden />
                                   </IconButton>
                                 </div>
                                 <p className="ds-text-body text-theme-primary whitespace-pre-wrap">{post.content}</p>
                                 {post.hashtags && post.hashtags.length > 0 && (
                                   <div className="mt-3 flex flex-wrap gap-1.5">
                                     {post.hashtags.map((tag: string, i: number) => (
                                       <span key={i} className="text-xs font-medium text-indigo-600 dark:text-indigo-300">#{tag}</span>
                                     ))}
                                   </div>
                                 )}
                               </div>
                             ))}
                           </div>
                         ) : (
                           <p className="ds-text-caption text-theme-muted">{t('contentDetailPage.noGenerated')}</p>
                         )}
                       </Panel>
                     )}

                     {!content.description && !content.transcript && !content.generatedContent && (
                       <Panel>
                         <EmptyState icon={FileText} title={t('contentDetailPage.emptyBodyTitle')} description={t('contentDetailPage.emptyBodyDesc')} />
                       </Panel>
                     )}
                   </div>
                 </DetailLayout>
               </m.div>
             )}

             {activeTab === 'versions' && (
               <m.div key="versions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                 <Panel>
                   <Suspense fallback={spinner}>
                     <VersionHistory contentId={content._id} onRestore={loadContent} />
                   </Suspense>
                 </Panel>
               </m.div>
             )}

             {activeTab === 'comments' && (
               <m.div key="comments" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                 <Panel>
                   <Suspense fallback={spinner}>
                     <CommentsSection entityType="content" entityId={content._id} />
                   </Suspense>
                 </Panel>
               </m.div>
             )}

             {activeTab === 'performance' && (
               <m.div key="performance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                 <Panel>
                   <Suspense fallback={spinner}>
                     <ContentPerformanceAnalytics contentId={content._id} />
                   </Suspense>
                 </Panel>
               </m.div>
             )}

             {activeTab === 'translations' && (
               <m.div key="translations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                 <Panel>
                   <SectionHeader
                     as="h3"
                     title={t('translation.title')}
                     description={t('contentDetailPage.translateDesc')}
                     actions={
                       <div className="flex flex-wrap items-center gap-2">
                         <select
                           value={targetLanguage}
                           onChange={(e) => setTargetLanguage(e.target.value)}
                           aria-label={t('translation.targetLanguage')}
                           className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                         >
                           {(supportedLangs.length > 0 ? supportedLangs : [{ code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' }, { code: 'de', name: 'German' }]).map((l) => (
                             <option key={l.code} value={l.code}>{l.name}</option>
                           ))}
                         </select>
                         <Button variant="primary" onClick={handleTranslate} disabled={isTranslating} loading={isTranslating} leftIcon={!isTranslating ? <Languages size={16} aria-hidden /> : undefined}>
                           {isTranslating ? t('translation.translating') : t('translation.translate')}
                         </Button>
                       </div>
                     }
                   />
                   <div className="mt-5 flex flex-wrap items-center gap-2">
                     <span className="ds-text-label text-theme-muted mr-1">{t('translation.translations')}:</span>
                     {translationList.length === 0 && !viewingLang && (
                       <span className="ds-text-caption text-theme-muted">{t('translation.noTranslations')}</span>
                     )}
                     {viewingLang && (
                       <Button variant="secondary" size="sm" onClick={() => setViewingLang(null)}>
                         {t('translation.viewOriginal')}
                       </Button>
                     )}
                     {translationList.map((tr) => (
                       <Button key={tr._id} variant={viewingLang === tr.language ? 'primary' : 'secondary'} size="sm" onClick={() => handleViewInLanguage(tr.language)}>
                         {t('translation.viewIn')} {tr.language.toUpperCase()}
                       </Button>
                     ))}
                   </div>
                 </Panel>

                 {(() => {
                   const display = viewingLang && translatedContent
                     ? { ...translatedContent, _lang: viewingLang }
                     : { title: content.title, description: content.description, body: content.body || content.transcript, transcript: content.transcript, tags: content.tags || [], _lang: null }
                   return (
                     <Panel>
                       <div className="mb-4 border-l-4 border-indigo-500 pl-4">
                         <h3 className="ds-text-h3 text-theme-primary">{display.title || t('contentDetailPage.untitled')}</h3>
                         {display._lang && <span className="ds-text-caption text-indigo-500">{t('translation.viewIn')} {display._lang.toUpperCase()}</span>}
                       </div>
                       <div className="space-y-5">
                         {display.description && (
                           <div>
                             <h4 className="ds-text-label text-theme-muted mb-1">{t('contentDetailPage.description')}</h4>
                             <p className="ds-text-body text-theme-secondary whitespace-pre-wrap">{display.description}</p>
                           </div>
                         )}
                         {display.body && (
                           <div>
                             <h4 className="ds-text-label text-theme-muted mb-1">{t('contentDetailPage.body')}</h4>
                             <p className="ds-text-body text-theme-secondary whitespace-pre-wrap">{display.body}</p>
                           </div>
                         )}
                         {display.tags && display.tags.length > 0 && (
                           <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
                             {display.tags.map((tag: string, i: number) => (
                               <span key={i} className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">#{tag}</span>
                             ))}
                           </div>
                         )}
                       </div>
                     </Panel>
                   )
                 })()}
               </m.div>
             )}
           </AnimatePresence>
        </div>

        {/* Real-time Synergetic Matrix */}
        <Suspense fallback={null}>
           <LiveCollaboration contentId={content._id} onContentChange={() => {}} />
        </Suspense>

        {/* Benchmarks this piece against the account's own history and predicts
            its trajectory (GET /api/benchmarking/content/:id, /compare,
            /predict). Live endpoints; the component was imported by nothing, so
            none of it was reachable. */}
        <ErrorBoundary>
          <ContentBenchmarking contentId={String(content._id)} />
        </ErrorBoundary>

        {/* Generate, edit, translate and export captions for this piece
            (/api/video/captions, /captions/generate). Live endpoints; the
            component had no importer, so the only caption UI was inside the
            video editor. */}
        <ErrorBoundary>
          <VideoCaptionEditor contentId={String(content._id)} />
        </ErrorBoundary>

        {/* Automated remediation for this piece (POST
            /api/phase16_18/remediation/process). It requires a contentId, which
            is why it belongs here rather than on the account-level ops page. */}
        <ErrorBoundary>
          <RemediationHUD contentId={String(content._id)} showToast={showToast} />
        </ErrorBoundary>

        {/* Five-part quality report — engagement, pacing, highlights, content and
            technical — from POST /video/advanced/analyze. The service behind it
            (aiVideoAnalysisService) runs exactly these analyses and was reachable
            from nowhere. Rendered only when this item has a source file: the
            analysis reads the video itself, so without a URL there is nothing to
            analyse and an always-failing panel would be worse than none. */}
        {content.originalFile?.url ? (
          <ErrorBoundary>
            <AIContentAnalysis
              videoUrl={content.originalFile.url}
              videoId={String(content._id)}
            />
          </ErrorBoundary>
        ) : null}

      </PageShell>
    </ErrorBoundary>
  )
}
