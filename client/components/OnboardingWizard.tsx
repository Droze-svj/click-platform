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

interface OnboardingWizardProps {
  onComplete: () => void
}

// ── Niche Quiz Data ────────────────────────────────────────────────────────────
const NICHE_TYPES = [
  { id: 'creator', label: 'Content Creator', emoji: '🎬', desc: 'YouTube, TikTok, Reels' },
  { id: 'brand', label: 'Brand / Business', emoji: '🏢', desc: 'Marketing & Growth' },
  { id: 'educator', label: 'Educator', emoji: '🎓', desc: 'Courses & Tutorials' },
  { id: 'agency', label: 'Agency', emoji: '🚀', desc: 'Client work & campaigns' },
]

const PLATFORM_TARGETS = [
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'instagram', label: 'Instagram Reels', emoji: '📸' },
  { id: 'youtube', label: 'YouTube Shorts', emoji: '▶️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
]

const CREATOR_GOALS = [
  { id: 'viral', label: 'Go Viral', emoji: '🔥', tip: 'AI optimizes for hook strength and trend alignment' },
  { id: 'engagement', label: 'Boost Engagement', emoji: '💬', tip: 'AI maximizes comment triggers and CTAs' },
  { id: 'monetize', label: 'Monetize', emoji: '💰', tip: 'AI targets high-RPM topics and sponsorship angles' },
  { id: 'brand_awareness', label: 'Brand Awareness', emoji: '📣', tip: 'AI ensures consistent brand voice and recall' },
]

// ── Main Steps ─────────────────────────────────────────────────────────────────
const STEPS = [
  {
    id: 'import',
    icon: Upload,
    title: 'Import your first video',
    subtitle: 'Drag & drop or browse — any format works',
    color: 'from-blue-600 to-indigo-600',
    tip: 'Pro tip: TikTok downloads, screen recordings, and phone footage all work perfectly.',
    action: 'Import Video',
    skip: "I'll do this later",
  },
  {
    id: 'hook',
    icon: Sparkles,
    title: 'Add a viral hook',
    subtitle: 'CLICK auto-generates hooks trained on 100M+ viral videos',
    color: 'from-indigo-600 to-purple-600',
    tip: 'The first 3 seconds determine 80% of your watch time. Let AI craft the perfect opener.',
    action: 'Generate Hook',
    skip: 'Skip for now',
  },
  {
    id: 'export',
    icon: Download,
    title: 'Export for your platform',
    subtitle: 'One-click platform optimization — TikTok, Reels, Shorts',
    color: 'from-purple-600 to-pink-600',
    tip: 'CLICK automatically formats, compresses, and captions your video for maximum reach.',
    action: 'Export & Publish',
    skip: 'Explore first',
  },
]

export const CLICK_NICHE_KEY = 'click_creator_profile'

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
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
        <button onClick={onComplete} title="Close onboarding"
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
                    <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400">AI Calibration</div>
                    <div className="text-[10px] text-slate-500">Step {quizStep + 1} of 3</div>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= quizStep ? 'bg-indigo-500' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>

                {quizStep === 0 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">Who are you creating for?</h3>
                    <p className="text-slate-500 text-xs mb-5">Click will tailor its AI to your exact context.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {NICHE_TYPES.map(n => (
                        <button key={n.id} onClick={() => setNicheType(n.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${nicheType === n.id ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <div className="text-2xl mb-1">{n.emoji}</div>
                          <div className="text-xs font-black text-white">{n.label}</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">{n.desc}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {quizStep === 1 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">Primary platform?</h3>
                    <p className="text-slate-500 text-xs mb-5">Optimizes export settings, aspect ratio &amp; captions.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATFORM_TARGETS.map(p => (
                        <button key={p.id} onClick={() => setPlatformTarget(p.id)}
                          className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${platformTarget === p.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <span className="text-xl">{p.emoji}</span>
                          <span className="text-xs font-black text-white">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {quizStep === 2 && (
                  <>
                    <h3 className="text-xl font-black tracking-tight mb-1">What&apos;s your main goal?</h3>
                    <p className="text-slate-500 text-xs mb-5">AI will score and optimize every edit toward this.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CREATOR_GOALS.map(g => (
                        <button key={g.id} onClick={() => setCreatorGoal(g.id)}
                          className={`p-4 rounded-2xl border text-left transition-all ${creatorGoal === g.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}
                        >
                          <div className="text-2xl mb-1">{g.emoji}</div>
                          <div className="text-xs font-black text-white">{g.label}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">{g.tip}</div>
                        </button>
                      ))}
                    </div>
                    {selectedGoal && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20"
                      >
                        <p className="text-[10px] text-indigo-300">
                          <span className="font-black">✦ AI Mode: </span>{selectedGoal.tip}
                        </p>
                      </motion.div>
                    )}
                  </>
                )}

                <button onClick={advanceQuiz} disabled={!quizCanAdvance}
                  className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                >
                  {quizStep < 2 ? 'Continue' : 'Configure My AI'} <ArrowRight className="w-4 h-4" />
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
                      AI Configured for {NICHE_TYPES.find(n => n.id === nicheType)?.label || 'You'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Your AI stack is ready</h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Every edit is now scored specifically for{' '}
                    <span className="text-indigo-400 font-bold">{CREATOR_GOALS.find(g => g.id === creatorGoal)?.label || 'your goal'}</span>.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { icon: Target, label: 'Goal-Tuned', desc: 'Scoring', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { icon: Rocket, label: 'Platform', desc: 'Optimized', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { icon: Brain, label: 'Neural', desc: 'Calibrated', color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  ].map(f => (
                    <div key={f.label} className={`p-3 rounded-2xl ${f.bg} border border-white/5 text-center`}>
                      <f.icon className={`w-5 h-5 ${f.color} mx-auto mb-1`} />
                      <div className="text-[9px] font-black text-white">{f.label}</div>
                      <div className="text-[8px] text-slate-500">{f.desc}</div>
                    </div>
                  ))}
                </div>

                <button onClick={advanceStep}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  Start Creating <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[9px] text-slate-600 mt-3">Takes about 90 seconds · No credit card required</p>
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

                <h3 className="text-xl font-black tracking-tight mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm mb-4">{step.subtitle}</p>

                <div className="p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 mb-6">
                  <p className="text-[10px] text-indigo-300 leading-relaxed">
                    <span className="font-black">✦ Pro tip: </span>{step.tip}
                  </p>
                </div>

                <button onClick={advanceStep}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-r ${step.color} text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg mb-3`}
                >
                  {step.action} <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={skipStep}
                  className="w-full py-2 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-all"
                >
                  {step.skip}
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
                <h3 className="text-2xl font-black mb-2">You&apos;re all set!</h3>
                <p className="text-slate-400 text-sm">
                  CLICK is tuned for{' '}
                  <span className="text-indigo-400 font-bold">{CREATOR_GOALS.find(g => g.id === creatorGoal)?.label || 'success'}</span>.
                  Make your first video go viral.
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
