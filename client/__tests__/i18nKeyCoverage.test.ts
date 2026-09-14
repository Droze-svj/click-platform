/**
 * Every t('some.key') in reachable client code must exist in en.json.
 *
 * useTranslation's humanise() fallback means a missing key NEVER surfaces as an
 * error or an empty string — `t('dashboard.hero.subtitle')` silently renders
 * "Subtitle". That also defeats the idiom the call sites use:
 *
 *     {t('dashboard.hero.subtitle') || 'Forge a clip, write a script, …'}
 *
 * `t()` never returns a falsy value, so the `||` branch is dead and the intended
 * English copy is unreachable. 60 keys were in that state, 27 of them on the
 * dashboard home page, which was rendering "Subtitle", "Title" and "Desc" in
 * place of its real copy.
 *
 * English only: en.json is the universal fallback (useTranslation loads it when
 * the active locale lacks a key), so a key present here degrades gracefully in
 * every other locale, while a key missing here degrades nowhere.
 */
import fs from 'fs'
import path from 'path'

const CLIENT = path.join(__dirname, '..')
const EN = JSON.parse(fs.readFileSync(path.join(CLIENT, 'public/i18n/locales/en.json'), 'utf8'))

function resolve(key: string): boolean {
  let cur: any = EN
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return false
    cur = cur[part]
  }
  return typeof cur === 'string'
}

function walk(dir: string): string[] {
  let out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (/node_modules|\.next|coverage|__tests__/.test(p)) continue
      out = out.concat(walk(p))
    } else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

// Only dotted keys: a bare t('x') is almost always a different helper.
const CALL = /\bt\(\s*['"]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"]/g

describe('i18n key coverage', () => {
  it('every t() key used in the app exists in en.json', () => {
    const missing = new Map<string, string>()

    for (const dir of ['app', 'components', 'hooks', 'lib', 'contexts']) {
      const full = path.join(CLIENT, dir)
      if (!fs.existsSync(full)) continue
      for (const file of walk(full)) {
        const src = fs.readFileSync(file, 'utf8')
        let m
        CALL.lastIndex = 0
        while ((m = CALL.exec(src))) {
          const key = m[1]
          if (resolve(key) || missing.has(key)) continue
          const line = src.slice(0, m.index).split('\n').length
          missing.set(key, `${path.relative(CLIENT, file)}:${line}`)
        }
      }
    }

    // If this fails: add the key to public/i18n/locales/en.json. Do NOT rely on
    // `t('key') || 'fallback'` — t() always returns a string, so that fallback
    // can never run.
    expect(Object.fromEntries(missing)).toEqual({})
  })
})
