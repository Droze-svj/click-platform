/**
 * Translation integrity. Guards three real bugs found in Oct 2026:
 *  - code asked for keys that didn't exist, so users saw a guessed label;
 *  - translations with different {{placeholders}} rendered blanks/raw tokens;
 *  - English copy full of CODE_STYLE / sci-fi jargon ("PEAK_RESONANCE").
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const LOCALES = path.join(ROOT, 'public/i18n/locales')

type Tree = { [k: string]: string | Tree }
function flat(d: Tree, p = ''): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [k, v] of Object.entries(d)) {
    const kk = p ? `${p}.${k}` : k
    if (typeof v === 'string') o[kk] = v
    else Object.assign(o, flat(v, kk))
  }
  return o
}
const load = (lang: string) => flat(JSON.parse(fs.readFileSync(path.join(LOCALES, `${lang}.json`), 'utf8')))
const en = load('en')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) sourceFiles(p, out)
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) && !/ \d\./.test(e.name)) out.push(p)
  }
  return out
}

describe('i18n integrity', () => {
  it('every literal key the code asks for exists in en.json', () => {
    const missing: string[] = []
    for (const dir of ['app', 'components', 'hooks', 'lib', 'utils', 'contexts']) {
      const abs = path.join(ROOT, dir)
      if (!fs.existsSync(abs)) continue
      for (const f of sourceFiles(abs)) {
        const s = fs.readFileSync(f, 'utf8')
        for (const m of s.matchAll(/\b(?:t|tr)\(\s*['"]([a-zA-Z]+(?:\.[A-Za-z0-9_-]+)+)['"]/g)) {
          if (!(m[1] in en)) missing.push(`${m[1]} (${path.relative(ROOT, f)})`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  const dbl = (s: string) => (s.match(/\{\{\w+\}\}/g) || []).sort().join(',')
  const sgl = (s: string) => (s.match(/(?<!\{)\{\w+\}(?!\})/g) || []).sort().join(',')
  const langs = fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json') && f !== 'en.json').map((f) => f.slice(0, -5))

  it.each(langs)('%s keeps every placeholder of the English string', (lang) => {
    const loc = load(lang)
    const bad = Object.keys(loc).filter((k) => k in en && (dbl(loc[k]) !== dbl(en[k]) || sgl(loc[k]) !== sgl(en[k])))
    expect(bad).toEqual([])
  })

  it.each(langs)('%s has no keys that English dropped', (lang) => {
    expect(Object.keys(load(lang)).filter((k) => !(k in en))).toEqual([])
  })

  it('English copy has no CODE_STYLE tokens or sci-fi jargon', () => {
    const code = /\b[A-Za-z]{2,}(?:_[A-Za-z0-9]{2,})+\b|::/
    const jargon = /\b(neural|quantum|lattice|resonance|synaptic|ledger|uplink|telemetry|swarm|sovereign|spectral|ascension|singularity)\b/i
    // Real terms / raw values that legitimately contain these patterns.
    const allowed = new Set<string>([
      'roadmapPage.item_brandConsolidation_description', // quotes the old labels it removes
    ])
    const hits = Object.entries(en).filter(([k, v]) => !allowed.has(k) && (code.test(v) || jargon.test(v)))
    expect(hits.map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
})
