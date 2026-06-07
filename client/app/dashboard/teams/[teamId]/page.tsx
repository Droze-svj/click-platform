'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Share2,
  Trash2,
  ChevronDown,
  Users,
  Shield,
  Activity,
  Zap,
  RefreshCw,
  Database,
  CheckCircle,
  MoreVertical,
  Fingerprint,
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../lib/api'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import ToastContainer from '../../../../components/ToastContainer'
import { ErrorBoundary } from '../../../../components/ErrorBoundary'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '../../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Switch,
  StatCard,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../../components/ui'

interface TeamMember {
  userId: { _id: string; name: string; email: string }
  role: string
  joinedAt: string
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canApprove: boolean
  }
}

interface Team {
  _id: string
  name: string
  description: string
  ownerId: { _id: string; name: string; email: string }
  members: TeamMember[]
  settings: { allowMemberInvites: boolean; requireApproval: boolean }
  createdAt: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

export default function TeamDetailsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const teamId = params.teamId as string

  const loadTeam = useCallback(async () => {
    try {
      const res = await apiGet(`/teams/${teamId}`)
      const data = extractApiData<Team>(res as any) ?? (res as any)?.data
      setTeam(data || null)
    } catch {
      showToast(t('teamDetailPage.toastLoadFailed'), 'error')
      router.push('/dashboard/teams')
    } finally {
      setLoading(false)
    }
  }, [teamId, router, showToast, t])

  useEffect(() => {
    if (teamId) loadTeam()
  }, [teamId, loadTeam])

  const canManage = team && (() => {
    const uid = (user as any)?.id || (user as any)?._id
    const m = team.members.find((x) => (x.userId as any)?._id === uid)
    return m?.role === 'owner' || m?.role === 'admin'
  })()

  const isOwner = (m: TeamMember) => m.role === 'owner'

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      showToast(t('teamDetailPage.toastEmailRequired'), 'warning')
      return
    }
    setInviting(true)
    try {
      await apiPost(`/teams/${teamId}/invite-by-email`, { email, role: inviteRole })
      showToast(t('teamDetailPage.toastInviteSent'), 'success')
      setInviteEmail('')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastInviteFailed'), 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    setUpdatingRole(memberId)
    try {
      await apiPut(`/teams/${teamId}/members/${memberId}/role`, { role })
      showToast(t('teamDetailPage.toastRoleUpdated'), 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastRoleFailed'), 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm(t('teamDetailPage.confirmRemoveMember'))) return
    setRemoving(memberId)
    try {
      await apiDelete(`/teams/${teamId}/members/${memberId}`)
      showToast(t('teamDetailPage.toastMemberRemoved'), 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || t('teamDetailPage.toastRemoveFailed'), 'error')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center" aria-busy="true" aria-label={t('teamDetailPage.loading')}>
        <RefreshCw size={40} className="text-primary animate-spin mb-4" aria-hidden />
        <p className="ds-text-caption">{t('teamDetailPage.loading')}</p>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex items-center justify-center p-6">
        <EmptyState
          icon={Users}
          title={t('teamDetailPage.notFoundTitle')}
          description={t('teamDetailPage.notFoundDescription')}
          className="ds-surface-card"
          action={<Button variant="primary" size="md" leftIcon={<ArrowLeft size={16} aria-hidden />} onClick={() => router.push('/dashboard/teams')}>{t('teamDetailPage.revertToCollective')}</Button>}
        />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={team.name}
          description={t('teamDetailPage.uptimeLabel', { date: new Date(team.createdAt).toLocaleDateString() })}
          actions={
            <>
              <Button variant="ghost" size="md" leftIcon={<ArrowLeft size={16} aria-hidden />} onClick={() => router.push('/dashboard/teams')}>
                {t('teamDetailPage.backToTeams')}
              </Button>
              <IconButton variant="secondary" size="md" onClick={() => loadTeam()} aria-label={t('teamDetailPage.refreshTeamData')} title={t('teamDetailPage.refreshTeamData')}>
                <RefreshCw size={16} aria-hidden />
              </IconButton>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Members */}
          <main className="lg:col-span-8 space-y-6">
            <Panel variant="bento" className="p-0 overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <Fingerprint size={22} aria-hidden />
                  </div>
                  <div>
                    <h2 className="ds-text-h3 text-theme-primary">{t('teamDetailPage.membersMatrix')}</h2>
                    <p className="ds-text-caption">{t('teamDetailPage.neuralUnitRegistry')}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="tabular-nums">{t('teamDetailPage.unitsSynced', { count: team.members.length })}</Badge>
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {team.members.map((m) => (
                  <div key={(m.userId as any)?._id} className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-xl ds-surface-subtle border border-[var(--border-subtle)] flex items-center justify-center text-lg font-semibold text-primary">
                        {(m.userId?.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="ds-text-label text-theme-primary truncate">{m.userId?.name}</p>
                        <p className="ds-text-caption truncate">{m.userId?.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="ds-text-caption">{t('teamDetailPage.initializedLabel', { date: new Date(m.joinedAt).toLocaleDateString() })}</span>
                          <span className="ds-text-caption text-primary inline-flex items-center gap-1"><Activity size={10} aria-hidden /> {t('teamDetailPage.syncedReady')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isOwner(m) ? (
                        <Badge className="gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Shield size={12} aria-hidden /> {t('teamDetailPage.coreOwner')}</Badge>
                      ) : canManage ? (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateRole((m.userId as any)._id, e.target.value)}
                              disabled={!!updatingRole}
                              aria-label={t('teamDetailPage.roleForMember', { name: m.userId?.name || t('teamDetailPage.memberFallback') })}
                              title={t('teamDetailPage.roleForMember', { name: m.userId?.name || t('teamDetailPage.memberFallback') })}
                              className="appearance-none rounded-lg border border-input bg-background px-3 h-9 pr-8 text-xs font-medium text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{t(`teamDetailPage.role_${r.value}`)}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
                          </div>
                          <IconButton variant="ghost" size="sm" onClick={() => handleRemoveMember((m.userId as any)._id)} disabled={!!removing} aria-label={t('teamDetailPage.confirmRemoveMember')} title={t('teamDetailPage.confirmRemoveMember')} className="text-rose-500">
                            {removing === (m.userId as any)._id ? <RefreshCw className="animate-spin" size={16} aria-hidden /> : <Trash2 size={16} aria-hidden />}
                          </IconButton>
                        </div>
                      ) : (
                        <Badge className="bg-primary/10 text-primary">{m.role}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Advanced controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Panel variant="bento" className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><Share2 size={22} aria-hidden /></div>
                  <div>
                    <h3 className="ds-text-h3 text-theme-primary">{t('teamDetailPage.latticeIntegration')}</h3>
                    <p className="ds-text-caption">{t('teamDetailPage.nodeCrossLinking')}</p>
                  </div>
                </div>
                <p className="ds-text-body text-theme-muted">{t('teamDetailPage.latticeIntegrationDesc')}</p>
                <Button variant="secondary" size="md" onClick={() => router.push('/dashboard/content')} className="w-full">{t('teamDetailPage.synchronizeAssets')}</Button>
              </Panel>

              <Panel variant="bento" className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><Zap size={22} aria-hidden /></div>
                  <div>
                    <h3 className="ds-text-h3 text-theme-primary">{t('teamDetailPage.swarmTelemetry')}</h3>
                    <p className="ds-text-caption">{t('teamDetailPage.realTimeNodeStatus')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg ds-surface-subtle">
                    <span className="ds-text-caption">{t('teamDetailPage.idDnaRegistry')}</span>
                    <span className="ds-text-caption text-primary inline-flex items-center gap-1.5"><CheckCircle size={13} aria-hidden /> {t('teamDetailPage.verified')}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg ds-surface-subtle">
                    <span className="ds-text-caption">{t('teamDetailPage.neuralSyncRate')}</span>
                    <span className="ds-text-caption text-primary">{t('teamDetailPage.syncRateOptimal')}</span>
                  </div>
                </div>
              </Panel>
            </div>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Member count stat */}
            <StatCard label={t('teamDetailPage.membersMatrix')} value={team.members.length} icon={Users} />

            {/* Invite */}
            {canManage && (
              <Panel variant="bento" className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><UserPlus size={22} aria-hidden /></div>
                  <div>
                    <h2 className="ds-text-h3 text-theme-primary">{t('teamDetailPage.nodeInduction')}</h2>
                    <p className="ds-text-caption">{t('teamDetailPage.injectNewUnit')}</p>
                  </div>
                </div>
                <p className="ds-text-body text-theme-muted">{t('teamDetailPage.nodeInductionDesc')}</p>
                <div className="space-y-3">
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                    <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t('teamDetailPage.emailPlaceholder')} aria-label={t('teamDetailPage.emailPlaceholder')} className="pl-9" />
                  </div>
                  <div className="relative">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      aria-label={t('teamDetailPage.inviteRole')}
                      title={t('teamDetailPage.inviteRole')}
                      className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{t(`teamDetailPage.roleProtocol_${r.value}`)}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
                  </div>
                  <Button variant="primary" size="md" onClick={handleInviteByEmail} loading={inviting} disabled={inviting} className="w-full">
                    {t('teamDetailPage.inductUnit')}
                  </Button>
                </div>
              </Panel>
            )}

            {/* Cluster Integrity */}
            <Panel variant="bento" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-primary" aria-hidden />
                  <h2 className="ds-text-label text-theme-primary">{t('teamDetailPage.clusterIntegrity')}</h2>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-4 py-3 rounded-lg ds-surface-subtle gap-3">
                  <div className="min-w-0">
                    <p className="ds-text-label text-theme-primary">{t('teamDetailPage.unitAutonomy')}</p>
                    <p className="ds-text-caption">{t('teamDetailPage.autoInductionPermit')}</p>
                  </div>
                  <Switch checked={!!team.settings?.allowMemberInvites} disabled aria-label={t('teamDetailPage.unitAutonomy')} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-lg ds-surface-subtle gap-3">
                  <div className="min-w-0">
                    <p className="ds-text-label text-theme-primary">{t('teamDetailPage.consensusProtocol')}</p>
                    <p className="ds-text-caption">{t('teamDetailPage.mandatoryValidation')}</p>
                  </div>
                  <Switch checked={!!team.settings?.requireApproval} disabled aria-label={t('teamDetailPage.consensusProtocol')} />
                </div>
              </div>
              <p className="ds-text-caption text-center pt-1">{t('teamDetailPage.globalSecurityEnabled')}</p>
            </Panel>

            {/* Metadata */}
            <Panel variant="bento" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-primary" aria-hidden />
                  <span className="ds-text-label text-theme-primary">{t('teamDetailPage.latticeMetadata')}</span>
                </div>
                <MoreVertical size={16} className="text-theme-muted" aria-hidden />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-3">
                  <span className="ds-text-caption">{t('teamDetailPage.clusterId')}</span>
                  <span className="ds-text-caption text-theme-primary tabular-nums truncate max-w-[160px]">{team._id}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="ds-text-caption">{t('teamDetailPage.ownerHash')}</span>
                  <span className="ds-text-caption text-theme-primary truncate max-w-[160px]">{team.ownerId?.email}</span>
                </div>
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </ErrorBoundary>
  )
}
