'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Rocket, Calendar, ShieldCheck, Zap, CheckCircle2, XCircle,
  PlugZap, Clock, ChevronDown,
} from 'lucide-react'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { apiPost } from '../../../lib/api'
import { extractApiError } from '../../../utils/apiResponse'
import {
  Panel,
  Button,
  Badge,
  EmptyState,
  SectionHeader,
  FormField,
  Input,
} from '../../../components/ui'

// ── Types ───────────────────────────────────────────────────────────────────
// Explicit shapes for the /api/autopilot response. Only fields the backend is
// documented to return are declared — nothing is fabricated client-side.

type AutonomyMode = 'human_approve' | 'full_auto'

type PostStatus = 'pending_approval' | 'scheduled' | string

interface AutopilotPost {
  platform?: string
  scheduledTime?: string
  caption?: string
  hook?: string
  status?: PostStatus
}

interface AutopilotPlan {
  planId: string | null
  autonomyMode?: AutonomyMode
  status?: PostStatus
  posts?: AutopilotPost[]
  count?: number
  /** Present (with planId null + empty posts) when no social accounts connected. */
  message?: string
}

interface AutopilotResponse {
  success?: boolean
  message?: string
  data?: AutopilotPlan
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format an ISO timestamp into a readable local string; tolerant of junk. */
function formatScheduledTime(iso?: string): string {
  if (!iso) return 'Time TBD'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusBadgeVariant(status?: PostStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'scheduled') return 'default'          // green/primary look
  if (status === 'pending_approval') return 'secondary' // amber/secondary look
  return 'outline'
}

function statusLabel(status?: PostStatus): string {
  if (status === 'pending_approval') return 'Pending approval'
  if (status === 'scheduled') return 'Scheduled'
  return status ? String(status) : 'Draft'
}

export default function AutopilotPage() {
  const { showToast } = useToast()

  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('human_approve')
  const [niche, setNiche] = useState('')

  const [plan, setPlan] = useState<AutopilotPlan | null>(null)
  // `message` is only meaningful when planId is null (no connected accounts).
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const [building, setBuilding] = useState(false)
  const [approving, setApproving] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const posts = plan?.posts ?? []
  const hasPlan = !!plan?.planId
  const isPendingApproval = plan?.status === 'pending_approval'

  // ── Build plan ──────────────────────────────────────────────────────────────
  async function handleBuild() {
    setBuilding(true)
    setEmptyMessage(null)
    try {
      const res = await apiPost<AutopilotResponse>('/autopilot', {
        autonomyMode,
        niche: niche.trim() || undefined,
      })
      const data = res?.data
      if (!data) {
        showToast('No plan was returned. Please try again.', 'error')
        return
      }

      // No connected social accounts → planId is null + empty posts.
      if (!data.planId) {
        setPlan(null)
        setEmptyMessage(data.message || null)
        return
      }

      setPlan(data)
      showToast(
        `Plan built with ${data.count ?? data.posts?.length ?? 0} drafted post(s).`,
        'success'
      )
    } catch (err) {
      // 402 upgrade prompt is surfaced globally; just toast everything else.
      showToast(extractApiError(err).message, 'error')
    } finally {
      setBuilding(false)
    }
  }

  // ── Approve & schedule ───────────────────────────────────────────────────────
  async function handleApprove() {
    if (!plan?.planId) return
    setApproving(true)
    try {
      await apiPost(`/autopilot/${plan.planId}/approve`)
      showToast('Plan approved — posts are now scheduled.', 'success')
      // Reflect the new state locally without a refetch.
      setPlan(prev =>
        prev
          ? {
              ...prev,
              status: 'scheduled',
              posts: (prev.posts ?? []).map(p => ({ ...p, status: 'scheduled' })),
            }
          : prev
      )
    } catch (err) {
      showToast(extractApiError(err).message, 'error')
    } finally {
      setApproving(false)
    }
  }

  // ── Cancel plan ──────────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!plan?.planId) return
    setCancelling(true)
    try {
      await apiPost(`/autopilot/${plan.planId}/cancel`)
      showToast('Plan cancelled.', 'info')
      setPlan(null)
      setEmptyMessage(null)
    } catch (err) {
      showToast(extractApiError(err).message, 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <ToastContainer />

      {/* ── Header ── */}
      <SectionHeader
        as="h1"
        title="Autopilot"
        description="Let Autopilot draft a publishing plan across your connected accounts — with a human-approve gate so nothing goes live without your say-so."
        className="mb-6"
      />

      {/* ── Generate plan ── */}
      <Panel variant="bento" className="mb-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Autonomy mode */}
          <FormField className="gap-0">
            <label
              htmlFor="autopilot-mode"
              className="mb-1.5 text-sm font-medium text-theme-secondary"
            >
              Autonomy mode
            </label>
            <div className="relative">
              <select
                id="autopilot-mode"
                value={autonomyMode}
                onChange={(e) => setAutonomyMode(e.target.value as AutonomyMode)}
                title="Autonomy mode"
                aria-label="Autonomy mode"
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="human_approve">Human approve (recommended)</option>
                <option value="full_auto">Full auto</option>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
            </div>
          </FormField>

          {/* Niche */}
          <FormField className="gap-0">
            <label
              htmlFor="autopilot-niche"
              className="mb-1.5 text-sm font-medium text-theme-secondary"
            >
              Niche <span className="text-theme-muted font-normal">(optional)</span>
            </label>
            <Input
              id="autopilot-niche"
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              title="Niche"
              aria-label="Niche"
              placeholder="e.g. fitness, finance, tech"
            />
          </FormField>

          {/* Build action */}
          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              loading={building}
              onClick={handleBuild}
              leftIcon={<Rocket className="h-4 w-4" aria-hidden />}
              className="w-full"
            >
              {building ? 'Building plan…' : 'Build Plan'}
            </Button>
          </div>
        </div>

        {/* Human-approve gate banner */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          <div className="text-sm leading-relaxed text-theme-secondary">
            {autonomyMode === 'human_approve' ? (
              <>
                <span className="font-semibold text-theme-primary">Human approve:</span>{' '}
                Autopilot only drafts a plan — <span className="font-medium">nothing publishes</span>{' '}
                until you press <span className="font-medium">Approve &amp; Schedule</span>.
              </>
            ) : (
              <>
                <span className="font-semibold text-theme-primary">Full auto:</span>{' '}
                drafted posts are <span className="font-medium">scheduled immediately</span>. You
                still get a <span className="font-medium">10-minute cancel window</span> before
                anything goes out.
              </>
            )}
          </div>
        </div>
      </Panel>

      {/* ── No connected accounts (planId null) ── */}
      {!hasPlan && emptyMessage !== null && (
        <EmptyState
          icon={PlugZap}
          title="Connect a social account first"
          description={emptyMessage || 'Autopilot needs at least one connected social account before it can draft a publishing plan.'}
          className="ds-surface-card"
          action={
            <Link href="/dashboard/social">
              <Button variant="primary" size="sm" leftIcon={<PlugZap className="h-4 w-4" aria-hidden />}>
                Connect an account
              </Button>
            </Link>
          }
        />
      )}

      {/* ── Drafted plan ── */}
      {hasPlan && (
        <Panel variant="bento" className="space-y-5">
          {/* Plan summary + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Calendar className="h-5 w-5 text-indigo-500" aria-hidden />
              </span>
              <div>
                <h2 className="ds-text-h3 text-theme-primary leading-tight">
                  {posts.length} drafted post{posts.length === 1 ? '' : 's'}
                </h2>
                <p className="text-sm text-theme-muted">
                  Mode: {plan?.autonomyMode === 'full_auto' ? 'Full auto' : 'Human approve'}
                  {plan?.status ? ` · ${statusLabel(plan.status)}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isPendingApproval && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={approving}
                  onClick={handleApprove}
                  leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                >
                  Approve &amp; Schedule
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                loading={cancelling}
                onClick={handleCancel}
                leftIcon={<XCircle className="h-4 w-4" aria-hidden />}
              >
                Cancel Plan
              </Button>
            </div>
          </div>

          {/* Posts list */}
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {posts.map((post, idx) => {
                const text = post?.caption || post?.hook || ''
                return (
                  <div
                    key={`${post?.platform ?? 'post'}-${idx}`}
                    className="ds-surface-subtle flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-theme-primary">
                          <Zap className="h-4 w-4 text-fuchsia-500" aria-hidden />
                          {post?.platform || 'Unknown platform'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-theme-muted">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {formatScheduledTime(post?.scheduledTime)}
                        </span>
                      </div>
                      {text && (
                        <p className="text-sm leading-relaxed text-theme-secondary">{text}</p>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Badge variant={statusBadgeVariant(post?.status)}>
                        {statusLabel(post?.status)}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="No posts in this plan"
              description="Autopilot didn't draft any posts for this plan."
              className="ds-surface-card"
            />
          )}
        </Panel>
      )}

      {/* ── Initial empty state (nothing built yet) ── */}
      {!hasPlan && emptyMessage === null && !building && (
        <EmptyState
          icon={Rocket}
          title="Build your first Autopilot plan"
          description="Choose an autonomy mode, optionally set a niche, then press Build Plan to draft a publishing schedule across your connected accounts."
          className="ds-surface-card"
        />
      )}
    </div>
  )
}
