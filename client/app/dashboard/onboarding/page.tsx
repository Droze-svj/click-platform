'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Compass, ArrowLeft, ArrowRight, CheckCircle, Circle, Lock,
  Activity, Sparkles, Zap, Target, RefreshCw, SkipForward,
  Plug, Video, Calendar, Users, Palette, FileText, Hammer
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { apiGet, apiPost } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'

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
  { id: 'forge',       title: 'Run One-Click Forge',    description: 'Generate a multi-platform pack from a single prompt.',      cta: 'OPEN_FORGE',        href: '/dashboard/forge',       icon: Hammer },
  { id: 'script',      title: 'Generate a Script',      description: 'Synthesize a script tuned to your tone and platform.',      cta: 'OPEN_SCRIPTS',      href: '/dashboard/scripts',     icon: FileText },
  { id: 'schedule',    title: 'Schedule First Post',    description: 'Lock a post to the calendar to test the publish loop.',     cta: 'OPEN_CALENDAR',     href: '/dashboard/calendar',    icon: Calendar },
]

const glassStyle = 'backdrop-blur-3xl bg-white/[0.02] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.6)] transition-all duration-300'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()

  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)
  const [skipping, setSkipping] = useState(false)

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
      showToast('✓ STEP_LOGGED', 'success')
      setSteps(prev => prev.map(s => s.id === id ? { ...s, completed: true } : s))
    } catch {
      showToast('LOG_FAILED: STATE_NOT_PERSISTED', 'error')
    } finally { setCompleting(null) }
  }

  const handleSkipAll = async () => {
    setSkipping(true)
    try {
      await apiPost('/onboarding/skip', {})
      showToast('✓ SEQUENCE_SKIPPED', 'success')
      setSteps(prev => prev.map(s => ({ ...s, completed: true })))
    } catch {
      showToast('SKIP_FAILED', 'error')
    } finally { setSkipping(false) }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 bg-[#020205] min-h-screen gap-10 backdrop-blur-3xl">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 animate-pulse" />
        <Compass size={80} className="text-emerald-500 animate-spin relative z-10" />
      </div>
      <p className="text-[12px] font-black text-emerald-400 uppercase tracking-[0.8em] animate-pulse italic leading-none">Loading Activation Sequence...</p>
    </div>
  )

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative z-10 pb-24 px-8 pt-12 max-w-[1400px] mx-auto space-y-16 bg-[#020205]">
        <ToastContainer />

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-10">
            <button type="button" onClick={() => router.push('/dashboard')} title="Back" className="w-16 h-16 rounded-[1.8rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:border-rose-500/50">
              <ArrowLeft size={28} />
            </button>
            <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2.5rem] flex items-center justify-center shadow-3xl">
              <Compass size={40} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-4 mb-3">
                <Activity size={14} className="text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-emerald-400 italic leading-none">Activation Sequence</span>
              </div>
              <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-3">Get Started</h1>
              <p className="text-slate-500 text-[12px] uppercase font-black tracking-[0.4em] italic leading-none">Stepwise initialization of your sovereign Click instance.</p>
            </div>
          </div>
          {!isComplete && (
            <button type="button" disabled={skipping} onClick={handleSkipAll} className="px-8 py-4 bg-white/5 border-2 border-white/10 text-slate-400 rounded-full text-[11px] font-black uppercase tracking-[0.5em] hover:text-white italic flex items-center gap-3 transition-colors disabled:opacity-40">
              <SkipForward size={14} /> SKIP_SEQUENCE
            </button>
          )}
        </div>

        {/* Progress Strip */}
        <div className={`${glassStyle} rounded-[3rem] p-10 ${isComplete ? 'border-emerald-500/30 shadow-[0_0_120px_rgba(16,185,129,0.15)]' : 'border-emerald-500/10'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-[1.4rem] ${isComplete ? 'bg-emerald-500 text-black' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'} flex items-center justify-center shadow-xl`}>
                {isComplete ? <CheckCircle size={26} /> : <Zap size={26} />}
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em] italic mb-2 leading-none">{isComplete ? 'SEQUENCE_COMPLETE' : 'PROGRESS'}</p>
                <p className="text-3xl font-black text-white italic uppercase tracking-tight leading-none">{completedCount} / {totalCount} STEPS</p>
              </div>
            </div>
            <p className="text-6xl font-black text-white italic tabular-nums tracking-tighter leading-none">{pct}<span className="text-2xl text-slate-500">%</span></p>
          </div>
          <div className="h-3 rounded-full bg-white/5 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className={`h-full ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-indigo-500'}`} />
          </div>
        </div>

        {/* Steps Ladder */}
        <div className="space-y-5">
          {steps.map((step, idx) => {
            const Icon = step.icon || Circle
            const isLocked = idx > 0 && !steps[idx - 1].completed && !step.completed
            const isCompleting = completing === step.id
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`${glassStyle} rounded-[2.5rem] p-8 flex flex-col lg:flex-row items-center gap-6 ${step.completed ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : isLocked ? 'opacity-50' : 'hover:border-emerald-500/20'}`}
              >
                <div className="flex items-center gap-5 flex-1 w-full">
                  <div className="relative flex-shrink-0">
                    <div className={`w-14 h-14 rounded-[1.4rem] flex items-center justify-center shadow-xl ${step.completed ? 'bg-emerald-500 text-black' : isLocked ? 'bg-white/5 text-slate-600 border border-white/10' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                      {step.completed ? <CheckCircle size={26} /> : isLocked ? <Lock size={22} /> : <Icon size={26} />}
                    </div>
                    <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#020205] border ${step.completed ? 'border-emerald-500/40 text-emerald-400' : 'border-white/10 text-slate-500'} flex items-center justify-center text-[10px] font-black italic tabular-nums`}>{idx + 1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className={`text-2xl font-black italic uppercase tracking-tight leading-tight ${step.completed ? 'text-emerald-400 line-through decoration-emerald-500/40' : 'text-white'}`}>{step.title}</h3>
                      {step.completed && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase tracking-[0.3em] italic">DONE</span>}
                    </div>
                    {step.description && <p className="text-[12px] text-slate-400 leading-relaxed font-medium">{step.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  {step.href && !step.completed && (
                    <Link href={step.href} className="flex-1 lg:flex-none px-7 py-3.5 bg-white text-black rounded-full text-[11px] font-black uppercase tracking-[0.4em] italic hover:bg-indigo-500 hover:text-white transition-colors flex items-center justify-center gap-3 whitespace-nowrap">
                      {step.cta || 'OPEN'} <ArrowRight size={14} />
                    </Link>
                  )}
                  {!step.completed && (
                    <button type="button" disabled={isCompleting} onClick={() => handleComplete(step.id)} title="Mark as complete" className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0">
                      {isCompleting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Completion banner */}
        {isComplete && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`${glassStyle} rounded-[3rem] p-12 border-emerald-500/30 text-center flex flex-col items-center gap-6 shadow-[0_0_120px_rgba(16,185,129,0.15)]`}>
            <div className="w-20 h-20 rounded-[2rem] bg-emerald-500 text-black flex items-center justify-center shadow-[0_30px_80px_rgba(16,185,129,0.4)]">
              <Sparkles size={40} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.5em] italic mb-3 leading-none">SOVEREIGN_INSTANCE_ACTIVATED</p>
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-tight mb-3">You&apos;re fully wired in.</h2>
              <p className="text-[12px] text-slate-400 uppercase font-black tracking-[0.4em] italic">Click is now operating at full capacity for your account.</p>
            </div>
            <Link href="/dashboard" className="px-10 py-4 bg-white text-black rounded-full text-[12px] font-black uppercase tracking-[0.5em] italic hover:bg-emerald-500 hover:text-white transition-colors flex items-center gap-3">
              ENTER_DASHBOARD <ArrowRight size={16} />
            </Link>
          </motion.div>
        )}
      </div>
    </ErrorBoundary>
  )
}
