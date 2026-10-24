/**
 * Dates in the app's chosen language. TranslationProvider keeps <html lang>
 * in sync with the language picker, so this works outside React hooks too.
 */
export function appLocale(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const lang = document.documentElement.lang
  if (!lang) return undefined
  return lang === 'zh-Hans' ? 'zh-CN' : lang
}

/** Short weekday names, Sunday first (index matches Date.getDay()). */
export function weekdayShortNames(locale: string | undefined = appLocale()): string[] {
  // 7 Jan 2024 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'short' }))
}
