import { resolveCaptionTextStyle } from './captionStyler'

export interface ExportFont {
  /** CSS font-family stack the preview used. */
  family: string
  weight: number
  italic: boolean
}

/**
 * The font a text overlay is drawn with in the preview — the same resolution
 * RealTimeVideoPreview applies (style preset, then the overlay's own font) — so
 * the export can draw it with the identical font file (server/utils/exportFonts).
 */
export function resolveOverlayFont(overlay: { style?: unknown; fontFamily?: string; fontWeight?: unknown; fontStyle?: unknown; color?: string }): ExportFont {
  const css = resolveCaptionTextStyle(typeof overlay.style === 'string' ? overlay.style : undefined, { color: overlay.color || '#ffffff' })
  const family = overlay.fontFamily || (typeof css.fontFamily === 'string' ? css.fontFamily : '') || 'Inter'
  // Same precedence as the preview: the overlay's own weight/italic win.
  const rawWeight = overlay.fontWeight ?? css.fontWeight
  const weight = rawWeight === 'bold' ? 700 : Number(rawWeight) || 400
  const italic = overlay.fontStyle ? overlay.fontStyle === 'italic' : css.fontStyle === 'italic'
  return { family, weight, italic }
}

export interface ExportLook {
  uppercase: boolean
  /** CSS colour of the box behind the text, or null for none. */
  background: string | null
  /** Text outline (CSS -webkit-text-stroke), or null. */
  outline: { width: number; color: string } | null
}

type LookInput = Parameters<typeof resolveOverlayFont>[0] & { highlightColor?: string; backgroundColor?: string; outlineColor?: string }

/**
 * How the preview dresses the text (case, box, outline) — same resolution as
 * RealTimeVideoPreview — so the export doesn't impose its own caption look
 * (it used to uppercase and box every overlay).
 */
export function resolveOverlayLook(overlay: LookInput): ExportLook {
  const css = resolveCaptionTextStyle(typeof overlay.style === 'string' ? overlay.style : undefined, {
    color: overlay.color || '#ffffff',
    accentColor: overlay.highlightColor || overlay.color || '#ffffff',
    backgroundColor: overlay.backgroundColor,
    outlineColor: overlay.outlineColor,
  })
  const bg = (typeof css.backgroundColor === 'string' ? css.backgroundColor : null) ?? (overlay.backgroundColor || null)
  const stroke = typeof css.WebkitTextStroke === 'string' ? css.WebkitTextStroke.match(/^([\d.]+)px\s+(.+)$/) : null
  return {
    uppercase: css.textTransform === 'uppercase',
    background: bg && bg !== 'transparent' ? bg : null,
    outline: stroke ? { width: Number(stroke[1]), color: stroke[2].trim() } : null,
  }
}

/** Overlays with their resolved font + look attached, ready for the render API. */
export function withExportFonts<T extends object>(overlays: T[] | undefined | null): T[] {
  return (overlays || []).map((o) => ({
    ...o,
    exportFont: resolveOverlayFont(o as LookInput),
    exportLook: resolveOverlayLook(o as LookInput),
  }))
}
