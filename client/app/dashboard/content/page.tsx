'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '../../../lib/api'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useSocket } from '../../../hooks/useSocket'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import {
  Sparkles, Send, Copy, Check, Hash, Zap,
  RefreshCw, X, Flame, FileText, Network, Gauge,
  CheckCircle, AlertCircle, Music, Image as ImageIcon,
  Play, Twitter, Linkedin,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Textarea,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../components/ui'
import ToastContainer from '../../../components/ToastContainer'

const PredictiveAnalytics = lazy(() => import('../../../components/PredictiveAnalytics'))
const AIRecommendations   = lazy(() => import('../../../components/AIRecommendations'))

interface GeneratedContent {
  socialPosts: Array<{ platform: string; content: string; hashtags: string[] }>
  blogSummary: string
  viralIdeas: Array<{ title: string; description: string; platform: string }>
}

const RESONANCE_NODES = [
  { id: 'tiktok',    label: 'TikTok',    icon: Music,        limit: 2200 },
  { id: 'instagram', label: 'Instagram', icon: ImageIcon,    limit: 2200 },
  { id: 'youtube',   label: 'YouTube',   icon: Play,         limit: 5000 },
  { id: 'twitter',   label: 'X',         icon: Twitter,      limit: 280 },
  { id: 'linkedin',  label: 'LinkedIn',  icon: Linkedin,     limit: 3000 },
]

export default function NeuralForgePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { socket, connected, on, off } = useSocket(user?.id || null)

  const [logicSeed, setLogicSeed] = useState('')
  const [designation, setDesignation] = useState('')
  const [activeNodes, setActiveNodes] = useState<string[]>(['tiktok', 'instagram', 'twitter'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [manifest, setManifest] = useState<GeneratedContent | null>(null)
  const [payloadId, setPayloadId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { if (!user) router.push('/login') }, [user, router])

  const loadPayload = useCallback(async (id: string) => {
    try {
      const res: any = await apiGet(`/content/${id}`)
      setManifest(res?.generatedContent || res?.data?.generatedContent)
    } catch (err) {
      setError(t('contentPage.errorPayloadLoadFailed'))
    }
  }, [])

  useEffect(() => {
    if (!socket || !connected) return
    const handler = (data: any) => {
      if (data.status === 'completed' && data.contentId === payloadId) {
        loadPayload(data.contentId); setSuccess(t('contentPage.successPayloadReady'))
      } else if (data.status === 'failed') { setError(t('contentPage.errorSynthLogicDiffraction')) }
    }
    on('content-generated', handler)
    return () => off('content-generated', handler)
  }, [socket, connected, payloadId, on, off, loadPayload])

  const toggleNode = useCallback((id: string) => {
    setActiveNodes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const handleForgeInitiation = async () => {
    if (!logicSeed.trim() || logicSeed.length < 50) { setError(t('contentPage.errorMinLogicSeed')); return }

    setLoading(true); setError(''); setSuccess(''); setManifest(null)
    try {
      const res: any = await apiPost('/content/generate', { text: logicSeed, title: designation || undefined, platforms: activeNodes })
      const id = res?.contentId || res?.data?.contentId
      if (id) {
        setPayloadId(id);
        setSuccess(t('contentPage.successTransmitting'));
        if (!connected) {
           const iv = setInterval(async () => {
             try {
               const sRes: any = await apiGet(`/content/${id}/status`)
               if (sRes?.status === 'completed' && sRes?.generatedContent) { clearInterval(iv); setManifest(sRes.generatedContent); setSuccess(t('contentPage.successForgingComplete')) }
               else if (sRes?.status === 'failed') { clearInterval(iv); setError(t('contentPage.errorForgeFailed')) }
             } catch { clearInterval(iv) }
           }, 3000)
           setTimeout(() => clearInterval(iv), 120000)
        }
      }
    } catch {
      setError(t('contentPage.errorThermalOverload'))
    } finally { setLoading(false) }
  }

  const handleCapture = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const wordCount = logicSeed.trim().split(/\s+/).filter(Boolean).length

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
        <SectionHeader
          as="h1"
          title={t('contentPage.title')}
          description={t('contentPage.subtitle')}
          className="mb-6"
          actions={
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Send size={16} aria-hidden />}
              onClick={() => router.push('/dashboard/scheduler')}
            >
              {t('contentPage.deployPayloads')}
            </Button>
          }
        />

        {/* ── Status Messaging ── */}
        {error && (
          <Panel variant="subtle" className="ds-anim-rise mb-6 flex items-center justify-between gap-3 border border-rose-500/20">
            <div className="flex items-center gap-3 min-w-0">
              <AlertCircle className="text-rose-500 flex-shrink-0" size={20} aria-hidden />
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
            </div>
            <IconButton variant="ghost" size="sm" onClick={() => setError('')} aria-label={t('contentPage.dismissError')} title={t('contentPage.dismissError')}><X size={16} aria-hidden /></IconButton>
          </Panel>
        )}
        {success && (
          <Panel variant="subtle" className="ds-anim-rise mb-6 flex items-center justify-between gap-3 border border-emerald-500/20">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle className="text-emerald-500 flex-shrink-0" size={20} aria-hidden />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>
            </div>
            <IconButton variant="ghost" size="sm" onClick={() => setSuccess('')} aria-label={t('contentPage.dismissSuccess')} title={t('contentPage.dismissSuccess')}><X size={16} aria-hidden /></IconButton>
          </Panel>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Logic Injection Node ── */}
          <Panel variant="bento" className="flex flex-col">
            <SectionHeader
              as="h2"
              title={t('contentPage.logicInjection')}
              className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
            />

            <div className="space-y-6 flex-1 flex flex-col">
              <div className="space-y-1.5">
                <label htmlFor="designation" className="ds-text-label text-theme-secondary">{t('contentPage.operationalDesignation')}</label>
                <div className="relative">
                  <Input
                    id="designation"
                    type="text" value={designation} onChange={e => setDesignation(e.target.value)}
                    placeholder={t('contentPage.designationPlaceholder')}
                    className="pr-9"
                  />
                  <Hash size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                </div>
              </div>

              <div className="space-y-1.5 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="logicSeed" className="ds-text-label text-theme-secondary">{t('contentPage.logicSeedMatrix')}</label>
                  <div className="flex gap-3 ds-text-caption tabular-nums">
                    <span>{t('contentPage.bitsData', { count: logicSeed.length })}</span>
                    <span>{t('contentPage.particles', { count: wordCount })}</span>
                  </div>
                </div>
                <Textarea
                  id="logicSeed"
                  value={logicSeed} onChange={e => setLogicSeed(e.target.value)}
                  placeholder={t('contentPage.logicSeedPlaceholder')}
                  className="flex-1 min-h-[280px]"
                />
              </div>

              <div className="space-y-2">
                <label className="ds-text-label text-theme-secondary">{t('contentPage.platforms')}</label>
                <div className="flex flex-wrap gap-2">
                  {RESONANCE_NODES.map(node => {
                    const active = activeNodes.includes(node.id)
                    const NodeIcon = node.icon
                    return (
                      <button type="button" key={node.id} onClick={() => toggleNode(node.id)}
                        title={t('contentPage.toggleNode', { node: node.label })} aria-label={t('contentPage.toggleNode', { node: node.label })}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'ds-surface-subtle text-theme-secondary hover:text-theme-primary'
                        )}
                      >
                        <NodeIcon size={16} aria-hidden />
                        {node.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleForgeInitiation}
                loading={loading}
                disabled={loading || !logicSeed.trim() || logicSeed.length < 50}
                leftIcon={!loading ? <Flame size={18} aria-hidden /> : undefined}
              >
                {loading ? t('contentPage.ignitingForge') : t('contentPage.forgeContent')}
              </Button>
            </div>
          </Panel>

          {/* ── Synthetic Payload Repository ── */}
          <Panel variant="bento" className="flex flex-col min-h-[600px]">
            <SectionHeader
              as="h2"
              title={t('contentPage.neuralPayloads')}
              className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
              actions={manifest ? (
                <Button variant="primary" size="sm" leftIcon={<Send size={14} aria-hidden />} onClick={() => router.push('/dashboard/scheduler')}>
                  {t('contentPage.deployAll')}
                </Button>
              ) : undefined}
            />

            <div className="flex-1 flex flex-col">
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <RefreshCw size={32} className="text-primary animate-spin" aria-hidden />
                  <p className="ds-text-label text-theme-muted">{t('contentPage.forgingSyntheticLogic')}</p>
                </div>
              )}

              {!loading && !manifest && (
                <EmptyState
                  icon={Sparkles}
                  title={t('contentPage.forgeBufferEmpty')}
                  description={t('contentPage.forgeBufferEmptyDesc')}
                  className="flex-1"
                />
              )}

              {!loading && manifest && (
                <div className="space-y-8">
                  {manifest.socialPosts?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="ds-text-label text-theme-muted">{t('contentPage.resonanceArrayMatrix')}</h3>
                      <div className="space-y-3">
                        {manifest.socialPosts.map((post, idx) => {
                          const pCfg = RESONANCE_NODES.find(n => n.id === post.platform)
                          const PIcon = pCfg?.icon || Network
                          const cId = `payload_node_${idx}`
                          return (
                            <article key={idx} className="ds-surface-subtle p-4">
                              <header className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                                    <PIcon size={18} className="text-theme-secondary" aria-hidden />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="ds-text-label text-theme-primary">{pCfg?.label || post.platform}</p>
                                    {pCfg && <p className="ds-text-caption tabular-nums">{t('contentPage.bitsResonance', { count: post.content.length, limit: pCfg.limit })}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <IconButton variant="ghost" size="sm" onClick={() => handleCapture(post.content, cId)} title={t('contentPage.copyContent')} aria-label={t('contentPage.copyContent')}>
                                    {copiedId === cId ? <Check size={16} className="text-emerald-500" aria-hidden /> : <Copy size={16} aria-hidden />}
                                  </IconButton>
                                  <Button variant="secondary" size="sm" leftIcon={<Send size={14} aria-hidden />} onClick={() => router.push(`/dashboard/scheduler?text=${encodeURIComponent(post.content)}&platform=${post.platform}`)}>
                                    {t('contentPage.deploy')}
                                  </Button>
                                </div>
                              </header>
                              <p className="text-sm text-theme-primary leading-relaxed whitespace-pre-wrap">{post.content}</p>
                              {post.hashtags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {post.hashtags.map((tag, i) => (
                                    <span key={i} className="ds-text-caption ds-surface-card px-2 py-0.5 text-primary">#{tag.replace('#', '')}</span>
                                  ))}
                                </div>
                              )}
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {manifest.blogSummary && (
                    <div className="space-y-3">
                      <h3 className="ds-text-label text-theme-muted">{t('contentPage.strategicCoreNarrative')}</h3>
                      <article className="ds-surface-subtle p-4">
                        <header className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                              <FileText size={18} className="text-emerald-500" aria-hidden />
                            </span>
                            <p className="ds-text-label text-theme-primary">{t('contentPage.syntheticCoreManifest')}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleCapture(manifest.blogSummary, 'manifest_summary')}
                            leftIcon={copiedId === 'manifest_summary' ? <Check size={14} className="text-emerald-500" aria-hidden /> : <Copy size={14} aria-hidden />}>
                            {copiedId === 'manifest_summary' ? t('contentPage.captured') : t('contentPage.captureManifest')}
                          </Button>
                        </header>
                        <p className="text-sm text-theme-primary leading-relaxed whitespace-pre-wrap">{manifest.blogSummary}</p>
                      </article>
                    </div>
                  )}

                  {manifest.viralIdeas?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="ds-text-label text-theme-muted">{t('contentPage.exponentialLogicPhantoms')}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {manifest.viralIdeas.map((idea, idx) => (
                          <article key={idx} className="ds-surface-subtle p-4 flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <h4 className="ds-text-label text-theme-primary leading-snug">{idea.title}</h4>
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                <Zap size={18} className="text-amber-500" aria-hidden />
                              </span>
                            </div>
                            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit mb-2">{t('contentPage.platformNode', { platform: idea.platform.toUpperCase() })}</Badge>
                            <p className="text-sm text-theme-muted leading-relaxed">{idea.description}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button variant="primary" size="md" className="flex-1" leftIcon={<Send size={16} aria-hidden />} onClick={() => router.push('/dashboard/scheduler')}>
                      {t('contentPage.deployAllTrajectories')}
                    </Button>
                    <IconButton variant="secondary" size="md" onClick={() => setManifest(null)} title={t('contentPage.purgeForgeBuffer')} aria-label={t('contentPage.purgeForgeBuffer')}>
                      <RefreshCw size={16} aria-hidden />
                    </IconButton>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </main>

        {/* ── Intelligence Channels ── */}
        <footer className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Panel variant="bento" className="flex flex-col">
            <SectionHeader
              as="h3"
              title={t('contentPage.neuralHeuristics')}
              description={t('contentPage.neuralHeuristicsDesc')}
              className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
            />
            <div className="min-h-[400px] flex-1">
              <Suspense fallback={<div className="flex items-center justify-center h-full gap-3 text-theme-muted"><RefreshCw size={24} className="animate-spin" aria-hidden /><p className="ds-text-label">{t('contentPage.decryptingHeuristics')}</p></div>}>
                <AIRecommendations />
              </Suspense>
            </div>
          </Panel>
          <Panel variant="bento" className="flex flex-col">
            <SectionHeader
              as="h3"
              title={t('contentPage.predictiveTelemetry')}
              description={t('contentPage.predictiveTelemetryDesc')}
              className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
            />
            <div className="min-h-[400px] flex-1">
              <Suspense fallback={<div className="flex items-center justify-center h-full gap-3 text-theme-muted"><RefreshCw size={24} className="animate-spin" aria-hidden /><p className="ds-text-label">{t('contentPage.scanningTrajectories')}</p></div>}>
                <PredictiveAnalytics />
              </Suspense>
            </div>
          </Panel>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
