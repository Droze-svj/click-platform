'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Rocket,
  Users,
  Layout,
  Video,
  MousePointer2
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

const glassStyle = "backdrop-blur-2xl bg-black/40 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 500 : -500,
    opacity: 0,
    scale: 0.95
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: 'spring' as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 500 : -500,
    opacity: 0,
    scale: 0.95,
    transition: {
      x: { type: 'spring' as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 }
    }
  })
}

export default function OnboardingFlow() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [[step, direction], setStep] = useState([0, 0])
  const { showToast } = useToast()

  const isPublicPage = pathname === '/login' || pathname === '/register' || pathname === '/' || !pathname

  useEffect(() => {
    if (!isPublicPage) {
      // Show onboarding if not completed (simulation for now)
      const isCompleted = localStorage.getItem('onboarding_completed')
      if (!isCompleted) {
        setIsVisible(true)
      }
    }
  }, [isPublicPage])

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to the click Ecosystem',
      description: 'Your autonomous partner for high-performance content operations.',
      component: <WelcomeStep />
    },
    {
      id: 'profile',
      title: 'Define Your Strategy',
      description: 'Tailor the Click AI to your specific industry benchmarks.',
      component: <ProfileStep onComplete={() => nextStep()} />
    },
    {
      id: 'features',
      title: 'Elite Features',
      description: 'Unlock multi-platform intelligence and predictive growth.',
      component: <ExploreFeaturesStep />
    },
    {
      id: 'complete',
      title: 'Ecosystem Primed',
      description: 'You are now ready to dominate the social landscape.',
      component: <CompleteStep onComplete={() => finishOnboarding()} />
    }
  ]

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      paginate(1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      paginate(-1)
    }
  }

  const paginate = (newDirection: number) => {
    setStep([currentStep + newDirection, newDirection])
    setCurrentStep(currentStep + newDirection)
  }

  const finishOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true')
    setIsVisible(false)
    showToast('Elite Access Granted', 'success')
  }

  if (isPublicPage || !isVisible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={`relative w-full max-w-2xl rounded-[3rem] overflow-hidden ${glassStyle}`}
      >
        {/* Animated Background Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-purple-600/10 pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-8 md:p-10 border-b border-white/5">
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter">
              {steps[currentStep].title}
            </h2>
            <p className="text-slate-400 text-sm font-medium">
              {steps[currentStep].description}
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-slate-500 hover:text-white"
            title="Close onboarding"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 md:p-12 min-h-[400px] flex flex-col justify-center relative">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full"
            >
              {steps[currentStep].component}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer / Navigation */}
        <div className="p-8 md:p-10 bg-white/5 flex items-center justify-between gap-6 border-t border-white/5">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${i === currentStep ? 'w-8 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'w-2 bg-white/10'
                  }`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-6 py-3 rounded-2xl border border-white/10 text-slate-400 font-bold text-sm hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={() => currentStep === steps.length - 1 ? finishOnboarding() : nextStep()}
              className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/20 hover:scale-105 transition-all flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? 'Start Dominating' : 'Next Intelligence'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="text-center space-y-8 py-4">
      <div className="relative inline-block">
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-dashed border-indigo-500/30 flex items-center justify-center"
        >
          <Rocket className="w-16 h-16 md:w-20 md:h-20 text-indigo-400" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-2 -right-2 p-3 rounded-2xl bg-indigo-600 shadow-xl"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </motion.div>
      </div>
      <div className="space-y-4">
        <h3 className="text-4xl font-black text-white tracking-tighter">Click Genesis</h3>
        <p className="text-slate-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
          The only platform that doesn&apos;t just write—it <span className="text-white">operates</span>. Let&apos;s sync your brand with our autonomous engine.
        </p>
      </div>
    </div>
  )
}

function ProfileStep({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState('')
  const niches = [
    { id: 'tech', name: 'Technology', icon: <Zap className="w-5 h-5 text-indigo-400" /> },
    { id: 'finance', name: 'Finance', icon: <ShieldCheck className="w-5 h-5 text-emerald-400" /> },
    { id: 'media', name: 'Media/Ent', icon: <Video className="w-5 h-5 text-rose-400" /> },
    { id: 'creators', name: 'Creators', icon: <Users className="w-5 h-5 text-blue-400" /> }
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        {niches.map(n => (
          <button
            key={n.id}
            onClick={() => setSelected(n.id)}
            className={`p-6 rounded-3xl border-2 text-left transition-all group ${selected === n.id
                ? 'bg-indigo-600/10 border-indigo-600 scale-[1.02] shadow-lg shadow-indigo-600/10'
                : 'bg-white/5 border-white/5 hover:bg-white/10'
              }`}
          >
            <div className={`p-3 rounded-2xl w-fit mb-4 transition-colors ${selected === n.id ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>
              {n.icon}
            </div>
            <div className={`font-bold transition-colors ${selected === n.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
              {n.name}
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-slate-500 text-sm font-medium">Click AI will calibrate its predictive models based on this selection.</p>
    </div>
  )
}

function ExploreFeaturesStep() {
  const highlights = [
    { title: 'Predictive ROI', desc: 'Real-time revenue attribution per post.', icon: <TrendingUp className="w-4 h-4" /> },
    { title: 'Self-Healing Loop', desc: 'Auto-adjusts content if engagement dips.', icon: <RefreshCw className="w-4 h-4" /> },
    { title: 'Multi-Core Publish', desc: 'One click, 6 platforms optimized.', icon: <Orbit className="w-4 h-4" /> }
  ]

  return (
    <div className="space-y-6">
      {highlights.map((h, i) => (
        <div key={i} className="p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center gap-6 group hover:bg-white/10 transition-all">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            {h.icon}
          </div>
          <div>
            <div className="font-bold text-white text-lg">{h.title}</div>
            <div className="text-slate-500 text-sm font-medium">{h.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompleteStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="text-center space-y-10 py-4">
      <div className="relative">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-32 h-32 md:w-40 md:h-40 bg-indigo-600 rounded-full mx-auto flex items-center justify-center"
        >
          <Rocket className="w-16 h-16 md:w-20 md:h-20 text-white" />
        </motion.div>
        <div className="absolute inset-0 bg-indigo-600/30 blur-3xl -z-10" />
      </div>
      <div className="space-y-4">
        <h3 className="text-4xl font-black text-white tracking-tighter">System Initialized</h3>
        <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-sm mx-auto">
          Welcome to the new standard of <span className="text-white">Content Operations</span>. The ecosystem is live.
        </p>
      </div>
    </div>
  )
}

// Minimal icons for completeness
const TrendingUp = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
const RefreshCw = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
const Orbit = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="3"></circle><path d="M3 16c0 2.209 4.03 4 9 4s9-1.791 9-4"></path><path d="M3 8c0-2.209 4.03-4 9-4s9 1.791 9 4"></path></svg>







