'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface BreadcrumbItem {
  label: string
  href: string
  icon?: React.ReactNode
}

export default function Breadcrumb() {
  const { t } = useTranslation()
  const pathname = usePathname()

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split('/').filter(Boolean)

    const breadcrumbs: BreadcrumbItem[] = [
      {
        label: t('breadcrumb.dashboard'),
        href: '/dashboard',
        icon: <Home className="w-4 h-4" />
      }
    ]

    let currentPath = '/dashboard'

    // Map of path segments to readable names
    const pathLabels: Record<string, string> = {
      'video': t('breadcrumb.videos'),
      'content': t('breadcrumb.content'),
      'scripts': t('breadcrumb.scripts'),
      'quotes': t('breadcrumb.quotes'),
      'scheduler': t('breadcrumb.scheduler'),
      'calendar': t('breadcrumb.calendar'),
      'social': t('breadcrumb.social'),
      'analytics': t('breadcrumb.analytics'),
      'achievements': t('breadcrumb.achievements'),
      'membership': t('breadcrumb.membership'),
      'notifications': t('breadcrumb.notifications'),
      'settings': t('breadcrumb.settings'),
      'infrastructure': t('breadcrumb.infrastructure'),
      'workflows': t('breadcrumb.workflows'),
      'jobs': t('breadcrumb.jobs'),
      'teams': t('breadcrumb.teams'),
      'approvals': t('breadcrumb.approvals'),
      'library': t('breadcrumb.library'),
      'ai': t('breadcrumb.aiFeatures'),
      'niche': t('breadcrumb.nichePacks'),
      'edit': t('breadcrumb.edit'),
      'new': t('breadcrumb.new')
    }

    for (let i = 1; i < pathSegments.length; i++) {
      const segment = pathSegments[i]
      currentPath += `/${segment}`

      // Handle dynamic routes (IDs)
      if (/^[a-f0-9]{24}$/.test(segment) || /^\d+$/.test(segment)) {
        continue // Skip IDs in breadcrumbs
      }

      const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

      breadcrumbs.push({
        label,
        href: currentPath
      })
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  if (breadcrumbs.length <= 1) {
    return null // Don't show breadcrumbs on dashboard home
  }

  return (
    <nav aria-label={t('breadcrumb.ariaLabel')} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6 animate-fade-in-blur">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400 dark:text-gray-500" />
          )}

          {index === breadcrumbs.length - 1 ? (
            // Last item (current page)
            <span className="flex items-center font-medium text-gray-900 dark:text-gray-100">
              {crumb.icon && <span className="mr-2">{crumb.icon}</span>}
              {crumb.label}
            </span>
          ) : (
            // Previous items (links)
            <Link
              href={crumb.href}
              className="flex items-center hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200 hover-lift"
            >
              {crumb.icon && <span className="mr-2">{crumb.icon}</span>}
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}










