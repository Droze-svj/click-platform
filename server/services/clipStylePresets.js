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
  {
    id: 'neon-glitch-speed',
    label: 'Neon Glitch Speed',
    description: 'Ultra-modern energetic pacing, cyber neon color isolation grades, glowing outline captions, chromatic glitch transitions.',
    color: '#39FF14',
    accent: 'green',
    defaults: {
      hookStyle: 'bold-claim',
      musicGenre: 'synthwave',
      pacingIntensity: 'aggressive',
      captionStyle: 'cyberpunk',
      targetPlatform: 'tiktok',
      transitionStyle: 'glitch',
      colorGrade: 'cyberpunk',
      brollAutoInsert: true,
      hookDuration: 1,
      ctaStyle: 'follow',
      voiceTone: 'provocative',
    },
    variations: [
      { id: 'speed-burst', label: 'Speed Burst Hook', overrides: { hookStyle: 'stat', pacingIntensity: 'aggressive' } },
      { id: 'chroma-shift', label: 'Chromatic Shift', overrides: { hookStyle: 'mystery', transitionStyle: 'glitch', captionStyle: 'cyberpunk' } },
      { id: 'neon-accent', label: 'Neon Accent', overrides: { hookStyle: 'question', colorGrade: 'cyberpunk' } },
    ],
  },
  {
    id: 'minimalist-mindset-luma',
    label: 'Minimalist Mindset Luma',
    description: 'Refinement-grade luma cinematic contrasts, lowercase serif subtitles with soft shadow offsets, relaxed organic cameraman drift.',
    color: '#0f172a',
    accent: 'slate',
    defaults: {
      hookStyle: 'story',
      musicGenre: 'lofi',
      pacingIntensity: 'gentle',
      captionStyle: 'minimal',
      targetPlatform: 'reels',
      transitionStyle: 'crossfade',
      colorGrade: 'moody-dark',
      brollAutoInsert: true,
      hookDuration: 3,
      ctaStyle: 'comment',
      voiceTone: 'inspirational',
    },
    variations: [
      { id: 'luma-focus', label: 'Luma Story Focus', overrides: { hookStyle: 'story', colorGrade: 'moody-dark' } },
      { id: 'soft-breathing', label: 'Camera Breathing Open', overrides: { hookStyle: 'mystery', pacingIntensity: 'gentle' } },
      { id: 'serif-quote', label: 'Serif Quote Ticker', overrides: { hookStyle: 'bold-claim', captionStyle: 'serif' } },
    ],
  },

  // ─── 2026 Presets ──────────────────────────────────────────────────────────

  {
    id: 'adhd-overload',
    label: 'ADHD Overload',
    description: 'Ultra-fast cuts every 1.5-2s, constant text pop-ins, 3+ VFX per minute, maximum scroll-stopping TikTok FYP energy.',
    color: '#FF0055',
    accent: 'rose',
    defaults: {
      hookStyle: 'bold-claim',
      musicGenre: 'phonk',
      pacingIntensity: 'aggressive',
      captionStyle: 'bold',
      targetPlatform: 'tiktok',
      transitionStyle: 'glitch',
      colorGrade: 'hyper_pop',
      brollAutoInsert: true,
      hookDuration: 1,
      ctaStyle: 'follow',
      voiceTone: 'energetic',
      enableBeatSync: true,
      speedMultiplierSilence: 1.3,
      sceneThreshold: 0.15,
      optimizePacing: true,
    },
    variations: [
      { id: 'chaos-mode', label: 'Chaos Mode',    overrides: { hookStyle: 'bold-claim', captionStyle: 'bold',   musicGenre: 'phonk' } },
      { id: 'pop-burst',  label: 'Pop Burst',     overrides: { hookStyle: 'stat',       colorGrade: 'hyper_pop', transitionStyle: 'glitch' } },
      { id: 'overstim',   label: 'Overstimulation', overrides: { hookStyle: 'question', captionStyle: 'neon',    musicGenre: 'breakcore' } },
    ],
  },

  {
    id: 'podcast-goldmine',
    label: 'Podcast Goldmine',
    description: 'Multi-speaker chapter-style overlays, warm documentary grade, slower authority pacing. Best for long-form clip extraction.',
    color: '#D97706',
    accent: 'amber',
    defaults: {
      hookStyle: 'story',
      musicGenre: 'lofi',
      pacingIntensity: 'chill',
      captionStyle: 'professional',
      targetPlatform: 'youtube_shorts',
      transitionStyle: 'crossfade',
      colorGrade: 'vintage_film',
      brollAutoInsert: true,
      hookDuration: 3,
      ctaStyle: 'subscribe',
      voiceTone: 'professional',
      enableSpeakerLabels: true,
      clipTargetLength: 'medium',
    },
    variations: [
      { id: 'deep-extract', label: 'Deep Extract', overrides: { hookStyle: 'insight',    captionStyle: 'professional' } },
      { id: 'debate-clip',  label: 'Debate Clip',  overrides: { hookStyle: 'contrarian', captionStyle: 'bold' } },
      { id: 'wisdom-drop',  label: 'Wisdom Drop',  overrides: { hookStyle: 'story',      colorGrade: 'vintage_film', pacingIntensity: 'chill' } },
    ],
  },

  {
    id: 'retention-machine',
    label: 'Retention Machine',
    description: 'Heavy B-roll, cliffhanger text at 15s intervals, chapter markers, open-loop technique at scene boundaries.',
    color: '#6D28D9',
    accent: 'violet',
    defaults: {
      hookStyle: 'mystery',
      musicGenre: 'cinematic',
      pacingIntensity: 'medium',
      captionStyle: 'outline',
      targetPlatform: 'youtube_shorts',
      transitionStyle: 'crossfade',
      colorGrade: 'luma-cinematic',
      brollAutoInsert: true,
      hookDuration: 2,
      ctaStyle: 'comment',
      voiceTone: 'inspirational',
      enableBRoll: true,
      optimizePacing: true,
    },
    variations: [
      { id: 'loop-master',    label: 'Open Loop',      overrides: { hookStyle: 'mystery',  captionStyle: 'outline' } },
      { id: 'chapter-reveal', label: 'Chapter Reveal', overrides: { hookStyle: 'story',     captionStyle: 'professional', transitionStyle: 'crossfade' } },
      { id: 'cliffhang',      label: 'Cliffhanger',   overrides: { hookStyle: 'question',  captionStyle: 'bold', pacingIntensity: 'medium' } },
    ],
  },
  // ── Phase 2: new creative style presets ────────────────────────────────────
  {
    id: 'luxury-lifestyle',
    label: 'Luxury Lifestyle',
    description: 'Aspirational slow-burn, golden-hour grade, minimal serif captions, ambient score.',
    color: '#b45309',
    accent: 'amber',
    defaults: {
      hookStyle: 'story', musicGenre: 'chill', pacingIntensity: 'medium', captionStyle: 'minimal',
      targetPlatform: 'reels', transitionStyle: 'crossfade', colorGrade: 'golden-hour',
      brollAutoInsert: true, hookDuration: 2, ctaStyle: 'follow', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'quiet-flex',   label: 'Quiet Flex',    overrides: { hookStyle: 'mystery', colorGrade: 'sunset-warm' } },
      { id: 'soft-reveal',  label: 'Soft Reveal',   overrides: { hookStyle: 'question', captionStyle: 'modern' } },
      { id: 'day-in-life',  label: 'Day In Life',   overrides: { hookStyle: 'story',   transitionStyle: 'fade' } },
    ],
  },
  {
    id: 'true-crime',
    label: 'True Crime',
    description: 'Cliffhanger openers, low-key dramatic grade, outline captions, suspenseful score.',
    color: '#7f1d1d',
    accent: 'red',
    defaults: {
      hookStyle: 'mystery', musicGenre: 'dramatic', pacingIntensity: 'medium', captionStyle: 'outline',
      targetPlatform: 'shorts', transitionStyle: 'fade', colorGrade: 'low-key',
      brollAutoInsert: true, hookDuration: 2, ctaStyle: 'follow', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'cold-open',    label: 'Cold Open',     overrides: { hookStyle: 'mystery', colorGrade: 'film-noir' } },
      { id: 'case-file',    label: 'Case File',     overrides: { hookStyle: 'stat',    captionStyle: 'professional' } },
      { id: 'the-twist',    label: 'The Twist',     overrides: { hookStyle: 'question', transitionStyle: 'cut' } },
    ],
  },
  {
    id: 'asmr-soft',
    label: 'ASMR Soft',
    description: 'Calm gentle pacing, soft k-drama glow grade, minimal captions, lo-fi ambience.',
    color: '#a78bfa',
    accent: 'violet',
    defaults: {
      hookStyle: 'story', musicGenre: 'lofi', pacingIntensity: 'medium', captionStyle: 'minimal',
      targetPlatform: 'reels', transitionStyle: 'crossfade', colorGrade: 'kdrama-soft',
      brollAutoInsert: false, hookDuration: 2, ctaStyle: 'follow', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'whisper',      label: 'Whisper',       overrides: { colorGrade: 'dreamy-pastel' } },
      { id: 'slow-hands',   label: 'Slow Hands',    overrides: { transitionStyle: 'fade' } },
      { id: 'cozy-corner',  label: 'Cozy Corner',   overrides: { colorGrade: 'sunset-warm' } },
    ],
  },
  {
    id: 'sports-hype',
    label: 'Sports Hype',
    description: 'Hard hits on the beat, teal-orange grade, kinetic captions, phonk energy.',
    color: '#16a34a',
    accent: 'emerald',
    defaults: {
      hookStyle: 'bold-claim', musicGenre: 'phonk', pacingIntensity: 'intense', captionStyle: 'bold-kinetic',
      targetPlatform: 'shorts', transitionStyle: 'whip', colorGrade: 'teal-orange',
      brollAutoInsert: true, hookDuration: 1, ctaStyle: 'subscribe', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'highlight-reel', label: 'Highlight Reel', overrides: { captionStyle: 'bold', transitionStyle: 'glitch' } },
      { id: 'beat-sync',      label: 'Beat Sync',      overrides: { hookStyle: 'stat', colorGrade: 'hyper-pop' } },
      { id: 'underdog',       label: 'Underdog',       overrides: { hookStyle: 'story', colorGrade: 'low-key' } },
    ],
  },
  {
    id: 'tech-review-clean',
    label: 'Tech Review Clean',
    description: 'Crisp arctic-cool grade, modern captions, no-fluff cuts, corporate-clean score.',
    color: '#0ea5e9',
    accent: 'sky',
    defaults: {
      hookStyle: 'question', musicGenre: 'corporate', pacingIntensity: 'medium', captionStyle: 'modern',
      targetPlatform: 'shorts', transitionStyle: 'cut', colorGrade: 'arctic-cool',
      brollAutoInsert: true, hookDuration: 1, ctaStyle: 'subscribe', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'spec-drop',    label: 'Spec Drop',     overrides: { hookStyle: 'stat', captionStyle: 'professional' } },
      { id: 'first-look',   label: 'First Look',    overrides: { hookStyle: 'bold-claim' } },
      { id: 'vs-battle',    label: 'VS Battle',     overrides: { transitionStyle: 'whip', colorGrade: 'teal-orange' } },
    ],
  },
  {
    id: 'storytime-cozy',
    label: 'Storytime Cozy',
    description: 'Warm sunset grade, friendly modern captions, soft fades, relaxed chill score.',
    color: '#ea580c',
    accent: 'orange',
    defaults: {
      hookStyle: 'story', musicGenre: 'chill', pacingIntensity: 'medium', captionStyle: 'modern',
      targetPlatform: 'reels', transitionStyle: 'fade', colorGrade: 'sunset-warm',
      brollAutoInsert: false, hookDuration: 2, ctaStyle: 'follow', voiceTone: 'inspirational',
    },
    variations: [
      { id: 'plot-twist',   label: 'Plot Twist',    overrides: { hookStyle: 'mystery' } },
      { id: 'heartfelt',    label: 'Heartfelt',     overrides: { colorGrade: 'kdrama-soft' } },
      { id: 'wholesome',    label: 'Wholesome',     overrides: { colorGrade: 'dreamy-pastel', transitionStyle: 'crossfade' } },
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
