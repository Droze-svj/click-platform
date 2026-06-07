'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Trophy, Zap, Activity, CheckCircle2, Lock,
  Layers, Sparkles, Video, Terminal, Award, Boxes,
  TrendingUp, History, RefreshCw,
} from 'lucide-react'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '../../../lib/utils'
import { Button } from '../../../components/ui/button'
import { StatCard } from '../../../components/ui/stat-card'

import { API_URL } from '../../../lib/api'

interface Achievement {
  _id: string; achievementType: string; unlockedAt: string; metadata?: any;
}

interface EngagementStats {
  achievements: { total: number; recent: Achievement[]; all: Achievement[] };
  streak: { currentStreak: number; longestStreak: number };
  stats: { totalContent: number; totalVideos: number; totalScripts: number };
  level: number;
}

// Honest zero-state shown when the user has no engagement data (or the
// stats endpoint is unavailable). No fabricated totals/streaks/levels.
const EMPTY_STATS: EngagementStats = {
  achievements: { total: 0, recent: [], all: [] },
  streak: { currentStreak: 0, longestStreak: 0 },
  stats: { totalContent: 0, totalVideos: 0, totalScripts: 0 },
  level: 0,
}

const allMilestones = [
  { type: 'first_video', name: 'Genesis Rendition', emoji: '🎥', description: 'Deploy your first autonomous video rendition.' },
  { type: 'first_content', name: 'Logic Architect', emoji: '✨', description: 'Initialize your first logic synthesis payload.' },
  { type: 'first_script', name: 'Neural Scripter', emoji: '📝', description: 'Craft your first neural execution script.' },
  { type: 'content_milestone_10', name: 'Logic Cluster 10', emoji: '🎉', description: 'Synthesize 10 logic payloads.' },
  { type: 'content_milestone_50', name: 'Logic Cluster 50', emoji: '🚀', description: 'Synthesize 50 logic payloads.' },
  { type: 'content_milestone_100', name: 'Logic Matrix 100', emoji: '💯', description: 'Synthesize 100 logic payloads.' },
  { type: 'video_milestone_10', name: 'Spectral Decad 10', emoji: '🎬', description: 'Render 10 spectral video streams.' },
  { type: 'video_milestone_50', name: 'Spectral Centurion 50', emoji: '🎥', description: 'Render 50 spectral video streams.' },
  { type: 'streak_7', name: 'Coherence 7', emoji: '🔥', description: 'Maintain neural coherence for 7 cycles.' },
  { type: 'streak_30', name: 'Coherence 30', emoji: '⭐', description: 'Maintain neural coherence for 30 cycles.' },
  { type: 'streak_100', name: 'Resonance Prime 100', emoji: '👑', description: 'Maintain neural coherence for 100 cycles.' },
  { type: 'workflow_master', name: 'Orchestration Prime', emoji: '🤖', description: 'Initialize 5+ autonomous orchestration matrices.' },
  { type: 'social_media_pro', name: 'Presence Flux Pro', emoji: '📱', description: 'Distribute to 5+ resonance nodes.' },
  { type: 'content_creator', name: 'Logic Synthesis Master', emoji: '🎨', description: 'Achieve peak logic synthesis fidelity.' },
  { type: 'early_adopter', name: 'Protocol Pioneer', emoji: '🌟', description: 'Integrated during genesis phase.' },
  { type: 'power_user', name: 'High-Fidelity Operative', emoji: '⚡', description: 'Operate at peak neural capacity.' }
]

export default function AscensionLedgerPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [stats, setStats] = useState<EngagementStats | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMilestoneData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/engagement/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success && response.data.data) {
        setStats(response.data.data)
      } else {
        // Honest zero-state when the user has no engagement data yet —
        // never show fabricated totals/streaks/levels.
        setStats(EMPTY_STATS)
      }
    } catch {
      // On failure, fall back to an honest zero-state rather than fake numbers.
      setStats(EMPTY_STATS)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user && !loading) {
      router.push('/login')
      return
    }
    loadMilestoneData()
  }, [user, router, loadMilestoneData, loading])

  if (loading) return (
     <div className="flex flex-col items-center justify-center py-48 ds-bg-mesh-soft min-h-screen">
        <Trophy size={40} className="text-primary animate-pulse mb-4" />
        <span className="ds-text-caption">{t('achievementsPage.loading')}</span>
     </div>
  )

  const decryptedTypes = new Set(stats?.achievements.all.map(a => a.achievementType) || [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen ds-bg-mesh-soft text-theme-primary px-4 sm:px-8 pt-8 pb-24 max-w-[1500px] mx-auto space-y-8">
        <ToastContainer />

        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 inline-flex items-center justify-center text-primary">
              <Trophy size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="ds-text-h1 text-theme-primary leading-none">{t('achievementsPage.title')}</h1>
              <p className="ds-text-caption mt-1">{t('achievementsPage.subtitle')}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={loadMilestoneData}
            leftIcon={<RefreshCw size={16} />}>
            {t('achievementsPage.refreshRegistry')}
          </Button>
        </header>

        {/* Stats */}
        {stats && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Layers} label={t('achievementsPage.statTierLabel')} value={`TIER_${stats.level}`} />
            <StatCard icon={Award} label={t('achievementsPage.statMilestonesLabel')} value={stats.achievements.total} />
            <StatCard icon={Zap} label={t('achievementsPage.statStreakLabel')} value={stats.streak.currentStreak} />
            <StatCard icon={TrendingUp} label={t('achievementsPage.statVolumeLabel')} value={stats.stats.totalContent} />
          </section>
        )}

        {/* Progression detail */}
        <section className="ds-surface-card p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary inline-flex items-center justify-center"><Activity size={20} /></div>
            <div className="min-w-0">
              <h3 className="ds-text-h3 text-theme-primary">{t('achievementsPage.neuralProgression')}</h3>
              <p className="ds-text-caption mt-0.5">{t('achievementsPage.neuralProgressionDesc')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DetailCard icon={Video} label={t('achievementsPage.detailRenditions')} value={stats?.stats.totalVideos || 0} />
            <DetailCard icon={Sparkles} label={t('achievementsPage.detailPayloads')} value={stats?.stats.totalContent || 0} />
            <DetailCard icon={Terminal} label={t('achievementsPage.detailScripts')} value={stats?.stats.totalScripts || 0} />
          </div>
        </section>

        {/* Recent breakthroughs */}
        {stats && stats.achievements.recent.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <History size={20} className="text-primary" />
              <h3 className="ds-text-h3 text-theme-primary">{t('achievementsPage.recentBreakthroughs')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.achievements.recent.slice(0, 3).map((a) => {
                const data = allMilestones.find(m => m.type === a.achievementType)
                return (
                  <div key={a._id} className="ds-surface-card p-5 flex items-center gap-4">
                    <div className="text-3xl shrink-0" aria-hidden>{data?.emoji || '🏆'}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-theme-primary leading-tight">{data ? t(`achievementsPage.milestones.${data.type}.name`) : a.achievementType}</p>
                      <p className="ds-text-caption mt-1">{t('achievementsPage.decryptedOn', { date: new Date(a.unlockedAt).toLocaleDateString() })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Milestone grid */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes size={20} className="text-primary" />
            <h3 className="ds-text-h3 text-theme-primary">{t('achievementsPage.nodeMatrix')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allMilestones.map((m) => {
              const isDecrypted = decryptedTypes.has(m.type)
              const unlocked = stats?.achievements.all.find(a => a.achievementType === m.type)

              return (
                <div key={m.type}
                  className={cn('ds-surface-card p-5 relative flex flex-col items-center text-center gap-3',
                    !isDecrypted && 'opacity-60')}>
                  {isDecrypted && (
                    <span className="absolute top-3 right-3 text-emerald-500"><CheckCircle2 size={18} /></span>
                  )}
                  <div className={cn('text-4xl', !isDecrypted && 'grayscale')} aria-hidden>{m.emoji}</div>
                  <div className="space-y-1.5">
                    <h4 className={cn('text-sm font-semibold leading-tight', isDecrypted ? 'text-theme-primary' : 'text-theme-secondary')}>{t(`achievementsPage.milestones.${m.type}.name`)}</h4>
                    <p className="ds-text-caption leading-relaxed">{t(`achievementsPage.milestones.${m.type}.description`)}</p>
                  </div>
                  <div className="w-full pt-3 border-t border-[var(--border-subtle)]">
                    {isDecrypted && unlocked ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <p className="ds-text-label text-primary">{t('achievementsPage.decrypted')}</p>
                        <p className="text-xs font-medium text-theme-primary">{new Date(unlocked.unlockedAt).toLocaleDateString()}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Lock size={16} className="text-theme-muted" />
                        <p className="ds-text-caption">{t('achievementsPage.logicGated')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </ErrorBoundary>
  )
}

function DetailCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-input p-5 flex flex-col items-center text-center gap-2">
      <div className="h-10 w-10 rounded-xl bg-accent text-theme-muted inline-flex items-center justify-center"><Icon size={20} /></div>
      <p className="ds-text-caption">{label}</p>
      <p className="ds-text-h2 text-theme-primary tabular-nums">{value.toLocaleString()}</p>
    </div>
  )
}
