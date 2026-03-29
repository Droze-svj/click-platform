import {
  applyEasing,
  interpolateTransformAtTime,
  interpolateEffectTransformAtTime,
  type InterpolatedTransform,
} from '../keyframeEasing'
import type { TransformKeyframe } from '../../types/editor'

describe('keyframeEasing', () => {
  describe('applyEasing', () => {
    it('returns 0 for t <= 0', () => {
      expect(applyEasing(0, 'linear')).toBe(0)
      expect(applyEasing(-0.1, 'ease-in-out')).toBe(0)
    })
    it('returns 1 for t >= 1', () => {
      expect(applyEasing(1, 'linear')).toBe(1)
      expect(applyEasing(1.5, 'ease-in-out')).toBe(1)
    })
    it('linear returns t', () => {
      expect(applyEasing(0.5, 'linear')).toBe(0.5)
      expect(applyEasing(0.25, 'linear')).toBe(0.25)
    })
    it('ease-in is quadratic in', () => {
      expect(applyEasing(0.5, 'ease-in')).toBe(0.25)
      expect(applyEasing(1, 'ease-in')).toBe(1)
    })
    it('ease-out is quadratic out', () => {
      expect(applyEasing(0.5, 'ease-out')).toBe(0.75)
    })
    it('ease-in-out at 0.5 is 0.5', () => {
      expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5, 5)
    })
    it('ease-in-out-cubic at 0.5 is 0.5', () => {
      expect(applyEasing(0.5, 'ease-in-out-cubic')).toBeCloseTo(0.5, 5)
    })
    it('bounce-out stays in [0,1]', () => {
      expect(applyEasing(0.3, 'bounce-out')).toBeGreaterThanOrEqual(0)
      expect(applyEasing(0.3, 'bounce-out')).toBeLessThanOrEqual(1)
      expect(applyEasing(0.9, 'bounce-out')).toBeGreaterThanOrEqual(0)
      expect(applyEasing(0.9, 'bounce-out')).toBeLessThanOrEqual(1)
    })
    it('bounce-in-out at 0 and 1', () => {
      expect(applyEasing(0, 'bounce-in-out')).toBe(0)
      expect(applyEasing(1, 'bounce-in-out')).toBe(1)
    })
    it('default (unknown easing) returns t', () => {
      expect(applyEasing(0.7, 'linear' as any)).toBe(0.7)
    })
  })

  describe('interpolateTransformAtTime', () => {
    it('returns defaults when keyframes empty or undefined', () => {
      const def: Partial<InterpolatedTransform> = { positionX: 10, scale: 2 }
      expect(interpolateTransformAtTime(undefined, 1, def)).toEqual({
        positionX: 10,
        positionY: 0,
        scale: 2,
        rotation: 0,
        opacity: 1,
      })
      expect(interpolateTransformAtTime([], 1, def)).toEqual({
        positionX: 10,
        positionY: 0,
        scale: 2,
        rotation: 0,
        opacity: 1,
      })
    })
    it('returns keyframe value when t at keyframe', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, positionX: 0, positionY: 0 },
        { id: 'b', time: 2, positionX: 100, positionY: 50, easing: 'linear' },
      ]
      expect(interpolateTransformAtTime(kfs, 0, {})).toMatchObject({ positionX: 0, positionY: 0 })
      expect(interpolateTransformAtTime(kfs, 2, {})).toMatchObject({ positionX: 100, positionY: 50 })
    })
    it('interpolates between keyframes', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, scale: 1, easing: 'linear' },
        { id: 'b', time: 1, scale: 2, easing: 'linear' },
      ]
      const r = interpolateTransformAtTime(kfs, 0.5, {})
      expect(r.scale).toBeCloseTo(1.5, 5)
    })
    it('uses easing from next keyframe', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, opacity: 0, easing: 'linear' },
        { id: 'b', time: 1, opacity: 1, easing: 'ease-in' },
      ]
      const r = interpolateTransformAtTime(kfs, 0.5, {})
      expect(r.opacity).toBeLessThan(0.5)
      expect(r.opacity).toBeGreaterThan(0)
    })
    it('clamps before first and after last keyframe', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 1, rotation: 90, easing: 'linear' },
        { id: 'b', time: 2, rotation: 180, easing: 'linear' },
      ]
      expect(interpolateTransformAtTime(kfs, 0, {}).rotation).toBe(90)
      expect(interpolateTransformAtTime(kfs, 3, {}).rotation).toBe(180)
    })
  })

  describe('interpolateEffectTransformAtTime', () => {
    it('returns defaults when currentTime outside effect range', () => {
      const kfs: TransformKeyframe[] = [{ id: 'a', time: 0.5, scale: 1.5 }]
      expect(interpolateEffectTransformAtTime(kfs, 1, 3, 0.5, {})).toMatchObject({ scale: 1 })
      expect(interpolateEffectTransformAtTime(kfs, 1, 3, 4, {})).toMatchObject({ scale: 1 })
    })
    it('maps timeline time to 0..1 and interpolates', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, scale: 1, easing: 'linear' },
        { id: 'b', time: 1, scale: 2, easing: 'linear' },
      ]
      const r = interpolateEffectTransformAtTime(kfs, 0, 10, 5, {})
      expect(r.scale).toBeCloseTo(1.5, 5)
    })
    it('at effect start returns first keyframe', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, positionX: -10 },
        { id: 'b', time: 1, positionX: 10 },
      ]
      expect(interpolateEffectTransformAtTime(kfs, 2, 4, 2, {}).positionX).toBe(-10)
    })
    it('at effect end returns last keyframe', () => {
      const kfs: TransformKeyframe[] = [
        { id: 'a', time: 0, positionX: -10 },
        { id: 'b', time: 1, positionX: 10 },
      ]
      expect(interpolateEffectTransformAtTime(kfs, 2, 4, 4, {}).positionX).toBe(10)
    })
  })
})
