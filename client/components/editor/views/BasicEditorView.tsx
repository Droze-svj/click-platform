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
  Eye,
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
  Fingerprint,
  Radio,
  Layers,
  Target,
  Box,
  Zap,
  MessageSquare,
  Mic,
  Volume2,
  TrendingUp,
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
import { motion, AnimatePresence } from 'framer-motion'
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
  STYLE_BUNDLES,
  PLATFORM_BUNDLES,
  FILTER_CATEGORIES,
  FILTER_PRESETS_WITH_CATEGORY,
  RESET_FILTER
} from './basic/basicEditorConstants'
import { apiPost } from '../../../lib/api'
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

const glassStyle = "backdrop-blur-3xl backdrop-contrast-[1.1] bg-white/[0.03] border border-white/10 shadow-2xl shadow-black/40"

function interpolateTransformAtTime(keyframes: TransformKeyframe[] | undefined, time: number, defaults: any) {
  if (!keyframes || keyframes.length === 0) return defaults;
  const kf = keyframes.find(k => Math.abs(k.time - time) < 0.1) || keyframes[0];
  return { positionX: kf.positionX ?? defaults.positionX, positionY: kf.positionY ?? defaults.positionY, scale: kf.scale ?? defaults.scale, rotation: kf.rotation ?? defaults.rotation, opacity: kf.opacity ?? defaults.opacity };
}

function ImageOverlayKeyframePanel({
  imageOverlays,
  setImageOverlays,
  currentTime,
  setActiveCategory,
  showToast,
}: {
  imageOverlays: ImageOverlay[]
  setImageOverlays: (v: ImageOverlay[] | ((prev: ImageOverlay[]) => ImageOverlay[])) => void
  currentTime: number
  setActiveCategory?: (c: import('../../../types/editor').EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}) {
  const [selectedId, setSelectedId] = React.useState<string>(() => imageOverlays[0]?.id ?? '')
  const selected = imageOverlays.find((o) => o.id === selectedId) ?? imageOverlays[0]
  React.useEffect(() => {
    if (selectedId && !imageOverlays.some((o) => o.id === selectedId)) setSelectedId(imageOverlays[0]?.id ?? '')
  }, [imageOverlays, selectedId])
  if (!selected) return null
  const defaults = { positionX: selected.x, positionY: selected.y, scale: 1, rotation: 0, opacity: selected.opacity }
  const current = interpolateTransformAtTime(selected.keyframes, currentTime, defaults)
  const addKeyframeAtPlayhead = () => {
    const kf: TransformKeyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: currentTime,
      easing: 'ease-in-out',
      positionX: current.positionX,
      positionY: current.positionY,
      scale: current.scale,
      rotation: current.rotation,
      opacity: current.opacity,
    }
    setImageOverlays((prev) =>
      prev.map((o) =>
        o.id === selected.id
          ? { ...o, keyframes: [...(o.keyframes ?? []), kf].sort((a, b) => a.time - b.time) }
          : o
      )
    )
    showToast('Keyframe added for image overlay', 'success')
  }
  return (
    <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Timer className="w-4 h-4 text-amber-500" />
        </div>
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Kinetic Image Keyframes</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          title="Select image overlay"
          className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-xs font-black italic uppercase focus:outline-none focus:border-amber-500/40 transition-all cursor-pointer"
        >
          {imageOverlays.map((o) => (
            <option key={o.id} value={o.id} className="bg-slate-900">{o.url.length > 35 ? o.url.slice(0, 32) + '…' : o.url}</option>
          ))}
        </select>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={addKeyframeAtPlayhead}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest italic shadow-xl shadow-amber-600/20 border border-white/10"
        >
          <PlusCircle className="w-4 h-4" />
          Inject Temporal Marker
        </motion.button>

        {setActiveCategory && (
          <button
            onClick={() => { setActiveCategory('effects'); showToast('Telemetry redirected', 'info') }}
            title="Go to System Effects"
            className="text-[10px] font-black text-slate-600 hover:text-white uppercase tracking-widest italic transition-colors flex items-center gap-2 ml-auto"
          >
            System Effects <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="p-6 rounded-[1.5rem] bg-white/[0.02] border border-white/5 font-mono text-[10px] text-slate-500 italic flex justify-between items-center group/kfdata">
        <span>STRAND DATA @ {currentTime.toFixed(2)}s</span>
        <div className="flex gap-4">
          <span className="group-hover/kfdata:text-amber-400 transition-colors">X: {current.positionX.toFixed(1)}%</span>
          <span className="group-hover/kfdata:text-amber-400 transition-colors">Y: {current.positionY.toFixed(1)}%</span>
          <span className="group-hover/kfdata:text-amber-400 transition-colors">SCALE: {(current.scale * 100).toFixed(0)}%</span>
          <span className="group-hover/kfdata:text-amber-400 transition-colors">ROT: {current.rotation.toFixed(0)}°</span>
          <span className="group-hover/kfdata:text-amber-400 transition-colors">OPACITY: {(current.opacity * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
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
  /** Whether a segment is currently selected (for enabling segment-only ops) */
  hasSegmentSelection?: boolean
}



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
  hasSegmentSelection = false,
}) => {
  const currentTime = videoState?.currentTime ?? 0
  const duration = videoState?.duration ?? 60
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
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
    showToast('Undo applied', 'info')
    setTimeout(() => {
      isUndoRestore.current = false
    }, 100)
  }, [undoStack, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTemplateLayout, setVideoFilters, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, setGradientOverlays, showToast])

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
    showToast('Redo applied', 'info')
    setTimeout(() => {
      isUndoRestore.current = false
    }, 100)
  }, [redoStack, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTemplateLayout, setVideoFilters, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, setGradientOverlays, showToast])
  // ----------------------------------------------

  const fontInputRef = useRef<HTMLInputElement>(null)
  const [customFonts, setCustomFonts] = useState<{name: string, family: string}[]>([])

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTextId) return
    const formData = new FormData()
    formData.append('font', file)

    showToast('Uploading custom typography...', 'info')
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
        showToast('Typography matrix synced.', 'success')
      } else {
        showToast('Invalid font format.', 'error')
      }
    } catch (err) {
      showToast('Engine fault during typography sync.', 'error')
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
    showToast(`${kind === 'rect' ? 'Rectangle' : kind === 'circle' ? 'Circle' : 'Line'} added`, 'success')
  }, [currentTime, duration, setShapeOverlays, showToast])

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
    showToast(`Added ${preset.name}`, 'success')
  }, [currentTime, duration, setShapeOverlays, setOpenSections, showToast])

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
    showToast(`Added "${template.name}" at ${baseStart.toFixed(1)}s`, 'success')
  }, [currentTime, templateLayout, motionGraphicDuration, setTextOverlays, setShapeOverlays, setOpenSections, showToast])

  const [imageUrlInput, setImageUrlInput] = useState('')
  const addImageOverlay = useCallback(() => {
    if (!setImageOverlays) return
    const url = imageUrlInput.trim()
    if (!url) { showToast('Enter an image URL', 'error'); return }
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
    showToast('Image overlay added', 'success')
  }, [imageUrlInput, currentTime, duration, setImageOverlays, showToast])

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
      showToast('SVG overlay added from file — animate with keyframes in Effects', 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [currentTime, duration, setSvgOverlays, setOpenSections, showToast])
  const addSvgOverlay = useCallback(() => {
    if (!setSvgOverlays) return
    const url = svgUrlInput.trim()
    if (!url) { showToast('Enter an SVG URL (e.g. https://… .svg or data:image/svg+xml,…)', 'error'); return }
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
    showToast('SVG overlay added — animate with keyframes in Effects', 'success')
  }, [svgUrlInput, currentTime, duration, setSvgOverlays, setOpenSections, showToast])

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
    const name = compoundName.trim() || 'Untitled compound'
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
    showToast(`Saved "${name}" — add to timeline anytime`, 'success')
  }, [compoundName, compoundDuration, textOverlays, shapeOverlays, imageOverlays, svgOverlays, savedCompounds, showToast])
  const addCompoundToTimeline = useCallback((c: MotionCompound) => {
    const start = currentTime
    const end = start + c.duration
    const ts = Date.now()
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTextOverlays((prev: TextOverlay[]) => [...prev, ...c.textOverlays.map((o, i) => ({ ...o, id: `t-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setShapeOverlays) setShapeOverlays((prev: ShapeOverlay[]) => [...prev, ...(c.shapeOverlays ?? []).map((o, i) => ({ ...o, id: `s-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setImageOverlays) setImageOverlays((prev: ImageOverlay[]) => [...prev, ...(c.imageOverlays ?? []).map((o, i) => ({ ...o, id: `i-${ts}-${i}`, startTime: start, endTime: end }))])
    if (setSvgOverlays) setSvgOverlays((prev: SvgOverlay[]) => [...prev, ...(c.svgOverlays ?? []).map((o, i) => ({ ...o, id: `v-${ts}-${i}`, startTime: start, endTime: end }))])
    showToast(`Added "${c.name}" at ${currentTime.toFixed(1)}s`, 'success')
  }, [currentTime, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setTextOverlays, setShapeOverlays, setImageOverlays, setSvgOverlays, pushSnapshot, showToast])

  const deleteCompound = useCallback((id: string) => {
    setSavedCompounds((prev: MotionCompound[]) => {
      const next = prev.filter((c) => c.id !== id)
      if (typeof window !== 'undefined') localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds, JSON.stringify(next))
      return next
    })
    showToast('Compound removed', 'info')
  }, [showToast])

  const [editingCompoundId, setEditingCompoundId] = useState<string | null>(null)
  const [editingCompoundName, setEditingCompoundName] = useState('')
  const renameCompound = useCallback((id: string, newName: string) => {
    const name = newName.trim() || 'Untitled compound'
    setSavedCompounds((prev: MotionCompound[]) => {
      const next = prev.map((c) => (c.id === id ? { ...c, name } : c))
      if (typeof window !== 'undefined') localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.motionCompounds, JSON.stringify(next))
      return next
    })
    setEditingCompoundId(null)
    setEditingCompoundName('')
    showToast(`Renamed to "${name}"`, 'success')
  }, [showToast])

  const GRADIENT_PRESETS: { id: string; name: string; overlay: Omit<GradientOverlay, 'id' | 'startTime' | 'endTime'> }[] = [
    { id: 'lower-third', name: 'Lower third fade', overlay: { direction: 'bottom-to-top', colorStops: ['transparent', 'rgba(0,0,0,0.85)'], opacity: 1, region: 'lower-third' } },
    { id: 'full-dark', name: 'Full darken', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)'], opacity: 1, region: 'full' } },
    { id: 'top-bar', name: 'Top bar', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(0,0,0,0.6)', 'transparent'], opacity: 1, region: 'top-bar' } },
    { id: 'warm-tint', name: 'Warm tint', overlay: { direction: 'top-to-bottom', colorStops: ['rgba(255,180,100,0.2)', 'transparent'], opacity: 1, region: 'full' } },
    { id: 'cool-tint', name: 'Cool tint', overlay: { direction: 'bottom-to-top', colorStops: ['rgba(100,150,255,0.18)', 'transparent'], opacity: 1, region: 'full' } },
    { id: 'bottom-half', name: 'Bottom half fade', overlay: { direction: 'bottom-to-top', colorStops: ['transparent', 'rgba(0,0,0,0.7)'], opacity: 1, region: 'bottom-half' } },
    { id: 'top-half', name: 'Top half fade', overlay: { direction: 'top-to-bottom', colorStops: ['transparent', 'rgba(0,0,0,0.5)'], opacity: 1, region: 'top-half' } },
    { id: 'vignette-soft', name: 'Soft vignette', overlay: { direction: 'radial', colorStops: ['transparent', 'rgba(0,0,0,0.4)'], opacity: 1, region: 'full' } },
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
    showToast(`Added ${preset.name}`, 'success')
  }, [currentTime, duration, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setGradientOverlays, setOpenSections, pushSnapshot, showToast])


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

  const filteredTrending = useMemo(() => {
    if (!textPresetSearch.trim()) return TRENDING_PRESETS
    const q = textPresetSearch.toLowerCase()
    return TRENDING_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const filteredChapter = useMemo(() => {
    if (!textPresetSearch.trim()) return CHAPTER_PRESETS
    const q = textPresetSearch.toLowerCase()
    return CHAPTER_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

  const filteredPremiumCaptions = useMemo(() => {
    if (!textPresetSearch.trim()) return PREMIUM_CAPTION_PRESETS
    const q = textPresetSearch.toLowerCase()
    return PREMIUM_CAPTION_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
  }, [textPresetSearch])

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
    addOverlay(setTextOverlays, input, showToast, templateLayout, startTime, endTime)
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
    const text = typeof input === 'object' ? input.text : input
    if (typeof input === 'string' && text.trim()) {
      try { localStorage.setItem(MANUAL_EDIT_STORAGE_KEYS.lastCustomText, text) } catch { /* ignore */ }
      setLastCustomText(text)
    }
  }, [getTextStartEnd, setTextOverlays, showToast, templateLayout, videoFilters, textOverlays, pushSnapshot])

  /** One-click creativity packs: combine text + motion + gradient for common workflows */
  const CREATIVITY_PACKS: { id: string; name: string; description: string }[] = [
    { id: 'hook-cta', name: 'Hook + CTA', description: 'Viral hook at playhead, end screen CTA' },
    { id: 'lower-third-subscribe', name: 'Lower third + Subscribe', description: 'Name bar + subscribe bug' },
    { id: 'full-cta-bar', name: 'CTA + Lower third fade', description: 'Like & Subscribe + gradient bar' },
    { id: 'intro-outro', name: 'Intro + Outro', description: 'INTRO at playhead, See you next time at end' },
    { id: 'trending-save', name: 'Trending + Save this', description: 'Unpopular opinion + Save for later' },
  ]
  const applyCreativityPack = useCallback((packId: string) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    if (packId === 'hook-cta') {
      handleAddOverlay(VIRAL_HOOK_PRESETS[0], false, false)
      handleAddOverlay(END_SCREEN_TEMPLATES[4], true, false) // Like & Subscribe at end
      showToast('Hook + CTA pack applied', 'success')
    } else if (packId === 'lower-third-subscribe') {
      handleAddOverlay(TEXT_PRESETS.find((p) => p.label === 'Lower third')!, false, false)
      const t = MOTION_GRAPHIC_TEMPLATES.find((x) => x.id === 'subscribe-bug')
      if (t) applyMotionGraphicTemplate(t)
      showToast('Lower third + Subscribe bug applied', 'success')
    } else if (packId === 'full-cta-bar' && setGradientOverlays) {
      handleAddOverlay(END_SCREEN_TEMPLATES[4], true)
      addGradientOverlay(GRADIENT_PRESETS[0]) // lower-third
      showToast('CTA + Lower third fade applied', 'success')
    } else if (packId === 'intro-outro') {
      handleAddOverlay(CHAPTER_PRESETS[2], false, false) // Intro
      handleAddOverlay(END_SCREEN_TEMPLATES[7], true, false) // See you next time
      showToast('Intro + Outro pack applied', 'success')
    } else if (packId === 'trending-save') {
      handleAddOverlay(TRENDING_PRESETS[0], false, false) // Unpopular opinion
      handleAddOverlay(TRENDING_PRESETS[5], false, false) // Save this
      showToast('Trending + Save pack applied', 'success')
    }
    setOpenSections((prev) => ({ ...prev, currentOverlays: true }))
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, handleAddOverlay, applyMotionGraphicTemplate, addGradientOverlay, setGradientOverlays, showToast])

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
      if (p.n.toLowerCase().includes(q) || (p.desc && p.desc.toLowerCase().includes(q))) out.push({ type: 'filter', id: p.n, label: p.n, desc: p.desc })
    })
    STYLE_BUNDLES.forEach((b) => {
      if (b.label.toLowerCase().includes(q) || (b.desc && b.desc.toLowerCase().includes(q))) out.push({ type: 'style', id: b.id, label: b.label, desc: b.desc })
    })
    PLATFORM_BUNDLES.forEach((b) => {
      if (b.label.toLowerCase().includes(q) || (b.desc && b.desc.toLowerCase().includes(q))) out.push({ type: 'platform', id: b.id, label: b.label, desc: b.desc })
    })
    MOTION_GRAPHIC_TEMPLATES.forEach((t) => {
      if (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) out.push({ type: 'motion', id: t.id, label: t.name, template: t })
    })
      ;[...TEXT_PRESETS, ...VIRAL_HOOK_PRESETS, ...END_SCREEN_TEMPLATES, ...TRENDING_PRESETS, ...CHAPTER_PRESETS, ...PREMIUM_CAPTION_PRESETS].forEach((p) => {
        if (p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)) out.push({ type: 'text', id: `text-${p.label}`, label: p.label, preset: p })
      })
    return out.slice(0, 14)
  }, [presetSearchQuery])
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
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => ({ ...prev, ...bundle.filter }))
    showToast(`${bundle.label} — ${bundle.desc}`, 'success')
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, setVideoFilters, showToast])

  const resetFilters = useCallback(() => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setVideoFilters({ ...RESET_FILTER })
    showToast('Filters reset to default', 'info')
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setVideoFilters, showToast])

  const saveStyleInputRef = useRef<HTMLInputElement>(null)
  const openSaveStyleInline = useCallback(() => {
    setShowSaveStyle(true)
    toggleSection('styleBundles')
    setTimeout(() => saveStyleInputRef.current?.focus(), 150)
    showToast('Name your style and click Save', 'info')
  }, [toggleSection, showToast])

  const applyPresetSearchResult = useCallback((r: PresetSearchHit) => {
    if (r.type === 'filter') {
      const p = FILTER_PRESETS.find((x) => x.n === r.id)
      if (p) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setVideoFilters((prev) => ({ ...prev, ...p.f })); pushRecentFilter(p.n); showToast(`${p.n} applied`, 'success') }
    } else if (r.type === 'style') {
      const b = STYLE_BUNDLES.find((x) => x.id === r.id)
      if (b) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev) => ({ ...prev, ...b.filter } as any)); pushRecentStyle(b.id); showToast(`${b.label} applied`, 'success') }
    } else if (r.type === 'platform') {
      const b = PLATFORM_BUNDLES.find((x) => x.id === r.id)
      if (b) { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev) => ({ ...prev, ...b.filter } as any)); showToast(`${b.label} applied`, 'success') }
    } else if (r.type === 'text') {
      handleAddOverlay(r.preset)
      showToast(`Added "${r.label}"`, 'success')
    } else if (r.type === 'motion') {
      const t = MOTION_GRAPHIC_TEMPLATES.find((x) => x.id === r.id)
      if (t) applyMotionGraphicTemplate(t)
    }
    setPresetSearchQuery('')
  }, [templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, setVideoFilters, setTemplateLayout, handleAddOverlay, applyMotionGraphicTemplate, pushSnapshot, showToast, pushRecentFilter, pushRecentStyle])

  /** One-click creativity: apply a style bundle (layout + filter) for instant look */
  const applyStyleBundleOneClick = useCallback((bundle: typeof STYLE_BUNDLES[0]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setTemplateLayout?.(bundle.layout)
    setVideoFilters((prev: VideoFilter) => ({ ...prev, ...(bundle.filter as Partial<VideoFilter>) }))
    pushRecentStyle(bundle.id)
    showToast(`${bundle.label} — ${bundle.desc}`, 'success')
  }, [templateLayout, videoFilters, textOverlays, pushSnapshot, setTemplateLayout, pushRecentStyle, showToast])

  const layoutLabel = TEMPLATE_LAYOUTS.find((t) => t.id === templateLayout)?.label ?? 'Auto'
  const overlayCount = (textOverlays?.length ?? 0) + (shapeOverlays?.length ?? 0) + (imageOverlays?.length ?? 0) + (svgOverlays?.length ?? 0) + (gradientOverlays?.length ?? 0)
  const hasLook = Object.keys(videoFilters).some((k) => {
    const v = (videoFilters as unknown as Record<string, number>)[k]
    return typeof v === 'number' && v !== 100 && v !== 0
  })

  // ── Tab state ─────────────────────────────────────────────────────────────
  const EDIT_TABS = [
    { id: 'trim',     icon: Scissors,          label: 'Trim',    shortcut: 'T' },
    { id: 'text',     icon: Type,              label: 'Text',    shortcut: 'X' },
    { id: 'filters',  icon: SlidersHorizontal, label: 'Filters', shortcut: 'F' },
    { id: 'motion',   icon: Wand2,             label: 'Motion',  shortcut: 'M' },
    { id: 'overlays', icon: Layers,            label: 'Layers',  shortcut: 'L' },
    { id: 'packs',    icon: Zap,               label: 'Packs',   shortcut: 'P' },
    { id: 'insights', icon: BarChart3,         label: 'Data',    shortcut: 'I' },
  ] as const
  type EditTab = typeof EDIT_TABS[number]['id']

  const [activeEditTab, setActiveEditTab] = React.useState<EditTab>('text')
  const [speedValue, setSpeedValue] = React.useState(1)
  const [selectedFilterName, setSelectedFilterName] = React.useState('')
  const [globalSearch, setGlobalSearch] = React.useState('')
  const [layerOpacities, setLayerOpacities] = React.useState<Record<string, number>>({})
  const [captionLoading, setCaptionLoading] = React.useState(false)
  const [captionStyle, setCaptionStyle] = React.useState<'tiktok-pop' | 'hormozi-bold' | 'minimal-white' | 'neon-glow'>('tiktok-pop')
  const [captionError, setCaptionError] = React.useState<string | null>(null)
  const [captionSuccess, setCaptionSuccess] = React.useState<number | null>(null)  // count of captions added
  const [wordsPerCap, setWordsPerCap] = React.useState(4)
  const [captionY, setCaptionY] = React.useState<'top' | 'mid' | 'bottom'>('bottom')
  const [captionColor, setCaptionColor] = React.useState('#FFFFFF')
  const [manualTranscript, setManualTranscript] = React.useState('')
  const filtStrength = filterStrength ?? 100
  const setFiltStrength = setFilterStrength ?? (() => {})

  // Auto-caption: calls Whisper-backed caption endpoint then injects overlays
  const handleAutoCaption = useCallback(async () => {
    const transcriptText = transcript?.fullText ?? manualTranscript
    if (!transcriptText.trim()) {
      setCaptionError('No transcript found. Paste your script in the field below, then try again.')
      return
    }
    setCaptionLoading(true)
    setCaptionError(null)
    setCaptionSuccess(null)
    try {
      const yPct = captionY === 'top' ? 18 : captionY === 'mid' ? 50 : 82
      const data = await apiPost('/video/hook-analysis/auto-caption', {
        transcript: transcriptText,
        videoId,
        style: captionStyle,
        wordsPerCaption: wordsPerCap,
        duration,
      }) as { captions: Array<{ id: string; text: string; startTime: number; endTime: number; style: string }>; totalCaptions: number }

      if (!data?.captions?.length) {
        setCaptionError('No captions generated — transcript may be too short.')
        return
      }

      // Map caption segments to TextOverlay objects using user-controlled settings
      const ts = Date.now()
      type CaptionDefaults = { fontSize: number; style: TextOverlayStyle; fontFamily: string }
      const captionStyleMap: Record<string, CaptionDefaults> = {
        'tiktok-pop':    { fontSize: 36, style: 'bold-kinetic', fontFamily: 'Inter' },
        'hormozi-bold':  { fontSize: 42, style: 'bold-kinetic', fontFamily: 'Inter' },
        'minimal-white': { fontSize: 28, style: 'none',         fontFamily: 'Inter' },
        'neon-glow':     { fontSize: 34, style: 'neon',          fontFamily: 'Inter' },
      }
      const def = captionStyleMap[captionStyle] ?? captionStyleMap['tiktok-pop']

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
      }))

      pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
      setTextOverlays((prev: TextOverlay[]) => [...prev, ...newOverlays])
      setCaptionSuccess(data.totalCaptions)
      showToast(`✦ ${data.totalCaptions} captions added — ${captionStyle} style`, 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Caption generation failed'
      setCaptionError(msg)
      showToast('Auto-caption failed', 'error')
    } finally {
      setCaptionLoading(false)
    }
  }, [transcript, manualTranscript, videoId, captionStyle, wordsPerCap, captionY, captionColor, duration, templateLayout, videoFilters, textOverlays, shapeOverlays, imageOverlays, svgOverlays, gradientOverlays, pushSnapshot, setTextOverlays, showToast])

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
  }, [])

  // Global search: routes to the right tab
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (q.length < 2) return []
    type Hit = { label: string; tab: EditTab; action: () => void }
    const hits: Hit[] = []
    FILTER_PRESETS.forEach(p => {
      if (p.n.toLowerCase().includes(q)) hits.push({ label: `Filter: ${p.n}`, tab: 'filters', action: () => { applyFilter(p); setGlobalSearch('') } })
    })
    STYLE_BUNDLES.forEach(b => {
      if (b.label.toLowerCase().includes(q)) hits.push({ label: `Style: ${b.label}`, tab: 'packs', action: () => { applyStyleBundleOneClick(b); setGlobalSearch('') } })
    })
    MOTION_GRAPHIC_TEMPLATES.forEach(t => {
      if (t.name.toLowerCase().includes(q)) hits.push({ label: `Motion: ${t.name}`, tab: 'motion', action: () => { applyMotionGraphicTemplate(t); setGlobalSearch('') } })
    });[
      ...TEXT_PRESETS, ...VIRAL_HOOK_PRESETS, ...PREMIUM_CAPTION_PRESETS,
      ...TRENDING_PRESETS, ...END_SCREEN_TEMPLATES
    ].forEach(p => {
      if (p.label.toLowerCase().includes(q) || p.text.toLowerCase().includes(q))
        hits.push({ label: `Text: ${p.label}`, tab: 'text', action: () => { handleAddOverlay(p); setGlobalSearch('') } })
    })
    return hits.slice(0, 8)
  }, [globalSearch])

  const applyFilter = (p: typeof FILTER_PRESETS[number]) => {
    pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
    setVideoFilters((prev: VideoFilter) => ({ ...prev, ...p.f }))
    pushRecentFilter(p.n)
    setSelectedFilterName(p.n)
    showToast(`${p.n} applied`, 'success')
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
      <div className="shrink-0 px-3 pt-3 pb-0 space-y-2">
        {/* Global search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="Search all tools… (filters, motion, text)"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <span className="text-[10px] font-black">✕</span>
            </button>
          )}
        </div>

        {/* Global search results dropdown */}
        <AnimatePresence>
          {globalSearchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              {globalSearchResults.map((r, i) => (
                <button key={i} onClick={() => { setActiveEditTab(r.tab); r.action() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.04] last:border-0"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="text-[11px] text-slate-200 font-black">{r.label}</span>
                  <span className="ml-auto text-[9px] text-slate-600 font-black uppercase tracking-widest">{r.tab}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo / Redo + status strip */}
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={undo} disabled={undoStack.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/10 disabled:opacity-25 transition-all text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-widest"
          >
            <Undo2 className="w-3 h-3" /> Undo
            {undoStack.length > 0 && <span className="bg-indigo-600 text-white rounded-full px-1 text-[8px] ml-0.5">{undoStack.length}</span>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={redo} disabled={redoStack.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/10 disabled:opacity-25 transition-all text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-widest"
          >
            <Redo2 className="w-3 h-3" /> Redo
          </motion.button>
          <div className="flex-1" />
          {overlayCount > 0 && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{overlayCount} layers</span>}
          {hasLook && <button onClick={resetFilters} className="text-[9px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors">Reset look</button>}
        </div>

        {/* Animated Tab bar */}
        <div className="relative flex gap-0.5 bg-black/50 p-1 rounded-2xl border border-white/[0.06]">
          {EDIT_TABS.map(({ id, icon: Icon, label, shortcut }) => (
            <button
              key={id}
              onClick={() => setActiveEditTab(id)}
              title={`${label} (Alt+${shortcut})`}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors z-10 ${
                activeEditTab === id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeEditTab === id && (
                <motion.div
                  layoutId="edit-tab-bg"
                  className="absolute inset-0 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="text-[7.5px] font-black uppercase tracking-widest leading-none relative z-10">{label}</span>
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
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Waveform</span>
                <span className="text-[10px] font-black text-indigo-400 font-mono">{currentTime.toFixed(2)}s / {duration.toFixed(1)}s</span>
              </div>
              <div className="relative h-12 flex gap-px items-center overflow-hidden rounded-xl bg-black/40">
                {Array.from({ length: 48 }, (_, i) => {
                  const h = 20 + Math.abs(Math.sin(i * 0.7) * 60 + Math.cos(i * 1.3) * 20)
                  const isCurrent = Math.abs(i / 48 - currentTime / Math.max(duration, 1)) < 0.025
                  return (
                    <div key={i} className="flex-1 flex items-center justify-center">
                      <div
                        style={{ height: `${Math.min(h, 95)}%` }}
                        className={`w-full rounded-sm transition-colors ${isCurrent ? 'bg-indigo-400' : i / 48 < currentTime / Math.max(duration, 1) ? 'bg-indigo-600/60' : 'bg-slate-600/40'}`}
                      />
                    </div>
                  )
                })}
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] pointer-events-none"
                  style={{ left: `${(currentTime / Math.max(duration, 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Speed ramp */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Speed Ramp</span>
                <span className={`text-sm font-black font-mono ${speedValue < 1 ? 'text-cyan-400' : speedValue > 1 ? 'text-orange-400' : 'text-indigo-400'}`}>{speedValue}×</span>
              </div>
              <input
                type="range" min={0.25} max={4} step={0.25} value={speedValue}
                onChange={e => { setSpeedValue(Number(e.target.value)); showToast(`Speed: ${e.target.value}×`, 'info') }}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between mt-1.5">
                {[0.25, 0.5, 1, 1.5, 2, 3, 4].map(v => (
                  <button key={v} onClick={() => { setSpeedValue(v); showToast(`Speed: ${v}×`, 'info') }}
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
                { icon: RotateCcw, label: 'Reverse', sub: hasSegmentSelection ? 'Flip selected clip' : 'Select a clip first', color: 'text-violet-400', action: () => onReverseSelected?.(), comingSoon: !onReverseSelected, requiresSelection: true },
                { icon: Split, label: 'Split at Playhead', sub: `@ ${currentTime.toFixed(1)}s`, color: 'text-indigo-400', action: () => onSplitAtPlayhead?.(), comingSoon: !onSplitAtPlayhead, requiresSelection: false },
                { icon: Maximize, label: 'Freeze Frame', sub: `Hold 1s @ ${currentTime.toFixed(1)}s`, color: 'text-amber-400', action: () => onFreezeAtPlayhead?.(1.0), comingSoon: !onFreezeAtPlayhead, requiresSelection: false },
                { icon: Scissors, label: 'Trim to In/Out', sub: trimInPoint != null && trimOutPoint != null ? `${(trimOutPoint - trimInPoint).toFixed(2)}s` : 'Set In + Out below', color: 'text-emerald-400', action: () => {
                  if (trimInPoint == null || trimOutPoint == null) {
                    showToast('Set both In and Out points first', 'info')
                    return
                  }
                  onTrimSelectedToRange?.(trimInPoint, trimOutPoint)
                }, comingSoon: !onTrimSelectedToRange, requiresSelection: true },
                { icon: ArrowLeft, label: 'J-Cut', sub: hasSegmentSelection ? 'Audio leads 0.5s' : 'Select a clip first', color: 'text-rose-400', action: () => onJCutSelected?.(0.5), comingSoon: !onJCutSelected, requiresSelection: true },
                { icon: ChevronRight, label: 'L-Cut', sub: hasSegmentSelection ? 'Audio tail 0.5s' : 'Select a clip first', color: 'text-pink-400', action: () => onLCutSelected?.(0.5), comingSoon: !onLCutSelected, requiresSelection: true },
              ].map(({ icon: Icon, label, sub, color, action, comingSoon, requiresSelection }) => {
                const disabled = !!comingSoon || (requiresSelection && !hasSegmentSelection)
                const titleText = comingSoon
                  ? `${label} — coming soon`
                  : (requiresSelection && !hasSegmentSelection ? `${label} — select a clip first` : label)
                return (
                  <motion.button
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
                        Soon
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* In / Out marker controls — drives the Trim to In/Out op above. */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">In / Out Markers</span>
                <span className="text-[9px] font-mono text-slate-500">
                  {trimInPoint != null ? `In ${trimInPoint.toFixed(2)}s` : 'No In'} · {trimOutPoint != null ? `Out ${trimOutPoint.toFixed(2)}s` : 'No Out'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTrimInPoint(currentTime)
                    if (trimOutPoint != null && currentTime >= trimOutPoint) setTrimOutPoint(null)
                    showToast(`In set @ ${currentTime.toFixed(2)}s`, 'success')
                  }}
                  className="px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                >
                  Set In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (trimInPoint != null && currentTime <= trimInPoint) {
                      showToast('Out must come after In', 'error')
                      return
                    }
                    setTrimOutPoint(currentTime)
                    showToast(`Out set @ ${currentTime.toFixed(2)}s`, 'success')
                  }}
                  className="px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                >
                  Set Out
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
                  Clear
                </button>
              </div>
            </div>

            {/* Format / Aspect Ratio */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Format / Aspect Ratio</span>
              <div className="grid grid-cols-3 gap-1.5">
                {TEMPLATE_LAYOUTS.map(l => (
                  <motion.button key={l.id} whileTap={{ scale: 0.96 }}
                    onClick={() => { pushSnapshot(l.id, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(l.id); showToast(`${l.label} applied`, 'success') }}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${templateLayout === l.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/[0.02] text-slate-400 hover:bg-white/10 hover:text-white border border-white/[0.06]'}`}
                  >{l.label}</motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ TEXT ════ */}
        {activeEditTab === 'text' && (
          <div className="space-y-3">
            {/* Quick add */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex gap-2 mb-2">
                <input
                  ref={customTextInputRef}
                  value={textCustom}
                  onChange={e => setTextCustom(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { handleAddOverlay(textCustom || 'New Text'); setTextCustom('') } }}
                  placeholder="Type text… (⌘↵ to add)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-xs font-medium placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                  onClick={() => { if (textCustom.trim()) { handleAddOverlay(textCustom); setTextCustom('') } else { handleAddOverlay('New Text') } }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shrink-0"
                >Add</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Duration:</span>
                {[-1, 3, 5, 8, 15].map(d => (
                  <button key={d} onClick={() => setTextDuration(d)}
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">AI Auto-Caption</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Auto-cap count badge */}
                  {(() => { const autoCaps = textOverlays?.filter(o => o.id.startsWith('autocap-')).length ?? 0; return autoCaps > 0 ? (
                    <button
                      title="Clear auto-generated captions"
                      onClick={() => {
                        pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? [])
                        setTextOverlays((prev: TextOverlay[]) => prev.filter(o => !o.id.startsWith('autocap-')))
                        setCaptionSuccess(null)
                        showToast('Auto-captions cleared', 'info')
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[8px] font-black text-indigo-300 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 transition-all uppercase tracking-widest"
                    >
                      <Trash2 className="w-2.5 h-2.5" />{autoCaps} captions
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
                    {(transcript?.fullText || manualTranscript.trim()) ? 'Ready' : 'No script'}
                  </span>
                </div>
              </div>

              <div className="px-3 pb-3 space-y-2.5">
                {/* Style picker with live preview */}
                <div className="grid grid-cols-4 gap-1">
                  {([
                    { id: 'tiktok-pop',    label: 'TikTok',  preview: { color: '#fff', shadow: 'drop-shadow(0 0 6px rgba(236,72,153,0.8))' } },
                    { id: 'hormozi-bold',  label: 'Hormozi', preview: { color: '#fff', shadow: 'none' } },
                    { id: 'minimal-white', label: 'Minimal', preview: { color: '#e2e8f0', shadow: 'none' } },
                    { id: 'neon-glow',     label: 'Neon',    preview: { color: '#00F5FF', shadow: 'drop-shadow(0 0 8px rgba(0,245,255,0.8))' } },
                  ] as const).map(s => (
                    <button key={s.id} onClick={() => { setCaptionStyle(s.id); if (s.id === 'neon-glow') setCaptionColor('#00F5FF'); else setCaptionColor('#FFFFFF') }}
                      className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${
                        captionStyle === s.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/30' : 'bg-white/5 text-slate-500 hover:text-white border border-white/[0.06]'
                      }`}
                    >
                      <span style={{ color: captionStyle === s.id ? s.preview.color : undefined, filter: captionStyle === s.id ? s.preview.shadow : undefined }}
                        className="text-[9px] font-black leading-none">Aa</span>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Manual transcript textarea — shown when no transcript attached */}
                {!transcript?.fullText && (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                      Paste your script
                    </label>
                    <textarea
                      title="Paste your video script here"
                      placeholder="Paste or type the spoken words from your video…"
                      value={manualTranscript}
                      onChange={e => { setManualTranscript(e.target.value); setCaptionError(null) }}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-[10px] placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none transition-all leading-relaxed"
                    />
                    {manualTranscript.trim() && (
                      <p className="text-[8px] text-slate-600 mt-0.5">
                        {manualTranscript.trim().split(/\s+/).length} words
                      </p>
                    )}
                  </div>
                )}

                {/* Controls row: words per caption + position + color */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Words per caption */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">Words/line</span>
                    <div className="flex gap-0.5">
                      {[2, 3, 4, 5, 6].map(n => (
                        <button key={n} onClick={() => setWordsPerCap(n)}
                          className={`flex-1 py-1 rounded-lg text-[8px] font-black transition-all ${
                            wordsPerCap === n ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                          }`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>

                  {/* Vertical position */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">Position</span>
                    <div className="flex gap-0.5">
                      {(['top', 'mid', 'bottom'] as const).map(pos => (
                        <button key={pos} onClick={() => setCaptionY(pos)}
                          title={`Position captions at ${pos}`}
                          className={`flex-1 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${
                            captionY === pos ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'
                          }`}
                        >{pos === 'bottom' ? '▼' : pos === 'top' ? '▲' : '◆'}</button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block mb-1">Color</span>
                    <div className="flex items-center gap-1">
                      <input type="color" value={captionColor} onChange={e => setCaptionColor(e.target.value)}
                        title="Caption text color"
                        className="w-7 h-7 rounded-lg cursor-pointer border border-white/10 bg-transparent p-0.5"
                      />
                      <div className="flex gap-0.5 flex-1">
                        {['#FFFFFF', '#FFFF00', '#00F5FF'].map(c => (
                          <button key={c} onClick={() => setCaptionColor(c)}
                            title={`Set caption color to ${c}`}
                            style={{ background: c }}
                            className={`flex-1 h-7 rounded-lg border transition-all ${
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
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <p className="text-[9px] text-emerald-300 font-black">{captionSuccess} captions added in {captionStyle} style</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generate button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAutoCaption}
                  disabled={captionLoading}
                  aria-label="Generate auto-captions from transcript"
                  className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    captionLoading
                      ? 'bg-indigo-600/40 text-indigo-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 shadow-lg shadow-indigo-600/20'
                  }`}
                >
                  {captionLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-3.5 h-3.5 border-2 border-indigo-300/40 border-t-indigo-300 rounded-full"
                      />
                      Generating {wordsPerCap}-word captions…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Captions
                    </>
                  )}
                </motion.button>

                {/* Error state */}
                <AnimatePresence>
                  {captionError && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20"
                    >
                      <p className="text-[9px] text-rose-300 leading-relaxed">{captionError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Search presets */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={textPresetSearch} onChange={e => setTextPresetSearch(e.target.value)}
                placeholder="Search presets…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
              />
            </div>

            {/* Preset groups */}
            {[
              { label: 'Viral Hooks', presets: filteredViralHooks },
              { label: 'Text Presets', presets: filteredTextPresets },
              { label: 'Premium Captions', presets: filteredPremiumCaptions },
              { label: 'Reaction / Callouts', presets: filteredReactionCallouts },
              { label: 'Trending', presets: filteredTrending },
              { label: 'End Screens', presets: filteredEndScreens },
              { label: 'Chapters', presets: filteredChapter },
            ].map(({ label, presets }) => presets.length > 0 && (
              <div key={label}>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">{label}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.slice(0, 8).map((p, i) => (
                    <button key={`${p.label}-${i}`}
                      onClick={() => handleAddOverlay(p)}
                      className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all text-left group"
                    >
                      <div className="text-[10px] font-black text-slate-200 group-hover:text-white truncate">{p.label}</div>
                      <div className="text-[8px] text-slate-600 group-hover:text-slate-400 truncate mt-0.5">{p.text}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Active text overlays */}
            {(textOverlays?.length ?? 0) > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Active Text ({textOverlays?.length})</span>
                <div className="space-y-1">
                  {textOverlays?.map(o => (
                    <div key={o.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${selectedTextId === o.id ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'}`}
                      onClick={() => setSelectedTextId(o.id)}
                    >
                      <Type className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="flex-1 text-[10px] font-black text-slate-200 truncate">{o.text}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button onClick={e => { e.stopPropagation(); pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTextOverlays((prev: TextOverlay[]) => prev.filter(t => t.id !== o.id)) }}
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
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-indigo-500/20 space-y-3"
                >
                  {/* Preview */}
                  <div className="relative h-16 rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center">
                    <span
                      style={{
                        fontFamily: o.fontFamily ?? 'Inter',
                        fontSize: Math.min(o.fontSize ?? 32, 28),
                        textShadow: o.style === 'neon' ? `0 0 10px ${o.color}` : o.style === 'shadow' ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
                        fontWeight: o.style === 'bold-kinetic' ? 900 : 700,
                        WebkitTextStroke: o.style === 'outline' ? `1px ${o.color}` : undefined,
                        color: o.style === 'outline' ? 'transparent' : o.color,
                      }}
                    >{o.text || 'Preview'}</span>
                    <span className="absolute top-1.5 left-2 text-[8px] font-black text-slate-600 uppercase tracking-widest">Live Preview</span>
                  </div>

                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-400 block">Editing: {o.text.slice(0, 24)}{o.text.length > 24 ? '…' : ''}</span>
                  <input value={o.text} onChange={e => updateTextOverlay(o.id, { text: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Font Size</span>
                      <input type="number" value={o.fontSize ?? 32} min={10} max={120}
                        onChange={e => updateTextOverlay(o.id, { fontSize: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Color</span>
                      <input type="color" value={o.color} onChange={e => updateTextOverlay(o.id, { color: e.target.value })}
                        className="w-full h-8 rounded-lg border border-white/[0.06] bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Style</span>
                    <div className="flex flex-wrap gap-1">
                      {(['none','neon','minimal','bold-kinetic','outline','shadow'] as const).map(s => (
                        <button key={s} onClick={() => updateTextOverlay(o.id, { style: s })}
                          className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${o.style === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  {/* Animation In/Out */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Animate In</span>
                      <select value={(o as any).animationIn ?? 'none'} onChange={e => updateTextOverlay(o.id, { animationIn: e.target.value as any })}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      >
                        {['none','fade','slide-up','slide-down','slide-left','scale','bounce'].map(a => (
                          <option key={a} value={a} className="bg-slate-900 capitalize">{a}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Animate Out</span>
                      <select value={(o as any).animationOut ?? 'none'} onChange={e => updateTextOverlay(o.id, { animationOut: e.target.value as any })}
                        className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                      >
                        {['none','fade','slide-up','slide-down','slide-right','scale','bounce'].map(a => (
                          <option key={a} value={a} className="bg-slate-900 capitalize">{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black block mb-1">Font</span>
                    <select value={o.fontFamily ?? 'Inter, system-ui, sans-serif'} onChange={e => updateTextOverlay(o.id, { fontFamily: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    >
                      {CAPTION_FONTS.map(f => <option key={f.family} value={f.family} className="bg-slate-900">{f.name}</option>)}
                      {customFonts.map(f => <option key={f.family} value={f.family} className="bg-slate-900">{f.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black shrink-0">Start</span>
                    <input type="number" value={o.startTime} step={0.1} min={0} max={duration}
                      onChange={e => updateTextOverlay(o.id, { startTime: Number(e.target.value) })}
                      className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    />
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black shrink-0">End</span>
                    <input type="number" value={o.endTime} step={0.1} min={0} max={duration}
                      onChange={e => updateTextOverlay(o.id, { endTime: Number(e.target.value) })}
                      className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/[0.06] text-white text-xs focus:outline-none"
                    />
                  </div>
                  {/* Upload custom font */}
                  <button onClick={() => fontInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 transition-all text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest"
                  ><Upload className="w-3 h-3" /> Upload Font</button>
                  <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                </motion.div>
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
                <button key={c.id} onClick={() => setFilterCategory(c.id)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filterCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-white/[0.04] text-slate-500 hover:text-white border border-white/[0.06]'}`}
                >{c.label}</button>
              ))}
            </div>

            {/* Strength slider */}
            {selectedFilterName && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{selectedFilterName}</span>
                  <span className="text-[10px] font-black text-indigo-400 font-mono">{filtStrength}%</span>
                </div>
                <input type="range" min={0} max={100} value={filtStrength}
                  onChange={e => setFiltStrength(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between mt-1">
                  <button onClick={resetFilters} className="text-[9px] text-slate-500 hover:text-rose-400 font-black uppercase tracking-widest transition-colors">Reset</button>
                  <div className="flex gap-2">
                    {setCompareMode && ['before','after','split'].map(m => (
                      <button key={m} onClick={() => setCompareMode(m as any)}
                        className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg transition-all ${compareMode === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pinned filters */}
            {pinnedPresets.length > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Pinned</span>
                <div className="flex gap-2">
                  {pinnedPresets.map(p => (
                    <button key={p.n} onClick={() => applyFilter(p)}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all bg-gradient-to-br ${p.swatch} bg-opacity-20 ${selectedFilterName === p.n ? 'border-indigo-500/50 text-white' : 'border-white/10 text-slate-300'}`}
                    >{p.n}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter grid with live CSS preview */}
            <div className="grid grid-cols-2 gap-2">
              {FILTER_PRESETS_WITH_CATEGORY
                .filter(p => filterCategory === 'all' || p.category === filterCategory)
                .map(p => (
                <motion.button key={p.n} onClick={() => applyFilter(p)} whileTap={{ scale: 0.97 }}
                  className={`relative overflow-hidden flex flex-col items-start gap-1 p-2.5 rounded-xl border transition-all group ${selectedFilterName === p.n ? 'border-indigo-500/60 bg-indigo-600/10 ring-1 ring-indigo-500/30' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20'}`}
                >
                  {/* Live CSS filter preview on a gradient */}
                  <div
                    className={`w-full h-9 rounded-lg bg-gradient-to-br ${p.swatch} mb-1 transition-all`}
                    style={{ filter: filterToCss(p.f) }}
                  />
                  <span className="text-[10px] font-black text-slate-200 group-hover:text-white">{p.n}</span>
                  <span className="text-[8px] text-slate-600 group-hover:text-slate-400">{p.desc}</span>
                  {selectedFilterName === p.n && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute top-2 left-2 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.8)]"
                    />
                  )}
                  <div role="button" onClick={e => { e.stopPropagation(); togglePinFilter(p.n) }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
                  >
                    <Pin className={`w-3 h-3 ${pinnedFilterNames.includes(p.n) ? 'text-indigo-400' : 'text-slate-500'}`} />
                  </div>
                </motion.button>
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
                  placeholder="Search templates…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Timer className="w-3 h-3 text-slate-500" />
                <input type="number" value={motionGraphicDuration} min={1} max={30} step={1}
                  onChange={e => setMotionGraphicDuration(Number(e.target.value) || 5)}
                  className="w-8 bg-transparent text-white text-xs font-black focus:outline-none"
                />
                <span className="text-[9px] text-slate-500">s</span>
              </div>
            </div>

            {/* Recent row */}
            {recentMotionTemplateIds.length > 0 && (
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Recent</span>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {recentMotionTemplateIds.map(id => {
                    const t = MOTION_GRAPHIC_TEMPLATES.find(x => x.id === id)
                    if (!t) return null
                    return (
                      <button key={t.id} onClick={() => applyMotionGraphicTemplate(t)}
                        className="flex-shrink-0 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/40 transition-all text-left"
                      >
                        <div className="text-[10px] font-black text-indigo-300 whitespace-nowrap">{t.name}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Template grid */}
            <div className="grid grid-cols-1 gap-2">
              {filteredMotionTemplates.map(t => (
                <button key={t.id} onClick={() => applyMotionGraphicTemplate(t)}
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
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Add Shape</span>
              <div className="flex gap-2">
                {(['rect','circle','line'] as const).map(kind => (
                  <button key={kind} onClick={() => addShape(kind)}
                    className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest capitalize transition-all"
                  >{kind}</button>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {SHAPE_PRESETS.map(p => (
                  <button key={p.id} onClick={() => addShapePreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 text-[8px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
                  >{p.name}</button>
                ))}
              </div>
            </div>

            {/* Add image overlay */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Add Image / Logo</span>
              <div className="flex gap-2">
                <input value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)}
                  placeholder="Paste image URL…"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
                <button onClick={addImageOverlay} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">Add</button>
              </div>
            </div>

            {/* Add SVG overlay */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Add SVG</span>
              <div className="flex gap-2">
                <input value={svgUrlInput} onChange={e => setSvgUrlInput(e.target.value)}
                  placeholder="SVG URL or data URI…"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                />
                <button onClick={addSvgOverlay} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">Add</button>
              </div>
              <button onClick={() => svgFileInputRef.current?.click()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-all"
              ><Upload className="w-3 h-3" /> Upload SVG File</button>
              <input ref={svgFileInputRef} type="file" accept=".svg" className="hidden" onChange={handleSvgFileUpload} />
            </div>

            {/* Gradient overlays */}
            {setGradientOverlays && (
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Gradient Overlays</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {GRADIENT_PRESETS.map(p => (
                    <button key={p.id} onClick={() => addGradientOverlay(p)}
                      className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/10 hover:border-indigo-500/30 text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all text-left"
                    >{p.name}</button>
                  ))}
                </div>
              </div>
            )}

            {/* All active overlays — layer stack with opacity */}
            {overlayCount > 0 ? (
              <div>
                <div className="flex items-center justify-between pl-1 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">All Layers ({overlayCount})</span>
                  <span className="text-[8px] text-slate-600">Hover to reveal controls</span>
                </div>
                <div className="space-y-1">
                  {textOverlays?.map(o => (
                    <div key={o.id} className="group">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-indigo-500/20 transition-all cursor-pointer"
                        onClick={() => { setActiveEditTab('text'); setSelectedTextId(o.id) }}
                      >
                        <Type className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="flex-1 text-[10px] text-slate-300 truncate">{o.text}</span>
                        <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}–{o.endTime.toFixed(1)}s</span>
                        <button onClick={e => { e.stopPropagation(); pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTextOverlays((prev: TextOverlay[]) => prev.filter(t => t.id !== o.id)) }}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                        ><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {/* Opacity row */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all pl-8 pr-3 py-1 flex items-center gap-2">
                        <span className="text-[7px] text-slate-600 uppercase tracking-widest font-black shrink-0">Opacity</span>
                        <input type="range" min={0} max={1} step={0.05}
                          value={layerOpacities[o.id] ?? 1}
                          onChange={e => setLayerOpacities(prev => ({ ...prev, [o.id]: Number(e.target.value) }))}
                          className="flex-1 accent-indigo-500 h-1"
                        />
                        <span className="text-[7px] text-slate-600 font-black w-6 text-right">{Math.round((layerOpacities[o.id] ?? 1) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                  {shapeOverlays?.map(o => (
                    <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group">
                      <Box className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 capitalize">{o.kind}</span>
                      <span className="text-[8px] text-slate-600">{o.startTime.toFixed(1)}s</span>
                      <button onClick={() => setShapeOverlays?.((prev: ShapeOverlay[]) => prev.filter(s => s.id !== o.id))}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {imageOverlays?.map(o => (
                    <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] group">
                      <ImageIcon className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300 truncate">{o.url.split('/').pop()}</span>
                      <button onClick={() => setImageOverlays?.((prev: ImageOverlay[]) => prev.filter(i => i.id !== o.id))}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <Layers className="w-8 h-8 text-slate-700" />
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No layers yet</p>
                <p className="text-[9px] text-slate-700 max-w-[160px] leading-relaxed">Add shapes, images, or SVGs above. Text overlays appear here too.</p>
                <button onClick={() => { setActiveEditTab('text'); handleAddOverlay('New Text') }}
                  className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-[9px] font-black text-indigo-400 hover:bg-indigo-600/40 transition-all uppercase tracking-widest"
                >+ Add Text Layer</button>
              </div>
            )}

            {/* Motion compounds */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Save as Compound</span>
              <div className="flex gap-2">
                <input value={compoundName} onChange={e => setCompoundName(e.target.value)}
                  placeholder="Compound name…"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
                <input type="number" value={compoundDuration} min={1} max={60}
                  onChange={e => setCompoundDuration(Number(e.target.value) || 5)}
                  className="w-14 px-2 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white focus:outline-none text-center"
                />
                <button onClick={saveAsCompound} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shrink-0">Save</button>
              </div>
              {savedCompounds.length > 0 && (
                <div className="mt-2 space-y-1">
                  {savedCompounds.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.04] group">
                      <Archive className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="flex-1 text-[10px] text-slate-300">{c.name}</span>
                      <span className="text-[8px] text-slate-600">{c.duration}s</span>
                      <button onClick={() => addCompoundToTimeline(c)} className="px-2 py-0.5 rounded-lg bg-indigo-600/30 text-indigo-400 text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Inject</button>
                      <button onClick={() => deleteCompound(c.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"><Trash2 className="w-3 h-3" /></button>
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
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">One-Click Packs</span>
              <div className="space-y-2">
                {CREATIVITY_PACKS.map(pack => (
                  <button key={pack.id} onClick={() => applyCreativityPack(pack.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all text-left group"
                  >
                    <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[11px] font-black text-slate-200 group-hover:text-white">{pack.name}</div>
                      <div className="text-[9px] text-slate-500 group-hover:text-slate-400">{pack.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style bundles */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Style Bundles</span>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_BUNDLES.slice(0, 8).map(b => (
                  <button key={b.id} onClick={() => applyStyleBundleOneClick(b)}
                    className="relative overflow-hidden flex flex-col gap-1 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/20 transition-all text-left group"
                  >
                    <div className={`w-full h-5 rounded-lg bg-gradient-to-r ${b.swatch} mb-1`} />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white">{b.label}</div>
                    <div className="text-[8px] text-slate-600 group-hover:text-slate-400">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform bundles */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Platform Optimized</span>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_BUNDLES.map(b => (
                  <button key={b.id} onClick={() => applyPlatformBundle(b)}
                    className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 hover:border-indigo-500/20 transition-all text-left group"
                  >
                    <Globe className="w-4 h-4 text-indigo-400 mb-1" />
                    <div className="text-[10px] font-black text-slate-200 group-hover:text-white leading-tight">{b.label}</div>
                    <div className="text-[8px] text-slate-500 group-hover:text-slate-400">{b.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Save custom style */}
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 block mb-2">Save My Style</span>
              <div className="flex gap-2">
                <input value={customStyleName} onChange={e => setCustomStyleName(e.target.value)}
                  placeholder="Style name…"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-white placeholder:text-slate-600 focus:outline-none transition-all"
                />
                <button onClick={saveMyStyle} disabled={!customStyleName.trim()}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase disabled:opacity-40 hover:bg-emerald-500 transition-all shrink-0"
                ><Save className="w-3 h-3" /></button>
              </div>
              {customStyleBundles.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {customStyleBundles.map(b => (
                    <button key={b.id}
                      onClick={() => { pushSnapshot(templateLayout, videoFilters, textOverlays ?? [], shapeOverlays ?? [], imageOverlays ?? [], svgOverlays ?? [], gradientOverlays ?? []); setTemplateLayout?.(b.layout); setVideoFilters((prev: VideoFilter) => ({ ...prev, ...b.filter } as VideoFilter)); showToast(`${b.name} applied`, 'success') }}
                      className="px-3 py-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-[9px] font-black text-violet-300 hover:bg-violet-600/40 transition-all"
                    >{b.name}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick nav to other sections */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1 block mb-1.5">Go To</span>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_NAV.map(nav => (
                  <button key={nav.id} onClick={() => setActiveCategory?.(nav.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/10 transition-all text-left group"
                  >
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${nav.color} flex items-center justify-center shrink-0`}>
                      <nav.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 group-hover:text-white">{nav.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ INSIGHTS ════ */}
        {activeEditTab === 'insights' && (
          <div className="space-y-3">
            {/* Retention heatmap */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Retention Heatmap</span>
                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">α Peak @ 4.2s</span>
              </div>
              <div className="flex gap-1 h-16 items-end">
                {[60,45,85,55,95,40,75,55,88,98,35,68,60,92,48,70,50,85,72,60].map((h, i) => (
                  <motion.div key={i}
                    initial={{ height: '0%' }}
                    animate={{ height: `${Number.isNaN(h) ? 0 : h}%` }}
                    transition={{ delay: i * 0.03, duration: 0.8, ease: 'circOut' }}
                    className={`flex-1 rounded-t-lg ${h > 90 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : h > 70 ? 'bg-indigo-700/70' : 'bg-indigo-900/40'}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-slate-600">0s</span>
                <span className="text-[8px] text-slate-600">{(duration / 2).toFixed(0)}s</span>
                <span className="text-[8px] text-slate-600">{duration.toFixed(0)}s</span>
              </div>
            </div>

            {/* Lab scores */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Lab Diagnosis</span>
              {[
                { label: 'Hook Strength', value: 92, color: 'bg-indigo-500' },
                { label: 'Tone Cohesion',  value: 88, color: 'bg-emerald-500' },
                { label: 'Pacing',          value: 76, color: 'bg-amber-500' },
                { label: 'Viral Potential', value: 81, color: 'bg-fuchsia-500' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{label}</span>
                    <span className="text-[9px] text-white font-black">{value}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${color}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* AI Suggestions */}
            <div className="p-4 rounded-2xl bg-indigo-500/[0.06] border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Directives</span>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Target, text: 'Anchor viral hook to peak engagement node at 4.2s', action: 'Apply', color: 'text-indigo-400' },
                  { icon: TrendingUp, text: 'Boost pacing in mid-section — cut average clip length by 0.8s', action: 'Plan', color: 'text-amber-400' },
                  { icon: Eye, text: 'Add lower-third CTA at 80% — high save-rate zone', action: 'Add', color: 'text-emerald-400' },
                ].map(({ icon: Icon, text, action, color }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className={`w-3 h-3 ${color} mt-0.5 shrink-0`} />
                    <p className="flex-1 text-[9px] text-slate-400 leading-relaxed">{text}</p>
                    <button onClick={() => showToast(`${action} directive queued`, 'info')}
                      className={`shrink-0 px-2 py-0.5 rounded-lg bg-white/5 text-[8px] font-black uppercase tracking-widest ${color} hover:bg-white/10 transition-all`}
                    >{action}</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript section */}
            {transcript?.fullText && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transcript</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-6">{transcript.fullText}</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default BasicEditorView

