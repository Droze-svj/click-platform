/**
 * Canonical render-tree schema. **Both** the live preview and the Remotion
 * export composition import from this module — never directly from
 * `client/types/editor`. This boundary is what guarantees preview and export
 * stay in lockstep; any new field you want to render must be re-exported here
 * and consumed by both renderers.
 *
 * The shape is intentionally a subset of the full editor type tree (no UI
 * state, no autosave, no transient telemetry).
 */
export type {
  VideoFilter,
  TimelineSegment,
  TimelineSegmentType,
  TimelineEffect,
  TimelineEffectType,
  TextOverlay,
  TextOverlayAnimationIn,
  TextOverlayAnimationOut,
  TextOverlayStyle,
  ShapeOverlay,
  ShapeOverlayKind,
  ImageOverlay,
  SvgOverlay,
  GradientOverlay,
  GradientOverlayDirection,
  TransformKeyframe,
  KeyframeEasing,
  EffectKeyframe,
  EffectEasing,
  CaptionStyle,
  CaptionTextStyle,
  CaptionSize,
  CaptionLayout,
  TranscriptWord,
  Transcript,
  MotionGraphicPreset,
  TemplateLayout,
} from '../../types/editor'

import type {
  GradientOverlay,
  ImageOverlay,
  ShapeOverlay,
  SvgOverlay,
  TextOverlay,
  TimelineEffect,
  TimelineSegment,
  TranscriptWord,
  TransformKeyframe,
  VideoFilter,
} from '../../types/editor'

/**
 * Single-source-of-truth payload that the render route accepts and the
 * Remotion composition consumes. Keep this stable — the contract test
 * snapshots its shape so any drift between preview state and render input
 * fails CI.
 */
export interface RenderTree {
  /** Source video URL — the underlying media being edited. */
  videoUrl: string
  /** Total duration in seconds. */
  duration: number
  filters: VideoFilter
  /**
   * Optional named color grade from the shared registry (lib/colorGrades.ts /
   * server colorGradeRegistry.js). When set, the renderer merges the grade's
   * filter deltas + vfx before building the chain — the explicit named path that
   * also records the grade for learning. Baking the grade into `filters` works too.
   */
  colorGrade?: string | null
  segments: TimelineSegment[]
  effects: TimelineEffect[]
  textOverlays: TextOverlay[]
  shapeOverlays: ShapeOverlay[]
  imageOverlays: ImageOverlay[]
  svgOverlays: SvgOverlay[]
  gradientOverlays: GradientOverlay[]
  transcriptWords?: TranscriptWord[]
  /** Transform keyframes for the underlying video (zoom/pan/etc.). */
  videoTransformKeyframes?: TransformKeyframe[]
  /** Static fallback transform if no keyframes are present. */
  videoTransform?: { scale?: number; positionX?: number; positionY?: number; rotation?: number }
  /** Crop applied after transform; insets in % of source. */
  videoCrop?: { top?: number; right?: number; bottom?: number; left?: number }
  /** Optional chroma-key pull for green-screen-style background removal. */
  chromaKey?: ChromaKeySpec
  /** Authenticity / disclosure metadata — drives the AiDisclosureBadge baked into the export. */
  metadata?: RenderMetadata
}

export interface ChromaKeySpec {
  enabled: boolean
  /** Hex color to key out (e.g. '#00ff00') */
  color: string
  /** 0..100 */
  tolerance: number
  /** 0..1 */
  opacity: number
  /** Edge softness, 0..1 */
  edge: number
  /** Spill suppression, 0..1 */
  spill: number
}

export interface RenderMetadata {
  /** Set when AI tools materially shaped this output. */
  aiAssisted?: boolean
  /** Disclosure level baked into the visible badge. */
  aiDisclosureLevel?: 'wholly' | 'substantially' | 'lightly'
  /** Project / user identifiers for C2PA manifest. */
  projectId?: string
  userId?: string
  /** Source provider list (e.g. ['openai/whisper', 'anthropic/claude-opus-4-7']). */
  aiProviders?: string[]
  /** Niche / platform context — useful for safe-zone selection. */
  platform?: string
}

/** Branded helper so callers can `satisfies RenderTree` to guarantee shape parity. */
export type RenderTreeContract<T extends RenderTree> = T
