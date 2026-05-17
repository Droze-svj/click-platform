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
]

export const PRESET_BY_ID: Record<string, StylePreset> = Object.fromEntries(
  STYLE_PRESETS.map(p => [p.id, p])
)

export const MAX_PRESETS_PER_RUN = 3
