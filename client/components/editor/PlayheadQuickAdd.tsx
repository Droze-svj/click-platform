'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Type, Square, Image as ImageIcon, Film, Sparkles } from 'lucide-react'

export type QuickAddKind = 'text' | 'shape' | 'image' | 'broll' | 'effect'

interface Props {
  /** Current playhead time in seconds — passed back to onAdd. */
  currentTime: number
  /** Pixel offset of the playhead from the start of the timeline content. */
  leftPx: number
  /** Whether the parent timeline is mounted; used to bail out of portal. */
  visible: boolean
  /** Called when the user picks an edit kind. The implementation in
   *  ModernVideoEditor dispatches into the matching state setter so the new
   *  edit lands at exactly `currentTime` and shows up automatically in both
   *  timeline and preview. */
  onAdd: (kind: QuickAddKind, time: number) => void
}

const ITEMS: Array<{ kind: QuickAddKind; label: string; Icon: typeof Type; color: string }> = [
  { kind: 'text',   label: 'Text overlay',   Icon: Type,        color: 'text-amber-300' },
  { kind: 'shape',  label: 'Shape',          Icon: Square,      color: 'text-emerald-300' },
  { kind: 'image',  label: 'Image / GIF',    Icon: ImageIcon,   color: 'text-sky-300' },
  { kind: 'broll',  label: 'B-roll clip',    Icon: Film,        color: 'text-fuchsia-300' },
  { kind: 'effect', label: 'Effect',         Icon: Sparkles,    color: 'text-violet-300' },
]

/**
 * PlayheadQuickAdd — small "+" affordance that follows the timeline playhead.
 * Click opens a portal-rendered popover anchored to the cursor; pick a kind →
 * the new edit lands at the current playhead timestamp.
 */
export default function PlayheadQuickAdd({ currentTime, leftPx, visible, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!visible) return null

  const onClick = () => {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      // Anchor below the button; clamp to viewport so it doesn't clip on the
      // right edge of narrow panels.
      const popoverWidth = 200
      const x = Math.min(window.innerWidth - popoverWidth - 8, rect.left)
      setAnchor({ x, y: rect.bottom + 6 })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={onClick}
        title={`Add edit at ${currentTime.toFixed(2)}s`}
        aria-label="Add edit at playhead"
        style={{
          position: 'absolute',
          left: leftPx,
          top: -22,
          transform: 'translateX(-50%)',
        }}
        className="z-40 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 border border-white/20 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && anchor && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            left: anchor.x,
            top: anchor.y,
            width: 200,
            zIndex: 1000,
          }}
          className="rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl backdrop-blur-2xl p-1.5"
        >
          <div className="px-2 py-1.5 border-b border-white/5 mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
              Add at <span className="text-indigo-300 font-mono">{currentTime.toFixed(2)}s</span>
            </p>
          </div>
          {ITEMS.map(({ kind, label, Icon, color }) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onAdd(kind, currentTime)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-white/5 transition-colors group"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-xs font-bold text-slate-200 group-hover:text-white">{label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
