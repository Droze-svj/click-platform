'use client'

import { Globe } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { supportedLanguages, languageNames, languageFlags } from '../i18n/config'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Change Language"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm">{languageFlags[language]}</span>
      </button>

      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="py-1">
          {supportedLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                language === lang ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : ''
              }`}
            >
              <span className="text-lg">{languageFlags[lang]}</span>
              <span className="text-sm">{languageNames[lang]}</span>
              {language === lang && (
                <span className="ml-auto text-purple-600 dark:text-purple-400">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}






