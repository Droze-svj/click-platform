// Animated transition presets — a curated, creator-friendly library that maps
// punchy names (Whip, Zoom Blur, Glitch, Smooth Slide…) to the validated xfade
// transitions the render engine (stitchSegments) already supports. PURE +
// unit-tested; composes with beat-synced cuts so a montage gets a transition on
// every cut.

// The xfade modes the render engine accepts (must stay in sync with
// videoRenderService.stitchSegments XFADE_OK).
const XFADE_OK = new Set(['fade', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight',
  'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown', 'dissolve',
  'circleopen', 'circleclose', 'pixelize', 'radial', 'smoothleft', 'smoothright',
  'smoothup', 'smoothdown']);

// id → { label, xfade, duration(s), category }. A fast slide reads as a "whip".
const TRANSITION_PRESETS = [
  { id: 'fade', label: 'Fade', xfade: 'fade', duration: 0.4, category: 'classic' },
  { id: 'flash', label: 'Flash', xfade: 'fadewhite', duration: 0.22, category: 'punch' },
  { id: 'dip-to-black', label: 'Dip to Black', xfade: 'fadeblack', duration: 0.35, category: 'classic' },
  { id: 'dissolve', label: 'Dissolve', xfade: 'dissolve', duration: 0.5, category: 'classic' },
  { id: 'whip-left', label: 'Whip Left', xfade: 'slideleft', duration: 0.22, category: 'motion' },
  { id: 'whip-right', label: 'Whip Right', xfade: 'slideright', duration: 0.22, category: 'motion' },
  { id: 'slide-up', label: 'Slide Up', xfade: 'smoothup', duration: 0.4, category: 'motion' },
  { id: 'slide-down', label: 'Slide Down', xfade: 'smoothdown', duration: 0.4, category: 'motion' },
  { id: 'wipe', label: 'Wipe', xfade: 'wiperight', duration: 0.35, category: 'motion' },
  { id: 'zoom-blur', label: 'Zoom Blur', xfade: 'pixelize', duration: 0.3, category: 'punch' },
  { id: 'glitch', label: 'Glitch', xfade: 'pixelize', duration: 0.18, category: 'punch' },
  { id: 'iris', label: 'Iris', xfade: 'circleopen', duration: 0.45, category: 'shape' },
  { id: 'radial', label: 'Radial', xfade: 'radial', duration: 0.4, category: 'shape' },
];

const BY_ID = new Map(TRANSITION_PRESETS.map((p) => [p.id, p]));

/**
 * PURE: resolve a preset id (or a raw xfade name) into the render fields a
 * segment needs: { transitionType, transitionDuration }. Falls back to a clean
 * 'fade' for unknown ids so a typo never breaks the render.
 */
function resolveTransition(presetId, overrides = {}) {
  const preset = BY_ID.get(presetId) || (XFADE_OK.has(presetId) ? { xfade: presetId, duration: 0.4 } : null);
  const xfade = preset && XFADE_OK.has(preset.xfade) ? preset.xfade : 'fade';
  let duration = Number(overrides.duration) || (preset ? preset.duration : 0.4);
  duration = Math.max(0.05, Math.min(duration, 2));
  return { transitionType: xfade, transitionOut: xfade, transitionDuration: Math.round(duration * 1000) / 1000 };
}

/**
 * PURE: set the transition on every segment except the last (a transition needs
 * a following segment). Returns NEW segment objects (does not mutate input).
 */
function applyTransitionToSegments(segments = [], presetId = 'fade', overrides = {}) {
  const list = Array.isArray(segments) ? segments : [];
  const t = resolveTransition(presetId, overrides);
  return list.map((seg, i) => (i < list.length - 1
    ? { ...seg, transitionOut: t.transitionOut, transitionType: t.transitionType, transitionDuration: t.transitionDuration }
    : { ...seg }));
}

module.exports = { TRANSITION_PRESETS, resolveTransition, applyTransitionToSegments };
