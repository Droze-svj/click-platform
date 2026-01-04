'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Toast from '../components/Toast'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string, duration?: number) => string
  success: (message: string, title?: string) => string
  error: (message: string, title?: string) => string
  info: (message: string, title?: string) => string
  warning: (message: string, title?: string) => string
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', title?: string, duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type, title, duration }])
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, title?: string) => showToast(message, 'success', title), [showToast])
  const error = useCallback((message: string, title?: string) => showToast(message, 'error', title), [showToast])
  const info = useCallback((message: string, title?: string) => showToast(message, 'info', title), [showToast])
  const warning = useCallback((message: string, title?: string) => showToast(message, 'warning', title), [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, info, warning, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

