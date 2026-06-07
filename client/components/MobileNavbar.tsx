'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, Video, Sparkles, BookOpen, FileText, Workflow,
  Zap, FolderKanban, Quote, CalendarDays, Repeat, CalendarRange, BarChart3,
  Trophy, Users, CheckSquare, Globe, TrendingUp, Gem, LayoutTemplate, Bell,
  Settings, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import { cn } from '../lib/utils'
import DarkModeToggle from './DarkModeToggle'
import NotificationBell from './NotificationBell'
import AdvancedSearch from './AdvancedSearch'

export default function MobileNavbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  if (pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null
  }

  const navItems: Array<{ path: string; labelKey: string; icon: LucideIcon }> = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { path: '/dashboard/video', labelKey: 'nav.videos', icon: Video },
    { path: '/dashboard/content', labelKey: 'nav.content', icon: Sparkles },
    { path: '/dashboard/library', labelKey: 'nav.library', icon: BookOpen },
    { path: '/dashboard/scripts', labelKey: 'nav.scripts', icon: FileText },
    { path: '/dashboard/workflows', labelKey: 'nav.workflows', icon: Workflow },
    { path: '/dashboard/jobs', labelKey: 'nav.jobs', icon: Zap },
    { path: '/dashboard/projects', labelKey: 'nav.projects', icon: FolderKanban },
    { path: '/dashboard/quotes', labelKey: 'nav.quotes', icon: Quote },
    { path: '/dashboard/scheduler', labelKey: 'nav.scheduler', icon: CalendarDays },
    { path: '/dashboard/recurring', labelKey: 'nav.recurring', icon: Repeat },
    { path: '/dashboard/calendar', labelKey: 'nav.calendar', icon: CalendarRange },
    { path: '/dashboard/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
    { path: '/dashboard/achievements', labelKey: 'nav.achievements', icon: Trophy },
    { path: '/dashboard/teams', labelKey: 'nav.teams', icon: Users },
    { path: '/dashboard/approvals', labelKey: 'nav.approvals', icon: CheckSquare },
    { path: '/dashboard/social', labelKey: 'nav.social', icon: Globe },
    { path: '/dashboard/insights', labelKey: 'nav.insights', icon: TrendingUp },
    { path: '/dashboard/membership', labelKey: 'nav.membership', icon: Gem },
    { path: '/dashboard/templates', labelKey: 'nav.templates', icon: LayoutTemplate },
    { path: '/dashboard/notifications', labelKey: 'nav.notifications', icon: Bell },
    { path: '/dashboard/settings', labelKey: 'nav.settings', icon: Settings }
  ]

  const isActive = (path: string) => pathname === path

  return (
    <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 pt-[env(safe-area-inset-top)]">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(!isOpen)
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent hover:opacity-90 transition-opacity"
            aria-label="Click — go to dashboard"
          >
            Click
          </button>
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
            data-agent-overlay="mobile-navbar-backdrop"
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setIsOpen(false)
            }}
          />
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 z-50 overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('common.menu')}</h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close Menu"
                  aria-label="Close Menu"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              {user && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {user.name || user.email}
                </div>
              )}
            </div>

            <nav className="p-2">
              {navItems.map((item) => {
                const label = t(item.labelKey)
                const active = isActive(item.path)
                const ItemIcon = item.icon
                return (
                  <button
                    type="button"
                    key={item.path}
                    title={label}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      router.push(item.path)
                      setIsOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors',
                      active
                        ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20'
                        : 'text-gray-700 dark:text-gray-300 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <ItemIcon size={20} className="flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium">{label}</span>
                  </button>
                )
              })}
            </nav>

            {user && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    setIsOpen(false)
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {t('common.logout')}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  )
}





