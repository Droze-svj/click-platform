// Shared niche / platform / goal catalogs.
//
// Single source of truth used by the registration onboarding (Step 2) AND the
// public landing personalization (NichePicker, PlanBuilder), so the landing →
// /register handoff uses identical `value` strings (no drift).
//
// Every niche `value` maps 1:1 to a key in NICHE_PLAYBOOKS
// (server/services/marketingKnowledge.js). The blurbs are drawn from each
// playbook's real voice/angles — what Click actually does for that niche. NO
// invented metrics or fabricated benefits.

import {
  Sparkles, BarChart3, BookOpen, Cpu, Briefcase, Drama, Globe,
  Coins, Baby, Palette, Leaf, FlaskConical, Gamepad2, Dumbbell,
  Users, Eye, DollarSign, Clock, Megaphone,
  type LucideIcon,
} from 'lucide-react'

export interface NicheOption { value: string; label: string; icon: LucideIcon; blurb: string }
export interface PlatformOption { value: string; label: string }
export interface GoalOption { value: string; label: string; icon: LucideIcon }

export const NICHE_OPTIONS: NicheOption[] = [
  { value: 'health', label: 'Health & Fitness', icon: Dumbbell, blurb: 'Authoritative, study-backed clips — myth-busts, transformations and sub-5-minute habit stacks.' },
  { value: 'finance', label: 'Finance & Money', icon: BarChart3, blurb: 'Math-forward, dollar-specific edits — mistake countdowns, income breakdowns and debt-payoff plans.' },
  { value: 'education', label: 'Education', icon: BookOpen, blurb: 'Clear, structured walkthroughs — one promise per video, comparisons and cheatsheet reveals.' },
  { value: 'technology', label: 'Technology', icon: Cpu, blurb: 'Sharp, demo-first cuts — tool battles, build-in-public updates and workflow speed-ups.' },
  { value: 'lifestyle', label: 'Lifestyle', icon: Sparkles, blurb: 'Aspirational-but-achievable POV — day-in-the-life, routine reveals and aesthetic transformations.' },
  { value: 'business', label: 'Business', icon: Briefcase, blurb: 'Operator-not-guru tactics — revenue breakdowns, pricing reveals and mistake post-mortems.' },
  { value: 'entertainment', label: 'Entertainment', icon: Drama, blurb: 'Personality-forward pacing — reactions, storytime, hot-take recaps and behind-the-scenes.' },
  { value: 'crypto', label: 'Crypto & Web3', icon: Coins, blurb: 'Sober, data-first explainers — on-chain breakdowns, protocol mechanics and risk-first framing.' },
  { value: 'parenting', label: 'Parenting', icon: Baby, blurb: 'Warm, non-judgmental clips — milestone reframes, real-day POV and gear that actually works.' },
  { value: 'beauty', label: 'Beauty & Skincare', icon: Palette, blurb: 'Best-friend energy — ingredient deep-dives, honest dupe reveals and technique callouts.' },
  { value: 'wellness', label: 'Wellness', icon: Leaf, blurb: 'Calm, grounded edits — stress physiology, tiny-habit stacks and nervous-system resets.' },
  { value: 'science', label: 'Science', icon: FlaskConical, blurb: 'Curious explainers — counterintuitive findings, how-it-works and scale visualizations.' },
  { value: 'gaming', label: 'Gaming', icon: Gamepad2, blurb: 'High-energy, community-aware — patch winners/losers, build guides and esports moments.' },
  { value: 'other', label: 'Something else', icon: Globe, blurb: 'Click adapts to your energy — specific, visual edits with concrete proof and clean pacing.' },
]

/** Multi-select platform focus — values match the server platform whitelist. */
export const PLATFORM_OPTIONS: PlatformOption[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
]

/** Primary goal — small fixed set; values match the server goal whitelist. */
export const GOAL_OPTIONS: GoalOption[] = [
  { value: 'grow_audience', label: 'Grow my audience', icon: Users },
  { value: 'more_views', label: 'Get more views', icon: Eye },
  { value: 'monetize', label: 'Monetize my content', icon: DollarSign },
  { value: 'save_time', label: 'Save editing time', icon: Clock },
  { value: 'build_brand', label: 'Build my brand', icon: Megaphone },
]

/** The niches surfaced on the landing NichePicker (a curated marquee subset). */
export const LANDING_NICHES: string[] = ['finance', 'health', 'lifestyle', 'gaming', 'beauty', 'technology']

export const nicheLabel = (value: string | null | undefined): string =>
  NICHE_OPTIONS.find((n) => n.value === value)?.label || ''

export const platformLabel = (value: string): string =>
  PLATFORM_OPTIONS.find((p) => p.value === value)?.label || value

export const goalLabel = (value: string): string =>
  GOAL_OPTIONS.find((g) => g.value === value)?.label || value
