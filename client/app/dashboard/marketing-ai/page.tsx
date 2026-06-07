'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Brain, RefreshCw, Sparkles, Zap, Globe, Target,
  ArrowRight, Clock, AlertTriangle, CheckCircle2,
  BarChart3, Lightbulb, Flame, Activity, Star,
  MessageCircle, Heart, BookOpen, Compass, Rocket, Users, Shield,
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { FormField, Input, Textarea } from '../../../components/ui/form-field'
import { EmptyState } from '../../../components/ui/empty-state'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api')

type Panel = 'trends' | 'retention' | 'creativity' | 'engagement' | 'optimizer'

export default function MarketingOraclePage() {
  const { t } = useTranslation()
  const [activePanel, setActivePanel] = useState<Panel>('trends')
  const [niche, setNiche] = useState('general')
  const [platform, setPlatform] = useState('instagram')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [data, setData] = useState<Record<string, any>>({})
  const [error, setError] = useState<Record<string, string>>({})

  const [syncing, setSyncing] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    // API_BASE already includes the `/api` prefix (NEXT_PUBLIC_API_URL=/api).
    // Earlier this concatenated `${API_BASE}/api/marketing-intelligence` and
    // produced `/api/api/marketing-intelligence/...` — a 404 every time.
    const res = await fetch(`${API_BASE}/marketing-intelligence${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    return res.json()
  }, [token])

  const load = useCallback(async (key: string, endpoint: string, options?: RequestInit) => {
    setLoading((l) => ({ ...l, [key]: true }))
    setError((e) => ({ ...e, [key]: '' }))
    try {
      const result = await apiFetch(endpoint, options)
      setData((d) => ({ ...d, [key]: result.data }))
    } catch (err: any) {
      setError((e) => ({ ...e, [key]: err.message || t('marketingAiPage.failedToLoad') }))
    } finally {
      setLoading((l) => ({ ...l, [key]: false }))
    }
  }, [apiFetch, t])

  // Load dashboard overview on mount
  useEffect(() => {
    load('dashboard', `/dashboard?niche=${niche}&platform=${platform}`)
  }, [niche, platform, load])

  const syncSignals = async () => {
    setSyncing(true)
    try {
      const res = await apiFetch('/sync-signals', { method: 'POST' })
      if (res.success) {
        // Refresh dashboard data after sync
        load('dashboard', `/dashboard?niche=${niche}&platform=${platform}`)
      }
    } catch (err) {
      console.error('Sync failed', err)
    } finally {
      setTimeout(() => setSyncing(false), 2000)
    }
  }

  const panels: { id: Panel; label: string; icon: any }[] = [
    { id: 'trends',     label: t('marketingAiPage.panelTrends'),     icon: Globe },
    { id: 'retention',  label: t('marketingAiPage.panelRetention'),  icon: RefreshCw },
    { id: 'creativity', label: t('marketingAiPage.panelCreativity'), icon: Sparkles },
    { id: 'engagement', label: t('marketingAiPage.panelEngagement'), icon: MessageCircle },
    { id: 'optimizer',  label: t('marketingAiPage.panelOptimizer'),  icon: Target },
  ]

  return (
    <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/dashboard/forge"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold"
            >
              <Sparkles size={12} /> {t('marketingAiPage.applyInEditor')}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
              <Brain size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="ds-text-h1 text-theme-primary leading-none">{t('marketingAiPage.title')}</h1>
              <p className="ds-text-caption mt-1 max-w-xl">{t('marketingAiPage.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Controls & Sync */}
        <div className="ds-surface-card p-4 flex flex-col sm:flex-row gap-4 items-end w-full lg:w-auto">
          <FormField label={t('marketingAiPage.targetNicheLabel')} className="flex-1 min-w-[160px]">
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder={t('marketingAiPage.nichePlaceholder')}
            />
          </FormField>
          <FormField label={t('marketingAiPage.activeMatrixLabel')} className="flex-1 min-w-[160px]">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              title={t('marketingAiPage.selectPlatform')}
              aria-label={t('marketingAiPage.selectPlatform')}
              className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {['instagram','tiktok','linkedin','twitter','youtube','facebook'].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </FormField>
          <Button
            variant="primary"
            onClick={syncSignals}
            loading={syncing}
            leftIcon={!syncing ? <Activity size={16} /> : undefined}
          >
            {syncing ? t('marketingAiPage.synkFluxInProgress') : t('marketingAiPage.triggerSynkFlux')}
          </Button>
        </div>
      </header>

      {/* ── Panel Navigation ── */}
      <nav className="flex flex-wrap gap-2">
        {panels.map((p) => (
          <button key={p.id} type="button" onClick={() => setActivePanel(p.id)}
            aria-pressed={activePanel === p.id ? 'true' : 'false'}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors border',
              activePanel === p.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'ds-surface-card text-theme-secondary hover:text-theme-primary border-transparent'
            )}
          >
            <p.icon size={16} />
            {p.label}
          </button>
        ))}
      </nav>

      {/* ── Panel Content ── */}
      <div className="ds-anim-fade-in" key={activePanel}>
        {activePanel === 'trends' && (
          <TrendsPanel niche={niche} load={load} data={data} loading={loading} error={error} />
        )}
        {activePanel === 'retention' && (
          <RetentionPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
        )}
        {activePanel === 'creativity' && (
          <CreativityPanel niche={niche} topic={topic} setTopic={setTopic} load={load} data={data} loading={loading} error={error} />
        )}
        {activePanel === 'engagement' && (
          <EngagementPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
        )}
        {activePanel === 'optimizer' && (
          <OptimizerPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBlock({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
      <AlertTriangle size={16} /> {msg}
    </div>
  )
}

function PanelHead({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h2 className="ds-text-h3 text-theme-primary">{title}</h2>
        {subtitle && <p className="ds-text-caption mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Trends Panel ──────────────────────────────────────────────────────────────
function TrendsPanel({ niche, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const report = data.trendReport || data.dashboard?.trendReport
  const knowledge = data.knowledge || data.dashboard?.knowledgeInsights

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Trend Report */}
      <div className="xl:col-span-2 ds-surface-card p-5 sm:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PanelHead icon={Globe} title={t('marketingAiPage.globalTrendRadar')} subtitle={t('marketingAiPage.liveIntelForNiche')} />
          <Button variant="secondary" size="sm" loading={loading.trendReport}
            leftIcon={!loading.trendReport ? <RefreshCw size={14} /> : undefined}
            onClick={() => load('trendReport', `/trend-report?niche=${niche}`)}>
            {t('marketingAiPage.scanNow')}
          </Button>
        </div>

        {error.trendReport && <ErrorBlock msg={error.trendReport} />}

        {report && (
          <div className="space-y-5">
            {/* Confidence score */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2.5 bg-accent rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${report.confidenceScore || 80}%` }} />
              </div>
              <span className="ds-text-h3 text-primary tabular-nums">{report.confidenceScore || 80}%</span>
              <span className="ds-text-caption">{t('marketingAiPage.confidence')}</span>
            </div>

            {/* Niche opportunities */}
            {report.niching?.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.nicheOpportunities')}</p>
                {report.niching.slice(0, 4).map((opp: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl border border-input">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-theme-primary text-sm mb-1">{opp.title || opp}</p>
                        {opp.description && <p className="text-theme-muted text-xs leading-relaxed">{opp.description}</p>}
                      </div>
                      {opp.urgency && (
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border',
                          opp.urgency === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          opp.urgency === 'medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        )}>{opp.urgency}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actionable insights */}
            {report.actionableInsights?.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.actionableInsights')}</p>
                {report.actionableInsights.slice(0, 3).map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Zap size={14} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-theme-secondary">{insight}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 2026 Macro Trends */}
            {report.globalTrends2026 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.globalMacroTrends')}</p>
                <div className="flex flex-wrap gap-2">
                  {report.globalTrends2026.slice(0, 6).map((trend: string, i: number) => (
                    <span key={i} className="px-3 py-1 rounded-full border border-input text-xs text-theme-secondary">{trend}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!report && !loading.trendReport && (
          <EmptyState icon={Globe} title={t('marketingAiPage.trendsEmptyState')} />
        )}
      </div>

      {/* Knowledge Base */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={BookOpen} title={t('marketingAiPage.knowledgeBase')} />
        <Button variant="secondary" size="sm" loading={loading.knowledge}
          leftIcon={!loading.knowledge ? <Lightbulb size={14} /> : undefined}
          onClick={() => load('knowledge', `/knowledge-insights?niche=${niche}&format=video`)}>
          {t('marketingAiPage.getInsights')}
        </Button>

        {knowledge && (
          <div className="space-y-5">
            <div>
              <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.recommendedFrameworks')}</p>
              {knowledge.recommendedFrameworks?.map((f: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border border-input mb-3 space-y-1">
                  <p className="font-medium text-theme-primary text-sm">{f.name}</p>
                  <p className="text-xs text-theme-muted leading-relaxed">{f.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {f.bestFor?.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-accent text-[10px] text-theme-secondary font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.quickWins')}</p>
              {knowledge.quickWins?.map((win: string, i: number) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-theme-secondary">{win}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Retention Panel ───────────────────────────────────────────────────────────
function RetentionPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const score = data.retentionScore
  const sequence = data.retentionSequence
  const campaign = data.retentionCampaign

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Score Card */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={Activity} title={t('marketingAiPage.retentionHealth')} subtitle={t('marketingAiPage.audienceLoyaltyScore')} />

        <Button variant="secondary" size="sm" loading={loading.retentionScore}
          leftIcon={!loading.retentionScore ? <Target size={14} /> : undefined}
          onClick={() => load('retentionScore', '/retention-score')}>
          {t('marketingAiPage.calculateScore')}
        </Button>

        {error.retentionScore && <ErrorBlock msg={error.retentionScore} />}

        {score && (
          <div className="space-y-5">
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <p className="text-5xl font-bold text-primary tabular-nums leading-none">{score.score}</p>
                <p className="ds-text-caption mt-1">/100</p>
              </div>
            </div>
            <p className="text-center text-sm font-medium text-theme-primary">{score.verdict}</p>

            {/* Risk badge */}
            <div className={cn('px-4 py-2.5 rounded-lg text-center text-sm font-semibold border',
              score.riskLevel === 'critical' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
              score.riskLevel === 'high'     ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
              score.riskLevel === 'medium'   ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' :
              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            )}>
              {t('marketingAiPage.riskLevel', { level: score.riskLevel?.toUpperCase() })}
            </div>

            {/* Improvements */}
            {score.improvements?.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.improvementSteps')}</p>
                {score.improvements.map((imp: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-input">
                    <ArrowRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-theme-secondary">{imp}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Re-engagement Sequence */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={RefreshCw} title={t('marketingAiPage.reEngagementSequence')} subtitle={t('marketingAiPage.dripCampaignSubtitle')} />

        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" loading={loading.retentionSequence}
            leftIcon={!loading.retentionSequence ? <Rocket size={14} /> : undefined}
            onClick={() => load('retentionSequence', `/retention-sequence?niche=${niche}&platform=${platform}`)}>
            {t('marketingAiPage.generateSequence')}
          </Button>
          <Button variant="primary" size="sm" loading={loading.retentionCampaign}
            leftIcon={!loading.retentionCampaign ? <Star size={14} /> : undefined}
            onClick={() => load('retentionCampaign', '/retention-campaign', { method: 'POST', body: JSON.stringify({ niche, platform }) })}>
            {t('marketingAiPage.buildCampaign')}
          </Button>
        </div>

        {(error.retentionSequence || error.retentionCampaign) && <ErrorBlock msg={error.retentionSequence || error.retentionCampaign} />}

        {sequence && (
          <div className="space-y-3">
            <p className="ds-text-label text-theme-muted">
              {sequence.sequenceName} · {sequence.estimatedReachRate}
            </p>
            {sequence.posts?.slice(0, 5).map((post: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-input space-y-2">
                <div className="flex items-center justify-between">
                  <span className="ds-text-caption font-semibold text-primary">{t('marketingAiPage.postDayLabel', { post: post.postNumber, day: post.dayOffset })}</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary">{post.psychTrigger}</span>
                </div>
                <p className="text-sm text-theme-primary font-medium leading-relaxed">{post.hook}</p>
                <p className="text-xs text-theme-muted">{post.cta}</p>
              </div>
            ))}
          </div>
        )}

        {campaign && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
            <p className="ds-text-label text-emerald-600 dark:text-emerald-400">{t('marketingAiPage.campaignPlanGenerated')}</p>
            <p className="text-sm font-medium text-theme-primary">{campaign.campaignName}</p>
            <p className="text-xs text-theme-muted">{t('marketingAiPage.campaignPostsScheduled', { posts: campaign.totalPosts, days: campaign.campaignDurationDays })}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{campaign.expectedOutcome}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Creativity Panel ──────────────────────────────────────────────────────────
function CreativityPanel({ niche, topic, setTopic, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const freshAngles = data.freshAngles
  const inspiration = data.inspiration || data.dashboard?.inspirationDrop

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={Sparkles} title={t('marketingAiPage.freshAnglesGenerator')} subtitle={t('marketingAiPage.freshAnglesSubtitle')} />

        <div className="space-y-3">
          <FormField label={t('marketingAiPage.topicOrIdea')}>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('marketingAiPage.topicPlaceholder')}
            />
          </FormField>
          <Button variant="primary" size="sm" loading={loading.freshAngles}
            leftIcon={!loading.freshAngles ? <Lightbulb size={14} /> : undefined}
            onClick={() => load('freshAngles', `/fresh-angles?topic=${encodeURIComponent(topic || 'content creation')}&niche=${niche}`)}>
            {t('marketingAiPage.generateFreshAngles')}
          </Button>
        </div>

        {error.freshAngles && <ErrorBlock msg={error.freshAngles} />}

        {freshAngles?.angles?.length > 0 && (
          <div className="space-y-3">
            <p className="ds-text-label text-theme-muted">{t('marketingAiPage.yourNovelAngles')}</p>
            {freshAngles.angles.map((angle: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-input">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="ds-text-caption font-semibold text-primary">{t('marketingAiPage.angleLabel', { num: i + 1, format: angle.format })}</span>
                  {angle.originalityScore && (
                    <span className="ds-text-caption">{t('marketingAiPage.originalityScore', { score: angle.originalityScore })}</span>
                  )}
                </div>
                <p className="text-sm text-theme-primary font-medium leading-relaxed mb-2">{angle.angle}</p>
                <p className="text-xs text-theme-muted">{angle.hook}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspiration Drop */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={Flame} title={t('marketingAiPage.inspirationDrop')} subtitle={t('marketingAiPage.inspirationSubtitle')} />

        <Button variant="secondary" size="sm" loading={loading.inspiration}
          leftIcon={!loading.inspiration ? <Compass size={14} /> : undefined}
          onClick={() => load('inspiration', `/inspiration-drop?niche=${niche}&format=video`)}>
          {t('marketingAiPage.getNewDrop')}
        </Button>

        {(inspiration || data.dashboard?.inspirationDrop) && (() => {
          const drop = inspiration || data.dashboard?.inspirationDrop
          return (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <p className="ds-text-label text-primary">{t('marketingAiPage.framework')}</p>
                <p className="text-lg font-semibold text-theme-primary">{drop.framework}</p>
                <p className="text-sm text-theme-muted leading-relaxed">&ldquo;{drop.principle}&rdquo;</p>
              </div>
              <div className="space-y-1.5">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.howToExecute')}</p>
                <p className="text-sm text-theme-secondary leading-relaxed">{drop.adaptedExecution || drop.execution}</p>
              </div>
              <div className="p-4 rounded-xl border border-input space-y-1.5">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.example')}</p>
                <p className="text-sm text-theme-muted leading-relaxed">{drop.example}</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="ds-text-label text-amber-600 dark:text-amber-400 mb-2">{t('marketingAiPage.challengeToday')}</p>
                <p className="text-sm text-theme-primary font-medium">{drop.challengeForToday}</p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Engagement Panel ──────────────────────────────────────────────────────────
function EngagementPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const prompts = data.engagementPrompts
  const benchmarks = data.benchmarks || data.dashboard?.engagementBenchmarks

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={MessageCircle} title={t('marketingAiPage.engagementPrompts')} subtitle={t('marketingAiPage.engagementPromptsSubtitle')} />

        <Button variant="primary" size="sm" loading={loading.engagementPrompts}
          leftIcon={!loading.engagementPrompts ? <Zap size={14} /> : undefined}
          onClick={() => load('engagementPrompts', `/engagement-prompts?platform=${platform}&niche=${niche}`)}>
          {t('marketingAiPage.generatePrompts')}
        </Button>

        {error.engagementPrompts && <ErrorBlock msg={error.engagementPrompts} />}

        {prompts?.prompts?.length > 0 && (
          <div className="space-y-3">
            <p className="ds-text-label text-theme-muted">{t('marketingAiPage.readyToUsePrompts')}</p>
            {prompts.prompts.map((p: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-input">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
                    p.type === 'question' ? 'bg-primary/10 text-primary border-primary/20' :
                    p.type === 'poll' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                    p.type === 'challenge' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                    'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  )}>{p.type || 'cta'}</span>
                  {(p.estimatedLift || p.estimated_engagement_lift) && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">↑ {p.estimatedLift || p.estimated_engagement_lift}</span>
                  )}
                </div>
                <p className="text-sm text-theme-primary font-medium leading-relaxed">{p.text || p.prompt}</p>
                {p.psychTrigger && <p className="text-xs text-theme-muted mt-2">{t('marketingAiPage.triggerLabel', { trigger: p.psychTrigger })}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={BarChart3} title={t('marketingAiPage.benchmarksTitle')} subtitle={t('marketingAiPage.benchmarksSubtitle', { platform })} />

        <Button variant="secondary" size="sm" loading={loading.benchmarks}
          leftIcon={!loading.benchmarks ? <Target size={14} /> : undefined}
          onClick={() => load('benchmarks', `/benchmarks?platform=${platform}`)}>
          {t('marketingAiPage.loadBenchmarks')}
        </Button>

        {(benchmarks) && (() => {
          const b = benchmarks.benchmarks || (benchmarks.data?.benchmarks)
          if (!b) return null
          const tiers = [
            { label: 'Excellent', labelKey: 'tierExcellent', value: b.excellent, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Good', labelKey: 'tierGood', value: b.good, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
            { label: 'Average', labelKey: 'tierAverage', value: b.average, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Poor', labelKey: 'tierPoor', value: b.poor, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
          ]
          return (
            <div className="space-y-2">
              <p className="ds-text-label text-theme-muted">{t('marketingAiPage.engagementRateBenchmarks', { platform: platform.charAt(0).toUpperCase() + platform.slice(1) })}</p>
              {tiers.map((tier) => (
                <div key={tier.label} className={cn('flex items-center justify-between p-3.5 rounded-lg border', tier.bg)}>
                  <span className="text-sm font-medium text-theme-primary">{t(`marketingAiPage.${tier.labelKey}`)}</span>
                  <span className={cn('text-xl font-bold tabular-nums', tier.color)}>{tier.value}%+</span>
                </div>
              ))}
              <p className="ds-text-caption">{t('marketingAiPage.sourceLabel', { source: benchmarks.note || t('marketingAiPage.industryStandards') })}</p>
            </div>
          )
        })()}

        {/* Quick engagement tips */}
        <div className="p-4 rounded-xl border border-input space-y-3">
          <p className="ds-text-label text-theme-muted">{t('marketingAiPage.activateYourAudience')}</p>
          {[
            { icon: Heart, text: t('marketingAiPage.engagementTip1') },
            { icon: Users, text: t('marketingAiPage.engagementTip2') },
            { icon: Shield, text: t('marketingAiPage.engagementTip3') },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <tip.icon size={14} className="text-theme-muted mt-0.5 shrink-0" />
              <p className="text-xs text-theme-secondary leading-relaxed">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Optimizer Panel ──
function OptimizerPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const ld = loading['optimizer']
  const err = error['optimizer']
  const report = data['optimizer']
  const [content, setContent] = useState('')

  return (
    <div className="ds-surface-card p-5 sm:p-6 space-y-5">
      <PanelHead icon={Target} title={t('marketingAiPage.prePublishAnalyzer')} subtitle={t('marketingAiPage.prePublishSubtitle')} />

      <div className="space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('marketingAiPage.contentPlaceholder')}
          className="min-h-[160px]"
        />
        <Button
          variant="primary"
          onClick={() => load('optimizer', '/pre-publish-report', { method: 'POST', body: JSON.stringify({ contentText: content, platform, niche, format: 'post' }) })}
          disabled={!content.trim()}
          loading={ld}
          className="w-full"
        >
          {ld ? t('marketingAiPage.analyzingContent') : t('marketingAiPage.analyzeContent')}
        </Button>
        {err && <ErrorBlock msg={err} />}
      </div>

      {report && (
        <div className="space-y-6 ds-anim-fade-in">
          {/* Verdict Header */}
          <div className={cn('p-5 rounded-xl border flex items-center justify-between',
            report.overallScore >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : report.overallScore >= 55 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20')}>
            <div>
              <p className="ds-text-label text-theme-muted">{t('marketingAiPage.preFlightVerdict')}</p>
              <h3 className="ds-text-h3 text-theme-primary mt-1">{report.verdict}</h3>
            </div>
            <div className="text-right">
              <p className="ds-text-label text-theme-muted">{t('marketingAiPage.score')}</p>
              <div className={cn('text-3xl font-bold', report.overallScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : report.overallScore >= 55 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500')}>
                {report.overallScore}/100
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Hook Strength */}
            <div className="border border-input p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-theme-primary flex items-center gap-2"><Flame size={16} className="text-amber-500"/> {t('marketingAiPage.hookAnalysis')}</h4>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{report.hookAnalysis.score}/100</span>
              </div>
              <div className="space-y-2">
                {report.hookAnalysis.signals.map((s: any, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 p-2 rounded-lg">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> <span>{s.signal}</span>
                  </div>
                ))}
                {report.hookAnalysis.weaknesses.map((w: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-rose-500 bg-rose-500/5 p-2 rounded-lg">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{w}</span>
                  </div>
                ))}
              </div>
              {report.hookAnalysis.rewrites?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.aiRewritesToTest')}</p>
                  <div className="space-y-3">
                    {report.hookAnalysis.rewrites.map((r: any, i: number) => (
                      <div key={i} className="bg-accent p-3 rounded-lg">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">{r.label}</p>
                        <p className="text-sm text-theme-secondary">&quot;{r.text}&quot;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Platform Fit & Emotion */}
            <div className="space-y-5">
              <div className="border border-input p-5 rounded-xl space-y-3">
                <h4 className="font-semibold text-theme-primary flex items-center gap-2"><Activity size={16} className="text-primary"/> {t('marketingAiPage.algorithmFit', { platform })}</h4>
                <div className="space-y-2">
                  {report.platformFit.risksDetected.length > 0 ? (
                    report.platformFit.risksDetected.map((r: any, i: number) => (
                      <div key={i} className="text-sm bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-lg">
                        <strong>{t('marketingAiPage.riskPrefix')}</strong> {r.issue} <br/>
                        <span className="text-theme-primary">{t('marketingAiPage.fixPrefix', { fix: r.fix })}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={16} /> {t('marketingAiPage.cleanlyAligned')}
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-input p-5 rounded-xl space-y-3">
                <h4 className="font-semibold text-theme-primary flex items-center gap-2"><Heart size={16} className="text-rose-500"/> {t('marketingAiPage.emotionalResonance')}</h4>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                    {t('marketingAiPage.dominantLabel', { emotion: report.emotionalResonance.dominantEmotion })}
                  </span>
                </div>
                {report.emotionalResonance.missingHighImpactTriggers?.[0] && (
                  <div className="text-sm bg-accent p-3 rounded-lg">
                    <p className="text-theme-muted mb-1">{t('marketingAiPage.missingTriggerLabel')} <strong>{report.emotionalResonance.missingHighImpactTriggers[0].trigger}</strong></p>
                    <p className="text-theme-primary">&quot;{report.emotionalResonance.missingHighImpactTriggers[0].suggestion}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timings */}
          <div className="border border-input p-5 rounded-xl">
            <h4 className="font-semibold text-theme-primary mb-3 flex items-center gap-2"><Clock size={16} className="text-primary"/> {t('marketingAiPage.optimalPostingWindows')}</h4>
            <div className="flex flex-wrap gap-2">
              {report.optimalPostingTimes.optimalWindows.map((tw: any, i: number) => (
                <div key={i} className="px-3.5 py-2.5 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                  <strong className="text-primary">{tw.day}</strong> <span className="text-theme-muted">@ {tw.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
