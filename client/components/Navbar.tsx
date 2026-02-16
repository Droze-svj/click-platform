'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'
import DarkModeToggle from './DarkModeToggle'
import NotificationBell from './NotificationBell'
import AdvancedSearch from './AdvancedSearch'
import MobileNavbar from './MobileNavbar'
import LanguageSwitcher from './LanguageSwitcher'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t } = useTranslation()

  if (pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null
  }

  const navItems: Array<{ path: string; labelKey: string; icon: string; adminOnly?: boolean }> = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: '🏠' },
    { path: '/dashboard/video', labelKey: 'nav.videos', icon: '🎥' },
    { path: '/dashboard/content', labelKey: 'nav.content', icon: '✨' },
    { path: '/dashboard/ai', labelKey: 'nav.aiFeatures', icon: '🤖' },
    { path: '/dashboard/library', labelKey: 'nav.library', icon: '📚' },
    { path: '/dashboard/scripts', labelKey: 'nav.scripts', icon: '📝' },
    { path: '/dashboard/workflows', labelKey: 'nav.workflows', icon: '⚙️' },
    { path: '/dashboard/jobs', labelKey: 'nav.jobs', icon: '⚡' },
    { path: '/dashboard/teams', labelKey: 'nav.teams', icon: '👥' },
    { path: '/dashboard/approvals', labelKey: 'nav.approvals', icon: '✅' },
    { path: '/dashboard/quotes', labelKey: 'nav.quotes', icon: '💬' },
    { path: '/dashboard/scheduler', labelKey: 'nav.scheduler', icon: '📅' },
    { path: '/dashboard/calendar', labelKey: 'nav.calendar', icon: '📆' },
    { path: '/dashboard/social', labelKey: 'nav.social', icon: '📱' },
    { path: '/dashboard/insights', labelKey: 'nav.insights', icon: '📈' },
    { path: '/dashboard/analytics', labelKey: 'nav.analytics', icon: '📊' },
    { path: '/dashboard/achievements', labelKey: 'nav.achievements', icon: '🏆' },
    { path: '/dashboard/membership', labelKey: 'nav.membership', icon: '💎' },
    { path: '/dashboard/notifications', labelKey: 'nav.notifications', icon: '🔔' },
    { path: '/dashboard/settings', labelKey: 'nav.settings', icon: '⚙️' },
    { path: '/dashboard/infrastructure', labelKey: 'nav.infrastructure', icon: '🖥️', adminOnly: true }
  ]

  return (
    <>
      {/* Mobile Navbar */}
      <div className="lg:hidden">
        <MobileNavbar />
      </div>

      {/* Enhanced Desktop Navbar — single-row auto layout */}
      <nav className="hidden lg:block glass sticky top-0 z-50 border-b border-subtle bg-white/5 dark:bg-black/5 backdrop-blur-xl">
        <div className="container-modern navbar-inner">
          <div className="flex items-center justify-between gap-4 min-h-[4.5rem] flex-wrap lg:flex-nowrap">
            {/* Left: logo + nav */}
            <div className="flex items-center gap-4 xl:gap-6 min-w-0 flex-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 flex-shrink-0 hover:scale-[1.02] transition-transform duration-300"
                aria-label="Click — go to dashboard"
              >
                <span className="text-2xl xl:text-3xl font-black gradient-cosmic drop-shadow-sm">Click</span>
                <span className="hidden xl:inline text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {t('nav.clickTagline')}
                </span>
              </button>
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1 min-w-0">
                {navItems.slice(0, 8).map((item) => {
                  if (item.adminOnly && (!user || (user as any).role !== 'admin' && !(user as any).isAdmin)) return null
                  return (
                    <button
                      key={item.path}
                      onClick={() => router.push(item.path)}
                      className={`group relative px-3 xl:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 touch-target flex-shrink-0 ${pathname === item.path
                        ? 'text-white bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/10'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-lg group-hover:animate-pulse">{item.icon}</span>
                        <span className="hidden xl:inline font-bold">{t(item.labelKey)}</span>
                      </span>
                      {pathname === item.path && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-xl blur-sm animate-pulse-glow" aria-hidden />
                      )}
                    </button>
                  )
                })}
                {navItems.length > 8 && (
                  <button className="flex-shrink-0 group relative px-3 xl:px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 transition-all duration-300">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">⋯</span>
                      <span className="hidden xl:inline">{t('common.more')}</span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: actions + user + logout */}
            <div className="flex items-center gap-2 xl:gap-3 flex-shrink-0">
              {user && (
                <>
                  <LanguageSwitcher />
                  <NotificationBell />
                  <DarkModeToggle />
                  <div className="hidden md:flex items-center gap-3 ml-2 pl-3 xl:ml-4 xl:pl-4 border-l border-subtle">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate max-w-[120px] xl:max-w-[140px]">
                          {user.name}
                        </span>
                        <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-semibold ${user.subscription?.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700'
                          : user.subscription?.status === 'trial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                          }`}>
                          {user.subscription?.status ?? 'free'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <button
                onClick={logout}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 dark:hover:bg-white/5 transition-colors"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}

