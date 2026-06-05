'use client'
/**
 * CLICK Onboarding Wizard — AI-Personalized Edition
 * Niche Quiz → Welcome → Import → Hook → Export
 * The niche quiz calibrates the entire AI stack for this creator.
 */

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Download, ChevronRight, X, Check,
  Sparkles, Zap, ArrowRight, Brain, Target, Rocket
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface OnboardingWizardProps {
  onComplete: () => void
}

// ── Niche Quiz Data ────────────────────────────────────────────────────────────
// Display-text fields hold translation keys resolved via `t()` at render time.
const NICHE_TYPES = [
  { id: 'creator', labelKey: 'onboardingWizard.nicheCreatorLabel', emoji: '🎬', descKey: 'onboardingWizard.nicheCreatorDesc' },
  { id: 'brand', labelKey: 'onboardingWizard.nicheBrandLabel', emoji: '🏢', descKey: 'onboardingWizard.nicheBrandDesc' },
  { id: 'educator', labelKey: 'onboardingWizard.nicheEducatorLabel', emoji: '🎓', descKey: 'onboardingWizard.nicheEducatorDesc' },
  { id: 'agency', labelKey: 'onboardingWizard.nicheAgencyLabel', emoji: '🚀', descKey: 'onboardingWizard.nicheAgencyDesc' },
]

const PLATFORM_TARGETS = [
  { id: 'tiktok', labelKey: 'onboardingWizard.platformTiktok', emoji: '🎵' },
  { id: 'instagram', labelKey: 'onboardingWizard.platformInstagram', emoji: '📸' },
  { id: 'youtube', labelKey: 'onboardingWizard.platformYoutube', emoji: '▶️' },
  { id: 'linkedin', labelKey: 'onboardingWizard.platformLinkedin', emoji: '💼' },
]

const CREATOR_GOALS = [
  { id: 'viral', labelKey: 'onboardingWizard.goalViralLabel', emoji: '🔥', tipKey: 'onboardingWizard.goalViralTip' },
  { id: 'engagement', labelKey: 'onboardingWizard.goalEngagementLabel', emoji: '💬', tipKey: 'onboardingWizard.goalEngagementTip' },
  { id: 'monetize', labelKey: 'onboardingWizard.goalMonetizeLabel', emoji: '💰', tipKey: 'onboardingWizard.goalMonetizeTip' },
  { id: 'brand_awareness', labelKey: 'onboardingWizard.goalBrandAwarenessLabel', emoji: '📣', tipKey: 'onboardingWizard.goalBrandAwarenessTip' },
]

// ── Main Steps ─────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'import',
    icon: Upload,
    titleKey: 'onboardingWizard.stepImportTitle',
    subtitleKey: 'onboardingWizard.stepImportSubtitle',
    color: 'from-blue-600 to-indigo-600',
    tipKey: 'onboardingWizard.stepImportTip',
    actionKey: 'onboardingWizard.stepImportAction',
    skipKey: 'onboardingWizard.stepImportSkip',
  },
  {
    id: 'hook',
    icon: Sparkles,
    titleKey: 'onboardingWizard.stepHookTitle',
    subtitleKey: 'onboardingWizard.stepHookSubtitle',
    color: 'from-indigo-600 to-purple-600',
    tipKey: 'onboardingWizard.stepHookTip',
    actionKey: 'onboardingWizard.stepHookAction',
    skipKey: 'onboardingWizard.stepHookSkip',
  },
  {
    id: 'export',
    icon: Download,
    titleKey: 'onboardingWizard.stepExportTitle',
    subtitleKey: 'onboardingWizard.stepExportSubtitle',
    color: 'from-purple-600 to-pink-600',
    tipKey: 'onboardingWizard.stepExportTip',
    actionKey: 'onboardingWizard.stepExportAction',
    skipKey: 'onboardingWizard.stepExportSkip',
  },
]

export const CLICK_NICHE_KEY = 'click_creator_profile'

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useTranslation()
  // -2 = niche quiz, -1 = welcome, 0+ = main steps
  const [currentStep, setCurrentStep] = useState(-2)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [showConfetti, setShowConfetti] = useState(false)

  // Quiz state
  const [nicheType, setNicheType] = useState<string | null>(null)
  const [platformTarget, setPlatformTarget] = useState<string | null>(null)
  const [creatorGoal, setCreatorGoal] = useState<string | null>(null)
  const [quizStep, setQuizStep] = useState(0)

  const saveNicheProfile = useCallback(() => {
    const profile = { nicheType, platformTarget, creatorGoal, configuredAt: Date.now() }
    try {
      localStorage.setItem(CLICK_NICHE_KEY, JSON.stringify(profile))
      if (creatorGoal === 'viral') {
        localStorage.setItem('click_default_hook_style', 'controversial-question')
        localStorage.setItem('click_auto_apply_trending', 'true')
      } else if (creatorGoal === 'engagement') {
        localStorage.setItem('click_default_hook_style', 'open-loop')
        localStorage.setItem('click_auto_add_cta', 'true')
      } else if (creatorGoal === 'monetize') {
        localStorage.setItem('click_default_hook_style', 'value-stat')
        localStorage.setItem('click_show_rpm_insights', 'true')
      }
    } catch {}
  }, [nicheType, platformTarget, creatorGoal])

  const advanceQuiz = useCallback(() => {
    if (quizStep < 2) {
      setQuizStep(q => q + 1)
    } else {
      saveNicheProfile()
      setCurrentStep(-1)
    }
  }, [quizStep, saveNicheProfile])

  const advanceStep = useCallback(() => {
    if (currentStep === -1) { setCurrentStep(0); return }
    const step = STEPS[currentStep]
    if (step) setCompleted(prev => new Set(Array.from(prev).concat(step.id)))
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setShowConfetti(true)
      setTimeout(() => {
        onComplete()
        localStorage.setItem('click_onboarding_done', '1')
      }, 1200)
    }
  }, [currentStep, onComplete])

  const skipStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete()
      localStorage.setItem('click_onboarding_done', '1')
    }
  }, [currentStep, onComplete])

  const step = currentStep >= 0 ? STEPS[currentStep] : null
  const progress = currentStep < 0 ? 0 : ((currentStep + 1) / STEPS.length) * 100
  const selectedGoal = CREATOR_GOALS.find(g => g.id === creatorGoal)
  const quizCanAdvance = (quizStep === 0 && !!nicheType) || (quizStep === 1 && !!platformTarget) || (quizStep === 2 && !!creatorGoal)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="relative w-full max-w-lg mx-4"
      >
        <button type="button" onClick={onComplete} title={t('onboardingWizard.closeOnboarding')}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-gradient-to-b from-slate-900 to-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/60">
          <div className="h-0.5 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <AnimatePresence mode="wait">

            {/* ── NICHE QUIZ ─────────────────────────────── */}
            {currentStep === -2 && (
              <motion.div key={`quiz-${quizStep}`}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="p-8"
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400">{t('onboardingWizard.aiCalibration')}</div>
                    <div className="text-[10px] text-slate-500">{t('onboardingWizard.stepOfThree', { step: quizStep + 1 })}</div>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= quizStep ? 'bg-indigo-500' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>

                {quizStep === 0 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">{t('onboardingWizard.quizNicheHeading')}</h3>
                    <p className="text-slate-500 text-xs mb-5">{t('onboardingWizard.quizNicheSubtitle')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {NICHE_TYPES.map(n => (
                        <button type="button" key={n.id} onClick={() => setNicheType(n.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${nicheType === n.id ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <div className="text-2xl mb-1">{n.emoji}</div>
                          <div className="text-xs font-black text-white">{t(n.labelKey)}</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">{t(n.descKey)}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {quizStep === 1 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">{t('onboardingWizard.quizPlatformHeading')}</h3>
                    <p className="text-slate-500 text-xs mb-5">{t('onboardingWizard.quizPlatformSubtitle')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATFORM_TARGETS.map(p => (
                        <button type="button" key={p.id} onClick={() => setPlatformTarget(p.id)}
                          className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${platformTarget === p.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <span className="text-xl">{p.emoji}</span>
                          <span className="text-xs font-black text-white">{t(p.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {quizStep === 2 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">{t('onboardingWizard.quizGoalHeading')}</h3>
                    <p className="text-slate-500 text-xs mb-5">{t('onboardingWizard.quizGoalSubtitle')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CREATOR_GOALS.map(g => (
                        <button type="button" key={g.id} onClick={() => setCreatorGoal(g.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${creatorGoal === g.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <div className="text-2xl mb-1">{g.emoji}</div>
                          <div className="text-xs font-black text-white">{t(g.labelKey)}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">{t(g.tipKey)}</div>
                        </button>
                      ))}
                    </div>
                    {selectedGoal && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20"
                      >
                        <p className="text-[10px] text-indigo-300">
                          <span className="font-black">{t('onboardingWizard.aiModePrefix')}</span>{t(selectedGoal.tipKey)}
                        </p>
                      </motion.div>
                    )}
                  </>
                )}

                <button type="button" onClick={advanceQuiz} disabled={!quizCanAdvance}
                  className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                >
                  {quizStep < 2 ? t('onboardingWizard.continue') : t('onboardingWizard.configureMyAi')} <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── WELCOME ────────────────────────────────── */}
            {currentStep === -1 && (
              <motion.div key="welcome"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 mb-4">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      {t('onboardingWizard.aiConfiguredFor', { target: (() => { const n = NICHE_TYPES.find(n => n.id === nicheType); return n ? t(n.labelKey) : t('onboardingWizard.fallbackYou') })() })}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">{t('onboardingWizard.aiStackReady')}</h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {t('onboardingWizard.everyEditScoredFor')}{' '}
                    <span className="text-indigo-400 font-bold">{(() => { const g = CREATOR_GOALS.find(g => g.id === creatorGoal); return g ? t(g.labelKey) : t('onboardingWizard.fallbackYourGoal') })()}</span>.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { icon: Target, labelKey: 'onboardingWizard.featureGoalTunedLabel', descKey: 'onboardingWizard.featureGoalTunedDesc', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { icon: Rocket, labelKey: 'onboardingWizard.featurePlatformLabel', descKey: 'onboardingWizard.featurePlatformDesc', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { icon: Brain, labelKey: 'onboardingWizard.featureNeuralLabel', descKey: 'onboardingWizard.featureNeuralDesc', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  ].map(f => (
                    <div key={f.labelKey} className={`p-3 rounded-2xl ${f.bg} border border-white/5 text-center`}>
                      <f.icon className={`w-5 h-5 ${f.color} mx-auto mb-1`} />
                      <div className="text-[9px] font-black text-white">{t(f.labelKey)}</div>
                      <div className="text-[8px] text-slate-500">{t(f.descKey)}</div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={advanceStep}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  {t('onboardingWizard.startCreating')} <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[9px] text-slate-600 mt-3">{t('onboardingWizard.takesNinetySeconds')}</p>
              </motion.div>
            )}

            {/* ── STEP SCREENS ───────────────────────────── */}
            {currentStep >= 0 && step && !showConfetti && (
              <motion.div key={`step-${currentStep}`}
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                className="p-8"
              >
                <div className="flex items-center gap-2 mb-6">
                  {STEPS.map((s, i) => (
                    <React.Fragment key={s.id}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                        completed.has(s.id) ? 'bg-emerald-500 text-white' :
                        i === currentStep   ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/40' :
                                              'bg-white/5 text-slate-600 border border-white/10'
                      }`}>
                        {completed.has(s.id) ? <Check className="w-3 h-3" /> : i + 1}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 rounded-full transition-all ${completed.has(s.id) ? 'bg-emerald-500/60' : 'bg-white/5'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-black tracking-tight mb-2">{t(step.titleKey)}</h3>
                <p className="text-slate-400 text-sm mb-4">{t(step.subtitleKey)}</p>

                <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-6">
                  <p className="text-[10px] text-indigo-300 leading-relaxed">
                    <span className="font-black">{t('onboardingWizard.proTipPrefix')}</span>{t(step.tipKey)}
                  </p>
                </div>

                <button type="button" onClick={advanceStep}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-r ${step.color} text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg mb-3`}
                >
                  {t(step.actionKey)} <ChevronRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={skipStep}
                  className="w-full py-2 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all"
                >
                  {t(step.skipKey)}
                </button>
              </motion.div>
            )}

            {/* ── COMPLETION ─────────────────────────────── */}
            {showConfetti && (
              <motion.div key="done"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="p-8 text-center"
              >
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-2xl font-black mb-2">{t('onboardingWizard.allSet')}</h3>
                <p className="text-slate-400 text-sm">
                  {t('onboardingWizard.clickTunedFor')}{' '}
                  <span className="text-indigo-400 font-bold">{(() => { const g = CREATOR_GOALS.find(g => g.id === creatorGoal); return g ? t(g.labelKey) : t('onboardingWizard.fallbackSuccess') })()}</span>.
                  {' '}{t('onboardingWizard.makeFirstVideoViral')}
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

/** Hook to manage onboarding display state */
export function useOnboarding() {
  const [show, setShow] = React.useState(false)

  React.useEffect(() => {
    const done = localStorage.getItem('click_onboarding_done')
    if (!done) {
      const t = setTimeout(() => setShow(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const dismiss = useCallback(() => {
    setShow(false)
    localStorage.setItem('click_onboarding_done', '1')
  }, [])

  return { showOnboarding: show, dismissOnboarding: dismiss }
}

/** Hook to read the saved creator niche profile anywhere in the app */
export function useCreatorProfile() {
  const [profile, setProfile] = React.useState<{ nicheType: string; platformTarget: string; creatorGoal: string } | null>(null)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CLICK_NICHE_KEY)
      if (raw) setProfile(JSON.parse(raw))
    } catch {}
  }, [])

  return profile
}
