'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Globe, Check, ChevronDown, Search, Clock, Sparkles, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import {
  supportedLanguages,
  languageNames,
  languageEnglishNames,
  languageFlags,
  resolveLanguage,
  type SupportedLanguage,
} from '../i18n/config'

interface Props {
  /** Compact form shows only the flag + chevron. Full form adds the language label. */
  compact?: boolean
  /** Optional className applied to the trigger button. */
  className?: string
}

const RECENT_KEY = 'click.lang.recent'
const SUGGEST_DISMISSED_KEY = 'click.lang.suggest-dismissed'
const MAX_RECENT = 3

// Cache completeness % across the dropdown's lifetime so we don't re-fetch
// 18 JSON dictionaries every time the user opens it.
let completenessCache: Record<string, number> | null = null

async function computeCompleteness(): Promise<Record<string, number>> {
  if (completenessCache) return completenessCache
  function count(o: any): number {
    if (!o || typeof o !== 'object') return 0
    let n = 0
    for (const k of Object.keys(o)) {
      const v = o[k]
      if (typeof v === 'string' && v.length > 0) n++
      else if (typeof v === 'object') n += count(v)
    }
    return n
  }
  try {
    const enRes = await fetch('/i18n/locales/en.json')
    if (!enRes.ok) return {}
    const en = await enRes.json()
    const enCount = count(en) || 1

    const out: Record<string, number> = { en: 100 }
    await Promise.all(supportedLanguages.filter(l => l !== 'en').map(async (lang) => {
      try {
        const r = await fetch(`/i18n/locales/${lang}.json`)
        if (!r.ok) { out[lang] = 0; return }
        const j = await r.json()
        const n = count(j)
        out[lang] = Math.min(100, Math.round((n / enCount) * 100))
      } catch { out[lang] = 0 }
    }))
    completenessCache = out
    return out
  } catch {
    return {}
  }
}

/**
 * Advanced language picker — bound to TranslationContext.
 *
 * Features beyond a basic <select>:
 * - Searchable by native name, English name, language code, and flag.
 * - "Recently used" section pinned at the top (max 3, persisted to localStorage).
 * - Per-language completeness % so users see which locales are fully translated.
 * - One-time browser-language auto-detect prompt ("Use Deutsch?") rendered
 *   inline at the top of the popover when the resolved browser locale differs
 *   from the current language.
 * - Portal-rendered popover (escapes overflow-clip ancestors).
 * - Keyboard navigation: ↑/↓ to highlight, Enter to select, Esc to close,
 *   typing immediately filters and focuses the input.
 */
export default function LanguagePicker({ compact = false, className = '' }: Props) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<SupportedLanguage[]>([])
  const [completeness, setCompleteness] = useState<Record<string, number>>({})
  const [highlight, setHighlight] = useState(0)
  const [suggested, setSuggested] = useState<SupportedLanguage | null>(null)
  const [suggestDismissed, setSuggestDismissed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Load recent languages + completeness once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((l: any) => supportedLanguages.includes(l)).slice(0, MAX_RECENT))
        }
      }
      setSuggestDismissed(localStorage.getItem(SUGGEST_DISMISSED_KEY) === '1')
    } catch { /* localStorage might be disabled */ }
    computeCompleteness().then(setCompleteness)
  }, [])

  // Detect browser language. If it differs from the current pick and the
  // user hasn't dismissed the suggestion before, surface a one-tap switch
  // banner at the top of the popover.
  useEffect(() => {
    if (suggestDismissed) return
    if (typeof navigator === 'undefined') return
    const browserLangs = navigator.languages || [navigator.language]
    for (const raw of browserLangs) {
      const resolved = resolveLanguage(raw)
      if (resolved && resolved !== language) {
        setSuggested(resolved)
        return
      }
    }
  }, [language, suggestDismissed])

  const recalcPos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    recalcPos()
    setQuery('')
    setHighlight(0)
    // Focus the search input after the portal has mounted.
    requestAnimationFrame(() => { inputRef.current?.focus() })
    const onWin = () => recalcPos()
    window.addEventListener('scroll', onWin, true)
    window.addEventListener('resize', onWin)
    return () => {
      window.removeEventListener('scroll', onWin, true)
      window.removeEventListener('resize', onWin)
    }
  }, [open, recalcPos])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang)
    setOpen(false)
    // Update the recent stack — move-to-front, dedupe, cap.
    setRecent((prev) => {
      const next = [lang, ...prev.filter((l) => l !== lang)].slice(0, MAX_RECENT)
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [setLanguage])

  const dismissSuggestion = useCallback(() => {
    setSuggested(null)
    setSuggestDismissed(true)
    try { localStorage.setItem(SUGGEST_DISMISSED_KEY, '1') } catch { /* ignore */ }
  }, [])

  // Filter the language list against the search query. Search matches
  // against native name, English name, code, and flag emoji.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return supportedLanguages.slice()
    return supportedLanguages.filter((code) => {
      const native = languageNames[code].toLowerCase()
      const en = languageEnglishNames[code].toLowerCase()
      return (
        code.toLowerCase().includes(q) ||
        native.includes(q) ||
        en.includes(q) ||
        languageFlags[code].includes(q)
      )
    })
  }, [query])

  // Group: recent (when no query), then filtered. Skip duplicates.
  const groupedRecent = !query.trim() ? recent.filter((r) => r !== language && supportedLanguages.includes(r)) : []
  const groupedAll = filtered.filter((c) => !groupedRecent.includes(c))
  const flatList = [...groupedRecent, ...groupedAll]

  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(flatList.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = flatList[highlight]
      if (pick) select(pick)
    }
  }

  const popover = open && pos && mounted
    ? createPortal(
      // Outer container is just a popover surface — only the inner list of
      // language options gets role="listbox". A listbox is not allowed to
      // contain inputs/buttons (the search field + suggestion banner), so
      // keeping the role on the wrapper trips the a11y validator.
      <div
        ref={popoverRef}
        role="dialog"
        aria-label={t('language.picker') || 'Select language'}
        style={{ position: 'fixed', top: pos.top, right: pos.right }}
        className="z-[200] w-[300px] max-h-[440px] flex flex-col rounded-2xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      >
        {/* Browser-language suggestion banner */}
        {suggested && suggested !== language && (
          <div className="px-3 py-2.5 bg-fuchsia-500/10 border-b border-fuchsia-500/20 flex items-center gap-2">
            <Sparkles size={12} className="text-fuchsia-400 flex-shrink-0" />
            <span className="text-[11px] text-slate-300 flex-1 truncate">
              {t('language.useSuggested') || 'Use'} <span className="font-bold text-white">{languageFlags[suggested]} {languageNames[suggested]}</span>?
            </span>
            <button
              type="button"
              onClick={() => select(suggested)}
              className="px-2.5 py-1 rounded-lg bg-fuchsia-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-fuchsia-400 transition-colors"
            >
              {t('language.useIt') || 'Use it'}
            </button>
            <button
              type="button"
              onClick={dismissSuggestion}
              aria-label="Dismiss"
              className="w-6 h-6 rounded-md text-slate-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="px-3 py-2.5 border-b border-white/5 flex items-center gap-2">
          <Search size={12} className="text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
            onKeyDown={handleInputKey}
            placeholder={t('language.search') || 'Search languages…'}
            className="flex-1 bg-transparent border-0 outline-none text-[12px] text-white placeholder:text-slate-600 font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
              className="w-5 h-5 rounded text-slate-500 hover:text-white flex items-center justify-center"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* List — role="listbox" lives here (not on the wrapper) so the
            search input and suggestion banner aren't illegal children. */}
        <div
          role="listbox"
          aria-label={t('language.options') || 'Languages'}
          className="overflow-y-auto flex-1 py-1"
        >
          {groupedRecent.length > 0 && (
            <div className="px-3 pt-1.5 pb-1 flex items-center gap-1.5">
              <Clock size={9} className="text-slate-600" />
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                {t('language.recent') || 'Recently used'}
              </span>
            </div>
          )}
          {flatList.map((code, idx) => {
            const active = code === language
            const isRecent = groupedRecent.includes(code)
            const isFirstAfterRecent = idx === groupedRecent.length && groupedRecent.length > 0
            const pct = completeness[code]
            return (
              <React.Fragment key={code}>
                {isFirstAfterRecent && (
                  <div className="px-3 pt-2 pb-1 mt-1 border-t border-white/5 flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                      {t('language.all') || 'All languages'}
                    </span>
                  </div>
                )}
                {(() => {
                  const buttonContent = (
                    <>
                      <span aria-hidden className="text-lg leading-none">{languageFlags[code]}</span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="font-bold leading-tight truncate">{languageNames[code]}</span>
                        <span className="text-[10px] text-slate-500 leading-tight truncate">
                          {languageEnglishNames[code]}
                          {isRecent && !query.trim() && <span className="ml-1.5 text-slate-700">·</span>}
                          {isRecent && !query.trim() && <span className="ml-1.5 text-slate-600">{t('language.recentBadge') || 'recent'}</span>}
                        </span>
                      </span>
                      {pct !== undefined && pct < 100 && (
                        <span
                          title={`${pct}% translated`}
                          className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md border ${
                            pct >= 90 ? 'text-emerald-400/80 border-emerald-500/20'
                              : pct >= 60 ? 'text-amber-400/80 border-amber-500/20'
                                : 'text-slate-500 border-slate-500/20'
                          }`}
                        >{pct}%</span>
                      )}
                      {active && <Check size={12} className="text-fuchsia-400 flex-shrink-0" />}
                    </>
                  )

                  if (active) {
                    return (
                      <button type="button"
                        role="option"
                        aria-selected="true"
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => select(code)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors bg-fuchsia-500/10 text-white"
                      >
                        {buttonContent}
                      </button>
                    )
                  }

                  return (
                    <button type="button"
                      role="option"
                      aria-selected="false"
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => select(code)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] transition-colors ${
                        highlight === idx
                          ? 'bg-white/[0.06] text-white'
                          : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {buttonContent}
                    </button>
                  )
                })()}
              </React.Fragment>
            )
          })}
          {flatList.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px] text-slate-600">
              {t('language.noResults') || 'No languages match'} <span className="text-slate-400">“{query}”</span>
            </div>
          )}
        </div>
      </div>,
      document.body,
    )
    : null

  return (
    <>
      <button type="button"
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        title={t('language.picker') || 'Select language'}
        aria-label={t('language.picker') || 'Select language'}
        aria-haspopup="listbox"
        {...{ 'aria-expanded': open }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/[0.06] transition-all text-[10px] font-bold text-slate-300 hover:text-white ${className}`}
      >
        <Globe size={11} className="text-fuchsia-400" />
        <span aria-hidden className="text-[12px] leading-none">{languageFlags[language]}</span>
        {!compact && <span className="uppercase tracking-[0.18em]">{language === 'zh-Hans' ? 'ZH' : language.toUpperCase()}</span>}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {popover}
    </>
  )
}
