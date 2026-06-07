'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Plus, MessageSquare, Network, Crown, X, Search,
  Database, ArrowRight, Inbox, ArrowUpRight, Cpu,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { apiGet, apiPost } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'
import ToastContainer from '../../../components/ToastContainer'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Input,
  Textarea,
  Modal,
  StatCard,
  EmptyState,
  SectionHeader,
  Badge,
} from '../../../components/ui'

interface Team {
  _id: string; name: string; description: string;
  ownerId: { _id: string; name: string; email: string };
  members: Array<{ userId: { _id: string; name: string; email: string }; role: string; joinedAt: string }>;
}

export default function SwarmCollectiveNodePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() as any
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')

  const loadSwarmData = useCallback(async () => {
    try {
      const res = await apiGet('/teams')
      const data = extractApiData<Team[]>(res as any) ?? (res as any)?.data
      setTeams(Array.isArray(data) ? data : [])
    } catch {
      showToast(t('teamsPage.toastLoadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    loadSwarmData()
  }, [user, authLoading, router, loadSwarmData])

  const filteredTeams = teams.filter(team => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (team.name || '').toLowerCase().includes(q) ||
      (team.description || '').toLowerCase().includes(q)
    )
  })

  const handleClusterGenesis = async () => {
    if (!name.trim()) {
      showToast(t('teamsPage.toastNameRequired'), 'error')
      return
    }
    setCreating(true)
    try {
      await apiPost('/teams', { name: name.trim(), description: description.trim() })
      showToast(t('teamsPage.toastTeamCreated'), 'success')
      setShowCreateModal(false)
      setName('')
      setDescription('')
      await loadSwarmData()
    } catch (e: any) {
      showToast(e?.response?.data?.error || t('teamsPage.toastCreateFailed'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const isPrimeOrchestrator = (tm: Team) =>
    (tm.ownerId as any)?._id === (user as any)?.id || (tm.ownerId as any)?._id === (user as any)?._id

  const totalMembers = teams.reduce((s, tm) => s + tm.members.length, 0)
  const ownedCount = teams.filter(isPrimeOrchestrator).length

  if (loading) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center py-48" aria-busy="true" aria-label={t('teamsPage.loading')}>
        <Network size={40} className="text-primary animate-spin mb-4" aria-hidden />
        <p className="ds-text-caption">{t('teamsPage.loading')}</p>
      </div>
    )
  }

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
      <ToastContainer />

      <SectionHeader
        as="h1"
        title={t('teamsPage.title')}
        description={t('teamsPage.activeCount', { count: teams.length })}
        actions={
          <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => setShowCreateModal(true)}>
            {t('teamsPage.newCollective')}
          </Button>
        }
      />

      {/* Stats (real counts) */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label={t('teamsPage.collectiveGrid')} value={teams.length} icon={Network} />
        <StatCard label={t('teamsPage.primeOrchestrator')} value={ownedCount} icon={Crown} />
        <StatCard label={t('teamsPage.synergyNodes')} value={totalMembers} icon={Users} />
      </section>

      {/* Collaboration Hub */}
      <Panel variant="bento" className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <MessageSquare size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="ds-text-h3 text-theme-primary">{t('teamsPage.collaborationHub')}</h2>
            <p className="ds-text-body text-theme-muted mt-1">{t('teamsPage.multiUserSync')}</p>
          </div>
        </div>
        <Button variant="secondary" size="md" rightIcon={<ArrowRight size={16} aria-hidden />} onClick={() => router.push('/dashboard/tasks')} className="shrink-0">
          {t('teamsPage.openTasks')}
        </Button>
      </Panel>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('teamsPage.searchPlaceholder')}
          aria-label={t('teamsPage.scanNodes')}
          className="pl-9 pr-24"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {search && (
            <IconButton variant="ghost" size="sm" onClick={() => setSearch('')} aria-label={t('teamsPage.clearSearch')} title={t('teamsPage.clearSearch')}>
              <X size={14} aria-hidden />
            </IconButton>
          )}
          <Badge variant="secondary" className="gap-1 tabular-nums">
            <Database size={11} aria-hidden /> {filteredTeams.length}/{teams.length}
          </Badge>
        </div>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={Network}
          title={t('teamsPage.emptyTitle')}
          description={t('teamsPage.emptyDescription')}
          className="ds-surface-subtle"
          action={
            <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => setShowCreateModal(true)}>
              {t('teamsPage.initializeCollective')}
            </Button>
          }
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('teamsPage.noNodesMatched')}
          description={t('teamsPage.noNodesMatchedDesc')}
          className="ds-surface-subtle"
          action={<Button variant="secondary" size="md" onClick={() => setSearch('')}>{t('teamsPage.resetScanner')}</Button>}
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const roleCounts: Record<string, number> = {}
            team.members.forEach(m => {
              const r = (m.role || 'operative').toLowerCase()
              roleCounts[r] = (roleCounts[r] || 0) + 1
            })
            const entries = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
            const roleColor = (r: string) =>
              r.includes('admin') || r.includes('owner') ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : r.includes('editor') || r.includes('mod') ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : r.includes('view') ? 'ds-surface-subtle text-theme-muted'
              : 'bg-primary/10 text-primary'
            return (
              <motion.div
                key={team._id}
                layout
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="ds-surface-card ds-hover-lift p-6 flex flex-col min-h-[320px]"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                    <Cpu size={24} aria-hidden />
                  </div>
                  {isPrimeOrchestrator(team) && (
                    <Badge className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Crown size={11} aria-hidden /> {t('teamsPage.primeOrchestrator')}
                    </Badge>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="ds-text-h3 text-theme-primary line-clamp-2 mb-2">{team.name}</h3>
                  {team.description && (
                    <p className="ds-text-body text-theme-muted line-clamp-3 mb-4">{team.description}</p>
                  )}
                  {entries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map(([role, count]) => (
                        <Badge key={role} className={cn('gap-1', roleColor(role))}>{role} · {count}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between py-5 mt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex -space-x-2">
                    {team.members.slice(0, 5).map((m, i) => (
                      <div key={i} title={m.userId?.name} className="h-9 w-9 rounded-full ds-surface-subtle border border-[var(--border-subtle)] flex items-center justify-center text-xs font-semibold text-theme-primary">
                        {m.userId?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    ))}
                    {team.members.length > 5 && (
                      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-semibold tabular-nums">
                        +{team.members.length - 5}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="ds-text-caption">{t('teamsPage.synergyNodes')}</p>
                    <p className="ds-text-h3 text-primary tabular-nums">{team.members.length}</p>
                  </div>
                </div>

                <Button variant="primary" size="md" rightIcon={<ArrowUpRight size={16} aria-hidden />} onClick={() => router.push(`/dashboard/teams/${team._id}`)} className="w-full">
                  {t('teamsPage.syncNode')}
                </Button>
              </motion.div>
            )
          })}
        </section>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setName(''); setDescription('') }} title={t('teamsPage.modalTitle')} description={t('teamsPage.modalSubtitle')} className="max-w-xl">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="nexus-designation" className="ds-text-label text-theme-secondary">{t('teamsPage.nodeDesignation')}</label>
            <Input id="nexus-designation" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('teamsPage.namePlaceholder')} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="strategic-directives" className="ds-text-label text-theme-secondary">{t('teamsPage.strategicDirectives')}</label>
            <Textarea id="strategic-directives" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('teamsPage.descriptionPlaceholder')} rows={4} />
          </div>
          <footer className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="md" onClick={() => { setShowCreateModal(false); setName(''); setDescription('') }} className="text-rose-500">{t('teamsPage.abortGenesis')}</Button>
            <Button variant="primary" size="md" onClick={handleClusterGenesis} loading={creating} disabled={creating || !name.trim()} rightIcon={!creating ? <ArrowRight size={16} aria-hidden /> : undefined}>
              {t('teamsPage.commitNode')}
            </Button>
          </footer>
        </div>
      </Modal>
    </div>
  )
}
