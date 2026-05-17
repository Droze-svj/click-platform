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
  'tr',     // Türkçe — high creator density, growing TikTok market
  'id',     // Bahasa Indonesia — top 5 social-video market by volume
  'vi',     // Tiếng Việt — fast-growing creator economy
  'pl',     // Polski — strong YouTube + TikTok adoption in CEE
  'nl',     // Nederlands — high revenue-per-creator
  'th',     // ไทย — top short-form market in SEA
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
  'tr':      'Türkçe',
  'id':      'Bahasa Indonesia',
  'vi':      'Tiếng Việt',
  'pl':      'Polski',
  'nl':      'Nederlands',
  'th':      'ไทย',
};

/** English label for each language, paired with the native name in the
 *  picker UI ("Deutsch — German"). Helps non-native speakers locate their
 *  target language without guessing scripts they can't read. */
export const languageEnglishNames: Record<SupportedLanguage, string> = {
  'en':      'English',
  'es':      'Spanish',
  'fr':      'French',
  'de':      'German',
  'pt':      'Portuguese',
  'it':      'Italian',
  'ja':      'Japanese',
  'ko':      'Korean',
  'zh-Hans': 'Chinese (Simplified)',
  'ar':      'Arabic',
  'hi':      'Hindi',
  'ru':      'Russian',
  'tr':      'Turkish',
  'id':      'Indonesian',
  'vi':      'Vietnamese',
  'pl':      'Polish',
  'nl':      'Dutch',
  'th':      'Thai',
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
  'tr':      '🇹🇷',
  'id':      '🇮🇩',
  'vi':      '🇻🇳',
  'pl':      '🇵🇱',
  'nl':      '🇳🇱',
  'th':      '🇹🇭',
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
  'tr':      'Turkish (Istanbul register, casual creator voice)',
  'id':      'Bahasa Indonesia (use everyday spoken register, mix in English loanwords for tech terms)',
  'vi':      'Vietnamese (Northern register; preserve diacritics; English loanwords OK for tech)',
  'pl':      'Polish (informal "ty" register for creator voice; respect grammatical case)',
  'nl':      'Dutch (Netherlands register; "je" form for casual creator voice)',
  'th':      'Thai (informal register; preserve tonal accuracy in word choice)',
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
