// Single source of truth for Click's "swarm" + niche accent system.
//
// Previously ClickDynamicIsland.tsx and WorkflowRail.tsx each kept their own
// hardcoded, *divergent* accent maps (e.g. the rail's "coach" was flat indigo
// while the island's was a gradient). This module unifies them and adds a
// niche-driven layer so each creator's workflow re-tints to their content
// niche, falling back to the active swarm when the niche is unknown/unset.
//
// All class strings are complete literals so Tailwind's JIT can statically
// extract them (tailwind.config.js scans ./lib/**).

export type SwarmMode = 'viral' | 'trust' | 'coach' | 'authority'

export const SWARM_MODES: SwarmMode[] = ['viral', 'trust', 'coach', 'authority']

export function isSwarmMode(value: unknown): value is SwarmMode {
  return typeof value === 'string' && (SWARM_MODES as string[]).includes(value)
}

// Accent palettes = the 4 swarm modes plus niche-specific palettes. Niches map
// onto these keys via resolveAccentKey().
export type AccentKey = SwarmMode | 'creator' | 'wealth' | 'play'

export interface AccentClasses {
  /** Tailwind gradient stops, e.g. 'from-orange-500 to-rose-500'. */
  gradient: string
  /** Solid/gradient background for active pills + primary CTAs. */
  solidBg: string
  /** Accent text colour (light + dark). */
  textAccent: string
  /** Subtle border tint. */
  border: string
  /** Ring + glow for the active workflow step. */
  ring: string
  /** Large ambient shadow for the floating Click island. */
  shadow: string
}

export const ACCENT_PALETTES: Record<AccentKey, AccentClasses> = {
  viral: {
    gradient: 'from-orange-500 to-rose-500',
    solidBg: 'bg-gradient-to-r from-orange-500 to-rose-500',
    textAccent: 'text-rose-500 dark:text-rose-400',
    border: 'border-rose-500/30',
    ring: 'ring-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(244,63,94,0.25)] border-rose-500/30',
  },
  trust: {
    gradient: 'from-emerald-500 to-teal-500',
    solidBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    textAccent: 'text-teal-500 dark:text-teal-400',
    border: 'border-teal-500/30',
    ring: 'ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(20,184,166,0.25)] border-teal-500/30',
  },
  coach: {
    gradient: 'from-indigo-500 to-violet-500',
    solidBg: 'bg-gradient-to-r from-indigo-500 to-violet-500',
    textAccent: 'text-indigo-500 dark:text-indigo-400',
    border: 'border-indigo-500/30',
    ring: 'ring-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(99,102,241,0.25)] border-indigo-500/30',
  },
  authority: {
    gradient: 'from-cyan-500 to-blue-500',
    solidBg: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    textAccent: 'text-cyan-500 dark:text-cyan-400',
    border: 'border-cyan-500/30',
    ring: 'ring-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(6,182,212,0.25)] border-cyan-500/30',
  },
  // Niche palettes — beauty / fashion / lifestyle
  creator: {
    gradient: 'from-fuchsia-500 to-pink-500',
    solidBg: 'bg-gradient-to-r from-fuchsia-500 to-pink-500',
    textAccent: 'text-fuchsia-500 dark:text-fuchsia-400',
    border: 'border-fuchsia-500/30',
    ring: 'ring-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(217,70,239,0.25)] border-fuchsia-500/30',
  },
  // Niche palettes — finance / business / money
  wealth: {
    gradient: 'from-amber-400 to-orange-500',
    solidBg: 'bg-gradient-to-r from-amber-400 to-orange-500',
    textAccent: 'text-amber-500 dark:text-amber-400',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(245,158,11,0.25)] border-amber-500/30',
  },
  // Niche palettes — gaming / entertainment
  play: {
    gradient: 'from-violet-500 to-purple-500',
    solidBg: 'bg-gradient-to-r from-violet-500 to-purple-500',
    textAccent: 'text-violet-500 dark:text-violet-400',
    border: 'border-violet-500/30',
    ring: 'ring-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.4)]',
    shadow: 'shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_50px_rgba(139,92,246,0.25)] border-violet-500/30',
  },
}

export interface SwarmDescriptor {
  label: string
  desc: string
  voice: string
}

export const SWARM_THEMES: Record<SwarmMode, SwarmDescriptor> = {
  viral: {
    label: 'Viral Swarm',
    desc: 'High-energy pacing, dynamic speed ramps, emoji injections.',
    voice: 'Hyper-Growth mode active. Click is targeting raw retention.',
  },
  trust: {
    label: 'Trust Swarm',
    desc: 'Cinematic grades, slower authoritative pacing, clean serif captions.',
    voice: 'Authority locked. Suggesting logical layout structures.',
  },
  coach: {
    label: 'Witty Coach',
    desc: 'Clever hooks, snappy cuts, responsive caption micro-bursts.',
    voice: "Sassy coach mode active. Let's make this one pop!",
  },
  authority: {
    label: 'ExpertSwarm',
    desc: 'Deep industry context, competitor positioning metrics, AIDA hooks.',
    voice: 'Enterprise swarm online. Benchmarking opponent channels.',
  },
}

// Niche keyword → accent palette. First match wins; order matters where a niche
// could plausibly fit more than one bucket.
const NICHE_KEYWORDS: { key: AccentKey; terms: string[] }[] = [
  { key: 'creator', terms: ['beauty', 'fashion', 'makeup', 'skincare', 'lifestyle', 'style', 'model', 'glam'] },
  { key: 'wealth', terms: ['finance', 'money', 'invest', 'crypto', 'business', 'entrepreneur', 'wealth', 'trading', 'real estate', 'ecom', 'sales'] },
  { key: 'play', terms: ['gaming', 'game', 'gamer', 'esports', 'entertainment', 'comedy', 'meme', 'music', 'sport'] },
  { key: 'trust', terms: ['fitness', 'health', 'wellness', 'gym', 'nutrition', 'medical', 'yoga'] },
  { key: 'authority', terms: ['tech', 'ai', 'software', 'saas', 'dev', 'coding', 'programming', 'startup', 'science', 'travel'] },
  { key: 'viral', terms: ['food', 'cooking', 'recipe', 'vlog', 'viral', 'trend', 'dance'] },
  { key: 'coach', terms: ['education', 'coaching', 'motivation', 'mindset', 'productivity', 'learning', 'teaching', 'self help'] },
]

/**
 * Resolve which accent palette to apply. A recognised niche tints the UI to
 * that niche; otherwise it falls back to the user's active swarm choice.
 */
export function resolveAccentKey(niche: string | null | undefined, swarm: SwarmMode): AccentKey {
  if (niche) {
    const n = niche.toLowerCase().replace(/[_-]+/g, ' ').trim()
    for (const { key, terms } of NICHE_KEYWORDS) {
      if (terms.some((t) => n.includes(t))) return key
    }
  }
  return swarm
}
