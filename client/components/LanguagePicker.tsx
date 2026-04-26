'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import {
  supportedLanguages,
  languageNames,
  languageFlags,
  type SupportedLanguage,
} from '../i18n/config'

interface Props {
  /** Compact form shows only the flag + chevron. Full form adds the language label. */
  compact?: boolean
  /** Optional className applied to the trigger button. */
  className?: string
}

/**
 * Language picker — bound to TranslationContext. Renders an accessible
 * popover with all 12 supported languages, native names + flags. RTL languages
 * are tagged so users see when they'll trigger right-to-left layout.
 */
export default function LanguagePicker({ compact = false, className = '' }: Props) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (lang: SupportedLanguage) => {
    setLanguage(lang)
    setOpen(false)
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={t('language.picker') || 'Select language'}
        aria-label={t('language.picker') || 'Select language'}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.06] transition-all text-[10px] font-bold text-slate-300 hover:text-white ${className}`}
      >
        <Globe size={11} className="text-fuchsia-400" />
        <span aria-hidden className="text-[12px] leading-none">{languageFlags[language]}</span>
        {!compact && <span className="uppercase tracking-[0.18em]">{language === 'zh-Hans' ? 'ZH' : language.toUpperCase()}</span>}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.picker') || 'Select language'}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur-2xl shadow-2xl py-1.5"
        >
          {supportedLanguages.map(code => {
            const active = code === language
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${
                  active
                    ? 'bg-fuchsia-500/10 text-white'
                    : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span aria-hidden className="text-base">{languageFlags[code]}</span>
                <span className="flex-1 font-bold">{languageNames[code]}</span>
                {active && <Check size={12} className="text-fuchsia-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
