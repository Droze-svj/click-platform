'use client'

import { useState, useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

interface Shortcut {
  keys: string[]
  descriptionKey: string
  categoryKey: string
  category: string
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'K'], descriptionKey: 'openSearch', categoryKey: 'navigation', category: 'Navigation' },
  { keys: ['Ctrl', '/'], descriptionKey: 'showKeyboardShortcuts', categoryKey: 'navigation', category: 'Navigation' },
  { keys: ['Esc'], descriptionKey: 'closeDialog', categoryKey: 'navigation', category: 'Navigation' },
  { keys: ['Ctrl', 'Z'], descriptionKey: 'undo', categoryKey: 'actions', category: 'Actions' },
  { keys: ['Ctrl', 'Y'], descriptionKey: 'redo', categoryKey: 'actions', category: 'Actions' },
  { keys: ['Ctrl', 'S'], descriptionKey: 'save', categoryKey: 'actions', category: 'Actions' },
  { keys: ['Ctrl', 'Enter'], descriptionKey: 'submitForm', categoryKey: 'actions', category: 'Actions' },
  { keys: ['?'], descriptionKey: 'showHelp', categoryKey: 'help', category: 'Help' },
]

export default function KeyboardShortcutsHelper() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+/ or Cmd+/ to toggle
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const filteredShortcuts = shortcuts.filter(s =>
    t(`keyboardShortcutsHelper.${s.descriptionKey}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
    t(`keyboardShortcutsHelper.category_${s.categoryKey}`).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.categoryKey]) {
      acc[shortcut.categoryKey] = []
    }
    acc[shortcut.categoryKey].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Keyboard size={24} className="text-purple-600" />
            <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900 dark:text-[var(--text-main)]">
              {t('keyboardShortcutsHelper.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label={t('keyboardShortcutsHelper.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder={t('keyboardShortcutsHelper.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            autoFocus
          />
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                {t(`keyboardShortcutsHelper.category_${category}`)}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t(`keyboardShortcutsHelper.${shortcut.descriptionKey}`)}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-gray-400">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredShortcuts.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('keyboardShortcutsHelper.noShortcutsFound')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('keyboardShortcutsHelper.pressEsc')} <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> {t('keyboardShortcutsHelper.toClose')}
        </div>
      </div>
    </div>
  )
}




