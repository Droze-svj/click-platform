import * as React from "react"
import Link from "next/link"
import { cn } from "../../lib/utils"

/**
 * Frame for the public policy/document pages: privacy, terms, security,
 * contact, compliance, trust, DMCA, cookies, responsible AI, acceptable use.
 *
 * These are one category of page that had drifted into two treatments: some led
 * with a kicker + title + "last updated" date, others with a "← Back to home"
 * link and no date, and the two groups used different h1 sizes (4xl/5xl vs
 * 5xl/6xl). Seven of them also hardcoded a black background and white text, so
 * they ignored the user's theme entirely until that was fixed.
 *
 * Reading width is capped deliberately — these are documents, and a policy set
 * in a 1400px column is unreadable.
 */
export interface LegalPageProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Small uppercase label above the title, e.g. "Legal" or "Compliance". */
  kicker?: string
  title: React.ReactNode
  /** Shown under the title. Pass a Date or a preformatted string. */
  updated?: Date | string
  /** Where the back link goes. Omit to hide it. */
  backHref?: string
  backLabel?: string
  /** Optional standfirst under the header. */
  intro?: React.ReactNode
}

const LegalPage = React.forwardRef<HTMLElement, LegalPageProps>(
  (
    { className, kicker, title, updated, backHref = "/", backLabel = "Back to home", intro, children, ...props },
    ref
  ) => {
    const updatedLabel =
      updated instanceof Date
        ? updated.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : updated

    return (
      <main
        ref={ref}
        className={cn(
          "min-h-screen bg-surface-page text-surface-900 dark:text-surface-50 px-6 py-24 font-inter",
          className
        )}
        {...props}
      >
        <div className="mx-auto max-w-3xl space-y-10">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded text-xs font-bold uppercase tracking-widest text-surface-500 transition-colors hover:text-surface-900 dark:hover:text-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span aria-hidden>←</span> {backLabel}
            </Link>
          ) : null}

          <header className="space-y-3">
            {kicker ? (
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-500">{kicker}</p>
            ) : null}
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">{title}</h1>
            {updatedLabel ? (
              <p className="text-sm text-surface-500">Last updated: {updatedLabel}</p>
            ) : null}
            {intro ? (
              <p className="max-w-2xl text-base text-surface-600 dark:text-surface-400">{intro}</p>
            ) : null}
          </header>

          {children}
        </div>
      </main>
    )
  }
)
LegalPage.displayName = "LegalPage"

export { LegalPage }
