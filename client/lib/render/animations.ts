import type {
  TextOverlay,
  TextOverlayAnimationIn,
  TextOverlayAnimationOut,
} from '../../types/editor'

export interface OverlayAnimationStyle {
  opacity: number
  transform: string
  filter?: string
}

/**
 * Compute opacity, transform, and optional filter for a text overlay's
 * enter/exit animation at a given timeline second. Mirrors the preview's
 * existing implementation so the Remotion composition produces visually
 * identical motion at the same `currentTime`.
 *
 * Position is anchored center (`translate(-50%, -50%)`) so the caller is
 * responsible for placing the wrapper at the overlay's percent coordinates.
 */
export function getTextOverlayAnimationStyle(
  overlay: TextOverlay,
  currentTime: number
): OverlayAnimationStyle {
  const start = overlay.startTime
  const end = overlay.endTime
  const inDur = Math.max(0.1, overlay.animationInDuration ?? 0.3)
  const outDur = Math.max(0.1, overlay.animationOutDuration ?? 0.3)
  const inEnd = start + inDur
  const outStart = end - outDur
  const animIn = (overlay.animationIn ?? 'none') as TextOverlayAnimationIn
  const animOut = (overlay.animationOut ?? 'none') as TextOverlayAnimationOut

  let filter: string | undefined
  if (currentTime < start || currentTime > end) {
    return { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }
  }
  if (currentTime >= inEnd && currentTime <= outStart) {
    return { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
  }

  let opacity = 1
  let scale = 1
  let translateX = 0
  let translateY = 0
  let rotateY = 0

  if (currentTime < inEnd && animIn !== 'none') {
    const t = (currentTime - start) / inDur
    const e = 1 - Math.pow(1 - t, 2)
    if (animIn === 'fade' || animIn === 'typewriter') opacity = e
    else if (animIn === 'pop') scale = e
    else if (animIn === 'slide-top') translateY = -30 * (1 - e)
    else if (animIn === 'slide-bottom') translateY = 30 * (1 - e)
    else if (animIn === 'slide-left') translateX = -30 * (1 - e)
    else if (animIn === 'slide-right') translateX = 30 * (1 - e)
    else if (animIn === 'scale-in') scale = e
    else if (animIn === 'bounce')
      scale = e < 0.9 ? Math.min(1, e * (1 / 0.9) * 1.25) : 1 + ((1 - e) / 0.1) * -0.25
    else if (animIn === 'zoom-in') scale = 0.3 + 0.7 * e
    else if (animIn === 'blur-in') {
      opacity = e
      filter = `blur(${8 * (1 - e)}px)`
    } else if (animIn === 'flip-in') rotateY = 90 * (1 - e)
  } else if (currentTime > outStart && animOut !== 'none') {
    const t = (end - currentTime) / outDur
    const e = 1 - Math.pow(1 - t, 2)
    if (animOut === 'fade') opacity = e
    else if (animOut === 'pop') scale = e
    else if (animOut === 'slide-top') translateY = -30 * (1 - e)
    else if (animOut === 'slide-bottom') translateY = 30 * (1 - e)
    else if (animOut === 'slide-left') translateX = -30 * (1 - e)
    else if (animOut === 'slide-right') translateX = 30 * (1 - e)
    else if (animOut === 'scale-out') scale = e
    else if (animOut === 'bounce-out')
      scale = e < 0.9 ? 1 + (e * (1 / 0.9) - 1) * 0.25 : e
    else if (animOut === 'zoom-out') scale = 0.3 + 0.7 * e
    else if (animOut === 'flip-out') rotateY = -90 * (1 - e)
  }

  const base = 'translate(-50%, -50%)'
  const tx = translateX ? ` translateX(${translateX}%)` : ''
  const ty = translateY ? ` translateY(${translateY}%)` : ''
  const sc = scale !== 1 ? ` scale(${scale})` : ''
  const ry = rotateY !== 0 ? ` rotateY(${rotateY}deg)` : ''
  return { opacity, transform: `${base}${tx}${ty}${sc}${ry}`, filter }
}

/**
 * Reusable animation style for image, shape, and SVG overlays — same
 * timing/animation contract as text overlays but parameterized so callers can
 * pass start/end + animation enums directly.
 */
export function getOverlayAnimationStyle(
  start: number,
  end: number,
  currentTime: number,
  animIn?: TextOverlayAnimationIn,
  animOut?: TextOverlayAnimationOut,
  inDur = 0.3,
  outDur = 0.3
): OverlayAnimationStyle {
  const inD = Math.max(0.1, inDur)
  const outD = Math.max(0.1, outDur)
  const inEnd = start + inD
  const outStart = end - outD
  const aIn = (animIn ?? 'none') as TextOverlayAnimationIn
  const aOut = (animOut ?? 'none') as TextOverlayAnimationOut

  if (currentTime < start || currentTime > end) {
    return { opacity: 0, transform: 'translate(-50%, -50%) scale(0)' }
  }
  if (currentTime >= inEnd && currentTime <= outStart) {
    return { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
  }

  let opacity = 1
  let scale = 1
  let translateX = 0
  let translateY = 0

  if (currentTime < inEnd && aIn !== 'none') {
    const t = (currentTime - start) / inD
    const e = 1 - Math.pow(1 - t, 2)
    if (aIn === 'fade') opacity = e
    else if (aIn === 'pop' || aIn === 'scale-in') scale = e
    else if (aIn === 'slide-top') translateY = -30 * (1 - e)
    else if (aIn === 'slide-bottom') translateY = 30 * (1 - e)
    else if (aIn === 'slide-left') translateX = -30 * (1 - e)
    else if (aIn === 'slide-right') translateX = 30 * (1 - e)
    else if (aIn === 'zoom-in') scale = 0.3 + 0.7 * e
  } else if (currentTime > outStart && aOut !== 'none') {
    const t = (end - currentTime) / outD
    const e = 1 - Math.pow(1 - t, 2)
    if (aOut === 'fade') opacity = e
    else if (aOut === 'pop' || aOut === 'scale-out') scale = e
    else if (aOut === 'slide-top') translateY = -30 * (1 - e)
    else if (aOut === 'slide-bottom') translateY = 30 * (1 - e)
    else if (aOut === 'slide-left') translateX = -30 * (1 - e)
    else if (aOut === 'slide-right') translateX = 30 * (1 - e)
    else if (aOut === 'zoom-out') scale = 0.3 + 0.7 * e
  }

  const base = 'translate(-50%, -50%)'
  const tx = translateX ? ` translateX(${translateX}%)` : ''
  const ty = translateY ? ` translateY(${translateY}%)` : ''
  const sc = scale !== 1 ? ` scale(${scale})` : ''
  return { opacity, transform: `${base}${tx}${ty}${sc}` }
}
