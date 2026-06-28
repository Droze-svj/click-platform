'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Compass, ArrowRight, CheckCircle, Circle, Lock,
  Sparkles, Zap, Target, RefreshCw, SkipForward,
  Plug, Video, Calendar, Users, Palette, FileText, Hammer,
  type LucideIcon,
  Dumbbell, BarChart3, BookOpen, Cpu, Briefcase, Drama, Globe,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { ListItemSkeleton } from '../../../components/LoadingSkeleton'
import { apiGet, apiPost, apiPut } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '@/lib/utils'
import { Panel, SectionHeader, Button } from '@/components/ui'

interface OnboardingStep {
  id: string
  title?: string
  label?: string
  description?: string
  completed?: boolean
  cta?: string
  href?: string
  icon?: any
}

interface OnboardingResponse {
  steps?: OnboardingStep[]
  completedSteps?: number
  totalSteps?: number
  isComplete?: boolean
  currentStep?: number
  progress?: any
}

const FALLBACK_STEPS: OnboardingStep[] = [
  { id: 'profile',     title: 'Complete Profile',       description: 'Tell Click your niche so AI generations match your voice.', cta: 'OPEN_SETTINGS',     href: '/dashboard/settings',    icon: Users },
  { id: 'brand',       title: 'Build Brand Kit',        description: 'Lock in colors, fonts, and tone for consistent outputs.',   cta: 'OPEN_BRAND_KIT',    href: '/dashboard/brand-kit',   icon: Palette },
  { id: 'connect',     title: 'Connect Social Account', description: 'Link TikTok, Instagram or YouTube to enable scheduling.',   cta: 'OPEN_INTEGRATIONS', href: '/dashboard/integrations', icon: Plug },
  { id: 'upload',      title: 'Upload First Video',     description: 'Drop a long-form video and let Click extract clips.',       cta: 'OPEN_VIDEO_HUB',    href: '/dashboard/video',       icon: Video },
  { id: 'captions',    title: 'Set Up Your Captions',   description: 'Pick a caption look + keep Snap-to-Speech on for word-perfect captions.', cta: 'OPEN_CAPTION_SETUP', href: '/dashboard/onboarding/captions', icon: Sparkles },
  { id: 'forge',       title: 'Run One-Click Forge',    description: 'Generate a multi-platform pack from a single prompt.',      cta: 'OPEN_FORGE',        href: '/dashboard/forge',       icon: Hammer },
  { id: 'script',      title: 'Generate a Script',      description: 'Synthesize a script tuned to your tone and platform.',      cta: 'OPEN_SCRIPTS',      href: '/dashboard/scripts',     icon: FileText },
  { id: 'schedule',    title: 'Schedule First Post',    description: 'Lock a post to the calendar to test the publish loop.',     cta: 'OPEN_CALENDAR',     href: '/dashboard/calendar',    icon: Calendar },
]

// Niche catalogue — matches NICHE_PLAYBOOKS in server/services/marketingKnowledge.js
// so the user's pick maps 1:1 to a real Gemini playbook on the strategist endpoint.
const NICHE_OPTIONS: { value: string; icon: LucideIcon }[] = [
  { value: 'health',        icon: Dumbbell },
  { value: 'finance',       icon: BarChart3 },
  { value: 'education',     icon: BookOpen },
  { value: 'technology',    icon: Cpu },
  { value: 'lifestyle',     icon: Sparkles },
  { value: 'business',      icon: Briefcase },
  { value: 'entertainment', icon: Drama },
  { value: 'other',         icon: Globe },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()
  const { state: workflow, setNiche } = useWorkflow()
  const { t } = useTranslation()

  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)
  const [editingNiche, setEditingNiche] = useState(false)

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true)
      const res: any = await apiGet('/onboarding')
      const body: OnboardingResponse = res?.data ?? res ?? {}
      const apiSteps = Array.isArray(body.steps) ? body.steps : []
      if (apiSteps.length === 0) {
        setSteps(FALLBACK_STEPS)
      } else {
        setSteps(apiSteps.map(s => ({ ...s, title: s.title || s.label })))
      }
    } catch {
      setSteps(FALLBACK_STEPS)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadProgress()
  }, [user, authLoading, router, loadProgress])

  const completedCount = useMemo(() => steps.filter(s => s.completed).length, [steps])
  const totalCount = steps.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isComplete = totalCount > 0 && completedCount === totalCount

  const handleComplete = async (id: string) => {
    setCompleting(id)
    try {
      await apiPost('/onboarding/complete-step', { stepId: id })
      showToast(t('onboardingPage.toastStepLogged'), 'success')
      setSteps(prev => prev.map(s => s.id === id ? { ...s, completed: true } : s))
    } catch {
      showToast(t('onboardingPage.toastLogFailed'), 'error')
    } finally { setCompleting(null) }
  }

  // Wire niche picks straight into WorkflowContext (persists to localStorage)
  // and auto-mark the 'profile' onboarding step complete on the server.
  const handlePickNiche = async (value: string) => {
    setNiche(value)
    setEditingNiche(false)
    showToast(t('onboardingPage.toastNicheLocked', { niche: value.toUpperCase() }), 'success')
    try {
      await apiPut('/niche/select', { niche: value })
    } catch {
      showToast(t('onboardingPage.toastNicheSyncFailed'), 'error')
    }
    const profileStep = steps.find(s => s.id === 'profile')
    if (profileStep && !profileStep.completed) {
      try {
        await apiPost('/onboarding/complete-step', { stepId: 'profile' })
        setSteps(prev => prev.map(s => s.id === 'profile' ? { ...s, completed: true } : s))
      } catch { /* non-critical */ }
    }
  }

  const handleSkipAll = async () => {
    setSkipping(true)
    try {
      await apiPost('/onboarding/skip', {})
      showToast(t('onboardingPage.toastSequenceSkipped'), 'success')
      setSteps(prev => prev.map(s => ({ ...s, completed: true })))
    } catch {
      showToast(t('onboardingPage.toastSkipFailed'), 'error')
    } finally { setSkipping(false) }
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto space-y-3" aria-busy="true" aria-label={t('onboardingPage.loading')}>
      {Array.from({ length: 6 }).map((_, i) => <ListItemSkeleton key={i} />)}
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('onboardingPage.getStarted')}
          description={t('onboardingPage.subtitle')}
          className="mb-6"
          actions={
            !isComplete && (
              <Button
                variant="secondary"
                size="md"
                disabled={skipping}
                onClick={handleSkipAll}
                leftIcon={<SkipForward size={16} aria-hidden />}
              >
                {t('onboardingPage.skipSequence')}
              </Button>
            )
          }
        />

        {/* Niche picker — every downstream AI surface reads WorkflowContext.niche */}
        {(!workflow.niche || editingNiche) ? (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Target size={20} aria-hidden />
                </span>
                <div>
                  <h3 className="ds-text-h3 text-theme-primary">{t('onboardingPage.pickYourCategory')}</h3>
                  <p className="ds-text-caption mt-1">{t('onboardingPage.nicheCalibrationDescription')}</p>
                </div>
              </div>
              {workflow.niche && (
                <Button variant="ghost" size="sm" onClick={() => setEditingNiche(false)}>
                  {t('onboardingPage.cancel')}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {NICHE_OPTIONS.map(opt => {
                const selected = workflow.niche === opt.value
                const OptIcon = opt.icon
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => handlePickNiche(opt.value)}
                    aria-label={selected ? t('onboardingPage.nicheSelectedAria', { niche: opt.value }) : t('onboardingPage.nicheSelectAria', { niche: opt.value })}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                      selected
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-[var(--border-subtle)] bg-transparent text-theme-secondary hover:bg-accent hover:text-theme-primary'
                    )}
                  >
                    <OptIcon size={22} aria-hidden />
                    <span className="ds-text-label">{t(`onboardingPage.niche_${opt.value}`)}</span>
                  </button>
                )
              })}
            </div>
          </Panel>
        ) : (
          <Panel variant="bento" className="ds-anim-rise mb-6 p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle size={18} aria-hidden />
              </span>
              <div>
                <p className="ds-text-caption">{t('onboardingPage.nicheLockedLabel')}</p>
                <p className="ds-text-label text-theme-primary capitalize">{workflow.niche}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditingNiche(true)}>
              {t('onboardingPage.change')}
            </Button>
          </Panel>
        )}

        {/* Progress strip */}
        <Panel variant="bento" className="ds-anim-rise mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'
              )}>
                {isComplete ? <CheckCircle size={20} aria-hidden /> : <Zap size={20} aria-hidden />}
              </span>
              <div>
                <p className="ds-text-caption">{isComplete ? t('onboardingPage.sequenceComplete') : t('onboardingPage.progress')}</p>
                <p className="ds-text-label text-theme-primary">{t('onboardingPage.stepsCount', { completed: completedCount, total: totalCount })}</p>
              </div>
            </div>
            <p className="ds-text-h1 text-theme-primary tabular-nums">{pct}<span className="ds-text-h3 text-theme-muted">%</span></p>
          </div>
          <div className="h-2 rounded-full bg-accent overflow-hidden">
            <div
              className={cn('h-full transition-[width] duration-500', isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-indigo-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Panel>

        {/* Steps ladder */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon || Circle
            const isLocked = idx > 0 && !steps[idx - 1].completed && !step.completed
            const isCompleting = completing === step.id
            return (
              <Panel
                key={step.id}
                variant="bento"
                className={cn(
                  'ds-anim-rise p-5 flex flex-col lg:flex-row items-center gap-4',
                  isLocked && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-4 flex-1 w-full min-w-0">
                  <span className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                    step.completed ? 'bg-emerald-500/10 text-emerald-500' : isLocked ? 'bg-accent text-theme-muted' : 'bg-indigo-500/10 text-indigo-500'
                  )}>
                    {step.completed ? <CheckCircle size={22} aria-hidden /> : isLocked ? <Lock size={20} aria-hidden /> : <Icon size={22} aria-hidden />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="ds-text-label text-theme-primary">{step.title}</h3>
                      {step.completed && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 ds-text-caption">{t('onboardingPage.done')}</span>
                      )}
                    </div>
                    {step.description && <p className="ds-text-caption mt-1">{step.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  {step.href && !step.completed && (
                    <Link href={step.href} className="flex-1 lg:flex-none">
                      <Button variant="primary" size="md" rightIcon={<ArrowRight size={14} aria-hidden />} className="w-full">
                        {step.cta || t('onboardingPage.open')}
                      </Button>
                    </Link>
                  )}
                  {!step.completed && (
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={isCompleting}
                      onClick={() => handleComplete(step.id)}
                      aria-label={t('onboardingPage.markComplete', { title: step.title || '' })}
                      leftIcon={isCompleting ? <RefreshCw size={16} className="animate-spin" aria-hidden /> : <CheckCircle size={16} aria-hidden />}
                    />
                  )}
                </div>
              </Panel>
            )
          })}
        </div>

        {/* Completion banner */}
        {isComplete && (
          <Panel variant="bento" className="ds-anim-rise mt-6 p-8 border-emerald-500/30 text-center flex flex-col items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Sparkles size={28} aria-hidden />
            </span>
            <div>
              <h2 className="ds-text-h2 text-theme-primary">{t('onboardingPage.fullyWiredIn')}</h2>
              <p className="ds-text-caption mt-1">{t('onboardingPage.fullCapacity')}</p>
            </div>
            <Link href="/dashboard">
              <Button variant="primary" size="md" rightIcon={<ArrowRight size={16} aria-hidden />}>
                {t('onboardingPage.enterDashboard')}
              </Button>
            </Link>
          </Panel>
        )}
      </div>
    </ErrorBoundary>
  )
}
