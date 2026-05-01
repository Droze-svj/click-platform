'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
 * Language picker — bound to TranslationContext.
 *
 * Renders the popover via a body-level portal because the dashboard
 * header (WorkflowRail) uses `overflow-x-auto` for its horizontal
 * scroll — without the portal, the absolute-positioned popover gets
 * clipped to that scroll container and either disappears or shows up
 * inside the wrong stacking context. Portal + position-fixed lets the
 * popover float free of any overflow ancestor.
 *
 * Position is computed from the trigger button's bounding rect on
 * open / scroll / resize so the popover stays anchored to the button
 * even when the page layout shifts.
 */
export default function LanguagePicker({ compact = false, className = '' }: Props) {
  const { language, setLanguage, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Portal target only exists on the client. Track mount state so SSR
  // hydration doesn't try to render the popover before document.body
  // is available.
  useEffect(() => { setMounted(true) }, [])

  const recalcPos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      top: rect.bottom + 8,                // 8px below the trigger
      right: window.innerWidth - rect.right, // anchor to trigger's right edge
    })
  }, [])

  // Recompute position on open + on scroll/resize while open so the
  // popover tracks the trigger if the page scrolls underneath it.
  useLayoutEffect(() => {
    if (!open) return
    recalcPos()
    const onWin = () => recalcPos()
    window.addEventListener('scroll', onWin, true)
    window.addEventListener('resize', onWin)
    return () => {
      window.removeEventListener('scroll', onWin, true)
      window.removeEventListener('resize', onWin)
    }
  }, [open, recalcPos])

  // Close on outside click / Escape. Outside is anywhere that's not
  // the trigger AND not inside the popover.
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

  const select = (lang: SupportedLanguage) => {
    setLanguage(lang)
    setOpen(false)
  }

  const popover = open && pos && mounted
    ? createPortal(
      <div
        ref={popoverRef}
        role="listbox"
        aria-label={t('language.picker') || 'Select language'}
        // position: fixed escapes any overflow ancestor; z-[200] sits
        // above sticky headers (z-30) and most modal backdrops (z-100).
        style={{ position: 'fixed', top: pos.top, right: pos.right }}
        className="z-[200] w-56 max-h-[320px] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a14]/95 backdrop-blur-2xl shadow-2xl py-1.5"
      >
        {supportedLanguages.map(code => {
          const active = code === language
          return (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={active ? 'true' : 'false'}
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
      </div>,
      document.body,
    )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        title={t('language.picker') || 'Select language'}
        aria-label={t('language.picker') || 'Select language'}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
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
