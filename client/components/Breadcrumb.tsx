'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href: string
  icon?: React.ReactNode
}

export default function Breadcrumb() {
  const pathname = usePathname()

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = pathname.split('/').filter(Boolean)

    const breadcrumbs: BreadcrumbItem[] = [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <Home className="w-4 h-4" />
      }
    ]

    let currentPath = '/dashboard'

    // Map of path segments to readable names
    const pathLabels: Record<string, string> = {
      'video': 'Videos',
      'content': 'Content',
      'scripts': 'Scripts',
      'quotes': 'Quotes',
      'scheduler': 'Scheduler',
      'calendar': 'Calendar',
      'social': 'Social',
      'analytics': 'Analytics',
      'achievements': 'Achievements',
      'membership': 'Membership',
      'notifications': 'Notifications',
      'settings': 'Settings',
      'infrastructure': 'Infrastructure',
      'workflows': 'Workflows',
      'jobs': 'Jobs',
      'teams': 'Teams',
      'approvals': 'Approvals',
      'library': 'Library',
      'ai': 'AI Features',
      'niche': 'Niche Packs',
      'edit': 'Edit',
      'new': 'New'
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
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6 animate-fade-in-blur">
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










