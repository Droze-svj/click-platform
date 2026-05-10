'use client'

/**
 * ConfirmDialog — branded replacement for window.confirm.
 *
 * Why: window.confirm breaks design consistency, is unstylable, blocks the
 * event loop, and on mobile renders as a system dialog that looks unprofessional
 * for a paid product. This dialog matches Click's design system, supports
 * Esc-to-close + focus-trap, and lets callers surface a destructive intent
 * without a layout-shift modal flicker.
 *
 * Usage (function-style — easiest for one-off confirmations):
 *
 *   import { confirmDialog } from '@/components/ui/ConfirmDialog'
 *   const ok = await confirmDialog({
 *     title: 'Delete 10 clips?',
 *     description: 'This cannot be undone.',
 *     confirmText: 'Delete',
 *     destructive: true,
 *   })
 *   if (ok) { await runDelete() }
 *
 * Or render as a regular component when you want full control over open state.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Auto-focus the confirm button so Enter triggers the action; Esc cancels.
    confirmRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#0d0d10] border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {destructive && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-400" aria-hidden="true" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 id="confirm-dialog-title" className="text-lg font-black text-white tracking-tight uppercase">
                {title}
              </h2>
              {description && (
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5 bg-white/[0.02]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-white/5 transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={
              'px-4 py-2 rounded-lg text-sm font-bold transition-colors ' +
              (destructive
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-indigo-500 hover:bg-indigo-600 text-white')
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Imperative wrapper. Mounts a one-shot dialog and resolves with true/false.
 * Convenient for replacing `window.confirm` calls without restructuring the
 * caller into an open-state-driven render tree.
 */
export function confirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    // Defer require so SSR builds don't pull in react-dom/client at module load.
    const ReactDOM = require('react-dom/client')
    const root = ReactDOM.createRoot(host)
    const cleanup = () => {
      try { root.unmount() } catch { /* ignore */ }
      try { host.remove() } catch { /* ignore */ }
    }
    const Wrapper = () => {
      const [open, setOpen] = useState(true)
      return (
        <ConfirmDialog
          {...opts}
          open={open}
          onConfirm={() => { setOpen(false); resolve(true); setTimeout(cleanup, 100) }}
          onCancel={() => { setOpen(false); resolve(false); setTimeout(cleanup, 100) }}
        />
      )
    }
    root.render(<Wrapper />)
  })
}
