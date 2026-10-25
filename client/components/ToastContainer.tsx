'use client'

import { useEffect, useId, useSyncExternalStore } from 'react'
import { useToast } from '../contexts/ToastContext'
import Toast from './Toast'

// The root layout renders a ToastContainer, and ~50 pages render their own on
// top of it — every toast showed twice in the same spot (and was announced
// twice). Only the first mounted container renders; the rest stand by and
// take over if it unmounts.
const mounted: string[] = []
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const getOwner = () => mounted[0] ?? null

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()
  const id = useId()
  useEffect(() => {
    mounted.push(id)
    notify()
    return () => {
      const i = mounted.indexOf(id)
      if (i >= 0) mounted.splice(i, 1)
      notify()
    }
  }, [id])
  const owner = useSyncExternalStore(subscribe, getOwner, () => null)

  if (owner !== id || toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          title={toast.title}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
