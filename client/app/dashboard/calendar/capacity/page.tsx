'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CalendarClock, AlertTriangle, Layers, Users,
  RefreshCw, Clock, Crown,
} from 'lucide-react'
import { apiGet } from '../../../../lib/api'
import { cn } from '../../../../lib/utils'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import {
  Panel,
  StatCard,
  Badge,
  EmptyState,
  SectionHeader,
  Input,
  Button,
} from '../../../../components/ui'

// ── Live response shape from GET /api/agency/:id/calendar/capacity ──
// Only fields the backend actually returns are typed/rendered — nothing fabricated.
interface Conflict {
  clientId?: string
  platform?: string
  a?: string
  b?: string
  gapMin?: number
}

interface Overflow {
  clientId?: string
  platform?: string
  day?: string
  count?: number
  max?: number
}

interface CapacityResponse {
  total?: number
  conflicts?: Conflict[]
  overCapacity?: Overflow[]
  workload?: Record<string, number>
  busiestAssignee?: string
}

// apiGet resolves to the raw response body: { data: CapacityResponse }
interface CapacityEnvelope {
  data?: CapacityResponse
}

function CapacityInner() {
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  // Match the agency-route convention (see clients/[clientId]/kanban): the
  // active agency workspace id rides in the query string. If it's absent we
  // fall back to a simple Input so the page stays usable on its own.
  const paramWorkspaceId = searchParams.get('agencyWorkspaceId') || ''
  const [workspaceInput, setWorkspaceInput] = useState('')
  const agencyWorkspaceId = paramWorkspaceId || workspaceInput.trim()

  const [capacity, setCapacity] = useState<CapacityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadCapacity = useCallback(async (isRefresh = false) => {
    if (!agencyWorkspaceId) return
    if (isRefresh) setRefreshing(true); else setLoading(true)
    try {
      const res = await apiGet<CapacityEnvelope>(
        `/agency/${agencyWorkspaceId}/calendar/capacity`
      )
      setCapacity(res?.data ?? null)
    } catch {
      showToast('Failed to load calendar capacity.', 'error')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [agencyWorkspaceId, showToast])

  useEffect(() => {
    if (!agencyWorkspaceId) return
    loadCapacity()
  }, [agencyWorkspaceId, loadCapacity])

  const conflicts = capacity?.conflicts ?? []
  const overflow = capacity?.overCapacity ?? []
  const workload = capacity?.workload ?? {}
  const busiest = capacity?.busiestAssignee

  // Assignee → count, sorted busiest-first. `max` powers the bar widths.
  const workloadRows = useMemo(() => {
    const rows = Object.entries(workload).map(([assigneeId, count]) => ({
      assigneeId,
      count: Number(count) || 0,
    }))
    rows.sort((a, b) => b.count - a.count)
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
    return { rows, max }
  }, [workload])

  const overCapacityDays = overflow.filter(o => (o?.count ?? 0) > (o?.max ?? 0)).length

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title="Calendar Capacity"
        description="Spot scheduling conflicts, capacity overflow, and team workload across the agency."
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={() => loadCapacity(true)}
            disabled={!agencyWorkspaceId || loading || refreshing}
            leftIcon={<RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden />}
          >
            Refresh
          </Button>
        }
      />

      {/* Workspace id entry (only when not supplied via query param) */}
      {!paramWorkspaceId && (
        <Panel variant="bento">
          <label htmlFor="agencyWorkspaceId" className="ds-text-label text-theme-secondary">
            Agency workspace ID
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-3">
            <Input
              id="agencyWorkspaceId"
              type="text"
              placeholder="Paste the agency workspace ID"
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
              className="sm:max-w-md"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => loadCapacity()}
              disabled={!workspaceInput.trim() || loading}
              loading={loading}
            >
              Load capacity
            </Button>
          </div>
        </Panel>
      )}

      {/* Empty prompt before an id is provided */}
      {!agencyWorkspaceId && (
        <EmptyState
          icon={CalendarClock}
          title="Enter an agency workspace"
          description="Provide an agency workspace ID above to view its calendar capacity."
          className="ds-surface-card"
        />
      )}

      {/* Loading skeleton */}
      {agencyWorkspaceId && loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ds-surface-card h-28 animate-pulse" aria-hidden />
          ))}
        </div>
      )}

      {/* Content */}
      {agencyWorkspaceId && !loading && capacity && (
        <>
          {/* 1 ── Summary StatCards ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Scheduled posts" value={capacity.total ?? 0} icon={Layers} />
            <StatCard label="Conflicts" value={conflicts.length} icon={AlertTriangle} />
            <StatCard label="Over-capacity days" value={overCapacityDays} icon={CalendarClock} />
          </section>

          {/* 2 ── Scheduling conflicts ── */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h2" title="Scheduling conflicts" />
            {conflicts.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No conflicts — nicely spaced."
                className="ds-surface-subtle"
              />
            ) : (
              <ul className="space-y-2">
                {conflicts.map((c, i) => (
                  <li
                    key={`${c?.clientId ?? 'client'}-${c?.platform ?? 'platform'}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl ds-surface-subtle px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {c?.platform ?? '—'}
                          <span className="text-theme-muted font-normal"> · {c?.clientId ?? '—'}</span>
                        </p>
                        <p className="ds-text-caption">
                          Posts only {c?.gapMin ?? 0}min apart
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                      {c?.gapMin ?? 0}min
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* 3 ── Capacity overflow ── */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h2" title="Capacity overflow" />
            {overflow.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No capacity overflow."
                description="Every day sits within its scheduling limit."
                className="ds-surface-subtle"
              />
            ) : (
              <ul className="space-y-2">
                {overflow.map((o, i) => {
                  const isOver = (o?.count ?? 0) > (o?.max ?? 0)
                  return (
                    <li
                      key={`${o?.clientId ?? 'client'}-${o?.platform ?? 'platform'}-${o?.day ?? i}`}
                      className="flex items-center justify-between gap-3 rounded-xl ds-surface-subtle px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {o?.clientId ?? '—'}
                          <span className="text-theme-muted font-normal"> · {o?.platform ?? '—'}</span>
                        </p>
                        <p className="ds-text-caption">{o?.day ?? '—'}</p>
                      </div>
                      <Badge
                        className={cn(
                          'tabular-nums shrink-0',
                          isOver
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {o?.count ?? 0}/{o?.max ?? 0} posts
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* 4 ── Team workload ── */}
          <Panel variant="bento" className="space-y-4">
            <SectionHeader as="h2" title="Team workload" />
            {workloadRows.rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No workload data."
                description="No posts are assigned to team members yet."
                className="ds-surface-subtle"
              />
            ) : (
              <ul className="space-y-3">
                {workloadRows.rows.map((row) => {
                  const pct = workloadRows.max > 0 ? Math.round((row.count / workloadRows.max) * 100) : 0
                  const isBusiest = !!busiest && row.assigneeId === busiest
                  return (
                    <li key={row.assigneeId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-primary truncate">
                          {isBusiest && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden />}
                          {row.assigneeId}
                        </span>
                        <span className="ds-text-caption tabular-nums shrink-0">{row.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full ds-surface-subtle overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isBusiest ? 'bg-amber-500' : 'bg-primary'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

export default function CalendarCapacityPage() {
  return (
    <Suspense fallback={<div className="p-6 text-theme-muted">Loading…</div>}>
      <CapacityInner />
    </Suspense>
  )
}
