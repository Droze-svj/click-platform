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
      // Skip API calls in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Achievements] Skipping engagement stats API call in development mode')

        // Provide mock data for development
        const mockStats: EngagementStats = {
          achievements: {
            total: 3,
            recent: [
              {
                _id: 'mock-achievement-1',
                achievementType: 'first_video',
                unlockedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                metadata: { videoId: 'mock-video-1' }
              },
              {
                _id: 'mock-achievement-2',
                achievementType: 'first_content',
                unlockedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
                metadata: { contentId: 'mock-content-1' }
              },
              {
                _id: 'mock-achievement-3',
                achievementType: 'content_milestone_10',
                unlockedAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
                metadata: { count: 10 }
              }
            ],
            all: [
              {
                _id: 'mock-achievement-1',
                achievementType: 'first_video',
                unlockedAt: new Date(Date.now() - 86400000).toISOString(),
                metadata: { videoId: 'mock-video-1' }
              },
              {
                _id: 'mock-achievement-2',
                achievementType: 'first_content',
                unlockedAt: new Date(Date.now() - 172800000).toISOString(),
                metadata: { contentId: 'mock-content-1' }
              },
              {
                _id: 'mock-achievement-3',
                achievementType: 'content_milestone_10',
                unlockedAt: new Date(Date.now() - 259200000).toISOString(),
                metadata: { count: 10 }
              }
            ]
          },
          streak: {
            currentStreak: 5,
            longestStreak: 12
          },
          stats: {
            totalContent: 25,
            totalVideos: 8,
            totalScripts: 15
          },
          level: 3
        }

        setStats(mockStats)
        setLoading(false)
        return
      }

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Achievements & Progress
              </h1>
              <p className="text-gray-600 mt-1">Track your journey and unlock amazing achievements</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">L</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Level</p>
                  <p className="text-2xl font-bold text-purple-600">Level {stats.level}</p>
                </div>
              </div>
              <div className="w-full bg-purple-100 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(stats.level % 10) * 10}%` }}></div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white">🏆</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Achievements</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.achievements.total}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Keep creating to unlock more!</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-orange-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <span className="text-white">🔥</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Current Streak</p>
                  <p className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                    {stats.streak.currentStreak}
                    {stats.streak.currentStreak > 0 && <span>🔥</span>}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Longest: {stats.streak.longestStreak} days</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-green-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white">📊</span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Content</p>
                  <p className="text-2xl font-bold text-green-600">{stats.stats.totalContent}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Across all platforms</p>
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Progress Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🎬</span>
              </div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Videos Created</p>
              <p className="text-3xl font-bold text-red-600">{stats?.stats.totalVideos || 0}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✨</span>
              </div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Content Pieces</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.stats.totalContent || 0}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📝</span>
              </div>
              <p className="text-sm text-gray-600 mb-1 font-medium">Scripts Written</p>
              <p className="text-3xl font-bold text-purple-600">{stats?.stats.totalScripts || 0}</p>
            </div>
          </div>
        </div>

        {/* Recent Achievements */}
        {stats && stats.achievements.recent.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-yellow-100">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              Recent Achievements
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.achievements.recent.slice(0, 3).map((achievement) => {
                const achievementData = allAchievements.find(a => a.type === achievement.achievementType)
                return (
                  <div key={achievement._id} className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{achievementData?.emoji || '🏆'}</span>
                      <div>
                        <p className="font-semibold text-gray-800">{achievementData?.name || achievement.achievementType}</p>
                        <p className="text-xs text-gray-600">Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All Achievements */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            All Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allAchievements.map((achievement) => {
              const isUnlocked = unlockedTypes.has(achievement.type)
              const unlockedAchievement = stats?.achievements.all.find(
                a => a.achievementType === achievement.type
              )

              return (
                <div
                  key={achievement.type}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                    isUnlocked
                      ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-blue-50 shadow-sm'
                      : 'border-gray-200 bg-gray-50 opacity-75 hover:opacity-90'
                  }`}
                >
                  {isUnlocked && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl">{achievement.emoji}</span>
                    <div className="flex-1">
                      <p className={`font-semibold ${isUnlocked ? 'text-purple-800' : 'text-gray-600'}`}>
                        {achievement.name}
                      </p>
                      <p className="text-xs text-gray-600 leading-tight mt-1">
                        {achievement.description}
                      </p>
                    </div>
                  </div>

                  {isUnlocked && unlockedAchievement && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-xs text-purple-600 font-medium">
                        Unlocked {new Date(unlockedAchievement.unlockedAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {!isUnlocked && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">🔒 Locked - Keep creating!</p>
                    </div>
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







