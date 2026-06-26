import type { VideoFilter } from '../types/editor'

/**
 * Color grades — client MIRROR of server/services/colorGradeRegistry.js.
 *
 * KEEP IN PARITY with the server: identical ids + filter values, or the editor
 * preview won't match the exported MP4. `filter` is a partial VideoFilter in the
 * 100-centered editor convention (brightness/contrast/saturation/temperature/
 * vibrance baseline 100; hue/tint/sepia/vignette baseline 0); `vfx` tags are baked
 * at render time. Applied via `setVideoFilters(prev => applyGrade(prev, grade))`.
 */
export interface ColorGrade {
  id: string
  label: string
  filter: Partial<VideoFilter>
  vfx?: string[]
  /** Tailwind gradient classes for the swatch chip. */
  swatch: string
}

export const COLOR_GRADES: ColorGrade[] = [
  { id: 'natural',        label: 'Natural',        filter: {},                                                                          swatch: 'from-gray-400 to-gray-600' },
  { id: 'vibrant',        label: 'Vibrant',        filter: { saturation: 150, contrast: 110 },                                          swatch: 'from-amber-400 via-orange-400 to-rose-500' },
  { id: 'vivid',          label: 'Vivid',          filter: { saturation: 165, contrast: 108, vibrance: 120 },                           swatch: 'from-pink-400 via-fuchsia-400 to-violet-500' },
  { id: 'warm',           label: 'Warm',           filter: { saturation: 110, temperature: 115 },                                       swatch: 'from-orange-300 via-amber-400 to-yellow-500' },
  { id: 'cool',           label: 'Cool',           filter: { saturation: 105, temperature: 85, tint: 5 },                               swatch: 'from-cyan-300 via-blue-400 to-indigo-500' },
  { id: 'cinematic',      label: 'Cinematic',      filter: { sepia: 18, vignette: 28, contrast: 108, saturation: 94 },                  swatch: 'from-amber-800/80 via-amber-900/60 to-slate-900' },
  { id: 'luma-cinematic', label: 'Luma Cinematic', filter: { contrast: 115, saturation: 95, brightness: 98, vignette: 18 },             swatch: 'from-zinc-700 via-zinc-800 to-black' },
  { id: 'moody',          label: 'Moody',          filter: { contrast: 115, saturation: 90, vignette: 40 },                             swatch: 'from-slate-700 via-slate-800 to-black' },
  { id: 'vintage',        label: 'Vintage',        filter: { sepia: 35, saturation: 80, contrast: 110 }, vfx: ['film-grain'],           swatch: 'from-amber-700/90 via-yellow-800/70 to-stone-800' },
  { id: 'bw',             label: 'Black & White',  filter: { saturation: 0, contrast: 120 },                                            swatch: 'from-gray-300 via-gray-500 to-gray-700' },
  { id: 'noir',           label: 'Noir',           filter: { saturation: 0, contrast: 130, vignette: 50 },                              swatch: 'from-gray-200 via-gray-600 to-black' },
  { id: 'cyberpunk',      label: 'Cyberpunk',      filter: { contrast: 120, saturation: 140, temperature: 88, tint: 8, vibrance: 120 }, vfx: ['chromatic-aberration'], swatch: 'from-fuchsia-500 via-purple-500 to-cyan-400' },
  { id: 'hyper-pop',      label: 'Hyper Pop',      filter: { saturation: 150, contrast: 125, brightness: 103, vibrance: 130 },          swatch: 'from-pink-500 via-rose-400 to-amber-400' },
  { id: 'dreamy-pastel',  label: 'Dreamy Pastel',  filter: { saturation: 85, contrast: 92, vibrance: 105, vignette: 35, temperature: 106 }, swatch: 'from-rose-200 via-pink-200 to-violet-200' },
]

const _byId = new Map(COLOR_GRADES.map((g) => [g.id, g]))

export function resolveGrade(id: string | null | undefined): ColorGrade | null {
  return id ? (_byId.get(String(id).trim().toLowerCase()) || null) : null
}

/**
 * Merge a grade's deltas onto the current filters (and union its vfx). Returns a new
 * VideoFilter — use in `setVideoFilters(prev => applyGrade(prev, grade))`.
 */
export function applyGrade(prev: VideoFilter, grade: ColorGrade): VideoFilter {
  const prevVfx = Array.isArray(prev.vfx) ? prev.vfx : []
  const gradeVfx = grade.vfx || []
  return {
    ...prev,
    ...grade.filter,
    vfx: Array.from(new Set([...prevVfx, ...gradeVfx])),
  }
}
