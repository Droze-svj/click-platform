'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2, Flame, Coffee, Cpu, Heart, Sparkles, Zap, Music, Type, Palette,
  Wand, Loader2, CheckCircle2, Lock, Sliders, BookOpen,
  TrendingUp, Award, Target, Rocket, Mic
} from 'lucide-react'

interface CreativePack {
  id: string
  name: string
  tagline: string
  description: string
  icon: any
  gradient: string
  ringColor: string
  bestFor: string[]            // niches
  expectedLift?: string        // engagement bump
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
    expectedLift: '+24% retention',
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
    expectedLift: '+18% saves',
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
    expectedLift: '+22% completion',
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
    expectedLift: '+31% completion',
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
    expectedLift: '+38% CTR',
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
    expectedLift: '+19% retention',
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
    expectedLift: '+27% saves',
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
    expectedLift: '+33% shares',
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
    expectedLift: '+38% remixes',
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
    expectedLift: '+21% saves',
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
    expectedLift: '+25% completion',
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
    expectedLift: '+29% retention',
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

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]'

interface CreativePacksViewProps {
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  onApplyPack?: (pack: CreativePack) => void
}

const CreativePacksView: React.FC<CreativePacksViewProps> = ({ showToast, onApplyPack }) => {
  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const handleApply = async (pack: CreativePack) => {
    if (pack.premium) {
      // soft-paywall — frontend only
      showToast?.(`${pack.name} is a Pro pack — upgrade to unlock.`, 'info')
    }
    setApplying(pack.id)
    setPreviewId(null)
    await new Promise(r => setTimeout(r, 700))
    setApplying(null)
    setAppliedId(pack.id)
    onApplyPack?.(pack)
    showToast?.(`✓ Applied ${pack.name} — captions, music, color, transitions queued.`, 'success')
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#0a0a14] via-[#0d0d18] to-[#080812] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center shadow-[0_20px_60px_rgba(245,158,11,0.3)]">
            <Wand2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400">Click · Creative Packs</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">One-click style bundles</h2>
            <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
              Apply music + transitions + color grade + caption style + pacing in one tap. {PACKS.length} curated packs across niches.
            </p>
          </div>
        </div>
        {appliedId && (
          <div className={`${glassStyle} rounded-2xl px-4 py-2.5 flex items-center gap-3 border-emerald-500/30`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-[0.2em]">{PACKS.find(p => p.id === appliedId)?.name} applied</span>
          </div>
        )}
      </div>

      {/* Pack grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {PACKS.map(pack => {
          const Icon = pack.icon
          const isApplied = appliedId === pack.id
          const isApplying = applying === pack.id
          const isPreviewing = previewId === pack.id

          return (
            <motion.div
              key={pack.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${glassStyle} rounded-2xl overflow-hidden flex flex-col group hover:bg-white/[0.05] transition-colors ${isApplied ? `ring-2 ${pack.ringColor}` : ''}`}
            >
              {/* Cover */}
              <div className={`relative h-36 bg-gradient-to-br ${pack.gradient} flex items-center justify-center overflow-hidden`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.4),transparent_60%)]" />
                <Icon className="w-16 h-16 text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.3)] group-hover:scale-110 transition-transform" />
                {pack.premium && (
                  <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/40 text-amber-300 border border-amber-300/30 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Pro
                  </span>
                )}
                {pack.expectedLift && (
                  <span className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/40 text-white border border-white/30 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" /> {pack.expectedLift}
                  </span>
                )}
                {isApplied && (
                  <span className="absolute bottom-3 left-3 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Applied
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-black text-white tracking-tight leading-tight mb-1">{pack.name}</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-3">{pack.tagline}</p>
                <p className="text-[12px] text-slate-300 leading-relaxed mb-4">{pack.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pack.bestFor.slice(0, 4).map(n => (
                    <span key={n} className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                      {n}
                    </span>
                  ))}
                </div>

                {/* Reveal sample on click */}
                <AnimatePresence initial={false}>
                  {isPreviewing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mb-4"
                    >
                      <div className="rounded-xl bg-black/40 border border-white/5 p-4 space-y-2.5">
                        {pack.sample.music && <SampleRow icon={Music}    label="Music"       value={pack.sample.music} />}
                        {pack.sample.captionStyle && <SampleRow icon={Type} label="Captions"  value={pack.sample.captionStyle} />}
                        {pack.sample.transitions && <SampleRow icon={Sliders} label="Transitions" value={pack.sample.transitions} />}
                        {pack.sample.color && <SampleRow icon={Palette}  label="Color grade" value={pack.sample.color} />}
                        {pack.sample.pacing && <SampleRow icon={Zap}      label="Pacing"      value={pack.sample.pacing} />}
                        {pack.sample.overlays && <SampleRow icon={Sparkles} label="Overlays" value={pack.sample.overlays} />}
                        {pack.sample.voiceTone && <SampleRow icon={Mic}    label="Voice tone"  value={pack.sample.voiceTone} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewId(isPreviewing ? null : pack.id)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[11px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {isPreviewing ? 'Hide details' : 'View details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApply(pack)}
                    disabled={!!applying}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isApplied ? 'bg-emerald-600 hover:bg-emerald-500' : `bg-gradient-to-r ${pack.gradient} hover:brightness-110`
                    }`}
                  >
                    {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isApplied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
                    {isApplying ? 'Applying…' : isApplied ? 'Applied' : 'Apply pack'}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Wand className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold text-amber-300 leading-snug">Packs apply locally; backend pipeline is forward-compatible.</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Each pack toasts the bundle name and (when wired) sets caption style, music, transitions, color preset, and pacing on the timeline. Pro packs unlock 4K stock + extended licensing.
          </p>
        </div>
      </div>
    </div>
  )
}

const SampleRow: React.FC<{ icon: any; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon className="w-3.5 h-3.5 text-slate-300" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-0.5">{label}</p>
      <p className="text-[11px] text-white font-medium leading-tight">{value}</p>
    </div>
  </div>
)

export default CreativePacksView
