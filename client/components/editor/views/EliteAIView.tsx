'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import {
  Zap,
  Loader2,
  Sparkles,
  TrendingUp,
  Copy,
  Brain,
  Flame,
  AlertCircle,
  Type,
  Radio,
  Fingerprint,
  Target,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Globe,
  Crown
} from 'lucide-react'
import { Lock } from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { getDefaultTrackForSegmentType, Asset, StyleProfile } from '../../../types/editor'
import DirectorLog from '../DirectorLog'
import StyleMimicView from './StyleMimicView'
import VariantFactoryView from './VariantFactoryView'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { Panel, Button, Badge, SectionHeader, EmptyState, UpgradeModal, LockedBadge } from '../../ui'
import { cn } from '../../../lib/utils'
import { useEntitlements } from '../../../hooks/useEntitlements'

// Pro-tier flagship AI tools, gated honestly via the canonical `ai_agent`
// entitlement (server/config/entitlements.js — "Autonomous AI agent", Pro).
const AI_AGENT_FEATURE = 'ai_agent'

const INACTIVE_PILL =
  'border-border bg-background/40 text-theme-secondary hover:text-theme-primary'

const PERSONA_COLORS: Record<'beast' | 'minimalist' | 'architect' | 'educator', { active: string; inactive: string; activeIconBg: string; inactiveIconBg: string }> = {
  beast: {
    active: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
    inactive: INACTIVE_PILL,
    activeIconBg: 'bg-orange-500/20',
    inactiveIconBg: 'bg-accent',
  },
  minimalist: {
    active: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    inactive: INACTIVE_PILL,
    activeIconBg: 'bg-slate-500/20',
    inactiveIconBg: 'bg-accent',
  },
  architect: {
    active: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500',
    inactive: INACTIVE_PILL,
    activeIconBg: 'bg-indigo-500/20',
    inactiveIconBg: 'bg-accent',
  },
  educator: {
    active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    inactive: INACTIVE_PILL,
    activeIconBg: 'bg-emerald-500/20',
    inactiveIconBg: 'bg-accent',
  },
}

interface EliteAIViewProps {
  videoId: string
  isTranscribing: boolean
  setIsTranscribing: (v: boolean) => void
  transcript: any
  setTranscript: (v: any) => void
  editingWords: any[]
  setEditingWords: (v: any[]) => void
  aiSuggestions: any[]
  setTimelineSegments: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (c: any) => void
  setTextOverlays?: (fn: (prev: any[]) => any[]) => void
  autoEditClips?: any[]
  onGenerateClips?: () => void
  onApplyClip?: (clip: any) => void
  engagementScore?: any
  userAssets?: Asset[]
  onForgeMaster?: (persona: string) => void
  onApplyStyleProfile?: (profile: StyleProfile) => void
  onBeatSync?: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

const EliteAIView: React.FC<EliteAIViewProps> = ({
  videoId, isTranscribing, setIsTranscribing, transcript, setTranscript, editingWords, setEditingWords, aiSuggestions, setTimelineSegments, showToast, setActiveCategory, setTextOverlays, autoEditClips = [], onGenerateClips, onApplyClip, engagementScore, userAssets = [], onForgeMaster, onApplyStyleProfile, onBeatSync
}) => {
  const [view, setView] = useState<'main' | 'mimic' | 'variant-factory'>('main')
  const [viralQuotes, setViralQuotes] = useState<any[]>([])
  const [isExtractingQuotes, setIsExtractingQuotes] = useState(false)
  const [isForging, setIsForging] = useState(false)
  const [requirementsReady, setRequirementsReady] = useState<boolean | null>(null)
  const [requirementsMessage, setRequirementsMessage] = useState<string>('')
  const [activeThought, setActiveThought] = useState('')
  const [activePersona, setActivePersona] = useState<'beast' | 'minimalist' | 'architect' | 'educator'>('beast')
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [spokenLanguage, setSpokenLanguage] = useState('auto')

  // Entitlements — honest gate for Pro-only autonomous AI tools + the REAL AI
  // intelligence level this tier runs (no fake "engine" choice).
  const { hasFeature, tier, aiProfile } = useEntitlements()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  // When true, the upgrade modal pitches the Agency AI edge (deeper reasoning +
  // more live web); otherwise it's the Pro `ai_agent` gate.
  const [upgradeEdge, setUpgradeEdge] = useState(false)
  const aiAgentUnlocked = hasFeature(AI_AGENT_FEATURE)
  const isAgency = tier === 'agency'

  const openProGate = () => { setUpgradeEdge(false); setUpgradeOpen(true) }
  const openAgencyEdge = () => { setUpgradeEdge(true); setUpgradeOpen(true) }

  const languages = [
    { code: 'auto', name: 'Auto-Detect Spoken Language' },
    { code: 'en', name: 'English (US/UK)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'it', name: 'Italian (Italiano)' },
    { code: 'ja', name: 'Japanese (日本語)' },
    { code: 'pt', name: 'Portuguese (Português)' },
    { code: 'ar', name: 'Arabic (العربية)' },
    { code: 'zh', name: 'Chinese (中文)' },
    { code: 'ru', name: 'Russian (Русский)' },
    { code: 'ko', name: 'Korean (한국어)' },
    { code: 'hi', name: 'Hindi (हिन्दी)' },
    { code: 'tr', name: 'Turkish (Türkçe)' },
    { code: 'th', name: 'Thai (ไทย)' },
    { code: 'vi', name: 'Vietnamese (Tiếng Việt)' }
  ]

  // Honest summary of the AI intelligence level this tier actually runs — built
  // from the real aiProfile (effort/output/live-web depth), never a fake engine.
  const aiLevelBits = [
    aiProfile.deepReasoning ? 'deep reasoning' : 'standard reasoning',
    aiProfile.liveWeb ? `live web (${aiProfile.maxWebSearches} sources)` : 'no live web',
  ]

  const personas = [
    { id: 'beast', name: 'The Beast', desc: 'High-Retention / MrBeast Style', icon: Flame, color: 'orange' },
    { id: 'minimalist', name: 'The Minimalist', desc: 'Clean / Apple Style', icon: ShieldCheck, color: 'slate' },
    { id: 'architect', name: 'The Architect', desc: 'Viral Hooks / Fast Paced', icon: Target, color: 'indigo' },
    { id: 'educator', name: 'The Educator', desc: 'Structured / Clarity First', icon: Sparkles, color: 'emerald' },
  ] as const

  const aiThoughts = useMemo(() => [
    "Analyzing pacing and engagement…",
    "Tuning viral hook detection…",
    "Extracting high-impact moments…",
    "Processing transcript layers…",
    "Optimizing for retention…",
    "Identifying top engagement segments…",
    "Syncing with trending signals…"
  ], [])

  useEffect(() => {
    const thoughtInterval = setInterval(() => {
      setActiveThought(aiThoughts[Math.floor(Math.random() * aiThoughts.length)])
    }, 6000)
    setActiveThought(aiThoughts[0])

    return () => {
      clearInterval(thoughtInterval)
    }
  }, [aiThoughts])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await apiGet<{ success?: boolean; data?: { openaiConfigured?: boolean; message?: string } }>('/video/transcribe-editor/status')
        const data = (res as any)?.data ?? (res as any)
        if (cancelled) return
        setRequirementsReady(!!data?.openaiConfigured)
        setRequirementsMessage(typeof data?.message === 'string' ? data.message : '')
      } catch {
        if (cancelled) return
        setRequirementsReady(false)
        setRequirementsMessage('AI engine verification failed. Check your configuration.')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleForge = async () => {
    if (!aiAgentUnlocked) {
      openProGate()
      return
    }
    if (!onForgeMaster) return
    setIsForging(true)
    try {
      await onForgeMaster(activePersona)
    } finally {
      setIsForging(false)
    }
  }


  const handleExtractQuotes = async () => {
    if (!transcript) {
      showToast('Transcribe the video first', 'error')
      return
    }

    setSwarmHUDTask('Extracting key quotes')
    setShowSwarmHUD(true)
    setPendingAction(() => executeExtractQuotes)
  }

  const executeExtractQuotes = async () => {
    try {
      setIsExtractingQuotes(true)
      showToast(`Extracting quotes with ${aiProfile.label}…`, 'info')
      const fullText = editingWords.map(w => w.word).join(' ')
      const data = await apiPost<{ success?: boolean; quotes?: any[] }>('/ai/extract-quotes', {
        transcript: fullText,
        persona: activePersona
      })
      if (data?.success && data.quotes) {
        setViralQuotes(data.quotes)
        showToast(`✓ Extracted ${data.quotes.length} key quotes`, 'success')
      }
    } catch (e) {
      showToast('Quote extraction failed', 'error')
    } finally {
      setIsExtractingQuotes(false)
    }
  }

  const applySemanticCaptions = () => {
    if (!transcript?.words || !setTextOverlays) return

    showToast('Generating styled captions…', 'info')

    const emotionTriggers = {
      urgency: ['secret', 'massive', 'crazy', 'insane', 'never', 'finally', 'stop', 'look', 'viral', 'now', 'quickly', 'deadly', 'warning', 'destroy', 'dangerous', 'shocking', 'panic'],
      curiosity: ['why', 'how', 'hidden', 'unknown', 'mysterious', 'imagine', 'discover', 'unbelievable', 'underground', 'revealed', 'key', 'method', 'formula'],
      authority: ['verified', 'guaranteed', 'proof', 'expert', 'result', 'master', 'alpha', 'perfect', 'million', 'billion', 'rich', 'success', 'winning', 'growth'],
      hype: ['epic', 'insane', 'amazing', 'wild', 'boom', 'legendary', 'unreal', 'godly', 'crushing', 'absolute', 'omega']
    }

    const words = transcript.words
    const phrases: { words: any[]; start: number; end: number }[] = []
    let currentPhrase: any[] = []
    
    for (let idx = 0; idx < words.length; idx++) {
      const w = words[idx]
      currentPhrase.push(w)
      
      const hasPause = idx < words.length - 1 && (words[idx+1].start - w.end > 0.4)
      const endsWithPunctuation = /[.?!]$/.test((w.text || w.word || '').trim())
      
      if (currentPhrase.length >= 3 || hasPause || endsWithPunctuation || idx === words.length - 1) {
         phrases.push({
           words: currentPhrase,
           start: currentPhrase[0].start,
           end: w.end
         })
         currentPhrase = []
      }
    }

    // Color swatches for alternating dynamic highlight paths
    const beastColors = ['#fbbf24', '#34d399', '#f87171', '#ffffff'] // Yellow, Green, Red, White
    const architectColors = ['#f472b6', '#22d3ee', '#fbbf24', '#ffffff'] // Fuchsia, Cyan, Amber, White
    const educatorColors = ['#60a5fa', '#34d399', '#ffffff'] // Blue, Green, White

    const semanticOverlays = phrases.map((phrase, i) => {
      const phraseText = phrase.words.map(w => w.text || w.word || '').join(' ')
      const cleanedWords = phrase.words.map(w => (w.text || w.word || '').trim().toLowerCase().replace(/[^\w]/g, ''))
      
      // Check emotional context triggers
      let category: 'urgency' | 'curiosity' | 'authority' | 'hype' | 'neutral' = 'neutral'
      if (cleanedWords.some(w => emotionTriggers.urgency.includes(w))) category = 'urgency'
      else if (cleanedWords.some(w => emotionTriggers.curiosity.includes(w))) category = 'curiosity'
      else if (cleanedWords.some(w => emotionTriggers.authority.includes(w))) category = 'authority'
      else if (cleanedWords.some(w => emotionTriggers.hype.includes(w))) category = 'hype'

      // Base default layout configurations
      let config = {
        fontSize: 32,
        color: '#ffffff',
        fontFamily: 'Inter',
        style: 'shadow' as any,
        shadowColor: 'rgba(0,0,0,0.8)',
        outlineColor: undefined as string | undefined,
        animationIn: 'pop' as any,
        animationOut: 'fade' as any,
        x: 30, // Centered range 30-70% (width 40%)
        y: 75,
        width: 40,
        text: phraseText
      }

      // Persona customization
      if (activePersona === 'beast') {
        // High impact, kinetic center focus
        const beastColor = beastColors[i % beastColors.length]
        config.fontSize = category !== 'neutral' ? 54 : 42
        config.color = category === 'urgency' ? '#f87171' : category === 'authority' ? '#34d399' : beastColor
        config.style = 'shadow'
        config.shadowColor = 'rgba(0,0,0,0.95)'
        config.x = 25
        config.width = 50
        config.y = 45 // Center eye contact focus
        config.text = phraseText.toUpperCase()
        config.fontFamily = 'Arial, Helvetica, sans-serif'
        config.animationIn = 'pop'
      } else if (activePersona === 'minimalist') {
        // Clean lower third, elegant styling
        config.fontSize = 24
        config.color = category === 'urgency' ? '#cbd5e1' : '#ffffff'
        config.style = 'minimal'
        config.x = 20
        config.width = 60
        config.y = 78
        config.text = phraseText.toLowerCase()
        config.fontFamily = 'Inter, sans-serif'
        config.animationIn = 'fade'
      } else if (activePersona === 'architect') {
        // Neon fast-paced hooks
        const archColor = architectColors[i % architectColors.length]
        config.fontSize = category !== 'neutral' ? 44 : 36
        config.color = category === 'hype' ? '#22d3ee' : category === 'urgency' ? '#f472b6' : archColor
        config.style = 'neon'
        config.shadowColor = config.color
        config.x = 20
        config.width = 60
        config.y = 35 // Upper middle quadrant
        config.text = phraseText.toUpperCase()
        config.fontFamily = 'Montserrat, sans-serif'
        config.animationIn = 'blur-in'
      } else if (activePersona === 'educator') {
        // Highly readable outline or structured caps
        const edColor = educatorColors[i % educatorColors.length]
        config.fontSize = 28
        config.color = edColor
        config.style = 'outline'
        config.outlineColor = '#000000'
        config.x = 15
        config.width = 70
        config.y = 72
        config.text = phraseText.replace(/\b\w/g, c => c.toUpperCase()) // Title case
        config.fontFamily = 'Roboto, sans-serif'
        config.animationIn = 'slide-bottom'
      }

      return {
        id: `semantic-cap-${Date.now()}-${i}`,
        text: config.text,
        x: config.x,
        y: config.y,
        width: config.width,
        fontSize: config.fontSize,
        color: config.color,
        fontFamily: config.fontFamily,
        startTime: phrase.start,
        endTime: phrase.end + 0.1, // Soft tail buffer
        style: config.style,
        shadowColor: config.shadowColor,
        outlineColor: config.outlineColor,
        animationIn: config.animationIn,
        animationOut: config.animationOut
      }
    })

    setTextOverlays((prev: any[]) => [...prev, ...semanticOverlays])
    showToast('Dynamic styled captions synthesized successfully.', 'success')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Quote copied to neural clipboard', 'success')
  }

  const wordChunks = useMemo(() => {
    if (!editingWords || editingWords.length === 0) return []
    const chunks = []
    for (let i = 0; i < editingWords.length; i += 15) {
      chunks.push({ words: editingWords.slice(i, i + 15), startIndex: i })
    }
    return chunks
  }, [editingWords])

  const suggestedAssets = useMemo(() => {
    if (!userAssets?.length || !transcript?.words?.length) return []
    const scriptWords = transcript.words.map((w: any) => (w.text || w.word || '').toLowerCase().replace(/[^a-z]/g, '')).filter((w: string) => w.length > 5)
    return userAssets.filter(asset =>
      asset.autoTags?.some(tag => scriptWords.includes((tag || '').toLowerCase()))
    ).slice(0, 4)
  }, [userAssets, transcript])

  const handleInjectAsset = (asset: Asset) => {
    const firstWordMatch = transcript.words.find((w: any) =>
       asset.autoTags?.some(tag => (w.text || w.word || '').toLowerCase().includes((tag || '').toLowerCase()))
    )
    const startTime = firstWordMatch?.start ?? 0
    const duration = asset.type === 'broll' ? 5 : asset.duration || 30

    setTimelineSegments((prev: any[]) => [...prev, {
      id: `neural-inject-${asset.id}-${Date.now()}`,
      startTime,
      endTime: startTime + duration,
      duration,
      type: asset.type === 'music' ? 'audio' : 'video',
      name: `Neural: ${asset.title}`,
      color: asset.type === 'music' ? '#10B981' : '#F59E0B',
      track: asset.type === 'music' ? 3 : 2,
      sourceUrl: asset.url
    }])
    showToast(`Neural Link: ${asset.title} synchronized`, 'success')
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative mx-auto max-w-[1400px] space-y-8 pb-16 ds-bg-mesh-soft"
    >
      {/* ── SUBVIEW: THE MIMIC ── */}
      <AnimatePresence mode="wait">
        {view === 'mimic' && (
          <motion.div
            key="mimic-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[100] overflow-y-auto rounded-2xl border border-border bg-background p-6 ds-elev-3"
          >
            <StyleMimicView
              onBack={() => setView('main')}
              onStyleMirror={(profile) => {
                onApplyStyleProfile?.(profile)
                showToast('Mimic DNA Applied to Timeline', 'success')
                setView('main')
              }}
            />
          </motion.div>
        )}

        {view === 'variant-factory' && (
          <motion.div
            key="factory-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[100] overflow-y-auto rounded-2xl border border-border bg-background p-6 ds-elev-3"
          >
            <VariantFactoryView
              onBack={() => setView('main')}
              onApplyVariant={(variant) => {
                setTextOverlays?.(prev => [
                  ...prev,
                  {
                    id: `hook-variant-${Date.now()}`,
                    text: variant.text,
                    x: 50, y: 15,
                    fontSize: 42,
                    color: '#ffffff',
                    fontFamily: 'Inter',
                    startTime: 0,
                    endTime: 5,
                    style: 'shadow'
                  }
                ])
                showToast(`Applied: ${variant.type} Variant`, 'success')
                setView('main')
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Node */}
      <motion.div variants={itemVariants} className="space-y-6">
        <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-start">
          <div className="space-y-5">
            <SectionHeader as="h1" title="AI Storyteller" description={`${aiProfile.label} · ${aiLevelBits.join(' · ')}`} />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={() => (aiAgentUnlocked ? setView('mimic') : openProGate())}
                leftIcon={aiAgentUnlocked ? <Fingerprint className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              >
                The Mimic
              </Button>
              <Button
                variant="secondary"
                onClick={() => (aiAgentUnlocked ? setView('variant-factory') : openProGate())}
                leftIcon={aiAgentUnlocked ? <Target className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              >
                Variant Factory
              </Button>
              <Button variant="secondary" onClick={onBeatSync} leftIcon={<Radio className="h-4 w-4" aria-hidden />}>
                Beat-Sync
              </Button>

              <div className="mx-1 hidden h-8 w-px bg-border md:block" />

              {/* REAL AI intelligence level for this tier (no fake engine choice).
                  Agency = the elite flagship; lower tiers see their honest level
                  plus a truthful nudge that Agency runs deeper. */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-2',
                    isAgency
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                      : 'border-border bg-background/40 text-theme-secondary'
                  )}
                  title={`Reasoning effort: ${aiProfile.effort}`}
                >
                  {isAgency ? <Crown className="h-4 w-4" aria-hidden /> : <Brain className="h-4 w-4" aria-hidden />}
                  <div className="text-left">
                    <div className="text-xs font-semibold leading-none">{aiProfile.label}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] leading-none opacity-70">
                      {aiProfile.liveWeb && <Globe className="h-2.5 w-2.5" aria-hidden />}
                      {aiLevelBits.join(' · ')}
                    </div>
                  </div>
                </div>

                {!isAgency && (
                  <button
                    type="button"
                    onClick={openAgencyEdge}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] font-medium text-amber-500 transition-colors hover:bg-amber-500/10"
                  >
                    <Crown className="h-3.5 w-3.5" aria-hidden />
                    Agency runs deeper reasoning + more live sources
                  </button>
                )}
              </div>
            </div>

            {/* Persona Switcher */}
            <div className="space-y-3 border-t border-border pt-5">
              <p className="ds-text-label text-theme-muted">Director Persona</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {personas.map(persona => {
                  const Icon = persona.icon
                  const isActive = activePersona === persona.id
                  const colors = PERSONA_COLORS[persona.id]
                  return (
                    <button
                      type="button"
                      key={persona.id}
                      onClick={() => setActivePersona(persona.id)}
                      className={cn('flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors', isActive ? colors.active : colors.inactive)}
                    >
                      <div className={cn('w-fit rounded-lg p-2', isActive ? colors.activeIconBg : colors.inactiveIconBg)}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <div className="ds-text-label">{persona.name}</div>
                        <div className="mt-1 text-xs opacity-60">{persona.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <Panel variant="glass" className="relative min-w-[320px] space-y-3 overflow-hidden">
             <p className="ds-text-caption">Core status: {requirementsReady ? 'Active' : 'Fault detected'}</p>
             <div className="flex items-center gap-3">
                <div className={cn('h-2.5 w-2.5 animate-pulse rounded-full', requirementsReady ? 'bg-emerald-500' : 'bg-rose-500')} />
                <p className="ds-text-label truncate text-theme-primary max-w-[220px]">{activeThought}</p>
             </div>

             {/* Agentic Forge Button */}
             <div className="pt-3">
                <button
                  type="button"
                  onClick={handleForge}
                  disabled={isForging || (aiAgentUnlocked && !onForgeMaster)}
                  className={cn(
                    'relative w-full overflow-hidden rounded-2xl p-6 transition-all active:scale-[0.99] disabled:opacity-60',
                    isForging
                      ? 'cursor-wait bg-primary/50'
                      : 'bg-gradient-to-br from-indigo-600 to-fuchsia-600 ds-hover-lift'
                  )}
                >
                  {!aiAgentUnlocked && !isForging && (
                    <span className="absolute right-3 top-3 z-20">
                      <LockedBadge requiredTier="pro" />
                    </span>
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                     {isForging ? (
                       <Loader2 className="mb-2 h-7 w-7 animate-spin text-white" aria-hidden />
                     ) : aiAgentUnlocked ? (
                       <Zap className="mb-2 h-7 w-7 text-white" aria-hidden />
                     ) : (
                       <Lock className="mb-2 h-7 w-7 text-white" aria-hidden />
                     )}
                     <div className="text-lg font-bold leading-tight text-white">Agentic Forge</div>
                     <div className="mt-1 text-xs text-white/70">{aiAgentUnlocked ? 'One-click generate' : 'Unlock with Pro'}</div>
                  </div>

                  {/* Loading progress indicator while the forge runs */}
                  {isForging && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 5, ease: 'linear' }}
                      className="absolute bottom-0 left-0 h-1 bg-white/40"
                    />
                  )}
                </button>
             </div>

             {/* Director Voice HUD */}
             <div className="pt-3">
                <DirectorLog
                  persona={activePersona}
                  currentTime={0}
                  metrics={{
                    cutsPerMinute: engagementScore?.cutsPerMinute ?? 0,
                    brollRatio: engagementScore?.brollRatio ?? 0,
                    hookStrength: engagementScore?.hookStrength ?? 0
                  }}
                />
             </div>
          </Panel>
        </div>
      </motion.div>

      {/* Suggested Assets Node */}
      {suggestedAssets.length > 0 && (
        <motion.div variants={itemVariants} className="space-y-4">
           <SectionHeader as="h3" title="Suggested Assets" />
           <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {suggestedAssets.map((asset, i) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-background/40 p-5 transition-colors hover:border-primary/30"
                >
                  {asset.thumbnail && (
                    <img src={asset.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-10" />
                  )}
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
                        {asset.type === 'music' ? <Radio className="h-4 w-4" aria-hidden /> : <Layers className="h-4 w-4" aria-hidden />}
                      </div>
                      <Badge variant="secondary">Matched</Badge>
                    </div>
                    <div>
                      <h5 className="ds-text-label truncate text-theme-primary">{asset.title}</h5>
                      <div className="mt-2 flex flex-wrap gap-2">
                         {asset.autoTags?.slice(0, 2).map(t => (
                           <span key={t} className="ds-text-caption">#{t}</span>
                         ))}
                      </div>
                    </div>
                    <Button variant="primary" size="sm" className="w-full" onClick={() => handleInjectAsset(asset)}>
                      Inject Draft Node
                    </Button>
                  </div>
                </motion.div>
              ))}
           </div>
        </motion.div>
      )}

      {/* Initialize / Management Card */}
      <motion.div variants={itemVariants}>
       <Panel variant="glass" className="relative overflow-hidden">
        <div className="relative z-10 space-y-8">
          {requirementsReady === false && (
            <div className="flex gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />
              </div>
              <div className="space-y-1">
                <p className="ds-text-label text-amber-500">Neural readiness fault</p>
                <p className="ds-text-body text-theme-secondary">{requirementsMessage || 'Verify OPENAI_API_KEY in repository configuration.'}</p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={applySemanticCaptions}
            className="group/btn flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-background/40 p-8 transition-colors hover:border-primary/30"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover/btn:bg-primary group-hover/btn:text-primary-foreground">
              <Type className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-1 text-center">
              <p className="ds-text-caption">Node Synthesis</p>
              <p className="ds-text-h3 text-theme-primary">Semantic Captions</p>
            </div>
          </button>

          <div className="space-y-1.5">
            <label className="ds-text-label text-theme-secondary block">
              Spoken Video Language
            </label>
            <div className="relative">
              <select
                value={spokenLanguage}
                title="Select spoken video language"
                onChange={(e) => setSpokenLanguage(e.target.value)}
                className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-input bg-background px-4 pr-10 text-sm text-theme-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-theme-muted">
                ▼
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={async () => {
              if (!videoId) {
                showToast('No video loaded', 'error')
                return
              }
              if (requirementsReady === false) {
                showToast('AI Synthesis Unavailable', 'error')
                return
              }
              setIsTranscribing(true)
              showToast('Extracting neural transcript...', 'info')
              try {
                const res = await apiPost<{ success?: boolean; data?: { text: string; words: Array<{ word: string; start: number; end: number }> } }>(
                  '/video/transcribe-editor',
                  { videoId, language: spokenLanguage }
                )
                const data = (res as any)?.data ?? (res as any)
                const words = data?.words ?? []
                const text = data?.text ?? ''
                if (words.length === 0) {
                  showToast('Neural detection empty', 'info')
                  setTranscript(null)
                  setEditingWords([])
                  return
                }
                setTranscript({ text, words })
                setEditingWords(words)
                showToast(`Synthesis Complete: ${words.length} nodes indexed`, 'success')
              } catch (e: any) {
                console.error('Transcribe error', e)
                showToast('Synthesis interrupted', 'error')
              } finally {
                setIsTranscribing(false)
              }
            }}
            disabled={isTranscribing || requirementsReady === false}
            className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 py-6 text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:grayscale"
          >
            {isTranscribing ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Fingerprint className="h-6 w-6" aria-hidden />}
            {isTranscribing ? 'Transcribing…' : requirementsReady === false ? 'Core Offline' : 'Initialize Semantic Extraction'}
          </motion.button>

          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-border bg-background/40 p-6 transition-colors hover:border-primary/20 xl:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-500">
                <Zap className="h-7 w-7" aria-hidden />
              </div>
              <div className="space-y-1 text-center xl:text-left">
                <h4 className="ds-text-h3 text-theme-primary">Apply all AI suggestions</h4>
                <p className="ds-text-caption">Auto-edit cuts, captions, and pacing in one click.</p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                if (viralQuotes.length && setTextOverlays) {
                  setTextOverlays((prev: any[]) => [...prev, ...viralQuotes.slice(0, 3).map((q: any) => ({
                    id: `quote-${Date.now()}-${Math.random()}`,
                    text: q.text,
                    x: 50, y: 50, fontSize: 28, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                    startTime: q.start ?? 0, endTime: q.end ?? 5, style: 'shadow'
                  }))])
                  showToast('Top alpha-nodes integrated', 'success')
                } else if (aiSuggestions?.length) {
                  const segments = aiSuggestions.map((s: any) => ({
                    id: s.id || `ai-${Date.now()}-${Math.random()}`,
                    startTime: s.time ?? 0,
                    endTime: (s.time ?? 0) + 2,
                    duration: 2,
                    type: 'text' as const,
                    name: s.description || 'AI suggestion',
                    color: '#8b5cf6',
                    track: getDefaultTrackForSegmentType('text')
                  }))
                  setTimelineSegments((prev: any[]) => [...prev, ...segments])
                  showToast('Applied global neural patches', 'success')
                } else {
                  showToast('Synthesis required for auto-execution', 'info')
                }
                setActiveCategory?.('timeline')
              }}
              title="Apply all AI suggestions"
            >
              Apply all
            </Button>
          </div>

          {/* AI AUTO-EDIT CLIPS SECTOR */}
          <div className="space-y-6 border-t border-border pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Layers className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <h4 className="ds-text-h3 text-theme-primary">Auto-edit clips</h4>
                  <span className="ds-text-caption">Generate short-form variations from your video</span>
                </div>
              </div>
              <Button variant="secondary" onClick={onGenerateClips} leftIcon={<Sparkles className="h-4 w-4 text-fuchsia-500" aria-hidden />}>
                Generate clips
              </Button>
            </div>

            {autoEditClips.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {autoEditClips.map((clip, i) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-background/40 p-5 transition-colors hover:border-primary/30"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="ds-text-caption">Variation {String(i + 1).padStart(2, '0')}</span>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">
                        {clip.engagementScore?.overall || 0}% rank
                      </Badge>
                    </div>
                    <h5 className="ds-text-label mb-4 truncate text-theme-primary">{clip.name}</h5>
                    <div className="mb-6 flex items-center gap-3">
                       <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${clip.engagementScore?.viralPotential || 0}%` }}
                            className="h-full bg-primary"
                          />
                       </div>
                       <span className="ds-text-caption">Viral: {clip.engagementScore?.viralPotential || 0}</span>
                    </div>
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => onApplyClip?.(clip)}>
                      Apply to Timeline
                    </Button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-border">
                 <p className="ds-text-caption">No variants synthesized yet</p>
              </div>
            )}
          </div>
        </div>
       </Panel>
      </motion.div>

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => {
          setShowSwarmHUD(false)
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          }
        }}
      />

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={upgradeEdge ? undefined : AI_AGENT_FEATURE}
        requiredTier={upgradeEdge ? 'agency' : 'pro'}
        currentTier={tier}
        reason="feature"
        context={upgradeEdge
          ? 'Agency runs the deepest reasoning and the most live-web grounding — and gets every new AI tool first.'
          : undefined}
      />

      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="space-y-12"
          >
            {/* Transcript Card */}
            <motion.div variants={itemVariants}>
             <Panel variant="glass">
               <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div className="space-y-1">
                     <h3 className="ds-text-h3 text-theme-primary">Transcript</h3>
                     <p className="ds-text-caption">Click any word to seek the player. Extract quotes for overlays.</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleExtractQuotes}
                    loading={isExtractingQuotes}
                    leftIcon={isExtractingQuotes ? undefined : <TrendingUp className="h-4 w-4" aria-hidden />}
                  >
                    {isExtractingQuotes ? 'Extracting…' : 'Extract key quotes'}
                  </Button>
               </div>

               <div className="h-[500px] w-full overflow-hidden rounded-xl border border-border bg-background/40">
                 <Virtuoso
                   data={wordChunks}
                   itemContent={(index, chunk) => (
                     <div className="flex flex-wrap gap-3 border-b border-border p-6 last:border-0">
                        {chunk.words.map((w: any, i: number) => (
                          <motion.span
                            key={`${index}-${i}`}
                            whileHover={{ scale: 1.1, color: '#818cf8' }}
                            className="cursor-pointer select-none text-lg font-semibold text-theme-secondary transition-colors"
                          >
                            {w.word}
                          </motion.span>
                        ))}
                     </div>
                   )}
                 />
               </div>
             </Panel>
            </motion.div>

            {/* Quotes Node */}
            <motion.div variants={itemVariants} className="space-y-4">
               <SectionHeader as="h3" title="Viral-worthy quotes" />

              <div>
                {viralQuotes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {viralQuotes.map((quote, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group/quote relative rounded-2xl border border-border bg-background/40 p-6 transition-colors hover:border-orange-500/30"
                      >
                        <div className="mb-5 flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-orange-500">
                                Strategic weight: {quote.strategicWeight || (quote.score * 100).toFixed(0)}%
                              </Badge>
                              {quote.strategicWeight > 70 && (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500">Growth node</Badge>
                              )}
                              {quote.integrityVerified && (
                                <Badge variant="secondary" className="gap-1.5 bg-indigo-500/10 text-indigo-500">
                                  <ShieldCheck className="h-3 w-3" aria-hidden />
                                  Integrity verified
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                               <span className="ds-text-caption">Logic {String(i + 1).padStart(2, '0')}</span>
                               <div className="relative h-1 w-24 overflow-hidden rounded-full bg-accent" title={`Originality Score: ${quote.originalityScore}%`}>
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${quote.originalityScore || 70}%` }}
                                    className="h-full bg-gradient-to-r from-orange-500 to-indigo-500"
                                  />
                               </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover/quote:opacity-100">
                            {setTextOverlays && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTextOverlays((prev: any[]) => [...prev, {
                                    id: `quote-${Date.now()}-${Math.random()}`,
                                    text: quote.text,
                                    x: 50, y: 50, fontSize: 32, color: '#ffffff', fontFamily: 'Inter, sans-serif',
                                    startTime: quote.start ?? 0, endTime: quote.end ?? 5, style: 'shadow'
                                  }])
                                  showToast('Node projected to workspace', 'success')
                                }}
                                title="Add to workspace"
                                aria-label="Add quote to workspace"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-500 transition-colors hover:bg-orange-500 hover:text-white"
                              >
                                <ArrowUpRight className="h-5 w-5" aria-hidden />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(quote.text)}
                              title="Copy quote"
                              aria-label="Copy quote"
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/40 text-theme-muted transition-colors hover:bg-accent hover:text-theme-primary"
                            >
                              <Copy className="h-5 w-5" aria-hidden />
                            </button>
                          </div>
                        </div>
                        <p className="ds-text-h3 mb-5 text-theme-primary">&quot;{quote.text}&quot;</p>
                        <div className="space-y-3">
                          {quote.reason && (
                            <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-4">
                              <Target className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" aria-hidden />
                              <p className="ds-text-body text-theme-secondary">{quote.reason}</p>
                            </div>
                          )}
                          {quote.nicheRelevance && (
                            <div className="flex items-start gap-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-4">
                              <Brain className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
                              <div className="space-y-1">
                                <span className="ds-text-caption text-indigo-500">Niche relevance</span>
                                <p className="ds-text-body text-theme-secondary">{quote.nicheRelevance}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <Panel variant="subtle" className="p-0">
                    <EmptyState
                      icon={Sparkles}
                      title="No quotes yet"
                      description="Extract key quotes from the transcript to populate this list."
                    />
                  </Panel>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default EliteAIView
