import * as React from "react"
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

export type StatDeltaDirection = "up" | "down" | "neutral"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  /** Delta text, e.g. "+12%". Color is derived from `direction` (meaning). */
  delta?: string
  direction?: StatDeltaDirection
  icon?: LucideIcon
  /** Optional sparkline / chart slot rendered under the value. */
  sparkline?: React.ReactNode
}

const deltaStyles: Record<StatDeltaDirection, string> = {
  up: "text-emerald-500",
  down: "text-rose-500",
  neutral: "text-theme-muted",
}

const deltaIcon: Record<StatDeltaDirection, LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  neutral: Minus,
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, delta, direction = "neutral", icon: IconComp, sparkline, ...props }, ref) => {
    const DeltaIcon = deltaIcon[direction]
    return (
      <div ref={ref} className={cn("ds-surface-card p-5", className)} {...props}>
        <div className="flex items-start justify-between gap-3">
          <span className="ds-text-label text-theme-muted">{label}</span>
          {IconComp ? (
            <IconComp className="h-5 w-5 text-theme-muted" aria-hidden />
          ) : null}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="ds-text-h2 text-theme-primary">{value}</span>
          {delta ? (
            <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", deltaStyles[direction])}>
              <DeltaIcon className="h-3 w-3" aria-hidden />
              {delta}
            </span>
          ) : null}
        </div>
        {sparkline ? <div className="mt-3">{sparkline}</div> : null}
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
