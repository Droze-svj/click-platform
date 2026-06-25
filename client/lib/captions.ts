// Caption helpers shared by the editor. Mirrors the render service so the
// editor's auto-highlight matches the export.

/** Default accent colour for highlighted keywords (viral green). */
export const DEFAULT_HIGHLIGHT_COLOR = '#39FF14'

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
