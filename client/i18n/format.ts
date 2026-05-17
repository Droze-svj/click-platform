// Locale-aware formatting helpers built on Intl.* — keeps date/number/relative
// time formatting consistent across the app and avoids each page re-deriving
// the active locale. Falls back to 'en' gracefully if the locale isn't
// recognised by the runtime ICU data.
//
// Use these everywhere a number, date, or currency is displayed so users in
// every market see the right thousand separators, decimal commas, calendar
// system, and pluralisation rules.

import type { SupportedLanguage } from './config'

/** Map our supported language codes to BCP 47 locale tags the browser's
 *  Intl APIs understand. Most are identity mappings; we surface this layer
 *  so we can target region-specific behaviour later (e.g. 'es' → 'es-MX'
 *  for LATAM-leaning UI rules). */
const LOCALE_MAP: Record<SupportedLanguage, string> = {
  'en':      'en-US',
  'es':      'es-419',         // neutral LATAM Spanish
  'fr':      'fr-FR',
  'de':      'de-DE',
  'pt':      'pt-BR',          // Brazilian Portuguese (default market)
  'it':      'it-IT',
  'ja':      'ja-JP',
  'ko':      'ko-KR',
  'zh-Hans': 'zh-CN',
  'ar':      'ar-SA',
  'hi':      'hi-IN',
  'ru':      'ru-RU',
  'tr':      'tr-TR',
  'id':      'id-ID',
  'vi':      'vi-VN',
  'pl':      'pl-PL',
  'nl':      'nl-NL',
  'th':      'th-TH',
}

export function toBcp47(lang: SupportedLanguage): string {
  return LOCALE_MAP[lang] || 'en-US'
}

/** Format an integer or float for display. Honours decimal commas, locale
 *  digit shapes (e.g. Hindi/Arabic), and grouping separators. */
export function formatNumber(
  value: number,
  lang: SupportedLanguage,
  opts: Intl.NumberFormatOptions = {}
): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(toBcp47(lang), opts).format(value)
  } catch {
    return String(value)
  }
}

/** Shorten big numbers (12345 → "12.3K", 1_500_000 → "1.5M") with locale-aware
 *  decimal separators. Backed by Intl's `compact` notation. */
export function formatCompact(value: number, lang: SupportedLanguage): string {
  return formatNumber(value, lang, { notation: 'compact', maximumFractionDigits: 1 })
}

/** Currency display — defaults to USD if no code provided. The locale
 *  controls position of symbol and grouping. */
export function formatCurrency(
  value: number,
  lang: SupportedLanguage,
  currency = 'USD'
): string {
  return formatNumber(value, lang, { style: 'currency', currency })
}

/** Percent: pass either 0–1 (auto-multiplied by Intl) or 0–100 (set
 *  `whole: true`). */
export function formatPercent(
  value: number,
  lang: SupportedLanguage,
  opts: { whole?: boolean; digits?: number } = {}
): string {
  const n = opts.whole ? value / 100 : value
  return formatNumber(n, lang, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: opts.digits ?? 1,
  })
}

/** Format a Date (or ms timestamp / ISO string) using the user's locale. */
export function formatDate(
  value: Date | number | string,
  lang: SupportedLanguage,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(toBcp47(lang), opts).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/** Format a Date with a date+time component. */
export function formatDateTime(
  value: Date | number | string,
  lang: SupportedLanguage,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  return formatDate(value, lang, opts)
}

/** "5 minutes ago" / "in 2 days" / "yesterday". Picks the largest natural
 *  unit. Designed for short, human-friendly timestamps on activity feeds. */
export function formatRelative(
  value: Date | number | string,
  lang: SupportedLanguage,
  baseTime: Date | number = Date.now()
): string {
  const target = value instanceof Date ? value.getTime() : new Date(value).getTime()
  const base = baseTime instanceof Date ? baseTime.getTime() : baseTime
  if (Number.isNaN(target)) return ''
  const deltaSec = Math.round((target - base) / 1000)
  const abs = Math.abs(deltaSec)

  const rtf = new Intl.RelativeTimeFormat(toBcp47(lang), { numeric: 'auto' })
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [86400 * 7, 'day'],
    [86400 * 30, 'week'],
    [86400 * 365, 'month'],
    [Infinity, 'year'],
  ]
  for (let i = 0; i < units.length; i++) {
    const [limit, unit] = units[i]
    if (abs < limit) {
      const divisor = i === 0 ? 1 : units[i - 1][0]
      try {
        return rtf.format(Math.round(deltaSec / divisor), unit)
      } catch {
        return ''
      }
    }
  }
  return ''
}

/** Helpful for plural strings ("1 follower" vs "12 followers"). Uses
 *  Intl.PluralRules under the hood. */
export function pluralize(
  count: number,
  lang: SupportedLanguage,
  forms: Partial<Record<Intl.LDMLPluralRule, string>>
): string {
  try {
    const pr = new Intl.PluralRules(toBcp47(lang))
    const rule = pr.select(count) as Intl.LDMLPluralRule
    return forms[rule] || forms.other || ''
  } catch {
    return forms.other || ''
  }
}
