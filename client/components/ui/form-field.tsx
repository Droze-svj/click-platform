import * as React from "react"
import { cn } from "../../lib/utils"

const fieldBase =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

/** FormField — label + hint + error wrapper around any control. */
export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, htmlFor, hint, error, required, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
      {label ? (
        <label htmlFor={htmlFor} className="ds-text-label text-theme-secondary">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="text-xs font-medium text-rose-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-theme-muted">{hint}</span>
      ) : null}
    </div>
  )
)
FormField.displayName = "FormField"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(fieldBase, "h-10", error && "border-rose-500 focus-visible:ring-rose-500", className)}
      {...props}
    />
  )
)
Input.displayName = "Input"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-[80px] resize-y", error && "border-rose-500 focus-visible:ring-rose-500", className)}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { FormField, Input, Textarea }
