/**
 * Image Optimization Hook
 * Provides utilities for image preloading, format detection, and optimization
 */

import { useState, useEffect, useCallback } from 'react'

interface ImageOptimizationOptions {
  enableWebP?: boolean
  quality?: number
  priority?: boolean
  lazy?: boolean
}

interface ImageState {
  isLoaded: boolean
  hasError: boolean
  supportsWebP: boolean | null
  currentSrc: string
}

export const useImageOptimization = (
  src: string,
  options: ImageOptimizationOptions = {}
) => {
  const { enableWebP = true, quality = 75 } = options

  const [state, setState] = useState<ImageState>({
    isLoaded: false,
    hasError: false,
    supportsWebP: null,
    currentSrc: src
  })

  // Check WebP support
  const checkWebPSupport = useCallback(async (): Promise<boolean> => {
    if (!enableWebP) return false

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(false)
        return
      }

      // Try to create a WebP image
      const isSupported = canvas.toDataURL('image/webp').indexOf('image/webp') > -1
      resolve(isSupported)
    })
  }, [enableWebP])

  // Get optimized image URL
  const getOptimizedUrl = useCallback((originalUrl: string, webpSupported: boolean): string => {
    if (!webpSupported || !originalUrl) return originalUrl

    // If it's already a WebP image, return as is
    if (originalUrl.includes('.webp')) return originalUrl

    // Convert common image extensions to WebP
    const webpUrl = originalUrl
      .replace(/\.(jpg|jpeg|png|gif|bmp|tiff)$/i, '.webp')
      .replace(/\?.*/, '') // Remove query parameters
      + `?format=webp&q=${quality}`

    return webpUrl
  }, [quality])

  // Preload image
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to preload image: ${url}`))
      img.src = url
    })
  }, [])

  // Initialize WebP support check
  useEffect(() => {
    checkWebPSupport().then((supported) => {
      setState(prev => ({
        ...prev,
        supportsWebP: supported,
        currentSrc: getOptimizedUrl(src, supported)
      }))
    })
  }, [src, checkWebPSupport, getOptimizedUrl])

  // Preload critical images
  const preloadCriticalImages = useCallback(async (urls: string[]) => {
    if (!state.supportsWebP) return

    const promises = urls.map(url =>
      preloadImage(getOptimizedUrl(url, state.supportsWebP!))
    )

    try {
      await Promise.all(promises)
      console.log('✅ Critical images preloaded')
    } catch (error) {
      console.warn('⚠️ Some critical images failed to preload:', error.message)
    }
  }, [state.supportsWebP, preloadImage, getOptimizedUrl])

  // Generate responsive image sources
  const getResponsiveSources = useCallback((baseUrl: string) => {
    if (!state.supportsWebP) return []

    const sources = []

    // WebP sources for different breakpoints
    const breakpoints = [640, 768, 1024, 1280, 1536] // Tailwind breakpoints

    breakpoints.forEach(bp => {
      sources.push({
        media: `(min-width: ${bp}px)`,
        srcSet: `${getOptimizedUrl(baseUrl, true)} ${bp}w`
      })
    })

    return sources
  }, [state.supportsWebP, getOptimizedUrl])

  return {
    ...state,
    getOptimizedUrl: (url: string) => getOptimizedUrl(url, state.supportsWebP || false),
    preloadImage,
    preloadCriticalImages,
    getResponsiveSources
  }
}

/**
 * Hook for preloading images on route changes
 */
export const useImagePreloader = () => {
  const [preloadedRoutes, setPreloadedRoutes] = useState<Set<string>>(new Set())

  const preloadRouteImages = useCallback(async (route: string, images: string[]) => {
    if (preloadedRoutes.has(route)) return

    try {
      const promises = images.map(url => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject()
          img.src = url
        })
      })

      await Promise.all(promises)
      setPreloadedRoutes(prev => new Set([...prev, route]))
      console.log(`📸 Preloaded ${images.length} images for route: ${route}`)
    } catch (error) {
      console.warn(`⚠️ Failed to preload images for route ${route}:`, error)
    }
  }, [preloadedRoutes])

  return { preloadRouteImages, preloadedRoutes: Array.from(preloadedRoutes) }
}

/**
 * Utility function to check if browser supports modern image formats
 */
export const checkImageFormatSupport = async (): Promise<{
  webp: boolean
  avif: boolean
  heic: boolean
}> => {
  const results = {
    webp: false,
    avif: false,
    heic: false
  }

  // Check WebP
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    results.webp = ctx ? canvas.toDataURL('image/webp').indexOf('image/webp') > -1 : false
  } catch {
    results.webp = false
  }

  // Check AVIF
  try {
    const avif = new Image()
    await new Promise((resolve, reject) => {
      avif.onload = resolve
      avif.onerror = reject
      avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
    })
    results.avif = true
  } catch {
    results.avif = false
  }

  // Check HEIC (limited browser support)
  results.heic = false // Most browsers don't support HEIC yet

  return results
}


