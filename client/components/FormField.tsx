'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

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
      setValidationError('This field is required')
    } else {
      setValidationError(null)
    }
  }, [value, touched, validate, required])

  const displayError = error || validationError
  const hasError = touched && displayError
  const hasSuccess = touched && !displayError && value && !isValidating

  const handleBlur = () => {
    setTouched(true)
    if (onBlur) onBlur()
  }

  const inputId = `field-${name}`
  const inputType = type === 'password' && showPassword ? 'text' : type

  const baseInputClasses = `
    w-full px-4 py-3 bg-black/40 text-white border rounded-xl transition-all duration-300
    focus:outline-none focus:bg-indigo-500/5
    disabled:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium tracking-wide
    ${hasError
      ? 'border-red-500/50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
      : hasSuccess
        ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
        : 'border-white/10 hover:border-white/20 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10'
    }
  `

  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2"
        >
          {label}
          {required && <span className="text-red-500/80 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
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
            className={baseInputClasses}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          />
        ) : (
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
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          />
        )}

        {/* Password toggle */}
        {type === 'password' && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {/* Validation icons */}
        {touched && !isValidating && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError ? (
              <AlertCircle size={20} className="text-red-500" />
            ) : hasSuccess ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : null}
          </div>
        )}
      </div>

      {/* Character counter */}
      {maxLength && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          {value.length} / {maxLength}
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <p
          id={`${inputId}-error`}
          className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          role="alert"
        >
          <AlertCircle size={14} />
          {displayError}
        </p>
      )}

      {/* Hint */}
      {!hasError && hint && (
        <p
          id={`${inputId}-hint`}
          className="mt-1.5 text-sm text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      )}
    </div>
  )
}




