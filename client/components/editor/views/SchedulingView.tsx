'use client'

import React, { useState, useEffect } from 'react'
import {
  Calendar as CalendarIcon,
  Clock,
  Share2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Globe,
  Target,
  Radio,
} from 'lucide-react'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiGet } from '../../../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns'
import { Panel, Button, Badge, IconButton, SectionHeader, FormField, Input, Textarea } from '../../ui'
import { cn } from '../../../lib/utils'

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

const SchedulingView: React.FC<SchedulingViewProps> = ({ showToast }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const fetchScheduledPosts = async () => {
    try {
      setIsLoading(true)
      // Verifies connected social accounts. A real scheduled-posts feed is not
      // yet wired, so we render an honest empty calendar rather than mock posts.
      await apiGet('/oauth/accounts')
      setScheduledPosts([])
    } catch (error) {
      console.error('Failed to fetch schedule', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchScheduledPosts()
  }, [currentMonth])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  return (
    <div className="flex h-full flex-col gap-6 pb-6 ds-anim-fade-in">
      {/* Header */}
      <SectionHeader
        as="h1"
        title="Scheduling"
        description="Plan and coordinate your distribution calendar."
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
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => {
                setSwarmHUDTask('Initialize New Mission')
                setShowSwarmHUD(true)
              }}
              title="Create new blast"
            >
              New Blast
            </Button>
          </div>
        }
      />

      {/* Calendar matrix */}
      <Panel variant="glass" className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 grid grid-cols-7 gap-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="ds-text-caption text-center">{d}</div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 gap-2 overflow-y-auto pr-1">
          {days.map((day, i) => {
            const dayPosts = scheduledPosts.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            const isTodayActive = isToday(day)

            return (
              <div
                key={i}
                className={cn(
                  'group relative min-h-[120px] rounded-xl border p-3 transition-colors',
                  isTodayActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-background/30 hover:border-border/80'
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
                      className="cursor-pointer rounded-lg border border-border bg-background/40 p-2 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="ds-text-label truncate text-theme-primary">{post.title}</h4>
                          <div className="flex items-center gap-3 text-theme-muted">
                            <span className="flex items-center gap-1 ds-text-caption"><Globe className="h-3 w-3" aria-hidden /> {post.platform}</span>
                            <span className="flex items-center gap-1 ds-text-caption"><Clock className="h-3 w-3" aria-hidden /> {post.time}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSwarmHUDTask(`Optimizing: ${post.title}`)
                              setShowSwarmHUD(true)
                            }}
                            title="Optimize post"
                          >
                            Optimize
                          </Button>
                          <IconButton variant="ghost" size="sm" title="Share post" aria-label="Share post">
                            <Share2 className="h-4 w-4" aria-hidden />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dayPosts.length === 0 && (
                    <div className="flex h-16 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus className="h-5 w-5 text-theme-muted" aria-hidden />
                    </div>
                  )}
                </div>

                {isTodayActive && (
                  <span className="ds-text-caption absolute inset-x-0 bottom-3 text-center text-primary">Today</span>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Social push metadata composer */}
      <Panel variant="glass">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <Target className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="ds-text-h3 text-theme-primary">Social Push</h2>
            <p className="ds-text-caption">Metadata for your next broadcast.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <FormField label="Title / Caption" htmlFor="sched-title">
              <Input id="sched-title" type="text" placeholder="The strategy that changed everything..." title="Title" />
            </FormField>
            <FormField label="Description / First Comment" htmlFor="sched-desc">
              <Textarea id="sched-desc" rows={4} placeholder="Check the link in bio for more insight..." title="Description" />
            </FormField>
          </div>
          <div className="space-y-4">
            <FormField label="Tags">
              <div className="flex flex-wrap gap-2">
                {['#viral', '#growth', '#ai', '#creative', '#edit'].map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
                <button
                  type="button"
                  title="Add new tag"
                  className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-theme-muted transition-colors hover:text-theme-primary"
                >
                  + Add Tag
                </button>
              </div>
            </FormField>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-border pt-6">
          <Button
            variant="primary"
            leftIcon={<Radio className="h-4 w-4" aria-hidden />}
            onClick={() => {
              setSwarmHUDTask('Metadata Injection Launch')
              setShowSwarmHUD(true)
            }}
            title="Commence broadcast"
          >
            Commence Broadcast
          </Button>
        </div>
      </Panel>

      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default SchedulingView
