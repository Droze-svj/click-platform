// i18n configuration — Click is global. Every supported locale here gets a
// matching dictionary in `public/i18n/locales/<code>.json`.

export const supportedLanguages = [
  'en',     // English
  'es',     // Español (LATAM + Spain)
  'fr',     // Français
  'de',     // Deutsch
  'pt',     // Português (Brasil + Portugal)
  'it',     // Italiano
  'ja',     // 日本語
  'ko',     // 한국어
  'zh-Hans',// 简体中文
  'ar',     // العربية (RTL)
  'hi',     // हिन्दी
  'ru',     // Русский
] as const;

export type SupportedLanguage = typeof supportedLanguages[number];

export const defaultLanguage: SupportedLanguage = 'en';

export const languageNames: Record<SupportedLanguage, string> = {
  'en':      'English',
  'es':      'Español',
  'fr':      'Français',
  'de':      'Deutsch',
  'pt':      'Português',
  'it':      'Italiano',
  'ja':      '日本語',
  'ko':      '한국어',
  'zh-Hans': '简体中文',
  'ar':      'العربية',
  'hi':      'हिन्दी',
  'ru':      'Русский',
};

export const languageFlags: Record<SupportedLanguage, string> = {
  'en':      '🇺🇸',
  'es':      '🇪🇸',
  'fr':      '🇫🇷',
  'de':      '🇩🇪',
  'pt':      '🇧🇷',
  'it':      '🇮🇹',
  'ja':      '🇯🇵',
  'ko':      '🇰🇷',
  'zh-Hans': '🇨🇳',
  'ar':      '🇸🇦',
  'hi':      '🇮🇳',
  'ru':      '🇷🇺',
};

/** Locales rendered right-to-left. Used by the layout to set `dir="rtl"`. */
export const rtlLanguages: ReadonlySet<SupportedLanguage> = new Set<SupportedLanguage>(['ar']);

/** Human-readable label sent to AI ("Generate the script in <displayLabel>"). */
export const aiLanguageLabel: Record<SupportedLanguage, string> = {
  'en':      'English',
  'es':      'Spanish (neutral LATAM unless the niche signals Spain-specific)',
  'fr':      'French',
  'de':      'German',
  'pt':      'Brazilian Portuguese (use European Portuguese only if user platform suggests it)',
  'it':      'Italian',
  'ja':      'Japanese',
  'ko':      'Korean',
  'zh-Hans': 'Simplified Chinese',
  'ar':      'Modern Standard Arabic',
  'hi':      'Hindi (use Latin transliteration for hashtags)',
  'ru':      'Russian',
};

/** Map a browser Accept-Language tag to one of our supported codes. */
export function resolveLanguage(input: string | null | undefined): SupportedLanguage {
  if (!input) return defaultLanguage;
  const lower = input.toLowerCase();
  // Exact match
  for (const code of supportedLanguages) {
    if (lower === code.toLowerCase()) return code;
  }
  // Region-stripped match: 'es-MX' -> 'es', 'zh-CN' -> 'zh-Hans', 'pt-BR' -> 'pt'
  const base = lower.split('-')[0];
  if (base === 'zh') return 'zh-Hans';
  for (const code of supportedLanguages) {
    if (code.toLowerCase().startsWith(base)) return code;
  }
  return defaultLanguage;
}
