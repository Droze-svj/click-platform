'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const allItems = [
    { label: 'Home', href: '/dashboard' },
    ...items
  ]

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center space-x-2 text-sm ${className}`}
    >
      <ol className="flex items-center space-x-2">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1
          
          return (
            <li key={index} className="flex items-center">
              {index === 0 ? (
                <Link
                  href={item.href || '#'}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Home"
                >
                  <Home size={16} />
                </Link>
              ) : (
                <>
                  <ChevronRight size={16} className="text-gray-400 mx-2" />
                  {isLast ? (
                    <span className="text-gray-900 dark:text-white font-medium" aria-current="page">
                      {item.label}
                    </span>
                  ) : item.href ? (
                    <Link
                      href={item.href}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}




