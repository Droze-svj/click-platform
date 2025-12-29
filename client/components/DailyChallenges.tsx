'use client'

import { useState, useEffect } from 'react'
import { Trophy, Target, CheckCircle2, Circle, Flame } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Challenge {
  id: string
  title: string
  description: string
  type: 'content' | 'video' | 'engagement' | 'streak'
  target: number
  current: number
  reward: string
  completed: boolean
  expiresAt: string
}

export default function DailyChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchChallenges()
  }, [])

  const fetchChallenges = async () => {
    try {
      const response = await fetch('/api/engagement/challenges', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setChallenges(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChallengeClick = (challenge: Challenge) => {
    if (challenge.completed) return

    // Navigate to relevant page based on challenge type
    switch (challenge.type) {
      case 'content':
        router.push('/dashboard/content')
        break
      case 'video':
        router.push('/dashboard/video')
        break
      case 'engagement':
        router.push('/dashboard/analytics')
        break
      default:
        router.push('/dashboard')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (challenges.length === 0) {
    return null
  }

  const activeChallenges = challenges.filter(c => !c.completed)
  const completedCount = challenges.filter(c => c.completed).length

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg shadow-lg p-6 border border-orange-200 dark:border-orange-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Daily Challenges
          </h3>
        </div>
        {completedCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
            <Flame className="w-4 h-4" />
            <span>{completedCount}/{challenges.length} completed</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {activeChallenges.slice(0, 3).map((challenge) => {
          const progress = (challenge.current / challenge.target) * 100
          const isNearComplete = progress >= 80

          return (
            <button
              key={challenge.id}
              onClick={() => handleChallengeClick(challenge)}
              className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 group"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`p-2 rounded-lg ${
                  isNearComplete
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                }`}>
                  <Target className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {challenge.title}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {challenge.description}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{challenge.current} / {challenge.target}</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isNearComplete
                            ? 'bg-green-500'
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      🎁 {challenge.reward}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {completedCount > 0 && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">
              {completedCount} challenge{completedCount !== 1 ? 's' : ''} completed today! 🎉
            </span>
          </div>
        </div>
      )}

      {activeChallenges.length > 3 && (
        <button
          onClick={() => router.push('/dashboard/achievements')}
          className="mt-4 w-full text-center text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium"
        >
          View all challenges →
        </button>
      )}
    </div>
  )
}






