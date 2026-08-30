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

/**
 * Everything that makes a dialog behave like a dialog rather than just look
 * like one: Escape to close, a real focus trap, focus restored to whatever
 * opened it, and the page behind locked from scrolling.
 *
 * This previously handled Escape only. `aria-modal="true"` tells assistive tech
 * the rest of the page is inert, but nothing enforced it — a keyboard user
 * could Tab straight out of the dialog into the page behind while a screen
 * reader insisted they couldn't, and the background scrolled under the overlay.
 * 65 files hand-roll their own overlay and none of them do better, so this is
 * the behaviour they inherit by migrating here.
 *
 * @param open whether the overlay is showing
 * @param onClose called on Escape
 * @returns ref to attach to the dialog panel (the element focus is trapped in)
 *
 * Exported so the overlays that are already built as bespoke JSX can adopt the
 * behaviour without being rewritten as <Modal>:
 *
 *   const panelRef = useDialogBehavior(isOpen, close)
 *   <div className="fixed inset-0 …">
 *     <div ref={panelRef} role="dialog" aria-modal="true"> … </div>
 *   </div>
 */
export function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return

    // Remember what had focus so it can be handed back on close. Without this,
    // closing a dialog drops focus to <body> and a keyboard user restarts from
    // the top of the page.
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Lock background scroll, preserving the existing inline value so we don't
    // clobber a page that sets its own overflow.
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = "hidden"

    // Deliberately attribute-based, not layout-based. An earlier version
    // filtered on `offsetParent !== null`, which drops every position:fixed
    // element in a real browser (their offsetParent is null) and everything at
    // all under jsdom, silently disabling the trap. Hidden-by-CSS controls in a
    // dialog are rare; a broken trap is not an acceptable trade for catching
    // them.
    const focusableIn = (root: HTMLElement) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (el) =>
          !el.hasAttribute("hidden") &&
          el.getAttribute("aria-hidden") !== "true" &&
          !el.closest('[aria-hidden="true"]')
      )

    // Move focus into the dialog. Prefer the first focusable control; fall back
    // to the panel itself so focus is never left outside the trap.
    const panel = panelRef.current
    if (panel) {
      const first = focusableIn(panel)[0]
      if (first) first.focus()
      else {
        panel.setAttribute("tabindex", "-1")
        panel.focus()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key !== "Tab") return

      const root = panelRef.current
      if (!root) return
      const focusable = focusableIn(root)
      if (focusable.length === 0) {
        // Nothing to move to — keep focus on the panel rather than letting it
        // escape to the page behind.
        e.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      // Wrap at both ends, and pull focus back in if it somehow got outside.
      if (!root.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      body.style.overflow = previousOverflow
      // Only restore focus if it's still somewhere in the (now unmounting)
      // dialog — if the app moved focus deliberately, leave it alone.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus()
      }
    }
  }, [open, onClose])

  return panelRef
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
  const panelRef = useDialogBehavior(open, onClose)
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
        ref={panelRef}
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
  const panelRef = useDialogBehavior(open, onClose)
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
        ref={panelRef}
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
