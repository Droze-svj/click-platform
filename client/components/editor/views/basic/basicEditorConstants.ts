import { TemplateLayout, VideoFilter, TextOverlayStyle, ShapeOverlayKind } from '../../../../types/editor'

export interface TextPresetConfig {
  label: string
  text: string
  x?: number
  y?: number
  fontSize?: number
  style?: TextOverlayStyle
  fontFamily?: string
}

export const TEXT_PRESETS: TextPresetConfig[] = [
  { label: 'Title', text: 'Your Title Here', x: 50, y: 12, fontSize: 36, style: 'shadow' },
  { label: 'Subscribe', text: 'Subscribe for more', x: 50, y: 88, fontSize: 28, style: 'neon' },
  { label: 'Like & Subscribe', text: 'Like & Subscribe', x: 50, y: 85, fontSize: 26, style: 'shadow' },
  { label: 'Watch more', text: 'Watch more →', x: 50, y: 90, fontSize: 24, style: 'minimal' },
  { label: 'Comment', text: 'Comment below', x: 50, y: 92, fontSize: 22, style: 'minimal' },
  { label: 'Link in bio', text: 'Link in bio', x: 82, y: 94, fontSize: 20, style: 'outline' },
  { label: 'Caption', text: 'Add your caption', x: 50, y: 78, fontSize: 24, style: 'none' },
  { label: 'Follow', text: 'Follow for more', x: 50, y: 86, fontSize: 26, style: 'bold-kinetic' },
  { label: 'Custom', text: 'NEW TEXT', x: 50, y: 50, fontSize: 32, style: 'none' },
  { label: 'Hook', text: 'YOU NEED TO SEE THIS', x: 50, y: 18, fontSize: 40, style: 'bold-kinetic' },
  { label: 'Lower third', text: 'Name · Title', x: 5, y: 85, fontSize: 22, style: 'shadow' },
  { label: 'Callout', text: 'PRO TIP', x: 50, y: 25, fontSize: 28, style: 'neon' },
  { label: 'CTA', text: 'TAP TO LEARN MORE', x: 50, y: 92, fontSize: 24, style: 'outline' },
  { label: 'Timestamp', text: '0:00', x: 5, y: 5, fontSize: 18, style: 'minimal' },
]

export const VIRAL_HOOK_PRESETS: TextPresetConfig[] = [
  { label: 'Wait for it', text: 'WAIT FOR IT...', x: 50, y: 15, fontSize: 38, style: 'bold-kinetic' },
  { label: 'POV', text: 'POV:', x: 10, y: 12, fontSize: 32, style: 'neon' },
  { label: 'Story time', text: 'STORY TIME', x: 50, y: 18, fontSize: 36, style: 'shadow' },
  { label: "You won't believe", text: "You won't believe what happened", x: 50, y: 20, fontSize: 28, style: 'bold-kinetic' },
  { label: 'Day in my life', text: 'Day in my life', x: 50, y: 12, fontSize: 30, style: 'minimal' },
  { label: 'Day X of', text: 'Day 1 of...', x: 50, y: 15, fontSize: 34, style: 'outline' },
  { label: 'Get ready', text: 'Get ready for this', x: 50, y: 20, fontSize: 30, style: 'neon' },
  { label: 'Watch till end', text: 'Watch till the end', x: 50, y: 88, fontSize: 24, style: 'shadow' },
  { label: 'No one talks about', text: 'No one talks about this', x: 50, y: 22, fontSize: 26, style: 'bold-kinetic' },
  { label: 'The secret', text: 'The secret they don\'t want you to know', x: 50, y: 50, fontSize: 24, style: 'outline' },
]

export const PREMIUM_CAPTION_PRESETS: TextPresetConfig[] = [
  { label: 'Hormozi Bold', text: 'THE SECRET IS', x: 50, y: 75, fontSize: 44, style: 'bold-kinetic', fontFamily: 'Montserrat, sans-serif' },
  { label: 'Beast Impact', text: 'INSANE!', x: 50, y: 50, fontSize: 52, style: 'neon', fontFamily: 'Inter, sans-serif' },
  { label: 'Minimal Narrative', text: 'actually...', x: 50, y: 82, fontSize: 24, style: 'minimal', fontFamily: 'Georgia, serif' },
  { label: 'TikTok POP', text: 'W O W', x: 50, y: 45, fontSize: 36, style: 'outline', fontFamily: 'Montserrat, sans-serif' },
  { label: 'Subliminal Quick', text: 'now', x: 50, y: 50, fontSize: 22, style: 'shadow', fontFamily: 'Inter, sans-serif' },
  { label: 'Punchy Highlight', text: 'ZERO COST', x: 50, y: 72, fontSize: 32, style: 'bold-kinetic', fontFamily: 'Montserrat, sans-serif' },
]

export const REACTION_CALLOUT_PRESETS: TextPresetConfig[] = [
  { label: 'Arrow →', text: '→', x: 75, y: 50, fontSize: 48, style: 'neon' },
  { label: 'Arrow ←', text: '←', x: 25, y: 50, fontSize: 48, style: 'neon' },
  { label: '!', text: '!', x: 85, y: 25, fontSize: 56, style: 'bold-kinetic' },
  { label: '?', text: '?', x: 85, y: 25, fontSize: 56, style: 'bold-kinetic' },
  { label: '★', text: '★', x: 90, y: 15, fontSize: 36, style: 'neon' },
  { label: 'PRO TIP', text: 'PRO TIP', x: 50, y: 22, fontSize: 28, style: 'neon' },
  { label: 'WATCH', text: 'WATCH', x: 50, y: 30, fontSize: 32, style: 'outline' },
  { label: 'HERE', text: 'HERE', x: 50, y: 55, fontSize: 24, style: 'shadow' },
]

export const END_SCREEN_TEMPLATES: TextPresetConfig[] = [
  { label: 'Subscribe', text: 'Subscribe for more', x: 50, y: 50, fontSize: 32, style: 'neon' },
  { label: 'Follow', text: 'Follow for more', x: 50, y: 50, fontSize: 32, style: 'shadow' },
  { label: 'Link in bio', text: 'Link in bio', x: 50, y: 55, fontSize: 28, style: 'outline' },
  { label: 'Swipe up', text: 'Swipe up', x: 50, y: 85, fontSize: 26, style: 'bold-kinetic' },
  { label: 'Like & Subscribe', text: 'Like & Subscribe', x: 50, y: 50, fontSize: 30, style: 'shadow' },
  { label: 'Comment below', text: 'Comment below', x: 50, y: 60, fontSize: 26, style: 'minimal' },
  { label: 'Tap to learn more', text: 'TAP TO LEARN MORE', x: 50, y: 55, fontSize: 28, style: 'outline' },
  { label: 'See you next time', text: 'See you next time', x: 50, y: 50, fontSize: 30, style: 'minimal' },
]

export const TRENDING_PRESETS: TextPresetConfig[] = [
  { label: 'Unpopular opinion', text: 'Unpopular opinion:', x: 50, y: 18, fontSize: 32, style: 'bold-kinetic' },
  { label: 'This changed everything', text: 'This changed everything', x: 50, y: 22, fontSize: 28, style: 'shadow' },
  { label: 'Hot take', text: 'Hot take:', x: 12, y: 15, fontSize: 30, style: 'neon' },
  { label: 'Nobody talks about', text: 'Nobody talks about this', x: 50, y: 20, fontSize: 26, style: 'outline' },
  { label: 'POV', text: 'POV: You just found the best tip', x: 50, y: 25, fontSize: 24, style: 'minimal' },
  { label: 'Save this', text: 'Save this for later', x: 88, y: 12, fontSize: 20, style: 'shadow' },
  { label: 'Comment your', text: 'Comment your answer below', x: 50, y: 88, fontSize: 24, style: 'minimal' },
  { label: 'Drop a', text: 'Drop a 👍 if you agree', x: 50, y: 90, fontSize: 22, style: 'outline' },
]

export const CHAPTER_PRESETS: TextPresetConfig[] = [
  { label: 'Part 1', text: 'Part 1', x: 50, y: 50, fontSize: 48, style: 'shadow' },
  { label: 'Chapter', text: 'Chapter 1', x: 50, y: 45, fontSize: 36, style: 'outline' },
  { label: 'Intro', text: 'INTRO', x: 50, y: 50, fontSize: 42, style: 'bold-kinetic' },
  { label: 'Outro', text: 'OUTRO', x: 50, y: 50, fontSize: 42, style: 'bold-kinetic' },
  { label: 'Next', text: 'Coming up next...', x: 50, y: 55, fontSize: 28, style: 'minimal' },
  { label: 'Recap', text: 'Quick recap', x: 50, y: 18, fontSize: 24, style: 'shadow' },
]

export const RESET_FILTER: VideoFilter = {
  brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, vignette: 0, sharpen: 0,
  noise: 0, temperature: 100, tint: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, vibrance: 100,
  lift: {r: 0, g: 0, b: 0}, gamma: {r: 100, g: 100, b: 100}, gain: {r: 100, g: 100, b: 100},
}

export const FILTER_PRESETS = [
  { n: 'Vibrant', f: { saturation: 150, contrast: 110 }, desc: 'Punchy colors', swatch: 'from-amber-400 via-orange-400 to-rose-500' },
  { n: 'Mono', f: { saturation: 0, contrast: 120 }, desc: 'B&W', swatch: 'from-gray-300 via-gray-500 to-gray-700' },
  { n: 'Cinematic', f: { sepia: 20, vignette: 30 }, desc: 'Film look', swatch: 'from-amber-800/80 via-amber-900/60 to-slate-900' },
  { n: 'Warm', f: { saturation: 110, temperature: 115 }, desc: 'Golden hour', swatch: 'from-orange-300 via-amber-400 to-yellow-500' },
  { n: 'Cool', f: { saturation: 105, temperature: 85, tint: 5 }, desc: 'Blue tones', swatch: 'from-cyan-300 via-blue-400 to-indigo-500' },
  { n: 'Vintage', f: { sepia: 35, saturation: 80, contrast: 110 }, desc: 'Retro', swatch: 'from-amber-700/90 via-yellow-800/70 to-stone-800' },
  { n: 'Moody', f: { contrast: 115, saturation: 90, vignette: 40 }, desc: 'Dark & rich', swatch: 'from-slate-700 via-slate-800 to-black' },
  { n: 'Vivid', f: { saturation: 165, contrast: 108, vibrance: 120 }, desc: 'High pop', swatch: 'from-pink-400 via-fuchsia-400 to-violet-500' },
  { n: 'Noir', f: { saturation: 0, contrast: 130, vignette: 50 }, desc: 'High contrast B&W', swatch: 'from-gray-200 via-gray-600 to-black' },
  { n: 'Sunset', f: { saturation: 120, temperature: 125, vibrance: 115, shadows: 15 }, desc: 'Golden hour', swatch: 'from-orange-500 via-rose-500 to-amber-700' },
  { n: 'Breeze', f: { saturation: 95, temperature: 90, tint: 8, clarity: 110 }, desc: 'Cool & crisp', swatch: 'from-sky-200 via-cyan-300 to-teal-400' },
  { n: 'Matte', f: { contrast: 95, saturation: 90, shadows: 25 }, desc: 'Flat & soft', swatch: 'from-neutral-300 via-neutral-400 to-neutral-500' },
  { n: 'Neon', f: { saturation: 140, contrast: 115, vibrance: 130, hue: -15 }, desc: 'Pop colors', swatch: 'from-lime-400 via-cyan-400 to-fuchsia-400' },
  { n: 'Autumn', f: { saturation: 115, temperature: 118, sepia: 8, vignette: 15 }, desc: 'Warm earth', swatch: 'from-amber-600 via-orange-600 to-rose-700' },
  { n: 'Winter', f: { saturation: 95, temperature: 82, tint: 10, clarity: 112 }, desc: 'Cool & clean', swatch: 'from-slate-200 via-blue-200 to-cyan-200' },
  { n: 'Dreamy', f: { saturation: 85, contrast: 92, vibrance: 105, vignette: 35 }, desc: 'Soft pastel', swatch: 'from-rose-200 via-pink-200 to-violet-200' },
  { n: 'Reset', f: { saturation: 100, contrast: 100, sepia: 0, vignette: 0, temperature: 100, tint: 0, vibrance: 100 }, desc: 'Default', swatch: 'from-gray-400 to-gray-600' },
]

export const STYLE_BUNDLES = [
  { id: 'creator-bold', label: 'Creator Bold', layout: 'vertical' as TemplateLayout, filter: { saturation: 130, contrast: 115, sharpen: 22, vibrance: 118 }, desc: 'High-energy viral', swatch: 'from-fuchsia-500 to-orange-500' },
  { id: 'soft-aesthetic', label: 'Soft Aesthetic', layout: 'portrait' as TemplateLayout, filter: { saturation: 88, contrast: 95, temperature: 112, vignette: 25 }, desc: 'Gentle & dreamy', swatch: 'from-rose-300 to-amber-200' },
  { id: 'corporate-minimal', label: 'Corporate Minimal', layout: 'standard' as TemplateLayout, filter: { saturation: 98, contrast: 105, sharpen: 12, clarity: 10 }, desc: 'Clean & pro', swatch: 'from-slate-400 to-slate-600' },
  { id: 'dark-moody', label: 'Dark Moody', layout: 'standard' as TemplateLayout, filter: { brightness: 92, contrast: 122, saturation: 85, vignette: 45 }, desc: 'Dramatic shadows', swatch: 'from-indigo-900 to-slate-900' },
  { id: 'vibrant-pop', label: 'Vibrant Pop', layout: 'square' as TemplateLayout, filter: { saturation: 150, contrast: 108, vibrance: 130, temperature: 108 }, desc: 'Colorful & punchy', swatch: 'from-cyan-400 via-pink-400 to-yellow-400' },
  { id: 'cinematic-film', label: 'Cinematic Film', layout: 'cinematic' as TemplateLayout, filter: { sepia: 15, contrast: 112, saturation: 95, vignette: 35 }, desc: 'Movie trailer', swatch: 'from-amber-800/80 to-slate-800' },
  { id: 'noir-dramatic', label: 'Noir Dramatic', layout: 'classic' as TemplateLayout, filter: { saturation: 0, contrast: 135, vignette: 50, brightness: 88 }, desc: 'B&W dramatic', swatch: 'from-gray-800 to-black' },
  { id: 'lifestyle-warm', label: 'Lifestyle Warm', layout: 'vertical' as TemplateLayout, filter: { saturation: 115, temperature: 118, vibrance: 112, clarity: 8 }, desc: 'Vlog & travel', swatch: 'from-orange-300 to-amber-400' },
  { id: 'podcast-pro', label: 'Podcast Pro', layout: 'square' as TemplateLayout, filter: { saturation: 95, contrast: 108, sharpen: 15, clarity: 12 }, desc: 'Clean & professional', swatch: 'from-slate-500 to-slate-700' },
  { id: 'documentary', label: 'Documentary', layout: 'standard' as TemplateLayout, filter: { sepia: 12, contrast: 110, saturation: 92, vignette: 28 }, desc: 'Natural & immersive', swatch: 'from-stone-600 to-amber-900/50' },
  { id: 'fashion-editorial', label: 'Fashion Editorial', layout: 'portrait' as TemplateLayout, filter: { contrast: 115, saturation: 105, shadows: 20, clarity: 15 }, desc: 'High-fashion look', swatch: 'from-neutral-200 via-pink-100 to-amber-100' },
  { id: 'retro-warm', label: 'Retro Warm', layout: 'classic' as TemplateLayout, filter: { sepia: 28, saturation: 85, temperature: 115, vignette: 30, noise: 6 }, desc: 'Vintage warmth', swatch: 'from-amber-700/90 via-yellow-700/70 to-stone-800' },
  { id: 'cinematic-drama', label: 'Cinematic Drama', layout: 'cinematic' as TemplateLayout, filter: { contrast: 125, saturation: 90, brightness: 88, vignette: 42, shadows: 18 }, desc: 'Deep & dramatic', swatch: 'from-slate-800 via-indigo-900 to-black' },
  { id: 'comedy-bright', label: 'Comedy Bright', layout: 'square' as TemplateLayout, filter: { brightness: 108, saturation: 130, contrast: 110, vibrance: 122, sharpen: 22 }, desc: 'Punchy & fun', swatch: 'from-yellow-400 via-orange-400 to-pink-400' },
  { id: 'sports-dynamic', label: 'Sports Dynamic', layout: 'vertical' as TemplateLayout, filter: { contrast: 118, saturation: 118, sharpen: 32, clarity: 20, vibrance: 112 }, desc: 'Action-ready', swatch: 'from-red-500 via-amber-500 to-cyan-500' },
]

export const PLATFORM_BUNDLES = [
  { id: 'tiktok', label: 'TikTok / Reels', layout: 'vertical' as TemplateLayout, filter: { saturation: 120, contrast: 108 }, desc: '9:16, punchy' },
  { id: 'youtube', label: 'YouTube Shorts', layout: 'vertical' as TemplateLayout, filter: { saturation: 110, contrast: 105 }, desc: '9:16, balanced' },
  { id: 'feed', label: 'Instagram Feed', layout: 'square' as TemplateLayout, filter: { saturation: 115, vibrance: 110 }, desc: '1:1, vibrant' },
  { id: 'portrait', label: 'Instagram Portrait', layout: 'portrait' as TemplateLayout, filter: { saturation: 112, vibrance: 108, temperature: 108 }, desc: '4:5, warm' },
  { id: 'landscape', label: 'YouTube / Landscape', layout: 'standard' as TemplateLayout, filter: { saturation: 100, contrast: 102 }, desc: '16:9, clean' },
  { id: 'linkedin', label: 'LinkedIn', layout: 'standard' as TemplateLayout, filter: { saturation: 102, contrast: 108, sharpen: 12, clarity: 8 }, desc: '16:9, pro' },
]

export const FILTER_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'mood', label: 'Mood' },
  { id: 'creative', label: 'Creative' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'neutral', label: 'Reset' },
] as const

export const FILTER_PRESETS_WITH_CATEGORY = FILTER_PRESETS.map((p) => {
  let cat: 'mood' | 'creative' | 'dramatic' | 'neutral' = 'mood'
  if (p.n === 'Reset') cat = 'neutral'
  else if (['Mono', 'Noir', 'Moody'].includes(p.n)) cat = 'dramatic'
  else if (['Vibrant', 'Vivid', 'Neon', 'Sunset', 'Autumn', 'Dreamy'].includes(p.n)) cat = 'creative'
  return { ...p, category: cat }
})

export const SHAPE_PRESETS: { id: string; name: string; kind: ShapeOverlayKind; x: number; y: number; width: number; height: number; color: string; opacity: number; strokeWidth?: number }[] = [
  { id: 'logo-corner', name: 'Logo corner', kind: 'rect', x: 88, y: 8, width: 10, height: 10, color: '#ffffff', opacity: 0.2 },
  { id: 'subscribe-badge', name: 'Subscribe badge', kind: 'circle', x: 92, y: 10, width: 6, height: 6, color: '#E53935', opacity: 0.9 },
  { id: 'full-width-bar', name: 'Full-width bar', kind: 'rect', x: 50, y: 94, width: 100, height: 4, color: '#000000', opacity: 0.5 },
  { id: 'divider-line', name: 'Divider line', kind: 'line', x: 50, y: 50, width: 80, height: 1, color: '#ffffff', opacity: 0.4, strokeWidth: 3 },
  { id: 'highlight-box', name: 'Highlight box', kind: 'rect', x: 50, y: 50, width: 60, height: 25, color: '#8B5CF6', opacity: 0.25 },
  { id: 'corner-accent', name: 'Corner accent', kind: 'rect', x: 4, y: 4, width: 8, height: 30, color: '#3B82F6', opacity: 0.8 },
]
