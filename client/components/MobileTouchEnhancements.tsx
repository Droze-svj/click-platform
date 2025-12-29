'use client'

import { useEffect } from 'react'

/**
 * Component that enhances mobile touch interactions
 */
export default function MobileTouchEnhancements() {
  useEffect(() => {
    // Add touch-friendly classes to interactive elements
    const addTouchClasses = () => {
      const interactiveElements = document.querySelectorAll(
        'button, a, input[type="button"], input[type="submit"], [role="button"]'
      )

      interactiveElements.forEach((element) => {
        if (!element.classList.contains('touch-target')) {
          element.classList.add('touch-target')
        }
      })
    }

    // Add haptic feedback for supported devices
    const addHapticFeedback = () => {
      if ('vibrate' in navigator) {
        const buttons = document.querySelectorAll('button[data-haptic]')
        buttons.forEach((button) => {
          button.addEventListener('click', () => {
            navigator.vibrate(10) // Short vibration
          })
        })
      }
    }

    // Improve scroll behavior on mobile
    const improveScrollBehavior = () => {
      let lastTouchY = 0
      let isScrolling = false

      document.addEventListener('touchstart', (e) => {
        lastTouchY = e.touches[0].clientY
      }, { passive: true })

      document.addEventListener('touchmove', (e) => {
        if (!isScrolling) {
          isScrolling = true
          requestAnimationFrame(() => {
            isScrolling = false
          })
        }
      }, { passive: true })
    }

    // Add swipe gestures for navigation
    const addSwipeGestures = () => {
      let touchStartX = 0
      let touchEndX = 0
      const minSwipeDistance = 50

      document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX
      }, { passive: true })

      document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX
        handleSwipe()
      }, { passive: true })

      const handleSwipe = () => {
        const swipeDistance = touchEndX - touchStartX

        if (Math.abs(swipeDistance) > minSwipeDistance) {
          // Swipe right - could go back
          if (swipeDistance > 0) {
            const backButton = document.querySelector('[data-swipe-back]')
            if (backButton && backButton instanceof HTMLElement) {
              backButton.click()
            }
          }
          // Swipe left - could go forward
          else {
            const forwardButton = document.querySelector('[data-swipe-forward]')
            if (forwardButton && forwardButton instanceof HTMLElement) {
              forwardButton.click()
            }
          }
        }
      }
    }

    // Prevent double-tap zoom on buttons
    const preventDoubleTapZoom = () => {
      let lastTap = 0
      document.addEventListener('touchend', (e) => {
        const currentTime = Date.now()
        const tapLength = currentTime - lastTap
        if (tapLength < 300 && tapLength > 0) {
          e.preventDefault()
          const target = e.target as HTMLElement
          if (target && target.click) {
            target.click()
          }
        }
        lastTap = currentTime
      }, { passive: false })
    }

    // Initialize enhancements
    addTouchClasses()
    addHapticFeedback()
    improveScrollBehavior()
    addSwipeGestures()
    preventDoubleTapZoom()

    // Re-run on dynamic content
    const observer = new MutationObserver(() => {
      addTouchClasses()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}




