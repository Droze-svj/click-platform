'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap, Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, Brain, Target,
  Globe, Terminal, Layers, Orbit, Command, Film, RefreshCw, Sparkle, Waves,
  Mic2, Shield, Database, Copy,
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiPost } from '../lib/api'
import { useHardenedRequest } from '../hooks/useHardenedRequest'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Button, IconButton, Input, Textarea } from './ui'

const STAGES = [
  { id: 'intelligence', labelKey: 'autonomousCreator.stageResearching', icon: Brain },
  { id: 'script',       labelKey: 'autonomousCreator.stageWritingScript',     icon: Terminal },
  { id: 'refinery',     labelKey: 'autonomousCreator.stagePolishing',         icon: Orbit },
  { id: 'anatomy',      labelKey: 'autonomousCreator.stagePlanningCuts',         icon: Layers },
  { id: 'blueprint',    labelKey: 'autonomousCreator.stageBuildingTimeline',    icon: Command },
]

export default function AutonomousCreator() {
  const router = useRouter()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { execute: executeHardened, rateLimitCountdown } = useHardenedRequest()
  
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState('tiktok')
  const [tone, setTone] = useState('educational')
  const [stylePivot, setStylePivot] = useState('BALANCED')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [activeVariantIndex, setActiveVariantIndex] = useState(0)
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Ids of variants the user has actually saved to the library.
  const [savedIds, setSavedIds] = useState<string[]>([])

  // A stage is "done" only when the server's response contains its output.
  // While the single request is in flight there is no per-stage progress to
  // report, so the steps list shows one honest busy state instead.
  const completedStages: string[] = result?.stages
    ? STAGES.filter(s => result.stages[s.id]).map(s => s.id)
    : []

  const saveManifest = async () => {
    if (!result) return

    try {
      showToast(t('autonomousCreator.savingToast'), 'info')
      const res = await apiPost('/intelligence/factory/save', {
        manifest: result.data || result,
        topic: prompt,
        platform: platform,
        contentType: 'social-media'
      })

      if (res.success) {
        if (result.id) setSavedIds(prev => (prev.includes(result.id) ? prev : [...prev, result.id]))
        showToast(t('autonomousCreator.savedToast'), 'success')
      } else {
        showToast(t('autonomousCreator.couldNotSave'), 'error')
      }
    } catch (err: any) {
      showToast(t('autonomousCreator.couldNotSave'), 'error')
    }
  }

  const runFactory = async (pivot?: string) => {
    if (!prompt.trim()) {
      showToast(t('autonomousCreator.describeVideoFirst'), 'warning')
      return
    }

    if (pivot) setStylePivot(pivot)

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await executeHardened(() => apiPost('/intelligence/factory/create', {
        prompt,
        targetPlatform: platform,
        tone: tone,
        stylePivot: pivot || stylePivot,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        useCreatorDNA: true
      }))

      if (res && res.success) {
        const newVariant = { ...res.data, id: `variant-${Date.now()}`, pivot: pivot || stylePivot }
        setVariants(prev => [newVariant, ...prev].slice(0, 3))
        setResult(newVariant)
        setActiveVariantIndex(0)
        showToast(t('autonomousCreator.videoReady'), 'success')
      } else if (res) {
        setError(res.error || t('autonomousCreator.somethingWentWrong'))
      } else {
        setError(t('autonomousCreator.couldNotConnect'))
      }
    } catch (err: any) {
      setError(err.message || t('autonomousCreator.connectionLost'))
      showToast(t('autonomousCreator.couldNotGenerate'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const chip = (active: boolean) =>
    `h-9 px-3 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap disabled:opacity-50 ${active
      ? 'bg-primary border-primary text-primary-foreground'
      : 'border-input bg-background text-theme-muted hover:text-theme-primary hover:bg-accent'}`

  return (
    <div className="flex flex-col gap-6">
      {/* Idea */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="forge-idea" className="ds-text-label text-theme-primary inline-flex items-center gap-2">
            <Terminal size={16} className="text-indigo-500" aria-hidden /> {t('autonomousCreator.yourIdea')}
          </label>
          {loading && (
            <div className="flex items-center gap-3">
              {(rateLimitCountdown ?? 0) > 0 ? (
                <span className="ds-text-caption text-rose-500">{t('autonomousCreator.cooling', { seconds: rateLimitCountdown ?? 0 })}</span>
              ) : (
                <span role="status" className="ds-text-caption text-indigo-500">{t('autonomousCreator.working')}</span>
              )}
              {/* Indeterminate: the request reports no progress, so none is shown. */}
              <div className="relative w-24 h-1.5 bg-accent rounded-full overflow-hidden" aria-hidden="true">
                {(rateLimitCountdown ?? 0) > 0 ? (
                  <div className="h-full w-full bg-rose-500" />
                ) : (
                  <m.div
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-y-0 left-0 w-1/3 bg-indigo-500"
                  />
                )}
              </div>
            </div>
          )}
        </div>
        <Textarea
          id="forge-idea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          placeholder={t('autonomousCreator.promptPlaceholder')}
          className="min-h-[120px] text-base"
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="forge-keywords" className="ds-text-caption text-theme-muted inline-flex items-center gap-2">
            <Database size={14} aria-hidden /> {t('autonomousCreator.keywordsOptional')}
          </label>
          <Input
            id="forge-keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={loading}
            placeholder={t('autonomousCreator.keywordsPlaceholder')}
          />
        </div>
      </div>

      {/* Platform + tone */}
      <div className="grid grid-cols-1 gap-5 border-t border-[var(--border-subtle)] pt-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="ds-text-label text-theme-primary mb-2 inline-flex items-center gap-2">
            <Globe size={14} className="text-indigo-500" aria-hidden /> {t('autonomousCreator.platform')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {['tiktok', 'instagram_reels', 'youtube_shorts', 'linkedin', 'twitter'].map(p => (
              <button type="button" key={p} onClick={() => setPlatform(p)} disabled={loading} aria-pressed={platform === p} className={chip(platform === p)}>
                {t(`autonomousCreator.platformName.${p}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="ds-text-label text-theme-primary mb-2 inline-flex items-center gap-2">
            <Mic2 size={14} className="text-indigo-500" aria-hidden /> {t('autonomousCreator.tone')}
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'educational', labelKey: 'autonomousCreator.toneAuthoritative', icon: Shield },
              { id: 'motivational', labelKey: 'autonomousCreator.toneElevated', icon: Zap },
              { id: 'storytelling', labelKey: 'autonomousCreator.toneNarrative', icon: Film },
              { id: 'controversial', labelKey: 'autonomousCreator.toneDisruptive', icon: AlertCircle },
            ].map(toneOption => (
              <button
                type="button"
                key={toneOption.id}
                onClick={() => setTone(toneOption.id)}
                disabled={loading}
                aria-pressed={tone === toneOption.id}
                className={`${chip(tone === toneOption.id)} inline-flex items-center justify-center gap-2`}
              >
                <toneOption.icon size={14} aria-hidden />
                <span className="truncate">{t(toneOption.labelKey)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="ds-text-label text-theme-primary mb-1 inline-flex items-center gap-2">
            <Sparkle size={14} className="text-amber-500" aria-hidden /> {t('autonomousCreator.stylePivots')}
          </legend>
          <p className="ds-text-caption text-theme-muted mb-1">{t('autonomousCreator.pickVisualDirection')}</p>
          <div className="flex flex-wrap gap-2">
            {['HIGH ENERGY', 'MINIMALIST', 'CINEMATIC', 'DYNAMIC', 'VIRAL', 'PREMIUM', 'UGC_RAW'].map(p => (
              <button type="button" key={p} onClick={() => setStylePivot(p)} aria-pressed={stylePivot === p} className={chip(stylePivot === p)}>
                {t(`autonomousCreator.pivot.${p.replace(/ /g, '_')}`)}
              </button>
            ))}
          </div>
          {stylePivot === 'UGC_RAW' && (
            <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-theme-secondary">
              <span className="font-semibold text-amber-600 dark:text-amber-400">{t('autonomousCreator.authenticityBoostOn')}</span>{' '}
              {t('autonomousCreator.ugcStyleDescription')}
            </p>
          )}
        </fieldset>
      </div>

      <Button
        variant="gradient"
        size="lg"
        onClick={() => runFactory()}
        disabled={loading || !prompt.trim()}
        loading={loading}
        leftIcon={!loading ? <Zap size={18} aria-hidden /> : undefined}
        className="w-full"
      >
        {loading ? t('autonomousCreator.generating') : t('autonomousCreator.generate')}
      </Button>

      {/* Steps */}
      <div className="ds-surface-subtle p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="ds-text-label text-theme-primary inline-flex items-center gap-2">
            <Waves size={16} className="text-emerald-500" aria-hidden /> {t('autonomousCreator.liveProgress')}
          </h3>
          {loading && (
            <span role="status" className="inline-flex items-center gap-2 ds-text-caption text-indigo-500">
              <Loader2 size={14} className="animate-spin" aria-hidden /> {t('autonomousCreator.workingAllSteps')}
            </span>
          )}
        </div>
        <ol className="flex flex-wrap gap-x-4 gap-y-2">
          {STAGES.map((s, i) => {
            const done = completedStages.includes(s.id)
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-500 text-white' : 'border border-[var(--border-subtle)] text-theme-muted'}`}>
                  {done ? <CheckCircle2 size={14} aria-hidden /> : i + 1}
                </span>
                <span className={`text-sm ${done ? 'text-theme-primary font-medium' : 'text-theme-muted'}`}>{t(s.labelKey)}</span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result && (
          <m.div
            key={result.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] p-5 flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 size={20} aria-hidden />
                </span>
                <div>
                  <h3 className="ds-text-h3 text-theme-primary">{t('autonomousCreator.ready')}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {savedIds.includes(result.id) && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('autonomousCreator.savedBadge')}</span>
                    )}
                    <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-theme-muted">{t('autonomousCreator.variantNumber', { number: activeVariantIndex + 1 })}</span>
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">{t('autonomousCreator.styleLabel', { style: result.pivot ? t(`autonomousCreator.pivot.${String(result.pivot).replace(/ /g, '_')}`) : t('autonomousCreator.balanced') })}</span>
                  </div>
                </div>
              </div>
              {variants.length > 1 && (
                <div className="inline-flex gap-1 rounded-lg ds-surface-subtle p-1" role="group" aria-label={t('autonomousCreator.variants')}>
                  {variants.map((v, i) => (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => { setActiveVariantIndex(i); setResult(variants[i]) }}
                      aria-pressed={activeVariantIndex === i}
                      className={`h-8 min-w-8 px-2 rounded-md text-sm font-semibold transition-colors ${activeVariantIndex === i ? 'bg-primary text-primary-foreground' : 'text-theme-muted hover:text-theme-primary'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="ds-text-caption text-theme-muted">{t('autonomousCreator.title')}</p>
                  <p className="ds-text-h3 text-theme-primary">{result.stages?.script?.title || t('autonomousCreator.untitled')}</p>
                </div>
                <div>
                  <p className="ds-text-caption text-theme-muted">{t('autonomousCreator.hook')}</p>
                  <p className="border-l-2 border-emerald-500/50 pl-3 text-base text-theme-secondary">
                    &quot;{result.stages?.script?.hook || result.stages?.script?.rawScript?.hook || t('autonomousCreator.hookFallback')}&quot;
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3">
                  <div className="ds-surface-subtle p-3">
                    <dt className="ds-text-caption text-theme-muted">{t('autonomousCreator.duration')}</dt>
                    <dd className="text-lg font-semibold text-theme-primary tabular-nums">{result.stages?.blueprint?.totalDuration || result.stages?.anatomy?.totalDuration || '—'} {t('autonomousCreator.sec')}</dd>
                  </div>
                  <div className="ds-surface-subtle p-3">
                    <dt className="ds-text-caption text-theme-muted">{t('autonomousCreator.platform')}</dt>
                    <dd className="text-lg font-semibold text-theme-primary">{t(`autonomousCreator.platformName.${platform}`)}</dd>
                  </div>
                </dl>
              </div>

              <div className="ds-surface-subtle p-4 flex flex-col gap-3">
                <p className="ds-text-label text-indigo-500 inline-flex items-center gap-2"><Sparkle size={14} aria-hidden /> {t('autonomousCreator.angleLabel')}</p>
                <p className="text-base text-theme-primary">
                  {result.stages?.intelligence?.positioning
                    ? <>&quot;{result.stages.intelligence.positioning}&quot;</>
                    : t('autonomousCreator.positioningUnavailable')}
                </p>
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <dt className="ds-text-caption text-theme-muted">{t('autonomousCreator.scoreLabel')}</dt>
                    <dd className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{Number.isFinite(Number(result.resonanceScore)) && result.resonanceScore !== null ? `${Math.round(Number(result.resonanceScore))}/100` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="ds-text-caption text-theme-muted">{t('autonomousCreator.postingWindow')}</dt>
                    <dd className="text-lg font-semibold text-theme-primary">{result.stages?.blueprint?.postingWindow || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
              <IconButton
                variant="ghost"
                size="md"
                onClick={() => { navigator.clipboard.writeText(result.script || ''); showToast(t('autonomousCreator.scriptCopied'), 'success') }}
                title={t('autonomousCreator.copyScript')}
                aria-label={t('autonomousCreator.copyScript')}
              >
                <Copy size={16} aria-hidden />
              </IconButton>
              <IconButton
                variant="ghost"
                size="md"
                onClick={() => {
                  setPrompt(`Rewrite this script to make it more ${tone === 'educational' ? 'authoritative' : 'engaging'}: ${result.script?.slice(0, 500)}...`)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  showToast(t('autonomousCreator.scriptLoadedIntoPrompt'), 'info')
                }}
                title={t('autonomousCreator.refineWithAi')}
                aria-label={t('autonomousCreator.refineWithAi')}
              >
                <Sparkles size={16} aria-hidden />
              </IconButton>
              <Button variant="secondary" size="md" onClick={() => runFactory()} disabled={loading} leftIcon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden />}>
                {t('autonomousCreator.regenerate')}
              </Button>
              <Button variant="secondary" size="md" onClick={saveManifest} disabled={loading || !result} leftIcon={<Database size={16} aria-hidden />}>
                {t('autonomousCreator.saveToLibrary')}
              </Button>
              <Button variant="primary" size="md" className="sm:ml-auto" onClick={() => router.push('/dashboard/video')} leftIcon={<Film size={16} aria-hidden />} rightIcon={<ArrowRight size={16} aria-hidden />}>
                {t('autonomousCreator.openInEditor')}
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {error && (
        <div role="alert" className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <AlertCircle size={20} className="shrink-0 text-rose-500" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="ds-text-label text-rose-600 dark:text-rose-400">{t('autonomousCreator.errorHeading')}</p>
            <p className="text-sm text-theme-secondary">{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setError(null)}>{t('autonomousCreator.dismiss')}</Button>
        </div>
      )}

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Brain,  titleKey: 'autonomousCreator.tipPolishTitle',   descKey: 'autonomousCreator.tipPolishDesc' },
          { icon: Target, titleKey: 'autonomousCreator.tipPlatformTitle', descKey: 'autonomousCreator.tipPlatformDesc' },
          { icon: Sparkle, titleKey: 'autonomousCreator.tipVoiceTitle',   descKey: 'autonomousCreator.tipVoiceDesc' },
        ].map(tip => (
          <div key={tip.titleKey} className="ds-surface-subtle p-4">
            <tip.icon size={18} className="mb-2 text-indigo-500" aria-hidden />
            <p className="text-sm font-semibold text-theme-primary">{t(tip.titleKey)}</p>
            <p className="mt-1 ds-text-caption text-theme-muted">{t(tip.descKey)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
