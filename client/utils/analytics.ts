/**
 * Analytics utilities for tracking user events and page views
 * 
 * Provides a centralized analytics interface that can work with
 * multiple analytics providers (Google Analytics, Plausible, custom endpoints, etc.)
 */

// Analytics event types
export type AnalyticsEvent = 'page_view' | 'click' | 'submit' | 'download' | 'share' | 'custom'

export interface AnalyticsEventData {
  event: AnalyticsEvent
  category?: string
  action?: string
  label?: string
  value?: number
  [key: string]: any // Allow additional custom properties
}

/**
 * Checks if analytics is enabled and should track events
 */
function isAnalyticsEnabled(): boolean {
  // Only track in production or when explicitly enabled
  if (process.env.NODE_ENV !== 'production') {
    return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
  }
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false'
}

/**
 * Sends an analytics event to the configured analytics endpoint
 */
async function sendToAnalyticsEndpoint(data: AnalyticsEventData) {
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
  if (!endpoint) return

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
      keepalive: true, // Ensures request completes even if page unloads
    })
  } catch (error) {
    // Silently fail analytics to not interrupt user experience
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Failed to send event:', error)
    }
  }
}

/**
 * Tracks a custom analytics event
 * 
 * @param event - The event type
 * @param data - Additional event data
 * 
 * @example
 * ```typescript
 * trackEvent('click', {
 *   category: 'button',
 *   action: 'generate_content',
 *   label: 'content_page',
 * });
 * ```
 */
export function trackEvent(event: AnalyticsEvent, data?: Partial<AnalyticsEventData>) {
  if (!isAnalyticsEnabled() || typeof window === 'undefined') {
    return
  }

  const eventData: AnalyticsEventData = {
    event,
    ...data,
  }

  // Send to custom analytics endpoint if configured
  sendToAnalyticsEndpoint(eventData)

  // Google Analytics 4 (gtag) integration
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('event', event, {
      event_category: data?.category,
      event_label: data?.label,
      value: data?.value,
      ...data,
    })
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] Event:', event, eventData)
  }
}

/**
 * Tracks a page view
 * 
 * @param path - The page path (defaults to current path)
 * @param title - Optional page title
 * 
 * @example
 * ```typescript
 * trackPageView('/dashboard/content', 'Content Generator');
 * ```
 */
export function trackPageView(path?: string, title?: string) {
  if (!isAnalyticsEnabled() || typeof window === 'undefined') {
    return
  }

  const pagePath = path || window.location.pathname
  const pageTitle = title || document.title

  // Send to custom analytics endpoint
  sendToAnalyticsEndpoint({
    event: 'page_view',
    path: pagePath,
    title: pageTitle,
  })

  // Google Analytics 4 (gtag) integration
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '', {
      page_path: pagePath,
      page_title: pageTitle,
    })
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics] Page view:', pagePath, pageTitle)
  }
}

/**
 * Tracks a click event
 * 
 * @param element - The clicked element or element identifier
 * @param data - Additional event data
 * 
 * @example
 * ```typescript
 * trackClick('generate_button', {
 *   category: 'content',
 *   location: 'content_page',
 * });
 * ```
 */
export function trackClick(element: string, data?: Partial<AnalyticsEventData>) {
  trackEvent('click', {
    category: 'interaction',
    action: 'click',
    label: element,
    ...data,
  })
}

/**
 * Tracks a form submission
 * 
 * @param formName - Name or identifier of the form
 * @param data - Additional event data
 * 
 * @example
 * ```typescript
 * trackFormSubmit('content_generator', {
 *   category: 'content',
 *   value: generatedContentLength,
 * });
 * ```
 */
export function trackFormSubmit(formName: string, data?: Partial<AnalyticsEventData>) {
  trackEvent('submit', {
    category: 'form',
    action: 'submit',
    label: formName,
    ...data,
  })
}

/**
 * Tracks a download event
 * 
 * @param fileName - Name of the downloaded file
 * @param fileType - Type of the file (optional)
 * 
 * @example
 * ```typescript
 * trackDownload('content_export.pdf', 'pdf');
 * ```
 */
export function trackDownload(fileName: string, fileType?: string) {
  trackEvent('download', {
    category: 'download',
    action: 'download_file',
    label: fileName,
    fileType,
  })
}

/**
 * Tracks a share event
 * 
 * @param platform - Platform where content was shared
 * @param contentType - Type of content shared
 * 
 * @example
 * ```typescript
 * trackShare('twitter', 'content_post');
 * ```
 */
export function trackShare(platform: string, contentType?: string) {
  trackEvent('share', {
    category: 'social',
    action: 'share',
    label: platform,
    contentType,
  })
}

/**
 * Sets user properties for analytics
 * 
 * @param userId - User ID
 * @param properties - Additional user properties
 * 
 * @example
 * ```typescript
 * setUserProperties('user123', {
 *   subscription: 'pro',
 *   plan: 'monthly',
 * });
 * ```
 */
export function setUserProperties(userId: string, properties?: Record<string, any>) {
  if (!isAnalyticsEnabled() || typeof window === 'undefined') {
    return
  }

  // Google Analytics 4 (gtag) integration
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('set', 'user_id', userId)
    if (properties) {
      gtag('set', 'user_properties', properties)
    }
  }

  // Send to custom analytics endpoint
  sendToAnalyticsEndpoint({
    event: 'custom',
    category: 'user',
    action: 'identify',
    label: userId,
    ...properties,
  })
}

/**
 * React hook for tracking page views automatically
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   usePageView('/dashboard/content', 'Content Generator');
 *   return <div>Content</div>;
 * }
 * ```
 */
export function usePageView(path?: string, title?: string) {
  if (typeof window === 'undefined') return

  // This would typically use useEffect in a React component
  // For now, this is a placeholder - actual hook implementation
  // should be in a separate file or this should be imported in components
  trackPageView(path, title)
}



