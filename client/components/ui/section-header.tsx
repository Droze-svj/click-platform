import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * SectionHeader (ui) — calm, modern section header for the 2026 system.
 *
 * Distinct from `components/dashboard/SectionHeader.tsx` (which keeps its
 * dashboard-specific tone/kicker API). This one is the lightweight primitive:
 * a title, optional description and right-aligned actions.
 */
export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  as?: "h1" | "h2" | "h3"
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, title, description, actions, as = "h2", ...props }, ref) => {
    const Heading = as
    const sizeClass = as === "h1" ? "ds-text-h1" : as === "h3" ? "ds-text-h3" : "ds-text-h2"
    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-end justify-between gap-3", className)}
        {...props}
      >
        <div className="min-w-0">
          <Heading className={cn(sizeClass, "text-theme-primary")}>{title}</Heading>
          {description ? (
            <p className="mt-1 text-sm text-theme-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    )
  }
)
SectionHeader.displayName = "SectionHeader"

export { SectionHeader }
