'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import DarkModeToggle from './DarkModeToggle'
import NotificationBell from './NotificationBell'
import AdvancedSearch from './AdvancedSearch'
import MobileNavbar from './MobileNavbar'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()

  if (pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null
  }

  const navItems: Array<{ path: string; label: string; icon: string; adminOnly?: boolean }> = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/dashboard/video', label: 'Videos', icon: '🎥' },
    { path: '/dashboard/content', label: 'Content', icon: '✨' },
    { path: '/dashboard/ai', label: 'AI Features', icon: '🤖' },
    { path: '/dashboard/library', label: 'Library', icon: '📚' },
    { path: '/dashboard/scripts', label: 'Scripts', icon: '📝' },
    { path: '/dashboard/workflows', label: 'Workflows', icon: '⚙️' },
    { path: '/dashboard/jobs', label: 'Jobs', icon: '⚡' },
    { path: '/dashboard/teams', label: 'Teams', icon: '👥' },
    { path: '/dashboard/approvals', label: 'Approvals', icon: '✅' },
    { path: '/dashboard/quotes', label: 'Quotes', icon: '💬' },
    { path: '/dashboard/scheduler', label: 'Scheduler', icon: '📅' },
    { path: '/dashboard/calendar', label: 'Calendar', icon: '📆' },
    { path: '/dashboard/social', label: 'Social', icon: '📱' },
    { path: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    { path: '/dashboard/achievements', label: 'Achievements', icon: '🏆' },
    { path: '/dashboard/membership', label: 'Membership', icon: '💎' },
    { path: '/dashboard/notifications', label: 'Notifications', icon: '🔔' },
    { path: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
    { path: '/dashboard/infrastructure', label: 'Infrastructure', icon: '🖥️', adminOnly: true }
  ]

  return (
    <>
      {/* Mobile Navbar */}
      <div className="lg:hidden">
        <MobileNavbar />
      </div>

      {/* Desktop Navbar */}
      <nav className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-2xl font-bold text-purple-600 dark:text-purple-400"
              >
                Click
              </button>
              <div className="flex gap-4">
              {navItems.map((item) => {
                // Skip admin-only items for non-admin users
                if (item.adminOnly && (!user || (user as any).role !== 'admin' && !(user as any).isAdmin)) {
                  return null;
                }
                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      pathname === item.path
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <LanguageSwitcher />
                <NotificationBell />
                <DarkModeToggle />
                <div className="hidden sm:block text-sm text-gray-600">
                  <span className="font-semibold">{user.name}</span>
                  <span className="mx-2">•</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.subscription.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {user.subscription.status}
                  </span>
                </div>
              </>
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
    </>
  )
}

