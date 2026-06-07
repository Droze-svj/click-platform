import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "../../lib/utils"

/** Thin wrapper around a lucide icon giving consistent sizing tokens. */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl"

const sizeMap: Record<IconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
}

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  icon: LucideIcon
  size?: IconSize
}

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideComp, size = "md", className, ...props }, ref) => (
    <LucideComp ref={ref} className={cn(sizeMap[size], className)} {...props} />
  )
)
Icon.displayName = "Icon"

export { Icon }
