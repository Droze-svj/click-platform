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
    const jargon = /\b(neural|quantum|lattice|resonance|synaptic|ledger|uplink|telemetry|swarm|sovereign|spectral|ascension|singularity|strata|logic seed|logic injection|injection active|vocal signature|creator nodes)\b/i
    // Real terms / raw values that legitimately contain these patterns.
    const allowed = new Set<string>([
      'roadmapPage.item_brandConsolidation_description', // quotes the old labels it removes
    ])
    const hits = Object.entries(en).filter(([k, v]) => !allowed.has(k) && (code.test(v) || jargon.test(v)))
    expect(hits.map(([k, v]) => `${k}: ${v}`)).toEqual([])
  })
})

describe('hardcoded UI text', () => {
  // Visible JSX text / common text props must not carry fake sci-fi jargon or
  // CODE_STYLE tokens ("NEURAL_SYNC_EN_ROUTE", "ABORT_TO_REPOSITORY").
  const jargon = /\b(neural|swarm|lattice|resonance|quantum|sovereign|synaptic|telemetry|uplink|ledger|spectral|ascension|singularity|cortex|nexus|omnipresence)\b/i
  const codeStyle = /\b[A-Z]{3,}(?:_[A-Z0-9]{2,})+\b/
  // Legitimate: legal text, env-var names on developer test pages.
  const ALLOWED = [
    /app\/privacy\/page\.tsx: .*Telemetry Data/,
    /app\/test-(connection|registration)\/page\.tsx: NEXT_PUBLIC_API_URL/,
  ]

  it('no jargon in visible component text', () => {
    const hits: string[] = []
    for (const dir of ['app', 'components']) {
      for (const f of sourceFiles(path.join(ROOT, dir))) {
        if (!f.endsWith('.tsx')) continue
        const rel = path.relative(ROOT, f)
        fs.readFileSync(f, 'utf8').split('\n').forEach((line) => {
          const t = line.trim()
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import ')) return
          const texts = [
            ...Array.from(line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g), (m) => m[1]),
            ...Array.from(line.matchAll(/(?:title|label|placeholder|aria-label|description)\s*[=:]\s*['"]([^'"]{3,})['"]/g), (m) => m[1]),
          ]
          for (const txt of texts) {
            if (!(jargon.test(txt) || codeStyle.test(txt))) continue
            const entry = `${rel}: ${txt.trim()}`
            if (!ALLOWED.some((a) => a.test(entry))) hits.push(entry)
          }
        })
      }
    }
    expect(hits).toEqual([])
  })
})
