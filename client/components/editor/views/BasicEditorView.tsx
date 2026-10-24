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
  ChevronUp,
  ChevronRight,
  EyeOff,
  Save,
  Search,
  Undo2,
  Redo2,
  Trash2,
  Pin,
  ArrowLeft,
  CheckCircle2,
  Circle,
  RotateCcw,
  Pencil,
  Upload,
  Timer,
  PlusCircle,
  Radio,
  Layers,
  Box,
  Zap,
  MessageSquare,
  Mic,
  Volume2,
  Activity,
  Waves,
  Wind,
  BarChart3,
  SlidersHorizontal,
  Globe,
  Anchor,
  Layers2,
  Maximize,
  Video,
  Wand2,
  Calendar,
  Share2,
  Hash,
  Clock,
  Infinity as InfinityIcon,
  Users,
  Split,
  Users2,
  Terminal,
  Heart,
  GitBranch,
  Archive,
  FolderSearch,
  Library,
  Rocket,
  BarChart,
  CreditCard,
  Image as ImageIcon
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { getMatchingEmojiForChunk } from '../../../utils/captionEmojiMap'
import { pickHighlightWords, pickCaptionEmoji, DEFAULT_HIGHLIGHT_COLOR } from '../../../lib/captions'
import { VideoFilter, TextOverlay, TemplateLayout, TEMPLATE_LAYOUTS, ShapeOverlay, ShapeOverlayKind, MOTION_GRAPHIC_TEMPLATES, MotionGraphicTemplate, ImageOverlay, GradientOverlay, GradientOverlayDirection, SvgOverlay, MotionCompound, TransformKeyframe, CAPTION_FONTS } from '../../../types/editor'
import {
  TextPresetConfig,
  TEXT_PRESETS,
  VIRAL_HOOK_PRESETS,
  PREMIUM_CAPTION_PRESETS,
  REACTION_CALLOUT_PRESETS,
  END_SCREEN_TEMPLATES,
  TRENDING_PRESETS,
  CHAPTER_PRESETS,
  SHAPE_PRESETS,
  FILTER_PRESETS,
  replaceLook,
  STYLE_BUNDLES,
  PLATFORM_BUNDLES,
  FILTER_CATEGORIES,
  FILTER_PRESETS_WITH_CATEGORY,
  RESET_FILTER
} from './basic/basicEditorConstants'
import { apiPost } from '../../../lib/api'
import { useTranslation } from '../../../hooks/useTranslation'
import BrandKit, { useBrandKit } from '../../BrandKit'

type UndoSnapshot = {
  layout: TemplateLayout
  filters: VideoFilter
  textOverlays: TextOverlay[]
  shapeOverlays: ShapeOverlay[]
  imageOverlays: ImageOverlay[]
  svgOverlays: SvgOverlay[]
  gradientOverlays: GradientOverlay[]
}

type TextOverlayStyle = 'none' | 'neon' | 'minimal' | 'bold-kinetic' | 'outline' | 'shadow'

const MANUAL_EDIT_STORAGE_KEYS = {
  recentFilters: 'manual-edit-recent-filters',
  recentStyles: 'manual-edit-recent-styles',
  recentMotionTemplates: 'manual-edit-recent-motion-templates',
  customStyles: 'manual-edit-custom-styles',
  lastCustomText: 'manual-edit-last-custom-text',
  pinnedFilters: 'manual-edit-pinned-filters',
  motionCompounds: 'click-motion-compounds',
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

interface BasicEditorViewProps {
  videoFilters: VideoFilter
  setVideoFilters: (v: VideoFilter | ((prev: VideoFilter) => VideoFilter)) => void
  setColorGradeSettings?: (v: any) => void
  textOverlays?: TextOverlay[]
  setTextOverlays: (v: TextOverlay[] | ((prev: TextOverlay[]) => TextOverlay[])) => void
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
  svgOverlays?: SvgOverlay[]
  setSvgOverlays?: (v: SvgOverlay[] | ((prev: SvgOverlay[]) => SvgOverlay[])) => void
  gradientOverlays?: GradientOverlay[]
  transcript?: import('../../../types/editor').Transcript | null
  setGradientOverlays?: (v: GradientOverlay[] | ((prev: GradientOverlay[]) => GradientOverlay[])) => void
  /** When set, show "Back to videos" and segment count in summary */
  videoId?: string
  segmentCount?: number
  /** Split the timeline segment under the playhead at the current time */
  onSplitAtPlayhead?: () => void
  /** Toggle the `reversed` flag on the selected (or playhead) segment */
  onReverseSelected?: () => void
  /** Insert a freeze-frame segment at the playhead (default 1s) */
  onFreezeAtPlayhead?: (durationSec?: number) => void
  /** Trim the selected segment to a [in, out] timeline range */
  onTrimSelectedToRange?: (inTime: number, outTime: number) => void
  /** Toggle a J-Cut on the selected segment (audio leads video) */
  onJCutSelected?: (leadSec?: number) => void
  /** Toggle an L-Cut on the selected segment (audio tail past visual cut) */
  onLCutSelected?: (tailSec?: number) => void
  /** One-click: re-segment the source into beat-aligned clips (montage). */
  onBeatCut?: () => void
  /** Whether a segment is currently selected (for enabling segment-only ops) */
  hasSegmentSelection?: boolean
  playbackSpeed?: number
  setPlaybackSpeed?: (v: number) => void
  onSeek?: (time: number) => void
  selectedOverlayId?: string | null
  onSelectOverlay?: (id: string | null) => void
}



const QUICK_NAV = [
  { id: 'short-clips' as const, label: 'Short Clips', labelKey: 'basicEditor.nav.shortClips', icon: Film, color: 'from-rose-500 to-pink-500' },
  { id: 'assets' as const, label: 'Music & B-Roll', labelKey: 'basicEditor.nav.assets', icon: Music, color: 'from-indigo-500 to-purple-500' },
  { id: 'timeline' as const, label: 'Timeline', labelKey: 'basicEditor.nav.timeline', icon: Scissors, color: 'from-amber-500 to-orange-500' },
  { id: 'effects' as const, label: 'Effects', labelKey: 'basicEditor.nav.effects', icon: Sparkles, color: 'from-violet-500 to-fuchsia-500' },
  { id: 'color' as const, label: 'Color', labelKey: 'basicEditor.nav.color', icon: Palette, color: 'from-pink-500 to-rose-500' },
  { id: 'ai-edit' as const, label: 'Transcribe & AI', labelKey: 'basicEditor.nav.aiEdit', icon: Cpu, color: 'from-fuchsia-500 to-purple-500' },
  { id: 'export' as const, label: 'Export', labelKey: 'basicEditor.nav.export', icon: Download, color: 'from-emerald-500 to-teal-500' },
]

const CAPTION_STYLE_OPTIONS = [
  { id: 'tiktok-pop',     label: 'TikTok',                                          preview: { color: '#fff', shadow: 'drop-shadow(0 0 6px rgba(236,72,153,0.8))', pill: false } },
  { id: 'hormozi-bold',   label: 'Hormozi',                                         preview: { color: '#FFD700', shadow: 'none', pill: false } },
  { id: 'minimal-white',  label: 'Minimal', labelKey: 'basicEditor.captionStyle.minimal', preview: { color: '#e2e8f0', shadow: 'none', pill: false } },
  { id: 'neon-glow',      label: 'Neon',    labelKey: 'basicEditor.captionStyle.neon',    preview: { color: '#00F5FF', shadow: 'drop-shadow(0 0 8px rgba(0,245,255,0.8))', pill: false } },
  { id: 'vlog-kinetic',   label: 'Kinetic', labelKey: 'basicEditor.captionStyle.kinetic', preview: { color: '#FFFF00', shadow: 'drop-shadow(0 0 5px rgba(255,255,0,0.6))', pill: false } },
  { id: 'cyberpunk-neon', label: 'Cyber',   labelKey: 'basicEditor.captionStyle.cyber',   preview: { color: '#FF00FF', shadow: 'drop-shadow(0 0 10px rgba(255,0,255,0.9))', pill: false } },
  { id: 'oled-darkroom',  label: 'OLED',                                            preview: { color: '#FFFFFF', shadow: 'none', pill: true } },
  { id: 'youtube-shorts', label: 'Shorts',                                          preview: { color: '#ffffff', shadow: 'drop-shadow(0 0 4px #ff3b30)', pill: false } },
  { id: 'meme-impact',    label: 'Meme',    labelKey: 'basicEditor.captionStyle.meme',    preview: { color: '#ffffff', shadow: 'drop-shadow(0 0 6px #000000)', pill: false } },
  { id: 'retro-vhs',      label: 'Retro',   labelKey: 'basicEditor.captionStyle.retro',   preview: { color: '#dafffa', shadow: 'drop-shadow(0 0 5px #00ffff)', pill: false } },
  { id: 'serif-quote',    label: 'Quote',   labelKey: 'basicEditor.captionStyle.quote',   preview: { color: '#f7e6c4', shadow: 'none', pill: false } },
] as const

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
  endTime: number = 5,
  addedMessage: string = 'Text overlay added'
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
  showToast(addedMessage, 'success')
}



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
  svgOverlays = [],
  setSvgOverlays,
  gradientOverlays = [],
  setGradientOverlays,
  videoId,
  segmentCount = 0,
  transcript,
  onSplitAtPlayhead,
  onReverseSelected,
  onFreezeAtPlayhead,
  onTrimSelectedToRange,
  onJCutSelected,
  onLCutSelected,
  onBeatCut,
  hasSegmentSelection = false,
  playbackSpeed,
  setPlaybackSpeed,
  onSeek,
  selectedOverlayId,
  onSelectOverlay,
}) => {
  const { t } = useTranslation()
  // Display-only translations for the preset tables. The English `label` /
  // `n` / `id` fields stay the stable ids used in logic and localStorage.
  const presetLabel = useCallback((p: TextPresetConfig) => (p.labelKey ? t(p.labelKey) : p.label), [t])
  const presetText = useCallback((p: TextPresetConfig) => (p.textKey ? t(p.textKey) : p.text), [t])
  const presetMatches = useCallback((p: TextPresetConfig, q: string) =>
    [p.label, p.text, presetLabel(p), presetText(p)].some((s) => s.toLowerCase().includes(q)), [presetLabel, presetText])
  const filterName = useCallback((p: { n: string; nameKey?: string }) => (p.nameKey ? t(p.nameKey) : p.n), [t])
  const filterDesc = useCallback((p: { desc: string; descKey?: string }) => (p.descKey ? t(p.descKey) : p.desc), [t])
  const bundleLabel = useCallback((b: { label: string; labelKey?: string }) => (b.labelKey ? t(b.labelKey) : b.label), [t])
  const filterNameById = useCallback((n: string) => {
    const p = FILTER_PRESETS.find((x) => x.n === n)
    return p ? filterName(p) : n
  }, [filterName])
  const currentTime = videoState?.currentTime ?? 0
  const duration = videoState?.duration ?? 60
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)

  // Sync selectedOverlayId from preview with selectedTextId
  React.useEffect(() => {
    if (selectedOverlayId !== undefined) {
      setSelectedTextId(selectedOverlayId)
    }
  }, [selectedOverlayId])

  const [isDraftMode, setIsDraftMode] = useState<boolean>(true)
  // Trim-tab In/Out markers (timeline-coordinate seconds). Local to this view —
  // the actual trim is applied via onTrimSelectedToRange when the user clicks
  // "Trim to In/Out", which mutates the selected segment's source range.
  const [trimInPoint, setTrimInPoint] = useState<number | null>(null)
  const [trimOutPoint, setTrimOutPoint] = useState<number | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ platform: true, styleBundles: false, quickFilters: true, text: false, quickNav: false, currentOverlays: false })

  // --- UNDO / REDO SYSTEM (Hoisted for scope) ---
  const MAX_UNDO = 50
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([])
  const isUndoRestore = useRef(false)

  const pushSnapshot = useCallback((
    layout: TemplateLayout,
    filters: VideoFilter,
    overlays: TextOverlay[],
    shapes: ShapeOverlay[] = [],
    images: ImageOverlay[] = [],
    svgs: SvgOverlay[] = [],
    gradients: GradientOverlay[] = []
  ) => {
    if (isUndoRestore.current) return
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), {
       layout,
       filters: { ...filters },
       textOverlays: (overlays || []).map((o) => ({ ...o })),
       shapeOverlays: (shapes || []).map((o) => ({ ...o })),
       imageOverlays: (images || []).map((o) => ({ ...o })),
       svgOverlays: (svgs || []).map((o) => ({ ...o })),
       gradientOverlays: (gradients || []).map((o) => ({ ...o })),
    }])
    setRedoStack([])
  }, [])

  const undo = useCallback(() => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return

    setRedoStack((prev) => [...prev, {
      layout: templateLayout,
      filters: { ...videoFilters },
      textOverlays: (textOverlays ?? []).map((o) => ({ ...o })),
      shapeOverlays: (shapeOverlays ?? []).map((o) => ({ ...o })),
      imageOverlays: (imageOverlays ?? []).map((o) => ({ ...o })),
      svgOverlays: (svgOverlays ?? []).map((o) => ({ ...o })),
      gradientOverlays: (gradientOverlays ?? []).map((o) => ({ ...o })),
    }])

    isUndoRestore.current = true
    setTemplateLayout?.(last.layout)
    setVideoFilters(last.filters)
    setTextOverlays(last.textOverlays)
    setShapeOverlays?.(last.shapeOverlays)
    setImageOverlays?.(last.imageOverlays)
    setSvgOverlays?.(last.svgOverlays)
    setGradientOverlays?.(last.gradientOverlays)
    setUndoStack((prev) => prev.slice(0, -1))
    showToast(t('basicEditor.toast.undoApplied'), 'info')
    setTimeout(() => {
      isUndoRestore.current = false
    }, 100)
  }, [undoStack, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTemplateLayout, setVideoFilters, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, setGradientOverlays, showToast, t])

  const redo = useCallback(() => {
    const lastRedo = redoStack[redoStack.length - 1]
    if (!lastRedo) return

    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO - 1)), {
      layout: templateLayout,
      filters: { ...videoFilters },
      textOverlays: (textOverlays ?? []).map((o) => ({ ...o })),
      shapeOverlays: (shapeOverlays ?? []).map((o) => ({ ...o })),
      imageOverlays: (imageOverlays ?? []).map((o) => ({ ...o })),
      svgOverlays: (svgOverlays ?? []).map((o) => ({ ...o })),
      gradientOverlays: (gradientOverlays ?? []).map((o) => ({ ...o })),
    }])

    isUndoRestore.current = true
    setTemplateLayout?.(lastRedo.layout)
    setVideoFilters(lastRedo.filters)
    setTextOverlays(lastRedo.textOverlays)
    setShapeOverlays?.(lastRedo.shapeOverlays)
    setImageOverlays?.(lastRedo.imageOverlays)
    setSvgOverlays?.(lastRedo.svgOverlays)
    setGradientOverlays?.(lastRedo.gradientOverlays)
    setRedoStack((prev) => prev.slice(0, -1))
    showToast(t('basicEditor.toast.redoApplied'), 'info')
    setTimeout(() => {
      isUndoRestore.current = false
    }, 100)
  }, [redoStack, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTemplateLayout, setVideoFilters, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, setGradientOverlays, showToast, t])
  // ----------------------------------------------

  const fontInputRef = useRef<HTMLInputElement>(null)
  const [customFonts, setCustomFonts] = useState<{name: string, family: string}[]>([])

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTextId) return
    const formData = new FormData()
    formData.append('font', file)

    showToast(t('basicEditor.toast.fontUploading'), 'info')
    try {
      const res = await apiPost('/video/creative/fonts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const data = (res as any)?.data ?? (res as any)
      if (data?.success) {
        const newFont = new FontFace(data.fontFamily, `url(${data.url})`)
        await newFont.load()
        document.fonts.add(newFont)

        setCustomFonts(prev => [...prev, { name: data.fontFamily, family: data.fontFamily }])
        // @ts-ignore
        updateTextOverlay(selectedTextId, { fontFamily: data.fontFamily })
        showToast(t('basicEditor.toast.fontAdded'), 'success')
      } else {
        showToast(t('basicEditor.toast.fontInvalid'), 'error')
      }
    } catch (err) {
      showToast(t('basicEditor.toast.fontFailed'), 'error')
    }
  }

  const addShape = useCallback((kind: ShapeOverlayKind) => {
    if (!setShapeOverlays) return
    const startTime = currentTime
    const endTime = Math.min(currentTime + 5, duration)
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
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
    showToast(t(kind === 'rect' ? 'basicEditor.toast.rectangleAdded' : kind === 'circle' ? 'basicEditor.toast.circleAdded' : 'basicEditor.toast.lineAdded'), 'success')
    // Snapshots are intentional point-in-time captures; including overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, setShapeOverlays, showToast, t])

  const addShapePreset = useCallback((preset: typeof SHAPE_PRESETS[0]) => {
    if (!setShapeOverlays) return
    const startTime = currentTime
    const endTime = Math.min(currentTime + 5, duration)
    setShapeOverlays((prev) => [
      ...prev,
      {
        id: `shape-${Date.now()}-${preset.id}`,
        kind: preset.kind,
        x: preset.x,
        y: preset.y,
        width: preset.width,
        height: preset.height,
        color: preset.color,
        opacity: preset.opacity,
        startTime,
        endTime,
        strokeWidth: preset.strokeWidth,
      },
    ])
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    showToast(t('basicEditor.toast.addedName', { name: t(preset.nameKey) }), 'success')
  }, [currentTime, duration, setShapeOverlays, setOpenSections, showToast, t])

  const [motionGraphicDuration, setMotionGraphicDuration] = useState(5)
  const [recentMotionTemplateIds, setRecentMotionTemplateIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.recentMotionTemplates) || '[]') } catch { return [] }
  })
  const [motionTemplateSearch, setMotionTemplateSearch] = useState('')

  const applyMotionGraphicTemplate = useCallback((template: MotionGraphicTemplate) => {
    const defaultDuration = motionGraphicDuration
    const baseStart = currentTime
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
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
    showToast(t('basicEditor.toast.addedAt', { name: template.name, time: baseStart.toFixed(1) }), 'success')
    // Snapshots are intentional point-in-time captures; including overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, templateLayout, motionGraphicDuration, setTextOverlays, setShapeOverlays, setOpenSections, showToast, t])

  const [imageUrlInput, setImageUrlInput] = useState('')
  const addImageOverlay = useCallback(() => {
    if (!setImageOverlays) return
    const url = imageUrlInput.trim()
    if (!url) { showToast(t('basicEditor.toast.enterImageUrl'), 'error'); return }
    const start = currentTime
    const end = Math.min(currentTime + 5, duration)
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setImageOverlays((prev: ImageOverlay[]) => [
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
      },
    ])
    setImageUrlInput('')
    showToast(t('basicEditor.toast.imageAdded'), 'success')
    // Snapshots are intentional point-in-time captures; including overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrlInput, currentTime, duration, setImageOverlays, showToast, t])

  const updateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev: TextOverlay[]) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)))
  }, [setTextOverlays])

  const [svgUrlInput, setSvgUrlInput] = useState('')
  const svgFileInputRef = useRef<HTMLInputElement>(null)
  const handleSvgFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !setSvgOverlays) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      if (!url || typeof url !== 'string') return
      const start = currentTime
      const end = Math.min(currentTime + 10, duration)
      setSvgOverlays((prev: SvgOverlay[]) => [
        ...prev,
        { id: `svg-${Date.now()}`, url, x: 50, y: 50, width: 20, height: 20, startTime: start, endTime: end, opacity: 1 },
      ])
      setOpenSections((prev: Record<string, boolean>) => ({ ...prev, currentOverlays: true }))
      showToast(t('basicEditor.toast.svgAddedFromFile'), 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [currentTime, duration, setSvgOverlays, setOpenSections, showToast, t])
  const addSvgOverlay = useCallback(() => {
    if (!setSvgOverlays) return
    const url = svgUrlInput.trim()
    if (!url) { showToast(t('basicEditor.toast.enterSvgUrl'), 'error'); return }
    const start = currentTime
    const end = Math.min(currentTime + 10, duration)
    setSvgOverlays((prev: SvgOverlay[]) => [
      ...prev,
      {
        id: `svg-${Date.now()}`,
        url,
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        startTime: start,
        endTime: end,
        opacity: 1,
      },
    ])
    setSvgUrlInput('')
    setOpenSections((prev: Record<string, boolean>) => ({ ...prev, currentOverlays: true }))
    showToast(t('basicEditor.toast.svgAdded'), 'success')
  }, [svgUrlInput, currentTime, duration, setSvgOverlays, setOpenSections, showToast, t])

  const [savedCompounds, setSavedCompounds] = useState<MotionCompound[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [compoundName, setCompoundName] = useState('')
  const [compoundDuration, setCompoundDuration] = useState(5)
  const saveAsCompound = useCallback(() => {
    const name = compoundName.trim() || t('basicEditor.compound.untitled')
    const dur = Math.max(1, compoundDuration)
    const compound: MotionCompound = {
      id: `compound-${Date.now()}`,
      name,
      duration: dur,
      textOverlays: (textOverlays ?? []).map((o) => ({ ...o, id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, startTime: 0, endTime: dur })),
      shapeOverlays: (shapeOverlays ?? []).map((o) => ({ ...o, id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, startTime: 0, endTime: dur })),
      imageOverlays: (imageOverlays ?? []).map((o) => ({ ...o, id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, startTime: 0, endTime: dur })),
      svgOverlays: (svgOverlays ?? []).map((o) => ({ ...o, id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, startTime: 0, endTime: dur })),
      createdAt: Date.now(),
    }
    const next = [compound, ...savedCompounds].slice(0, 20)
    setSavedCompounds(next)
    localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds, JSON.stringify(next))
    setCompoundName('')
    showToast(t('basicEditor.toast.compoundSaved', { name }), 'success')
  }, [compoundName, compoundDuration, textOverlays, shapeOverlays, imageOverlays, svgOverlays, savedCompounds, showToast, t])
  const addCompoundToTimeline = useCallback((c: MotionCompound) => {
    const start = currentTime
    const end = start + c.duration
    const ts = Date.now()
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTextOverlays((prev: TextOverlay[]) => [...prev, ...c.textOverlays.map((o, i) => ({ ...o, id: `t-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setShapeOverlays) setShapeOverlays((prev: ShapeOverlay[]) => [...prev, ...(c.shapeOverlays ?? []).map((o, i) => ({ ...o, id: `s-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setImageOverlays) setImageOverlays((prev: ImageOverlay[]) => [...prev, ...(c.imageOverlays ?? []).map((o, i) => ({ ...o, id: `i-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setSvgOverlays) setSvgOverlays((prev: SvgOverlay[]) => [...prev, ...(c.svgOverlays ?? []).map((o, i) => ({ ...o, id: `v-${ts}-${i}`, startTime: start, endTime: end }))])
    showToast(t('basicEditor.toast.addedAt', { name: c.name, time: currentTime.toFixed(1) }), 'success')
  }, [currentTime, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, pushSnapshot, showToast, t])

  const deleteCompound = useCallback((id: string) => {
    setSavedCompounds((prev: MotionCompound[]) => {
      const next = prev.filter((c) => c.id !== id)
      if (typeof window !== 'undefined') localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds, JSON.stringify(next))
      return next
    })
    showToast(t('basicEditor.toast.compoundRemoved'), 'info')
  }, [showToast, t])

  const [editingCompoundId, setEditingCompoundId] = useState<string | null>(null)
  const [editingCompoundName, setEditingCompoundName] = useState('')
  const renameCompound = useCallback((id: string, newName: string) => {
    const name = newName.trim() || t('basicEditor.compound.untitled')
    setSavedCompounds((prev: MotionCompound[]) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c))
      if (typeof window !== 'undefined') localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds, JSON.stringify(next))
      return next
    })
    setEditingCompoundId(null)
    setEditingCompoundName('')
    showToast(t('basicEditor.toast.renamed', { name }), 'success')
  }, [showToast, t])

  const GRADIENT_PRESETS: { id: string; name: string; nameKey: string; overlay: Omit<GradientOverlay, 'id' | 'startTime' | 'endTime'> }[] = [
    { id: 'lower-third', name: 'Lower third fade', nameKey: 'basicEditor.gradient.lowerThird', overlay: { direction: 'bottom-to-top', colorStops: ['transparent', 'rgba(0,0,0,0.85)'], opacity: 1, region: 'lower-third' } },
    { id: 'full-dark', name: 'Full darken', nameKey: 'basicEditor.gradient.fullDark', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)'], opacity: 1, region: 'full' } },
    { id: 'top-bar', name: 'Top bar', nameKey: 'basicEditor.gradient.topBar', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.6)', 'transparent'], opacity: 1, region: 'top-bar' } },
    { id: 'warm-tint', name: 'Warm tint', nameKey: 'basicEditor.gradient.warmTint', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(255,180,100,0.2)', 'transparent'], opacity: 1, region: 'full' } },
    { id: 'cool-tint', name: 'Cool tint', nameKey: 'basicEditor.gradient.coolTint', overlay: { direction: 'bottom-to-top', colorStops: ['rgba(100,150,255,0.18)', 'transparent'], opacity: 1, region: 'full' } },
    { id: 'bottom-half', name: 'Bottom half fade', nameKey: 'basicEditor.gradient.bottomHalf', overlay: { direction: 'bottom-to-top', colorStops: ['transparent', 'rgba(0,0,0,0.7)'], opacity: 1, region: 'bottom-half' } },
    { id: 'top-half', name: 'Top half fade', nameKey: 'basicEditor.gradient.topHalf', overlay: { direction: 'top-to-bottom', colorStops: ['transparent', 'rgba(0,0,0,0.5)'], opacity: 1, region: 'top-half' } },
    { id: 'vignette-soft', name: 'Soft vignette', nameKey: 'basicEditor.gradient.vignetteSoft', overlay: { direction: 'radial', colorStops: ['transparent', 'rgba(0,0,0,0.4)'], opacity: 1, region: 'full' } },
  ]
  const addGradientOverlay = useCallback((preset: typeof GRADIENT_PRESETS[0]) => {
    if (!setGradientOverlays) return
    const start = currentTime
    const end = Math.min(currentTime + 10, duration)
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setGradientOverlays((prev) => [
      ...prev,
      { id: `grad-${Date.now()}`, ...preset.overlay, startTime: start, endTime: end },
    ])
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    showToast(t('basicEditor.toast.addedName', { name: t(preset.nameKey) }), 'success')
  }, [currentTime, duration, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setGradientOverlays, setOpenSections, pushSnapshot, showToast, t])


  const cycleCompareMode = useCallback(() => {
    if (!setCompareMode) return
    setCompareMode(compareMode === 'after' ? 'before' : compareMode === 'before' ? 'split' : 'after')
  }, [compareMode, setCompareMode])
  const customTextInputRef = useRef<HTMLInputElement>(null)
  const [textCustom, setTextCustom] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [textPresetSearch, setTextPresetSearch] = useState('')
  const [textDuration, setTextDuration] = useState<number>(5)
  const [placeNextAtEnd, setPlaceNextAtEnd] = useState(false)
  const [customStyleName, setCustomStyleName] = useState('')
  const [showSaveStyle, setShowSaveStyle] = useState(false)
  const [presetSearchQuery, setPresetSearchQuery] = useState('')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])


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
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key || '').toLowerCase() === 't') {
        e.preventDefault()
        setOpenSections((prev) => ({ ...prev, text: true }))
        setTimeout(() => customTextInputRef.current?.focus(), 100)
        showToast(t('basicEditor.toast.addTextHint'), 'info')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showToast, t])

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
    return TEXT_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredViralHooks = useMemo(() => {
    if (!textPresetSearch.trim()) return VIRAL_HOOK_PRESETS
    const q = textPresetSearch.toLowerCase()
    return VIRAL_HOOK_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredEndScreens = useMemo(() => {
    if (!textPresetSearch.trim()) return END_SCREEN_TEMPLATES
    const q = textPresetSearch.toLowerCase()
    return END_SCREEN_TEMPLATES.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredReactionCallouts = useMemo(() => {
    if (!textPresetSearch.trim()) return REACTION_CALLOUT_PRESETS
    const q = textPresetSearch.toLowerCase()
    return REACTION_CALLOUT_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredTrending = useMemo(() => {
    if (!textPresetSearch.trim()) return TRENDING_PRESETS
    const q = textPresetSearch.toLowerCase()
    return TRENDING_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredChapter = useMemo(() => {
    if (!textPresetSearch.trim()) return CHAPTER_PRESETS
    const q = textPresetSearch.toLowerCase()
    return CHAPTER_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const filteredPremiumCaptions = useMemo(() => {
    if (!textPresetSearch.trim()) return PREMIUM_CAPTION_PRESETS
    const q = textPresetSearch.toLowerCase()
    return PREMIUM_CAPTION_PRESETS.filter((p) => presetMatches(p, q))
  }, [textPresetSearch, presetMatches])

  const getTextStartEnd = useCallback(() => {
    const end = textDuration === -1 ? duration : Math.min(currentTime + textDuration, duration)
    return { startTime: currentTime, endTime: Math.max(currentTime + 0.5, end) }
  }, [currentTime, duration, textDuration])

  const handleAddOverlay = useCallback((input: string | TextPresetConfig, atEnd = false, shouldSnapshot = true) => {
    if (shouldSnapshot) pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    const d = duration ?? 60
    const { startTime, endTime } = atEnd
      ? { startTime: Math.max(0, d - 5), endTime: d }
      : getTextStartEnd()
    const localized = typeof input === 'object' ? { ...input, text: presetText(input) } : input
    addOverlay(setTextOverlays, localized, showToast, templateLayout, startTime, endTime, t('basicEditor.toast.textAdded'))
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    const text = typeof input === 'object' ? input.text : input
    if (typeof input === 'string' && text.trim()) {
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.lastCustomText, text) } catch { /* ignore */ }
      setLastCustomText(text)
    }
    // Snapshots are intentional point-in-time captures; including all overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTextStartEnd, setTextOverlays, showToast, templateLayout, videoFilters, textOverlays, pushSnapshot, presetText, t])

  /** One-click creativity packs: combine text + motion + gradient for common workflows */
  const CREATIVITY_PACKS: { id: string; nameKey: string; descKey: string }[] = [
    { id: 'hook-cta', nameKey: 'basicEditor.pack.hookCta.name', descKey: 'basicEditor.pack.hookCta.desc' },
    { id: 'lower-third-subscribe', nameKey: 'basicEditor.pack.lowerThirdSubscribe.name', descKey: 'basicEditor.pack.lowerThirdSubscribe.desc' },
    { id: 'full-cta-bar', nameKey: 'basicEditor.pack.fullCtaBar.name', descKey: 'basicEditor.pack.fullCtaBar.desc' },
    { id: 'intro-outro', nameKey: 'basicEditor.pack.introOutro.name', descKey: 'basicEditor.pack.introOutro.desc' },
    { id: 'trending-save', nameKey: 'basicEditor.pack.trendingSave.name', descKey: 'basicEditor.pack.trendingSave.desc' },
  ]
  const applyCreativityPack = useCallback((packId: string) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    if (packId === 'hook-cta') {
      handleAddOverlay(VIRAL_HOOK_PRESETS[0], false, false)
      handleAddOverlay(END_SCREEN_TEMPLATES[4], true, false) // Like & Subscribe at end
      showToast(t('basicEditor.toast.packApplied', { name: t('basicEditor.pack.hookCta.name') }), 'success')
    } else if (packId === 'lower-third-subscribe') {
      handleAddOverlay(TEXT_PRESETS.find((p) => p.label === 'Lower third')!, false, false)
      const tpl = MOTION_GRAPHIC_TEMPLATES.find((x) => x.id === 'subscribe-bug')
      if (tpl) applyMotionGraphicTemplate(tpl)
      showToast(t('basicEditor.toast.packApplied', { name: t('basicEditor.pack.lowerThirdSubscribe.name') }), 'success')
    } else if (packId === 'full-cta-bar' && setGradientOverlays) {
      handleAddOverlay(END_SCREEN_TEMPLATES[4], true)
      addGradientOverlay(GRADIENT_PRESETS[0]) // lower-third
      showToast(t('basicEditor.toast.packApplied', { name: t('basicEditor.pack.fullCtaBar.name') }), 'success')
    } else if (packId === 'intro-outro') {
      handleAddOverlay(CHAPTER_PRESETS[2], false, false) // Intro
      handleAddOverlay(END_SCREEN_TEMPLATES[7], true, false) // See you next time
      showToast(t('basicEditor.toast.packApplied', { name: t('basicEditor.pack.introOutro.name') }), 'success')
    } else if (packId === 'trending-save') {
      handleAddOverlay(TRENDING_PRESETS[0], false, false) // Unpopular opinion
      handleAddOverlay(TRENDING_PRESETS[5], false, false) // Save this
      showToast(t('basicEditor.toast.packApplied', { name: t('basicEditor.pack.trendingSave.name') }), 'success')
    }
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    // Snapshots are intentional point-in-time captures; including all overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, handleAddOverlay, applyMotionGraphicTemplate, addGradientOverlay, setGradientOverlays, showToast, t])

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
    showToast(t('basicEditor.toast.saved', { name: bundle.name }), 'success')
  }, [customStyleName, templateLayout, videoFilters, setTemplateLayout, showToast, t])

  const recentFiltersPresets = useMemo(() => recentFilterNames.map((n) => FILTER_PRESETS.find((p) => p.n === n)).filter(Boolean) as typeof FILTER_PRESETS, [recentFilterNames])

  /** Global preset search: filters, styles, platform, motion graphics, text presets */
  type PresetSearchHit =
    | { type: 'filter' | 'style' | 'platform'; id: string; label: string; desc?: string }
    | { type: 'text'; id: string; label: string; preset: TextPresetConfig }
    | { type: 'motion'; id: string; label: string; template: MotionGraphicTemplate }
  const presetSearchResults = useMemo((): PresetSearchHit[] => {
    const q = presetSearchQuery.trim().toLowerCase()
    if (q.length < 2) return []
    const out: PresetSearchHit[] = []
    FILTER_PRESETS.forEach((p) => {
      if ([p.n, p.desc, filterName(p), filterDesc(p)].some((s) => s.toLowerCase().includes(q))) out.push({ type: 'filter', id: p.n, label: filterName(p), desc: filterDesc(p) })
    })
    STYLE_BUNDLES.forEach((b) => {
      if ([b.label, b.desc, bundleLabel(b), t(b.descKey)].some((s) => s.toLowerCase().includes(q))) out.push({ type: 'style', id: b.id, label: bundleLabel(b), desc: t(b.descKey) })
    })
    PLATFORM_BUNDLES.forEach((b) => {
      if ([b.label, b.desc, bundleLabel(b), t(b.descKey)].some((s) => s.toLowerCase().includes(q))) out.push({ type: 'platform', id: b.id, label: bundleLabel(b), desc: t(b.descKey) })
    })
    MOTION_GRAPHIC_TEMPLATES.forEach((tpl) => {
      if (tpl.name.toLowerCase().includes(q) || tpl.description.toLowerCase().includes(q)) out.push({ type: 'motion', id: tpl.id, label: tpl.name, template: tpl })
    })
      ;[...TEXT_PRESETS, ...VIRAL_HOOK_PRESETS, ...END_SCREEN_TEMPLATES, ...TRENDING_PRESETS, ...CHAPTER_PRESETS, ...PREMIUM_CAPTION_PRESETS].forEach((p) => {
        if (presetMatches(p, q)) out.push({ type: 'text', id: `text-${p.label}`, label: presetLabel(p), preset: p })
      })
    return out.slice(0, 14)
  }, [presetSearchQuery, filterName, filterDesc, bundleLabel, presetMatches, presetLabel, t])
  const recentStyleBundlesList = useMemo(() => {
    type StyleItem = { id: string; label: string; layout: TemplateLayout; filter: Record<string, number>; desc?: string; swatch?: string }
    const list: StyleItem[] = []
    const toNumericFilter = (f: Record<string, number | undefined>): Record<string, number> =>
      Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'number') as [string, number][]) as Record<string, number>
    recentStyleIds.forEach((id) => {
      const builtIn = STYLE_BUNDLES.find((b) => b.id === id)
      if (builtIn) list.push({ ...builtIn, label: bundleLabel(builtIn), desc: t(builtIn.descKey), filter: toNumericFilter(builtIn.filter as Record<string, number | undefined>) })
      else {
        const custom = customStyleBundles.find((b) => b.id === id)
        if (custom) list.push({ ...custom, label: custom.name, desc: t('basicEditor.style.savedDesc') })
      }
    })
    return list.slice(0, 5)
  }, [recentStyleIds, customStyleBundles, bundleLabel, t])

  const applyPlatformBundle = useCallback((bundle: typeof PLATFORM_BUNDLES[0]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => replaceLook(prev, bundle.filter))
    showToast(`${bundleLabel(bundle)} — ${t(bundle.descKey)}`, 'success')
    // Snapshots are intentional point-in-time captures; including all overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, setVideoFilters, showToast, bundleLabel, t])

  const resetFilters = useCallback(() => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setVideoFilters({ ...RESET_FILTER })
    showToast(t('basicEditor.toast.filtersReset'), 'info')
    // Snapshots are intentional point-in-time captures; including all overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setVideoFilters, showToast, t])

  const saveStyleInputRef = useRef<HTMLInputElement>(null)
  const openSaveStyleInline = useCallback(() => {
    setShowSaveStyle(true)
    toggleSection('styleBundles')
    setTimeout(() => saveStyleInputRef.current?.focus(), 150)
    showToast(t('basicEditor.toast.nameYourStyle'), 'info')
  }, [toggleSection, showToast, t])

  const applyPresetSearchResult = useCallback((r: PresetSearchHit) => {
    if (r.type === 'filter') {
      const p = FILTER_PRESETS.find((x) => x.n === r.id)
      if (p) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setVideoFilters((prev) => replaceLook(prev, p.f)); pushRecentFilter(p.n); showToast(t('basicEditor.toast.applied', { name: filterName(p) }), 'success') }
    } else if (r.type === 'style') {
      const b = STYLE_BUNDLES.find((x) => x.id === r.id)
      if (b) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev) => replaceLook(prev, b.filter)); pushRecentStyle(b.id); showToast(t('basicEditor.toast.applied', { name: bundleLabel(b) }), 'success') }
    } else if (r.type === 'platform') {
      const b = PLATFORM_BUNDLES.find((x) => x.id === r.id)
      if (b) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev) => replaceLook(prev, b.filter)); showToast(t('basicEditor.toast.applied', { name: bundleLabel(b) }), 'success') }
    } else if (r.type === 'text') {
      handleAddOverlay(r.preset)
      showToast(t('basicEditor.toast.addedQuoted', { name: r.label }), 'success')
    } else if (r.type === 'motion') {
      const tpl = MOTION_GRAPHIC_TEMPLATES.find((x) => x.id === r.id)
      if (tpl) applyMotionGraphicTemplate(tpl)
    }
    setPresetSearchQuery('')
  }, [templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setVideoFilters, setTemplateLayout, handleAddOverlay, applyMotionGraphicTemplate, pushSnapshot, showToast, pushRecentFilter, pushRecentStyle, filterName, bundleLabel, t])

  /** One-click creativity: apply a style bundle (layout + filter) for instant look */
  const applyStyleBundleOneClick = useCallback((bundle: typeof STYLE_BUNDLES[0]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => replaceLook(prev, bundle.filter as Partial<VideoFilter>))
    pushRecentStyle(bundle.id)
    showToast(`${bundleLabel(bundle)} — ${t(bundle.descKey)}`, 'success')
    // Snapshots are intentional point-in-time captures; including all overlay arrays would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, pushRecentStyle, showToast, bundleLabel, t])

  const layoutLabel = TEMPLATE_LAYOUTS.find((t) => t.id === templateLayout)?.label ?? 'Auto'
  const overlayCount = (textOverlays?.length ?? 0) + (shapeOverlays?.length ?? 0) + (imageOverlays?.length ?? 0) + (svgOverlays?.length ?? 0) + (gradientOverlays?.length ?? 0)
  const hasLook = Object.keys(videoFilters).some((k) => {
    const v = (videoFilters as unknown as Record<string, number>)[k]
    return typeof v === 'number' && v !== 100 && v !== 0
  })

  // ── Tab state ─────────────────────────────────────────────────────────────
  const EDIT_TABS = [
    { id: 'trim',     icon: Scissors,          label: 'Trim',    shortcut: 'T', altShortcut: '⌥T' },
    { id: 'text',     icon: Type,              label: 'Text',    shortcut: 'X', altShortcut: '⌥X' },
    { id: 'filters',  icon: SlidersHorizontal, label: 'Filters', shortcut: 'F', altShortcut: '⌥F' },
    { id: 'motion',   icon: Wand2,             label: 'Motion',  shortcut: 'M', altShortcut: '⌥M' },
    { id: 'overlays', icon: Layers,            label: 'Layers',  shortcut: 'L', altShortcut: '⌥L' },
    { id: 'packs',    icon: Zap,               label: 'Packs',   shortcut: 'P', altShortcut: '⌥P' },
    { id: 'insights', icon: BarChart3,         label: 'Data',    shortcut: 'I', altShortcut: '⌥I' },
  ] as const
  type EditTab = typeof EDIT_TABS[number]['id']

  const [activeEditTab, setActiveEditTab] = React.useState<EditTab>('text')
  const [speedValue, setSpeedValue] = React.useState(playbackSpeed ?? 1)

  React.useEffect(() => {
    if (playbackSpeed !== undefined) {
      setSpeedValue(playbackSpeed)
    }
  }, [playbackSpeed])

  const handleSpeedChange = (val: number) => {
    setSpeedValue(val)
    setPlaybackSpeed?.(val)
    showToast(t('basicEditor.toast.speed', { value: val }), 'info')
  }

  const [selectedFilterName, setSelectedFilterName] = React.useState('')
  const [globalSearch, setGlobalSearch] = React.useState('')
  const [layerOpacities, setLayerOpacities] = React.useState<Record<string, number>>({})
  const [captionLoading, setCaptionLoading] = React.useState(false)
  const [captionStyle, setCaptionStyle] = React.useState<'tiktok-pop' | 'hormozi-bold' | 'minimal-white' | 'neon-glow' | 'vlog-kinetic' | 'cyberpunk-neon' | 'oled-darkroom' | 'youtube-shorts' | 'meme-impact' | 'retro-vhs' | 'serif-quote'>('tiktok-pop')
  const captionStyleLabel = useCallback((id: string) => {
    const s = CAPTION_STYLE_OPTIONS.find((x) => x.id === id)
    return s ? ('labelKey' in s ? t(s.labelKey) : s.label) : id
  }, [t])
  const [captionError, setCaptionError] = React.useState<string | null>(null)
  const [captionSuccess, setCaptionSuccess] = React.useState<number | null>(null)  // count of captions added
  const [wordsPerCap, setWordsPerCap] = React.useState(4)
  const [captionY, setCaptionY] = React.useState<'top' | 'mid' | 'bottom'>('bottom')
  const [captionColor, setCaptionColor] = React.useState('#FFFFFF')
  const [manualTranscript, setManualTranscript] = React.useState('')
  const [translatingCaptions, setTranslatingCaptions] = React.useState(false)
  const [targetTranslationLanguage, setTargetTranslationLanguage] = React.useState('es')
  const [emojiEffect, setEmojiEffect] = React.useState<'pop' | 'bounce' | 'slide' | 'pulse' | 'shake' | 'blur'>('pop')
  const [emojiStyle, setEmojiStyle] = React.useState<'3d-bold' | 'neon-glow' | 'flat'>('3d-bold')
  const [generatingEmojis, setGeneratingEmojis] = React.useState(false)
  const [emojiFontSize, setEmojiFontSize] = React.useState<number>(48)
  const [emojiDensity, setEmojiDensity] = React.useState<number>(6)
  const [emojiAnimOut, setEmojiAnimOut] = React.useState<'fade' | 'pop' | 'slide-bottom' | 'bounce-out' | 'scale-out' | 'zoom-out' | 'flip-out'>('fade')
  const [emojiAnimInDuration, setEmojiAnimInDuration] = React.useState<number>(0.45)
  const [emojiAnimOutDuration, setEmojiAnimOutDuration] = React.useState<number>(0.3)
  const [emojiYPosition, setEmojiYPosition] = React.useState<'above' | 'head' | 'below' | 'custom-top'>('above')
  const filtStrength = filterStrength ?? 100
  const setFiltStrength = setFilterStrength ?? (() => {})

  // Auto-caption: calls Whisper-backed caption endpoint then injects overlays
  const handleAutoCaption = useCallback(async () => {
    const transcriptText = transcript?.fullText ?? manualTranscript
    if (!transcriptText.trim()) {
      setCaptionError(t('basicEditor.caption.noTranscript'))
      return
    }
    setCaptionLoading(true)
    setCaptionError(null)
    setCaptionSuccess(null)
    try {
      const yPct = captionY === 'top' ? 18 : captionY === 'mid' ? 50 : 82
      const resp = await apiPost('/video/hook-analysis/auto-caption', {
        transcript: transcriptText,
        videoId,
        style: captionStyle,
        wordsPerCaption: wordsPerCap,
        duration,
      }) as { data?: { captions?: Array<{ id: string; text: string; startTime: number; endTime: number; style: string }>; totalCaptions?: number }; captions?: Array<{ id: string; text: string; startTime: number; endTime: number; style: string }>; totalCaptions?: number }
      // Envelope-aware: the route wraps the payload as { data: { captions } }.
      const data = (resp?.data ?? resp) || {}

      if (!data?.captions?.length) {
        setCaptionError(t('basicEditor.caption.noneGenerated'))
        return
      }

      // Map caption segments to TextOverlay objects using user-controlled settings
      const ts = Date.now()
      type CaptionDefaults = { fontSize: number; style: TextOverlayStyle; fontFamily: string }
      const captionStyleMap: Record<string, CaptionDefaults> = {
        'tiktok-pop':     { fontSize: 36, style: 'bold-kinetic', fontFamily: 'Inter' },
        'hormozi-bold':   { fontSize: 42, style: 'bold-kinetic', fontFamily: 'Inter' },
        'minimal-white':  { fontSize: 28, style: 'none',         fontFamily: 'Inter' },
        'neon-glow':      { fontSize: 34, style: 'neon',          fontFamily: 'Inter' },
        'vlog-kinetic':   { fontSize: 40, style: 'bold-kinetic', fontFamily: 'Inter' },
        'cyberpunk-neon': { fontSize: 38, style: 'neon',          fontFamily: 'Courier New' },
        'oled-darkroom':  { fontSize: 32, style: 'outline',       fontFamily: 'Inter' },
        'youtube-shorts': { fontSize: 38, style: 'bold-kinetic', fontFamily: 'Inter' },
        'meme-impact':    { fontSize: 40, style: 'outline',       fontFamily: '"Anton", Impact, sans-serif' },
        'retro-vhs':      { fontSize: 34, style: 'neon',          fontFamily: 'Courier New' },
        'serif-quote':    { fontSize: 36, style: 'none',          fontFamily: 'Georgia' },
      }
      const def = captionStyleMap[captionStyle] ?? captionStyleMap['tiktok-pop']

      // Attach the transcript's word-level timings to each caption so the
      // "Word-by-word" (karaoke) toggle has data to sync to (block mode ignores it).
      const tWords: any[] = Array.isArray((transcript as any)?.words) ? (transcript as any).words : []
      const wordsFor = (s: number, e: number) => tWords
        .filter((w) => w && Number(w.start) >= s - 0.05 && Number(w.end) <= e + 0.05)
        .map((w) => ({ word: w.text || w.word || '', start: w.start, end: w.end }))

      const newOverlays: TextOverlay[] = data.captions.map((c, i) => ({
        id: `autocap-${ts}-${i}`,
        text: c.text,
        startTime: c.startTime,
        endTime: c.endTime,
        x: 50,
        y: yPct,
        fontSize: def.fontSize,
        color: captionColor,  // user-controlled color
        fontFamily: def.fontFamily,
        style: def.style,
        animationIn: 'fade' as const,
        animationOut: 'fade' as const,
        words: wordsFor(c.startTime, c.endTime),
        // Auto-highlight the punchy keywords (viral accent). Block mode ignores it.
        highlightWords: pickHighlightWords(c.text, 2),
        highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        // Auto-pick a relevant emoji (rendered with the caption; '' = none).
        emoji: pickCaptionEmoji(c.text),
      }))

      pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
      setTextOverlays((prev: TextOverlay[]) => [...prev, ...newOverlays])
      const captionCount = data.totalCaptions ?? data.captions?.length ?? 0
      setCaptionSuccess(captionCount)
      showToast(t('basicEditor.caption.addedToast', { count: captionCount, style: captionStyleLabel(captionStyle) }), 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('basicEditor.caption.generationFailed')
      setCaptionError(msg)
      showToast(t('basicEditor.caption.failedToast'), 'error')
    } finally {
      setCaptionLoading(false)
    }
  }, [transcript, manualTranscript, videoId, captionStyle, wordsPerCap, captionY, captionColor, duration, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, pushSnapshot, setTextOverlays, showToast, captionStyleLabel, t])

  const handleTranslateCaptions = useCallback(async () => {
    if (!textOverlays || textOverlays.length === 0) {
      showToast(t('basicEditor.translate.noCaptions'), 'error')
      return
    }
    setTranslatingCaptions(true)
    try {
      showToast(t('basicEditor.translate.inProgress'), 'info')
      const res = await apiPost<{ success?: boolean; data?: TextOverlay[] }>(
        '/video/captions/translate-overlays',
        {
          overlays: textOverlays,
          targetLanguage: targetTranslationLanguage
        }
      )
      const data = (res as any)?.data ?? (res as any)
      if (Array.isArray(data) && data.length > 0) {
        pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
        setTextOverlays(data)
        showToast(t('basicEditor.translate.done', { language: targetTranslationLanguage.toUpperCase() }), 'success')
      } else {
        showToast(t('basicEditor.translate.empty'), 'info')
      }
    } catch (err: any) {
      console.error('Translation error', err)
      // Surface the server's honest message (e.g. "AI translation is not
      // configured…" / "produced no changes…") verbatim rather than a generic
      // failure, so a no-op translation is never mistaken for a success.
      const msg = err?.response?.data?.error || err?.data?.error || err?.message || t('basicEditor.translate.failed')
      showToast(msg, 'error')
    } finally {
      setTranslatingCaptions(false)
    }
  }, [textOverlays, targetTranslationLanguage, templateLayout, videoFilters, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, pushSnapshot, setTextOverlays, showToast, t])

  const handleGenerateAiEmojis = useCallback(async () => {
    if (!transcript?.words || transcript.words.length === 0) {
      showToast(t('basicEditor.emoji.noTranscript'), 'error')
      return
    }
    
    setGeneratingEmojis(true)
    try {
      showToast(t('basicEditor.emoji.inProgress'), 'info')
      
      // Delay slightly for dramatic modern effect
      await new Promise(r => setTimeout(r, 600))
      
      const wordsList = transcript.words
      const newEmojiOverlays: TextOverlay[] = []
      const ts = Date.now()
      
      const maxWordsPerChunk = emojiDensity
      for (let i = 0; i < wordsList.length; i += maxWordsPerChunk) {
        const chunk = wordsList.slice(i, i + maxWordsPerChunk)
        const matchingEmoji = getMatchingEmojiForChunk(
          chunk.map(w => ({ word: w.text || '', start: w.start, end: w.end })),
          chunk[0] ? { word: chunk[0].text || '', start: chunk[0].start, end: chunk[0].end } : null
        )
        
        if (matchingEmoji) {
          const startTime = chunk[0].start
          const endTime = chunk[chunk.length - 1].end
          
          // Offset Y position based on user preference
          let yPct = captionY === 'top' ? 32 : captionY === 'mid' ? 68 : 62
          if (emojiYPosition === 'head') {
            yPct = 25 // Head level / top section
          } else if (emojiYPosition === 'below') {
            yPct = captionY === 'top' ? 24 : captionY === 'mid' ? 56 : 88 // Below subtitles
          } else if (emojiYPosition === 'custom-top') {
            yPct = 12 // High above
          } else if (emojiYPosition === 'above') {
            yPct = captionY === 'top' ? 32 : captionY === 'mid' ? 38 : 62 // Default offset above subtitles
          }
          
          newEmojiOverlays.push({
            id: `aiemoji-${ts}-${i}`,
            text: matchingEmoji,
            startTime: startTime,
            endTime: endTime,
            x: 50,
            y: yPct,
            fontSize: emojiFontSize,
            color: '#ffffff',
            fontFamily: 'Inter',
            style: emojiStyle === 'neon-glow' ? 'neon' : emojiStyle === 'flat' ? 'minimal' : 'bold-kinetic',
            animationIn: emojiEffect === 'pop' ? 'pop' : emojiEffect === 'bounce' ? 'bounce' : emojiEffect === 'slide' ? 'slide-bottom' : emojiEffect === 'blur' ? 'blur-in' : 'fade',
            animationOut: emojiAnimOut,
            animationInDuration: emojiAnimInDuration,
            animationOutDuration: emojiAnimOutDuration,
            motionGraphic: emojiEffect === 'shake' ? 'shake' : emojiEffect === 'pulse' ? 'pulse' : 'none'
          })
        }
      }
      
      if (newEmojiOverlays.length === 0) {
        showToast(t('basicEditor.emoji.noneFound'), 'info')
        return
      }
      
      pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
      setTextOverlays((prev: TextOverlay[]) => [...prev, ...newEmojiOverlays])
      showToast(t('basicEditor.emoji.added', { count: newEmojiOverlays.length }), 'success')
    } catch (err: any) {
      showToast(t('basicEditor.emoji.failed'), 'error')
    } finally {
      setGeneratingEmojis(false)
    }
  }, [transcript, captionY, emojiEffect, emojiStyle, emojiFontSize, emojiDensity, emojiAnimOut, emojiAnimInDuration, emojiAnimOutDuration, emojiYPosition, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, pushSnapshot, setTextOverlays, showToast, t])

  // Keyboard shortcut to switch tabs
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const tab = EDIT_TABS.find(t => t.shortcut === e.key.toUpperCase())
        if (tab) { e.preventDefault(); setActiveEditTab(tab.id) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // EDIT_TABS is a static module-level constant; including it is unnecessary
    // and the linter still flags via React.useEffect alias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global search: routes to the right tab
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (q.length < 2) return []
    type Hit = { label: string; tab: EditTab; action: () => void }
    const hits: Hit[] = []
    FILTER_PRESETS.forEach(p => {
      if (p.n.toLowerCase().includes(q) || filterName(p).toLowerCase().includes(q)) hits.push({ label: t('basicEditor.search.filterHit', { name: filterName(p) }), tab: 'filters', action: () => { applyFilter(p); setGlobalSearch('') } })
    })
    STYLE_BUNDLES.forEach(b => {
      if (b.label.toLowerCase().includes(q) || bundleLabel(b).toLowerCase().includes(q)) hits.push({ label: t('basicEditor.search.styleHit', { name: bundleLabel(b) }), tab: 'packs', action: () => { applyStyleBundleOneClick(b); setGlobalSearch('') } })
    })
    MOTION_GRAPHIC_TEMPLATES.forEach(tpl => {
      if (tpl.name.toLowerCase().includes(q)) hits.push({ label: t('basicEditor.search.motionHit', { name: tpl.name }), tab: 'motion', action: () => { applyMotionGraphicTemplate(tpl); setGlobalSearch('') } })
    });[
      ...TEXT_PRESETS, ...VIRAL_HOOK_PRESETS, ...PREMIUM_CAPTION_PRESETS,
      ...TRENDING_PRESETS, ...END_SCREEN_TEMPLATES
    ].forEach(p => {
      if (presetMatches(p, q))
        hits.push({ label: t('basicEditor.search.textHit', { name: presetLabel(p) }), tab: 'text', action: () => { handleAddOverlay(p); setGlobalSearch('') } })
    })
    return hits.slice(0, 8)
    // The action callbacks (applyFilter, applyStyleBundleOneClick, etc.) are
    // declared in the same component body and recompute every render; adding
    // them would re-run this memo every render, defeating its purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearch, t])

  const applyFilter = (p: typeof FILTER_PRESETS[number]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setVideoFilters((prev: VideoFilter) => replaceLook(prev, p.f))
    pushRecentFilter(p.n)
    setSelectedFilterName(p.n)
    showToast(t('basicEditor.toast.applied', { name: filterName(p) }), 'success')
  }

  // CSS filter string for live preview
  const filterToCss = (f: Record<string, number | undefined>) => {
    const parts: string[] = []
    if (f.brightness != null)  parts.push(`brightness(${f.brightness / 100})`)
    if (f.contrast != null)    parts.push(`contrast(${f.contrast / 100})`)
    if (f.saturation != null)  parts.push(`saturate(${f.saturation / 100})`)
    if (f.sepia != null && f.sepia > 0) parts.push(`sepia(${f.sepia / 100})`)
    if (f.hue != null && f.hue !== 0) parts.push(`hue-rotate(${f.hue}deg)`)
    return parts.join(' ') || 'none'
  }

  const filteredMotionTemplates = useMemo(() => {
    const q = motionTemplateSearch.trim().toLowerCase()
    if (!q) return MOTION_GRAPHIC_TEMPLATES
    return MOTION_GRAPHIC_TEMPLATES.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
  }, [motionTemplateSearch])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full text-slate-200 overflow-hidden">

      {/* ── Sticky header ── */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-3 border-b border-white/[0.04] bg-surface-900/50 backdrop-blur-xl z-20 relative">
        {/* Undo/Redo & Global Search row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 rounded-xl p-0.5 border border-white/[0.06]">
            <button
              type="button"
              onClick={undo} disabled={undoStack.length === 0}
              title={t('basicEditor.undo')}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all text-slate-400 hover:text-white"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={redo} disabled={redoStack.length === 0}
              title={t('basicEditor.redo')}
              className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-25 transition-all text-slate-400 hover:text-white"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={t('basicEditor.searchTools')}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.06] text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 transition-all"
            />
            {globalSearch && (
              <button type="button" onClick={() => setGlobalSearch('')} aria-label={t('basicEditor.clearSearch')} title={t('basicEditor.clearSearch')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <span className="text-[10px] font-black">✕</span>
              </button>
            )}
          </div>

          {(overlayCount > 0 || hasLook) && (
            <div className="flex items-center gap-2 px-2">
              {overlayCount > 0 && <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{t('basicEditor.layersCount', { count: overlayCount })}</span>}
              {hasLook && <button type="button" onClick={resetFilters} className="text-[9px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors">{t('basicEditor.reset')}</button>}
            </div>
          )}
        </div>

        {/* Global search results dropdown */}
        <AnimatePresence>
          {globalSearchResults.length > 0 && (
            <m.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-3 right-3 top-[44px] bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
            >
              {globalSearchResults.map((r, i) => (
                <button type="button" key={i} onClick={() => { setActiveEditTab(r.tab); r.action() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-0"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-[11px] text-slate-200 font-bold">{r.label}</span>
                  <span className="ml-auto text-[9px] text-slate-600 font-bold uppercase tracking-widest">{t(`editor.tabs.${r.tab}`)}</span>
                </button>
              ))}
            </m.div>
          )}
        </AnimatePresence>

        {/* Sleek Tab bar */}
        <div className="flex justify-between items-center bg-black/60 backdrop-blur-xl p-1 rounded-2xl border border-white/10 shadow-inner shadow-black overflow-x-auto custom-scrollbar-thin select-none">
          {EDIT_TABS.map(({ id, icon: Icon, altShortcut }) => (
            <button
              type="button"
              key={id}
              onClick={() => setActiveEditTab(id)}
              title={`${t(`editor.tabs.${id}`)} (${altShortcut})`}
              className={`relative flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1.5 min-w-[48px] rounded-xl transition-all duration-300 z-10 group shrink-0 ${
                activeEditTab === id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeEditTab === id && (
                <m.div
                  layoutId="edit-tab-bg"
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-indigo-500/10 to-indigo-500/25 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <Icon className={`w-4 h-4 relative z-10 transition-transform group-hover:scale-110 ${activeEditTab === id ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap relative z-10">
                {t(`editor.tabs.${id}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

        {/* ════ TRIM ════ */}
        {activeEditTab === 'trim' && (
          <div className="space-y-3">
            {/* Waveform visual + playhead indicator */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('basicEditor.trim.waveform')}</span>
                <span className="text-[10px] font-black text-indigo-400 font-mono">{currentTime.toFixed(2)}s / {duration.toFixed(1)}s</span>
              </div>
              <div
                className="relative h-12 flex gap-px items-center overflow-hidden rounded-xl bg-black/40 cursor-pointer group/wave"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  onSeek?.(pct * Math.max(duration, 1))
                }}
                title={t('basicEditor.trim.clickToSeek')}
              >
                {Array.from({ length: 48 }, (_, i) => {
                  const h = 20 + Math.abs(Math.sin(i * 0.7) * 60 + Math.cos(i * 1.3) * 20)
                  const isCurrent = Math.abs(i / 48 - currentTime / Math.max(duration, 1)) < 0.025
                  return (
                    <div key={i} className="flex-1 flex items-center justify-center pointer-events-none">
                      <div
                        style={{ '--bar-height': `${Math.min(h, 95)}%` } as any}
                        className={`w-full rounded-sm transition-colors h-[var(--bar-height)] ${isCurrent ? 'bg-indigo-400' : i / 48 < currentTime / Math.max(duration, 1) ? 'bg-indigo-600/60' : 'bg-slate-600/40'}`}
                      />
                    </div>
                  )
                })}
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] pointer-events-none left-[var(--playhead-pos)]"
                  style={{ '--playhead-pos': `${(currentTime / Math.max(duration, 1)) * 100}%` } as any}
                />
              </div>
            </div>

            {/* Speed ramp */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('basicEditor.trim.speed')}</span>
                <span className={`text-sm font-black font-mono ${speedValue < 1 ? 'text-cyan-400' : speedValue > 1 ? 'text-orange-400' : 'text-indigo-400'}`}>{speedValue}×</span>
              </div>
              <input
                type="range" min={0.25} max={4} step={0.25} value={speedValue}
                onChange={e => handleSpeedChange(Number(e.target.value))}
                aria-label={t('basicEditor.trim.playbackSpeedAria', { value: speedValue })}
                title={t('basicEditor.trim.playbackSpeedAria', { value: speedValue })}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between mt-1.5">
                {[0.25, 0.5, 1, 1.5, 2, 3, 4].map(v => (
                  <button type="button" key={v} onClick={() => handleSpeedChange(v)}
                    className={`text-[8px] font-black px-1.5 py-1 rounded-lg transition-all ${speedValue === v ? 'bg-indigo-600 text-white' : 'bg-white/[0.04] text-slate-500 hover:text-white hover:bg-white/10 border border-white/[0.06]'}`}
                  >{v}×</button>
                ))}
              </div>
            </div>

            {/* Edit tools grid
                All six ops route to ModernVideoEditor handlers backed by the
                segment-aware ffmpeg renderer (server/services/segmentTimelineRenderer.js).
                Reverse / J-Cut / L-Cut require a selected segment; the others
                operate on the segment under the playhead. */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: RotateCcw, label: t('basicEditor.trim.reverse'), sub: hasSegmentSelection ? t('basicEditor.trim.reverseSub') : t('basicEditor.trim.selectClipFirst'), color: 'text-violet-400', action: () => onReverseSelected?.(), comingSoon: !onReverseSelected, requiresSelection: true },
                { icon: Split, label: t('basicEditor.trim.split'), sub: `@ ${currentTime.toFixed(1)}s`, color: 'text-indigo-400', action: () => onSplitAtPlayhead?.(), comingSoon: !onSplitAtPlayhead, requiresSelection: false },
                { icon: Music, label: t('basicEditor.trim.beatCut'), sub: t('basicEditor.trim.beatCutSub'), color: 'text-pink-400', action: () => onBeatCut?.(), comingSoon: !onBeatCut, requiresSelection: false },
                { icon: Maximize, label: t('basicEditor.trim.freeze'), sub: t('basicEditor.trim.freezeSub', { time: currentTime.toFixed(1) }), color: 'text-amber-400', action: () => onFreezeAtPlayhead?.(1.0), comingSoon: !onFreezeAtPlayhead, requiresSelection: false },
                { icon: Scissors, label: t('basicEditor.trim.trimToInOut'), sub: trimInPoint != null && trimOutPoint != null ? `${(trimOutPoint - trimInPoint).toFixed(2)}s` : t('basicEditor.trim.trimToInOutSub'), color: 'text-emerald-400', action: () => {
                  if (trimInPoint == null || trimOutPoint == null) {
                    showToast(t('basicEditor.trim.setBothFirst'), 'info')
                    return
                  }
                  onTrimSelectedToRange?.(trimInPoint, trimOutPoint)
                }, comingSoon: !onTrimSelectedToRange, requiresSelection: true },
                { icon: ArrowLeft, label: t('basicEditor.trim.jCut'), sub: hasSegmentSelection ? t('basicEditor.trim.jCutSub') : t('basicEditor.trim.selectClipFirst'), color: 'text-rose-400', action: () => onJCutSelected?.(0.5), comingSoon: !onJCutSelected, requiresSelection: true },
                { icon: ChevronRight, label: t('basicEditor.trim.lCut'), sub: hasSegmentSelection ? t('basicEditor.trim.lCutSub') : t('basicEditor.trim.selectClipFirst'), color: 'text-pink-400', action: () => onLCutSelected?.(0.5), comingSoon: !onLCutSelected, requiresSelection: true },
              ].map(({ icon: Icon, label, sub, color, action, comingSoon, requiresSelection }) => {
                const disabled = !!comingSoon || (requiresSelection && !hasSegmentSelection)
                const titleText = comingSoon
                  ? t('basicEditor.trim.comingSoonTitle', { label })
                  : (requiresSelection && !hasSegmentSelection ? t('basicEditor.trim.selectClipTitle', { label }) : label)
                return (
                  <m.button
                    key={label}
                    type="button"
                    onClick={disabled ? undefined : action}
                    disabled={disabled}
                    whileHover={disabled ? undefined : { y: -1 }}
                    whileTap={disabled ? undefined : { scale: 0.97 }}
                    title={titleText}
                    aria-disabled={disabled || undefined}
                    className={`relative flex items-start gap-2.5 px-3 py-3 rounded-xl border transition-all text-left ${
                      disabled
                        ? 'bg-white/[0.015] border-white/[0.04] opacity-50 cursor-not-allowed'
                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/20'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                    <div>
                      <div className="text-[10px] font-black text-slate-200 leading-tight">{label}</div>
                      <div className="text-[8px] text-slate-600 mt-0.5">{sub}</div>
                    </div>
                    {comingSoon && (
                      <span className="absolute top-1.5 right-1.5 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        {t('basicEditor.trim.soon')}
                      </span>
                    )}
                  </m.button>
                )
              })}
            </div>

            {/* In / Out marker controls — drives the Trim to In/Out op above. */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('basicEditor.trim.markers')}</span>
                <span className="text-[9px] font-mono text-slate-500">
                  {trimInPoint != null ? t('basicEditor.trim.inAt', { time: trimInPoint.toFixed(2) }) : t('basicEditor.trim.noIn')} · {trimOutPoint != null ? t('basicEditor.trim.outAt', { time: trimOutPoint.toFixed(2) }) : t('basicEditor.trim.noOut')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                 type="button"
                  onClick={() => {
                    setTrimInPoint(currentTime)
                    if (trimOutPoint != null && currentTime >= trimOutPoint) setTrimOutPoint(null)
                    showToast(t('basicEditor.trim.inSet', { time: currentTime.toFixed(2) }), 'success')
                  }}
                  className="px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                >
                  {t('basicEditor.trim.setIn')}
                </button>
                <button
                 type="button"
                  onClick={() => {
                    if (trimInPoint != null && currentTime <= trimInPoint) {
                      showToast(t('basicEditor.trim.outAfterIn'), 'error')
                      return
                    }
                    setTrimOutPoint(currentTime)
                    showToast(t('basicEditor.trim.outSet', { time: currentTime.toFixed(2) }), 'success')
                  }}
                  className="px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                >
                  {t('basicEditor.trim.setOut')}
                </button>
                <button
                 type="button"
                  onClick={() => {
                    setTrimInPoint(null)
                    setTrimOutPoint(null)
                  }}
                  disabled={trimInPoint == null && trimOutPoint == null}
                  className="px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('basicEditor.trim.clear')}
                </button>
              </div>
            </div>

            {/* Format / Aspect Ratio */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{t('editor.aspectRatio')}</span>
              <div className="grid grid-cols-3 gap-1.5">
                {TEMPLATE_LAYOUTS.map(l => (
                  <m.button key={l.id} whileTap={{ scale: 0.96 }}
                    onClick={() => { pushSnapshot(l.id, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(l.id); showToast(t('basicEditor.toast.applied', { name: t(`basicEditor.layout.${l.id}`) }), 'success') }}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${templateLayout === l.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/[0.02] text-slate-400 hover:bg-white/10 hover:text-white border border-white/[0.06]'}`}
                  >{t(`basicEditor.layout.${l.id}`)}</m.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ TEXT ════ */}
        {activeEditTab === 'text' && (
          <div className="space-y-3">
            {selectedTextId && (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(99,102,241,0.15)] relative overflow-hidden"
              >
                <div className="flex items-center gap-2 relative z-10">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{t('basicEditor.text.editingOnCanvas')}</span>
                    <span className="text-[7.5px] text-slate-500 font-bold uppercase mt-1 leading-none">{t('basicEditor.text.doubleClickHint')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTextId(null)}
                  className="text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-200 transition-colors bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20"
                >
                  {t('basicEditor.text.deselect')}
                </button>
              </m.div>
            )}

            {/* Quick add */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex gap-2 mb-2">
                <input
                  ref={customTextInputRef}
                  value={textCustom}
                  onChange={e => setTextCustom(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { handleAddOverlay(textCustom || t('basicEditor.text.newText')); setTextCustom('') } }}
                  placeholder={t('basicEditor.text.typePlaceholder')}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-xs font-medium placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => { if (textCustom.trim()) { handleAddOverlay(textCustom); setTextCustom('') } else { handleAddOverlay(t('basicEditor.text.newText')) } }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shrink-0"
                >{t('basicEditor.add')}</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t('basicEditor.text.duration')}</span>
                {[-1, 3, 5, 8, 15].map(d => (
                  <button type="button" key={d} onClick={() => setTextDuration(d)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${textDuration === d ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                  >{d === -1 ? '∞' : `${d}s`}</button>
                ))}
              </div>
            </div>

            {/* ── Brand Kit ───────────────────────────────────────────── */}
            <div className="mb-6">
              <BrandKit
                showToast={showToast}
                onApply={(kit) => {
                  setCaptionColor(kit.primaryColor)
                  setCaptionY(kit.logoPosition.includes('top') ? 'top' : 'bottom')
                  // Other kit properties can be applied here as needed
                }}
              />
            </div>

            {/* ── Auto-Caption ─────────────────────────────────────────── */}
            <div className="rounded-2xl bg-gradient-to-b from-indigo-600/10 to-purple-600/5 border border-indigo-500/20 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{t('basicEditor.caption.title')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Auto-cap count badge */}
                  {(() => { const autoCaps = textOverlays?.filter(o => o.id.startsWith('autocap-')).length ?? 0; return autoCaps > 0 ? (
                    <button
                      type="button"
                      title={t('basicEditor.caption.clearTitle')}
                      onClick={() => {
                        pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
                        setTextOverlays((prev: TextOverlay[]) => prev.filter(o => !o.id.startsWith('autocap-')))
                        setCaptionSuccess(null)
                        showToast(t('basicEditor.caption.cleared'), 'info')
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[8px] font-black text-indigo-300 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 transition-all uppercase tracking-widest"
                    >
                      <Trash2 className="w-2.5 h-2.5" />{t('basicEditor.caption.count', { count: autoCaps })}
                    </button>
                  ) : null })()}
                  {/* Transcript status */}
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${
                    (transcript?.fullText || manualTranscript.trim())
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                      (transcript?.fullText || manualTranscript.trim()) ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                    {(transcript?.fullText || manualTranscript.trim()) ? t('basicEditor.caption.ready') : t('basicEditor.caption.noScript')}
                  </span>
                </div>
              </div>

              <div className="px-3 pb-3 space-y-2.5">
                 {/* Style picker with live preview */}
                 <div className="grid grid-cols-4 gap-1">
                   {CAPTION_STYLE_OPTIONS.map(s => (
                     <button type="button" key={s.id} onClick={() => { setCaptionStyle(s.id); if (s.id === 'neon-glow' || s.id === 'cyberpunk-neon') setCaptionColor(s.preview.color); else if (s.id === 'hormozi-bold' || s.id === 'vlog-kinetic') setCaptionColor('#FFD700'); else setCaptionColor('#FFFFFF') }}
                       className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${
                         captionStyle === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/30' : 'bg-white/5 text-slate-500 hover:text-white border border-white/[0.06]'
                       }`}
                     >
                       <span style={{ '--caption-color': captionStyle === s.id ? s.preview.color : undefined, '--caption-filter': captionStyle === s.id ? s.preview.shadow : undefined } as any}
                         className={`text-[9px] font-black leading-none text-[var(--caption-color)] [filter:var(--caption-filter)] ${s.preview.pill ? 'bg-black text-white px-1 py-0.5 rounded border border-white/20 scale-90' : ''}`}>Aa</span>
                       {'labelKey' in s ? t(s.labelKey) : s.label}
                     </button>
                   ))}
                 </div>

                {/* Manual transcript textarea — shown when no transcript attached */}
                {!transcript?.fullText && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                      {t('basicEditor.caption.pasteScript')}
                    </label>
                    <textarea
                      title={t('basicEditor.caption.pasteScriptTitle')}
                      placeholder={t('basicEditor.caption.pastePlaceholder')}
                      value={manualTranscript}
                      onChange={e => { setManualTranscript(e.target.value); setCaptionError(null) }}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none transition-all leading-relaxed"
                    />
                    {manualTranscript.trim() && (
                      <p className="text-[8px] text-slate-600 mt-0.5">
                        {t('basicEditor.caption.wordCount', { count: manualTranscript.trim().split(/\s+/).length })}
                      </p>
                    )}
                  </div>
                )}

                {/* Controls row: words per caption + position + color */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Words per caption */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.caption.wordsPerLine')}</span>
                    <div className="flex gap-0.5">
                      {[2, 3, 4, 5, 6].map(n => (
                        <button type="button" key={n} onClick={() => setWordsPerCap(n)}
                          className={`flex-1 py-1 rounded-lg text-[8px] font-black transition-all ${
                            wordsPerCap === n ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                          }`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>

                  {/* Vertical position */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.caption.position')}</span>
                    <div className="flex gap-0.5">
                      {(['top', 'mid', 'bottom'] as const).map(pos => (
                        <button type="button" key={pos} onClick={() => setCaptionY(pos)}
                          title={t(`basicEditor.caption.positionAt.${pos}`)}
                          className={`flex-1 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${
                            captionY === pos ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                          }`}
                        >{pos === 'bottom' ? '▼' : pos === 'top' ? '▲' : '◆'}</button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.color')}</span>
                    <div className="flex items-center gap-1">
                      <input type="color" value={captionColor} onChange={e => setCaptionColor(e.target.value)}
                        title={t('basicEditor.caption.colorTitle')}
                        className="w-7 h-7 rounded-lg cursor-pointer border border-white/10 bg-transparent p-0.5"
                      />
                      <div className="flex gap-0.5 flex-1">
                        {['#FFFFFF', '#FFFF00', '#00F5FF'].map(c => (
                          <button type="button" key={c} onClick={() => setCaptionColor(c)}
                            title={t('basicEditor.caption.setColor', { color: c })}
                            style={{ '--swatch-bg': c } as any}
                            className={`flex-1 h-7 rounded-lg border transition-all bg-[var(--swatch-bg)] ${
                              captionColor === c ? 'border-white/50 scale-95' : 'border-white/10'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Success state */}
                <AnimatePresence>
                  {captionSuccess !== null && (
                    <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <p className="text-[9px] text-emerald-300 font-black">{t('basicEditor.caption.addedInStyle', { count: captionSuccess, style: captionStyleLabel(captionStyle) })}</p>
                    </m.div>
                  )}
                </AnimatePresence>

                {/* Generate button */}
                <m.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAutoCaption}
                  disabled={captionLoading}
                  aria-label={t('basicEditor.caption.generateAria')}
                  className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    captionLoading
                      ? 'bg-indigo-600/40 text-indigo-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-indigo-600/20'
                  }`}
                >
                  {captionLoading ? (
                    <>
                      <m.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-3.5 h-3.5 border-2 border-indigo-300/40 border-t-indigo-300 rounded-full"
                      />
                      {t('basicEditor.caption.generating', { count: wordsPerCap })}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('basicEditor.caption.generate')}
                    </>
                  )}
                </m.button>

                {/* Error state */}
                <AnimatePresence>
                  {captionError && (
                    <m.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20"
                    >
                      <p className="text-[9px] text-rose-300 leading-relaxed">{captionError}</p>
                    </m.div>
                  )}
                </AnimatePresence>

                {/* ── Translation Section ── */}
                <div className="pt-3.5 mt-1 border-t border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{t('basicEditor.translate.title')}</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={targetTranslationLanguage}
                        title={t('basicEditor.translate.languageTitle')}
                        onChange={(e) => setTargetTranslationLanguage(e.target.value)}
                        className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                      >
                        <option value="en" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.en')}</option>
                        <option value="es" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.es')}</option>
                        <option value="fr" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.fr')}</option>
                        <option value="de" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.de')}</option>
                        <option value="it" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.it')}</option>
                        <option value="pt" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.pt')}</option>
                        <option value="ru" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.ru')}</option>
                        <option value="ja" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.ja')}</option>
                        <option value="ko" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.ko')}</option>
                        <option value="zh" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.zh')}</option>
                        <option value="ar" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.ar')}</option>
                        <option value="hi" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.hi')}</option>
                        <option value="nl" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.nl')}</option>
                        <option value="pl" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.pl')}</option>
                        <option value="tr" className="bg-[#0c0c16] text-white">{t('basicEditor.lang.tr')}</option>
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                        ▼
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={translatingCaptions || !textOverlays || textOverlays.length === 0}
                      onClick={handleTranslateCaptions}
                      className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                        translatingCaptions || !textOverlays || textOverlays.length === 0
                          ? 'bg-indigo-600/30 text-indigo-400 cursor-not-allowed border border-transparent'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      }`}
                    >
                      {translatingCaptions ? (
                        <>
                          <m.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-3.5 h-3.5 border border-indigo-300/40 border-t-indigo-300 rounded-full"
                          />
                          {t('basicEditor.translate.translating')}
                        </>
                      ) : (
                        t('basicEditor.translate.translate')
                      )}
                    </button>
                  </div>
                </div>

                {/* ── AI Emoji Section ── */}
                <div className="pt-3.5 mt-1 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">{t('basicEditor.emoji.title')}</span>
                    </div>
                    {(() => { const ems = textOverlays?.filter(o => o.id.startsWith('aiemoji-')).length ?? 0; return ems > 0 ? (
                      <button
                        type="button"
                        title={t('basicEditor.emoji.clearTitle')}
                        onClick={() => {
                          pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
                          setTextOverlays((prev: TextOverlay[]) => prev.filter(o => !o.id.startsWith('aiemoji-')))
                          showToast(t('basicEditor.emoji.cleared'), 'info')
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[8px] font-black text-indigo-300 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 transition-all uppercase tracking-widest"
                      >
                        <Trash2 className="w-2.5 h-2.5" />{t('basicEditor.emoji.count', { count: ems })}
                      </button>
                    ) : null })()}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.enter')}</span>
                      <div className="relative">
                        <select
                          value={emojiEffect}
                          title={t('basicEditor.emoji.enterTitle')}
                          onChange={(e) => setEmojiEffect(e.target.value as any)}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="pop" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.pop')}</option>
                          <option value="bounce" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.bounce')}</option>
                          <option value="slide" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.slide')}</option>
                          <option value="pulse" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.pulse')}</option>
                          <option value="shake" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.shake')}</option>
                          <option value="blur" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.enter.blur')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.exit')}</span>
                      <div className="relative">
                        <select
                          value={emojiAnimOut}
                          title={t('basicEditor.emoji.exitTitle')}
                          onChange={(e) => setEmojiAnimOut(e.target.value as any)}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="fade" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.fade')}</option>
                          <option value="pop" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.pop')}</option>
                          <option value="slide-bottom" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.slideBottom')}</option>
                          <option value="bounce-out" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.bounceOut')}</option>
                          <option value="scale-out" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.scaleOut')}</option>
                          <option value="zoom-out" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.zoomOut')}</option>
                          <option value="flip-out" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.exit.flipOut')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.style')}</span>
                      <div className="relative">
                        <select
                          value={emojiStyle}
                          title={t('basicEditor.emoji.styleTitle')}
                          onChange={(e) => setEmojiStyle(e.target.value as any)}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="3d-bold" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.style.pop3d')}</option>
                          <option value="neon-glow" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.style.neonGlow')}</option>
                          <option value="flat" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.style.flat')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.size')}</span>
                      <div className="relative">
                        <select
                          value={emojiFontSize}
                          title={t('basicEditor.emoji.sizeTitle')}
                          onChange={(e) => setEmojiFontSize(Number(e.target.value))}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="32" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.size.n32')}</option>
                          <option value="48" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.size.n48')}</option>
                          <option value="64" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.size.n64')}</option>
                          <option value="80" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.size.n80')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.density')}</span>
                      <div className="relative">
                        <select
                          value={emojiDensity}
                          title={t('basicEditor.emoji.densityTitle')}
                          onChange={(e) => setEmojiDensity(Number(e.target.value))}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="3" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.density.n3')}</option>
                          <option value="6" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.density.n6')}</option>
                          <option value="10" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.density.n10')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">{t('basicEditor.emoji.placement')}</span>
                      <div className="relative">
                        <select
                          value={emojiYPosition}
                          title={t('basicEditor.emoji.placementTitle')}
                          onChange={(e) => setEmojiYPosition(e.target.value as any)}
                          className="w-full appearance-none bg-black/40 border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer transition-all"
                        >
                          <option value="above" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.place.above')}</option>
                          <option value="below" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.place.below')}</option>
                          <option value="head" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.place.head')}</option>
                          <option value="custom-top" className="bg-[#0c0c16] text-white">{t('basicEditor.emojiOpt.place.customTop')}</option>
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[8px]">
                          ▼
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/[0.02] border border-white/[0.04] p-2 rounded-xl">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('basicEditor.emoji.inDuration', { value: emojiAnimInDuration })}</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={emojiAnimInDuration}
                        onChange={(e) => setEmojiAnimInDuration(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                        title={t('basicEditor.emoji.inDurationTitle')}
                      />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 block mb-1">{t('basicEditor.emoji.outDuration', { value: emojiAnimOutDuration })}</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1.5}
                        step={0.05}
                        value={emojiAnimOutDuration}
                        onChange={(e) => setEmojiAnimOutDuration(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                        title={t('basicEditor.emoji.outDurationTitle')}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={generatingEmojis || !transcript?.words?.length}
                    onClick={handleGenerateAiEmojis}
                    className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      generatingEmojis || !transcript?.words?.length
                        ? 'bg-indigo-600/30 text-indigo-400 cursor-not-allowed border border-transparent'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white shadow-lg shadow-indigo-600/20'
                    }`}
                  >
                    {generatingEmojis ? (
                      <>
                        <m.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-3.5 h-3.5 border-2 border-indigo-300/40 border-t-indigo-300 rounded-full"
                        />
                        {t('basicEditor.emoji.generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                        {t('basicEditor.emoji.generate')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Search presets */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={textPresetSearch} onChange={e => setTextPresetSearch(e.target.value)}
                placeholder={t('basicEditor.text.searchPresets')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
              />
            </div>

            {/* Preset groups */}
            {[
              { id: 'viralHooks', presets: filteredViralHooks },
              { id: 'textPresets', presets: filteredTextPresets },
              { id: 'premiumCaptions', presets: filteredPremiumCaptions },
              { id: 'reactionCallouts', presets: filteredReactionCallouts },
              { id: 'trending', presets: filteredTrending },
              { id: 'endScreens', presets: filteredEndScreens },
              { id: 'chapters', presets: filteredChapter },
            ].map(({ id, presets }) => presets.length > 0 && (
              <div key={id}>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t(`basicEditor.presetGroup.${id}`)}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.slice(0, 8).map((p, i) => (
                    <button key={`${p.label}-${i}`}
                      onClick={() => handleAddOverlay(p)}
                      className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all text-left group"
                    >
                      <div className="text-[10px] font-black text-slate-200 group-hover:text-white truncate">{presetLabel(p)}</div>
                      <div className="text-[8px] text-slate-600 group-hover:text-slate-400 truncate mt-0.5">{presetText(p)}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Active text overlays */}
            {(textOverlays?.length ?? 0) > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.text.activeText', { count: textOverlays?.length ?? 0 })}</span>
                <div className="space-y-1">
                  {textOverlays?.map(o => (
                    <div key={o.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${selectedTextId === o.id ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'}`}
                      onClick={() => setSelectedTextId(o.id)}
                    >
                      <Type className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="flex-1 text-[10px] font-black text-slate-200 truncate">{o.text}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button type="button" onClick={e => { e.stopPropagation(); pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTextOverlays((prev: TextOverlay[]) => prev.filter(t => t.id !== o.id)) }}
                        aria-label={t('basicEditor.text.deleteOverlayAria', { text: o.text.slice(0, 20) })}
                        title={t('basicEditor.text.deleteOverlay')}
                        className="text-slate-600 hover:text-rose-400 transition-colors"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected overlay editor */}
            {selectedTextId && textOverlays?.find(o => o.id === selectedTextId) && (() => {
              const o = textOverlays!.find(o => o.id === selectedTextId)!
              return (
                <m.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-indigo-500/20 space-y-3"
                >
                  {/* Preview */}
                  <div className="relative h-16 rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                    <span
                      className="[font-family:var(--font-family)] [font-size:var(--font-size)] [text-shadow:var(--text-shadow)] [font-weight:var(--font-weight)] [-webkit-text-stroke:var(--text-stroke)] text-[var(--text-color)]"
                      style={{
                        '--font-family': o.fontFamily ?? 'Inter',
                        '--font-size': `${Math.min(o.fontSize ?? 32, 28)}px`,
                        '--text-shadow': o.style === 'neon' ? `0 0 10px ${o.color}` : o.style === 'shadow' ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                        '--font-weight': o.style === 'bold-kinetic' ? 900 : 700,
                        '--text-stroke': o.style === 'outline' ? `1px ${o.color}` : undefined,
                        '--text-color': o.style === 'outline' ? 'transparent' : o.color,
                      } as any}
                    >{o.text || t('basicEditor.text.preview')}</span>
                    <span className="absolute top-1.5 left-2 text-[8px] font-black text-slate-600 uppercase tracking-widest">{t('basicEditor.text.livePreview')}</span>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-400 block">{t('basicEditor.text.editing', { text: `${o.text.slice(0, 24)}${o.text.length > 24 ? '…' : ''}` })}</span>
                  <input value={o.text} onChange={e => updateTextOverlay(o.id, { text: e.target.value })}
                    aria-label={t('basicEditor.text.contentAria')}
                    title={t('basicEditor.text.contentAria')}
                    placeholder={t('basicEditor.text.contentPlaceholder')}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.text.fontSize')}</span>
                      <input type="number" value={o.fontSize ?? 32} min={10} max={120}
                        onChange={e => updateTextOverlay(o.id, { fontSize: Number(e.target.value) })}
                        aria-label={t('basicEditor.text.fontSize')}
                        title={t('basicEditor.text.fontSize')}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.color')}</span>
                      <input type="color" value={o.color} onChange={e => updateTextOverlay(o.id, { color: e.target.value })}
                        aria-label={t('basicEditor.text.textColor')}
                        title={t('basicEditor.text.textColor')}
                        className="w-full h-8 rounded-lg border border-white/[0.06] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.text.style')}</span>
                    <div className="flex flex-wrap gap-1">
                      {(['none','neon','minimal','bold-kinetic','outline','shadow'] as const).map(s => (
                        <button type="button" key={s} onClick={() => updateTextOverlay(o.id, { style: s })}
                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${o.style === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                        >{t(`basicEditor.textStyle.${s}`)}</button>
                      ))}
                    </div>
                  </div>
                  {/* Animation In/Out */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.text.animateIn')}</span>
                      <select value={(o as any).animationIn ?? 'none'} onChange={e => updateTextOverlay(o.id, { animationIn: e.target.value as any })}
                        aria-label={t('basicEditor.text.animateIn')}
                        title={t('basicEditor.text.animateIn')}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      >
                        {['none','fade','slide-up','slide-down','slide-left','scale','bounce'].map(a => (
                          <option key={a} value={a} className="bg-slate-900 capitalize">{t(`basicEditor.anim.${a}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.text.animateOut')}</span>
                      <select value={(o as any).animationOut ?? 'none'} onChange={e => updateTextOverlay(o.id, { animationOut: e.target.value as any })}
                        aria-label={t('basicEditor.text.animateOut')}
                        title={t('basicEditor.text.animateOut')}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      >
                        {['none','fade','slide-up','slide-down','slide-right','scale','bounce'].map(a => (
                          <option key={a} value={a} className="bg-slate-900 capitalize">{t(`basicEditor.anim.${a}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">{t('basicEditor.text.font')}</span>
                    <select value={o.fontFamily ?? 'Inter, system-ui, sans-serif'} onChange={e => updateTextOverlay(o.id, { fontFamily: e.target.value })}
                      aria-label={t('basicEditor.text.font')}
                      title={t('basicEditor.text.font')}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    >
                      {CAPTION_FONTS.map(f => <option key={f.family} value={f.family} className="bg-slate-900">{f.name}</option>)}
                      {customFonts.map(f => <option key={f.family} value={f.family} className="bg-slate-900">{f.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black shrink-0">{t('basicEditor.text.start')}</span>
                    <input type="number" value={o.startTime} step={0.1} min={0} max={duration}
                      onChange={e => updateTextOverlay(o.id, { startTime: Number(e.target.value) })}
                      aria-label={t('basicEditor.text.startAria')}
                      title={t('basicEditor.text.startAria')}
                      className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    />
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black shrink-0">{t('basicEditor.text.end')}</span>
                    <input type="number" value={o.endTime} step={0.1} min={0} max={duration}
                      onChange={e => updateTextOverlay(o.id, { endTime: Number(e.target.value) })}
                      aria-label={t('basicEditor.text.endAria')}
                      title={t('basicEditor.text.endAria')}
                      className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    />
                  </div>
                  {/* Upload custom font */}
                  <button type="button" onClick={() => fontInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 transition-all text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest"
                  ><Upload className="w-3 h-3" /> {t('basicEditor.text.uploadFont')}</button>
                  <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} aria-label={t('basicEditor.text.uploadFontAria')} title={t('basicEditor.text.uploadFontAria')} />
                </m.div>
              )
            })()}
          </div>
        )}

        {/* ════ FILTERS ════ */}
        {activeEditTab === 'filters' && (
          <div className="space-y-3">
            {/* Category pills */}
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_CATEGORIES.map(c => (
                <button type="button" key={c.id} onClick={() => setFilterCategory(c.id)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filterCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-white/[0.04] text-slate-500 hover:text-white border border-white/[0.06]'}`}
                >{t(c.labelKey)}</button>
              ))}
            </div>

            {/* Strength slider */}
            {selectedFilterName && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{filterNameById(selectedFilterName)}</span>
                  <span className="text-[10px] font-black text-indigo-400 font-mono">{filtStrength}%</span>
                </div>
                <input type="range" min={0} max={100} value={filtStrength}
                  onChange={e => setFiltStrength(Number(e.target.value))}
                  aria-label={t('basicEditor.filters.strengthAria', { value: filtStrength })}
                  title={t('basicEditor.filters.strengthAria', { value: filtStrength })}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between mt-1">
                  <button type="button" onClick={resetFilters} className="text-[9px] text-slate-500 hover:text-rose-400 font-black uppercase tracking-widest transition-colors">{t('basicEditor.reset')}</button>
                  <div className="flex gap-2.5">
                    {setCompareMode && (
                      [
                        { id: 'before', label: t('basicEditor.filters.before') },
                        { id: 'after', label: t('basicEditor.filters.after') },
                        { id: 'split', label: t('basicEditor.filters.split') }
                      ].map(item => (
                        <button type="button" key={item.id} onClick={() => setCompareMode(item.id as any)}
                          className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg transition-all ${compareMode === item.id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                        >{item.label}</button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pinned filters */}
            {pinnedPresets.length > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.filters.pinned')}</span>
                <div className="flex gap-2">
                  {pinnedPresets.map(p => (
                    <button type="button" key={p.n} onClick={() => applyFilter(p)}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all bg-gradient-to-br ${p.swatch} bg-opacity-20 ${selectedFilterName === p.n ? 'border-indigo-500/50 text-white' : 'border-white/10 text-slate-300'}`}
                    >{filterName(p)}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter grid with live CSS preview */}
            <div className="grid grid-cols-2 gap-2">
              {FILTER_PRESETS_WITH_CATEGORY
                .filter(p => filterCategory === 'all' || p.category === filterCategory)
                .map(p => (
                <m.button key={p.n} onClick={() => applyFilter(p)} whileTap={{ scale: 0.97 }}
                  className={`relative overflow-hidden flex flex-col items-start gap-1 p-2.5 rounded-xl border transition-all group ${selectedFilterName === p.n ? 'border-indigo-500/60 bg-indigo-600/10 ring-1 ring-indigo-500/30' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20'}`}
                >
                  {/* Live CSS filter preview on a gradient */}
                    <div
                      className={`w-full h-9 rounded-lg bg-gradient-to-br ${p.swatch} mb-1 transition-all [filter:var(--preview-filter)]`}
                      style={{ '--preview-filter': filterToCss(p.f) } as any}
                    />
                  <span className="text-[10px] font-black text-slate-200 group-hover:text-white">{filterName(p)}</span>
                  <span className="text-[8px] text-slate-600 group-hover:text-slate-400">{filterDesc(p)}</span>
                  {selectedFilterName === p.n && (
                    <m.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-2 left-2 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.8)]"
                    />
                  )}
                  <div role="button" tabIndex={0} aria-label={pinnedFilterNames.includes(p.n) ? t('basicEditor.filters.unpin', { name: filterName(p) }) : t('basicEditor.filters.pin', { name: filterName(p) })} onClick={e => { e.stopPropagation(); togglePinFilter(p.n) }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePinFilter(p.n) } }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
                  >
                    <Pin className={`w-3 h-3 ${pinnedFilterNames.includes(p.n) ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </m.button>
              ))}
            </div>
          </div>
        )}

        {/* ════ MOTION GRAPHICS ════ */}
        {activeEditTab === 'motion' && (
          <div className="space-y-3">
            {/* Search + duration */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input value={motionTemplateSearch} onChange={e => setMotionTemplateSearch(e.target.value)}
                  placeholder={t('basicEditor.motion.searchTemplates')}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Timer className="w-3 h-3 text-slate-500" />
                <input type="number" value={motionGraphicDuration} min={1} max={30} step={1}
                  onChange={e => setMotionGraphicDuration(Number(e.target.value) || 5)}
                  aria-label={t('basicEditor.motion.durationAria')}
                  title={t('basicEditor.motion.durationAria')}
                  className="w-8 bg-transparent text-white text-xs font-black focus:outline-none"
                />
                <span className="text-[9px] text-slate-500">s</span>
              </div>
            </div>

            {/* Recent row */}
            {recentMotionTemplateIds.length > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.motion.recent')}</span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {recentMotionTemplateIds.map(id => {
                    const tpl = MOTION_GRAPHIC_TEMPLATES.find(x => x.id === id)
                    if (!tpl) return null
                    return (
                      <button type="button" key={tpl.id} onClick={() => applyMotionGraphicTemplate(tpl)}
                        className="flex-shrink-0 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/40 transition-all text-left"
                      >
                        <div className="text-[10px] font-black text-indigo-300 whitespace-nowrap">{tpl.name}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Template grid */}
            <div className="grid grid-cols-1 gap-2">
              {filteredMotionTemplates.map(t => (
                <button type="button" key={t.id} onClick={() => applyMotionGraphicTemplate(t)}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Wand2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-slate-200 group-hover:text-white">{t.name}</div>
                    <div className="text-[9px] text-slate-500 group-hover:text-slate-400 mt-0.5">{t.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ OVERLAYS / LAYERS ════ */}
        {activeEditTab === 'overlays' && (
          <div className="space-y-3">
            {/* Add shape buttons */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.layers.addShape')}</span>
              <div className="flex gap-2">
                {(['rect','circle','line'] as const).map(kind => (
                  <button type="button" key={kind} onClick={() => addShape(kind)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all"
                  >{t(`basicEditor.shape.${kind}`)}</button>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {SHAPE_PRESETS.map(p => (
                  <button type="button" key={p.id} onClick={() => addShapePreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
                  >{t(p.nameKey)}</button>
                ))}
              </div>
            </div>

            {/* Add image overlay */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.layers.addImage')}</span>
              <div className="flex gap-2">
                <input value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                  placeholder={t('basicEditor.layers.imageUrlPlaceholder')}
                  aria-label={t('basicEditor.layers.imageUrl')}
                  title={t('basicEditor.layers.imageUrl')}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
                <button type="button" onClick={addImageOverlay} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">{t('basicEditor.add')}</button>
              </div>
            </div>

            {/* Add SVG overlay */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.layers.addSvg')}</span>
              <div className="flex gap-2">
                <input value={svgUrlInput} onChange={e => setSvgUrlInput(e.target.value)}
                  placeholder={t('basicEditor.layers.svgUrlPlaceholder')}
                  aria-label={t('basicEditor.layers.svgUrl')}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
                <button type="button" onClick={addSvgOverlay} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">{t('basicEditor.add')}</button>
              </div>
              <button type="button" onClick={() => svgFileInputRef.current?.click()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
              ><Upload className="w-3 h-3" /> {t('basicEditor.layers.uploadSvg')}</button>
              <input ref={svgFileInputRef} type="file" accept=".svg" className="hidden" onChange={handleSvgFileUpload} aria-label={t('basicEditor.layers.uploadSvg')} title={t('basicEditor.layers.uploadSvg')} />
            </div>

            {/* Gradient overlays */}
            {setGradientOverlays && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.layers.gradients')}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {GRADIENT_PRESETS.map(p => (
                    <button type="button" key={p.id} onClick={() => addGradientOverlay(p)}
                      className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/10 hover:border-indigo-500/30 text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all text-left"
                    >{t(p.nameKey)}</button>
                  ))}
                </div>
              </div>
            )}

            {/* All active overlays — layer stack with opacity */}
            {overlayCount > 0 ? (
              <div>
                <div className="flex items-center justify-between pl-1 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">{t('basicEditor.layers.allLayers', { count: overlayCount })}</span>
                  <span className="text-[8px] text-slate-600">{t('basicEditor.layers.hoverHint')}</span>
                </div>
                <div className="space-y-1">
                  {textOverlays?.map(o => (
                    <div key={o.id} className="group">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-indigo-500/20 transition-all cursor-pointer"
                        onClick={() => { setActiveEditTab('text'); setSelectedTextId(o.id); onSelectOverlay?.(o.id) }}
                      >
                        <Type className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="flex-1 text-[10px] text-slate-300 truncate">{o.text}</span>
                        <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}–{o.endTime.toFixed(1)}s</span>
                        <button type="button" onClick={e => {
                          e.stopPropagation();
                          pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []);
                          if (selectedTextId === o.id || selectedOverlayId === o.id) {
                            setSelectedTextId(null);
                            onSelectOverlay?.(null);
                          }
                          setTextOverlays((prev: TextOverlay[]) => prev.filter(t => t.id !== o.id));
                        }}
                          aria-label={t('basicEditor.layers.deleteTextAria', { text: o.text.slice(0, 20) })}
                          title={t('basicEditor.layers.deleteText')}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                        ><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {/* Opacity row */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all pl-8 pr-3 py-1 flex items-center gap-2">
                        <span className="text-[7px] text-slate-600 uppercase tracking-widest font-black shrink-0">{t('basicEditor.layers.opacity')}</span>
                        <input type="range" min={0} max={1} step={0.05}
                          value={layerOpacities[o.id] ?? (o.opacity ?? 1)}
                          onChange={e => {
                            const val = Number(e.target.value)
                            setLayerOpacities(prev => ({ ...prev, [o.id]: val }))
                            setTextOverlays(prev => prev.map(t => t.id === o.id ? { ...t, opacity: val } : t))
                          }}
                          aria-label={t('basicEditor.layers.opacityAria')}
                          title={t('basicEditor.layers.opacityAria')}
                          className="flex-1 accent-indigo-500 h-1"
                        />
                        <span className="text-[7px] text-slate-600 font-black w-6 text-right">{Math.round((layerOpacities[o.id] ?? (o.opacity ?? 1)) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                  {shapeOverlays?.map(o => (
                    <div key={o.id} onClick={() => onSelectOverlay?.(o.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group cursor-pointer">
                      <Box className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 capitalize">{t(`basicEditor.shape.${o.kind}`)}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        if (selectedOverlayId === o.id) onSelectOverlay?.(null);
                        setShapeOverlays?.((prev: ShapeOverlay[]) => prev.filter(s => s.id !== o.id));
                      }}
                        aria-label={t('basicEditor.layers.deleteShape', { shape: t(`basicEditor.shape.${o.kind}`) })}
                        title={t('basicEditor.layers.deleteShape', { shape: t(`basicEditor.shape.${o.kind}`) })}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {imageOverlays?.map(o => (
                    <div key={o.id} onClick={() => onSelectOverlay?.(o.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group cursor-pointer">
                      <ImageIcon className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 truncate">{o.url.split('/').pop()}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        if (selectedOverlayId === o.id) onSelectOverlay?.(null);
                        setImageOverlays?.((prev: ImageOverlay[]) => prev.filter(i => i.id !== o.id));
                      }}
                        aria-label={t('basicEditor.layers.deleteImage')}
                        title={t('basicEditor.layers.deleteImage')}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {svgOverlays?.map(o => (
                    <div key={o.id} onClick={() => onSelectOverlay?.(o.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group cursor-pointer">
                      <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 truncate">{o.url.startsWith('<svg') ? t('basicEditor.layers.customSvg') : o.url.split('/').pop()}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        if (selectedOverlayId === o.id) onSelectOverlay?.(null);
                        setSvgOverlays?.((prev: SvgOverlay[]) => prev.filter(s => s.id !== o.id));
                      }}
                        aria-label={t('basicEditor.layers.deleteSvg')}
                        title={t('basicEditor.layers.deleteSvg')}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {gradientOverlays?.map(o => (
                    <div key={o.id} onClick={() => onSelectOverlay?.(o.id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group cursor-pointer">
                      <Palette className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 truncate">{t('basicEditor.layers.gradientName', { region: t(`basicEditor.region.${o.region || 'full'}`) })}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        if (selectedOverlayId === o.id) onSelectOverlay?.(null);
                        setGradientOverlays?.((prev: GradientOverlay[]) => prev.filter(g => g.id !== o.id));
                      }}
                        aria-label={t('basicEditor.layers.deleteGradient')}
                        title={t('basicEditor.layers.deleteGradient')}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <Layers className="w-8 h-8 text-slate-700" />
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('basicEditor.layers.empty')}</p>
                <p className="text-[9px] text-slate-700 max-w-[160px] leading-relaxed">{t('basicEditor.layers.emptyHint')}</p>
                <button type="button" onClick={() => { setActiveEditTab('text'); handleAddOverlay(t('basicEditor.text.newText')) }}
                  className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 hover:bg-indigo-600/40 transition-all uppercase tracking-widest"
                >{t('basicEditor.layers.addTextLayer')}</button>
              </div>
            )}

            {/* Motion compounds */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.compound.title')}</span>
              <div className="flex gap-2">
                <input value={compoundName} onChange={e => setCompoundName(e.target.value)}
                  placeholder={t('basicEditor.compound.namePlaceholder')}
                  aria-label={t('basicEditor.compound.name')}
                  title={t('basicEditor.compound.name')}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
                <input type="number" value={compoundDuration} min={1} max={60}
                  onChange={e => setCompoundDuration(Number(e.target.value) || 5)}
                  aria-label={t('basicEditor.compound.durationAria')}
                  title={t('basicEditor.compound.durationAria')}
                  className="w-14 px-2 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white focus:outline-none text-center"
                />
                <button type="button" onClick={saveAsCompound} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">{t('basicEditor.save')}</button>
              </div>
              {savedCompounds.length > 0 && (
                <div className="mt-2 space-y-1">
                  {savedCompounds.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] group">
                      <Archive className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300">{c.name}</span>
                      <span className="text-[8px] text-slate-600">{c.duration}s</span>
                      <button type="button" onClick={() => addCompoundToTimeline(c)} className="px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-400 text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">{t('basicEditor.add')}</button>
                      <button type="button" onClick={() => deleteCompound(c.id)} aria-label={t('basicEditor.compound.delete', { name: c.name })} title={t('basicEditor.compound.delete', { name: c.name })} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ QUICK PACKS ════ */}
        {activeEditTab === 'packs' && (
          <div className="space-y-3">
            {/* Creativity packs */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.packs.oneClick')}</span>
              <div className="space-y-2">
                {CREATIVITY_PACKS.map(pack => (
                  <button type="button" key={pack.id} onClick={() => applyCreativityPack(pack.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all text-left group"
                  >
                    <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[11px] font-black text-slate-200 group-hover:text-white">{t(pack.nameKey)}</div>
                      <div className="text-[9px] text-slate-500 group-hover:text-slate-400">{t(pack.descKey)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style bundles */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.packs.styleBundles')}</span>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_BUNDLES.slice(0, 8).map(b => (
                  <button type="button" key={b.id} onClick={() => applyStyleBundleOneClick(b)}
                    className="relative overflow-hidden flex flex-col gap-1 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/20 transition-all text-left group"
                  >
                    <div className={`w-full h-5 rounded-lg bg-gradient-to-r ${b.swatch} mb-1`} />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white">{bundleLabel(b)}</div>
                    <div className="text-[8px] text-slate-600 group-hover:text-slate-400">{t(b.descKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform bundles */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.packs.platform')}</span>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_BUNDLES.map(b => (
                  <button type="button" key={b.id} onClick={() => applyPlatformBundle(b)}
                    className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 hover:border-indigo-500/20 transition-all text-left group"
                  >
                    <Globe className="w-4 h-4 text-indigo-400 mb-1" />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white leading-tight">{bundleLabel(b)}</div>
                    <div className="text-[8px] text-slate-500 group-hover:text-slate-400">{t(b.descKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save custom style */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">{t('basicEditor.packs.saveMyStyle')}</span>
              <div className="flex gap-2">
                <input value={customStyleName} onChange={e => setCustomStyleName(e.target.value)}
                  placeholder={t('basicEditor.packs.styleNamePlaceholder')}
                  aria-label={t('basicEditor.packs.styleName')}
                  title={t('basicEditor.packs.styleName')}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
                <button type="button" onClick={saveMyStyle} disabled={!customStyleName.trim()}
                  aria-label={t('basicEditor.packs.saveStyle')}
                  title={t('basicEditor.packs.saveStyle')}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase disabled:opacity-40 hover:bg-emerald-500 transition-all shrink-0"
                ><Save className="w-3 h-3" /></button>
              </div>
              {customStyleBundles.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {customStyleBundles.map(b => (
                    <button key={b.id}
                      onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: VideoFilter) => replaceLook(prev, b.filter)); showToast(t('basicEditor.toast.applied', { name: b.name }), 'success') }}
                      className="px-3 py-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-[9px] font-black text-violet-300 hover:bg-violet-600/40 transition-all"
                    >{b.name}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick nav to other sections */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{t('basicEditor.packs.goTo')}</span>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_NAV.map(nav => (
                  <button type="button" key={nav.id} onClick={() => setActiveCategory?.(nav.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 transition-all text-left group"
                  >
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${nav.color} flex items-center justify-center shrink-0`}>
                      <nav.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 group-hover:text-white">{t(nav.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ INSIGHTS ════ */}
        {activeEditTab === 'insights' && (
          <div className="space-y-3">
            {/* Analytics are not yet wired to a real data source for this view.
                Per the no-fabricated-data rule we show an honest empty state
                instead of mock retention / scoring numbers. */}
            <div className="ds-surface-subtle p-6 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-subtle flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <p className="ds-text-label text-theme-primary">{t('basicEditor.insights.comingSoon')}</p>
              <p className="ds-text-caption text-theme-muted max-w-[220px]">
                {t('basicEditor.insights.comingSoonHint')}
              </p>
            </div>

            {/* Transcript section — real data from props */}
            {transcript?.fullText && (
              <div className="ds-surface-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-3.5 h-3.5 text-primary" />
                  <span className="ds-text-label text-theme-secondary">{t('basicEditor.insights.transcript')}</span>
                </div>
                <p className="ds-text-caption text-theme-secondary leading-relaxed line-clamp-6">{transcript.fullText}</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default BasicEditorView

