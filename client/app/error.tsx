'use client'

import { useEffect } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'
import ClickAmbientCanvas from '../components/click/ClickAmbientCanvas'
import ClickLogo from '../components/ClickLogo'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reduce = useReducedMotion()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen text-theme-primary flex items-center justify-center p-6 selection:bg-primary-500/30 overflow-x-clip relative">
      <ClickAmbientCanvas variant="auth" />

      <m.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="click-vessel p-8 sm:p-12 md:p-14 w-full max-w-xl text-center relative z-10"
      >
        <div className="flex justify-center mb-6">
          <ClickLogo size={32} showWordmark aura />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center mx-auto mb-6 text-rose-500">
          <AlertCircle className="w-8 h-8" aria-hidden="true" />
        </div>

        <h1 className="ds-text-h1 text-theme-primary mb-3">
          Something interrupted <span className="click-spectrum-text">Click</span>
        </h1>

        <p className="ds-text-body text-theme-muted mb-8 max-w-md mx-auto">
          We hit a temporary hiccup while loading this view. Your work is safe — retry below or head back home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="group w-full sm:w-auto px-7 py-3.5 rounded-full click-btn-energy text-sm font-bold flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50"
          >
            <RotateCcw className="w-4 h-4 motion-safe:group-hover:-rotate-180 motion-safe:transition-transform duration-500" aria-hidden="true" />
            Try again
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-7 py-3.5 rounded-full ds-surface-subtle text-theme-primary text-sm font-bold hover:border-[var(--click-vessel-border-hover)] transition-colors flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Return home
          </Link>
        </div>
      </m.div>
    </div>
  )
}
