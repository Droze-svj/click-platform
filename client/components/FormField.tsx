'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff, Hash, Lock, Mail, Type } from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/hooks/useTranslation'

interface FormFieldProps {
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'number' | 'tel' | 'url'
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  required?: boolean
  placeholder?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  validate?: (value: string) => string | null
  autoFocus?: boolean
  disabled?: boolean
  showPasswordToggle?: boolean
  rows?: number
}

export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  hint,
  required = false,
  placeholder,
  maxLength,
  minLength,
  pattern,
  validate,
  autoFocus = false,
  disabled = false,
  showPasswordToggle = false,
  rows = 4
}: FormFieldProps) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Real-time validation
  useEffect(() => {
    if (touched && value) {
      setIsValidating(true)
      const timer = setTimeout(() => {
        if (validate) {
          const validationResult = validate(value)
          setValidationError(validationResult || null)
        } else {
          setValidationError(null)
        }
        setIsValidating(false)
      }, 300) // Debounce validation

      return () => clearTimeout(timer)
    } else if (touched && !value && required) {
      setValidationError(t('formField.fieldRequired'))
    } else {
      setValidationError(null)
    }
  }, [value, touched, validate, required, t])

  const displayError = error || validationError
  const hasError = touched && displayError
  const hasSuccess = touched && !displayError && value && !isValidating

  const handleBlur = () => {
    setTouched(true)
    if (onBlur) onBlur()
  }

  const inputId = `field-${name}`
  const inputType = type === 'password' && showPassword ? 'text' : type

  const Icon = type === 'email' ? Mail : type === 'password' ? Lock : type === 'number' ? Hash : Type

  // Same look as the design-system Input (components/ui/form-field): what the
  // user types is shown as typed — no forced uppercase/italic.
  const baseInputClasses = `
    w-full h-11 rounded-lg border bg-background px-3 text-sm text-theme-primary
    placeholder:text-muted-foreground ring-offset-background transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    disabled:cursor-not-allowed disabled:opacity-50
    ${type === 'password' && showPasswordToggle ? 'pr-11' : 'pr-10'}
    ${hasError
      ? 'border-rose-500 focus-visible:ring-rose-500'
      : hasSuccess
        ? 'border-emerald-500/60'
        : 'border-input'
    }
  `

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="ds-text-label text-theme-secondary">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}

      <div className="relative group/field">
        {type === 'textarea' ? (
          <textarea
            id={inputId}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            minLength={minLength}
            autoFocus={autoFocus}
            disabled={disabled}
            rows={rows}
            className={`${baseInputClasses} h-auto py-2 resize-none custom-scrollbar`}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          />
        ) : (
          <div className="relative">
             <input
              id={inputId}
              name={name}
              type={inputType}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholder}
              required={required}
              maxLength={maxLength}
              minLength={minLength}
              pattern={pattern}
              autoFocus={autoFocus}
              disabled={disabled}
              className={baseInputClasses}
              aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            />
          </div>
        )}

        {/* Password toggle */}
        {type === 'password' && showPasswordToggle && (
          <button
           type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-theme-muted hover:text-theme-primary transition-colors border-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? t('formField.hidePassword') : t('formField.showPassword')}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {/* Validation icons */}
        {touched && !isValidating && !showPasswordToggle && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {hasError ? (
              <AlertCircle size={18} className="text-rose-500" />
            ) : hasSuccess ? (
              <CheckCircle size={18} className="text-emerald-500" />
            ) : null}
          </div>
        )}
      </div>

      {/* Character counter */}
      {maxLength && (
        <div className="text-xs text-theme-muted text-right tabular-nums">
          {value.length} / {maxLength} {t('formField.bitsData')}
        </div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {hasError && (
          <m.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            id={`${inputId}-error`}
            className="text-xs font-medium text-rose-500 flex items-center gap-1.5"
            role="alert"
          >
            <AlertCircle size={14} />
            {displayError}
          </m.p>
        )}
      </AnimatePresence>

      {/* Hint */}
      {!hasError && hint && (
        <p
          id={`${inputId}-hint`}
          className="text-xs text-theme-muted"
        >
          {hint}
        </p>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.35); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
      `}</style>
    </div>
  )
}
