'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Type, Sparkles, Wand2, Search, X, CheckCircle2, ArrowRight,
  Flame, Coffee, Cpu, Heart, Zap, Mic, Brush, Layers, Palette,
  Activity, Bold, Italic, Underline, Hash, Pin
} from 'lucide-react'
import type {
  TextOverlay, TextOverlayAnimationIn, TextOverlayAnimationOut,
  TextOverlayStyle, MotionGraphicPreset
} from '../../../types/editor'

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'styles' | 'animations' | 'motion' | 'fonts'

interface CaptionStyle {
  id: string; name: string; mood: string; family: string
  weight: number; italic?: boolean; tracking?: string
  fill: string; stroke?: string; bg?: string; bgPad?: string
  shadow?: string; effect?: 'none' | 'glow' | 'outline' | 'highlight' | 'pop'
  preview: string
}

interface TextAnimation { id: string; name: string; mood: string; tag: string; preview: 'fade-up' | 'pop' | 'typewriter' | 'wave' | 'glitch' | 'slide' | 'bounce' | 'zoom' | 'rotate' | 'stretch' | 'blur-in' | 'shake' | 'wipe' | 'flip' | 'reveal-up' | 'split' }
interface MotionPreset    { id: string; name: string; mood: string; tag: string; preview: 'ken-burns' | 'parallax' | 'shake' | 'zoom-pulse' | 'tilt' | 'pan-left' | 'pan-right' | 'orbit' | 'wobble' | 'breathe' | 'dolly-zoom' | 'glitch-shake' }
interface FontEntry       { id: string; name: string; family: string; weights: number[]; mood: string; bestFor: string[] }

// Loaded by next/font/google in app/layout.tsx — accessible via CSS vars.
// We chain to system fallbacks so dev-server cold loads still render text.
const F_INTER     = 'var(--font-inter), "Inter", system-ui, sans-serif'
const F_PLAYFAIR  = 'var(--font-playfair), "Playfair Display", Georgia, serif'
const F_CAVEAT    = 'var(--font-caveat), "Caveat", "Comic Sans MS", cursive'
const F_JETBRAINS = 'var(--font-jetbrains), "JetBrains Mono", "Courier New", monospace'
const F_VT323     = 'var(--font-vt323), "VT323", "Courier New", monospace'

// ── Caption styles (24) ─────────────────────────────────────────────────────
const STYLES: CaptionStyle[] = [
  { id: 'tt-karaoke',  name: 'TikTok Karaoke',     mood: 'Hype',       family: F_INTER,     weight: 900, fill: '#fff35a', stroke: '2px #000',                                            bg: 'rgba(0,0,0,0.65)', bgPad: '6px 12px', effect: 'highlight', preview: 'WORD POPS HERE' },
  { id: 'reels-bold',  name: 'Reels Bold Pop',     mood: 'Hype',       family: F_INTER,     weight: 900, fill: '#fff',     stroke: '3px #000', shadow: '0 0 18px rgba(255,255,255,0.6)',                          effect: 'pop',       preview: 'YOU WONT BELIEVE' },
  { id: 'shorts',      name: 'YouTube Shorts',     mood: 'Hype',       family: F_INTER,     weight: 800, fill: '#fff',     stroke: '4px #ff3b30',                                                              effect: 'outline',   preview: 'CLICK HERE NOW' },
  { id: 'meme',        name: 'Meme Impact',        mood: 'Comedy',     family: '"Impact", "Arial Black", system-ui', weight: 700, fill: '#fff',     stroke: '4px #000', tracking: '0.04em',                                            effect: 'outline',   preview: 'WHEN YOU REALIZE' },
  { id: 'minimal',     name: 'Minimal Sans',       mood: 'Modern',     family: F_INTER,     weight: 600, fill: '#fff',                                                                                       effect: 'none',      preview: 'A clean message.' },
  { id: 'serif-elite', name: 'Serif Elite',        mood: 'Luxury',     family: F_PLAYFAIR,  weight: 700, italic: true, fill: '#f7e6c4',                                                                       effect: 'none',      preview: 'A timeless story.' },
  { id: 'lower-third', name: 'Lower-Third News',   mood: 'Cinematic',  family: F_INTER,     weight: 600, fill: '#fff',     bg: 'linear-gradient(90deg,#0f172a,#1e293b)', bgPad: '8px 16px',                  effect: 'none',      preview: 'BREAKING — Update' },
  { id: 'subtitle',    name: 'Subtitle Clean',     mood: 'Modern',     family: F_INTER,     weight: 500, fill: '#fff',     bg: 'rgba(0,0,0,0.55)', bgPad: '4px 10px',                                          effect: 'none',      preview: 'so I told them...' },
  { id: 'neon',        name: 'Neon Glow',          mood: 'Tech',       family: F_INTER,     weight: 800, fill: '#06b6d4',  shadow: '0 0 14px #06b6d4, 0 0 28px #06b6d4',                                       effect: 'glow',      preview: 'CYBER MODE' },
  { id: 'magenta-glow',name: 'Magenta Glow',       mood: 'Tech',       family: F_INTER,     weight: 800, fill: '#ec4899',  shadow: '0 0 14px #ec4899, 0 0 28px #ec4899',                                       effect: 'glow',      preview: 'AESTHETIC.' },
  { id: 'pill',        name: 'Pill Highlight',     mood: 'Modern',     family: F_INTER,     weight: 700, fill: '#fff',     bg: '#7c3aed', bgPad: '6px 16px',                                                  effect: 'highlight', preview: 'NEW DROP' },
  { id: 'pill-inv',    name: 'Pill Inverted',      mood: 'Modern',     family: F_INTER,     weight: 700, fill: '#020205',  bg: '#fde047', bgPad: '6px 16px',                                                  effect: 'highlight', preview: 'LIMITED OFFER' },
  { id: 'retro-vhs',   name: 'Retro VHS',          mood: 'Retro',      family: F_VT323,     weight: 400, fill: '#dafffa',  shadow: '2px 0 #ff00ff, -2px 0 #00ffff',                                            effect: 'glow',      preview: 'PRESS REC ▶' },
  { id: 'comic',       name: 'Comic Pop',          mood: 'Comedy',     family: '"Comic Sans MS", system-ui', weight: 700, fill: '#fff', stroke: '3px #000', shadow: '4px 4px 0 #ff3b30',                                    effect: 'pop',       preview: 'POW! BOOM!' },
  { id: 'handwritten', name: 'Handwritten',        mood: 'Cozy',       family: F_CAVEAT,    weight: 600, fill: '#fff',                                                                              effect: 'none',      preview: 'thinking out loud...' },
  { id: 'mono-tech',   name: 'Mono Tech',          mood: 'Tech',       family: F_JETBRAINS, weight: 600, fill: '#10b981',                                                                                  effect: 'none',      preview: '> running.exe' },
  { id: 'glitch-rgb',  name: 'Glitch RGB',         mood: 'Tech',       family: F_INTER,     weight: 900, fill: '#fff',     shadow: '2px 0 #ff00ff, -2px 0 #00ffff, 0 0 6px rgba(0,0,0,0.6)',                  effect: 'glow',      preview: 'GLITCH MODE' },
  { id: 'gradient',    name: 'Gradient Fill',      mood: 'Aesthetic',  family: F_INTER,     weight: 900, fill: 'linear-gradient(90deg,#ec4899,#8b5cf6,#06b6d4)',                                                effect: 'pop',       preview: 'AESTHETIC.' },
  { id: 'big-quote',   name: 'Pull Quote',         mood: 'Cinematic',  family: F_PLAYFAIR,  weight: 800, italic: true, fill: '#fff',                                                                          effect: 'none',      preview: '"It changed everything."' },
  { id: 'caption-mono',name: 'Caption Mono',       mood: 'Modern',     family: F_JETBRAINS, weight: 500, fill: '#fff', bg: 'rgba(0,0,0,0.7)', bgPad: '4px 10px',                                            effect: 'none',      preview: 'note · 0:42' },
  { id: 'big-stamp',   name: 'Big Stamp',          mood: 'Hype',       family: F_INTER,     weight: 900, italic: true, fill: '#fff', stroke: '5px #000', tracking: '-0.04em',                                  effect: 'outline',   preview: 'EXCLUSIVE' },
  { id: 'sparkle',     name: 'Sparkle Trail',      mood: 'Aesthetic',  family: F_INTER,     weight: 700, fill: '#fff',     shadow: '0 0 10px #fde047, 0 0 20px #fcd34d',                                       effect: 'glow',      preview: '✨ magic moment ✨' },
  { id: 'trader',      name: 'Trader Numbers',     mood: 'Finance',    family: F_JETBRAINS, weight: 700, fill: '#10b981',                                                                                  effect: 'none',      preview: '+24.6% MoM' },
  { id: 'denim',       name: 'Denim Stamp',        mood: 'Lifestyle',  family: F_INTER,     weight: 800, italic: true, fill: '#3b82f6', shadow: '2px 2px 0 rgba(255,255,255,0.4)',                              effect: 'pop',       preview: 'WEEKEND DROP' },
]

// ── Animations (16) ─────────────────────────────────────────────────────────
const ANIMATIONS: TextAnimation[] = [
  { id: 'a-pop',         name: 'Pop',              mood: 'Hype',     tag: 'Burst',  preview: 'pop' },
  { id: 'a-fade-up',     name: 'Fade Up',          mood: 'Modern',   tag: 'Soft',   preview: 'fade-up' },
  { id: 'a-typewriter',  name: 'Typewriter',       mood: 'Cinematic',tag: 'Char',   preview: 'typewriter' },
  { id: 'a-wave',        name: 'Wave',             mood: 'Aesthetic',tag: 'Char',   preview: 'wave' },
  { id: 'a-glitch',      name: 'Glitch',           mood: 'Tech',     tag: 'Heavy',  preview: 'glitch' },
  { id: 'a-slide-r',     name: 'Slide In',         mood: 'Modern',   tag: 'Direction', preview: 'slide' },
  { id: 'a-bounce',      name: 'Bounce',           mood: 'Comedy',   tag: 'Spring', preview: 'bounce' },
  { id: 'a-zoom-in',     name: 'Zoom Punch',       mood: 'Hype',     tag: 'Impact', preview: 'zoom' },
  { id: 'a-rotate',      name: 'Rotate Stamp',     mood: 'Hype',     tag: 'Impact', preview: 'rotate' },
  { id: 'a-stretch',     name: 'Stretch',          mood: 'Comedy',   tag: 'Spring', preview: 'stretch' },
  { id: 'a-blur-in',     name: 'Blur In',          mood: 'Cinematic',tag: 'Soft',   preview: 'blur-in' },
  { id: 'a-shake',       name: 'Shake',            mood: 'Hype',     tag: 'Impact', preview: 'shake' },
  { id: 'a-wipe',        name: 'Wipe Reveal',      mood: 'Modern',   tag: 'Reveal', preview: 'wipe' },
  { id: 'a-flip',        name: 'Flip 3D',          mood: 'Tech',     tag: 'Heavy',  preview: 'flip' },
  { id: 'a-reveal-up',   name: 'Reveal Up',        mood: 'Cinematic',tag: 'Reveal', preview: 'reveal-up' },
  { id: 'a-split',       name: 'Split Word',       mood: 'Aesthetic',tag: 'Char',   preview: 'split' },
]

// ── Motion presets (12) ─────────────────────────────────────────────────────
const MOTIONS: MotionPreset[] = [
  { id: 'm-ken-burns',   name: 'Ken Burns',        mood: 'Cinematic', tag: 'Slow zoom + drift', preview: 'ken-burns' },
  { id: 'm-parallax',    name: 'Parallax Layers',  mood: 'Modern',    tag: 'Depth',             preview: 'parallax' },
  { id: 'm-shake',       name: 'Camera Shake',     mood: 'Hype',      tag: 'Energy',            preview: 'shake' },
  { id: 'm-zoom-pulse',  name: 'Zoom Pulse',       mood: 'Hype',      tag: 'Beat sync',         preview: 'zoom-pulse' },
  { id: 'm-tilt',        name: 'Dutch Tilt',       mood: 'Cinematic', tag: 'Drama',             preview: 'tilt' },
  { id: 'm-pan-l',       name: 'Pan Left',         mood: 'Modern',    tag: 'Direction',         preview: 'pan-left' },
  { id: 'm-pan-r',       name: 'Pan Right',        mood: 'Modern',    tag: 'Direction',         preview: 'pan-right' },
  { id: 'm-orbit',       name: 'Orbit',            mood: 'Tech',      tag: '3D',                preview: 'orbit' },
  { id: 'm-wobble',      name: 'Wobble',           mood: 'Comedy',    tag: 'Bounce',            preview: 'wobble' },
  { id: 'm-breathe',     name: 'Breathe',          mood: 'Cozy',      tag: 'Subtle',            preview: 'breathe' },
  { id: 'm-dolly',       name: 'Dolly Zoom',       mood: 'Cinematic', tag: 'Tension',           preview: 'dolly-zoom' },
  { id: 'm-glitch-shake',name: 'Glitch Shake',     mood: 'Tech',      tag: 'Distort',           preview: 'glitch-shake' },
]

// ── Fonts (16) ───────────────────────────────────────────────────────────────
const FONTS: FontEntry[] = [
  { id: 'inter',     name: 'Inter',                family: F_INTER,                                            weights: [400, 600, 800, 900], mood: 'Modern',     bestFor: ['Captions', 'UI', 'Lower thirds'] },
  { id: 'playfair',  name: 'Playfair Display',     family: F_PLAYFAIR,                                         weights: [400, 700, 800, 900], mood: 'Luxury',     bestFor: ['Quote', 'Cinematic', 'Editorial'] },
  { id: 'jetbrains', name: 'JetBrains Mono',       family: F_JETBRAINS,                                        weights: [400, 500, 700],      mood: 'Tech',       bestFor: ['Code overlay', 'Numbers', 'Tags'] },
  { id: 'caveat',    name: 'Caveat',               family: F_CAVEAT,                                           weights: [400, 600, 700],      mood: 'Cozy',       bestFor: ['Vlogs', 'Personal', 'Notes'] },
  { id: 'impact',    name: 'Impact',               family: '"Impact", "Arial Black", system-ui',               weights: [700],                 mood: 'Hype',       bestFor: ['Memes', 'Big stamps'] },
  { id: 'vt323',     name: 'VT323',                family: F_VT323,                                            weights: [400],                 mood: 'Retro',      bestFor: ['Glitch', 'Terminal', 'VHS'] },
  { id: 'comic',     name: 'Comic Sans',           family: '"Comic Sans MS", system-ui',                       weights: [400, 700],            mood: 'Comedy',     bestFor: ['Reaction', 'Skit'] },
  { id: 'arial',     name: 'Arial Black',          family: '"Arial Black", system-ui',                         weights: [900],                 mood: 'Hype',       bestFor: ['Headlines', 'CTAs'] },
  { id: 'helvetica', name: 'Helvetica',            family: '"Helvetica Neue", Helvetica, system-ui',           weights: [400, 500, 700],       mood: 'Modern',     bestFor: ['Subtitles', 'Editorial'] },
  { id: 'georgia',   name: 'Georgia',              family: 'Georgia, serif',                                   weights: [400, 700],            mood: 'Editorial',  bestFor: ['Long-form', 'Quotes'] },
  { id: 'courier',   name: 'Courier New',          family: '"Courier New", monospace',                         weights: [400, 700],            mood: 'Tech',       bestFor: ['Mono captions', 'Receipts'] },
  { id: 'garamond',  name: 'Garamond',             family: 'Garamond, serif',                                  weights: [400, 700],            mood: 'Luxury',     bestFor: ['Cinema', 'Storytelling'] },
  { id: 'verdana',   name: 'Verdana',              family: 'Verdana, system-ui',                               weights: [400, 700],            mood: 'Readable',   bestFor: ['Accessibility', 'Mobile'] },
  { id: 'trebuchet', name: 'Trebuchet MS',         family: '"Trebuchet MS", system-ui',                        weights: [400, 700],            mood: 'Friendly',   bestFor: ['Casual', 'Lifestyle'] },
  { id: 'tahoma',    name: 'Tahoma',               family: 'Tahoma, system-ui',                                weights: [400, 700],            mood: 'Readable',   bestFor: ['Long captions', 'Body'] },
  { id: 'palatino',  name: 'Palatino',             family: '"Palatino Linotype", "Book Antiqua", serif',       weights: [400, 700],            mood: 'Editorial',  bestFor: ['Branding', 'Publication'] },
]

const MOOD_ICONS: Record<string, any> = {
  Hype: Flame, Cozy: Coffee, Cinematic: Sparkles, Tech: Cpu, Modern: Activity,
  Aesthetic: Sparkles, Comedy: Zap, Luxury: Sparkles, Retro: Brush, Finance: Hash,
  Lifestyle: Heart, Editorial: Type, Readable: Type, Friendly: Heart,
  Reveal: Sparkles, Direction: ArrowRight, Spring: Zap, Char: Type, Soft: Coffee,
  Heavy: Cpu, Burst: Flame, Impact: Flame,
}

const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]'

interface Props {
  showToast?: (m: string, t: 'success' | 'info' | 'error') => void
  /** Optional: callback hooks if the editor wants to intercept (e.g. for analytics). */
  onApplyStyle?: (style: CaptionStyle) => void
  onApplyAnimation?: (anim: TextAnimation) => void
  onApplyMotion?: (motion: MotionPreset) => void
  onApplyFont?: (font: FontEntry) => void
  /** Editor segment store — passed by ModernVideoEditor to enable real apply. */
  textOverlays?: TextOverlay[]
  setTextOverlays?: (fn: (prev: TextOverlay[]) => TextOverlay[]) => void
  /** When set, applied changes target this overlay; otherwise a new overlay is created at the playhead. */
  selectedTextOverlayId?: string | null
  /** Used to compute new-overlay timing when no selection exists. */
  currentTime?: number
  videoDuration?: number
  /** When the user applies a motion preset, the editor can react (e.g. switch to timeline). */
  onMotionPresetApplied?: (motionId: MotionPreset['preview']) => void
  /** Style-profile telemetry — increments a counter so future sessions show this user's picks first. */
  recordStylePick?: (facet: 'fonts' | 'captionStyles' | 'animations' | 'motions', key: string) => void
  /** Returns a comparator that biases tile order toward the user's history. */
  styleBias?: <T extends { id?: string; name?: string }>(facet: 'fonts' | 'captionStyles' | 'animations' | 'motions') => (a: T, b: T) => number
}

// ── Translators ──────────────────────────────────────────────────────────────
// Map our preview-animation IDs to the TextOverlay union the renderer understands.

function toTextOverlayAnimationIn(p: TextAnimation['preview']): TextOverlayAnimationIn {
  switch (p) {
    case 'pop':         return 'pop'
    case 'fade-up':     return 'slide-bottom'
    case 'typewriter':  return 'typewriter'
    case 'wave':        return 'bounce'
    case 'glitch':      return 'pop'
    case 'slide':       return 'slide-left'
    case 'bounce':      return 'bounce'
    case 'zoom':        return 'zoom-in'
    case 'rotate':      return 'pop'
    case 'stretch':     return 'scale-in'
    case 'blur-in':     return 'blur-in'
    case 'shake':       return 'pop'
    case 'wipe':        return 'slide-left'
    case 'flip':        return 'flip-in'
    case 'reveal-up':   return 'slide-bottom'
    case 'split':       return 'pop'
    default:            return 'fade'
  }
}

// Animations that map cleanly to a "while visible" motion graphic preset.
// Returns null if the animation should only fire on enter.
function toMotionGraphicPreset(p: TextAnimation['preview']): MotionGraphicPreset | null {
  switch (p) {
    case 'shake':  return 'shake'
    case 'wave':   return 'wiggle'
    case 'glitch': return 'shake'
    case 'pop':    return 'pulse'
    default:       return null
  }
}

function toTextOverlayStyle(effect: CaptionStyle['effect']): TextOverlayStyle {
  switch (effect) {
    case 'glow':      return 'neon'
    case 'outline':   return 'outline'
    case 'highlight': return 'shadow'
    case 'pop':       return 'bold-kinetic'
    case 'none':      return 'minimal'
    default:          return 'none'
  }
}

// Solid-color extraction for `color`/`backgroundColor` fields. Gradients render
// via CSS in our preview but the renderer expects a plain color, so we sample
// the first stop or fall back to white.
function extractSolidColor(value: string | undefined, fallback = '#ffffff'): string {
  if (!value) return fallback
  if (value.startsWith('linear-gradient') || value.startsWith('radial-gradient')) {
    const m = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/)
    return m ? m[0] : fallback
  }
  return value
}

const TextMotionStudioView: React.FC<Props> = ({
  showToast,
  onApplyStyle,
  onApplyAnimation,
  onApplyMotion,
  onApplyFont,
  textOverlays = [],
  setTextOverlays,
  selectedTextOverlayId = null,
  currentTime = 0,
  videoDuration = 0,
  onMotionPresetApplied,
  recordStylePick,
  styleBias,
}) => {
  const [tab, setTab] = useState<Tab>('styles')
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState('All')

  // Resolve which overlay the user is targeting. Falls back to the most recent.
  const targetOverlay = useMemo(() => {
    if (!textOverlays.length) return null
    if (selectedTextOverlayId) return textOverlays.find(o => o.id === selectedTextOverlayId) || null
    return textOverlays[textOverlays.length - 1] || null
  }, [textOverlays, selectedTextOverlayId])

  // Mutate one overlay (or create a new one if none exist).
  const mutateOverlay = useCallback((mutator: (o: TextOverlay) => TextOverlay) => {
    if (!setTextOverlays) return false
    if (targetOverlay) {
      setTextOverlays(prev => prev.map(o => (o.id === targetOverlay.id ? mutator(o) : o)))
      return true
    }
    // No overlay exists — create one based on the mutated default.
    const safeEnd = Math.min(currentTime + 4, videoDuration > 0 ? videoDuration : currentTime + 4)
    const seed: TextOverlay = {
      id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: 'Your text here',
      x: 50,
      y: 80,
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      startTime: currentTime,
      endTime: safeEnd,
      style: 'none',
      animationIn: 'fade',
      animationOut: 'fade',
      animationInDuration: 0.4,
      animationOutDuration: 0.3,
      motionGraphic: 'none',
    }
    setTextOverlays(prev => [...prev, mutator(seed)])
    return true
  }, [setTextOverlays, targetOverlay, currentTime, videoDuration])

  const handleApplyStyle = useCallback((s: CaptionStyle) => {
    onApplyStyle?.(s)
    const ok = mutateOverlay(o => ({
      ...o,
      fontFamily: s.family,
      color: extractSolidColor(s.fill, '#ffffff'),
      style: toTextOverlayStyle(s.effect),
      backgroundColor: s.bg ? extractSolidColor(s.bg, undefined as any) : o.backgroundColor,
      shadowColor: s.shadow ? '#000000' : o.shadowColor,
      outlineColor: s.stroke ? extractSolidColor(s.stroke.replace(/^[^#rh]+/, ''), '#000000') : o.outlineColor,
      letterSpacing: s.tracking ? parseFloat(s.tracking) || o.letterSpacing : o.letterSpacing,
    }))
    showToast?.(ok ? `✓ Style applied: ${s.name}` : `Style: ${s.name} (no overlay yet)`, ok ? 'success' : 'info')
    recordStylePick?.('captionStyles', s.id)
  }, [mutateOverlay, onApplyStyle, showToast, recordStylePick])

  const handleApplyAnimation = useCallback((a: TextAnimation) => {
    onApplyAnimation?.(a)
    const motionPreset = toMotionGraphicPreset(a.preview)
    const ok = mutateOverlay(o => ({
      ...o,
      animationIn: toTextOverlayAnimationIn(a.preview),
      animationInDuration: 0.5,
      // For ambient/looping animations, also set the continuous motion graphic.
      ...(motionPreset && { motionGraphic: motionPreset }),
    }))
    showToast?.(ok ? `✓ Animation: ${a.name}` : `Animation: ${a.name} (no overlay yet)`, ok ? 'success' : 'info')
    recordStylePick?.('animations', a.id)
  }, [mutateOverlay, onApplyAnimation, showToast, recordStylePick])

  const handleApplyMotion = useCallback((m: MotionPreset) => {
    onApplyMotion?.(m)
    onMotionPresetApplied?.(m.preview)
    // Motion presets primarily target the video segment, not the overlay. We tag
    // the overlay too as a continuous motion graphic when the preset has one
    // that maps cleanly (shake/breathe/etc).
    const continuous: MotionGraphicPreset | null =
      m.preview === 'shake' || m.preview === 'glitch-shake' ? 'shake' :
      m.preview === 'breathe' ? 'breathe' :
      m.preview === 'zoom-pulse' ? 'pulse' :
      m.preview === 'wobble' ? 'wiggle' : null
    if (continuous) mutateOverlay(o => ({ ...o, motionGraphic: continuous }))
    showToast?.(`✓ Motion: ${m.name}`, 'success')
    recordStylePick?.('motions', m.id)
  }, [mutateOverlay, onApplyMotion, onMotionPresetApplied, showToast, recordStylePick])

  const handleApplyFont = useCallback((f: FontEntry) => {
    onApplyFont?.(f)
    const ok = mutateOverlay(o => ({ ...o, fontFamily: f.family }))
    showToast?.(ok ? `✓ Font: ${f.name}` : `Font: ${f.name} (no overlay yet)`, ok ? 'success' : 'info')
    recordStylePick?.('fonts', f.id || f.name)
  }, [mutateOverlay, onApplyFont, showToast, recordStylePick])

  const moods = useMemo(() => {
    const set = new Set<string>(['All'])
    if (tab === 'styles')      STYLES.forEach(s => set.add(s.mood))
    if (tab === 'animations')  ANIMATIONS.forEach(s => set.add(s.mood))
    if (tab === 'motion')      MOTIONS.forEach(s => set.add(s.mood))
    if (tab === 'fonts')       FONTS.forEach(s => set.add(s.mood))
    return Array.from(set)
  }, [tab])

  const visible = useMemo(() => {
    const q = search.toLowerCase()
    const filterFn = <T extends { name: string; mood: string }>(items: T[]) =>
      items.filter(i => (moodFilter === 'All' || i.mood === moodFilter) && (!q || i.name.toLowerCase().includes(q) || i.mood.toLowerCase().includes(q)))
    const biasFacet =
      tab === 'styles'     ? 'captionStyles' :
      tab === 'animations' ? 'animations' :
      tab === 'motion'     ? 'motions' :
      'fonts'
    const cmp = styleBias?.(biasFacet)
    const ordered = <T extends { name: string; mood: string; id?: string }>(arr: T[]): T[] =>
      cmp ? arr.slice().sort(cmp) : arr
    if (tab === 'styles')     return ordered(filterFn(STYLES))
    if (tab === 'animations') return ordered(filterFn(ANIMATIONS))
    if (tab === 'motion')     return ordered(filterFn(MOTIONS))
    return ordered(filterFn(FONTS))
  }, [tab, search, moodFilter, styleBias])

  const tabs: { id: Tab; label: string; icon: any; count: number; accent: string }[] = [
    { id: 'styles',     label: 'Caption Styles',  icon: Type,    count: STYLES.length,     accent: 'from-fuchsia-500 to-rose-500' },
    { id: 'animations', label: 'Text Animations', icon: Sparkles,count: ANIMATIONS.length, accent: 'from-amber-400 to-orange-500' },
    { id: 'motion',     label: 'Motion Presets',  icon: Wand2,   count: MOTIONS.length,    accent: 'from-cyan-500 to-blue-600' },
    { id: 'fonts',      label: 'Font Library',    icon: Bold,    count: FONTS.length,      accent: 'from-emerald-500 to-teal-600' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-[#0a0a14] via-[#0d0d18] to-[#080812] p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-400">Click · Text & Motion Studio</span>
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Text, type & motion</h2>
        <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
          {STYLES.length} caption styles · {ANIMATIONS.length} text animations · {MOTIONS.length} motion presets · {FONTS.length} fonts. Click any item to apply it to the selected segment.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setMoodFilter('All'); setSearch('') }}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-colors ${
                active
                  ? `bg-gradient-to-br ${t.accent} text-white border-transparent shadow-[0_8px_30px_rgba(0,0,0,0.4)]`
                  : 'bg-white/[0.02] text-slate-300 border-white/10 hover:bg-white/[0.05] hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[12px] font-bold tracking-tight">{t.label}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${active ? 'bg-black/20' : 'bg-white/5'}`}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + mood */}
      <div className={`${glassStyle} rounded-2xl p-3 flex flex-col md:flex-row gap-3`}>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tabs.find(t => t.id === tab)?.label.toLowerCase()}…`}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-10 py-2.5 text-[13px] font-medium text-white focus:outline-none focus:border-fuchsia-500/50 placeholder:text-slate-500"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} title="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {moods.slice(0, 8).map(m => {
            const Icon = MOOD_ICONS[m] || Type
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMoodFilter(m)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${
                  moodFilter === m
                    ? 'bg-fuchsia-600 text-white border-transparent'
                    : 'bg-white/[0.02] text-slate-300 border-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                {m !== 'All' && <Icon className="w-3 h-3" />}
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      {visible.length === 0 ? (
        <div className={`${glassStyle} rounded-2xl p-12 text-center`}>
          <Search className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-2xl font-black text-white mb-2">No matches</h3>
          <p className="text-[13px] text-slate-400 mb-5">Try a different search or mood.</p>
          <button type="button" onClick={() => { setSearch(''); setMoodFilter('All') }} className="px-6 py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] hover:text-white">Reset</button>
        </div>
      ) : (
        <>
          {tab === 'styles'     && <StyleGrid     items={visible as CaptionStyle[]}    onApply={handleApplyStyle} />}
          {tab === 'animations' && <AnimationGrid items={visible as TextAnimation[]}   onApply={handleApplyAnimation} />}
          {tab === 'motion'     && <MotionGrid    items={visible as MotionPreset[]}    onApply={handleApplyMotion} />}
          {tab === 'fonts'      && <FontGrid      items={visible as FontEntry[]}       onApply={handleApplyFont} />}
        </>
      )}

      {/* Footer note */}
      <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-4 flex items-start gap-3">
        <Layers className="w-4 h-4 text-fuchsia-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold text-fuchsia-300 leading-snug">Live-wired to the segment store.</p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Each tile mutates the selected text overlay&apos;s <code className="text-fuchsia-300">style / animationIn / motionGraphic / fontFamily</code>. With nothing selected, a new overlay is seeded at the current playhead.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Sub-grids ─────────────────────────────────────────────────────────────────
const StyleGrid: React.FC<{ items: CaptionStyle[]; onApply: (s: CaptionStyle) => void }> = ({ items, onApply }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(s => {
      const MoodIcon = MOOD_ICONS[s.mood] || Type
      return (
        <motion.button
          key={s.id}
          type="button"
          layout
          whileHover={{ y: -3 }}
          onClick={() => onApply(s)}
          className="rounded-2xl bg-black/40 border border-white/10 hover:border-fuchsia-500/40 transition-colors overflow-hidden text-left group"
        >
          {/* Live preview */}
          <div className="aspect-video bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.18),transparent_55%)] flex items-center justify-center p-5 relative overflow-hidden">
            <CaptionPreview style={s} />
          </div>
          <div className="px-4 py-3 flex items-center justify-between border-t border-white/5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white truncate">{s.name}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mt-0.5"><MoodIcon className="w-2.5 h-2.5" />{s.mood}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-fuchsia-600 text-white opacity-0 group-hover:opacity-100 transition-opacity">Apply</span>
          </div>
        </motion.button>
      )
    })}
  </div>
)

const CaptionPreview: React.FC<{ style: CaptionStyle }> = ({ style: s }) => {
  const styleObj: React.CSSProperties = {
    fontFamily: s.family,
    fontWeight: s.weight,
    fontStyle: s.italic ? 'italic' : 'normal',
    letterSpacing: s.tracking,
    textShadow: s.shadow,
    WebkitTextStroke: s.stroke,
    background: s.bg,
    padding: s.bgPad,
    color: s.fill?.startsWith('linear') ? 'transparent' : s.fill,
    backgroundImage: s.fill?.startsWith('linear') ? s.fill : s.bg && s.bg.startsWith('linear') ? s.bg : undefined,
    WebkitBackgroundClip: s.fill?.startsWith('linear') ? 'text' : undefined,
    backgroundClip: s.fill?.startsWith('linear') ? 'text' : undefined,
    borderRadius: s.bgPad ? 8 : 0,
    fontSize: s.weight >= 800 ? 22 : 18,
    lineHeight: 1.15,
    textAlign: 'center',
    maxWidth: '90%',
  }
  return <span style={styleObj}>{s.preview}</span>
}

const AnimationGrid: React.FC<{ items: TextAnimation[]; onApply: (a: TextAnimation) => void }> = ({ items, onApply }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    {items.map(a => {
      const MoodIcon = MOOD_ICONS[a.mood] || Sparkles
      return (
        <motion.button
          key={a.id}
          type="button"
          layout
          whileHover={{ y: -3 }}
          onClick={() => onApply(a)}
          className="rounded-2xl bg-black/40 border border-white/10 hover:border-amber-500/40 transition-colors overflow-hidden text-left group"
        >
          <div className="aspect-video bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.12),transparent_60%)] flex items-center justify-center p-4 overflow-hidden">
            <AnimationPreview kind={a.preview} />
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between border-t border-white/5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white truncate">{a.name}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mt-0.5"><MoodIcon className="w-2.5 h-2.5" />{a.tag}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">+</span>
          </div>
        </motion.button>
      )
    })}
  </div>
)

const AnimationPreview: React.FC<{ kind: TextAnimation['preview'] }> = ({ kind }) => {
  const sample = 'Click'
  const baseClass = 'text-2xl font-black text-white'
  switch (kind) {
    case 'fade-up':
      return <motion.span className={baseClass} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.6 }}>{sample}</motion.span>
    case 'pop':
      return <motion.span className={baseClass} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.45, type: 'spring', repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.6 }}>{sample}</motion.span>
    case 'typewriter':
      return (
        <span className={baseClass}>
          {sample.split('').map((c, i) => (
            <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.12, duration: 0.05, repeat: Infinity, repeatDelay: 1.2 }}>{c}</motion.span>
          ))}
          <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
        </span>
      )
    case 'wave':
      return (
        <span className={baseClass}>
          {sample.split('').map((c, i) => (
            <motion.span key={i} animate={{ y: [0, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }} style={{ display: 'inline-block' }}>{c}</motion.span>
          ))}
        </span>
      )
    case 'glitch':
      return <motion.span className={baseClass} animate={{ x: [0, 2, -2, 0], color: ['#fff', '#ec4899', '#06b6d4', '#fff'] }} transition={{ duration: 0.4, repeat: Infinity }}>{sample}</motion.span>
    case 'slide':
      return <motion.span className={baseClass} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.6 }}>{sample}</motion.span>
    case 'bounce':
      return <motion.span className={baseClass} animate={{ y: [0, -16, 0, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}>{sample}</motion.span>
    case 'zoom':
      return <motion.span className={baseClass} animate={{ scale: [0.9, 1.4, 0.9] }} transition={{ duration: 0.9, repeat: Infinity }}>{sample}</motion.span>
    case 'rotate':
      return <motion.span className={baseClass} animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 1.2, repeat: Infinity }}>{sample}</motion.span>
    case 'stretch':
      return <motion.span className={baseClass} animate={{ scaleX: [1, 1.4, 1], scaleY: [1, 0.7, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>{sample}</motion.span>
    case 'blur-in':
      return <motion.span className={baseClass} animate={{ filter: ['blur(8px)', 'blur(0px)', 'blur(8px)'], opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>{sample}</motion.span>
    case 'shake':
      return <motion.span className={baseClass} animate={{ x: [-2, 2, -2, 2, 0] }} transition={{ duration: 0.4, repeat: Infinity }}>{sample}</motion.span>
    case 'wipe':
      return <motion.span className={`${baseClass} overflow-hidden inline-block`} initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 0.7, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.4 }}>{sample}</motion.span>
    case 'flip':
      return <motion.span className={`${baseClass} inline-block`} animate={{ rotateY: [0, 180, 360] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ transformStyle: 'preserve-3d' }}>{sample}</motion.span>
    case 'reveal-up':
      return <span className={baseClass} style={{ display: 'inline-block', overflow: 'hidden' }}><motion.span style={{ display: 'inline-block' }} initial={{ y: 30 }} animate={{ y: 0 }} transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.4 }}>{sample}</motion.span></span>
    case 'split':
      return (
        <span className={baseClass}>
          {sample.split('').map((c, i) => (
            <motion.span key={i} animate={{ y: i % 2 === 0 ? [0, -8, 0] : [0, 8, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.05 }} style={{ display: 'inline-block' }}>{c}</motion.span>
          ))}
        </span>
      )
    default:
      return <span className={baseClass}>{sample}</span>
  }
}

const MotionGrid: React.FC<{ items: MotionPreset[]; onApply: (m: MotionPreset) => void }> = ({ items, onApply }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    {items.map(m => {
      const MoodIcon = MOOD_ICONS[m.mood] || Wand2
      return (
        <motion.button
          key={m.id}
          type="button"
          layout
          whileHover={{ y: -3 }}
          onClick={() => onApply(m)}
          className="rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-500/40 transition-colors overflow-hidden text-left group"
        >
          <div className="aspect-video bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.12),transparent_60%)] relative overflow-hidden">
            <MotionPreview kind={m.preview} />
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between border-t border-white/5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-white truncate">{m.name}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mt-0.5"><MoodIcon className="w-2.5 h-2.5" />{m.tag}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">+</span>
          </div>
        </motion.button>
      )
    })}
  </div>
)

const MotionPreview: React.FC<{ kind: MotionPreset['preview'] }> = ({ kind }) => {
  const block = (
    <div className="absolute inset-3 rounded-lg bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center">
      <Pin className="w-6 h-6 text-white/80" />
    </div>
  )
  switch (kind) {
    case 'ken-burns':
      return <motion.div animate={{ scale: [1, 1.15, 1], x: [-4, 4, -4], y: [-2, 2, -2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0">{block}</motion.div>
    case 'parallax':
      return (
        <>
          <motion.div animate={{ x: [-10, 10, -10] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 opacity-50">{block}</motion.div>
          <motion.div animate={{ x: [10, -10, 10] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
        </>
      )
    case 'shake':
      return <motion.div animate={{ x: [-3, 3, -3, 3, 0], y: [-2, 2, 0] }} transition={{ duration: 0.4, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'zoom-pulse':
      return <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'tilt':
      return <motion.div animate={{ rotate: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'pan-left':
      return <motion.div animate={{ x: [40, -40, 40] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'pan-right':
      return <motion.div animate={{ x: [-40, 40, -40] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'orbit':
      return <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute inset-0">{block}</motion.div>
    case 'wobble':
      return <motion.div animate={{ rotate: [-6, 6, -6], scale: [1, 1.05, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'breathe':
      return <motion.div animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'dolly-zoom':
      return <motion.div animate={{ scale: [1, 1.5, 1], filter: ['blur(0px)', 'blur(2px)', 'blur(0px)'] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    case 'glitch-shake':
      return <motion.div animate={{ x: [0, -4, 4, -2, 0], filter: ['none', 'hue-rotate(60deg)', 'none'] }} transition={{ duration: 0.6, repeat: Infinity }} className="absolute inset-0">{block}</motion.div>
    default:
      return <div className="absolute inset-0">{block}</div>
  }
}

const FontGrid: React.FC<{ items: FontEntry[]; onApply: (f: FontEntry) => void }> = ({ items, onApply }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    {items.map(f => {
      const MoodIcon = MOOD_ICONS[f.mood] || Type
      return (
        <motion.button
          key={f.id}
          type="button"
          layout
          whileHover={{ y: -3 }}
          onClick={() => onApply(f)}
          className="rounded-2xl bg-black/40 border border-white/10 hover:border-emerald-500/40 transition-colors p-5 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5"><MoodIcon className="w-3 h-3" />{f.mood}</span>
            <span className="text-[9px] font-mono text-slate-500">{f.weights.join(' · ')}</span>
          </div>
          <p className="text-3xl text-white mb-2 leading-tight" style={{ fontFamily: f.family, fontWeight: f.weights[Math.floor(f.weights.length / 2)] }}>{f.name}</p>
          <p className="text-[12px] text-slate-400 mb-3 leading-relaxed" style={{ fontFamily: f.family }}>The quick brown fox jumps over the lazy dog.</p>
          <div className="flex flex-wrap gap-1.5">
            {f.bestFor.map(b => (
              <span key={b} className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">{b}</span>
            ))}
          </div>
        </motion.button>
      )
    })}
  </div>
)

export default TextMotionStudioView
