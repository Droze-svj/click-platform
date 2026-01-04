'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image, { ImageProps } from 'next/image'

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string
  alt: string
  fallbackSrc?: string
  enableWebP?: boolean
  lazy?: boolean
  priority?: boolean
  quality?: number
  onLoad?: () => void
  onError?: () => void
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc,
  enableWebP = true,
  lazy = true,
  priority = false,
  quality = 75,
  onLoad,
  onError,
  className,
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Check WebP support
  useEffect(() => {
    if (!enableWebP) {
      setSupportsWebP(false)
      return
    }

    const checkWebPSupport = async () => {
      // Check if WebP is supported
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setSupportsWebP(false)
        return
      }

      // Try to create a WebP image
      canvas.toDataURL('image/webp').indexOf('image/webp') > -1
        ? setSupportsWebP(true)
        : setSupportsWebP(false)
    }

    checkWebPSupport()
  }, [enableWebP])

  // Generate WebP version of the image URL
  const getWebPUrl = (originalUrl: string): string => {
    if (!supportsWebP || !originalUrl) return originalUrl

    // If it's already a WebP image, return as is
    if (originalUrl.includes('.webp')) return originalUrl

    // Convert common image extensions to WebP
    const webpUrl = originalUrl
      .replace(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i, '.webp')
      .replace(/\?.*/, '') // Remove query parameters
      + '?format=webp'

    return webpUrl
  }

  // Generate responsive image sources
  const generateSources = () => {
    if (!supportsWebP) return []

    const sources = []
    const baseUrl = src.replace(/\?.*/, '') // Remove existing query params

    // WebP sources for different screen sizes
    if (supportsWebP) {
      sources.push({
        srcSet: `${getWebPUrl(baseUrl)} 1x`,
        type: 'image/webp'
      })
    }

    return sources
  }

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)

    // Try fallback image if available
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
      return
    }

    onError?.()
  }

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false)
    setIsLoaded(false)
  }, [src])

  // Loading placeholder
  if (!isLoaded && !hasError) {
    return (
      <div
        className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className || ''}`}
        style={{
          width: props.width || '100%',
          height: props.height || 'auto',
          aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : undefined
        }}
        role="img"
        aria-label={`Loading ${alt}`}
      />
    )
  }

  // Error state
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 ${className || ''}`}
        style={{
          width: props.width || '100%',
          height: props.height || 'auto',
          minHeight: '48px'
        }}
        role="img"
        aria-label={`Failed to load ${alt}`}
      >
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Preload WebP version if supported */}
      {supportsWebP && !lazy && (
        <link
          rel="preload"
          as="image"
          href={getWebPUrl(src)}
          type="image/webp"
        />
      )}

      <Image
        {...props}
        ref={imgRef}
        src={supportsWebP ? getWebPUrl(currentSrc) : currentSrc}
        alt={alt}
        className={className}
        quality={quality}
        priority={priority}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={handleLoad}
        onError={handleError}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
      />

      {/* Show format badge in development */}
      {process.env.NODE_ENV === 'development' && supportsWebP && (
        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded opacity-75">
          WebP
        </div>
      )}
    </div>
  )
}

export default OptimizedImage


