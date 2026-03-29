/**
 * Keyframe easing and interpolation for transform keyframes.
 * Use linear for mechanical motion, ease-in/out for natural feel, custom curves for bounces/slows.
 */

import type { KeyframeEasing, TransformKeyframe } from '../types/editor'

/** Apply easing to normalized time t in [0, 1]. Returns eased t. */
export function applyEasing(t: number, easing: KeyframeEasing = 'linear'): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  switch (easing) {
    case 'linear':
      return t
    case 'ease-in':
      return t * t
    case 'ease-out':
      return 1 - (1 - t) * (1 - t)
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'ease-in-out-cubic':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'bounce-out': {
      const n1 = 7.5625
      const d1 = 2.75
      if (t < 1 / d1) return n1 * t * t
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
    case 'bounce-in-out': {
      if (t < 0.5) return (1 - applyEasing(1 - 2 * t, 'bounce-out')) / 2
      return (1 + applyEasing(2 * t - 1, 'bounce-out')) / 2
    }
    default:
      return t
  }
}

type TransformProperty = 'positionX' | 'positionY' | 'scale' | 'rotation' | 'opacity'

/** Get interpolated value for one property at time t. Keyframes must be sorted by time. */
function interpolateProperty(
  keyframes: TransformKeyframe[],
  t: number,
  property: TransformProperty,
  fallback: number
): number {
  const withVal = keyframes.filter((k) => (k as any)[property] != null) as (TransformKeyframe & Record<TransformProperty, number>)[]
  if (withVal.length === 0) return fallback
  const sorted = [...withVal].sort((a, b) => a.time - b.time)
  if (t <= sorted[0].time) return sorted[0][property]
  if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1][property]
  let i = 0
  while (i < sorted.length - 1 && sorted[i + 1].time <= t) i++
  const k0 = sorted[i]
  const k1 = sorted[i + 1]
  const span = k1.time - k0.time
  const localT = span <= 0 ? 1 : (t - k0.time) / span
  const easedT = applyEasing(localT, k1.easing ?? 'linear')
  const v0 = k0[property]
  const v1 = k1[property]
  return v0 + (v1 - v0) * easedT
}

export interface InterpolatedTransform {
  positionX: number
  positionY: number
  scale: number
  rotation: number
  opacity: number
}

const DEFAULT_TRANSFORM: InterpolatedTransform = {
  positionX: 0,
  positionY: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
}

/**
 * Compute interpolated transform at time t from keyframes.
 * @param keyframes Sorted by time (absolute seconds for segments/overlays).
 * @param t Current time (absolute for segments/overlays).
 * @param defaults Base values when no keyframes (e.g. segment.transform or overlay x,y,scale,opacity).
 */
export function interpolateTransformAtTime(
  keyframes: TransformKeyframe[] | undefined,
  t: number,
  defaults: Partial<InterpolatedTransform> = {}
): InterpolatedTransform {
  const base = { ...DEFAULT_TRANSFORM, ...defaults }
  if (!keyframes || keyframes.length === 0) return base
  return {
    positionX: interpolateProperty(keyframes, t, 'positionX', base.positionX),
    positionY: interpolateProperty(keyframes, t, 'positionY', base.positionY),
    scale: interpolateProperty(keyframes, t, 'scale', base.scale),
    rotation: interpolateProperty(keyframes, t, 'rotation', base.rotation),
    opacity: interpolateProperty(keyframes, t, 'opacity', base.opacity),
  }
}

/**
 * For effects: keyframe time is 0..1 (relative to effect). Map timeline time to 0..1 and interpolate.
 */
export function interpolateEffectTransformAtTime(
  keyframes: TransformKeyframe[] | undefined,
  effectStart: number,
  effectEnd: number,
  currentTime: number,
  defaults: Partial<InterpolatedTransform> = {}
): InterpolatedTransform {
  if (currentTime < effectStart || currentTime > effectEnd) return { ...DEFAULT_TRANSFORM, ...defaults }
  const span = effectEnd - effectStart
  const relativeT = span <= 0 ? 0 : (currentTime - effectStart) / span
  return interpolateTransformAtTime(keyframes, relativeT, defaults)
}
