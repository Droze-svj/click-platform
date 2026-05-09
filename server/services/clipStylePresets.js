/**
 * clipStylePresets — curated style packs the user picks before AI Auto Edit.
 *
 * Each preset bakes together: hook framing, music vibe, caption treatment,
 * pacing intensity, default platform, transition style, and a one-line "look"
 * description. The user picks 1–3 presets; the auto-edit pipeline distributes
 * the requested clipCount across them and tags every emitted clip with the
 * preset id so the pick-and-learn loop can attribute later "I picked this"
 * signals back to the originating preset.
 *
 * The presets here are deliberately broad — they cover the dominant short-form
 * archetypes on TikTok / Shorts / Reels. Adding more is additive and safe.
 */

/**
 * Variation angles — each preset emits N clips, every clip is a different
 * "angle" within the same overall style. This is how Click delivers Opus-
 * style multi-clip variety: pick "MrBeast Energy" + 3 clips → 3 distinct
 * MrBeast-style clips with different hook + caption + transition combos.
 *
 * The pipeline iterates `variations` modulo the requested count so a request
 * for 5 clips against a 3-variation preset emits A, B, C, A, B.
 */
const STYLE_PRESETS = [
  {
    id: 'mrbeast-energy',
    label: 'MrBeast Energy',
    description: 'Hyper-pacing, punchy zooms, bold high-contrast captions, energetic music.',
    color: '#ef4444',
    accent: 'red',
    defaults: {
      hookStyle: 'bold-claim',
      musicGenre: 'energetic',
      pacingIntensity: 'intense',
      captionStyle: 'bold',
      targetPlatform: 'shorts',
      transitionStyle: 'whip',
      colorGrade: 'vivid',
      brollAutoInsert: true,
      hookDuration: 1,
      ctaStyle: 'subscribe',
      voiceTone: 'inspirational',
    },
    variations: [
      { id: 'big-stakes',  label: 'Big Stakes Hook',  overrides: { hookStyle: 'stat',       captionStyle: 'bold-kinetic' } },
      { id: 'pattern-break', label: 'Pattern Break',  overrides: { hookStyle: 'mystery',    captionStyle: 'bold',         transitionStyle: 'glitch' } },
      { id: 'reveal-loop', label: 'Reveal Loop',      overrides: { hookStyle: 'question',   captionStyle: 'bold',         hookDuration: 2 } },
    ],
  },
  {
    id: 'hormozi-bold',
    label: 'Hormozi Bold',
    description: 'Word-by-word captions, business hooks, no-fluff cuts, lower-third stats.',
    color: '#f59e0b',
    accent: 'amber',
    defaults: {
      hookStyle: 'stat',
      musicGenre: 'corporate',
      pacingIntensity: 'medium',
      captionStyle: 'bold-kinetic',
      targetPlatform: 'reels',
      transitionStyle: 'cut',
      colorGrade: 'natural',
      brollAutoInsert: false,
      hookDuration: 2,
      ctaStyle: 'follow',
      voiceTone: 'professional',
    },
    variations: [
      { id: 'hard-stat',     label: 'Hard Stat Open',  overrides: { hookStyle: 'stat',       captionStyle: 'bold-kinetic' } },
      { id: 'contrarian',    label: 'Contrarian Take', overrides: { hookStyle: 'bold-claim', captionStyle: 'bold' } },
      { id: 'frame-shift',   label: 'Frame Shift',     overrides: { hookStyle: 'question',   captionStyle: 'minimal',     transitionStyle: 'crossfade' } },
    ],
  },
  {
    id: 'cinematic-doc',
    label: 'Cinematic Doc',
    description: 'Slower pacing, ambient score, minimal captions, color-graded for film tone.',
    color: '#6366f1',
    accent: 'indigo',
    defaults: {
      hookStyle: 'story',
      musicGenre: 'dramatic',
      pacingIntensity: 'chill',
      captionStyle: 'minimal',
      targetPlatform: 'auto',
      transitionStyle: 'crossfade',
      colorGrade: 'cinematic',
      brollAutoInsert: true,
      hookDuration: 3,
      ctaStyle: 'share',
      voiceTone: 'inspirational',
    },
    variations: [
      { id: 'slow-burn',   label: 'Slow Burn',     overrides: { hookStyle: 'story',   pacingIntensity: 'chill' } },
      { id: 'whisper-cut', label: 'Whisper Cut',   overrides: { hookStyle: 'mystery', captionStyle: 'minimal',  musicGenre: 'chill' } },
      { id: 'epic-frame',  label: 'Epic Frame',    overrides: { hookStyle: 'bold-claim', colorGrade: 'cinematic', transitionStyle: 'crossfade' } },
    ],
  },
  {
    id: 'educational-clean',
    label: 'Educational Clean',
    description: 'Clear pacing, sentence-level captions, calm soundtrack, knowledge-style hooks.',
    color: '#10b981',
    accent: 'emerald',
    defaults: {
      hookStyle: 'question',
      musicGenre: 'chill',
      pacingIntensity: 'medium',
      captionStyle: 'modern',
      targetPlatform: 'shorts',
      transitionStyle: 'cut',
      colorGrade: 'natural',
      brollAutoInsert: true,
      hookDuration: 2,
      ctaStyle: 'comment',
      voiceTone: 'professional',
    },
    variations: [
      { id: 'q-frame',     label: 'Question Frame', overrides: { hookStyle: 'question',  captionStyle: 'modern' } },
      { id: 'fact-drop',   label: 'Fact Drop',      overrides: { hookStyle: 'stat',      captionStyle: 'modern',  brollAutoInsert: true } },
      { id: 'deep-dive',   label: 'Deep Dive',      overrides: { hookStyle: 'story',     captionStyle: 'minimal', pacingIntensity: 'chill' } },
    ],
  },
  {
    id: 'news-authority',
    label: 'News Authority',
    description: 'Hook = headline, ticker captions, urgent music, fast factual cuts.',
    color: '#8b5cf6',
    accent: 'violet',
    defaults: {
      hookStyle: 'stat',
      musicGenre: 'corporate',
      pacingIntensity: 'medium',
      captionStyle: 'tiktok',
      targetPlatform: 'twitter',
      transitionStyle: 'cut',
      colorGrade: 'natural',
      brollAutoInsert: true,
      hookDuration: 1,
      ctaStyle: 'share',
      voiceTone: 'professional',
    },
    variations: [
      { id: 'headline',     label: 'Headline Hook',  overrides: { hookStyle: 'stat',       captionStyle: 'tiktok' } },
      { id: 'breaking',     label: 'Breaking',       overrides: { hookStyle: 'bold-claim', musicGenre: 'corporate', pacingIntensity: 'medium' } },
      { id: 'investigation',label: 'Investigation',  overrides: { hookStyle: 'mystery',    captionStyle: 'minimal' } },
    ],
  },
  {
    id: 'casual-vlog',
    label: 'Casual Vlog',
    description: 'Friendly hook, ambient music, soft cuts, handwritten-feel captions.',
    color: '#ec4899',
    accent: 'pink',
    defaults: {
      hookStyle: 'mystery',
      musicGenre: 'chill',
      pacingIntensity: 'chill',
      captionStyle: 'minimal',
      targetPlatform: 'reels',
      transitionStyle: 'crossfade',
      colorGrade: 'warm',
      brollAutoInsert: false,
      hookDuration: 3,
      ctaStyle: 'follow',
      voiceTone: 'casual',
    },
    variations: [
      { id: 'morning-coffee', label: 'Morning Coffee', overrides: { hookStyle: 'story',   captionStyle: 'minimal' } },
      { id: 'unfiltered',     label: 'Unfiltered',     overrides: { hookStyle: 'question',captionStyle: 'minimal',  brollAutoInsert: true } },
      { id: 'aesthetic',      label: 'Aesthetic',      overrides: { hookStyle: 'mystery', musicGenre: 'chill',      colorGrade: 'warm' } },
    ],
  },
  {
    id: 'mystery-hook',
    label: 'Mystery Hook',
    description: 'Cliffhanger openers, suspenseful soundtrack, minimal cuts in the first 3s.',
    color: '#0ea5e9',
    accent: 'sky',
    defaults: {
      hookStyle: 'mystery',
      musicGenre: 'dramatic',
      pacingIntensity: 'chill',
      captionStyle: 'neon',
      targetPlatform: 'tiktok',
      transitionStyle: 'crossfade',
      colorGrade: 'cool',
      brollAutoInsert: true,
      hookDuration: 2,
      ctaStyle: 'comment',
      voiceTone: 'provocative',
    },
    variations: [
      { id: 'cliffhanger',  label: 'Cliffhanger',  overrides: { hookStyle: 'mystery',   pacingIntensity: 'chill' } },
      { id: 'reveal-tease', label: 'Reveal Tease', overrides: { hookStyle: 'question',  captionStyle: 'neon',  hookDuration: 3 } },
      { id: 'shock-frame',  label: 'Shock Frame',  overrides: { hookStyle: 'bold-claim',transitionStyle: 'glitch' } },
    ],
  },
  {
    id: 'gym-grit',
    label: 'Gym Grit',
    description: 'Short bursts, hard hits on the beat, neon captions, raw color.',
    color: '#f97316',
    accent: 'orange',
    defaults: {
      hookStyle: 'bold-claim',
      musicGenre: 'energetic',
      pacingIntensity: 'intense',
      captionStyle: 'neon',
      targetPlatform: 'shorts',
      transitionStyle: 'whip',
      colorGrade: 'vivid',
      brollAutoInsert: true,
      hookDuration: 1,
      ctaStyle: 'follow',
      voiceTone: 'inspirational',
    },
    variations: [
      { id: 'rep-burst',    label: 'Rep Burst',     overrides: { hookStyle: 'bold-claim', captionStyle: 'neon' } },
      { id: 'beat-drop',    label: 'Beat Drop',     overrides: { hookStyle: 'stat',       transitionStyle: 'whip',  pacingIntensity: 'intense' } },
      { id: 'mindset',      label: 'Mindset',       overrides: { hookStyle: 'mystery',    captionStyle: 'bold',     colorGrade: 'vivid' } },
    ],
  },
];

const PRESETS_BY_ID = Object.fromEntries(STYLE_PRESETS.map(p => [p.id, p]));

/**
 * Resolve an array of preset ids into preset objects. Unknown ids are
 * silently dropped so a stale client doesn't break the pipeline.
 */
function resolvePresets(ids = []) {
  if (!Array.isArray(ids)) return [];
  return ids.map(id => PRESETS_BY_ID[id]).filter(Boolean);
}

/**
 * Distribute a total clipCount across N presets as evenly as possible.
 * Remainder goes to the first presets in order. Returns Array<{preset, count}>.
 */
function distributeClipsAcrossPresets(presets, totalCount) {
  if (!presets.length) return [];
  const base = Math.floor(totalCount / presets.length);
  const remainder = totalCount - base * presets.length;
  return presets.map((preset, i) => ({
    preset,
    count: base + (i < remainder ? 1 : 0),
  })).filter(b => b.count > 0);
}

/**
 * Merge a preset's defaults into a user-provided editingOptions object.
 * The user's explicit picks always win over the preset.
 */
function mergePresetIntoOptions(preset, options = {}) {
  if (!preset) return options;
  const out = { ...preset.defaults, ...options };
  // Always tag the originating preset so we can attribute later "I picked
  // this" signals back to the right style.
  out.stylePresetId = preset.id;
  out.stylePresetLabel = preset.label;
  return out;
}

/**
 * Expand a preset distribution into per-clip render plans, cycling through
 * each preset's `variations` array so users see N distinct angles within the
 * same style instead of N identical clips. Returns:
 *   [{ preset, variation, options, variationIndex, variationsInPreset }, ...]
 *
 * Each render plan is a self-contained editingOptions object the pipeline
 * can pass straight into autoEditVideo for that clip.
 */
function expandRenderPlans(distribution, baseOptions = {}) {
  const plans = [];
  for (const slot of distribution) {
    const preset = slot.preset;
    const variations = Array.isArray(preset.variations) && preset.variations.length > 0
      ? preset.variations
      : [{ id: 'default', label: preset.label, overrides: {} }];
    for (let i = 0; i < slot.count; i++) {
      const variation = variations[i % variations.length];
      const merged = mergePresetIntoOptions(preset, baseOptions);
      // Variation overrides win over the preset's own defaults but still
      // lose to anything the user explicitly set on baseOptions.
      Object.entries(variation.overrides || {}).forEach(([k, v]) => {
        if (baseOptions[k] === undefined) merged[k] = v;
      });
      merged.variationId = variation.id;
      merged.variationLabel = variation.label;
      merged.variationIndex = i;
      merged.variationsInPreset = variations.length;
      plans.push({ preset, variation, options: merged });
    }
  }
  return plans;
}

module.exports = {
  STYLE_PRESETS,
  PRESETS_BY_ID,
  resolvePresets,
  distributeClipsAcrossPresets,
  mergePresetIntoOptions,
  expandRenderPlans,
};
