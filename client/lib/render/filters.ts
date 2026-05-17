import type { TimelineEffect, VideoFilter } from '../../types/editor'

/**
 * Blend any active timeline filter effects on top of a base VideoFilter at a
 * given timeline second `t`. Used by the live preview *and* the Remotion
 * export composition so both produce identical color across every frame.
 *
 * Source of truth for filter behavior. If you need to add a new filter param
 * (e.g. `glow`, `bloom`), add it here and both renderers pick it up.
 */
export function blendFiltersAtTime(
  base: VideoFilter,
  effects: TimelineEffect[] | undefined,
  t: number
): VideoFilter {
  const out: VideoFilter = { ...base }
  if (!effects || effects.length === 0) return out

  for (const e of effects) {
    if (e.type !== 'filter' || !e.enabled) continue
    if (t < e.startTime || t > e.endTime) continue

    const fadeIn = e.fadeIn ?? 0
    const fadeOut = e.fadeOut ?? 0
    let factor = (e.intensity ?? 100) / 100
    if (t < e.startTime + fadeIn && fadeIn > 0) factor *= (t - e.startTime) / fadeIn
    if (t > e.endTime - fadeOut && fadeOut > 0) factor *= (e.endTime - t) / fadeOut
    if (factor <= 0) continue

    const p = e.params as Record<string, number>
    if (p.brightness != null)
      out.brightness = (out.brightness ?? 100) + (p.brightness - (out.brightness ?? 100)) * factor
    if (p.contrast != null)
      out.contrast = (out.contrast ?? 100) + (p.contrast - (out.contrast ?? 100)) * factor
    if (p.saturation != null)
      out.saturation = (out.saturation ?? 100) + (p.saturation - (out.saturation ?? 100)) * factor
    if (p.temperature != null)
      out.temperature = (out.temperature ?? 100) + (p.temperature - (out.temperature ?? 100)) * factor
    if (p.sepia != null) out.sepia = (out.sepia ?? 0) + (p.sepia - (out.sepia ?? 0)) * factor
    if (p.blur != null) out.blur = (out.blur ?? 0) + (p.blur - (out.blur ?? 0)) * factor
  }
  return out
}

/**
 * Build the CSS-filter string used by both the preview <video> element and the
 * Remotion <OffthreadVideo> composition. This bakes in the same math the
 * preview uses today: temperature → sepia/hue mix, vibrance applied to
 * saturation, sharpen + clarity + dehaze re-projected through contrast.
 *
 * The math here is the load-bearing parity between preview and export. Any
 * change to it is a frame-diff change in regression tests.
 */
export function buildFilterString(filters: VideoFilter): string {
  const temp = filters.temperature ?? 100
  const sepiaAdj = clamp(0, 100, (filters.sepia ?? 0) + ((temp - 100) / 100) * 15)
  const hueAdj = (filters.hue ?? 0) + (temp < 100 ? 8 : temp > 100 ? -4 : 0)

  const sat =
    filters.vibrance != null
      ? Math.round((filters.saturation ?? 100) * (filters.vibrance / 100))
      : filters.saturation ?? 100

  const bright = filters.brightness ?? 100
  const shadowLift = (filters.shadows ?? 100) - 100
  const highCrush = 100 - (filters.highlights ?? 100)
  const dehazeAdj = (((filters.dehaze ?? 100) - 100) / 100) * 0.04
  const brightnessAdj = bright + shadowLift * 0.2 + highCrush * 0.15

  const contrastBase = filters.contrast ?? 100
  const sharpenAdj = (filters.sharpen ?? 0) / 100
  const clarityAdj = ((filters.clarity ?? 0) / 100) * 0.06
  const contrastAdj = clamp(50, 200, contrastBase + sharpenAdj * 8 + clarityAdj * 100 + dehazeAdj * 100)

  const blurVal = filters.blur ?? 0

  return [
    `brightness(${clamp(50, 150, brightnessAdj)}%)`,
    `contrast(${contrastAdj}%)`,
    `saturate(${clamp(0, 200, sat)}%)`,
    `hue-rotate(${hueAdj}deg)`,
    `sepia(${sepiaAdj}%)`,
    `blur(${blurVal}px)`,
  ].join(' ')
}

/** Returns the vignette opacity (0..1) for the given filter at the given time, or 0 if disabled. */
export function vignetteOpacity(filters: VideoFilter): number {
  const v = filters.vignette ?? 0
  return v > 0 ? Math.min(1, (v / 100) * 0.6) : 0
}

function clamp(min: number, max: number, n: number): number {
  return Math.min(max, Math.max(min, n))
}
