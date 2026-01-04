'use client'

import { useEffect } from 'react'
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

  // Test modern navbar styling
  useEffect(() => {
    console.log('🧭 Navbar Test:', {
      currentPath: pathname,
      hasUser: !!user,
      userName: user?.name
    });

    setTimeout(() => {
      const navElement = document.querySelector('[class*="glass"]');
      if (navElement) {
        const computedStyle = window.getComputedStyle(navElement);
        console.log('🎨 Navbar Styles Test:', {
          hasGlassmorphism: computedStyle.backdropFilter !== 'none',
          hasBackdropBlur: computedStyle.backdropFilter.includes('blur'),
          hasGradientText: document.querySelector('.gradient-cosmic') !== null,
          background: computedStyle.background,
          boxShadow: computedStyle.boxShadow
        });
      }
    }, 500);
  }, [pathname, user]);

  const dbg = (message: string, data: Record<string, any>) => {
  }

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

      {/* Enhanced Desktop Navbar */}
      <nav className="hidden lg:block glass sticky top-0 z-50 border-b border-white/20 dark:border-white/10 bg-white/5 dark:bg-black/5 backdrop-blur-xl">
        <div className="container-modern">
          <div className="flex items-center justify-between h-18">
            <div className="flex items-center gap-10">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-3xl font-black gradient-cosmic hover:scale-105 transition-all duration-300 drop-shadow-sm"
              >
                Click
              </button>
              <div className="flex gap-1">
              {navItems.slice(0, 8).map((item) => {
                // Skip admin-only items for non-admin users
                if (item.adminOnly && (!user || (user as any).role !== 'admin' && !(user as any).isAdmin)) {
                  return null;
                }
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      router.push(item.path)
                    }}
                    className={`group relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 touch-target ${
                      pathname === item.path
                        ? 'text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-xl scale-105'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 hover:scale-105'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl group-hover:animate-pulse">{item.icon}</span>
                      <span className="hidden xl:inline font-bold">{item.label}</span>
                    </span>

                    {/* Active glow effect */}
                    {pathname === item.path && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-xl blur-sm animate-pulse-glow"></div>
                    )}

                    {/* Hover glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm"></div>
                  </button>
                );
              })}
              {/* More menu for remaining items */}
              {navItems.length > 8 && (
                <div className="relative">
                  <button className="group relative px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 hover:scale-105">
                    <span className="flex items-center gap-2">
                      <span className="text-xl">⋯</span>
                      <span className="hidden xl:inline">More</span>
                    </span>
                  </button>
                  {/* Dropdown menu would go here */}
                </div>
              )}
            </div>
          </div>
            <div className="flex items-center gap-3">
              {user && (
                <>
                  <LanguageSwitcher />
                  <NotificationBell />
                  <DarkModeToggle />

                  {/* Enhanced User Info */}
                  <div className="hidden sm:flex items-center gap-4 ml-6 pl-6 border-l border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                          {user.name}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          user.subscription.status === 'active'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : user.subscription.status === 'trial'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {user.subscription.status}
                        </span>
                      </div>
                    </div>
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

