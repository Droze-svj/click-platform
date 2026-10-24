'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
} from 'lucide-react'
import { apiGet } from '../../../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns'
import { Panel, Badge, IconButton, SectionHeader } from '../../ui'
import { cn } from '../../../lib/utils'
import { weekdayShortNames } from '../../../utils/locale'
import { useTranslation } from '../../../hooks/useTranslation'

interface SchedulingViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

interface ScheduledPost {
  id: string
  date: Date
  platform: string
  title: string
  status: string
  time: string
}

/**
 * Month calendar of the creator's real scheduled posts (GET /api/scheduler,
 * the same feed the Scheduler page uses). Posts are created from the
 * Distribution tab or the Scheduler page.
 *
 * It used to render an always-empty calendar plus a composer whose inputs went
 * nowhere, hard-coded tags, and "New Blast" / "Optimize" / "Commence Broadcast"
 * buttons that only opened a timed animation — all removed.
 */
const SchedulingView: React.FC<SchedulingViewProps> = ({ showToast }) => {
  const { t } = useTranslation()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Latest t/showToast without making them fetch dependencies (a new function
  // identity must not trigger a refetch).
  const tRef = useRef(t)
  tRef.current = t
  const toastRef = useRef(showToast)
  toastRef.current = showToast

  const fetchScheduledPosts = useCallback(async (month: Date) => {
    try {
      setIsLoading(true)
      const startDate = startOfMonth(month).toISOString()
      const endDate = endOfMonth(month).toISOString()
      const res = await apiGet<any>(
        `/scheduler?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      )
      const rows: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setScheduledPosts(
        rows
          .filter(p => p && p.scheduledTime)
          .map(p => {
            const date = new Date(p.scheduledTime)
            const text = String(p.content?.text || '').trim()
            return {
              id: String(p._id || p.id),
              date,
              platform: String(p.platform || ''),
              title: text || tRef.current('schedulingView.untitledPost'),
              status: String(p.status || ''),
              time: format(date, 'p'),
            }
          })
          .filter(p => !Number.isNaN(p.date.getTime()))
      )
    } catch (error) {
      console.error('Failed to fetch schedule', error)
      setScheduledPosts([])
      toastRef.current(tRef.current('schedulingView.loadFailed'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScheduledPosts(currentMonth)
  }, [currentMonth, fetchScheduledPosts])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  return (
    <div className="flex h-full flex-col gap-6 pb-6 ds-anim-fade-in">
      {/* Header */}
      <SectionHeader
        as="h1"
        title={t('schedulingView.title')}
        description={t('schedulingView.description')}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Panel variant="subtle" className="flex items-center gap-1 p-1">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Previous month"
                title="Previous month"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </IconButton>
              <span className="ds-text-label min-w-[140px] text-center text-theme-primary">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Next month"
                title="Next month"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </IconButton>
            </Panel>
            <a
              href="/dashboard/scheduler"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <CalendarIcon className="h-4 w-4" aria-hidden />
              {t('schedulingView.openScheduler')}
            </a>
          </div>
        }
      />

      {/* Calendar */}
      <Panel variant="glass" className="relative flex flex-1 flex-col overflow-hidden">
        {isLoading && (
          <div className="absolute right-4 top-4 flex items-center gap-2 text-theme-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="ds-text-caption">{t('schedulingView.loading')}</span>
          </div>
        )}
        <div className="mb-4 grid grid-cols-7 gap-3">
          {weekdayShortNames().map(d => (
            <div key={d} className="ds-text-caption text-center">{d}</div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 gap-2 overflow-y-auto pr-1">
          {days.map((day, i) => {
            const dayPosts = scheduledPosts.filter(p => format(p.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            const isTodayActive = isToday(day)

            return (
              <div
                key={i}
                className={cn(
                  'relative min-h-[120px] rounded-xl border p-3 transition-colors',
                  isTodayActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-background/30'
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn('text-sm font-semibold', isTodayActive ? 'text-primary' : 'text-theme-muted')}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </div>

                <div className="space-y-2">
                  {dayPosts.map(post => (
                    <div
                      key={post.id}
                      className="rounded-lg border border-border bg-background/40 p-2"
                    >
                      <div className="min-w-0 space-y-1">
                        <h4 className="ds-text-label truncate text-theme-primary" title={post.title}>{post.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-theme-muted">
                          <span className="flex items-center gap-1 ds-text-caption capitalize"><Globe className="h-3 w-3" aria-hidden /> {post.platform}</span>
                          <span className="flex items-center gap-1 ds-text-caption"><Clock className="h-3 w-3" aria-hidden /> {post.time}</span>
                        </div>
                        {post.status && (
                          <Badge variant="secondary" className="capitalize">{post.status.replace(/_/g, ' ')}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isTodayActive && (
                  <span className="ds-text-caption absolute inset-x-0 bottom-3 text-center text-primary">{t('schedulingView.today')}</span>
                )}
              </div>
            )
          })}
        </div>

        {!isLoading && scheduledPosts.length === 0 && (
          <p className="ds-text-caption mt-4 text-center text-theme-muted">{t('schedulingView.empty')}</p>
        )}
      </Panel>
    </div>
  )
}

export default SchedulingView
