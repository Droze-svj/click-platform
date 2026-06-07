import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Panel/Card variants for the 2026 design system. When no `variant` is passed,
 * Card renders EXACTLY as before (plain `bg-card` shell) so existing usage is
 * unchanged. Passing a variant opts into the new glass surfaces from globals.
 */
export type PanelVariant = "glass" | "elevated" | "subtle" | "bento"

const panelVariants: Record<PanelVariant, string> = {
  glass: "ds-surface-card p-5",
  elevated: "ds-surface-elevated p-5",
  subtle: "ds-surface-subtle p-5",
  bento: "ds-surface-card ds-hover-lift p-5",
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) =>
    variant ? (
      <div ref={ref} className={cn(panelVariants[variant], className)} {...props} />
    ) : (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          className
        )}
        {...props}
      />
    )
)
Card.displayName = "Card"

/**
 * Panel — expressive glass surface. Same as <Card variant=...> but defaults to
 * the glass look; provided as a clearer name for new layouts.
 */
export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "glass", ...props }, ref) => (
    <div ref={ref} className={cn(panelVariants[variant], className)} {...props} />
  )
)
Panel.displayName = "Panel"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, Panel, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }


