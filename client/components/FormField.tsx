'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Eye, EyeOff, Hash, Lock, Mail, Type } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

  const baseInputClasses = `
    w-full px-6 py-5 bg-surface-page dark:bg-black/40 text-surface-900 dark:text-white border-2 rounded-2xl transition-all duration-500
    focus:outline-none focus:bg-surface-card dark:focus:bg-black/60
    disabled:bg-surface-page/50 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-black uppercase tracking-widest italic
    ${hasError
      ? 'border-rose-500/50 focus:border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
      : hasSuccess
        ? 'border-emerald-500/50 focus:border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
        : 'border-surface-100 dark:border-white/5 hover:border-primary-500/30 focus:border-primary-500 shadow-inner'
    }
  `

  return (
    <div className="mb-6">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[10px] font-black uppercase tracking-[0.4em] text-surface-400 dark:text-slate-600 mb-3 italic leading-none pl-1"
        >
          {label}
          {required && <span className="text-rose-500/80 ml-2 font-black">*</span>}
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
            className={`${baseInputClasses} resize-none custom-scrollbar`}
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
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 opacity-0 group-focus-within/field:opacity-100 transition-opacity rounded-l-2xl" />
          </div>
        )}

        {/* Password toggle */}
        {type === 'password' && showPasswordToggle && (
          <button
           type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-surface-300 dark:text-slate-800 hover:text-primary-500 transition-colors border-none bg-transparent"
            aria-label={showPassword ? t('formField.hidePassword') : t('formField.showPassword')}
          >
            {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
          </button>
        )}

        {/* Validation icons */}
        {touched && !isValidating && !showPasswordToggle && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            {hasError ? (
              <AlertCircle size={24} className="text-rose-500 animate-pulse" />
            ) : hasSuccess ? (
              <CheckCircle size={24} className="text-emerald-500" />
            ) : null}
          </div>
        )}
      </div>

      {/* Character counter */}
      {maxLength && (
        <div className="mt-2 text-[9px] font-black text-surface-300 dark:text-slate-800 text-right uppercase tracking-widest italic">
          {value.length} / {maxLength} {t('formField.bitsData')}
        </div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {hasError && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            id={`${inputId}-error`}
            className="mt-3 text-[11px] font-black text-rose-500 flex items-center gap-2 uppercase tracking-widest italic"
            role="alert"
          >
            <AlertCircle size={14} />
            {displayError}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Hint */}
      {!hasError && hint && (
        <p
          id={`${inputId}-hint`}
          className="mt-3 text-[11px] font-black text-surface-400 dark:text-slate-700 uppercase tracking-widest italic"
        >
          {hint}
        </p>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--color-primary-500), 0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
      `}</style>
    </div>
  )
}
