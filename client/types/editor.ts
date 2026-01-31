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
}

export type TimelineSegmentType = 'video' | 'audio' | 'text' | 'transition' | 'image'

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
    | 'cinematic'    /* 2.39:1 */
    | 'classic'      /* 4:3 */

export const TEMPLATE_LAYOUTS: { id: TemplateLayout; label: string; aspect: string; desc: string; platform?: string }[] = [
    { id: 'auto', label: 'Auto', aspect: '16/9', desc: 'Match video', platform: 'Source' },
    { id: 'standard', label: 'Standard', aspect: '16/9', desc: '16:9', platform: 'YouTube · Landscape' },
    { id: 'square', label: 'Square', aspect: '1/1', desc: '1:1', platform: 'Instagram · Feed' },
    { id: 'vertical', label: 'Vertical', aspect: '9/16', desc: '9:16', platform: 'Reels · Stories · TikTok' },
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
}

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
