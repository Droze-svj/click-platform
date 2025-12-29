'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Video, FileText, Calendar, Settings, Search, Zap } from 'lucide-react'

export default function QuickActionsMenu() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const actions = [
    {
      icon: <Video size={20} />,
      label: 'Upload Video',
      shortcut: 'V',
      action: () => router.push('/dashboard/video')
    },
    {
      icon: <FileText size={20} />,
      label: 'Create Content',
      shortcut: 'C',
      action: () => router.push('/dashboard/content')
    },
    {
      icon: <Calendar size={20} />,
      label: 'Schedule Post',
      shortcut: 'S',
      action: () => router.push('/dashboard/scheduler')
    },
    {
      icon: <Search size={20} />,
      label: 'Search',
      shortcut: '/',
      action: () => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    },
    {
      icon: <Zap size={20} />,
      label: 'Quick Actions',
      shortcut: 'K',
      action: () => setIsOpen(false)
    },
    {
      icon: <Settings size={20} />,
      label: 'Settings',
      shortcut: ',',
      action: () => router.push('/dashboard/settings')
    }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={menuRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-4"
      >
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search actions..."
            autoFocus
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="space-y-1">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.action()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="text-gray-600 dark:text-gray-400">{action.icon}</div>
              <span className="flex-1 text-gray-900 dark:text-white">{action.label}</span>
              <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                {action.shortcut}
              </kbd>
            </button>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  )
}







