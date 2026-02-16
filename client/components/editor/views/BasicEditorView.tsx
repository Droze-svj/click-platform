'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Type,
  Edit3,
  Music,
  Scissors,
  Palette,
  Sparkles,
  Download,
  Cpu,
  Film,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Save,
  Search,
  Undo2,
  Trash2,
  Pin,
  Image as ImageIcon,
} from 'lucide-react'
import { VideoFilter, TextOverlay, TemplateLayout, TEMPLATE_LAYOUTS, ShapeOverlay, ShapeOverlayKind, MOTION_GRAPHIC_TEMPLATES, MotionGraphicTemplate, ImageOverlay, GradientOverlay, GradientOverlayDirection } from '../../../types/editor'

/** Snapshot for undo: layout + filters + text overlays */
type UndoSnapshot = {
  layout: TemplateLayout
  filters: VideoFilter
  textOverlays: TextOverlay[]
}

type TextOverlayStyle = 'none' | 'neon' | 'minimal' | 'bold-kinetic' | 'outline' | 'shadow'

const MANUAL_EDIT_STORAGE_KEYS = {
  recentFilters: 'manual-edit-recent-filters',
  recentStyles: 'manual-edit-recent-styles',
  recentMotionTemplates: 'manual-edit-recent-motion-templates',
  customStyles: 'manual-edit-custom-styles',
  lastCustomText: 'manual-edit-last-custom-text',
  pinnedFilters: 'manual-edit-pinned-filters',
}

interface BasicEditorViewProps {
  videoFilters: VideoFilter
  setVideoFilters: (v: any) => void
  setColorGradeSettings: (v: any) => void
  textOverlays?: TextOverlay[]
  setTextOverlays: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  setActiveCategory?: (category: import('../../../types/editor').EditorCategory) => void
  templateLayout?: TemplateLayout
  setTemplateLayout?: (t: TemplateLayout) => void
  videoState?: { currentTime: number; duration: number }
  filterStrength?: number
  setFilterStrength?: (v: number) => void
  showBeforeAfter?: boolean
  setShowBeforeAfter?: (v: boolean) => void
  compareMode?: 'after' | 'before' | 'split'
  setCompareMode?: (v: 'after' | 'before' | 'split') => void
  shapeOverlays?: ShapeOverlay[]
  setShapeOverlays?: (v: ShapeOverlay[] | ((prev: ShapeOverlay[]) => ShapeOverlay[])) => void
  imageOverlays?: ImageOverlay[]
  setImageOverlays?: (v: ImageOverlay[] | ((prev: ImageOverlay[]) => ImageOverlay[])) => void
  gradientOverlays?: GradientOverlay[]
  setGradientOverlays?: (v: GradientOverlay[] | ((prev: GradientOverlay[]) => GradientOverlay[])) => void
}

/** Preset-specific placement: x/y % (0–100), fontSize, style. Vertical layout uses lower default y. */
interface TextPresetConfig {
  label: string
  text: string
  x?: number
  y?: number
  fontSize?: number
  style?: TextOverlayStyle
  fontFamily?: string
}

const TEXT_PRESETS: TextPresetConfig[] = [
  { label: 'Title', text: 'Your Title Here', x: 50, y: 12, fontSize: 36, style: 'shadow' },
  { label: 'Subscribe', text: 'Subscribe for more', x: 50, y: 88, fontSize: 28, style: 'neon' },
  { label: 'Like & Subscribe', text: 'Like & Subscribe', x: 50, y: 85, fontSize: 26, style: 'shadow' },
  { label: 'Watch more', text: 'Watch more →', x: 50, y: 90, fontSize: 24, style: 'minimal' },
  { label: 'Comment', text: 'Comment below', x: 50, y: 92, fontSize: 22, style: 'minimal' },
  { label: 'Link in bio', text: 'Link in bio', x: 82, y: 94, fontSize: 20, style: 'outline' },
  { label: 'Caption', text: 'Add your caption', x: 50, y: 78, fontSize: 24, style: 'none' },
  { label: 'Follow', text: 'Follow for more', x: 50, y: 86, fontSize: 26, style: 'bold-kinetic' },
  { label: 'Custom', text: 'NEW TEXT', x: 50, y: 50, fontSize: 32, style: 'none' },
  { label: 'Hook', text: 'YOU NEED TO SEE THIS', x: 50, y: 18, fontSize: 40, style: 'bold-kinetic' },
  { label: 'Lower third', text: 'Name · Title', x: 5, y: 85, fontSize: 22, style: 'shadow' },
  { label: 'Callout', text: 'PRO TIP', x: 50, y: 25, fontSize: 28, style: 'neon' },
  { label: 'CTA', text: 'TAP TO LEARN MORE', x: 50, y: 92, fontSize: 24, style: 'outline' },
  { label: 'Timestamp', text: '0:00', x: 5, y: 5, fontSize: 18, style: 'minimal' },
]

/** Viral / Hook overlays - high-retention text templates */
const VIRAL_HOOK_PRESETS: TextPresetConfig[] = [
  { label: 'Wait for it', text: 'WAIT FOR IT...', x: 50, y: 15, fontSize: 38, style: 'bold-kinetic' },
  { label: 'POV', text: 'POV:', x: 10, y: 12, fontSize: 32, style: 'neon' },
  { label: 'Story time', text: 'STORY TIME', x: 50, y: 18, fontSize: 36, style: 'shadow' },
  { label: "You won't believe", text: "You won't believe what happened", x: 50, y: 20, fontSize: 28, style: 'bold-kinetic' },
  { label: 'Day in my life', text: 'Day in my life', x: 50, y: 12, fontSize: 30, style: 'minimal' },
  { label: 'Day X of', text: 'Day 1 of...', x: 50, y: 15, fontSize: 34, style: 'outline' },
  { label: 'Get ready', text: 'Get ready for this', x: 50, y: 20, fontSize: 30, style: 'neon' },
  { label: 'Watch till end', text: 'Watch till the end', x: 50, y: 88, fontSize: 24, style: 'shadow' },
  { label: 'No one talks about', text: 'No one talks about this', x: 50, y: 22, fontSize: 26, style: 'bold-kinetic' },
  { label: 'The secret', text: 'The secret they don\'t want you to know', x: 50, y: 50, fontSize: 24, style: 'outline' },
]

/** Reaction / callout overlays - arrows, highlights, emphasis */
const REACTION_CALLOUT_PRESETS: TextPresetConfig[] = [
  { label: 'Arrow →', text: '→', x: 75, y: 50, fontSize: 48, style: 'neon' },
  { label: 'Arrow ←', text: '←', x: 25, y: 50, fontSize: 48, style: 'neon' },
  { label: '!', text: '!', x: 85, y: 25, fontSize: 56, style: 'bold-kinetic' },
  { label: '?', text: '?', x: 85, y: 25, fontSize: 56, style: 'bold-kinetic' },
  { label: '★', text: '★', x: 90, y: 15, fontSize: 36, style: 'neon' },
  { label: 'PRO TIP', text: 'PRO TIP', x: 50, y: 22, fontSize: 28, style: 'neon' },
  { label: 'WATCH', text: 'WATCH', x: 50, y: 30, fontSize: 32, style: 'outline' },
  { label: 'HERE', text: 'HERE', x: 50, y: 55, fontSize: 24, style: 'shadow' },
]

/** End screen / CTA templates - add at video end */
const END_SCREEN_TEMPLATES: TextPresetConfig[] = [
  { label: 'Subscribe', text: 'Subscribe for more', x: 50, y: 50, fontSize: 32, style: 'neon' },
  { label: 'Follow', text: 'Follow for more', x: 50, y: 50, fontSize: 32, style: 'shadow' },
  { label: 'Link in bio', text: 'Link in bio', x: 50, y: 55, fontSize: 28, style: 'outline' },
  { label: 'Swipe up', text: 'Swipe up', x: 50, y: 85, fontSize: 26, style: 'bold-kinetic' },
  { label: 'Like & Subscribe', text: 'Like & Subscribe', x: 50, y: 50, fontSize: 30, style: 'shadow' },
  { label: 'Comment below', text: 'Comment below', x: 50, y: 60, fontSize: 26, style: 'minimal' },
  { label: 'Tap to learn more', text: 'TAP TO LEARN MORE', x: 50, y: 55, fontSize: 28, style: 'outline' },
  { label: 'See you next time', text: 'See you next time', x: 50, y: 50, fontSize: 30, style: 'minimal' },
]

const FILTER_PRESETS = [
  { n: 'Vibrant', f: { saturation: 150, contrast: 110 }, desc: 'Punchy colors', swatch: 'from-amber-400 via-orange-400 to-rose-500' },
  { n: 'Mono', f: { saturation: 0, contrast: 120 }, desc: 'B&W', swatch: 'from-gray-300 via-gray-500 to-gray-700' },
  { n: 'Cinematic', f: { sepia: 20, vignette: 30 }, desc: 'Film look', swatch: 'from-amber-800/80 via-amber-900/60 to-slate-900' },
  { n: 'Warm', f: { saturation: 110, temperature: 115 }, desc: 'Golden hour', swatch: 'from-orange-300 via-amber-400 to-yellow-500' },
  { n: 'Cool', f: { saturation: 105, temperature: 85, tint: 5 }, desc: 'Blue tones', swatch: 'from-cyan-300 via-blue-400 to-indigo-500' },
  { n: 'Vintage', f: { sepia: 35, saturation: 80, contrast: 110 }, desc: 'Retro', swatch: 'from-amber-700/90 via-yellow-800/70 to-stone-800' },
  { n: 'Moody', f: { contrast: 115, saturation: 90, vignette: 40 }, desc: 'Dark & rich', swatch: 'from-slate-700 via-slate-800 to-black' },
  { n: 'Vivid', f: { saturation: 165, contrast: 108, vibrance: 120 }, desc: 'High pop', swatch: 'from-pink-400 via-fuchsia-400 to-violet-500' },
  { n: 'Noir', f: { saturation: 0, contrast: 130, vignette: 50 }, desc: 'High contrast B&W', swatch: 'from-gray-200 via-gray-600 to-black' },
  { n: 'Sunset', f: { saturation: 120, temperature: 125, vibrance: 115, shadows: 15 }, desc: 'Golden hour', swatch: 'from-orange-500 via-rose-500 to-amber-700' },
  { n: 'Breeze', f: { saturation: 95, temperature: 90, tint: 8, clarity: 110 }, desc: 'Cool & crisp', swatch: 'from-sky-200 via-cyan-300 to-teal-400' },
  { n: 'Matte', f: { contrast: 95, saturation: 90, shadows: 25 }, desc: 'Flat & soft', swatch: 'from-neutral-300 via-neutral-400 to-neutral-500' },
  { n: 'Neon', f: { saturation: 140, contrast: 115, vibrance: 130, hue: -15 }, desc: 'Pop colors', swatch: 'from-lime-400 via-cyan-400 to-fuchsia-400' },
  { n: 'Autumn', f: { saturation: 115, temperature: 118, sepia: 8, vignette: 15 }, desc: 'Warm earth', swatch: 'from-amber-600 via-orange-600 to-rose-700' },
  { n: 'Winter', f: { saturation: 95, temperature: 82, tint: 10, clarity: 112 }, desc: 'Cool & clean', swatch: 'from-slate-200 via-blue-200 to-cyan-200' },
  { n: 'Dreamy', f: { saturation: 85, contrast: 92, vibrance: 105, vignette: 35 }, desc: 'Soft pastel', swatch: 'from-rose-200 via-pink-200 to-violet-200' },
  { n: 'Reset', f: { saturation: 100, contrast: 100, sepia: 0, vignette: 0, temperature: 100, tint: 0, vibrance: 100 }, desc: 'Default', swatch: 'from-gray-400 to-gray-600' },
]

/** Style bundles: full look = layout + filter. Cohesive styles for different content types. */
const STYLE_BUNDLES = [
  { id: 'creator-bold', label: 'Creator Bold', layout: 'vertical' as TemplateLayout, filter: { saturation: 130, contrast: 115, sharpen: 22, vibrance: 118 }, desc: 'High-energy viral', swatch: 'from-fuchsia-500 to-orange-500' },
  { id: 'soft-aesthetic', label: 'Soft Aesthetic', layout: 'portrait' as TemplateLayout, filter: { saturation: 88, contrast: 95, temperature: 112, vignette: 25 }, desc: 'Gentle & dreamy', swatch: 'from-rose-300 to-amber-200' },
  { id: 'corporate-minimal', label: 'Corporate Minimal', layout: 'standard' as TemplateLayout, filter: { saturation: 98, contrast: 105, sharpen: 12, clarity: 10 }, desc: 'Clean & pro', swatch: 'from-slate-400 to-slate-600' },
  { id: 'dark-moody', label: 'Dark Moody', layout: 'standard' as TemplateLayout, filter: { brightness: 92, contrast: 122, saturation: 85, vignette: 45 }, desc: 'Dramatic shadows', swatch: 'from-indigo-900 to-slate-900' },
  { id: 'vibrant-pop', label: 'Vibrant Pop', layout: 'square' as TemplateLayout, filter: { saturation: 150, contrast: 108, vibrance: 130, temperature: 108 }, desc: 'Colorful & punchy', swatch: 'from-cyan-400 via-pink-400 to-yellow-400' },
  { id: 'cinematic-film', label: 'Cinematic Film', layout: 'cinematic' as TemplateLayout, filter: { sepia: 15, contrast: 112, saturation: 95, vignette: 35 }, desc: 'Movie trailer', swatch: 'from-amber-800/80 to-slate-800' },
  { id: 'noir-dramatic', label: 'Noir Dramatic', layout: 'classic' as TemplateLayout, filter: { saturation: 0, contrast: 135, vignette: 50, brightness: 88 }, desc: 'B&W dramatic', swatch: 'from-gray-800 to-black' },
  { id: 'lifestyle-warm', label: 'Lifestyle Warm', layout: 'vertical' as TemplateLayout, filter: { saturation: 115, temperature: 118, vibrance: 112, clarity: 8 }, desc: 'Vlog & travel', swatch: 'from-orange-300 to-amber-400' },
  { id: 'podcast-pro', label: 'Podcast Pro', layout: 'square' as TemplateLayout, filter: { saturation: 95, contrast: 108, sharpen: 15, clarity: 12 }, desc: 'Clean & professional', swatch: 'from-slate-500 to-slate-700' },
  { id: 'documentary', label: 'Documentary', layout: 'standard' as TemplateLayout, filter: { sepia: 12, contrast: 110, saturation: 92, vignette: 28 }, desc: 'Natural & immersive', swatch: 'from-stone-600 to-amber-900/50' },
  { id: 'fashion-editorial', label: 'Fashion Editorial', layout: 'portrait' as TemplateLayout, filter: { contrast: 115, saturation: 105, shadows: 20, clarity: 15 }, desc: 'High-fashion look', swatch: 'from-neutral-200 via-pink-100 to-amber-100' },
  { id: 'retro-warm', label: 'Retro Warm', layout: 'classic' as TemplateLayout, filter: { sepia: 28, saturation: 85, temperature: 115, vignette: 30, noise: 6 }, desc: 'Vintage warmth', swatch: 'from-amber-700/90 via-yellow-700/70 to-stone-800' },
  { id: 'cinematic-drama', label: 'Cinematic Drama', layout: 'cinematic' as TemplateLayout, filter: { contrast: 125, saturation: 90, brightness: 88, vignette: 42, shadows: 18 }, desc: 'Deep & dramatic', swatch: 'from-slate-800 via-indigo-900 to-black' },
  { id: 'comedy-bright', label: 'Comedy Bright', layout: 'square' as TemplateLayout, filter: { brightness: 108, saturation: 130, contrast: 110, vibrance: 122, sharpen: 22 }, desc: 'Punchy & fun', swatch: 'from-yellow-400 via-orange-400 to-pink-400' },
  { id: 'sports-dynamic', label: 'Sports Dynamic', layout: 'vertical' as TemplateLayout, filter: { contrast: 118, saturation: 118, sharpen: 32, clarity: 20, vibrance: 112 }, desc: 'Action-ready', swatch: 'from-red-500 via-amber-500 to-cyan-500' },
]

/** Platform bundles: layout + filter + quick-start for social formats */
const PLATFORM_BUNDLES = [
  { id: 'tiktok', label: 'TikTok / Reels', layout: 'vertical' as TemplateLayout, filter: { saturation: 120, contrast: 108 }, desc: '9:16, punchy' },
  { id: 'youtube', label: 'YouTube Shorts', layout: 'vertical' as TemplateLayout, filter: { saturation: 110, contrast: 105 }, desc: '9:16, balanced' },
  { id: 'feed', label: 'Instagram Feed', layout: 'square' as TemplateLayout, filter: { saturation: 115, vibrance: 110 }, desc: '1:1, vibrant' },
  { id: 'portrait', label: 'Instagram Portrait', layout: 'portrait' as TemplateLayout, filter: { saturation: 112, vibrance: 108, temperature: 108 }, desc: '4:5, warm' },
  { id: 'landscape', label: 'YouTube / Landscape', layout: 'standard' as TemplateLayout, filter: { saturation: 100, contrast: 102 }, desc: '16:9, clean' },
  { id: 'linkedin', label: 'LinkedIn', layout: 'standard' as TemplateLayout, filter: { saturation: 102, contrast: 108, sharpen: 12, clarity: 8 }, desc: '16:9, pro' },
]

const QUICK_NAV = [
  { id: 'short-clips' as const, label: 'Short Clips', icon: Film, color: 'from-rose-500 to-pink-500' },
  { id: 'assets' as const, label: 'Music & B-Roll', icon: Music, color: 'from-indigo-500 to-purple-500' },
  { id: 'timeline' as const, label: 'Timeline', icon: Scissors, color: 'from-amber-500 to-orange-500' },
  { id: 'effects' as const, label: 'Effects', icon: Sparkles, color: 'from-violet-500 to-fuchsia-500' },
  { id: 'color' as const, label: 'Color', icon: Palette, color: 'from-pink-500 to-rose-500' },
  { id: 'ai-edit' as const, label: 'Transcribe & AI', icon: Cpu, color: 'from-fuchsia-500 to-purple-500' },
  { id: 'export' as const, label: 'Export', icon: Download, color: 'from-emerald-500 to-teal-500' },
]

/** Layout-aware y offset: vertical/portrait layouts use slightly higher y so overlays sit above typical thumb zone. */
function layoutAwareY(
  presetY: number,
  layout: TemplateLayout
): number {
  if (layout === 'vertical' || layout === 'portrait') return Math.max(10, Math.min(90, presetY - 4))
  if (layout === 'square') return presetY
  return presetY
}

function addOverlay(
  setTextOverlays: (fn: (prev: TextOverlay[]) => TextOverlay[]) => void,
  input: string | TextPresetConfig,
  showToast: (m: string, t: 'success' | 'info' | 'error') => void,
  templateLayout: TemplateLayout = 'standard',
  startTime: number = 0,
  endTime: number = 5
) {
  const isConfig = typeof input === 'object'
  const text = isConfig ? input.text : input
  const x = (isConfig && input.x != null) ? input.x : 50
  const y = isConfig ? layoutAwareY(input.y ?? 50, templateLayout) : 50
  const fontSize = (isConfig && input.fontSize != null) ? input.fontSize : 32
  const style = (isConfig && input.style) ? input.style : 'none'
  const fontFamily = (isConfig && input.fontFamily) ? input.fontFamily : 'Inter, system-ui, sans-serif'

  setTextOverlays((prev) => [
    ...prev,
    {
      id: Date.now().toString(),
      text,
      x,
      y,
      fontSize,
      color: '#ffffff',
      fontFamily,
      startTime,
      endTime,
      style,
    },
  ])
  showToast('Text overlay added', 'success')
}

/** Filter categories for grouped display */
const FILTER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'mood', label: 'Mood' },
  { id: 'creative', label: 'Creative' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'neutral', label: 'Reset' },
] as const

const FILTER_PRESETS_WITH_CATEGORY = FILTER_PRESETS.map((p) => {
  let cat: 'mood' | 'creative' | 'dramatic' | 'neutral' = 'mood'
  if (p.n === 'Reset') cat = 'neutral'
  else if (['Mono', 'Noir', 'Moody'].includes(p.n)) cat = 'dramatic'
  else if (['Vibrant', 'Vivid', 'Neon', 'Sunset', 'Autumn', 'Dreamy'].includes(p.n)) cat = 'creative'
  return { ...p, category: cat }
})

const BasicEditorView: React.FC<BasicEditorViewProps> = ({
  videoFilters,
  setVideoFilters,
  setColorGradeSettings,
  textOverlays = [],
  setTextOverlays,
  showToast,
  setActiveCategory,
  templateLayout = 'standard',
  setTemplateLayout,
  videoState,
  filterStrength = 100,
  setFilterStrength,
  compareMode = 'after',
  setCompareMode,
  shapeOverlays = [],
  setShapeOverlays,
  imageOverlays = [],
  setImageOverlays,
  gradientOverlays = [],
  setGradientOverlays,
}) => {
  const currentTime = videoState?.currentTime ?? 0
  const duration = videoState?.duration ?? 60
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ platform: true, styleBundles: false, quickFilters: true, text: false, quickNav: false, currentOverlays: false })

  const addShape = useCallback((kind: ShapeOverlayKind) => {
    if (!setShapeOverlays) return
    const startTime = currentTime
    const endTime = Math.min(currentTime + 5, duration)
    setShapeOverlays((prev) => [
      ...prev,
      {
        id: `shape-${Date.now()}`,
        kind,
        x: 50,
        y: 50,
        width: kind === 'line' ? 40 : 20,
        height: kind === 'line' ? 2 : 20,
        color: '#ffffff',
        opacity: 0.3,
        startTime,
        endTime,
        strokeWidth: kind === 'line' ? 4 : undefined,
      },
    ])
    showToast(`${kind === 'rect' ? 'Rectangle' : kind === 'circle' ? 'Circle' : 'Line'} added`, 'success')
  }, [currentTime, duration, setShapeOverlays, showToast])

  const [motionGraphicDuration, setMotionGraphicDuration] = useState(5)
  const [recentMotionTemplateIds, setRecentMotionTemplateIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.recentMotionTemplates) || '[]') } catch { return [] }
  })
  const [motionTemplateSearch, setMotionTemplateSearch] = useState('')

  const applyMotionGraphicTemplate = useCallback((template: MotionGraphicTemplate) => {
    const defaultDuration = motionGraphicDuration
    const baseStart = currentTime
    const newTextOverlays: TextOverlay[] = (template.textOverlays || []).map((c) => {
      const start = baseStart + (c.startOffset ?? 0)
      const dur = c.duration ?? defaultDuration
      return {
        id: `mg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: c.text,
        x: c.x,
        y: layoutAwareY(c.y, templateLayout),
        fontSize: c.fontSize,
        color: c.color,
        fontFamily: c.fontFamily,
        startTime: start,
        endTime: start + dur,
        style: c.style,
        animationIn: c.animationIn,
        animationOut: c.animationOut,
        animationInDuration: c.animationInDuration,
        animationOutDuration: c.animationOutDuration,
        motionGraphic: c.motionGraphic,
        backgroundColor: c.backgroundColor,
        outlineColor: c.outlineColor,
      }
    })
    const newShapeOverlays: ShapeOverlay[] = (template.shapeOverlays || []).map((s) => {
      const start = baseStart + (s.startOffset ?? 0)
      const dur = s.duration ?? defaultDuration
      return {
        id: `mg-shape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        kind: s.kind,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        color: s.color,
        opacity: s.opacity,
        startTime: start,
        endTime: start + dur,
        strokeWidth: s.strokeWidth,
        motionGraphic: s.motionGraphic,
      }
    })
    setTextOverlays((prev: TextOverlay[]) => [...prev, ...newTextOverlays])
    if (setShapeOverlays && newShapeOverlays.length > 0) setShapeOverlays((prev: ShapeOverlay[]) => [...prev, ...newShapeOverlays])
    setOpenSections((prev: Record<string, boolean>) => ({ ...prev, currentOverlays: true }))
    try {
      const key = MANUAL_EDIT_STORAGE_KEYS.recentMotionTemplates
      const prev = JSON.parse(localStorage.getItem(key) || '[]') as string[]
      const next = [template.id, ...prev.filter((id) => id !== template.id)].slice(0, 5)
      localStorage.setItem(key, JSON.stringify(next))
      setRecentMotionTemplateIds(next)
    } catch { /* ignore */ }
    showToast(`Added "${template.name}" at ${baseStart.toFixed(1)}s`, 'success')
  }, [currentTime, templateLayout, motionGraphicDuration, setTextOverlays, setShapeOverlays, setOpenSections, showToast])

  const [imageUrlInput, setImageUrlInput] = useState('')
  const addImageOverlay = useCallback(() => {
    if (!setImageOverlays) return
    const url = imageUrlInput.trim()
    if (!url) { showToast('Enter an image URL', 'error'); return }
    const start = currentTime
    const end = Math.min(currentTime + 5, duration)
    setImageOverlays((prev) => [
      ...prev,
      {
        id: `img-${Date.now()}`,
        url,
        x: 50,
        y: 50,
        width: 15,
        height: 15,
        startTime: start,
        endTime: end,
        opacity: 1,
        animationIn: 'fade',
        animationOut: 'fade',
      },
    ])
    setImageUrlInput('')
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    showToast('Image overlay added', 'success')
  }, [imageUrlInput, currentTime, duration, setImageOverlays, setOpenSections, showToast])

  const GRADIENT_PRESETS: { id: string; name: string; overlay: Omit<GradientOverlay, 'id' | 'startTime' | 'endTime'> }[] = [
    { id: 'lower-third', name: 'Lower third fade', overlay: { direction: 'bottom-to-top', colorStops: ['transparent', 'rgba(0,0,0,0.85)'], opacity: 1, region: 'lower-third' } },
    { id: 'full-dark', name: 'Full darken', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)'], opacity: 1, region: 'full' } },
    { id: 'top-bar', name: 'Top bar', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.6)', 'transparent'], opacity: 1, region: 'top-bar' } },
  ]
  const addGradientOverlay = useCallback((preset: typeof GRADIENT_PRESETS[0]) => {
    if (!setGradientOverlays) return
    const start = currentTime
    const end = Math.min(currentTime + 10, duration)
    setGradientOverlays((prev) => [
      ...prev,
      { id: `grad-${Date.now()}`, ...preset.overlay, startTime: start, endTime: end },
    ])
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    showToast(`Added ${preset.name}`, 'success')
  }, [currentTime, duration, setGradientOverlays, setOpenSections, showToast])

  const cycleCompareMode = useCallback(() => {
    if (!setCompareMode) return
    setCompareMode(compareMode === 'after' ? 'before' : compareMode === 'before' ? 'split' : 'after')
  }, [compareMode, setCompareMode])
  const customTextInputRef = useRef<HTMLInputElement>(null)
  const [textCustom, setTextCustom] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [textPresetSearch, setTextPresetSearch] = useState('')
  const [textDuration, setTextDuration] = useState<number>(5)
  const [customStyleName, setCustomStyleName] = useState('')
  const [showSaveStyle, setShowSaveStyle] = useState(false)

  const MAX_UNDO = 50
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])
  const isUndoRestore = useRef(false)

  const pushSnapshot = useCallback((layout: TemplateLayout, filters: VideoFilter, overlays: TextOverlay[]) => {
    if (isUndoRestore.current) return
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), { layout, filters: { ...filters }, textOverlays: overlays.map((o) => ({ ...o })) }])
  }, [])
  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    isUndoRestore.current = true
    setTemplateLayout?.(last.layout)
    setVideoFilters(last.filters)
    setTextOverlays(last.textOverlays)
    setUndoStack((prev) => prev.slice(0, -1))
    showToast('Undo applied', 'info')
    setTimeout(() => { isUndoRestore.current = false }, 0)
  }, [undoStack, setTemplateLayout, setVideoFilters, setTextOverlays, showToast])

  const [pinnedFilterNames, setPinnedFilterNames] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.pinnedFilters) || '[]') } catch { return [] }
  })
  const togglePinFilter = useCallback((name: string) => {
    setPinnedFilterNames((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(-3)
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.pinnedFilters, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  const pinnedPresets = useMemo(() => pinnedFilterNames.map((n) => FILTER_PRESETS.find((p) => p.n === n)).filter(Boolean) as typeof FILTER_PRESETS, [pinnedFilterNames])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setOpenSections((prev) => ({ ...prev, text: true }))
        setTimeout(() => customTextInputRef.current?.focus(), 100)
        showToast('Add text — type and press Add or Ctrl+Enter', 'info')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showToast])

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])
  const expandAll = useCallback(() => setOpenSections({ platform: true, styleBundles: true, quickFilters: true, text: true, quickNav: true, currentOverlays: true }), [])
  const collapseAll = useCallback(() => setOpenSections({ platform: false, styleBundles: false, quickFilters: false, text: false, quickNav: false, currentOverlays: false }), [])

  const [recentFilterNames, setRecentFilterNames] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.recentFilters) || '[]') } catch { return [] }
  })
  const [recentStyleIds, setRecentStyleIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.recentStyles) || '[]') } catch { return [] }
  })
  const [customStyleBundles, setCustomStyleBundles] = useState<Array<{ id: string; name: string; layout: TemplateLayout; filter: Record<string, number>; swatch: string }>>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.customStyles) || '[]') } catch { return [] }
  })
  const [lastCustomText, setLastCustomText] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { setLastCustomText(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.lastCustomText) || '') } catch { /* ignore */ }
  }, [])

  const pushRecentFilter = useCallback((name: string) => {
    setRecentFilterNames((prev) => {
      const next = [name, ...prev.filter((n) => n !== name)].slice(0, 5)
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.recentFilters, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  const pushRecentStyle = useCallback((id: string) => {
    setRecentStyleIds((prev) => {
      const next = [id, ...prev.filter((i) => i !== id)].slice(0, 5)
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.recentStyles, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const filteredTextPresets = useMemo(() => {
    if (!textPresetSearch.trim()) return TEXT_PRESETS
    const q = textPresetSearch.toLowerCase()
    return TEXT_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const filteredViralHooks = useMemo(() => {
    if (!textPresetSearch.trim()) return VIRAL_HOOK_PRESETS
    const q = textPresetSearch.toLowerCase()
    return VIRAL_HOOK_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const filteredEndScreens = useMemo(() => {
    if (!textPresetSearch.trim()) return END_SCREEN_TEMPLATES
    const q = textPresetSearch.toLowerCase()
    return END_SCREEN_TEMPLATES.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const filteredReactionCallouts = useMemo(() => {
    if (!textPresetSearch.trim()) return REACTION_CALLOUT_PRESETS
    const q = textPresetSearch.toLowerCase()
    return REACTION_CALLOUT_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const getTextStartEnd = useCallback(() => {
    const end = textDuration === -1 ? duration : Math.min(currentTime + textDuration, duration)
    return { startTime: currentTime, endTime: Math.max(currentTime + 0.5, end) }
  }, [currentTime, duration, textDuration])

  const handleAddOverlay = useCallback((input: string | TextPresetConfig, atEnd = false) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [])
    const d = duration ?? 60
    const { startTime, endTime } = atEnd
      ? { startTime: Math.max(0, d - 5), endTime: d }
      : getTextStartEnd()
    addOverlay(setTextOverlays, input, showToast, templateLayout, startTime, endTime)
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    const text = typeof input === 'object' ? input.text : input
    if (typeof input === 'string' && text.trim()) {
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.lastCustomText, text) } catch { /* ignore */ }
      setLastCustomText(text)
    }
  }, [getTextStartEnd, setTextOverlays, showToast, templateLayout, videoFilters, textOverlays, pushSnapshot])

  const saveMyStyle = useCallback(() => {
    if (!customStyleName.trim() || !setTemplateLayout) return
    const filterNumeric = Object.fromEntries(
      Object.entries(videoFilters).filter(([, v]) => typeof v === 'number') as [string, number][]
    ) as Record<string, number>
    const bundle = {
      id: `custom-${Date.now()}`,
      name: customStyleName.trim(),
      layout: templateLayout,
      filter: filterNumeric,
      swatch: 'from-violet-400 to-fuchsia-500',
    }
    setCustomStyleBundles((prev) => {
      const next = [...prev, bundle]
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.customStyles, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    setCustomStyleName('')
    setShowSaveStyle(false)
    showToast(`Saved "${bundle.name}"`, 'success')
  }, [customStyleName, templateLayout, videoFilters, setTemplateLayout, showToast])

  const recentFiltersPresets = useMemo(() => recentFilterNames.map((n) => FILTER_PRESETS.find((p) => p.n === n)).filter(Boolean) as typeof FILTER_PRESETS, [recentFilterNames])
  const recentStyleBundlesList = useMemo(() => {
    type StyleItem = { id: string; label: string; layout: TemplateLayout; filter: Record<string, number>; desc?: string; swatch?: string }
    const list: StyleItem[] = []
    const toNumericFilter = (f: Record<string, number | undefined>): Record<string, number> =>
      Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'number') as [string, number][]) as Record<string, number>
    recentStyleIds.forEach((id) => {
      const builtIn = STYLE_BUNDLES.find((b) => b.id === id)
      if (builtIn) list.push({ ...builtIn, label: builtIn.label, filter: toNumericFilter(builtIn.filter as Record<string, number | undefined>) })
      else {
        const custom = customStyleBundles.find((b) => b.id === id)
        if (custom) list.push({ ...custom, label: custom.name, desc: 'Saved' })
      }
    })
    return list.slice(0, 5)
  }, [recentStyleIds, customStyleBundles])

  const applyPlatformBundle = useCallback((bundle: typeof PLATFORM_BUNDLES[0]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => ({ ...prev, ...bundle.filter }))
    showToast(`${bundle.label} — ${bundle.desc}`, 'success')
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, setVideoFilters, showToast])

  /** One-click creativity: apply a style bundle (layout + filter) for instant look */
  const applyStyleBundleOneClick = useCallback((bundle: typeof STYLE_BUNDLES[0]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => ({ ...prev, ...(bundle.filter as Partial<VideoFilter>) }))
    pushRecentStyle(bundle.id)
    showToast(`${bundle.label} — ${bundle.desc}`, 'success')
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, pushRecentStyle, showToast])

  return (
    <div className="space-y-5 pb-4" role="region" aria-label="Manual edit">
      {/* Creativity & content — quick hooks + one-click looks */}
      <div className="rounded-2xl border border-violet-200/60 dark:border-violet-800/50 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/50 dark:from-violet-950/40 dark:to-fuchsia-950/20 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-violet-500/15 dark:bg-violet-500/20">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Creativity & content</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Quick hooks and one-click looks for scroll-stopping content</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">Content ideas</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Hook', preset: VIRAL_HOOK_PRESETS[0] },
                { label: 'CTA', preset: TEXT_PRESETS.find((p) => p.label === 'CTA')! },
                { label: 'Lower third', preset: TEXT_PRESETS.find((p) => p.label === 'Lower third')! },
                { label: 'End screen', preset: END_SCREEN_TEMPLATES[0] },
              ].filter((x) => x.preset).map(({ label, preset }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleAddOverlay(preset)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border border-violet-200/80 dark:border-violet-700/60 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:border-violet-400 dark:hover:border-violet-500 transition-all shadow-sm"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">One-click look</p>
            <div className="flex flex-wrap gap-2">
              {[STYLE_BUNDLES[0], STYLE_BUNDLES[1], STYLE_BUNDLES[4], STYLE_BUNDLES[5]].map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => applyStyleBundleOneClick(bundle)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border border-amber-200/80 dark:border-amber-700/60 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-500 transition-all shadow-sm"
                  title={bundle.desc}
                >
                  {bundle.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Short-form ready — platform presets */}
      <div className="rounded-2xl border border-rose-200/60 dark:border-rose-800/50 bg-gradient-to-br from-rose-50/80 to-pink-50/50 dark:from-rose-950/40 dark:to-pink-950/20 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 dark:bg-rose-500/20">
              <Film className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Short-form ready</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">One-click aspect ratio + color for social</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_BUNDLES.filter((b) => ['tiktok', 'youtube', 'feed', 'portrait'].includes(b.id)).map((bundle) => (
              <button
                key={bundle.id}
                type="button"
                onClick={() => applyPlatformBundle(bundle)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${templateLayout === bundle.layout
                  ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-400/30'
                  : 'bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                  }`}
              >
                {bundle.id === 'youtube' ? 'Shorts' : bundle.id === 'tiktok' ? 'TikTok / Reels' : bundle.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveCategory?.('short-clips')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              More formats <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Intro / Quick tips */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Set aspect ratio above, add style and text. Use <button type="button" onClick={() => setActiveCategory?.('timeline')} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Timeline</button> and <button type="button" onClick={() => setActiveCategory?.('effects')} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Effects</button> for timing. <button type="button" onClick={() => setActiveCategory?.('color')} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Color</button> for fine-tuning. Use <strong>Compare</strong> under Quick filters for before/after.
        </p>
      </div>

      {/* Aspect ratio & export format */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-gray-800/90 shadow-sm p-5" role="group" aria-labelledby="layout-heading">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-violet-500/15 dark:bg-violet-900/30">
            <LayoutGrid className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 id="layout-heading" className="text-sm font-bold text-gray-900 dark:text-white">Aspect ratio</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Choose format for export</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATE_LAYOUTS.map((t) => {
            const isSelected = templateLayout === t.id
            const [w, h] = t.aspect.split('/').map(Number)
            const ratio = w / h
            const barW = ratio >= 1 ? 28 : Math.round(28 * ratio)
            const barH = ratio >= 1 ? Math.round(28 / ratio) : 28
            return (
              <button
                key={t.id}
                onClick={() => {
                  pushSnapshot(templateLayout, videoFilters, textOverlays ?? [])
                  setTemplateLayout?.(t.id)
                  showToast(`${t.label} (${t.desc})`, 'success')
                }}
                className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${isSelected
                  ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-500 dark:border-violet-400 shadow-md shadow-violet-500/20'
                  : 'bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
              >
                {/* Aspect ratio mini preview */}
                <div className={`flex justify-center mb-3 h-7 ${isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'}`}>
                  <div
                    className="bg-violet-500/30 dark:bg-violet-500/40 rounded-sm"
                    style={{ width: barW, height: barH }}
                  />
                </div>
                <span className="block text-xs font-bold text-gray-900 dark:text-white">{t.label}</span>
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</span>
                {t.platform && (
                  <span className="mt-1.5 inline-block text-[9px] font-medium text-violet-600 dark:text-violet-400 truncate max-w-full">
                    {t.platform}
                  </span>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-violet-500" />
                )}
              </button>
            )
          })}
        </div>
        {(templateLayout === 'vertical' || templateLayout === 'portrait') && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
              Thumb-safe zone: keep important text and graphics away from the bottom 20% on vertical/portrait for Reels and Stories.
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Keep key action in the <strong>center 80%</strong> so nothing is covered by platform UI. Use 9:16 for Reels, TikTok, Shorts.
            </p>
          </div>
        )}
      </div>

      {/* Quick nav - collapsible */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-gray-800/90 shadow-sm overflow-hidden" role="group" aria-labelledby="quicknav-heading">
        <button type="button" onClick={() => toggleSection('quickNav')} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
          <h3 id="quicknav-heading" className="text-sm font-bold text-gray-700 dark:text-gray-300">Jump to tools</h3>
          {openSections.quickNav ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        {openSections.quickNav && (
          <div className="px-4 pb-4 pt-0">
            <p className="text-[10px] text-gray-500 dark:text-gray-500 mb-2">Press <kbd className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[9px]">?</kbd> anywhere for keyboard shortcuts.</p>
            <div className="flex flex-wrap gap-1 mb-2 items-center">
              <button type="button" onClick={expandAll} className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline">Expand all</button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button type="button" onClick={collapseAll} className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline">Collapse all</button>
              {undoStack.length > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button type="button" onClick={undo} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50" title="Undo last edit">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {QUICK_NAV.map(({ id, label, icon: Icon, color }) => (
                <button key={id} onClick={() => setActiveCategory?.(id)} className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-gray-900/80 hover:bg-slate-100 dark:hover:bg-gray-800 border border-slate-200/80 dark:border-gray-700 transition-all text-left group shadow-sm hover:shadow">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white shadow-sm`}><Icon className="w-3.5 h-3.5" /></div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Shapes & stickers */}
      {setShapeOverlays && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5" role="group" aria-labelledby="shapes-heading">
          <h3 id="shapes-heading" className="text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">Shapes</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">Add rectangle, circle, or line at current time (5s). Edit on Timeline.</p>
          <div className="flex gap-2">
            {(['rect', 'circle', 'line'] as ShapeOverlayKind[]).map((k) => (
              <button key={k} type="button" onClick={() => addShape(k)} className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all">
                {k === 'rect' ? 'Rectangle' : k === 'circle' ? 'Circle' : 'Line'}
              </button>
            ))}
          </div>
          {shapeOverlays.length > 0 && (
            <p className="text-[10px] text-gray-500 mt-2">Active: {shapeOverlays.length} shape(s)</p>
          )}
        </div>
      )}

      {/* Motion graphic templates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5" role="group" aria-labelledby="motion-graphics-heading">
        <h3 id="motion-graphics-heading" className="text-xs font-black uppercase text-gray-500 mb-2 tracking-widest flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Motion graphics
        </h3>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">One-click lower thirds, bumpers, countdowns. Added at playhead.</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Duration</span>
          {([3, 5, 10] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMotionGraphicDuration(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${motionGraphicDuration === d ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
            >
              {d}s
            </button>
          ))}
        </div>
        {recentMotionTemplateIds.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1.5">Recently used</p>
            <div className="flex flex-wrap gap-2">
              {recentMotionTemplateIds.map((id) => {
                const t = MOTION_GRAPHIC_TEMPLATES.find((x) => x.id === id)
                if (!t) return null
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyMotionGraphicTemplate(t)}
                    className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left transition-all hover:border-amber-500"
                    title={t.description}
                  >
                    <span className="text-base mr-1.5" aria-hidden="true">{t.icon}</span>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-100">{t.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={motionTemplateSearch}
            onChange={(e) => setMotionTemplateSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400"
            aria-label="Search motion graphic templates"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MOTION_GRAPHIC_TEMPLATES.filter((t) => !motionTemplateSearch.trim() || t.name.toLowerCase().includes(motionTemplateSearch.toLowerCase()) || t.description.toLowerCase().includes(motionTemplateSearch.toLowerCase())).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyMotionGraphicTemplate(t)}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left transition-all group"
              title={t.description}
            >
              <span className="text-lg block mb-0.5" aria-hidden="true">{t.icon}</span>
              <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Image & gradient overlays */}
      {(setImageOverlays || setGradientOverlays) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5" role="group" aria-labelledby="video-overlays-heading">
          <h3 id="video-overlays-heading" className="text-xs font-black uppercase text-gray-500 mb-2 tracking-widest flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-teal-500" />
            Image & gradient overlays
          </h3>
          {setImageOverlays && (
            <div className="mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Image (logo, watermark)</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400"
                  aria-label="Image URL"
                />
                <button type="button" onClick={addImageOverlay} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold whitespace-nowrap">
                  Add at playhead
                </button>
              </div>
            </div>
          )}
          {setGradientOverlays && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Gradient presets</p>
              <div className="flex flex-wrap gap-2">
                {GRADIENT_PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => addGradientOverlay(p)} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-xs font-medium text-gray-700 dark:text-gray-300 transition-all">
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(imageOverlays?.length ?? 0) + (gradientOverlays?.length ?? 0) > 0 && (
            <p className="text-[10px] text-gray-500 mt-2">Active: {imageOverlays?.length ?? 0} image(s), {gradientOverlays?.length ?? 0} gradient(s). Edit in Properties.</p>
          )}
        </div>
      )}

      {/* AI Make it more engaging */}
      <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:to-fuchsia-500/20 rounded-xl shadow-lg border-2 border-violet-500/30 dark:border-violet-400/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-5 h-5 text-violet-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Make it more engaging</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Sharpen content: niche-specific hooks in the first 1–3s (not generic &quot;You won&apos;t believe…&quot;). One clear outcome per clip—what they learn, feel, or do. Use intentional silence and pacing; avoid wall-to-wall noise. B-roll + end CTAs.
        </p>
        <p className="text-xs text-violet-700 dark:text-violet-300 mb-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2 border border-violet-200 dark:border-violet-800">
          <strong>Visual polish:</strong> Lock in brand (colors, fonts, lower-third, logo, captions). Use subtle zooms/push-ins on key words or reactions—not constant movement. Keep key action in center 80%; simple, clean transitions.
        </p>
        <p className="text-xs text-sky-700 dark:text-sky-300 mb-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg px-3 py-2 border border-sky-200 dark:border-sky-800">
          <strong>AI as assistant:</strong> Use AI for rough clips and transcripts; you fix cuts/pacing, framing, captions, and B-roll. Choose segments by strategy, not only score. Test hook/caption variants and keep what performs.
        </p>
        <button
          onClick={() => { setActiveCategory?.('intelligence'); showToast('Check Growth & Intelligence for AI suggestions', 'info') }}
          className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Sparkles className="w-4 h-4" />
          View AI suggestions
        </button>
      </div>

      {/* Music, Images & B-Roll */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl shadow-lg border-2 border-indigo-500/30 dark:border-indigo-400/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Film className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Music, Images, B-Roll &amp; SFX</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Add background music, sound effects, stock images, or B-roll clips to boost quality and engagement.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
          <strong>Premium audio:</strong> Keep speech louder than music (duck). Choose music that fits the emotion; cut to the beat. SFX sparingly—whooshes on cuts, hits on key words. Mix for mobile (check on phone).
        </p>
        <button
          onClick={() => setActiveCategory?.('assets')}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          <Music className="w-4 h-4" />
          Open Music, Images, B-Roll &amp; SFX
        </button>
      </div>

      {/* Text overlays - collapsible, search, duration, hint */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" role="group" aria-labelledby="text-heading">
        <button type="button" onClick={() => toggleSection('text')} className="w-full p-5 flex items-center justify-between text-left">
          <h3 id="text-heading" className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-blue-500" />
            Text overlays
          </h3>
          {openSections.text ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {openSections.text && (
          <div className="px-5 pb-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={textPresetSearch}
                onChange={(e) => setTextPresetSearch(e.target.value)}
                placeholder="Search presets (title, CTA, lower third…)"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                aria-label="Search text presets"
              />
            </div>
            {filteredViralHooks.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1.5">Viral Hooks</p>
                <div className="flex flex-wrap gap-2">
                  {filteredViralHooks.map((p) => (
                    <button key={p.label} onClick={() => handleAddOverlay(p)} className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 transition-all" title={p.text}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {filteredReactionCallouts.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase mb-1.5">Reaction / Callout</p>
                <div className="flex flex-wrap gap-2">
                  {filteredReactionCallouts.map((p) => (
                    <button key={p.label} onClick={() => handleAddOverlay(p)} className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 transition-all" title={p.text}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {filteredEndScreens.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1.5">End Screen / CTA</p>
                <div className="flex flex-wrap gap-2">
                  {filteredEndScreens.map((p) => (
                    <button key={p.label} onClick={() => handleAddOverlay(p, true)} className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-800 dark:text-emerald-200 transition-all" title={`${p.text} (placed at end)`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">All Presets</p>
              <div className="flex flex-wrap gap-2">
                {filteredTextPresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleAddOverlay(p)}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
                    title={`${p.text} — ${p.style || 'default'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Duration</span>
              {[3, 5, 10].map((d) => (
                <button key={d} type="button" onClick={() => setTextDuration(d)} className={`px-2 py-1 rounded text-[10px] font-bold ${textDuration === d ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{d}s</button>
              ))}
              <button type="button" onClick={() => setTextDuration(-1)} className={`px-2 py-1 rounded text-[10px] font-bold ${textDuration === -1 ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>Full</button>
            </div>
            <div className="flex gap-2">
              <input
                ref={customTextInputRef}
                type="text"
                value={textCustom}
                onChange={(e) => setTextCustom(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleAddOverlay(textCustom.trim() || lastCustomText || 'NEW TEXT'); setTextCustom('') } }}
                placeholder={lastCustomText || 'Custom text…'}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Custom text"
              />
              <button
                onClick={() => { handleAddOverlay(textCustom.trim() || lastCustomText || 'NEW TEXT'); setTextCustom('') }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5 shrink-0"
              >
                <Edit3 className="w-4 h-4" />
                Add
              </button>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Tip: Set in/out on the <button type="button" onClick={() => setActiveCategory?.('timeline')} className="font-semibold text-violet-600 dark:text-violet-400 hover:underline">Timeline</button> tab. Change font in the Properties panel.
            </p>
            {/* Current text overlays - list with delete */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-600" role="group" aria-labelledby="current-overlays-heading">
              <button type="button" onClick={() => toggleSection('currentOverlays')} className="w-full flex items-center justify-between text-left py-1">
                <h4 id="current-overlays-heading" className="text-xs font-bold text-gray-700 dark:text-gray-300">Current text overlays ({textOverlays?.length ?? 0})</h4>
                {openSections.currentOverlays ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openSections.currentOverlays && (textOverlays?.length ? (
                <ul className="mt-2 space-y-1.5">
                  {textOverlays.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1" title={o.text}>{o.text.slice(0, 32)}{o.text.length > 32 ? '…' : ''}</span>
                      <button type="button" onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setTextOverlays((prev: TextOverlay[]) => prev.filter((x) => x.id !== o.id)); showToast('Overlay removed', 'info') }} className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30" title="Remove overlay" aria-label={`Remove ${o.text}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-dashed border-gray-200 dark:border-gray-600">
                  <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400">No text overlays yet.</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5">Try: add a <strong>Hook</strong>, <strong>CTA</strong>, or pick a <strong>one-click look</strong> in Creativity &amp; content above.</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Platform presets - collapsible, desc visible */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/15 dark:to-teal-500/15 rounded-xl shadow-lg border-2 border-emerald-500/30 dark:border-emerald-400/30 overflow-hidden" role="group" aria-labelledby="platform-heading">
        <button type="button" onClick={() => toggleSection('platform')} className="w-full p-5 flex items-center justify-between text-left">
          <h3 id="platform-heading" className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Platform presets
          </h3>
          {openSections.platform ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {openSections.platform && (
          <div className="px-5 pb-5">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">One-click layout + color for social formats</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PLATFORM_BUNDLES.map((b) => (
                <div key={b.id} className="relative group/card">
                  <button
                    type="button"
                    onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); pushRecentStyle(b.id); showToast(`${b.label} preset applied`, 'success') }}
                    onContextMenu={(e) => { e.preventDefault(); setTemplateLayout?.(b.layout); showToast(`${b.label} layout applied (filter unchanged)`, 'info') }}
                    className="w-full p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/50 transition-all text-left"
                  >
                    <span className="block text-xs font-bold text-gray-900 dark:text-white">{b.label}</span>
                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{b.desc}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); pushRecentStyle(b.id)
                      const exportPreset = b.id === 'tiktok' ? 'tiktok' : b.id === 'youtube' ? 'shorts' : b.id === 'feed' || b.id === 'portrait' ? 'reels' : '1080p'
                      try { sessionStorage.setItem('export-preferred-preset', exportPreset) } catch { /* ignore */ }
                      setActiveCategory?.('export'); showToast(`Layout set — open Export for ${b.label}`, 'info')
                    }}
                    className="mt-1 w-full text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                  >
                    Export for {b.label} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mood packs - filter + suggested text style + default transition hint */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5" role="group" aria-labelledby="mood-heading">
        <h3 id="mood-heading" className="text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">Mood packs</h3>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">One-click vibe: filter + suggested text style. Set transition on Timeline.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'calm', label: 'Calm', filter: { saturation: 88, contrast: 95, temperature: 108, vignette: 20 }, desc: 'Soft & gentle' },
            { id: 'urgent', label: 'Urgent', filter: { saturation: 125, contrast: 115, vibrance: 118 }, desc: 'High energy' },
            { id: 'luxury', label: 'Luxury', filter: { contrast: 108, saturation: 92, vignette: 35, sepia: 10 }, desc: 'Cinematic' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...m.filter })); showToast(`${m.label} mood applied`, 'success') }}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-left"
            >
              <span className="block text-gray-900 dark:text-white">{m.label}</span>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style bundles - collapsible, recently used, Save my style */}
      <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/15 dark:to-fuchsia-500/15 rounded-xl shadow-lg border-2 border-violet-500/30 dark:border-violet-400/30 overflow-hidden" role="group" aria-labelledby="style-heading">
        <button type="button" onClick={() => toggleSection('styleBundles')} className="w-full p-5 flex items-center justify-between text-left">
          <h3 id="style-heading" className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-violet-500" />
            Style bundles
          </h3>
          {openSections.styleBundles ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {openSections.styleBundles && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">One-click layout + color. Right-click for filter only.</p>
            {recentStyleBundlesList.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Recently used</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {recentStyleBundlesList.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        pushSnapshot(templateLayout, videoFilters, textOverlays ?? [])
                        setTemplateLayout?.(b.layout)
                        setVideoFilters((prev: any) => ({ ...prev, ...b.filter }))
                        showToast(`${b.label} applied`, 'success')
                      }}
                      className="p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-violet-200/50 dark:border-violet-700/50 text-[10px] font-bold text-gray-900 dark:text-white hover:bg-violet-50 dark:hover:bg-violet-900/30"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
              {STYLE_BUNDLES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); pushRecentStyle(b.id); showToast(`${b.label} style applied`, 'success') }}
                  onContextMenu={(e) => { e.preventDefault(); pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); showToast(`${b.label} filter applied (layout unchanged)`, 'info') }}
                  className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 hover:bg-violet-50 dark:hover:bg-violet-900/30 border border-violet-200/50 dark:border-violet-700/50 transition-all text-left group relative"
                >
                  <div className={`h-1.5 w-full rounded-full mb-2 bg-gradient-to-r ${b.swatch ?? 'from-gray-400 to-gray-600'}`} />
                  <span className="block text-xs font-bold text-gray-900 dark:text-white">{b.label}</span>
                  <span className="block text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">{b.desc}</span>
                </button>
              ))}
              {customStyleBundles.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); pushRecentStyle(b.id); showToast(`${b.name} applied`, 'success') }}
                  onContextMenu={(e) => { e.preventDefault(); pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...b.filter })); showToast(`${b.name} filter applied`, 'info') }}
                  className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 hover:bg-violet-50 dark:hover:bg-violet-900/30 border border-violet-200/50 dark:border-violet-700/50 transition-all text-left"
                >
                  <div className={`h-1.5 w-full rounded-full mb-2 bg-gradient-to-r ${b.swatch}`} />
                  <span className="block text-xs font-bold text-gray-900 dark:text-white">{b.name}</span>
                  <span className="block text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">Saved</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!showSaveStyle ? (
                <button type="button" onClick={() => setShowSaveStyle(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50">
                  <Save className="w-3.5 h-3.5" /> Save my style
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="text" value={customStyleName} onChange={(e) => setCustomStyleName(e.target.value)} placeholder="Style name…" className="w-32 px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
                  <button type="button" onClick={saveMyStyle} disabled={!customStyleName.trim()} className="px-2 py-1.5 rounded bg-violet-600 text-white text-xs font-bold disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => { setShowSaveStyle(false); setCustomStyleName('') }} className="px-2 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold">Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick filters - collapsible, filter strength, recently used, Compare */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" role="group" aria-labelledby="filters-heading">
        <button type="button" onClick={() => toggleSection('quickFilters')} className="w-full p-5 flex items-center justify-between text-left">
          <h3 id="filters-heading" className="text-base font-bold text-gray-900 dark:text-white">Quick filters</h3>
          {openSections.quickFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {openSections.quickFilters && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Filter strength</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={filterStrength}
                  onChange={(e) => setFilterStrength?.(Number(e.target.value))}
                  className="w-24 h-1.5 rounded-full accent-violet-500"
                  aria-label="Filter strength"
                />
                <span className="text-[10px] font-mono text-gray-500 w-8">{filterStrength}%</span>
              </div>
              <button
                type="button"
                onClick={cycleCompareMode}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${compareMode === 'after' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : compareMode === 'split' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Compare: After / Before / Split"
              >
                {compareMode === 'after' ? <Eye className="w-3.5 h-3.5" /> : compareMode === 'split' ? <LayoutGrid className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Compare: {compareMode === 'after' ? 'After' : compareMode === 'split' ? 'Split' : 'Before'}
              </button>
            </div>
            {pinnedPresets.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pinnedPresets.map((preset) => (
                    <button
                      key={preset.n}
                      onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...preset.f })); pushRecentFilter(preset.n); showToast(`${preset.n} applied`, 'success') }}
                      className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-[10px] font-bold text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50 flex items-center gap-1.5"
                    >
                      <div className={`w-1.5 h-4 rounded-full bg-gradient-to-b ${preset.swatch}`} />
                      {preset.n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recentFiltersPresets.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Recently used</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {recentFiltersPresets.map((preset) => (
                    <button
                      key={preset.n}
                      onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...preset.f })); pushRecentFilter(preset.n); showToast(`${preset.n} applied`, 'success') }}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1.5"
                    >
                      <div className={`w-1.5 h-4 rounded-full bg-gradient-to-b ${preset.swatch}`} />
                      {preset.n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {FILTER_CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setFilterCategory(c.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${filterCategory === c.id ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{c.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FILTER_PRESETS_WITH_CATEGORY
                .filter((p) => filterCategory === 'all' || p.category === filterCategory)
                .map((preset) => (
                  <button
                    key={preset.n}
                    onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? []); setVideoFilters((prev: any) => ({ ...prev, ...preset.f })); pushRecentFilter(preset.n); showToast(`${preset.n} applied`, 'success') }}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all text-left group relative"
                  >
                    <div className={`h-1.5 w-full rounded-full mb-2 bg-gradient-to-r ${preset.swatch}`} />
                    <span className="block text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">{preset.n}</span>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{preset.desc}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); togglePinFilter(preset.n); showToast(pinnedFilterNames.includes(preset.n) ? 'Unpinned' : 'Pinned (max 3)', 'info') }}
                      className={`absolute top-2 right-2 p-1 rounded-md ${pinnedFilterNames.includes(preset.n) ? 'bg-violet-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-violet-100 dark:hover:bg-violet-900/30'}`}
                      title={pinnedFilterNames.includes(preset.n) ? 'Unpin' : 'Pin to top (max 3)'}
                      aria-label={pinnedFilterNames.includes(preset.n) ? 'Unpin filter' : 'Pin filter'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BasicEditorView
