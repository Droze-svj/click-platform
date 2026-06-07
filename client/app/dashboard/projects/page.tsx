'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FolderKanban, Plus, Target, RefreshCw, Activity, CheckCircle2,
  Circle, Zap, Layers, Clock, Link2, ChevronDown, Pencil,
} from 'lucide-react'
import { SwarmConsensusHUD } from '../../../components/editor/SwarmConsensusHUD'
import { motion, useReducedMotion } from 'framer-motion'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, ListItemSkeleton } from '../../../components/LoadingSkeleton'
import { useTranslation } from '../../../hooks/useTranslation'
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

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Milestone {
  _id: string
  title: string
  description?: string
  dueDate?: string | null
  completedAt?: string | null
  dependencyMilestoneIds?: string[]
  estimatedDays?: number
  order?: number
  linkedTaskId?: string | null
  linkedContentId?: string | null
  linkedWorkflowId?: string | null
  automation?: { onComplete: string; config?: Record<string, unknown> }
  criticalPathInfo?: { earliestStart: number; earliestFinish: number; isOnCriticalPath: boolean }
}

interface PmProject {
  _id: string
  name: string
  description?: string
  status: string
  startDate?: string | null
  targetEndDate?: string | null
  progress: number
  milestones?: Milestone[]
  criticalPath?: Record<string, { earliestStart: number; earliestFinish: number; isOnCriticalPath: boolean }>
  criticalPathTotalDays?: number
  aiPredictedCompletionDate?: string | null
  aiPredictionConfidence?: number | null
}

const statusColor: Record<string, string> = {
  planning: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  on_hold: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  completed: 'bg-primary/10 text-primary',
  archived: 'ds-surface-subtle text-theme-muted'
}

const statusLabel: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived'
}

export default function ProjectsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [projects, setProjects] = useState<PmProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<PmProject | null>(null)
  const [dashboard, setDashboard] = useState<PmProject | null>(null)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [predicting, setPredicting] = useState(false)
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneDays, setNewMilestoneDays] = useState(1)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editEstimatedDays, setEditEstimatedDays] = useState(1)
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list')
  const [projectStatus, setProjectStatus] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const [showSwarmHUD, setShowSwarmHUD] = useState(false)
  const [swarmHUDTask, setSwarmHUDTask] = useState('')

  const loadProjects = useCallback(async () => {
    try {
      const res: any = await apiGet('/pm/projects')
      setProjects(res?.data?.projects ?? res?.projects ?? [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadProjects()
  }, [user, loadProjects])

  const loadProjectDashboard = useCallback(async (id: string) => {
    setLoadingDashboard(true)
    try {
      const res: any = await apiGet(`/pm/projects/${id}/dashboard`)
      const d = res?.data ?? res
      setDashboard(d)
      if (d?.status) setProjectStatus(d.status)
    } catch {
      setDashboard(null)
    } finally {
      setLoadingDashboard(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProject?._id) loadProjectDashboard(selectedProject._id)
    else setDashboard(null)
  }, [selectedProject?._id, loadProjectDashboard])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await apiPost('/pm/projects', { name: newName.trim(), description: newDescription.trim(), status: 'planning' })
      setShowCreate(false); setNewName(''); setNewDescription(''); await loadProjects()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastMissionInitialized'), type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastCreateFailed'), type: 'error' } }))
    } finally { setCreating(false) }
  }

  const completeMilestone = async (projectId: string, milestoneId: string) => {
    try {
      await apiPost(`/pm/projects/${projectId}/milestones/${milestoneId}/complete`, {})
      loadProjectDashboard(projectId); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastCompleteMilestoneFailed'), type: 'error' } }))
    }
  }

  const addMilestone = async () => {
    if (!selectedProject?._id || !newMilestoneTitle.trim()) return
    setAddingMilestone(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/milestones`, {
        title: newMilestoneTitle.trim(), estimatedDays: newMilestoneDays, dependencyMilestoneIds: []
      })
      setShowAddMilestone(false); setNewMilestoneTitle(''); setNewMilestoneDays(1); loadProjectDashboard(selectedProject._id); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastAddMilestoneFailed'), type: 'error' } }))
    } finally { setAddingMilestone(false) }
  }

  const saveMilestone = async () => {
    if (!dashboard?._id || !editingMilestone) return
    try {
      await apiPut(`/pm/projects/${dashboard._id}/milestones/${editingMilestone._id}`, {
        title: editTitle.trim(), dueDate: editDueDate ? new Date(editDueDate).toISOString() : null, estimatedDays: editEstimatedDays, dependencyMilestoneIds: []
      })
      setEditingMilestone(null); loadProjectDashboard(dashboard._id); await loadProjects()
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastSaveMilestoneFailed'), type: 'error' } }))
    }
  }

  const updateProjectStatus = async (status: string) => {
    if (!dashboard?._id) return
    setSavingProject(true)
    try {
      await apiPut(`/pm/projects/${dashboard._id}`, { status }); setProjectStatus(status); loadProjectDashboard(dashboard._id); await loadProjects()
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastStatusUpdated'), type: 'success' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastStatusUpdateFailed'), type: 'error' } }))
    } finally { setSavingProject(false) }
  }

  const runPredict = async () => {
    if (!selectedProject?._id) return
    setPredicting(true); setSwarmHUDTask(t('projectsPage.analyzingTrajectory')); setShowSwarmHUD(true)
    try {
      await apiPost(`/pm/projects/${selectedProject._id}/predict`, {})
      loadProjectDashboard(selectedProject._id)
    } catch {
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: t('projectsPage.toastPredictFailed'), type: 'error' } }))
    } finally { setPredicting(false) }
  }

  if (loading) return (
     <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-6" aria-busy="true" aria-label={t('projectsPage.loading')}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
        <div className="space-y-3">
           {Array.from({ length: 5 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
     </div>
  )

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />
        <SwarmConsensusHUD isVisible={showSwarmHUD} taskName={swarmHUDTask} onComplete={() => setShowSwarmHUD(false)} />

        {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
        <SectionHeader
          as="h1"
          title={t('projectsPage.title')}
          description={t('projectsPage.activeCount', { count: projects.length })}
          className="mb-6"
          actions={
            <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={() => setShowCreate(true)}>
              {t('projectsPage.initializeMission')}
            </Button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Sidebar — Project List ── */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-3">
            <h2 className="ds-text-label text-theme-muted flex items-center gap-2 px-1">
              <FolderKanban size={14} aria-hidden /> {t('projectsPage.projectMatrix')}
            </h2>
            <div className="space-y-2.5 max-h-[800px] overflow-y-auto pr-1">
              {projects.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedProject(p)}
                  className={cn(
                    'w-full text-left rounded-2xl p-4 border transition-colors',
                    selectedProject?._id === p._id
                      ? 'border-primary bg-primary/5'
                      : 'border-[var(--border-subtle)] ds-surface-subtle hover:bg-accent'
                  )}
                >
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="ds-text-label text-theme-primary truncate pr-2">{p.name}</span>
                    <Badge className={cn('flex-shrink-0', statusColor[p.status])}>
                      {t(`projectsPage.status_${p.status}`) || statusLabel[p.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 ds-text-caption">
                    <span className="inline-flex items-center gap-1.5"><Activity size={13} aria-hidden /> {p.progress}%</span>
                    <span className="inline-flex items-center gap-1.5"><Layers size={13} aria-hidden /> {p.milestones?.length || 0}</span>
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <EmptyState icon={FolderKanban} title={t('projectsPage.noMissionsLogged')} className="ds-surface-subtle" />
              )}
            </div>
          </aside>

          {/* ── Main — Project Dashboard ── */}
          <main className="lg:col-span-8 xl:col-span-9 min-w-0">
            {!selectedProject ? (
              <EmptyState
                icon={FolderKanban}
                title={t('projectsPage.awaitingAssignment')}
                description={t('projectsPage.awaitingAssignmentDescription')}
                className="ds-surface-card min-h-[500px]"
              />
            ) : loadingDashboard ? (
              <Panel variant="bento" className="flex flex-col items-center justify-center gap-3 min-h-[500px]">
                <RefreshCw className="text-primary animate-spin" size={32} aria-hidden />
                <span className="ds-text-label text-theme-muted">{t('projectsPage.syncingProjectNode')}</span>
              </Panel>
            ) : dashboard ? (
              <div className="space-y-6">
                {/* Project Summary */}
                <Panel variant="bento">
                  <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={statusColor[dashboard.status]}>
                          {t(`projectsPage.status_${dashboard.status}`) || statusLabel[dashboard.status]}
                        </Badge>
                        <Badge variant="secondary">{t('projectsPage.idLabel', { id: dashboard._id.slice(-8).toUpperCase() })}</Badge>
                      </div>
                      <h2 className="ds-text-h2 text-theme-primary">{dashboard.name}</h2>
                      <p className="text-sm text-theme-muted leading-relaxed max-w-2xl">{dashboard.description || t('projectsPage.missionParametersUndefined')}</p>
                    </div>

                    <div className="flex flex-col gap-1.5 w-full xl:w-72 flex-shrink-0">
                      <label className="ds-text-label text-theme-secondary">{t('projectsPage.operationalStatus')}</label>
                      <div className="relative">
                        <select aria-label={t('projectsPage.operationalStatus')}
                          value={projectStatus || dashboard.status}
                          onChange={(e) => updateProjectStatus(e.target.value)}
                          disabled={savingProject}
                          className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:opacity-50"
                        >
                          <option value="planning">{t('projectsPage.optionPlanning')}</option>
                          <option value="active">{t('projectsPage.optionActive')}</option>
                          <option value="on_hold">{t('projectsPage.optionOnHold')}</option>
                          <option value="completed">{t('projectsPage.optionCompleted')}</option>
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" aria-hidden />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                    {/* Progress (real) */}
                    <div className="ds-surface-subtle p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="ds-text-label text-theme-muted">{t('projectsPage.neuralProgress')}</p>
                        <Activity size={16} className="text-primary" aria-hidden />
                      </div>
                      <span className="ds-text-h2 text-theme-primary tabular-nums">{dashboard.progress}%</span>
                      <div className="h-1.5 w-full ds-surface-card rounded-full overflow-hidden">
                        <motion.div initial={reduceMotion ? false : { width: 0 }} animate={{ width: `${dashboard.progress}%` }} transition={{ duration: reduceMotion ? 0 : 1 }} className="h-full bg-primary" />
                      </div>
                    </div>

                    {/* AI Forecast (real or honest-empty) */}
                    <div className="ds-surface-subtle p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="ds-text-label text-theme-muted">{t('projectsPage.aiForecast')}</p>
                        <Zap size={16} className="text-emerald-500" aria-hidden />
                      </div>
                      {dashboard.aiPredictedCompletionDate ? (
                        <div className="space-y-1">
                          <span className="ds-text-h3 text-emerald-600 dark:text-emerald-400 block">{new Date(dashboard.aiPredictedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="ds-text-caption">{t('projectsPage.confidenceStability', { percent: Math.round((dashboard.aiPredictionConfidence ?? 0) * 100) })}</span>
                        </div>
                      ) : (
                        <p className="ds-text-caption">{t('projectsPage.nullPrediction')}</p>
                      )}
                    </div>

                    {/* Run forecast */}
                    <button
                      type="button"
                      onClick={runPredict}
                      disabled={predicting}
                      className="ds-surface-subtle hover:bg-accent flex flex-col items-center justify-center gap-2 p-4 transition-colors disabled:opacity-50"
                    >
                      <Zap size={28} className={cn('text-primary', predicting && 'animate-pulse')} aria-hidden />
                      <span className="ds-text-label text-theme-primary">{predicting ? t('projectsPage.calibrating') : t('projectsPage.runForecast')}</span>
                    </button>
                  </div>
                </Panel>

                {/* Milestones / Objectives */}
                <Panel variant="bento">
                  <SectionHeader
                    as="h3"
                    title={t('projectsPage.objectivesMatrix')}
                    description={t('projectsPage.objectivesMatrixSubtitle')}
                    className="mb-6 pb-5 border-b border-[var(--border-subtle)]"
                    actions={
                      <>
                        <div className="flex items-center gap-1 p-1 rounded-lg ds-surface-subtle">
                          <button type="button" onClick={() => setViewMode('list')} className={cn('rounded-md px-3 h-8 text-xs font-medium transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary')}>{t('projectsPage.viewMatrix')}</button>
                          <button type="button" onClick={() => setViewMode('gantt')} className={cn('rounded-md px-3 h-8 text-xs font-medium transition-colors', viewMode === 'gantt' ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:text-theme-primary')}>{t('projectsPage.viewChronology')}</button>
                        </div>
                        <Button variant="secondary" size="sm" leftIcon={<Plus size={14} aria-hidden />} onClick={() => setShowAddMilestone(true)}>{t('projectsPage.append')}</Button>
                      </>
                    }
                  />

                  <div className="min-h-[300px]">
                    {!dashboard.milestones?.length ? (
                      <EmptyState icon={Target} title={t('projectsPage.nullObjectiveSet')} />
                    ) : viewMode === 'gantt' ? (
                      <div className="space-y-3 overflow-x-auto pb-2">
                        {dashboard.milestones.map((m) => {
                          const totalDays = Math.max(1, dashboard.criticalPathTotalDays || 1)
                          const startPct = ((m.criticalPathInfo?.earliestStart || 0) / totalDays) * 100
                          const widthPct = Math.max(15, (((m.criticalPathInfo?.earliestFinish || 0) - (m.criticalPathInfo?.earliestStart || 0)) / totalDays) * 100)
                          return (
                            <div key={m._id} className="flex items-center gap-4 min-w-[700px] group">
                              <div className="w-64 truncate flex items-center gap-2.5">
                                <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', m.completedAt ? 'bg-emerald-500' : m.criticalPathInfo?.isOnCriticalPath ? 'bg-primary' : 'bg-theme-muted')} />
                                <span className={cn('text-sm font-medium', m.completedAt ? 'text-theme-muted line-through' : 'text-theme-primary')}>{m.title}</span>
                              </div>
                              <div className="flex-1 h-7 ds-surface-subtle rounded-lg relative overflow-hidden">
                                <motion.div
                                  initial={reduceMotion ? false : { scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ duration: reduceMotion ? 0 : 1 }}
                                  className={cn('absolute h-2.5 top-2 rounded-full', m.criticalPathInfo?.isOnCriticalPath ? 'bg-primary' : 'bg-theme-muted', m.completedAt && 'opacity-40')}
                                  style={{ left: `${startPct}%`, width: `${Math.min(widthPct, 100 - startPct)}%`, originX: 0 }}
                                />
                              </div>
                              <div className="w-20 text-right ds-text-caption">{t('projectsPage.dayGap', { days: m.estimatedDays || 0 })}</div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dashboard.milestones.map((m) => (
                          <div
                            key={m._id}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl border transition-colors group',
                              m.criticalPathInfo?.isOnCriticalPath ? 'border-primary/30 bg-primary/[0.03]' : 'border-[var(--border-subtle)] ds-surface-subtle',
                              m.completedAt && 'opacity-60'
                            )}
                          >
                            <button type="button" onClick={() => !m.completedAt && completeMilestone(dashboard._id, m._id)} aria-label={m.title} className="flex-shrink-0">
                              <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg border transition-colors', m.completedAt ? 'bg-emerald-500 border-emerald-500 text-white' : 'ds-surface-card border-[var(--border-subtle)] text-theme-muted hover:text-primary')}>
                                {m.completedAt ? <CheckCircle2 size={22} aria-hidden /> : <Circle size={22} aria-hidden />}
                              </span>
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className={cn('ds-text-label truncate', m.completedAt ? 'text-theme-muted line-through' : 'text-theme-primary')}>{m.title}</h4>
                                {m.criticalPathInfo?.isOnCriticalPath && !m.completedAt && (
                                  <Badge className="bg-primary/10 text-primary">{t('projectsPage.criticalPath')}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 flex-wrap">
                                <span className="ds-text-caption inline-flex items-center gap-1.5"><Clock size={13} className="text-primary" aria-hidden /> {t('projectsPage.daysToTarget', { days: m.estimatedDays || 0 })}</span>
                                {m.linkedTaskId && (
                                  <button type="button" onClick={() => router.push(`/dashboard/tasks?open=${m.linkedTaskId}`)} className="ds-text-caption text-primary inline-flex items-center gap-1.5 hover:underline"><Link2 size={13} aria-hidden /> {t('projectsPage.viewTaskNode')}</button>
                                )}
                              </div>
                            </div>

                            <IconButton
                              variant="ghost" size="sm"
                              onClick={() => { setEditTitle(m.title); setEditDueDate(m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : ''); setEditEstimatedDays(m.estimatedDays || 1); setEditingMilestone(m); }}
                              title={t('projectsPage.editObjective', { title: m.title })} aria-label={t('projectsPage.editObjective', { title: m.title })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            >
                              <Pencil size={16} aria-hidden />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
            ) : null}
          </main>
        </div>

        {/* ── Create Project Modal ── */}
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('projectsPage.initializeMission')} description={t('projectsPage.createModalSubtitle')}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('projectsPage.missionIdentifier')}</label>
              <Input type="text" placeholder={t('projectsPage.missionIdentifierPlaceholder')} value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('projectsPage.operationalBrief')}</label>
              <Textarea placeholder={t('projectsPage.operationalBriefPlaceholder')} rows={4} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowCreate(false)}>{t('projectsPage.abortMission')}</Button>
              <Button variant="primary" className="flex-1" onClick={handleCreate} loading={creating} disabled={creating || !newName.trim()} leftIcon={!creating ? <CheckCircle2 size={16} aria-hidden /> : undefined}>
                {creating ? t('projectsPage.synchronizing') : t('projectsPage.commitMission')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Add Objective Modal ── */}
        <Modal open={showAddMilestone} onClose={() => setShowAddMilestone(false)} title={t('projectsPage.appendObjective')} description={t('projectsPage.appendObjectiveSubtitle')}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('projectsPage.objectiveIdentifier')}</label>
              <Input type="text" title={t('projectsPage.nodeIdentifier')} aria-label={t('projectsPage.nodeIdentifier')} value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('projectsPage.temporalGap')}</label>
              <Input type="number" min={1} title={t('projectsPage.estimatedDays')} aria-label={t('projectsPage.estimatedDays')} value={newMilestoneDays} onChange={(e) => setNewMilestoneDays(Number(e.target.value) || 1)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowAddMilestone(false)}>{t('projectsPage.abort')}</Button>
              <Button variant="primary" className="flex-1" onClick={addMilestone} loading={addingMilestone} disabled={addingMilestone || !newMilestoneTitle.trim()} leftIcon={!addingMilestone ? <Target size={16} aria-hidden /> : undefined}>
                {addingMilestone ? t('projectsPage.injecting') : t('projectsPage.commitTarget')}
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Edit Objective Modal ── */}
        <Modal open={editingMilestone !== null} onClose={() => setEditingMilestone(null)} title={t('projectsPage.calibrateTarget')} description={t('projectsPage.calibrateTargetSubtitle')}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('projectsPage.nodeIdentifier')}</label>
              <Input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label={t('projectsPage.projectTitle')} title={t('projectsPage.projectTitle')} placeholder={t('projectsPage.projectTitle')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="ds-text-label text-theme-secondary">{t('projectsPage.targetDate')}</label>
                <Input type="date" title={t('projectsPage.targetDate')} aria-label={t('projectsPage.targetDate')} value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="ds-text-label text-theme-secondary">{t('projectsPage.gapDays')}</label>
                <Input type="number" value={editEstimatedDays} onChange={(e) => setEditEstimatedDays(Number(e.target.value) || 1)} aria-label={t('projectsPage.estimatedDaysLower')} title={t('projectsPage.estimatedDaysLower')} placeholder={t('projectsPage.daysPlaceholder')} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditingMilestone(null)}>{t('projectsPage.abort')}</Button>
              <Button variant="primary" className="flex-1" onClick={saveMilestone} leftIcon={<CheckCircle2 size={16} aria-hidden />}>{t('projectsPage.commitChanges')}</Button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
