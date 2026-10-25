/**
 * Test double for '@/hooks/useTranslation' that resolves keys against the real
 * English locale (with {{name}} interpolation), so component tests can keep
 * asserting the English copy users see. Use it as:
 *
 *   jest.mock('@/hooks/useTranslation', () => require('@/mocks/useTranslationEn'))
 */
import fs from 'fs'
import path from 'path'

const EN: Record<string, unknown> = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n', 'locales', 'en.json'), 'utf8'),
)

function lookup(key: string): string | undefined {
  let cur: unknown = EN
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

export function t(key: string, params?: Record<string, string | number>): string {
  const value = lookup(key) ?? key
  if (!params) return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = params[name]
    return v === undefined || v === null ? '' : String(v)
  })
}

export function useTranslation() {
  return { t, language: 'en', setLanguage: () => {}, isLoading: false }
}
