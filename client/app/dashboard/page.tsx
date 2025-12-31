'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
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

// Lazy load heavy components for better performance
const EnhancedContentSuggestions = lazy(() => import('../../components/EnhancedContentSuggestions'))
const AIRecommendations = lazy(() => import('../../components/AIRecommendations'))
const SmartSuggestions = lazy(() => import('../../components/SmartSuggestions'))
const DailyChallenges = lazy(() => import('../../components/DailyChallenges'))
const QuickTemplateAccess = lazy(() => import('../../components/QuickTemplateAccess'))
const AIMultiModelSelector = lazy(() => import('../../components/AIMultiModelSelector'))
const PredictiveAnalytics = lazy(() => import('../../components/PredictiveAnalytics'))

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

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
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  
  // Enable keyboard shortcuts
  useKeyboardShortcuts(defaultShortcuts(router))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const userData = extractApiData<{ user: User }>(response)
      setUser(userData?.user || null)
    } catch (error) {
      localStorage.removeItem('token')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={6} />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
      <SubscriptionBanner />
      <NextStepsPanel />
      <QuickActions />
      <OnboardingTour />
      <QuickActionsMenu />
      <ToastContainer />
      <div className="container mx-auto px-4 py-8" data-tour="dashboard">
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded ${
                user.subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                user.subscription.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {user.subscription.status.toUpperCase()}
              </span>
              <span className="text-gray-600">Plan: {user.subscription.plan}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Videos Processed"
            value={user.usage.videosProcessed}
            icon="🎬"
          />
          <StatCard
            title="Content Generated"
            value={user.usage.contentGenerated}
            icon="📝"
          />
          <StatCard
            title="Quote Cards"
            value={user.usage.quotesCreated}
            icon="💬"
          />
          <StatCard
            title="Posts Scheduled"
            value={user.usage.postsScheduled}
            icon="📅"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <FeatureCard
            title="Auto Video Clipper"
            description="Upload long videos and get short-form clips"
            link="/dashboard/video"
            icon="🎥"
            dataTour="video-upload"
          />
          <FeatureCard
            title="Content Generator"
            description="Transform text into social media posts"
            link="/dashboard/content"
            icon="✨"
            dataTour="content-generator"
          />
          <FeatureCard
            title="Script Generator"
            description="Generate YouTube, podcast, and blog scripts"
            link="/dashboard/scripts"
            icon="📝"
            dataTour="scripts"
          />
          <FeatureCard
            title="Quote Cards"
            description="Create branded quote graphics"
            link="/dashboard/quotes"
            icon="🎨"
          />
          <FeatureCard
            title="Content Scheduler"
            description="Schedule posts across platforms"
            link="/dashboard/scheduler"
            icon="📆"
          />
          <FeatureCard
            title="Analytics"
            description="View performance insights"
            link="/dashboard/analytics"
            icon="📊"
          />
          <FeatureCard
            title="Workflows"
            description="Automate your content creation process"
            link="/dashboard/workflows"
            icon="🤖"
          />
          <FeatureCard
            title="Niche Packs"
            description="Customize your brand style"
            link="/dashboard/niche"
            icon="🎯"
          />
        </div>

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
              />
              <FeatureCard
                title="Predictive Analytics"
                description="Predict content performance before publishing"
                link="/dashboard/ai"
                icon="📊"
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
            <Suspense fallback={<LoadingSkeleton type="card" count={1} />}>
              <AIMultiModelSelector />
            </Suspense>
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

function FeatureCard({ title, description, link, icon, dataTour }: { title: string; description: string; link: string; icon: string; dataTour?: string }) {
  return (
    <Link href={link}>
      <div 
        className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition cursor-pointer touch-target"
        role="link"
        aria-label={`Navigate to ${title}: ${description}`}
        tabIndex={0}
      >
        <div className="text-3xl md:text-4xl mb-3 md:mb-4" aria-hidden="true">{icon}</div>
        <h3 className="text-lg md:text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm md:text-base text-gray-600">{description}</p>
      </div>
    </Link>
  )
}

