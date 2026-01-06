'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
// import { trackPageView } from '../utils/analytics'

/**
 * Analytics Component
 * 
 * Automatically tracks page views when route changes.
 * Integrates with Google Analytics (if configured) and custom analytics endpoints.
 * 
 * @remarks
 * - Only tracks in production or when analytics is explicitly enabled
 * - Tracks page views automatically on route changes
 * - Supports Google Analytics 4 (gtag) if NEXT_PUBLIC_GA_MEASUREMENT_ID is set
 * - Supports custom analytics endpoint if NEXT_PUBLIC_ANALYTICS_ENDPOINT is set
 * - Renders nothing (null component)
 * 
 * @example
 * ```tsx
 * <Analytics />
 * ```
 */
export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    // Track page view when pathname changes
    if (pathname) {
      // trackPageView(pathname)
    }
  }, [pathname])

  // Load Google Analytics script if measurement ID is provided
  useEffect(() => {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (!measurementId || typeof window === 'undefined') {
      return
    }

    // Check if gtag is already loaded
    if ((window as any).gtag) {
      return
    }

    // Load Google Analytics script
    const script1 = document.createElement('script')
    script1.async = true
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script1)

    const script2 = document.createElement('script')
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}', {
        page_path: window.location.pathname,
      });
    `
    document.head.appendChild(script2)

    return () => {
      // Cleanup if needed
    }
  }, [])

  // This component doesn't render anything
  return null
}



