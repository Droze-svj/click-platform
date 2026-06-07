"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

interface BaseOverlayProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
  /** When false, clicking the backdrop does NOT close. Default true. */
  closeOnBackdrop?: boolean
  /** Hide the default close (X) button. Default false. */
  hideClose?: boolean
}

/** Shared a11y + escape/backdrop behaviour for Modal and Sheet. */
function useOverlay(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])
}

export type ModalProps = BaseOverlayProps

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
  closeOnBackdrop = true,
  hideClose = false,
}) => {
  useOverlay(open, onClose)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        className={cn(
          "ds-surface-elevated ds-anim-rise relative z-10 w-full max-w-lg p-6",
          className
        )}
      >
        {!hideClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {title ? <h2 className="ds-text-h3 text-theme-primary pr-8">{title}</h2> : null}
        {description ? (
          <p className="mt-1 text-sm text-theme-muted">{description}</p>
        ) : null}
        <div className={cn(title || description ? "mt-4" : undefined)}>{children}</div>
      </div>
    </div>
  )
}
Modal.displayName = "Modal"

export type SheetSide = "left" | "right"
export interface SheetProps extends BaseOverlayProps {
  side?: SheetSide
}

const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
  side = "right",
  closeOnBackdrop = true,
  hideClose = false,
}) => {
  useOverlay(open, onClose)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <div
        className={cn(
          "ds-surface-elevated absolute top-0 bottom-0 w-full max-w-md p-6 ds-anim-fade-in",
          side === "right" ? "right-0" : "left-0",
          className
        )}
      >
        {!hideClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {title ? <h2 className="ds-text-h3 text-theme-primary pr-8">{title}</h2> : null}
        {description ? (
          <p className="mt-1 text-sm text-theme-muted">{description}</p>
        ) : null}
        <div className={cn(title || description ? "mt-4" : undefined)}>{children}</div>
      </div>
    </div>
  )
}
Sheet.displayName = "Sheet"

export { Modal, Sheet }
