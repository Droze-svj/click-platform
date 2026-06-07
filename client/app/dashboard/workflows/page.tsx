'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Play, Trash2, Pencil, Plus, X, ChevronRight,
  Sparkles, Zap, Cpu, Layers, RefreshCw,
  Workflow as WorkflowIcon, ChevronDown, Check,
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { StatsCardSkeleton, CardSkeleton } from '../../../components/LoadingSkeleton'
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

interface Workflow {
  _id: string
  name: string
  description: string
  teamId?: string | null
  steps: Array<{ order: number; action: string; config: any }>
  frequency: number
  lastUsed: string | null
  isTemplate: boolean
  tags: string[]
}

interface Team {
  _id: string
  name: string
}

const ACTIONS = [
  { value: 'upload_video', label: 'Video Upload & Calibration' },
  { value: 'generate_content', label: 'AI Content Generation' },
  { value: 'generate_script', label: 'AI Script Composition' },
  { value: 'create_quote', label: 'Social Quote Extraction' },
  { value: 'schedule_post', label: 'Smart Scheduling' },
  { value: 'apply_effects', label: 'Visual Effects Layer' },
  { value: 'add_music', label: 'Background Audio' },
  { value: 'export', label: 'Production Export' },
]

const ACTION_ROUTES: Record<string, string> = {
  upload_video: '/dashboard/video',
  generate_content: '/dashboard/content',
  generate_script: '/dashboard/scripts',
  create_quote: '/dashboard/quotes',
  schedule_post: '/dashboard/scheduler',
}

export default function WorkflowsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const reduceMotion = useReducedMotion()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [executionStep, setExecutionStep] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    teamId: '',
    steps: [] as Array<{ action: string; config: any }>,
    isTemplate: false,
    tags: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [wfRes, sugRes, teamsRes] = await Promise.all([
        apiGet('/workflows'),
        apiGet('/workflows/suggestions'),
        apiGet('/teams').catch(() => ({ data: [] })),
      ])
      const wf = extractApiData<Workflow[]>(wfRes as any) ?? (wfRes as any)?.data
      const sug = extractApiData<any[]>(sugRes as any) ?? (sugRes as any)?.data
      const tm = extractApiData<Team[]>(teamsRes as any) ?? (teamsRes as any)?.data
      setWorkflows(Array.isArray(wf) ? wf : [])
      setSuggestions(Array.isArray(sug) ? sug : [])
      setTeams(Array.isArray(tm) ? tm : [])
    } catch {
      showToast(t('workflowsPage.toastLoadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, loadData])

  const handleExecute = async (workflowId: string) => {
    const workflow = workflows.find(w => w._id === workflowId)
    setExecutingId(workflowId)
    setExecutionStep(0)

    try {
      if (workflow) {
        for (let i = 0; i < workflow.steps.length; i++) {
          setExecutionStep(i + 1)
          await new Promise(r => setTimeout(r, 800))
        }
      }

      const res = await apiPost<{ data?: { workflow?: Workflow } }>(`/workflows/${workflowId}/execute`, { data: {} })
      const updatedWorkflow = (res as any)?.data?.workflow
      showToast(t('workflowsPage.toastExecuteSuccess'), 'success')

      if (updatedWorkflow?.steps?.length) {
        const route = ACTION_ROUTES[updatedWorkflow.steps[0].action]
        if (route) {
          await new Promise(r => setTimeout(r, 500))
          router.push(route)
        }
      }
      loadData()
    } catch {
      showToast(t('workflowsPage.toastExecuteFailed'), 'error')
    } finally {
      setExecutingId(null)
      setExecutionStep(0)
    }
  }

  const handleSave = async () => {
    const validSteps = form.steps.filter(s => s.action)
    if (!form.name.trim() || validSteps.length === 0) {
      showToast(t('workflowsPage.toastNameStepsRequired'), 'error')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      teamId: form.teamId || undefined,
      steps: validSteps.map(s => ({ action: s.action, config: s.config })),
      isTemplate: form.isTemplate,
      tags: form.tags.split(/[\s,]+/).map(tag => tag.trim()).filter(Boolean),
    }

    try {
      if (editingWorkflow) await apiPut(`/workflows/${editingWorkflow._id}`, payload)
      else await apiPost('/workflows', payload)
      showToast(t('workflowsPage.toastSaved'), 'success')
      setEditingWorkflow(null); setShowCreateModal(false); loadData()
    } catch {
      showToast(t('workflowsPage.toastSaveFailed'), 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('workflowsPage.confirmDelete'))) return
    try {
      await apiDelete(`/workflows/${id}`)
      showToast(t('workflowsPage.toastDeleted'), 'success')
      loadData()
    } catch {
      showToast(t('workflowsPage.toastDeleteFailed'), 'error')
    }
  }

  const openCreate = () => {
    setEditingWorkflow(null)
    setForm({ name: '', description: '', teamId: '', steps: [{ action: '', config: {} }], isTemplate: false, tags: '' })
    setShowCreateModal(true)
  }

  if (loading) return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto space-y-8" aria-busy="true" aria-label={t('workflowsPage.loading')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  )

  const templateCount = workflows.filter(w => w.isTemplate).length
  const totalRuns = workflows.reduce((s, w) => s + (w.frequency || 0), 0)

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary space-y-8">
        <ToastContainer />

        <SectionHeader
          as="h1"
          title={t('workflowsPage.title')}
          description={t('workflowsPage.activeSequences', { count: workflows.length })}
          actions={
            <Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={openCreate}>
              {t('workflowsPage.initializeSequence')}
            </Button>
          }
        />

        {/* Stats (real counts) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('workflowsPage.automationHub')} value={workflows.length} icon={Layers} />
          <StatCard label={t('workflowsPage.templateDna')} value={templateCount} icon={WorkflowIcon} />
          <StatCard label={t('workflowsPage.yieldCycles')} value={totalRuns} icon={Zap} />
          <StatCard label={t('workflowsPage.neuralRecommendations')} value={suggestions.length} icon={Cpu} />
        </section>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Panel variant="bento" className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary"><Cpu size={22} aria-hidden /></div>
              <div>
                <h2 className="ds-text-h3 text-theme-primary">{t('workflowsPage.neuralRecommendations')}</h2>
                <p className="ds-text-caption">{t('workflowsPage.aiDrivenLattice')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestions.map((s, i) => (
                <div key={i} className="ds-surface-subtle ds-hover-lift rounded-2xl p-5 flex flex-col">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary mb-4"><Zap size={20} aria-hidden /></div>
                  <h3 className="ds-text-h3 text-theme-primary mb-2">{s.title}</h3>
                  <p className="ds-text-body text-theme-muted line-clamp-3 mb-4">{s.description}</p>
                  {s.workflowId && (
                    <Button variant="ghost" size="sm" disabled={!!executingId} onClick={() => handleExecute(s.workflowId)} rightIcon={<ChevronRight size={16} aria-hidden />} className="mt-auto self-start text-primary">
                      {t('workflowsPage.initializeStrand')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Workflow Grid */}
        {workflows.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t('workflowsPage.title')}
            description={t('workflowsPage.noDescription')}
            className="ds-surface-subtle"
            action={<Button variant="primary" size="md" leftIcon={<Plus size={16} aria-hidden />} onClick={openCreate}>{t('workflowsPage.initializeSequence')}</Button>}
          />
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {workflows.map((w) => (
              <motion.div
                key={w._id}
                layout
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="ds-surface-card ds-hover-lift p-6 flex flex-col"
              >
                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="min-w-0 flex-1">
                    <h3 className="ds-text-h3 text-theme-primary">{w.name}</h3>
                    <p className="ds-text-body text-theme-muted line-clamp-2 mt-1">{w.description || t('workflowsPage.noDescription')}</p>
                  </div>
                  {w.isTemplate && <Badge className="bg-primary/10 text-primary shrink-0">{t('workflowsPage.templateDna')}</Badge>}
                </div>

                <div className="space-y-2 mb-5">
                  <p className="ds-text-caption">{t('workflowsPage.protocolChain')}</p>
                  <div className="space-y-1.5">
                    {w.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg ds-surface-subtle">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-semibold text-theme-secondary tabular-nums">{step.order}</span>
                        <span className="ds-text-label text-theme-primary flex-1 truncate">{step.action.replace(/_/g, ' ')}</span>
                        {i < w.steps.length - 1 && <ChevronDown size={14} className="text-theme-muted" aria-hidden />}
                      </div>
                    ))}
                  </div>
                </div>

                {w.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {w.tags.map(tag => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
                  </div>
                )}

                <div className="flex items-center gap-6 py-4 mt-auto border-t border-[var(--border-subtle)] mb-4">
                  <div>
                    <p className="ds-text-caption">{t('workflowsPage.yieldCycles')}</p>
                    <p className="ds-text-h3 text-theme-primary tabular-nums">{w.frequency}</p>
                  </div>
                  {w.lastUsed && (
                    <div>
                      <p className="ds-text-caption">{t('workflowsPage.lastUplink')}</p>
                      <p className="ds-text-h3 text-theme-primary">{new Date(w.lastUsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="primary" size="md" disabled={!!executingId} loading={executingId === w._id} onClick={() => handleExecute(w._id)} leftIcon={executingId !== w._id ? <Play size={16} aria-hidden /> : undefined} className="flex-1">
                    {t('workflowsPage.initialize')}
                  </Button>
                  <IconButton variant="secondary" size="md" onClick={() => { setEditingWorkflow(w); setForm({ name: w.name, description: w.description || '', teamId: (w as any).teamId || '', steps: w.steps.map(s => ({ action: s.action, config: s.config || {} })), isTemplate: w.isTemplate, tags: w.tags.join(', ') }); setShowCreateModal(true) }} title={t('workflowsPage.editSequence')} aria-label={t('workflowsPage.editSequence')}>
                    <Pencil size={16} aria-hidden />
                  </IconButton>
                  <IconButton variant="secondary" size="md" onClick={() => handleDelete(w._id)} title={t('workflowsPage.purgeSequence')} aria-label={t('workflowsPage.purgeSequence')} className="text-rose-500">
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
              </motion.div>
            ))}
          </section>
        )}

        {/* Execution Overlay */}
        <AnimatePresence>
          {executingId && (
            <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
              <div className="ds-surface-elevated ds-anim-rise max-w-xl w-full p-8 space-y-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
                  <Zap size={32} className="text-primary animate-pulse" aria-hidden />
                </div>
                <div className="space-y-1">
                  <h2 className="ds-text-h2 text-theme-primary">{t('workflowsPage.protocolActive')}</h2>
                  <p className="ds-text-caption text-primary">{t('workflowsPage.sequentialEngineSync')}</p>
                </div>
                <div className="space-y-2 max-h-[360px] overflow-y-auto text-left">
                  {workflows.find(w => w._id === executingId)?.steps.map((step, i) => {
                    const done = executionStep > i + 1
                    const active = executionStep === i + 1
                    return (
                      <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border transition-colors', active ? 'border-primary bg-primary/5' : 'border-[var(--border-subtle)] ds-surface-subtle')}>
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold', done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-accent text-theme-muted')}>
                          {done ? <Check size={18} aria-hidden /> : step.order}
                        </span>
                        <span className={cn('ds-text-label flex-1 truncate', executionStep > i ? 'text-theme-primary' : 'text-theme-muted')}>{step.action.replace(/_/g, ' ')}</span>
                        {active && <RefreshCw size={16} className="text-primary animate-spin" aria-hidden />}
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Modal */}
        <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={editingWorkflow ? t('workflowsPage.modalTitleEdit') : t('workflowsPage.modalTitleCreate')} description={t('workflowsPage.modalSubtitle')} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('workflowsPage.protocolIdentifier')}</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('workflowsPage.namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <label className="ds-text-label text-theme-secondary">{t('workflowsPage.missionIntelligence')}</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder={t('workflowsPage.descriptionPlaceholder')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="ds-text-label text-theme-secondary">{t('workflowsPage.nodeAnchor')}</label>
                <div className="relative">
                  <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                    aria-label={t('workflowsPage.teamAnchor')} title={t('workflowsPage.teamAnchor')}
                    className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    <option value="">{t('workflowsPage.personalCortex')}</option>
                    {teams.map(team => <option key={team._id} value={team._id}>{team.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="ds-text-label text-theme-secondary">{t('workflowsPage.classificationVectors')}</label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder={t('workflowsPage.tagsPlaceholder')} />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
              <label className="ds-text-label text-theme-secondary">{t('workflowsPage.sequenceArchitecture')}</label>
              <div className="space-y-2">
                {form.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg ds-surface-subtle">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold tabular-nums">{i + 1}</span>
                    <div className="relative flex-1">
                      <select value={step.action}
                        onChange={e => { const up = [...form.steps]; up[i].action = e.target.value; setForm(f => ({ ...f, steps: up })) }}
                        aria-label={t('workflowsPage.stepAction', { num: i + 1 })} title={t('workflowsPage.stepAction', { num: i + 1 })}
                        className="w-full appearance-none rounded-lg border border-input bg-background px-3 h-10 pr-9 text-sm text-theme-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      >
                        <option value="">{t('workflowsPage.selectModuleAction')}</option>
                        {ACTIONS.map(a => <option key={a.value} value={a.value}>{t(`workflowsPage.action_${a.value}`)}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-theme-muted" aria-hidden />
                    </div>
                    <IconButton variant="ghost" size="md" onClick={() => { const up = form.steps.filter((_, j) => j !== i); setForm(f => ({ ...f, steps: up.length ? up : [{ action: '', config: {} }] })) }} title={t('workflowsPage.removeStep')} aria-label={t('workflowsPage.removeStep')} className="text-rose-500">
                      <X size={16} aria-hidden />
                    </IconButton>
                  </div>
                ))}
                <Button variant="secondary" size="md" onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { action: '', config: {} }] }))} leftIcon={<Plus size={16} aria-hidden />} className="w-full">
                  {t('workflowsPage.injectStratum')}
                </Button>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <Button variant="ghost" size="md" onClick={() => setShowCreateModal(false)} className="text-rose-500">{t('workflowsPage.abortMission')}</Button>
              <Button variant="primary" size="md" onClick={handleSave}>{t('workflowsPage.commitProtocol')}</Button>
            </footer>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
