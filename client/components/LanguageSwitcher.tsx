'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { supportedLanguages, languageNames, languageFlags } from '../i18n/config'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={t('settings.language')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm">{languageFlags[language]}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[100]"
          role="listbox"
        >
          {supportedLanguages.map((lang) => (
            <button
              key={lang}
              type="button"
              role="option"
              aria-selected={language === lang}
              onClick={() => {
                setLanguage(lang)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                language === lang ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium' : ''
              }`}
            >
              <span className="text-lg">{languageFlags[lang]}</span>
              <span className="text-sm">{languageNames[lang]}</span>
              {language === lang && <span className="ml-auto text-purple-600 dark:text-purple-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
