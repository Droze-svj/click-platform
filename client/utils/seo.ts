/**
 * SEO utilities for Next.js metadata management
 * 
 * Provides utilities for generating consistent SEO metadata,
 * Open Graph tags, and Twitter Cards across the application.
 */

import type { Metadata } from 'next'

export interface SEOConfig {
  title: string
  description: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  siteName?: string
  author?: string
  publishedTime?: string
  modifiedTime?: string
  noindex?: boolean
  nofollow?: boolean
}

const defaultSiteName = 'Click - AI-Powered Content Creation'
const defaultDescription = 'Transform long-form content into social-ready formats with AI-powered tools'
const defaultImage = '/og-image.png' // You should add this image to your public folder
const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com'

/**
 * Generates comprehensive SEO metadata for Next.js pages.
 * 
 * @param config - SEO configuration object
 * @returns Next.js Metadata object with all SEO tags
 * 
 * @example
 * ```typescript
 * export const metadata = generateMetadata({
 *   title: 'Dashboard',
 *   description: 'Manage your content and analytics',
 *   keywords: ['content', 'management', 'analytics'],
 * });
 * ```
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = defaultImage,
    url = defaultUrl,
    type = 'website',
    siteName = defaultSiteName,
    author,
    publishedTime,
    modifiedTime,
    noindex = false,
    nofollow = false,
  } = config

  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`
  const imageUrl = image.startsWith('http') ? image : `${defaultUrl}${image}`

  const robots = []
  if (noindex) robots.push('noindex')
  if (nofollow) robots.push('nofollow')
  if (robots.length === 0) robots.push('index', 'follow')

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: keywords.length > 0 ? keywords.join(', ') : undefined,
    robots: robots.join(', '),
    openGraph: {
      type,
      title: fullTitle,
      description,
      siteName,
      url,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  }

  return metadata
}

/**
 * Generates page-specific metadata for dashboard pages.
 * 
 * @param pageName - Name of the dashboard page
 * @param description - Page description
 * @param additionalKeywords - Additional keywords specific to the page
 * @returns Next.js Metadata object
 * 
 * @example
 * ```typescript
 * export const metadata = generateDashboardMetadata(
 *   'Content Generator',
 *   'Create AI-powered content for social media',
 *   ['AI', 'content generation', 'social media']
 * );
 * ```
 */
export function generateDashboardMetadata(
  pageName: string,
  description: string,
  additionalKeywords: string[] = []
): Metadata {
  const defaultKeywords = ['content creation', 'social media', 'AI', 'marketing', 'automation']
  const keywords = [...defaultKeywords, ...additionalKeywords]

  return generateMetadata({
    title: pageName,
    description,
    keywords,
    type: 'website',
  })
}

/**
 * Generates metadata for content detail pages.
 * 
 * @param contentTitle - Title of the content
 * @param contentDescription - Description of the content
 * @param contentImage - Optional image URL for the content
 * @param contentUrl - Optional URL for the content
 * @returns Next.js Metadata object
 * 
 * @example
 * ```typescript
 * export const metadata = generateContentMetadata(
 *   'How to Create Viral Content',
 *   'Learn the secrets of creating viral social media content',
 *   '/images/content-thumbnail.jpg',
 *   '/dashboard/content/123'
 * );
 * ```
 */
export function generateContentMetadata(
  contentTitle: string,
  contentDescription: string,
  contentImage?: string,
  contentUrl?: string
): Metadata {
  return generateMetadata({
    title: contentTitle,
    description: contentDescription,
    image: contentImage,
    url: contentUrl,
    type: 'article',
    keywords: ['content', 'social media', 'marketing', 'AI'],
  })
}

/**
 * Generates structured data (JSON-LD) for SEO.
 * 
 * @param config - SEO configuration
 * @returns JSON-LD structured data string
 * 
 * @example
 * ```tsx
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={{
 *     __html: generateStructuredData({
 *       title: 'Dashboard',
 *       description: 'Manage your content',
 *       type: 'website',
 *     }),
 *   }}
 * />
 * ```
 */
export function generateStructuredData(config: SEOConfig): string {
  const {
    title,
    description,
    url = defaultUrl,
    type = 'website',
    image = defaultImage,
    publishedTime,
    modifiedTime,
    author,
  } = config

  const imageUrl = image.startsWith('http') ? image : `${defaultUrl}${image}`

  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': type === 'article' ? 'Article' : 'WebSite',
    name: title,
    description,
    url,
    image: imageUrl,
    ...(publishedTime && { datePublished: publishedTime }),
    ...(modifiedTime && { dateModified: modifiedTime }),
    ...(author && { author: { '@type': 'Person', name: author } }),
  }

  return JSON.stringify(structuredData)
}

/**
 * Generates canonical URL for a page.
 * 
 * @param path - Page path (e.g., '/dashboard/content')
 * @returns Full canonical URL
 * 
 * @example
 * ```typescript
 * const canonical = generateCanonicalUrl('/dashboard/content');
 * // Returns: 'https://your-domain.com/dashboard/content'
 * ```
 */
export function generateCanonicalUrl(path: string): string {
  const baseUrl = defaultUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

/**
 * Generates meta tags array for use in Next.js head.
 * This is useful for dynamic metadata that can't be set in the Metadata API.
 * 
 * @param config - SEO configuration
 * @returns Array of meta tag objects
 */
export function generateMetaTags(config: SEOConfig): Array<{ name: string; content: string }> {
  const {
    title,
    description,
    keywords = [],
    noindex = false,
    nofollow = false,
  } = config

  const tags: Array<{ name: string; content: string }> = []

  if (keywords.length > 0) {
    tags.push({ name: 'keywords', content: keywords.join(', ') })
  }

  if (noindex || nofollow) {
    const robots = []
    if (noindex) robots.push('noindex')
    if (nofollow) robots.push('nofollow')
    tags.push({ name: 'robots', content: robots.join(', ') })
  }

  return tags
}



