'use client'

import Link from 'next/link'
import { Compass } from 'lucide-react'
import { AuthShell, Card, Icon } from '../components/ui'
import { useTranslation } from '../hooks/useTranslation'

/**
 * Custom 404 for unmatched routes. Uses the same card frame as the other
 * signed-out pages (it used to be a full-screen purple gradient that matched
 * nothing else) and offers both ways back: home and sign in.
 */
export default function NotFound() {
  const { t } = useTranslation()
  return (
    <AuthShell width="md">
      <Card variant="elevated" className="p-8 sm:p-10 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ds-surface-subtle">
          <Icon icon={Compass} size="lg" className="text-primary" />
        </div>
        <p className="ds-text-label text-theme-muted">404</p>
        <h1 className="ds-text-h1 text-theme-primary">{t('notFoundPage.title')}</h1>
        <p className="ds-text-body text-theme-secondary">{t('notFoundPage.body')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('notFoundPage.home')}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-input bg-background px-5 text-sm font-medium text-theme-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('auth.signIn')}
          </Link>
        </div>
      </Card>
    </AuthShell>
  )
}
