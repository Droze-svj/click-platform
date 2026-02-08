export interface VideoFilter {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  blur: number
  sepia: number
  vignette: number
  sharpen: number
  noise: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  clarity: number
  dehaze: number
  vibrance: number
  /** Optional LUT id or URL for professional color (applied in export) */
  lutId?: string | null
  lutUrl?: string | null
}

export type TimelineSegmentType = 'video' | 'audio' | 'text' | 'transition' | 'image'

/** Transition at end of segment to next segment */
export type SegmentTransitionType = 'none' | 'crossfade' | 'dip' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'zoom'

export interface TimelineSegment {
  id: string
  startTime: number
  endTime: number
  duration: number
  type: TimelineSegmentType
  name: string
  color: string
  track: number
  sourceStartTime?: number
  sourceEndTime?: number
  sourceUrl?: string
  properties?: any
  /** Transition to next segment */
  transitionOut?: SegmentTransitionType
  /** Transition duration in seconds */
  transitionDuration?: number
  /** Playback speed for this segment (e.g. 0.5 = slow-mo, 2 = fast) */
  playbackSpeed?: number
  /** Speed at segment start (for ramping); when set, creates speed ramp to playbackSpeedEnd */
  playbackSpeedStart?: number
  /** Speed at segment end (for ramping) */
  playbackSpeedEnd?: number
}

export type CaptionSize = 'small' | 'medium' | 'large'
export type CaptionLayout = 'bottom-center' | 'lower-third' | 'top-center' | 'full-width-bottom'

/** Visual style for transcript dialogue captions (word-level, synced to video). */
export type CaptionTextStyle =
  | 'default'      /* normal weight, subtle shadow */
  | 'uppercase'    /* ALL CAPS */
  | 'bold'         /* heavier weight */
  | 'outline'      /* stroked outline, no fill */
  | 'shadow'       /* strong drop shadow */
  | 'pill'         /* rounded pill background */
  | 'neon'         /* glowing text */
  | 'minimal'      /* thin, minimal shadow */
  | 'kinetic'      /* bold + scale pop on active word */
  | 'cinematic'    /* serif, film look */
  | 'retro'        /* warm vintage */
  | 'subtitle'     /* classic subtitle outline */
  | 'karaoke'      /* bold center */
  | 'serif'        /* elegant serif */
  | 'high-contrast' /* white on black, strong outline */

export interface CaptionStyle {
  enabled: boolean
  size: CaptionSize
  font: string
  layout: CaptionLayout
  textStyle?: CaptionTextStyle
  /** When true, show contextually matching emojis alongside dialogue for engagement. */
  emojisEnabled?: boolean
}

/** Preview canvas / frame aspect ratio. Video uses object-fit: contain. */
export type TemplateLayout =
  | 'auto'         /* match video intrinsic aspect */
  | 'standard'     /* 16:9 */
  | 'square'       /* 1:1 */
  | 'vertical'     /* 9:16 */
  | 'portrait'     /* 4:5 */
  | 'cinematic'    /* 2.39:1 */
  | 'classic'      /* 4:3 */

export const TEMPLATE_LAYOUTS: { id: TemplateLayout; label: string; aspect: string; desc: string; platform?: string }[] = [
  { id: 'auto', label: 'Auto', aspect: '16/9', desc: 'Match video', platform: 'Source' },
  { id: 'standard', label: 'Standard', aspect: '16/9', desc: '16:9', platform: 'YouTube · Landscape' },
  { id: 'square', label: 'Square', aspect: '1/1', desc: '1:1', platform: 'Instagram · Feed' },
  { id: 'vertical', label: 'Vertical', aspect: '9/16', desc: '9:16', platform: 'Reels · Stories · TikTok' },
  { id: 'portrait', label: 'Portrait', aspect: '4/5', desc: '4:5', platform: 'Instagram · Portrait' },
  { id: 'cinematic', label: 'Cinematic', aspect: '239/100', desc: '2.39:1', platform: 'Widescreen' },
  { id: 'classic', label: 'Classic', aspect: '4/3', desc: '4:3', platform: 'Traditional' },
]

export const CAPTION_TEXT_STYLES: { id: CaptionTextStyle; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'uppercase', label: 'Uppercase' },
  { id: 'bold', label: 'Bold' },
  { id: 'outline', label: 'Outline' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'pill', label: 'Pill' },
  { id: 'neon', label: 'Neon' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'kinetic', label: 'Kinetic' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'retro', label: 'Retro' },
  { id: 'subtitle', label: 'Subtitle' },
  { id: 'karaoke', label: 'Karaoke' },
  { id: 'serif', label: 'Serif' },
  { id: 'high-contrast', label: 'High contrast' },
]

export const CAPTION_SIZE_PX: Record<CaptionSize, number> = {
  small: 18,
  medium: 24,
  large: 32
}

export const CAPTION_FONTS = [
  { id: 'Inter', name: 'Inter', family: 'Inter, sans-serif' },
  { id: 'Arial', name: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { id: 'Georgia', name: 'Georgia', family: 'Georgia, serif' },
  { id: 'Roboto', name: 'Roboto', family: '"Roboto", sans-serif' },
  { id: 'Open Sans', name: 'Open Sans', family: '"Open Sans", sans-serif' },
  { id: 'Playfair Display', name: 'Playfair Display', family: '"Playfair Display", serif' },
  { id: 'Montserrat', name: 'Montserrat', family: '"Montserrat", sans-serif' },
  { id: 'system', name: 'System', family: 'system-ui, -apple-system, sans-serif' }
] as const

/** Animation for text overlay enter */
export type TextOverlayAnimationIn = 'none' | 'fade' | 'pop' | 'slide-top' | 'slide-bottom' | 'slide-left' | 'slide-right' | 'typewriter' | 'scale-in' | 'bounce' | 'zoom-in' | 'blur-in' | 'flip-in'
/** Animation for text overlay exit */
export type TextOverlayAnimationOut = 'none' | 'fade' | 'pop' | 'slide-top' | 'slide-bottom' | 'slide-left' | 'slide-right' | 'scale-out' | 'bounce-out' | 'zoom-out' | 'flip-out'

/** Continuous motion graphic animation while overlay is visible */
export type MotionGraphicPreset = 'none' | 'pulse' | 'float' | 'wiggle' | 'glow' | 'breathe' | 'shake'

export const MOTION_GRAPHIC_PRESETS: { id: MotionGraphicPreset; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'float', label: 'Float' },
  { id: 'wiggle', label: 'Wiggle' },
  { id: 'glow', label: 'Glow' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'shake', label: 'Shake' },
]

export interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  startTime: number
  endTime: number
  style?: 'none' | 'neon' | 'minimal' | 'bold-kinetic' | 'outline' | 'shadow'
  shadowColor?: string
  /** Enter animation */
  animationIn?: TextOverlayAnimationIn
  /** Exit animation */
  animationOut?: TextOverlayAnimationOut
  /** Enter animation duration in seconds */
  animationInDuration?: number
  /** Exit animation duration in seconds */
  animationOutDuration?: number
  /** Outline color when style is outline */
  outlineColor?: string
  /** Background color for pill/box style */
  backgroundColor?: string
  letterSpacing?: number
  lineHeight?: number
  /** Continuous motion graphic while visible */
  motionGraphic?: MotionGraphicPreset
  /** Draw order (higher = on top). Default 0. */
  layer?: number
}

/** Shape or sticker overlay (rectangle, circle, line) */
export type ShapeOverlayKind = 'rect' | 'circle' | 'line'

export interface ShapeOverlay {
  id: string
  kind: ShapeOverlayKind
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  startTime: number
  endTime: number
  /** For line: thickness in px */
  strokeWidth?: number
  /** Optional continuous motion (e.g. pulse on subscribe bug) */
  motionGraphic?: MotionGraphicPreset
  /** Draw order (higher = on top). Default 0. */
  layer?: number
}

/** Image overlay (logo, sticker, watermark) */
export interface ImageOverlay {
  id: string
  /** Image URL (must be CORS-friendly for canvas/export) */
  url: string
  x: number
  y: number
  /** Width as % of video width */
  width: number
  /** Height as % of video height */
  height: number
  startTime: number
  endTime: number
  opacity: number
  /** Border radius (px or %) */
  borderRadius?: number
  /** Enter animation */
  animationIn?: TextOverlayAnimationIn
  /** Exit animation */
  animationOut?: TextOverlayAnimationOut
  animationInDuration?: number
  animationOutDuration?: number
  /** Draw order (higher = on top). Default 0. */
  layer?: number
}

/** Gradient overlay (full or region: lower-third fade, color tint) */
export type GradientOverlayDirection = 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'right-to-left' | 'radial'

export interface GradientOverlay {
  id: string
  direction: GradientOverlayDirection
  /** CSS color stops, e.g. ['transparent', 'rgba(0,0,0,0.8)'] */
  colorStops: [string, string]
  opacity: number
  startTime: number
  endTime: number
  /** 'full' = entire frame; 'lower-third' = bottom 33%; 'top-bar' = top 20% */
  region?: 'full' | 'lower-third' | 'top-bar' | 'top-half' | 'bottom-half'
  /** Draw order (higher = on top). Default 0. */
  layer?: number
}

/** Config for one text overlay inside a motion graphic template (startTime/endTime set when applying). */
export interface MotionGraphicTextConfig {
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  style?: TextOverlay['style']
  animationIn?: TextOverlayAnimationIn
  animationOut?: TextOverlayAnimationOut
  animationInDuration?: number
  animationOutDuration?: number
  motionGraphic?: MotionGraphicPreset
  backgroundColor?: string
  outlineColor?: string
  /** Seconds from template start for this overlay to appear (default 0) */
  startOffset?: number
  /** Duration in seconds (default: use template duration) */
  duration?: number
}

/** Config for one shape overlay inside a motion graphic template. */
export interface MotionGraphicShapeConfig {
  kind: ShapeOverlayKind
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  startOffset?: number
  duration?: number
  strokeWidth?: number
  motionGraphic?: MotionGraphicPreset
}

/** Pre-built motion graphic template: lower thirds, bugs, bumpers, etc. */
export interface MotionGraphicTemplate {
  id: string
  name: string
  description: string
  icon: string
  textOverlays: MotionGraphicTextConfig[]
  shapeOverlays?: MotionGraphicShapeConfig[]
}

export const MOTION_GRAPHIC_TEMPLATES: MotionGraphicTemplate[] = [
  {
    id: 'lower-third-left',
    name: 'Lower Third Left',
    description: 'Name/title bar sliding from left',
    icon: '📌',
    shapeOverlays: [
      { kind: 'rect', x: 5, y: 78, width: 32, height: 14, color: 'rgba(0,0,0,0.75)', opacity: 1, startOffset: 0, duration: 5 },
    ],
    textOverlays: [
      { text: 'Your Name', x: 18, y: 78, fontSize: 22, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-left', animationOut: 'slide-left', animationInDuration: 0.35, animationOutDuration: 0.25, startOffset: 0, duration: 5 },
      { text: 'Title or Tagline', x: 18, y: 84, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', animationOut: 'slide-left', animationInDuration: 0.35, startOffset: 0.1, duration: 5 },
    ],
  },
  {
    id: 'lower-third-minimal',
    name: 'Lower Third Minimal',
    description: 'Simple text bar, no background',
    icon: '▬',
    textOverlays: [
      { text: 'Name · Title', x: 12, y: 82, fontSize: 20, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'outline', outlineColor: '#000000', animationIn: 'fade', animationOut: 'fade', motionGraphic: 'none', startOffset: 0, duration: 5 },
    ],
  },
  {
    id: 'subscribe-bug',
    name: 'Subscribe Bug',
    description: 'Corner reminder with icon placeholder',
    icon: '🔔',
    shapeOverlays: [
      { kind: 'circle', x: 92, y: 12, width: 8, height: 8, color: '#E53935', opacity: 1, startOffset: 0, duration: 5, motionGraphic: 'pulse' },
    ],
    textOverlays: [
      { text: 'SUBSCRIBE', x: 92, y: 12, fontSize: 10, color: '#fff', fontFamily: 'Inter, sans-serif', animationIn: 'pop', animationOut: 'fade', motionGraphic: 'pulse', startOffset: 0, duration: 5 },
    ],
  },
  {
    id: 'countdown-3',
    name: 'Countdown 3-2-1',
    description: 'Three number cards for intros',
    icon: '3️⃣',
    textOverlays: [
      { text: '3', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 0, duration: 1 },
      { text: '2', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 1, duration: 1 },
      { text: '1', x: 50, y: 50, fontSize: 120, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'shadow', animationIn: 'zoom-in', animationOut: 'scale-out', animationInDuration: 0.2, animationOutDuration: 0.2, startOffset: 2, duration: 1 },
    ],
  },
  {
    id: 'bumper-cta',
    name: 'Bumper CTA',
    description: 'Call-to-action bar at bottom',
    icon: '🎯',
    shapeOverlays: [
      { kind: 'rect', x: 50, y: 92, width: 70, height: 10, color: 'rgba(139,92,246,0.9)', opacity: 1, startOffset: 0, duration: 5 },
    ],
    textOverlays: [
      { text: 'Like · Comment · Subscribe', x: 50, y: 92, fontSize: 18, color: '#ffffff', fontFamily: 'Inter, sans-serif', animationIn: 'slide-bottom', animationOut: 'slide-bottom', motionGraphic: 'glow', startOffset: 0, duration: 5 },
    ],
  },
  {
    id: 'quote-card',
    name: 'Quote Card',
    description: 'Centered quote with subtle background',
    icon: '💬',
    shapeOverlays: [
      { kind: 'rect', x: 50, y: 50, width: 75, height: 28, color: 'rgba(0,0,0,0.6)', opacity: 1, startOffset: 0, duration: 6 },
    ],
    textOverlays: [
      { text: '"Your quote here"', x: 50, y: 48, fontSize: 26, color: '#ffffff', fontFamily: 'Georgia, serif', style: 'minimal', animationIn: 'fade', animationOut: 'fade', motionGraphic: 'breathe', startOffset: 0, duration: 6 },
    ],
  },
  {
    id: 'title-reveal',
    name: 'Title Reveal',
    description: 'Big title with slide and glow',
    icon: '✨',
    textOverlays: [
      { text: 'TITLE HERE', x: 50, y: 50, fontSize: 56, color: '#ffffff', fontFamily: 'Impact, sans-serif', style: 'neon', animationIn: 'blur-in', animationOut: 'fade', animationInDuration: 0.6, motionGraphic: 'glow', startOffset: 0, duration: 4 },
    ],
  },
  {
    id: 'social-handles',
    name: 'Social Handles',
    description: 'Top corner @handle line',
    icon: '📱',
    textOverlays: [
      { text: '@yourhandle', x: 88, y: 8, fontSize: 16, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-right', animationOut: 'slide-right', motionGraphic: 'none', startOffset: 0, duration: 5 },
    ],
  },
  {
    id: 'progress-bar',
    name: 'Progress Bar',
    description: 'Thin progress line at bottom (decorative)',
    icon: '▰',
    shapeOverlays: [
      { kind: 'rect', x: 50, y: 96, width: 100, height: 0.8, color: 'rgba(255,255,255,0.3)', opacity: 1, startOffset: 0, duration: 5 },
      { kind: 'rect', x: 0, y: 96, width: 30, height: 0.8, color: '#8B5CF6', opacity: 1, startOffset: 0, duration: 5 },
    ],
    textOverlays: [],
  },
  {
    id: 'split-lower-third',
    name: 'Split Lower Third',
    description: 'Two lines with accent bar',
    icon: '▌',
    shapeOverlays: [
      { kind: 'rect', x: 8, y: 78, width: 3, height: 12, color: '#8B5CF6', opacity: 1, startOffset: 0, duration: 5 },
      { kind: 'rect', x: 12, y: 78, width: 35, height: 12, color: 'rgba(0,0,0,0.7)', opacity: 1, startOffset: 0, duration: 5 },
    ],
    textOverlays: [
      { text: 'Name', x: 28, y: 78, fontSize: 20, color: '#fff', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', animationOut: 'slide-left', startOffset: 0, duration: 5 },
      { text: 'Role', x: 28, y: 84, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-left', startOffset: 0.08, duration: 5 },
    ],
  },
  {
    id: 'lower-third-right',
    name: 'Lower Third Right',
    description: 'Name/title bar from the right',
    icon: '📌',
    shapeOverlays: [
      { kind: 'rect', x: 95, y: 78, width: 32, height: 14, color: 'rgba(0,0,0,0.75)', opacity: 1, startOffset: 0, duration: 5 },
    ],
    textOverlays: [
      { text: 'Your Name', x: 82, y: 78, fontSize: 22, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'slide-right', animationOut: 'slide-right', animationInDuration: 0.35, animationOutDuration: 0.25, startOffset: 0, duration: 5 },
      { text: 'Title or Tagline', x: 82, y: 84, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-right', animationOut: 'slide-right', animationInDuration: 0.35, startOffset: 0.1, duration: 5 },
    ],
  },
  {
    id: 'coming-up',
    name: 'Coming Up',
    description: 'Teaser line for next segment',
    icon: '⏭',
    textOverlays: [
      { text: 'COMING UP', x: 50, y: 25, fontSize: 18, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter, sans-serif', style: 'minimal', animationIn: 'slide-top', animationOut: 'slide-top', motionGraphic: 'none', startOffset: 0, duration: 4 },
      { text: 'Next: Your topic here', x: 50, y: 32, fontSize: 28, color: '#ffffff', fontFamily: 'Inter, sans-serif', style: 'shadow', animationIn: 'fade', animationOut: 'fade', startOffset: 0.15, duration: 4 },
    ],
  },
  {
    id: 'end-card',
    name: 'End Card',
    description: 'Outro with CTA and handle',
    icon: '🛑',
    shapeOverlays: [
      { kind: 'rect', x: 50, y: 50, width: 80, height: 45, color: 'rgba(0,0,0,0.85)', opacity: 1, startOffset: 0, duration: 8 },
    ],
    textOverlays: [
      { text: 'Thanks for watching', x: 50, y: 42, fontSize: 32, color: '#ffffff', fontFamily: 'Inter, sans-serif', animationIn: 'fade', animationOut: 'fade', startOffset: 0, duration: 8 },
      { text: 'Like · Subscribe · @yourhandle', x: 50, y: 58, fontSize: 20, color: 'rgba(255,255,255,0.95)', fontFamily: 'Inter, sans-serif', animationIn: 'slide-bottom', animationOut: 'fade', motionGraphic: 'glow', startOffset: 0.3, duration: 8 },
    ],
  },
]

export interface VideoState {
  duration: number
  currentTime: number
  isPlaying: boolean
  volume: number
  isMuted: boolean
}

export interface AISuggestion {
  id: string
  time: number
  type: 'cut' | 'transition' | 'effect' | 'text' | 'audio'
  description: string
  confidence: number
  data?: any
}

export interface EditorProject {
  id?: string
  name: string
  videoUrl?: string
  videoPath?: string
  filters: VideoFilter
  overlays: TextOverlay[]
  segments: TimelineSegment[]
  settings: any
}

export type EditorCategory = 'edit' | 'effects' | 'timeline' | 'export' | 'ai' | 'color' | 'chromakey' | 'visual-fx' | 'ai-analysis' | 'collaborate' | 'assets' | 'automate' | 'ai-edit' | 'growth' | 'remix' | 'settings' | 'intelligence' | 'accounts' | 'scripts' | 'scheduling'

// Timeline effects - applied effects with duration
export type TimelineEffectType =
  | 'filter'       // Color filters (brightness, contrast, etc.)
  | 'transition'   // Fade, dissolve, wipe, etc.
  | 'motion'       // Zoom, pan, shake, etc.
  | 'overlay'      // Vignette, film grain, light leak, etc.
  | 'speed'        // Slow motion, fast forward, reverse
  | 'audio'        // Audio effects (reverb, echo, etc.)

/** Easing function for effect fade in/out */
export type EffectEasing = 'none' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

/** Keyframe for animating effect parameters */
export interface EffectKeyframe {
  id: string
  time: number  // Relative to effect start (0 = start, 1 = end as percentage)
  params: Record<string, number | string | boolean>
  easing: EffectEasing
}

export interface TimelineEffect {
  id: string
  type: TimelineEffectType
  name: string
  startTime: number
  endTime: number
  /** Effect-specific parameters */
  params: Record<string, number | string | boolean>
  /** Visual color for the timeline track */
  color: string
  /** Intensity/strength of the effect (0-100) */
  intensity: number
  /** Whether this effect is currently enabled */
  enabled: boolean
  /** Fade in duration in seconds */
  fadeIn?: number
  /** Fade out duration in seconds */
  fadeOut?: number
  /** Easing for fade in */
  fadeInEasing?: EffectEasing
  /** Easing for fade out */
  fadeOutEasing?: EffectEasing
  /** Keyframes for parameter animation */
  keyframes?: EffectKeyframe[]
  /** Layer/priority order (higher = on top) */
  layer?: number
  /** Group ID for grouping multiple effects */
  groupId?: string
  /** Lock effect from editing */
  locked?: boolean
  /** Custom label/notes */
  notes?: string
}

/** Saved effect combination/template */
export interface EffectTemplate {
  id: string
  name: string
  description?: string
  effects: Omit<TimelineEffect, 'id' | 'startTime' | 'endTime'>[]
  createdAt: number
}

export const EFFECT_EASINGS: { id: EffectEasing; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: '━' },
  { id: 'linear', label: 'Linear', icon: '📈' },
  { id: 'ease-in', label: 'Ease In', icon: '🚀' },
  { id: 'ease-out', label: 'Ease Out', icon: '🛬' },
  { id: 'ease-in-out', label: 'Ease In-Out', icon: '🌊' },
]

export const EFFECT_TYPE_COLORS: Record<TimelineEffectType, string> = {
  filter: '#8B5CF6',      // Purple
  transition: '#EC4899',  // Pink
  motion: '#F59E0B',      // Amber
  overlay: '#10B981',     // Emerald
  speed: '#3B82F6',       // Blue
  audio: '#EF4444',       // Red
}

export const EFFECT_PRESETS: { type: TimelineEffectType; name: string; icon: string; params: Record<string, number | string | boolean> }[] = [
  // Filters
  { type: 'filter', name: 'Warm Glow', icon: '🌅', params: { temperature: 120, brightness: 105, saturation: 110 } },
  { type: 'filter', name: 'Cool Tone', icon: '❄️', params: { temperature: 80, brightness: 100, saturation: 95 } },
  { type: 'filter', name: 'Vintage', icon: '📷', params: { sepia: 30, saturation: 80, contrast: 110 } },
  { type: 'filter', name: 'High Contrast', icon: '⚡', params: { contrast: 130, brightness: 105, saturation: 115 } },
  { type: 'filter', name: 'Desaturate', icon: '🎭', params: { saturation: 50, contrast: 105 } },
  // Transitions
  { type: 'transition', name: 'Fade In', icon: '🌙', params: { direction: 'in', duration: 1 } },
  { type: 'transition', name: 'Fade Out', icon: '🌑', params: { direction: 'out', duration: 1 } },
  { type: 'transition', name: 'Cross Dissolve', icon: '✨', params: { style: 'dissolve', duration: 0.5 } },
  { type: 'transition', name: 'Wipe Right', icon: '➡️', params: { style: 'wipe', direction: 'right' } },
  { type: 'transition', name: 'Blur Transition', icon: '🔮', params: { style: 'blur', amount: 10 } },
  // Motion
  { type: 'motion', name: 'Slow Zoom In', icon: '🔍', params: { zoom: 110, duration: 3 } },
  { type: 'motion', name: 'Slow Zoom Out', icon: '🔎', params: { zoom: 90, duration: 3 } },
  { type: 'motion', name: 'Pan Left', icon: '⬅️', params: { panX: -10, duration: 2 } },
  { type: 'motion', name: 'Pan Right', icon: '➡️', params: { panX: 10, duration: 2 } },
  { type: 'motion', name: 'Shake', icon: '📳', params: { intensity: 5, frequency: 10 } },
  { type: 'motion', name: 'Ken Burns In', icon: '📷', params: { zoom: 115, panX: 5, panY: 5, duration: 4 } },
  { type: 'motion', name: 'Ken Burns Out', icon: '📷', params: { zoom: 85, panX: -5, panY: -5, duration: 4 } },
  { type: 'motion', name: 'Smooth Zoom In', icon: '🔎', params: { zoom: 105, duration: 5, easing: 'ease-out' } },
  { type: 'motion', name: 'Smooth Zoom Out', icon: '🔍', params: { zoom: 95, duration: 5, easing: 'ease-in' } },
  { type: 'motion', name: 'Parallax Left', icon: '⬅️', params: { panX: -15, duration: 3, easing: 'linear' } },
  { type: 'motion', name: 'Parallax Right', icon: '➡️', params: { panX: 15, duration: 3, easing: 'linear' } },
  { type: 'motion', name: 'Subtle Drift', icon: '🌊', params: { panX: 3, panY: 2, duration: 6 } },
  { type: 'motion', name: 'Dramatic Zoom', icon: '🎬', params: { zoom: 130, duration: 2 } },
  { type: 'motion', name: 'Push In', icon: '📐', params: { zoom: 108, duration: 3 } },
  { type: 'motion', name: 'Pull Back', icon: '📐', params: { zoom: 92, duration: 3 } },
  // Overlays
  { type: 'overlay', name: 'Vignette', icon: '🎬', params: { strength: 30, softness: 50 } },
  { type: 'overlay', name: 'Film Grain', icon: '🎞️', params: { amount: 20, size: 1.5 } },
  { type: 'overlay', name: 'Light Leak', icon: '☀️', params: { intensity: 40, position: 'top-right' } },
  { type: 'overlay', name: 'Letterbox', icon: '📽️', params: { ratio: 2.39, color: '#000000' } },
  { type: 'overlay', name: 'Dust & Scratches', icon: '🧹', params: { density: 15, opacity: 30 } },
  // Speed
  { type: 'speed', name: 'Slow Motion 50%', icon: '🐢', params: { rate: 0.5 } },
  { type: 'speed', name: 'Slow Motion 25%', icon: '🦥', params: { rate: 0.25 } },
  { type: 'speed', name: 'Fast Forward 2x', icon: '⏩', params: { rate: 2 } },
  { type: 'speed', name: 'Fast Forward 4x', icon: '🚀', params: { rate: 4 } },
  { type: 'speed', name: 'Reverse', icon: '⏪', params: { rate: -1 } },
  // Audio
  { type: 'audio', name: 'Echo', icon: '🔊', params: { delay: 0.3, decay: 0.5 } },
  { type: 'audio', name: 'Reverb', icon: '🏛️', params: { roomSize: 0.7, wetLevel: 0.3 } },
  { type: 'audio', name: 'Fade Audio', icon: '🔉', params: { direction: 'in', duration: 1 } },
  { type: 'audio', name: 'Bass Boost', icon: '🎸', params: { gain: 6, frequency: 100 } },
  { type: 'audio', name: 'Vocal Enhance', icon: '🎤', params: { midGain: 4, clarity: 20 } },
]
