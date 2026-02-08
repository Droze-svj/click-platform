'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// Navbar removed - provided by dashboard layout
import { extractApiData } from '../../utils/apiResponse'
import SubscriptionBanner from '../../components/SubscriptionBanner'
import NextStepsPanel from '../../components/NextStepsPanel'
import QuickActions from '../../components/QuickActions'
import OnboardingTour from '../../components/OnboardingTour'
import StreakDisplay from '../../components/StreakDisplay'
import ActivityFeed from '../../components/ActivityFeed'
import AchievementBadge from '../../components/AchievementBadge'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import QuickActionsMenu from '../../components/QuickActionsMenu'
import ToastContainer from '../../components/ToastContainer'
import { useKeyboardShortcuts, defaultShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useEngagement } from '../../hooks/useEngagement'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../hooks/useTranslation'
import DashboardOverview from '../../components/DashboardOverview'

function DynamicFallback() {
  return <LoadingSkeleton type="card" count={1} />
}

const EnhancedContentSuggestions = dynamic(
  () => import('../../components/EnhancedContentSuggestions'),
  { loading: DynamicFallback, ssr: false }
)
const AIRecommendations = dynamic(
  () => import('../../components/AIRecommendations'),
  { loading: DynamicFallback, ssr: false }
)
const SmartSuggestions = dynamic(
  () => import('../../components/SmartSuggestions'),
  { loading: DynamicFallback, ssr: false }
)
const DailyChallenges = dynamic(
  () => import('../../components/DailyChallenges'),
  { loading: DynamicFallback, ssr: false }
)
const QuickTemplateAccess = dynamic(
  () => import('../../components/QuickTemplateAccess'),
  { loading: DynamicFallback, ssr: false }
)
const AIMultiModelSelector = dynamic(
  () => import('../../components/AIMultiModelSelector'),
  { loading: DynamicFallback, ssr: false }
)

interface User {
  id: string
  name: string
  email: string
  subscription: {
    status: string
    plan: string
  }
  usage: {
    videosProcessed: number
    contentGenerated: number
    quotesCreated: number
    postsScheduled: number
  }
}

export default function Dashboard() {
  // Test modern design system classes are available
  useEffect(() => {
    const testElement = document.createElement('div');
    testElement.className = 'card-elevated gradient-cosmic animate-float';
    testElement.style.position = 'absolute';
    testElement.style.left = '-9999px';
    testElement.textContent = 'Design Test';
    document.body.appendChild(testElement);

    setTimeout(() => {
      const computedStyle = window.getComputedStyle(testElement);
      console.log('🎨 Modern Design System Test:', {
        hasCardElevated: computedStyle.backdropFilter !== 'none',
        hasGradient: computedStyle.background.includes('linear-gradient'),
        hasAnimation: computedStyle.animation !== 'none',
        borderRadius: computedStyle.borderRadius,
        boxShadow: computedStyle.boxShadow
      });
      document.body.removeChild(testElement);
    }, 100);
  }, []);

  const router = useRouter()
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  // Enable keyboard shortcuts
  useKeyboardShortcuts(defaultShortcuts(router))

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-full w-full max-w-full overflow-x-hidden bg-gray-50">
        <div className="container-readable py-8">
          <LoadingSkeleton type="card" count={6} />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <ErrorBoundary>
      <div className="min-h-full w-full max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 bg-mesh relative">
        <div className="absolute inset-0 bg-dots"></div>
        <SubscriptionBanner />
        <NextStepsPanel />
        <QuickActions />
        <OnboardingTour />
        <QuickActionsMenu />
        <ToastContainer />

        {/* Enhanced Hero Section with floating elements */}
        <section className="relative overflow-x-hidden overflow-y-visible section-padding section-auto-fit">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>
          <div className="absolute inset-0 bg-noise"></div>

          {/* Floating decorative elements */}
          <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-xl float-element"></div>
          <div className="absolute top-40 right-20 w-32 h-32 bg-gradient-to-br from-pink-400/20 to-orange-400/20 rounded-full blur-xl float-element"></div>
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-full blur-xl float-element"></div>

          <div className="relative container-modern">
            <div className="text-center mb-16 animate-slide-in-up">
              <h1 className="text-hero mb-6 animate-float-subtle">
                <span className="gradient-cosmic">
                  {t('dashboard.heroWelcome')}
                </span>
              </h1>
              <p className="text-readable-lg max-w-3xl mx-auto text-center animate-fade-in-blur">
                {t('dashboard.heroDescription')}
              </p>

              {/* Animated accent line */}
              <div className="mt-8 flex justify-center">
                <div className="w-24 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent rounded-full animate-pulse-glow"></div>
              </div>
            </div>

            {/* Stats Overview with enhanced interactivity */}
            <div className="grid-readable mb-16">
              <div className="card-elevated p-8 text-center animate-scale-in hover-lift group cursor-pointer" style={{ animationDelay: '0.1s' }}>
                <div className="text-display font-bold gradient-text mb-3 group-hover:animate-gentle-bounce transition-all">
                  {user.usage?.videosProcessed ?? 0}
                </div>
                <div className="text-readable-sm font-medium text-secondary-600 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-100 transition-colors">
                  {t('dashboard.stats.videosProcessed')}
                </div>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t('dashboard.clickToView')}
                  </div>
                </div>
              </div>
              <div className="card-elevated p-8 text-center animate-scale-in hover-lift group cursor-pointer" style={{ animationDelay: '0.2s' }}>
                <div className="text-display font-bold gradient-text mb-3 group-hover:animate-gentle-bounce transition-all">
                  {user.usage?.contentGenerated ?? 0}
                </div>
                <div className="text-readable-sm font-medium text-secondary-600 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-100 transition-colors">
                  {t('dashboard.stats.contentCreated')}
                </div>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t('dashboard.clickToView')}
                  </div>
                </div>
              </div>
              <div className="card-elevated p-8 text-center animate-scale-in hover-lift group cursor-pointer" style={{ animationDelay: '0.3s' }}>
                <div className="text-display font-bold gradient-text mb-3 group-hover:animate-gentle-bounce transition-all">
                  {user.usage?.quotesCreated ?? 0}
                </div>
                <div className="text-readable-sm font-medium text-secondary-600 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-100 transition-colors">
                  {t('dashboard.stats.quotesCreated')}
                </div>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t('dashboard.clickToView')}
                  </div>
                </div>
              </div>
              <div className="card-elevated p-8 text-center animate-scale-in hover-lift group cursor-pointer" style={{ animationDelay: '0.4s' }}>
                <div className="text-display font-bold gradient-text mb-3 group-hover:animate-gentle-bounce transition-all">
                  {user.usage?.postsScheduled ?? 0}
                </div>
                <div className="text-readable-sm font-medium text-secondary-600 dark:text-secondary-300 group-hover:text-secondary-800 dark:group-hover:text-secondary-100 transition-colors">
                  {t('dashboard.stats.postsScheduled')}
                </div>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t('dashboard.clickToView')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* New Dashboard Overview */}
        <section className="section-auto-fit py-8 bg-white dark:bg-gray-900">
          <div className="container-readable">
            <DashboardOverview />
          </div>
        </section>

        <div className="container-readable py-8 w-full max-w-full" data-tour="dashboard">
          {/* Subscription Status with enhanced visual polish */}
          <div className="card-elevated p-8 mb-12 animate-slide-in-up hover-lift relative overflow-hidden" style={{ animationDelay: '0.5s' }}>
            {/* Subtle background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-full"></div>

            <div className="flex-readable-column md:flex-readable md:justify-between relative">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-4 text-readable flex items-center">
                  <span className="w-2 h-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mr-3 animate-pulse"></span>
                  Subscription Status
                </h3>
                <div className="flex-readable">
                  <span className={`px-6 py-3 rounded-full text-sm font-semibold shadow-lg ${user.subscription.status === 'active'
                      ? 'status-active text-white'
                      : user.subscription.status === 'trial'
                        ? 'status-trial text-white'
                        : 'status-inactive text-white'
                    }`}>
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-white/80 rounded-full mr-2 animate-pulse"></span>
                      {user.subscription.status.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-readable font-medium flex items-center">
                    <span className="text-primary-600 dark:text-primary-400 mr-2">✨</span>
                    {user.subscription.plan} Plan
                  </span>
                </div>
              </div>
              <div className="text-center md:text-right">
                <div className="text-3xl font-bold gradient-cosmic mb-2 animate-float-subtle">{user.subscription.plan}</div>
                <div className="text-readable-sm text-secondary-600 dark:text-secondary-400">Current Plan</div>

                {/* Progress indicator */}
                <div className="mt-4 w-24 h-2 bg-secondary-200 dark:bg-secondary-700 rounded-full mx-auto md:mx-0">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full progress-bar"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Feature Grid */}
          <section className="grid-staggered mb-16">
            <FeatureCard
              title="Auto Video Clipper"
              description="Upload long videos and get short-form clips with AI-powered editing"
              link="/dashboard/video"
              icon="🎥"
              dataTour="video-upload"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              title="Content Generator"
              description="Transform text into engaging social media posts with AI assistance"
              link="/dashboard/content"
              icon="✨"
              dataTour="content-generator"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              title="Script Generator"
              description="Generate YouTube, podcast, and blog scripts instantly"
              link="/dashboard/scripts"
              icon="📝"
              dataTour="scripts"
              gradient="from-green-500 to-teal-500"
            />
            <FeatureCard
              title="Quote Cards"
              description="Create beautiful branded quote graphics with typography"
              link="/dashboard/quotes"
              icon="🎨"
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              title="Content Scheduler"
              description="Schedule posts across platforms with optimal timing"
              link="/dashboard/scheduler"
              icon="📆"
              gradient="from-indigo-500 to-purple-500"
            />
            <FeatureCard
              title="Analytics"
              description="View performance insights and growth metrics"
              link="/dashboard/analytics"
              icon="📊"
              gradient="from-emerald-500 to-green-500"
            />
            <FeatureCard
              title="Workflows"
              description="Automate your content creation process end-to-end"
              link="/dashboard/workflows"
              icon="🤖"
              gradient="from-violet-500 to-purple-500"
            />
            <FeatureCard
              title="Niche Packs"
              description="Customize your brand style with niche-specific templates"
              link="/dashboard/niche"
              icon="🎯"
              gradient="from-rose-500 to-pink-500"
            />
          </section>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivityFeed limit={5} />
            <EnhancedContentSuggestions />
          </div>

          {/* New Engaging Features */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SmartSuggestions />
            <DailyChallenges />
          </div>

          {/* Quick Access Widgets */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QuickTemplateAccess />
          </div>

          <div className="mt-8">
            <AIRecommendations />
          </div>

          {/* AI Features Section */}
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">🤖 AI Features</h2>
                <Link
                  href="/dashboard/ai"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  View All →
                </Link>
              </div>
              <p className="text-gray-600 mb-4">
                Advanced AI-powered tools to enhance your content creation
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeatureCard
                  title="Multi-Model AI"
                  description="Choose from multiple AI providers and models"
                  link="/dashboard/ai"
                  icon="🧠"
                  gradient="from-blue-500 to-purple-500"
                />
                <FeatureCard
                  title="Predictive Analytics"
                  description="Predict content performance before publishing"
                  link="/dashboard/ai"
                  icon="📊"
                  gradient="from-green-500 to-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Quick AI Tools */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-lg shadow p-6 transition-shadow hover:shadow-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🧠</span>
                AI Model Selector
              </h3>
              <AIMultiModelSelector />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  )
}

function FeatureCard({ title, description, link, icon, dataTour, gradient }: {
  title: string;
  description: string;
  link: string;
  icon: string;
  dataTour?: string;
  gradient: string;
}) {
  const dbg = (message: string, data: Record<string, any>) => {
  }

  return (
    <Link
      href={link}
      onClick={() => {
      }}
    >
      <div
        className="card-elevated group touch-target animate-scale-in hover-lift hover-glow interactive-press relative overflow-hidden"
        role="link"
        aria-label={`Navigate to ${title}: ${description}`}
        tabIndex={0}
        data-tour={dataTour}
      >
        {/* Subtle background effect */}
        <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300 from-current to-transparent"></div>

        <div className="relative p-8">
          {/* Enhanced Icon with gradient background */}
          <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white mb-6 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl transition-all duration-300 shadow-lg relative`}>
            <span className="text-3xl animate-float-subtle" aria-hidden="true">{icon}</span>
            {/* Subtle glow effect */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300`}></div>
          </div>

          {/* Enhanced Title and Description */}
          <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors duration-300">
            {title}
          </h3>
          <p className="text-body-enhanced mb-6 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors duration-300">
            {description}
          </p>

          {/* Enhanced Hover indicator with better animation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm font-semibold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 animate-slide-in-stagger">
              <span className="relative">
                Explore feature
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-current group-hover:w-full transition-all duration-300"></span>
              </span>
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 opacity-0 group-hover:opacity-100 transition-all duration-300 animate-scale-in group-hover:animate-gentle-bounce"></div>
          </div>

          {/* Subtle progress indicator */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
        </div>
      </div>
    </Link>
  )
}

