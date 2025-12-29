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
    w-full px-4 py-2.5 border rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-1
    disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60
    ${hasError 
      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
      : hasSuccess
      ? 'border-green-300 focus:border-green-500 focus:ring-green-200'
      : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
    }
  `

  return (
    <div className="mb-4">
      <label 
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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




