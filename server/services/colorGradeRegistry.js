/**
 * colorGradeRegistry — ONE source of truth for named color grades.
 *
 * A grade is a bundle of `VideoFilter` deltas (the 100-centered editor convention:
 * brightness/contrast/saturation/temperature/vibrance baseline 100; hue/tint/sepia/
 * vignette/blur baseline 0) plus optional `vfx` tags. Both renderers consume this
 * exact shape:
 *   - the manual / RenderTree export path → videoRenderService.buildVideoFilterChain
 *   - the autonomous clip generator → aiVideoEditingService (via buildVideoFilterChain)
 *   - the AI Director offers gradeIds() as its `color` step vocabulary
 *   - the manual UI mirrors this in client/lib/colorGrades.ts (KEEP IN PARITY)
 *
 * Before this registry, grade names like `cyberpunk`/`hyper_pop`/`luma-cinematic`/
 * `moody-dark` were dead strings (no filter mapping) or rendered by a divergent
 * raw-ffmpeg switch. This unifies them so every named grade renders identically in
 * preview and export, and new grades are added in ONE place.
 *
 * IMPORTANT: keep this file's ids/values in sync with client/lib/colorGrades.ts.
 */

'use strict';

// Canonical grades. `filter` uses the VideoFilter field names + 100/0-centered
// convention that buildVideoFilterChain consumes. `swatch` is UI-only (mirrored
// client-side). Phase 2 appends more advanced grades to this list.
const GRADES = [
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
];

// Legacy / alternate spellings → canonical id, so the Director, clipStylePresets,
// and aiVideoEditingService themes all resolve to the same grade.
const ALIASES = {
  'mono': 'bw',
  'black-and-white': 'bw',
  'moody-dark': 'moody',
  'hyper_pop': 'hyper-pop',
  'hyperpop': 'hyper-pop',
  'cyberpunk_neon': 'cyberpunk',
  'cyberpunk-neon': 'cyberpunk',
  'neon-glitch': 'cyberpunk',
  'vintage_film': 'vintage',
  'vintage-film': 'vintage',
  'dreamy_pastel': 'dreamy-pastel',
  'luma': 'luma-cinematic',
  'lumacinematic': 'luma-cinematic',
};

const _byId = new Map(GRADES.map((g) => [g.id, g]));

function normalizeId(id) {
  const key = String(id || '').trim().toLowerCase();
  return ALIASES[key] || key;
}

/** Resolve a grade (alias-aware) → its definition, or null. */
function resolveGrade(id) {
  return _byId.get(normalizeId(id)) || null;
}

/** All canonical grade ids — the AI Director's `color` step vocabulary. */
function gradeIds() {
  return GRADES.map((g) => g.id);
}

/**
 * A grade's VideoFilter deltas (the object buildVideoFilterChain consumes).
 * Returns {} for an unknown id so callers can spread it safely.
 */
function gradeToVideoFilter(id) {
  const g = resolveGrade(id);
  return g ? { ...g.filter, ...(g.vfx ? { vfx: g.vfx.slice() } : {}) } : {};
}

module.exports = { GRADES, ALIASES, resolveGrade, gradeIds, gradeToVideoFilter, normalizeId };
