import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * Page-level layout primitives.
 *
 * Every dashboard route previously rolled its own outer wrapper and title
 * block, so max-widths, horizontal padding and heading sizes drifted from page
 * to page — the single most visible source of "this app feels inconsistent".
 * These give a route its frame; `SectionHeader` (ui/section-header) still
 * handles headings *within* a page.
 *
 * Composition:
 *
 *   <PageShell>
 *     <PageHeader title="Content" description="…" actions={<Button/>} />
 *     <Toolbar left={<Search/>} right={<Filters/>} />
 *     …page body…
 *   </PageShell>
 */

/* ── PageShell ─────────────────────────────────────────────────────────── */

export type PageWidth = "narrow" | "default" | "wide" | "full"

const WIDTHS: Record<PageWidth, string> = {
  // Reading-width, for settings and forms where long lines hurt scannability.
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[96rem]",
  // Canvas surfaces (editor, timeline) that manage their own bounds.
  full: "max-w-none",
}

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: PageWidth
  /** Drop the default vertical rhythm — for pages that fill the viewport. */
  flush?: boolean
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, width = "default", flush = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // text colour is part of the page frame — every hand-rolled wrapper
        // this replaced set text-theme-primary itself.
        "mx-auto w-full min-w-0 text-theme-primary",
        WIDTHS[width],
        // Vertical rhythm comes from ds-density-pad (scales with the user's
        // Appearance → Density setting), horizontal padding from Tailwind.
        flush ? "" : "px-4 sm:px-6 lg:px-8 ds-density-pad",
        className
      )}
      {...props}
    >
      {flush ? children : <div className="ds-density-stack">{children}</div>}
    </div>
  )
)
PageShell.displayName = "PageShell"

/* ── PageHeader ────────────────────────────────────────────────────────── */

export interface Breadcrumb {
  label: string
  href?: string
}

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  /** Trail above the title. The last entry renders as plain text. */
  breadcrumbs?: Breadcrumb[]
  /** Primary/secondary actions, right-aligned on wide screens. */
  actions?: React.ReactNode
  /** Tabs or segmented control rendered beneath the header. */
  tabs?: React.ReactNode
  /** Small status element (badge, autosave pill) beside the title. */
  meta?: React.ReactNode
  icon?: React.ReactNode
  /**
   * Heading level for the title.
   *
   * Defaults to `h1` — correct for standalone routes (auth, legal, marketing).
   *
   * Dashboard routes pass `h2` while the migration is in flight, because
   * `components/dashboard/DashboardHeader` still renders a route-derived `h1`
   * in the app bar and two h1s on one page is invalid. Once every dashboard
   * page owns a PageHeader, that app-bar title becomes a plain label and this
   * drops back to `h1` everywhere.
   */
  as?: "h1" | "h2"
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, description, breadcrumbs, actions, tabs, meta, icon, as = "h1", ...props }, ref) => {
    const Heading = as
    return (
    <header ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 ds-text-caption text-theme-muted">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="rounded transition-colors hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? "page" : undefined}>{crumb.label}</span>
                  )}
                  {!isLast ? <ChevronRight size={12} aria-hidden="true" className="opacity-60" /> : null}
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <div className="mt-0.5 shrink-0 text-theme-secondary">{icon}</div> : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* One top-level heading per route — headings below use SectionHeader. */}
              <Heading className="ds-text-h1 text-theme-primary">{title}</Heading>
              {meta}
            </div>
            {description ? (
              <p className="mt-1 max-w-2xl ds-text-body text-theme-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {tabs ? <div className="-mb-px">{tabs}</div> : null}
    </header>
    )
  }
)
PageHeader.displayName = "PageHeader"

/* ── Toolbar ───────────────────────────────────────────────────────────── */

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Search / primary filters. */
  left?: React.ReactNode
  /** Sort, view switch, secondary actions. */
  right?: React.ReactNode
  /**
   * Replaces the whole bar while rows are selected, the standard bulk-action
   * pattern — so list pages stop inventing their own selection UI.
   */
  selectionCount?: number
  selectionActions?: React.ReactNode
  onClearSelection?: () => void
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, left, right, selectionCount = 0, selectionActions, onClearSelection, children, ...props }, ref) => {
    const inSelectionMode = selectionCount > 0

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={inSelectionMode ? "Bulk actions" : "Filters and actions"}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl px-3 py-2",
          inSelectionMode ? "ds-surface-elevated" : "ds-surface-subtle",
          className
        )}
        {...props}
      >
        {inSelectionMode ? (
          <>
            <span aria-live="polite" className="ds-text-label text-theme-primary">
              {selectionCount} selected
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {selectionActions}
              {onClearSelection ? (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="rounded-lg px-2 py-1 ds-text-label text-theme-muted transition-colors hover:text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {left ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{left}</div> : null}
            {children}
            {right ? <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div> : null}
          </>
        )}
      </div>
    )
  }
)
Toolbar.displayName = "Toolbar"

/* ── AuthShell ─────────────────────────────────────────────────────────── */

export type AuthWidth = "sm" | "md" | "lg"

const AUTH_WIDTHS: Record<AuthWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

export interface AuthShellProps extends React.HTMLAttributes<HTMLElement> {
  width?: AuthWidth
  /** Rendered top-right, outside the card — e.g. the language picker. */
  corner?: React.ReactNode
  /**
   * Classes for the centred content column (where the card lives), as opposed
   * to `className` which styles the full-viewport <main>. Pages that stack a
   * back-link above the card pass their spacing here.
   */
  contentClassName?: string
}

/**
 * Centred single-card frame for the signed-out routes: login, register, forgot
 * / reset password, verify email, registration success, team invite accept.
 *
 * Separate from PageShell rather than a variant of it: those pages centre a
 * card in the viewport and have no sidebar, header, breadcrumb or density
 * rhythm to inherit. All seven previously repeated
 * `min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12`
 * by hand, with the inner card width drifting between max-w-md and max-w-lg.
 *
 * Renders <main> so signed-out pages have a landmark — several used a bare div.
 */
const AuthShell = React.forwardRef<HTMLElement, AuthShellProps>(
  ({ className, contentClassName, width = "md", corner, children, ...props }, ref) => (
    <main
      ref={ref}
      className={cn(
        "relative min-h-screen ds-bg-mesh flex items-center justify-center px-4 py-12",
        className
      )}
      {...props}
    >
      {corner ? <div className="absolute top-6 right-6 z-50">{corner}</div> : null}
      <div className={cn("w-full ds-anim-rise", AUTH_WIDTHS[width], contentClassName)}>{children}</div>
    </main>
  )
)
AuthShell.displayName = "AuthShell"

/* ── DetailLayout ──────────────────────────────────────────────────────── */

export interface DetailLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sidebar content — metadata, related items, actions. */
  aside: React.ReactNode
  /** Put the sidebar first on wide screens. */
  asidePosition?: "left" | "right"
}

/**
 * Two-column detail body. The aside collapses BELOW the main column on small
 * screens (never a squeezed side rail), and sticks on large ones.
 */
const DetailLayout = React.forwardRef<HTMLDivElement, DetailLayoutProps>(
  ({ className, aside, asidePosition = "right", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8", className)}
      {...props}
    >
      <div className={cn("min-w-0 lg:col-span-2", asidePosition === "left" && "lg:order-2")}>
        {children}
      </div>
      <aside className={cn("min-w-0", asidePosition === "left" && "lg:order-1")}>
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">{aside}</div>
      </aside>
    </div>
  )
)
DetailLayout.displayName = "DetailLayout"

export { PageShell, PageHeader, Toolbar, DetailLayout, AuthShell }
