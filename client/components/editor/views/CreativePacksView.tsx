'use client'

import React, { useState } from 'react'
import {
  Wand2, Flame, Coffee, Cpu, Heart, Sparkles, Zap, Music, Type, Palette,
  Wand, CheckCircle2, Lock, Sliders, BookOpen,
  TrendingUp, Award, Target, Rocket, Mic, type LucideIcon,
} from 'lucide-react'
import { Panel, Button, Badge, SectionHeader, UpgradeModal } from '../../ui'
import { cn } from '../../../lib/utils'
import { useEntitlements } from '../../../hooks/useEntitlements'

// Premium packs require the canonical `style_packs` entitlement
// (server/config/entitlements.js — "Creativity style packs", minTier creator).
// Free users lack it; the gate blocks application and opens the UpgradeModal.
const PREMIUM_PACK_FEATURE = 'style_packs'

interface CreativePack {
  id: string
  name: string
  tagline: string
  description: string
  icon: LucideIcon
  gradient: string
  ringColor: string
  bestFor: string[]            // niches
  premium?: boolean
  sample: {
    music?: string             // e.g. "Hype Energy Drop · 128 BPM"
    captionStyle?: string      // e.g. "Bold yellow karaoke pop"
    transitions?: string       // e.g. "Whip pan + zoom punch"
    color?: string             // e.g. "Neon cyberpunk grade"
    pacing?: string            // e.g. "Aggressive · 0.4s avg cut"
    overlays?: string          // e.g. "3-2-1 countdown + arrows"
    voiceTone?: string         // e.g. "Energetic, fast"
  }
}

const PACKS: CreativePack[] = [
  {
    id: 'hype',
    name: 'Hype Pack',
    tagline: 'Maximum energy · TikTok / Reels',
    description: 'The viral-launch starter kit. Heavy bass, fast cuts, neon overlays, bold karaoke captions. Best for product reveals and high-energy hooks.',
    icon: Flame,
    gradient: 'from-rose-500 via-orange-500 to-amber-400',
    ringColor: 'ring-rose-500/30',
    bestFor: ['Fitness', 'Tech', 'Product launches', 'Lifestyle'],
    sample: {
      music: 'Hype Energy Drop · 128 BPM',
      captionStyle: 'Bold yellow karaoke pop',
      transitions: 'Whip pan + zoom punch',
      color: 'High contrast · saturated',
      pacing: 'Aggressive · 0.4s avg cut',
      overlays: '3-2-1 countdown + arrows',
    }
  },
  {
    id: 'cozy',
    name: 'Cozy Vibes',
    tagline: 'Lo-fi · gentle · cinematic',
    description: 'Slow-burn aesthetic for storytelling, journals, recipe content. Lo-fi music, soft captions, warm color grade, gentle dissolves.',
    icon: Coffee,
    gradient: 'from-amber-300 via-orange-300 to-rose-300',
    ringColor: 'ring-amber-400/30',
    bestFor: ['Lifestyle', 'Food', 'Wellness', 'Beauty'],
    sample: {
      music: 'Lo-fi Study Loop · 88 BPM',
      captionStyle: 'Subtle serif · cream',
      transitions: 'Cross dissolve · 0.8s',
      color: 'Warm pastel · low contrast',
      pacing: 'Gentle · 1.5s avg',
      overlays: 'Soft glitter · light leaks',
    }
  },
  {
    id: 'tech',
    name: 'Tech Energy',
    tagline: 'Cyber · digital · synthwave',
    description: 'Neon-driven look for tech reviews, product demos, AI content. Synthwave score, glitch transitions, monospace captions.',
    icon: Cpu,
    gradient: 'from-cyan-400 via-blue-500 to-violet-600',
    ringColor: 'ring-cyan-400/30',
    bestFor: ['Tech', 'AI', 'Coding', 'Crypto'],
    sample: {
      music: 'Neon Synthwave · 116 BPM',
      captionStyle: 'Monospace · cyan glow',
      transitions: 'Glitch RGB split',
      color: 'Cyan/magenta gradient grade',
      pacing: 'Medium · 0.7s avg',
      overlays: 'Pixelate flash · scanlines',
    }
  },
  {
    id: 'cinematic',
    name: 'Cinematic Story',
    tagline: 'Film grain · letterbox · dramatic',
    description: 'Documentary-style polish. Slow zooms, ambient piano, film-grain grade, lower-third captions. Best for personal stories and reveals.',
    icon: Sparkles,
    gradient: 'from-slate-400 via-indigo-500 to-violet-700',
    ringColor: 'ring-violet-500/30',
    bestFor: ['Storytelling', 'Personal Brand', 'Documentary', 'Travel'],
    sample: {
      music: 'Cinematic Build · 95 BPM',
      captionStyle: 'Lower-third · serif italic',
      transitions: 'Match cut · 0.3s',
      color: 'Teal-orange grade · grain',
      pacing: 'Gentle · 2.0s avg',
      overlays: 'Letterbox bars · vignette',
    },
    premium: true,
  },
  {
    id: 'punchy-ads',
    name: 'Punchy Ads',
    tagline: 'Direct response · CTA-heavy',
    description: 'Built for paid ads and conversion. Strong hook, on-screen offer, clear CTA, brand-safe pacing. Optimized for 15-30s formats.',
    icon: Target,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    ringColor: 'ring-emerald-500/30',
    bestFor: ['Ads', 'Product', 'Coaching', 'SaaS'],
    sample: {
      music: 'Corporate Inspire · 110 BPM',
      captionStyle: 'Bold sans · white outline',
      transitions: 'Slide direction · 0.4s',
      color: 'Brand-safe · vivid',
      pacing: 'Aggressive · 0.5s avg',
      overlays: 'Price tag · CTA arrow',
    },
    premium: true,
  },
  {
    id: 'vlog',
    name: 'Vlog Daily',
    tagline: 'Acoustic · personal · grounded',
    description: 'Day-in-the-life and POV format. Acoustic backing, conversational captions, B-roll auto-insert at speech gaps.',
    icon: Heart,
    gradient: 'from-pink-400 via-rose-400 to-orange-300',
    ringColor: 'ring-pink-400/30',
    bestFor: ['Vlog', 'Lifestyle', 'POV', 'Personal Brand'],
    sample: {
      music: 'Acoustic Vlog Folk · 100 BPM',
      captionStyle: 'Handwritten · pastel',
      transitions: 'Soft cross-fade',
      color: 'Natural · warm tones',
      pacing: 'Medium · 1.0s avg',
      overlays: 'Date stamp · location pin',
    }
  },
  {
    id: 'educational',
    name: 'Educational Hook',
    tagline: 'Tutorial · explainer · breakdown',
    description: 'For "3 things you should know" format. Clear typography, numbered overlays, B-roll matched to keywords, calm narration.',
    icon: BookOpen,
    gradient: 'from-blue-500 via-indigo-500 to-violet-600',
    ringColor: 'ring-blue-500/30',
    bestFor: ['Education', 'Finance', 'Tutorial', 'How-to'],
    sample: {
      music: 'Quiet Reflection · 65 BPM',
      captionStyle: 'Clean sans · highlight key terms',
      transitions: 'Step indicator · 0.5s',
      color: 'Neutral · high readability',
      pacing: 'Gentle · 1.8s avg',
      overlays: 'Numbered chapters · diagrams',
    }
  },
  {
    id: 'motivation',
    name: 'Motivation',
    tagline: 'Epic · uplifting · scoreswell',
    description: 'Inspirational shorts. Cinematic score, slow-mo highlights, bold quote-on-screen, dramatic color grade.',
    icon: Award,
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    ringColor: 'ring-amber-500/30',
    bestFor: ['Motivation', 'Sports', 'Mindset', 'Faith'],
    sample: {
      music: 'Cinematic Build · 95 BPM',
      captionStyle: 'Bold serif · gradient fill',
      transitions: 'Slow-mo + light leak',
      color: 'Orange-teal · gritty',
      pacing: 'Medium · 1.2s avg',
      overlays: 'Quote cards · sun flares',
    }
  },
  {
    id: 'comedy',
    name: 'Comedy Cut',
    tagline: 'Reaction · timing · meme',
    description: 'For comedy and reaction content. Trap-meme score, hard cuts, oversized captions, zoom-in punches on punchlines.',
    icon: Zap,
    gradient: 'from-fuchsia-500 via-purple-500 to-indigo-600',
    ringColor: 'ring-fuchsia-500/30',
    bestFor: ['Comedy', 'Reaction', 'Stitch', 'Skit'],
    sample: {
      music: 'Trap Bass Drop · 140 BPM',
      captionStyle: 'Oversized impact · meme',
      transitions: 'Hard cut + zoom punch',
      color: 'Saturated · pop',
      pacing: 'Aggressive · 0.3s avg',
      overlays: 'Eye-zoom · GIF stickers',
    }
  },
  {
    id: 'lifestyle-aesthetic',
    name: 'Aesthetic Mood',
    tagline: 'Pinterest · soft · curated',
    description: 'Visual-first aesthetic content. Dreamy synth pad, slow zoom-ins, monoline captions, pastel color grade.',
    icon: Sparkles,
    gradient: 'from-violet-300 via-pink-300 to-rose-400',
    ringColor: 'ring-violet-300/30',
    bestFor: ['Aesthetic', 'Beauty', 'Travel', 'Mood'],
    sample: {
      music: 'Dreamy Synth Pad · 72 BPM',
      captionStyle: 'Thin handwritten · cream',
      transitions: 'Slow cross-fade',
      color: 'Pastel · low saturation',
      pacing: 'Gentle · 2.5s avg',
      overlays: 'Glitter sparkles · soft glow',
    }
  },
  {
    id: 'finance',
    name: 'Money Moves',
    tagline: 'Trading · ROI · fintech',
    description: 'Finance-content polish. Stock-chart B-roll, ka-ching SFX, green/red callout text, urgent pacing.',
    icon: TrendingUp,
    gradient: 'from-emerald-400 via-green-500 to-teal-600',
    ringColor: 'ring-emerald-400/30',
    bestFor: ['Finance', 'Trading', 'Crypto', 'Investing'],
    sample: {
      music: 'Funky Groove Bass · 112 BPM',
      captionStyle: 'Mono numbers · color-coded',
      transitions: 'Slide + chart sweep',
      color: 'Green-red emphasis · clean',
      pacing: 'Aggressive · 0.6s avg',
      overlays: 'Stock arrows · ka-ching SFX',
    },
    premium: true,
  },
  {
    id: 'podcast-clip',
    name: 'Podcast Clip',
    tagline: 'Talking head · waveform · captions',
    description: 'For podcast and interview clips. Animated waveform, full-burn captions, speaker labels, soft background ambience.',
    icon: Mic,
    gradient: 'from-indigo-500 via-blue-500 to-cyan-500',
    ringColor: 'ring-indigo-500/30',
    bestFor: ['Podcast', 'Interview', 'Talk show', 'Solo VO'],
    sample: {
      music: 'Subtle bed · -24dB ambient',
      captionStyle: 'Bold sans · word-by-word pop',
      transitions: 'Speaker switch fade',
      color: 'Studio-neutral',
      pacing: 'Speech-driven · variable',
      overlays: 'Animated waveform · name tags',
    }
  },
]

interface CreativePacksViewProps {
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  onApplyPack?: (pack: CreativePack) => void
}

const CreativePacksView: React.FC<CreativePacksViewProps> = ({ showToast, onApplyPack }) => {
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const { hasFeature, tier } = useEntitlements()

  const canUsePremium = hasFeature(PREMIUM_PACK_FEATURE)

  const handleApply = async (pack: CreativePack) => {
    if (pack.premium && !canUsePremium) {
      // REAL gate: do NOT apply — open the paywall instead.
      setUpgradeOpen(true)
      return
    }
    setApplying(pack.id)
    setPreviewId(null)
    await new Promise(r => setTimeout(r, 700))
    setApplying(null)
    setAppliedId(pack.id)
    onApplyPack?.(pack)
    showToast?.(`Applied ${pack.name} — captions, music, color, transitions queued.`, 'success')
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto p-6 ds-anim-rise">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="outline" className="gap-2 border-amber-500/30 text-amber-500">
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Creative Packs
          </Badge>
          <SectionHeader
            as="h1"
            title="One-click style bundles"
            description={`Apply music, transitions, color grade, caption style and pacing in one tap. ${PACKS.length} curated packs across niches.`}
          />
        </div>
        {appliedId && (
          <Panel variant="subtle" className="flex items-center gap-2 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
            <span className="ds-text-label text-emerald-500">{PACKS.find(p => p.id === appliedId)?.name} applied</span>
          </Panel>
        )}
      </div>

      {/* Pack grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {PACKS.map(pack => {
          const Icon = pack.icon
          const isApplied = appliedId === pack.id
          const isApplying = applying === pack.id
          const isPreviewing = previewId === pack.id
          const isLocked = !!pack.premium && !canUsePremium

          return (
            <Panel
              key={pack.id}
              variant="glass"
              className={cn('flex flex-col overflow-hidden p-0', isApplied && `ring-2 ${pack.ringColor}`)}
            >
              {/* Cover */}
              <div className={cn('relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br', pack.gradient)}>
                <Icon className="h-14 w-14 text-white drop-shadow" aria-hidden />
                {pack.premium && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-amber-300/30 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                    <Lock className="h-3 w-3" aria-hidden /> Pro
                  </span>
                )}
                {isApplied && (
                  <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-semibold text-white">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> Applied
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="ds-text-h3 text-theme-primary">{pack.name}</h3>
                <p className="ds-text-caption mb-3 text-theme-muted">{pack.tagline}</p>
                <p className="mb-4 text-sm leading-relaxed text-theme-secondary">{pack.description}</p>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {pack.bestFor.slice(0, 4).map(n => (
                    <Badge key={n} variant="outline">{n}</Badge>
                  ))}
                </div>

                {/* Reveal sample on click */}
                {isPreviewing && (
                  <div className="mb-4 space-y-2.5 rounded-xl border border-subtle ds-surface-subtle p-4 ds-anim-fade-in">
                    {pack.sample.music && <SampleRow icon={Music} label="Music" value={pack.sample.music} />}
                    {pack.sample.captionStyle && <SampleRow icon={Type} label="Captions" value={pack.sample.captionStyle} />}
                    {pack.sample.transitions && <SampleRow icon={Sliders} label="Transitions" value={pack.sample.transitions} />}
                    {pack.sample.color && <SampleRow icon={Palette} label="Color grade" value={pack.sample.color} />}
                    {pack.sample.pacing && <SampleRow icon={Zap} label="Pacing" value={pack.sample.pacing} />}
                    {pack.sample.overlays && <SampleRow icon={Sparkles} label="Overlays" value={pack.sample.overlays} />}
                    {pack.sample.voiceTone && <SampleRow icon={Mic} label="Voice tone" value={pack.sample.voiceTone} />}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewId(isPreviewing ? null : pack.id)}
                  >
                    {isPreviewing ? 'Hide details' : 'View details'}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={isLocked ? 'secondary' : 'primary'}
                    onClick={() => handleApply(pack)}
                    disabled={!!applying}
                    loading={isApplying}
                    leftIcon={!isApplying ? (isLocked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : isApplied ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Rocket className="h-3.5 w-3.5" aria-hidden />) : undefined}
                  >
                    {isApplying ? 'Applying…' : isLocked ? 'Unlock pack' : isApplied ? 'Applied' : 'Apply pack'}
                  </Button>
                </div>
              </div>
            </Panel>
          )
        })}
      </div>

      {/* Footer */}
      <Panel variant="subtle" className="flex items-start gap-3 p-4">
        <Wand className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <div>
          <p className="ds-text-label text-theme-primary">Packs apply locally; backend pipeline is forward-compatible.</p>
          <p className="ds-text-caption mt-1 leading-relaxed text-theme-muted">
            Each pack toasts the bundle name and (when wired) sets caption style, music, transitions, color preset and pacing on the timeline. Pro packs unlock 4K stock + extended licensing.
          </p>
        </div>
      </Panel>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature={PREMIUM_PACK_FEATURE}
        requiredTier="creator"
        currentTier={tier}
        reason="feature"
        context="Premium packs include extended licensing and 4K stock."
      />
    </div>
  )
}

const SampleRow: React.FC<{ icon: LucideIcon; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent">
      <Icon className="h-3.5 w-3.5 text-theme-secondary" aria-hidden />
    </div>
    <div className="min-w-0 flex-1">
      <p className="ds-text-caption text-theme-muted">{label}</p>
      <p className="text-sm font-medium leading-tight text-theme-primary">{value}</p>
    </div>
  </div>
)

export default CreativePacksView
