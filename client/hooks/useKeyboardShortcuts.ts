'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description?: string
}

/**
 * Keyboard shortcuts hook
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          shortcut.action()
        }
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts, router])
}

/**
 * Default keyboard shortcuts
 */
export function defaultShortcuts(router: ReturnType<typeof useRouter>): Shortcut[] {
  return [
    {
      key: 'k',
      ctrl: true,
      action: () => {
        // Open search (you can implement a search modal)
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      },
      description: 'Open search'
    },
    {
      key: 'n',
      ctrl: true,
      action: () => router.push('/dashboard/content'),
      description: 'New content'
    },
    {
      key: 'v',
      ctrl: true,
      action: () => router.push('/dashboard/video'),
      description: 'Upload video'
    },
    {
      key: 's',
      ctrl: true,
      action: () => router.push('/dashboard/scripts'),
      description: 'Generate script'
    },
    {
      key: 'h',
      ctrl: true,
      action: () => router.push('/dashboard'),
      description: 'Go to dashboard'
    }
  ]
}
