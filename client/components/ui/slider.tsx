import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Slider — a thin, controlled wrapper over a native range input so it inherits
 * the project's existing range styling while exposing a typed onChange value.
 */
export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      defaultValue={defaultValue}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
)
Slider.displayName = "Slider"

export { Slider }
