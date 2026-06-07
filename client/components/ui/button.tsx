import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../../lib/utils"

/**
 * Button — 2026 design-system variants. EXISTING variants `default`/`outline`/
 * `ghost`/`destructive` are preserved (so all current usage compiles), and new
 * expressive variants `primary`/`secondary`/`gradient` are added.
 * `default` is an alias of `primary`; `outline` maps to the secondary look.
 */
export type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "gradient"
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"

    const variants: Record<ButtonVariant, string> = {
      // existing
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
      // new expressive
      primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      secondary:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      gradient:
        "text-white shadow-sm bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-500/90 hover:to-fuchsia-500/90",
    }

    const sizes: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    }

    return (
      <button
        type="button"
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
