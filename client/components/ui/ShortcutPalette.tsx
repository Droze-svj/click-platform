'use client'

/**
 * ShortcutPalette — a discoverability surface listing every keyboard
 * shortcut in the editor. Toggled with `?` (also closes via Esc).
 *
 * Reads from `client/lib/editorShortcuts.ts` so any shortcut added there
 * is automatically documented here. No prop drilling: drop the component
 * once at the editor root and it self-registers the global key listener.
 */

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard, X } from 'lucide-react'
import { EDITOR_SHORTCUTS, isMac, type Shortcut } from '../../lib/editorShortcuts'

const GROUP_ORDER: Shortcut['group'][] = ['Playback', 'Selection', 'Editing', 'Timeline', 'View']

export function ShortcutPalette() {
  const [open, setOpen] = useState(false)
  const onMac = useMemo(() => isMac(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs so `?` in a caption text field doesn't
      // hijack the user.
      const target = e.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (e.key === 'Escape') { setOpen(false); return }
      if (isTyping) return
      // Honor `?` (Shift+/) and the literal `?`.
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open || typeof document === 'undefined') return null

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: EDITOR_SHORTCUTS.filter((s) => s.group === g),
  })).filter((g) => g.items.length > 0)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-palette-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-[#0d0d10] border border-white/10 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="shortcut-palette-title" className="text-base font-black text-white tracking-tight uppercase">
                Keyboard shortcuts
              </h2>
              <p className="text-[11px] text-slate-400">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">?</kbd> anytime to toggle</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="w-8 h-8 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {grouped.map(({ group, items }) => (
            <section key={group}>
              <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">{group}</h3>
              <ul className="space-y-1.5">
                {items.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-200 truncate">{s.label}</div>
                      {s.hint && <div className="text-[10px] text-slate-500 truncate">{s.hint}</div>}
                    </div>
                    <kbd className="flex-shrink-0 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-[11px] font-mono font-bold text-slate-200 whitespace-nowrap">
                      {onMac ? s.mac : s.win}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
