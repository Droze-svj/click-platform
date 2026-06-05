'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Achievement {
  _id: string
  achievementType: string
  unlockedAt: string
  metadata?: any
}

export default function AchievementBadge({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false)
      setTimeout(onClose, 300)
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const getAchievementEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      'first_video': '🎥',
      'first_content': '✨',
      'first_script': '📝',
      'content_milestone_10': '🎉',
      'content_milestone_50': '🚀',
      'content_milestone_100': '💯',
      'video_milestone_10': '🎬',
      'video_milestone_50': '🎥',
      'streak_7': '🔥',
      'streak_30': '⭐',
      'streak_100': '👑',
      'workflow_master': '🤖',
      'social_media_pro': '📱',
      'content_creator': '🎨',
      'early_adopter': '🌟',
      'power_user': '⚡'
    }
    return emojis[type] || '🏆'
  }

  const getAchievementTitle = (type: string) => {
    const titles: Record<string, string> = {
      'first_video': t('achievementBadge.firstVideo'),
      'first_content': t('achievementBadge.firstContent'),
      'first_script': t('achievementBadge.firstScript'),
      'content_milestone_10': t('achievementBadge.contentMilestone10'),
      'content_milestone_50': t('achievementBadge.contentMilestone50'),
      'content_milestone_100': t('achievementBadge.contentMilestone100'),
      'video_milestone_10': t('achievementBadge.videoMilestone10'),
      'video_milestone_50': t('achievementBadge.videoMilestone50'),
      'streak_7': t('achievementBadge.streak7'),
      'streak_30': t('achievementBadge.streak30'),
      'streak_100': t('achievementBadge.streak100'),
      'workflow_master': t('achievementBadge.workflowMaster'),
      'social_media_pro': t('achievementBadge.socialMediaPro'),
      'content_creator': t('achievementBadge.contentCreator'),
      'early_adopter': t('achievementBadge.earlyAdopter'),
      'power_user': t('achievementBadge.powerUser')
    }
    return titles[type] || t('achievementBadge.achievementUnlocked')
  }

  if (!show) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-2xl p-6 text-white max-w-sm">
        <div className="flex items-center gap-4">
          <div className="text-6xl animate-bounce">
            {getAchievementEmoji(achievement.achievementType)}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-1">
              {getAchievementTitle(achievement.achievementType)}
            </h3>
            <p className="text-sm opacity-90">{t('achievementBadge.achievementUnlocked')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShow(false)
              onClose()
            }}
            className="text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}







