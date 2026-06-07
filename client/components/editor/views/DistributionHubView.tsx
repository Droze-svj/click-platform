'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Radio,
  Share2,
  Calendar,
  Zap,
  Target,
  BarChart3,
  CheckCircle2,
  Clock,
  Plus,
  Link2,
  AlertCircle,
  Loader2,
  Youtube,
  Instagram,
  Smartphone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SwarmConsensusHUD } from '../SwarmConsensusHUD'
import { apiGet, apiPost } from '../../../lib/api'
import { Panel, Button, Badge, SectionHeader, FormField, Input, Textarea } from '../../ui'
import { cn } from '../../../lib/utils'

interface DistributionHubViewProps {
  videoId: string
  videoUrl: string
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

// Platforms this hub can publish to. The `endpoint`/`buildPayload` fields mirror
// ExportView.handlePublish EXACTLY so behaviour stays consistent across views.
const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', icon: Smartphone, c: 'text-rose-500', bg: 'bg-rose-500/10', b: 'border-rose-500/20' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, c: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', b: 'border-fuchsia-500/20' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, c: 'text-red-500', bg: 'bg-red-500/10', b: 'border-red-500/20' },
] as const

type PlatformId = typeof PLATFORMS[number]['id']

interface OptimalTime { start: number; end: number; label: string }

const DistributionHubView: React.FC<DistributionHubViewProps> = ({ videoId, videoUrl, showToast }) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'schedule' | 'platforms'>('matrix')
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  // Real connection state, keyed by platform id.
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)

  // Matrix metadata + target selection (publish only to selected & connected).
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([])

  // Real "optimal times" from /social/optimal-times (no fabrication).
  const [optimalTimes, setOptimalTimes] = useState<OptimalTime[]>([])
  const [optimalTimezone, setOptimalTimezone] = useState<string>('UTC')

  // Schedule tab state.
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  // Only http(s) URLs are publishable (blob:/relative/empty are not reachable).
  const isPublishable = /^https?:\/\//i.test(videoUrl || '')

  const fetchConnectedAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true)
      const data = await apiGet<{ success?: boolean; accounts?: Record<string, any[]> }>('/oauth/accounts')
      const accts = data?.accounts || {}
      const map: Record<string, boolean> = {}
      for (const p of PLATFORMS) {
        map[p.id] = Array.isArray(accts[p.id]) && accts[p.id].length > 0
      }
      setConnected(map)
    } catch (error) {
      console.error('Failed to fetch connected accounts', error)
      setConnected({})
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  const fetchOptimalTimes = useCallback(async () => {
    // Use the first connected platform (fallback tiktok) as the basis for
    // the real optimal-times query. If it errors, we show nothing — never fake.
    try {
      const basis = PLATFORMS.find(p => connected[p.id])?.id || 'tiktok'
      const res = await apiGet<{ success?: boolean; data?: { optimalTimes?: OptimalTime[]; timezone?: string } }>(
        `/social/optimal-times?platform=${encodeURIComponent(basis)}`
      )
      const times = res?.data?.optimalTimes
      setOptimalTimes(Array.isArray(times) ? times : [])
      if (res?.data?.timezone) setOptimalTimezone(res.data.timezone)
    } catch (error) {
      console.error('Failed to fetch optimal times', error)
      setOptimalTimes([])
    }
  }, [connected])

  useEffect(() => {
    fetchConnectedAccounts()
  }, [fetchConnectedAccounts])

  // Refetch optimal times once we know which platforms are connected.
  useEffect(() => {
    if (!isLoadingAccounts) fetchOptimalTimes()
  }, [isLoadingAccounts, fetchOptimalTimes])

  const togglePlatform = (id: PlatformId) => {
    if (!connected[id]) return // can't target an unconnected platform
    setSelectedPlatforms(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]))
  }

  const connectedCount = PLATFORMS.filter(p => connected[p.id]).length

  const formatHour = (h: number) => {
    const hr = ((h % 24) + 24) % 24
    const period = hr < 12 ? 'AM' : 'PM'
    const display = hr % 12 === 0 ? 12 : hr % 12
    return `${display}${period}`
  }

  // ---- PUBLISH (matrix) — mirrors ExportView.handlePublish exactly ----
  const handleBroadcast = async () => {
    const targets = selectedPlatforms.filter(p => connected[p])
    if (targets.length === 0) {
      showToast('Select at least one connected platform', 'error')
      return
    }
    if (!isPublishable) {
      showToast(
        videoUrl
          ? 'Export URL is not publicly reachable yet — re-render with cloud storage enabled.'
          : 'Render the video first before broadcasting',
        'error'
      )
      return
    }

    setSwarmHUDTask('Commence Global Broadcast')
    setShowSwarmHUD(true)
    setIsSyncing(true)

    try {
      showToast(`Broadcasting to ${targets.length} platform(s)...`, 'info')

      const results = await Promise.allSettled(
        targets.map(platform => {
          const payload: any = {}
          let endpoint = `/oauth/${platform}/upload`

          if (platform === 'youtube') {
            payload.videoFile = videoUrl
            payload.title = title || 'Rendered with Neural Master'
            payload.description = description || 'Published from Click Video Editor'
          } else if (platform === 'instagram') {
            endpoint = `/oauth/${platform}/post`
            payload.imageUrl = videoUrl
            payload.caption = title || 'Rendered with Neural Master'
          } else {
            payload.videoFile = videoUrl
            payload.caption = title || 'Rendered with Neural Master'
          }

          return apiPost(endpoint, payload)
        })
      )

      const failures = results.filter(r => r.status === 'rejected').length
      if (failures === 0) {
        showToast('Broadcast complete! Content live on selected platforms.', 'success')
        setSelectedPlatforms([])
      } else if (failures < targets.length) {
        showToast(`Broadcast partial: ${targets.length - failures}/${targets.length} platforms succeeded.`, 'info')
      } else {
        showToast('Broadcast failed. Check connection matrices.', 'error')
      }
    } catch (error) {
      console.error('Broadcasting failed', error)
      showToast('Broadcast partial failure. Check connection matrices.', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // ---- SCHEDULE — real POST /scheduler/schedule ----
  const handleSchedule = async () => {
    const targets = selectedPlatforms.filter(p => connected[p])
    if (targets.length === 0) {
      showToast('Select at least one connected platform on the Push Matrix tab', 'error')
      return
    }
    if (!scheduleTime) {
      showToast('Pick a date & time to schedule', 'error')
      return
    }
    const when = new Date(scheduleTime)
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      showToast('Choose a valid future date & time', 'error')
      return
    }
    if (!isPublishable && !title.trim() && !description.trim()) {
      showToast('Add a title/description or render a reachable video first', 'error')
      return
    }

    try {
      setIsScheduling(true)
      const results = await Promise.allSettled(
        targets.map(platform =>
          apiPost('/scheduler/schedule', {
            contentId: videoId || null,
            platform,
            scheduledTime: when.toISOString(),
            mediaUrl: isPublishable ? videoUrl : '',
            content: {
              text: description || title || 'Published from Click Video Editor',
            },
          })
        )
      )
      const failures = results.filter(r => r.status === 'rejected').length
      if (failures === 0) {
        showToast(`Scheduled to ${targets.length} platform(s) for ${when.toLocaleString()}`, 'success')
        setScheduleTime('')
      } else if (failures < targets.length) {
        showToast(`Scheduled ${targets.length - failures}/${targets.length} platforms.`, 'info')
      } else {
        showToast('Scheduling failed. Verify connected accounts.', 'error')
      }
    } catch (error) {
      console.error('Scheduling failed', error)
      showToast('Scheduling failed. Verify connected accounts.', 'error')
    } finally {
      setIsScheduling(false)
    }
  }

  const tabs = [
    { id: 'matrix', label: 'Push Matrix', icon: Target },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'platforms', label: 'Platforms', icon: Share2 },
  ] as const

  // Optimal posting windows — shared render (real data from /social/optimal-times)
  const OptimalWindows = () =>
    optimalTimes.length > 0 ? (
      <div className="flex flex-col gap-2">
        {optimalTimes.map((w, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <span className="ds-text-label text-theme-primary">
                {formatHour(w.start)}–{formatHour(w.end)} {optimalTimezone}
              </span>
            </div>
            <span className="ds-text-caption ml-3 truncate">{w.label}</span>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-border bg-background/40 px-4 py-6 text-center ds-text-caption">
        No optimal-window data available.
      </div>
    )

  return (
    <div className="space-y-6 ds-anim-fade-in">
      {/* Header */}
      <SectionHeader
        as="h1"
        title="Distribution Hub"
        description={
          isLoadingAccounts
            ? 'Scanning connected accounts…'
            : `${connectedCount}/${PLATFORMS.length} platforms connected.`
        }
        actions={
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-background/40 p-1">
            {tabs.map(tab => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-theme-secondary hover:bg-accent hover:text-theme-primary'
                )}
              >
                <tab.icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <AnimatePresence mode="wait">
        {activeTab === 'matrix' && (
          <motion.div
            key="matrix"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <Panel variant="glass">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  <Target className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="ds-text-h3 text-theme-primary">Social Push Matrix</h2>
                  <p className="ds-text-caption">Compose and target your broadcast.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-7">
                  <FormField label="Title / Caption" htmlFor="dist-title">
                    <Input
                      id="dist-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="The strategy that changed everything…"
                      title="Title"
                    />
                  </FormField>
                  <FormField label="Description" htmlFor="dist-desc">
                    <Textarea
                      id="dist-desc"
                      rows={6}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Check the link in bio for more insight…"
                      title="Description"
                    />
                  </FormField>

                  {/* Real platform target selection — only connected platforms are selectable */}
                  <FormField label="Broadcast Targets">
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(p => {
                        const isConn = !!connected[p.id]
                        const isSel = selectedPlatforms.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={!isConn || isLoadingAccounts}
                            onClick={() => togglePlatform(p.id)}
                            title={isConn ? `Target ${p.label}` : `${p.label} not connected`}
                            className={cn(
                              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                              !isConn
                                ? 'cursor-not-allowed border-border bg-background/40 text-theme-muted opacity-50'
                                : isSel
                                  ? 'border-transparent bg-emerald-600 text-white'
                                  : 'border-border bg-background/40 text-theme-secondary hover:text-theme-primary'
                            )}
                          >
                            <p.icon className="h-4 w-4" aria-hidden />
                            {p.label}
                            {!isConn && <span className="text-xs opacity-70">(offline)</span>}
                          </button>
                        )
                      })}
                    </div>
                  </FormField>
                </div>

                <div className="space-y-6 lg:col-span-5">
                  {/* Real optimal posting windows from /social/optimal-times */}
                  <FormField label="Optimal Posting Windows">
                    <OptimalWindows />
                  </FormField>

                  <Panel variant="subtle" className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="ds-text-caption">Publish Readiness</span>
                        <p className="ds-text-h3 text-theme-primary">
                          {isPublishable ? 'Video ready' : 'Awaiting render'}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
                        <BarChart3 className="h-6 w-6" aria-hidden />
                      </div>
                    </div>
                    <p className="ds-text-caption">
                      {isPublishable
                        ? `${selectedPlatforms.length} target(s) selected of ${connectedCount} connected`
                        : 'Render to a reachable URL to enable broadcast.'}
                    </p>
                  </Panel>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
                <div className="flex items-center gap-2 text-theme-muted">
                  <AlertCircle className="h-5 w-5 text-emerald-500" aria-hidden />
                  <span className="ds-text-caption">
                    {connectedCount === 0
                      ? 'No platforms connected — link an account in Platforms.'
                      : `${selectedPlatforms.length} of ${connectedCount} connected nodes targeted`}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleBroadcast}
                  loading={isSyncing}
                  disabled={isSyncing || isLoadingAccounts || selectedPlatforms.length === 0 || !isPublishable}
                  title="Commence broadcast"
                  leftIcon={isSyncing ? undefined : <Radio className="h-5 w-5" aria-hidden />}
                  className="w-full bg-emerald-600 hover:bg-emerald-600/90 sm:w-auto"
                >
                  {isSyncing ? 'Broadcasting…' : 'Commence Broadcast'}
                </Button>
              </div>
            </Panel>
          </motion.div>
        )}

        {activeTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <Panel variant="glass">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="ds-text-h3 text-theme-primary">Schedule</h2>
                  <p className="ds-text-caption">Queue a dispatch for later.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="space-y-6">
                  <FormField label="Dispatch Time" htmlFor="dist-when">
                    <Input
                      id="dist-when"
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      title="Scheduled time"
                      className="[color-scheme:dark]"
                    />
                  </FormField>

                  <FormField label="Target Nodes">
                    <div className="flex flex-wrap gap-2">
                      {selectedPlatforms.filter(p => connected[p]).length > 0 ? (
                        selectedPlatforms.filter(p => connected[p]).map(pid => {
                          const p = PLATFORMS.find(x => x.id === pid)!
                          return (
                            <Badge key={pid} variant="secondary" className="gap-1.5">
                              <p.icon className="h-3.5 w-3.5" aria-hidden />{p.label}
                            </Badge>
                          )
                        })
                      ) : (
                        <span className="ds-text-caption">Select targets on the Push Matrix tab.</span>
                      )}
                    </div>
                  </FormField>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSchedule}
                    loading={isScheduling}
                    disabled={isScheduling || isLoadingAccounts || selectedPlatforms.filter(p => connected[p]).length === 0 || !scheduleTime}
                    title="Schedule dispatch"
                    leftIcon={isScheduling ? undefined : <Plus className="h-5 w-5" aria-hidden />}
                    className="w-full"
                  >
                    {isScheduling ? 'Queuing…' : 'Schedule Dispatch'}
                  </Button>
                </div>

                <FormField label="Optimal Posting Windows">
                  <OptimalWindows />
                </FormField>
              </div>
            </Panel>
          </motion.div>
        )}

        {activeTab === 'platforms' && (
          <motion.div
            key="platforms"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* Platform Connection Status (real) */}
            <Panel variant="glass" className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Share2 className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="ds-text-h3 text-theme-primary">Identity Clusters</h2>
              </div>

              <div className="space-y-3">
                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center gap-3 p-10 text-theme-muted">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    <span className="ds-text-label">Scanning accounts…</span>
                  </div>
                ) : (
                  PLATFORMS.map(node => {
                    const isConn = !!connected[node.id]
                    return (
                      <div key={node.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', node.bg, node.b, node.c)}>
                            <node.icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div>
                            <p className="ds-text-label text-theme-primary">{node.label}</p>
                            <p className={cn('ds-text-caption mt-0.5 flex items-center gap-1.5', isConn ? 'text-emerald-500' : 'text-theme-muted')}>
                              {isConn
                                ? <><CheckCircle2 className="h-3 w-3" aria-hidden /> Connected</>
                                : <><Link2 className="h-3 w-3" aria-hidden /> Not connected</>}
                            </p>
                          </div>
                        </div>
                        {isConn ? (
                          <Badge className="bg-emerald-600">Active</Badge>
                        ) : (
                          <a
                            href="/dashboard/social"
                            className="inline-flex h-8 items-center rounded-lg border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            Connect
                          </a>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </Panel>

            {/* Connection Summary (real, derived from /oauth/accounts) */}
            <Panel variant="glass" className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                  <Zap className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="ds-text-h3 text-theme-primary">Uplink Status</h2>
              </div>

              <Panel variant="subtle" className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="ds-text-caption">Connected nodes</span>
                  <span className="ds-text-label text-theme-primary">
                    {isLoadingAccounts ? '—' : `${connectedCount} / ${PLATFORMS.length}`}
                  </span>
                </div>
                {/* Real per-platform connection bars (1 = connected, dim = not) — no random data */}
                <div className="flex gap-2">
                  {PLATFORMS.map(p => (
                    <div
                      key={p.id}
                      title={`${p.label}: ${connected[p.id] ? 'connected' : 'not connected'}`}
                      className={cn('h-5 flex-1 rounded-full transition-colors', connected[p.id] ? 'bg-emerald-500/60' : 'bg-accent')}
                    />
                  ))}
                </div>
              </Panel>

              <div className="space-y-3">
                {PLATFORMS.map(p => (
                  <div key={p.id} className={cn('flex items-center justify-between rounded-xl border bg-background/40 p-4', connected[p.id] ? 'border-emerald-500/20' : 'border-border')}>
                    <span className="ds-text-label flex items-center gap-2 text-theme-primary">
                      <p.icon className={cn('h-4 w-4', p.c)} aria-hidden />{p.label}
                    </span>
                    <Badge variant={connected[p.id] ? 'default' : 'secondary'} className={connected[p.id] ? 'bg-emerald-600' : ''}>
                      {isLoadingAccounts ? 'Scanning' : connected[p.id] ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
      <SwarmConsensusHUD
        isVisible={showSwarmHUD}
        taskName={swarmHUDTask}
        onComplete={() => setShowSwarmHUD(false)}
      />
    </div>
  )
}

export default DistributionHubView
