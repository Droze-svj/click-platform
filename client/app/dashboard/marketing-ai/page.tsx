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
import { PageShell } from '../../../components/ui'
import { apiGet, apiPost, handleApiError } from '../../../lib/api'

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
  const [syncError, setSyncError] = useState('')

  // All endpoints live under /api/marketing-intelligence; lib/api already
  // prefixes /api and attaches the session token. Responses are the
  // {success, data} envelope — panels read `result.data`.
  const load = useCallback(async (key: string, endpoint: string, options?: { method?: 'POST'; body?: any }) => {
    setLoading((l) => ({ ...l, [key]: true }))
    setError((e) => ({ ...e, [key]: '' }))
    try {
      const path = `/marketing-intelligence${endpoint}`
      const result: any = options?.method === 'POST'
        ? await apiPost(path, options.body || {})
        : await apiGet(path, undefined, false)
      setData((d) => ({ ...d, [key]: result?.data ?? result }))
    } catch (err: any) {
      setError((e) => ({ ...e, [key]: handleApiError(err) || t('marketingAiPage.failedToLoad') }))
    } finally {
      setLoading((l) => ({ ...l, [key]: false }))
    }
  }, [t])

  // Load dashboard overview on mount
  useEffect(() => {
    load('dashboard', `/dashboard?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)
  }, [niche, platform, load])

  const syncSignals = async () => {
    setSyncing(true)
    setSyncError('')
    try {
      await apiPost('/marketing-intelligence/sync-signals', {})
      // Refresh dashboard data after sync
      load('dashboard', `/dashboard?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)
    } catch (err) {
      setSyncError(handleApiError(err) || t('marketingAiPage.syncFailed'))
    } finally {
      setSyncing(false)
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
    // Frame only; the hero header below is kept as-is.
    <PageShell width="wide" className="min-h-screen ds-bg-mesh-soft">
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

      {syncError && <ErrorBlock msg={syncError} />}

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
          <TrendsPanel niche={niche} platform={platform} load={load} data={data} loading={loading} error={error} />
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
    </PageShell>
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
// GET /trend-report → { source: 'ai'|'fallback', hooks[], sounds[], formats[], hashtags{} }
// GET /knowledge-insights → { voice, proven[], pitfalls[], vocabulary[], hookFrameworks[] }
function TrendsPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const report = data.trendReport
  const knowledge = data.knowledge
  const hooks: any[] = Array.isArray(report?.hooks) ? report.hooks : []
  const sounds: any[] = Array.isArray(report?.sounds) ? report.sounds : []
  const formats: any[] = Array.isArray(report?.formats) ? report.formats : []
  const hashtags: string[] = report?.hashtags && typeof report.hashtags === 'object'
    ? [...(report.hashtags.primary || []), ...(report.hashtags.niche || []), ...(report.hashtags.trending || [])]
        .filter((h: any) => typeof h === 'string' && h)
    : []
  const isAi = report?.source === 'ai'
  const momentumLabel = (m: string) =>
    m === 'rising' ? t('marketingAiPage.momentumRising')
      : m === 'peaking' ? t('marketingAiPage.momentumPeaking')
        : m === 'steady' ? t('marketingAiPage.momentumSteady') : ''

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Trend Report */}
      <div className="xl:col-span-2 ds-surface-card p-5 sm:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <PanelHead icon={Globe} title={t('marketingAiPage.globalTrendRadar')} subtitle={t('marketingAiPage.liveIntelForNiche')} />
          <Button variant="secondary" size="sm" loading={loading.trendReport}
            leftIcon={!loading.trendReport ? <RefreshCw size={14} /> : undefined}
            onClick={() => load('trendReport', `/trend-report?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)}>
            {t('marketingAiPage.scanNow')}
          </Button>
        </div>

        {error.trendReport && <ErrorBlock msg={error.trendReport} />}

        {report && (
          <div className="space-y-5">
            {!isAi && (
              <p className="ds-text-caption p-3 rounded-lg border border-input">{t('marketingAiPage.playbookFallbackNote')}</p>
            )}

            {hooks.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.trendHooks')}</p>
                {hooks.slice(0, 6).map((hook: any, i: number) => (
                  <div key={hook.id || i} className="p-4 rounded-xl border border-input">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-theme-primary text-sm mb-1">{hook.label}</p>
                        {hook.example && <p className="text-theme-muted text-xs leading-relaxed">{hook.example}</p>}
                      </div>
                      {isAi && momentumLabel(hook.momentum) && (
                        <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 border',
                          hook.momentum === 'rising' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                          hook.momentum === 'peaking' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        )}>{momentumLabel(hook.momentum)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formats.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.trendFormats')}</p>
                {formats.slice(0, 5).map((f: any, i: number) => (
                  <div key={f.id || i} className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Zap size={14} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-theme-secondary">
                      <span className="font-medium text-theme-primary">{f.label}</span>
                      {f.structure ? ` · ${f.structure}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {sounds.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.trendSounds')}</p>
                {sounds.slice(0, 6).map((s: any, i: number) => (
                  <div key={s.id || i} className="p-3 rounded-lg border border-input">
                    <p className="text-sm font-medium text-theme-primary">{s.label}</p>
                    {s.useCase && <p className="text-xs text-theme-muted mt-0.5">{s.useCase}</p>}
                  </div>
                ))}
              </div>
            )}

            {hashtags.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.trendHashtags')}</p>
                <div className="flex flex-wrap gap-2">
                  {hashtags.slice(0, 12).map((tag: string, i: number) => (
                    <span key={`${tag}-${i}`} className="px-3 py-1 rounded-full border border-input text-xs text-theme-secondary">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!report && !loading.trendReport && !error.trendReport && (
          <EmptyState icon={Globe} title={t('marketingAiPage.trendsEmptyState')} />
        )}
      </div>

      {/* Knowledge Base */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={BookOpen} title={t('marketingAiPage.knowledgeBase')} />
        <Button variant="secondary" size="sm" loading={loading.knowledge}
          leftIcon={!loading.knowledge ? <Lightbulb size={14} /> : undefined}
          onClick={() => load('knowledge', `/knowledge-insights?niche=${encodeURIComponent(niche)}&format=video`)}>
          {t('marketingAiPage.getInsights')}
        </Button>

        {error.knowledge && <ErrorBlock msg={error.knowledge} />}

        {knowledge && (
          <div className="space-y-5">
            {knowledge.voice && (
              <div>
                <p className="ds-text-label text-theme-muted mb-2">{t('marketingAiPage.nicheVoice')}</p>
                <p className="text-sm text-theme-secondary leading-relaxed">{knowledge.voice}</p>
              </div>
            )}
            {Array.isArray(knowledge.proven) && knowledge.proven.length > 0 && (
              <div>
                <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.quickWins')}</p>
                {knowledge.proven.map((win: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-theme-secondary">{win}</p>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(knowledge.pitfalls) && knowledge.pitfalls.length > 0 && (
              <div>
                <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.pitfalls')}</p>
                {knowledge.pitfalls.map((p: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-theme-secondary">{p}</p>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(knowledge.hookFrameworks) && knowledge.hookFrameworks.length > 0 && (
              <div>
                <p className="ds-text-label text-theme-muted mb-3">{t('marketingAiPage.recommendedFrameworks')}</p>
                {knowledge.hookFrameworks.slice(0, 5).map((f: any, i: number) => (
                  <div key={f.id || i} className="p-4 rounded-xl border border-input mb-3 space-y-1">
                    <p className="text-sm text-theme-primary">{f.pattern}</p>
                    {f.example && <p className="text-xs text-theme-muted leading-relaxed">{f.example}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Retention Panel ───────────────────────────────────────────────────────────
// GET /retention-score → { retentionFloor, retentionTarget, curve[{mark, rule}] }
// GET /retention-sequence → { sequence[{step, timing, move, framework}] }
// POST /retention-campaign → { campaign[{videoIndex, promise, retentionMark, directive, cta}] }
function RetentionPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const score = data.retentionScore
  const sequence: any[] = Array.isArray(data.retentionSequence?.sequence) ? data.retentionSequence.sequence : []
  const campaign: any[] = Array.isArray(data.retentionCampaign?.campaign) ? data.retentionCampaign.campaign : []
  const curve: any[] = Array.isArray(score?.curve) ? score.curve : []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Retention guideline */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={Activity} title={t('marketingAiPage.retentionHealth')} subtitle={t('marketingAiPage.audienceLoyaltyScore')} />

        <Button variant="secondary" size="sm" loading={loading.retentionScore}
          leftIcon={!loading.retentionScore ? <Target size={14} /> : undefined}
          onClick={() => load('retentionScore', `/retention-score?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)}>
          {t('marketingAiPage.calculateScore')}
        </Button>

        {error.retentionScore && <ErrorBlock msg={error.retentionScore} />}

        {score && (
          <div className="space-y-5">
            {typeof score.retentionFloor === 'number' && (
              <div className="p-4 rounded-xl border border-input space-y-1">
                <p className="text-sm font-medium text-theme-primary">{t('marketingAiPage.retentionFloorLabel', { value: score.retentionFloor })}</p>
                {typeof score.retentionTarget === 'number' && (
                  <p className="text-sm text-primary font-medium">{t('marketingAiPage.retentionTargetLabel', { value: score.retentionTarget })}</p>
                )}
                <p className="ds-text-caption">{t('marketingAiPage.retentionGuidelineNote', { platform: score.platform || platform })}</p>
              </div>
            )}

            {curve.length > 0 && (
              <div className="space-y-2">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.improvementSteps')}</p>
                {curve.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-input">
                    <ArrowRight size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-theme-secondary"><span className="font-semibold text-theme-primary">{c.mark}</span> · {c.rule}</p>
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
            onClick={() => load('retentionSequence', `/retention-sequence?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)}>
            {t('marketingAiPage.generateSequence')}
          </Button>
          <Button variant="primary" size="sm" loading={loading.retentionCampaign}
            leftIcon={!loading.retentionCampaign ? <Star size={14} /> : undefined}
            onClick={() => load('retentionCampaign', '/retention-campaign', { method: 'POST', body: { niche, platform } })}>
            {t('marketingAiPage.buildCampaign')}
          </Button>
        </div>

        {(error.retentionSequence || error.retentionCampaign) && <ErrorBlock msg={error.retentionSequence || error.retentionCampaign} />}

        {sequence.length > 0 && (
          <div className="space-y-3">
            {sequence.map((s: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-input space-y-2">
                <span className="ds-text-caption font-semibold text-primary">{t('marketingAiPage.sequenceStepLabel', { step: s.step ?? i + 1, timing: s.timing })}</span>
                <p className="text-sm text-theme-primary leading-relaxed">{s.move}</p>
              </div>
            ))}
          </div>
        )}

        {campaign.length > 0 && (
          <div className="space-y-3">
            <p className="ds-text-label text-emerald-600 dark:text-emerald-400">{t('marketingAiPage.campaignPlanGenerated')}</p>
            {campaign.map((c: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                <p className="ds-text-caption font-semibold text-emerald-600 dark:text-emerald-400">{t('marketingAiPage.campaignVideoLabel', { num: c.videoIndex ?? i + 1, mark: c.retentionMark })}</p>
                <p className="text-sm font-medium text-theme-primary">{c.promise}</p>
                {c.directive && <p className="text-xs text-theme-muted">{c.directive}</p>}
                {c.cta && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{c.cta}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Creativity Panel ──────────────────────────────────────────────────────────
// GET /fresh-angles → { angles[{headline, why, framework}] }
// GET /inspiration-drop → { drops[{angle, prompt, format}] }
function CreativityPanel({ niche, topic, setTopic, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const angles: any[] = Array.isArray(data.freshAngles?.angles) ? data.freshAngles.angles : []
  const drops: any[] = Array.isArray(data.inspiration?.drops) ? data.inspiration.drops : []

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
            onClick={() => load('freshAngles', `/fresh-angles?topic=${encodeURIComponent(topic || 'content creation')}&niche=${encodeURIComponent(niche)}`)}>
            {t('marketingAiPage.generateFreshAngles')}
          </Button>
        </div>

        {error.freshAngles && <ErrorBlock msg={error.freshAngles} />}

        {angles.length > 0 && (
          <div className="space-y-3">
            <p className="ds-text-label text-theme-muted">{t('marketingAiPage.yourNovelAngles')}</p>
            {angles.map((angle: any, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-input">
                <span className="ds-text-caption font-semibold text-primary">{t('marketingAiPage.angleNumber', { num: i + 1 })}</span>
                <p className="text-sm text-theme-primary font-medium leading-relaxed my-2">{angle.headline}</p>
                {angle.why && <p className="text-xs text-theme-muted">{angle.why}</p>}
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
          onClick={() => load('inspiration', `/inspiration-drop?niche=${encodeURIComponent(niche)}&format=video`)}>
          {t('marketingAiPage.getNewDrop')}
        </Button>

        {error.inspiration && <ErrorBlock msg={error.inspiration} />}

        {drops.length > 0 && (
          <div className="space-y-3">
            {drops.map((drop: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <p className="ds-text-label text-primary">{drop.angle}</p>
                <p className="text-sm text-theme-secondary leading-relaxed">{drop.prompt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Engagement Panel ──────────────────────────────────────────────────────────
// GET /engagement-prompts → { prompts: { save[], comment[], share[], dm[], follow[] } }
// GET /benchmarks → { benchmarks: { idealLength, hookWindow, captionStyle, hashtags, soundStrategy }, avoid[] }
const PROMPT_GROUPS: { key: string; labelKey: string }[] = [
  { key: 'save', labelKey: 'promptGroupSave' },
  { key: 'comment', labelKey: 'promptGroupComment' },
  { key: 'share', labelKey: 'promptGroupShare' },
  { key: 'dm', labelKey: 'promptGroupDm' },
  { key: 'follow', labelKey: 'promptGroupFollow' },
]
const BENCHMARK_ROWS: { key: string; labelKey: string }[] = [
  { key: 'idealLength', labelKey: 'benchIdealLength' },
  { key: 'hookWindow', labelKey: 'benchHookWindow' },
  { key: 'captionStyle', labelKey: 'benchCaptionStyle' },
  { key: 'hashtags', labelKey: 'benchHashtags' },
  { key: 'soundStrategy', labelKey: 'benchSoundStrategy' },
]

function EngagementPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const prompts = data.engagementPrompts?.prompts
  const promptGroups = prompts && typeof prompts === 'object'
    ? PROMPT_GROUPS.map((g) => ({ ...g, items: Array.isArray(prompts[g.key]) ? prompts[g.key].filter((x: any) => typeof x === 'string' && x) : [] }))
        .filter((g) => g.items.length > 0)
    : []
  const bench = data.benchmarks?.benchmarks
  const avoid: string[] = Array.isArray(data.benchmarks?.avoid) ? data.benchmarks.avoid : []
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={MessageCircle} title={t('marketingAiPage.engagementPrompts')} subtitle={t('marketingAiPage.engagementPromptsSubtitle')} />

        <Button variant="primary" size="sm" loading={loading.engagementPrompts}
          leftIcon={!loading.engagementPrompts ? <Zap size={14} /> : undefined}
          onClick={() => load('engagementPrompts', `/engagement-prompts?platform=${encodeURIComponent(platform)}&niche=${encodeURIComponent(niche)}`)}>
          {t('marketingAiPage.generatePrompts')}
        </Button>

        {error.engagementPrompts && <ErrorBlock msg={error.engagementPrompts} />}

        {promptGroups.length > 0 && (
          <div className="space-y-4">
            <p className="ds-text-label text-theme-muted">{t('marketingAiPage.readyToUsePrompts')}</p>
            {promptGroups.map((g) => (
              <div key={g.key} className="space-y-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border bg-primary/10 text-primary border-primary/20">
                  {t(`marketingAiPage.${g.labelKey}`)}
                </span>
                {g.items.map((text: string, i: number) => (
                  <div key={i} className="p-3 rounded-xl border border-input">
                    <p className="text-sm text-theme-primary leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benchmarks */}
      <div className="ds-surface-card p-5 sm:p-6 space-y-5">
        <PanelHead icon={BarChart3} title={t('marketingAiPage.benchmarksTitle')} subtitle={t('marketingAiPage.benchmarksSubtitle', { platform: platformName })} />

        <Button variant="secondary" size="sm" loading={loading.benchmarks}
          leftIcon={!loading.benchmarks ? <Target size={14} /> : undefined}
          onClick={() => load('benchmarks', `/benchmarks?platform=${encodeURIComponent(platform)}`)}>
          {t('marketingAiPage.loadBenchmarks')}
        </Button>

        {error.benchmarks && <ErrorBlock msg={error.benchmarks} />}

        {bench && typeof bench === 'object' && (
          <div className="space-y-2">
            {BENCHMARK_ROWS.filter((r) => typeof bench[r.key] === 'string' && bench[r.key]).map((r) => (
              <div key={r.key} className="p-3.5 rounded-lg border border-input">
                <p className="ds-text-label text-theme-muted mb-1">{t(`marketingAiPage.${r.labelKey}`)}</p>
                <p className="text-sm text-theme-primary">{bench[r.key]}</p>
              </div>
            ))}
            {avoid.length > 0 && (
              <div className="p-3.5 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
                <p className="ds-text-label text-rose-500">{t('marketingAiPage.benchAvoid', { platform: platformName })}</p>
                {avoid.map((a: string, i: number) => (
                  <p key={i} className="text-xs text-theme-secondary">{a}</p>
                ))}
              </div>
            )}
          </div>
        )}

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
// POST /pre-publish-report → { wordCount, score, verdict: 'publish-ready'|'needs-tightening'|'rewrite', notes[] }
// GET /optimal-windows → { windows[{hour, label, source}] }
function OptimizerPanel({ niche, platform, load, data, loading, error }: any) {
  const { t } = useTranslation()
  const ld = loading['optimizer']
  const err = error['optimizer']
  const report = data['optimizer']
  const windows: any[] = Array.isArray(data.optimalWindows?.windows) ? data.optimalWindows.windows : []
  const [content, setContent] = useState('')
  const score = typeof report?.score === 'number' ? report.score : null
  const notes: string[] = Array.isArray(report?.notes) ? report.notes : []
  const verdictLabel =
    report?.verdict === 'publish-ready' ? t('marketingAiPage.verdictPublishReady')
      : report?.verdict === 'needs-tightening' ? t('marketingAiPage.verdictNeedsTightening')
        : report?.verdict === 'rewrite' ? t('marketingAiPage.verdictRewrite') : ''
  const tone = score == null ? 'neutral' : score >= 75 ? 'good' : score >= 55 ? 'mid' : 'bad'

  const analyze = () => {
    load('optimizer', '/pre-publish-report', { method: 'POST', body: { contentText: content, platform, niche, format: 'post' } })
    load('optimalWindows', `/optimal-windows?niche=${encodeURIComponent(niche)}&platform=${encodeURIComponent(platform)}`)
  }

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
          onClick={analyze}
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
          <div className={cn('p-5 rounded-xl border flex items-center justify-between gap-4',
            tone === 'good' ? 'bg-emerald-500/10 border-emerald-500/20' : tone === 'mid' ? 'bg-amber-500/10 border-amber-500/20' : tone === 'bad' ? 'bg-rose-500/10 border-rose-500/20' : 'border-input')}>
            <div className="min-w-0">
              <p className="ds-text-label text-theme-muted">{t('marketingAiPage.preFlightVerdict')}</p>
              <h3 className="ds-text-h3 text-theme-primary mt-1">{verdictLabel}</h3>
              {typeof report.wordCount === 'number' && (
                <p className="ds-text-caption mt-1">{t('marketingAiPage.wordCountLabel', { count: report.wordCount })}</p>
              )}
            </div>
            {score != null && (
              <div className="text-right shrink-0">
                <p className="ds-text-label text-theme-muted">{t('marketingAiPage.score')}</p>
                <div className={cn('text-3xl font-bold', tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'mid' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500')}>
                  {score}/100
                </div>
              </div>
            )}
          </div>
          <p className="ds-text-caption">{t('marketingAiPage.scoreRuleBasedNote', { platform: report.platform || platform })}</p>

          {notes.length > 0 && (
            <div className="border border-input p-5 rounded-xl space-y-2">
              <h4 className="font-semibold text-theme-primary flex items-center gap-2"><Flame size={16} className="text-amber-500"/> {t('marketingAiPage.notesTitle')}</h4>
              {notes.map((n: string, i: number) => (
                <div key={i} className="flex gap-2 text-sm text-theme-secondary bg-accent p-2 rounded-lg">
                  <ArrowRight size={16} className="shrink-0 mt-0.5 text-primary" /> <span>{n}</span>
                </div>
              ))}
            </div>
          )}

          {windows.length > 0 && (
            <div className="border border-input p-5 rounded-xl">
              <h4 className="font-semibold text-theme-primary mb-3 flex items-center gap-2"><Clock size={16} className="text-primary"/> {t('marketingAiPage.optimalPostingWindows')}</h4>
              <div className="flex flex-wrap gap-2">
                {windows.map((w: any, i: number) => (
                  <div key={i} className="px-3.5 py-2.5 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                    <strong className="text-primary">{String(w.hour).padStart(2, '0')}:00</strong> <span className="text-theme-muted">{w.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
