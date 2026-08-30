'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { useDialogBehavior } from './ui/modal'
import { Button } from './ui/button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning' | 'info'
}

/**
 * Confirmation prompt.
 *
 * Was a hand-rolled overlay with no focus trap, no Escape handling, no scroll
 * lock and no dialog role — and hardcoded to light mode (bg-white, text-gray-600),
 * so it dropped a white card into the dark app. Now it borrows the same
 * behaviour <Modal> uses and is themed.
 *
 * `type` drives the confirm button's intent: danger for destructive actions,
 * so "Delete" never looks like "Save".
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = 'info'
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  // Must run before the early return — hooks can't be called conditionally.
  const panelRef = useDialogBehavior(isOpen, onCancel)

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div ref={panelRef} className="ds-surface-elevated w-full max-w-md rounded-xl p-6">
        <h3 id="confirm-dialog-title" className="ds-text-h3 text-theme-primary">
          {title}
        </h3>
        <p id="confirm-dialog-message" className="mt-2 ds-text-body text-theme-secondary">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            {cancelText ?? t('confirmDialog.cancel')}
          </Button>
          <Button
            type="button"
            variant={type === 'danger' ? 'destructive' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmText ?? t('confirmDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
