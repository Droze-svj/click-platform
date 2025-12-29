'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import DarkModeToggle from './DarkModeToggle'
import NotificationBell from './NotificationBell'
import AdvancedSearch from './AdvancedSearch'

export default function MobileNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/dashboard/video', label: 'Videos', icon: '🎥' },
    { path: '/dashboard/content', label: 'Content', icon: '✨' },
    { path: '/dashboard/library', label: 'Library', icon: '📚' },
    { path: '/dashboard/scripts', label: 'Scripts', icon: '📝' },
    { path: '/dashboard/workflows', label: 'Workflows', icon: '🤖' },
    { path: '/dashboard/jobs', label: 'Jobs', icon: '⚡' },
    { path: '/dashboard/quotes', label: 'Quotes', icon: '💬' },
    { path: '/dashboard/scheduler', label: 'Scheduler', icon: '📅' },
    { path: '/dashboard/calendar', label: 'Calendar', icon: '📆' },
    { path: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    { path: '/dashboard/achievements', label: 'Achievements', icon: '🏆' },
    { path: '/dashboard/teams', label: 'Teams', icon: '👥' },
    { path: '/dashboard/approvals', label: 'Approvals', icon: '✅' },
    { path: '/dashboard/social', label: 'Social', icon: '🌐' },
    { path: '/dashboard/membership', label: 'Membership', icon: '💎' },
    { path: '/dashboard/templates', label: 'Templates', icon: '📋' },
    { path: '/dashboard/notifications', label: 'Notifications', icon: '🔔' },
    { path: '/dashboard/settings', label: 'Settings', icon: '⚙️' }
  ]

  const isActive = (path: string) => pathname === path

  return (
    <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-purple-600 dark:text-purple-400">Click</h1>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <DarkModeToggle />
        </div>
      </div>

      {/* Mobile Search */}
      <div className="px-4 pb-3">
        <AdvancedSearch />
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 z-50 overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {user && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {user.name || user.email}
                </div>
              )}
            </div>

            <nav className="p-2">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    router.push(item.path)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive(item.path)
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>

            {user && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    logout()
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  )
}





