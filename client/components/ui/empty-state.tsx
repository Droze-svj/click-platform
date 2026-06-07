import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional CTA, e.g. a <Button />. */
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: IconComp, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center",
        className
      )}
      {...props}
    >
      {IconComp ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-theme-muted">
          <IconComp className="h-6 w-6" aria-hidden />
        </div>
      ) : null}
      <h3 className="ds-text-h3 text-theme-primary">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm text-theme-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
