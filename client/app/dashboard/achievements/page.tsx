'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Achievement {
  _id: string
  achievementType: string
  unlockedAt: string
  metadata?: any
}

interface EngagementStats {
  achievements: {
    total: number
    recent: Achievement[]
    all: Achievement[]
  }
  streak: {
    currentStreak: number
    longestStreak: number
  }
  stats: {
    totalContent: number
    totalVideos: number
    totalScripts: number
  }
  level: number
}

const allAchievements = [
  { type: 'first_video', name: 'First Video', emoji: '🎥', description: 'Upload your first video' },
  { type: 'first_content', name: 'Content Creator', emoji: '✨', description: 'Generate your first content' },
  { type: 'first_script', name: 'Script Writer', emoji: '📝', description: 'Create your first script' },
  { type: 'content_milestone_10', name: '10 Content Pieces', emoji: '🎉', description: 'Create 10 pieces of content' },
  { type: 'content_milestone_50', name: '50 Content Pieces', emoji: '🚀', description: 'Create 50 pieces of content' },
  { type: 'content_milestone_100', name: '100 Content Pieces', emoji: '💯', description: 'Create 100 pieces of content' },
  { type: 'video_milestone_10', name: '10 Videos', emoji: '🎬', description: 'Upload 10 videos' },
  { type: 'video_milestone_50', name: '50 Videos', emoji: '🎥', description: 'Upload 50 videos' },
  { type: 'streak_7', name: '7 Day Streak', emoji: '🔥', description: 'Be active for 7 days straight' },
  { type: 'streak_30', name: '30 Day Streak', emoji: '⭐', description: 'Be active for 30 days straight' },
  { type: 'streak_100', name: '100 Day Streak', emoji: '👑', description: 'Be active for 100 days straight' },
  { type: 'workflow_master', name: 'Workflow Master', emoji: '🤖', description: 'Create 5+ workflows' },
  { type: 'social_media_pro', name: 'Social Media Pro', emoji: '📱', description: 'Post to 5+ platforms' },
  { type: 'content_creator', name: 'Content Creator', emoji: '🎨', description: 'Become a true content creator' },
  { type: 'early_adopter', name: 'Early Adopter', emoji: '🌟', description: 'Join early' },
  { type: 'power_user', name: 'Power User', emoji: '⚡', description: 'Become a power user' }
]

export default function AchievementsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<EngagementStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadStats()
  }, [user, router])

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/engagement/stats`, {
      })
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load stats', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading achievements..." />
      </div>
    )
  }

  const unlockedTypes = new Set(stats?.achievements.all.map(a => a.achievementType) || [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Achievements & Progress</h1>
          <p className="text-gray-600">Track your progress and unlock achievements</p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Level</p>
              <p className="text-3xl font-bold mt-2">Level {stats.level}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Achievements</p>
              <p className="text-3xl font-bold mt-2">{stats.achievements.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Current Streak</p>
              <p className="text-3xl font-bold mt-2 flex items-center gap-2">
                {stats.streak.currentStreak} {stats.streak.currentStreak > 0 ? '🔥' : ''}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-600">Total Content</p>
              <p className="text-3xl font-bold mt-2">{stats.stats.totalContent}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Progress Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Videos</p>
              <p className="text-2xl font-bold">{stats?.stats.totalVideos || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Content Pieces</p>
              <p className="text-2xl font-bold">{stats?.stats.totalContent || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Scripts</p>
              <p className="text-2xl font-bold">{stats?.stats.totalScripts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Achievements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAchievements.map((achievement) => {
              const isUnlocked = unlockedTypes.has(achievement.type)
              const unlockedAchievement = stats?.achievements.all.find(
                a => a.achievementType === achievement.type
              )

              return (
                <div
                  key={achievement.type}
                  className={`p-4 rounded-lg border-2 ${
                    isUnlocked
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{achievement.emoji}</span>
                    <div>
                      <p className="font-semibold">{achievement.name}</p>
                      <p className="text-xs text-gray-600">{achievement.description}</p>
                    </div>
                  </div>
                  {isUnlocked && unlockedAchievement && (
                    <p className="text-xs text-purple-600 mt-2">
                      Unlocked {new Date(unlockedAchievement.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                  {!isUnlocked && (
                    <p className="text-xs text-gray-500 mt-2">Locked</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}







