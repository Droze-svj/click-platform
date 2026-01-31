'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play,
  Trash2,
  Pencil,
  CopyPlus,
  Plus,
  X,
  ChevronRight,
  Sparkles,
  Users,
  Tag,
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

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
  { value: 'upload_video', label: 'Upload Video' },
  { value: 'generate_content', label: 'Generate Content' },
  { value: 'generate_script', label: 'Generate Script' },
  { value: 'create_quote', label: 'Create Quote' },
  { value: 'schedule_post', label: 'Schedule Post' },
  { value: 'apply_effects', label: 'Apply Effects' },
  { value: 'add_music', label: 'Add Music' },
  { value: 'export', label: 'Export' },
]

const ACTION_ROUTES: Record<string, string> = {
  upload_video: '/dashboard/video',
  generate_content: '/dashboard/content',
  generate_script: '/dashboard/scripts',
  create_quote: '/dashboard/quotes',
  schedule_post: '/dashboard/scheduler',
}

export default function WorkflowsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    teamId: '' as string,
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
      const t = extractApiData<Team[]>(teamsRes as any) ?? (teamsRes as any)?.data
      setWorkflows(Array.isArray(wf) ? wf : [])
      setSuggestions(Array.isArray(sug) ? sug : [])
      setTeams(Array.isArray(t) ? t : [])
    } catch (e) {
      showToast('Failed to load workflows', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadData()
  }, [user, router, loadData])

  const handleExecute = async (workflowId: string) => {
    setExecutingId(workflowId)
    try {
      const res = await apiPost<{ data?: { workflow?: Workflow } }>(
        `/workflows/${workflowId}/execute`,
        { data: {} }
      )
      const data = (res as any)?.data
      const workflow = data?.workflow
      showToast('Workflow started', 'success')
      if (workflow?.steps?.length) {
        const route = ACTION_ROUTES[workflow.steps[0].action]
        if (route) router.push(route)
      }
      await loadData()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Execution failed', 'error')
    } finally {
      setExecutingId(null)
    }
  }

  const openCreate = () => {
    setEditingWorkflow(null)
    setForm({
      name: '',
      description: '',
      teamId: '',
      steps: [{ action: '', config: {} }],
      isTemplate: false,
      tags: '',
    })
    setShowCreateModal(true)
  }

  const openEdit = (w: Workflow) => {
    setEditingWorkflow(w)
    setForm({
      name: w.name,
      description: w.description || '',
      teamId: (w as any).teamId ?? '',
      steps:
        w.steps?.length > 0
          ? w.steps.map((s) => ({ action: s.action, config: s.config || {} }))
          : [{ action: '', config: {} }],
      isTemplate: w.isTemplate ?? false,
      tags: Array.isArray(w.tags) ? w.tags.join(', ') : '',
    })
    setShowCreateModal(true)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingWorkflow(null)
  }

  const validSteps = form.steps.filter((s) => s.action)

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error')
      return
    }
    if (validSteps.length === 0) {
      showToast('Add at least one step with an action', 'error')
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      teamId: form.teamId || undefined,
      steps: validSteps.map((s) => ({ action: s.action, config: s.config })),
      isTemplate: form.isTemplate,
      tags: form.tags
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    }

    try {
      if (editingWorkflow) {
        await apiPut(`/workflows/${editingWorkflow._id}`, payload)
        showToast('Workflow updated', 'success')
      } else {
        await apiPost('/workflows', payload)
        showToast('Workflow created', 'success')
      }
      closeModal()
      await loadData()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Save failed', 'error')
    }
  }

  const handleDuplicate = async (w: Workflow) => {
    try {
      await apiPost(`/workflows/${w._id}/duplicate`, {})
      showToast('Workflow duplicated', 'success')
      await loadData()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Duplicate failed', 'error')
    }
  }

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Delete this workflow?')) return
    try {
      await apiDelete(`/workflows/${workflowId}`)
      showToast('Workflow deleted', 'success')
      await loadData()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Delete failed', 'error')
    }
  }

  const teamName = (id: string) => teams.find((t) => t._id === id)?.name

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading workflows..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Workflows</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Automate content creation and collaborate with your team
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6">
              <h2 className="font-semibold flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Suggested workflows
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Based on your usage
              </p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{s.description}</p>
                    </div>
                    {s.workflowId && (
                      <button
                        onClick={() => handleExecute(s.workflowId)}
                        disabled={!!executingId}
                        className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
                      >
                        Use
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((w) => (
              <div
                key={w._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg truncate">{w.name}</h3>
                    {w.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {w.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {w.isTemplate && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs">
                        Template
                      </span>
                    )}
                    {(w as any).teamId && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        title={teamName((w as any).teamId) || 'Team'}
                      >
                        <Users className="w-3 h-3" />
                        {teamName((w as any).teamId) || 'Team'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Steps</p>
                  <div className="space-y-1.5">
                    {w.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-medium">
                          {step.order}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 capitalize">
                          {step.action.replace(/_/g, ' ')}
                        </span>
                        {i < w.steps.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {w.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {w.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                      >
                        <Tag className="w-3 h-3" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span>
                    Used {w.frequency} time{w.frequency !== 1 ? 's' : ''}
                    {w.lastUsed && ` · ${new Date(w.lastUsed).toLocaleDateString()}`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => handleExecute(w._id)}
                    disabled={!!executingId}
                    className="inline-flex items-center gap-1.5 flex-1 min-w-[100px] justify-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50"
                  >
                    {executingId === w._id ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Run
                  </button>
                  <button
                    onClick={() => openEdit(w)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(w)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    title="Duplicate"
                  >
                    <CopyPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(w._id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {workflows.length === 0 && !suggestions.length && (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                No workflows yet. Create one to automate your content pipeline.
              </p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
                Create Workflow
              </button>
            </div>
          )}

          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    {editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      placeholder="e.g. Video to Social"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      rows={2}
                      placeholder="What this workflow does..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Assign to team (optional)</label>
                    <select
                      value={form.teamId}
                      onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <option value="">Personal only</option>
                      {teams.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tags (comma‑separated)</label>
                    <input
                      value={form.tags}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      placeholder="e.g. youtube, shorts, weekly"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="template"
                      checked={form.isTemplate}
                      onChange={(e) => setForm((f) => ({ ...f, isTemplate: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor="template" className="text-sm">
                      Save as template
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Steps *</label>
                    <div className="space-y-2">
                      {form.steps.map((step, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <span className="text-sm font-medium w-6">{i + 1}.</span>
                          <select
                            value={step.action}
                            onChange={(e) => {
                              const up = [...form.steps]
                              up[i] = { ...up[i], action: e.target.value }
                              setForm((f) => ({ ...f, steps: up }))
                            }}
                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                          >
                            <option value="">Select action...</option>
                            {ACTIONS.map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const up = form.steps.filter((_, j) => j !== i)
                              setForm((f) => ({ ...f, steps: up.length ? up : [{ action: '', config: {} }] }))
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            steps: [...f.steps, { action: '', config: {} }],
                          }))
                        }
                        className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-purple-500 hover:text-purple-600 text-sm"
                      >
                        + Add step
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingWorkflow ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
