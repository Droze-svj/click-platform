import type { SafeZoneInsets } from './safeZones'

export interface CompositionDimensions {
  width: number
  height: number
}

export interface PercentPosition {
  /** 0..100 — percent of frame width, with 50 = center */
  x: number
  /** 0..100 — percent of frame height, with 50 = center */
  y: number
}

export interface PixelPosition {
  /** Absolute pixel offset of the overlay's center from the composition's top-left. */
  x: number
  y: number
}

/**
 * Translate the editor's percent-of-frame overlay coordinates into absolute
 * pixels at composition resolution. Optionally clamps the result inside a
 * safe-zone so overlays don't render under platform UI chrome (TikTok caption
 * strip, IG bottom bar, YT progress).
 *
 * `safeZone` insets are in percent of frame; clamp is applied AFTER conversion
 * so a center overlay still lands at the visual center of the cropped safe
 * region rather than the cropped frame.
 */
export function percentToPx(
  pos: PercentPosition,
  composition: CompositionDimensions,
  safeZone?: SafeZoneInsets
): PixelPosition {
  const px = (pos.x / 100) * composition.width
  const py = (pos.y / 100) * composition.height

  if (!safeZone) return { x: px, y: py }

  const minX = (safeZone.left / 100) * composition.width
  const maxX = composition.width - (safeZone.right / 100) * composition.width
  const minY = (safeZone.top / 100) * composition.height
  const maxY = composition.height - (safeZone.bottom / 100) * composition.height

  return {
    x: clamp(minX, maxX, px),
    y: clamp(minY, maxY, py),
  }
}

/** Convert width/height (also in percent of frame) to pixels at composition resolution. */
export function percentSizeToPx(
  size: { width: number; height: number },
  composition: CompositionDimensions
): { width: number; height: number } {
  return {
    width: (size.width / 100) * composition.width,
    height: (size.height / 100) * composition.height,
  }
}

/** Convert a percent font size (treated as % of composition height) to pixels. */
export function percentFontSizeToPx(percent: number, composition: CompositionDimensions): number {
  return Math.max(8, (percent / 100) * composition.height)
}

function clamp(min: number, max: number, n: number): number {
  return Math.min(max, Math.max(min, n))
}
