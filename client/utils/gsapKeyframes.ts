/**
 * GSAP helpers for Click: map editor easing to GSAP ease names and run tweens.
 * Use for UI-time animations (preset preview, playhead scrub).
 *
 * Example: gsap.to(element, { rotation: 360, duration: 2, ease: "power2.inOut" })
 */

import type { KeyframeEasing } from '../types/editor'

/** Map our easing ids to GSAP ease names. */
export function keyframeEasingToGsap(easing: KeyframeEasing = 'ease-in-out'): string {
  const map: Record<KeyframeEasing, string> = {
    linear: 'none',
    'ease-in': 'power2.in',
    'ease-out': 'power2.out',
    'ease-in-out': 'power2.inOut',
    'ease-in-out-cubic': 'power3.inOut',
    'bounce-out': 'bounce.out',
    'bounce-in-out': 'bounce.inOut',
  }
  return map[easing] ?? 'power2.inOut'
}
