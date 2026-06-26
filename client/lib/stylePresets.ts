/**
 * Frontend mirror of server/services/clipStylePresets.js. Keep these in sync
 * so the picker doesn't need a round-trip to render. The server is the
 * authority on which preset ids actually drive an edit — anything the client
 * sends gets resolved against the server list and unknown ids are dropped.
 */

export interface StylePreset {
  id: string
  label: string
  description: string
  color: string
  accent: string
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'mrbeast-energy',    label: 'MrBeast Energy',    description: 'Hyper-pacing, punchy zooms, bold high-contrast captions, energetic music.', color: '#ef4444', accent: 'red' },
  { id: 'hormozi-bold',      label: 'Hormozi Bold',      description: 'Word-by-word captions, business hooks, no-fluff cuts, lower-third stats.', color: '#f59e0b', accent: 'amber' },
  { id: 'cinematic-doc',     label: 'Cinematic Doc',     description: 'Slower pacing, ambient score, minimal captions, color-graded for film tone.', color: '#6366f1', accent: 'indigo' },
  { id: 'educational-clean', label: 'Educational Clean', description: 'Clear pacing, sentence-level captions, calm soundtrack, knowledge-style hooks.', color: '#10b981', accent: 'emerald' },
  { id: 'news-authority',    label: 'News Authority',    description: 'Hook = headline, ticker captions, urgent music, fast factual cuts.', color: '#8b5cf6', accent: 'violet' },
  { id: 'casual-vlog',       label: 'Casual Vlog',       description: 'Friendly hook, ambient music, soft cuts, handwritten-feel captions.', color: '#ec4899', accent: 'pink' },
  { id: 'mystery-hook',      label: 'Mystery Hook',      description: 'Cliffhanger openers, suspenseful soundtrack, minimal cuts in the first 3s.', color: '#0ea5e9', accent: 'sky' },
  { id: 'gym-grit',          label: 'Gym Grit',          description: 'Short bursts, hard hits on the beat, neon captions, raw color.', color: '#f97316', accent: 'orange' },
  { id: 'neon-glitch-speed', label: 'Neon Glitch Speed', description: 'Ultra-modern energetic pacing, cyber neon grades, glowing captions, chromatic glitch transitions.', color: '#39FF14', accent: 'green' },
  { id: 'minimalist-mindset-luma', label: 'Minimalist Mindset Luma', description: 'Luma cinematic contrasts, lowercase serif subtitles, relaxed organic drift.', color: '#0f172a', accent: 'slate' },
  { id: 'adhd-overload',     label: 'ADHD Overload',     description: 'Ultra-fast cuts, constant text pop-ins, 3+ VFX per minute, max FYP energy.', color: '#FF0055', accent: 'rose' },
  { id: 'podcast-goldmine',  label: 'Podcast Goldmine',  description: 'Multi-speaker chapter overlays, warm documentary grade, slower authority pacing.', color: '#D97706', accent: 'amber' },
  { id: 'retention-machine', label: 'Retention Machine', description: 'Heavy B-roll, cliffhanger text at intervals, chapter markers, open-loop technique.', color: '#6D28D9', accent: 'violet' },
  // ── Phase 2: new creative style presets ──
  { id: 'luxury-lifestyle',  label: 'Luxury Lifestyle',  description: 'Aspirational slow-burn, golden-hour grade, minimal serif captions, ambient score.', color: '#b45309', accent: 'amber' },
  { id: 'true-crime',        label: 'True Crime',        description: 'Cliffhanger openers, low-key dramatic grade, outline captions, suspenseful score.', color: '#7f1d1d', accent: 'red' },
  { id: 'asmr-soft',         label: 'ASMR Soft',         description: 'Calm gentle pacing, soft k-drama glow grade, minimal captions, lo-fi ambience.', color: '#a78bfa', accent: 'violet' },
  { id: 'sports-hype',       label: 'Sports Hype',       description: 'Hard hits on the beat, teal-orange grade, kinetic captions, phonk energy.', color: '#16a34a', accent: 'emerald' },
  { id: 'tech-review-clean', label: 'Tech Review Clean', description: 'Crisp arctic-cool grade, modern captions, no-fluff cuts, corporate-clean score.', color: '#0ea5e9', accent: 'sky' },
  { id: 'storytime-cozy',    label: 'Storytime Cozy',    description: 'Warm sunset grade, friendly modern captions, soft fades, relaxed chill score.', color: '#ea580c', accent: 'orange' },
]

export const PRESET_BY_ID: Record<string, StylePreset> = Object.fromEntries(
  STYLE_PRESETS.map(p => [p.id, p])
)

export const MAX_PRESETS_PER_RUN = 3
