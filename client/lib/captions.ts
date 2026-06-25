// Caption helpers shared by the editor. Mirrors the render service so the
// editor's auto-highlight matches the export.

/** Default accent colour for highlighted keywords (viral green). */
export const DEFAULT_HIGHLIGHT_COLOR = '#39FF14'

// Compact keyword → emoji map for auto-emoji on captions (most-specific first).
const EMOJI_MAP: [RegExp, string][] = [
  [/\b(money|cash|rich|profit|dollars?|paid|income|wealth)\b/i, '💰'],
  [/\b(fire|hot|lit|viral|trending|blazing)\b/i, '🔥'],
  [/\b(win|won|winner|success|champion|achieve)\b/i, '🏆'],
  [/\b(idea|smart|genius|brilliant|think)\b/i, '💡'],
  [/\b(grow(th)?|increase|boost|rise|scal(e|ing))\b/i, '📈'],
  [/\b(fast|quick|speed|rocket|launch|instant)\b/i, '🚀'],
  [/\b(warning|danger|careful|caution)\b/i, '⚠️'],
  [/\b(stop|never|don'?t)\b/i, '🛑'],
  [/\b(time|clock|now|today|deadline)\b/i, '⏰'],
  [/\b(look|watch|see|eyes|attention)\b/i, '👀'],
  [/\b(strong|power(ful)?|muscle)\b/i, '💪'],
  [/\b(crazy|insane|mind|wow|unbelievable)\b/i, '🤯'],
  [/\b(secret|hidden|nobody)\b/i, '🤫'],
  [/\b(love|heart|favou?rite)\b/i, '❤️'],
  [/\b(best|perfect|amazing|great)\b/i, '✨'],
]

/** Pick a relevant emoji for a caption, or '' if nothing matches (never forced). */
export function pickCaptionEmoji(text: string): string {
  const s = String(text || '')
  for (const [re, e] of EMOJI_MAP) if (re.test(s)) return e
  return ''
}

const POWER_RE = /\b(how|why|secret|proven|ultimate|fast|easy|free|best|stop|never|always|mistake|worst|insane|crazy|nobody|everyone|now|new|first|biggest|money|viral|hack|trick|truth|warning)\b/i

function normWord(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Pick the most "punchy" words in a caption to auto-highlight (power words,
 * numbers, longer content words). Returns up to `max` normalized words.
 */
export function pickHighlightWords(text: string, max = 2): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const scored = words
    .map((w) => {
      const n = normWord(w)
      if (!n) return null
      let score = 0
      if (POWER_RE.test(w)) score += 3
      if (/\d/.test(w)) score += 3
      if (n.length >= 6) score += 2
      else if (n.length >= 4) score += 1
      if (w === w.toUpperCase() && n.length > 2) score += 1
      return { n, score }
    })
    .filter((x): x is { n: string; score: number } => !!x && x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of scored) {
    if (seen.has(s.n)) continue
    seen.add(s.n)
    out.push(s.n)
    if (out.length >= Math.max(1, max)) break
  }
  return out
}
