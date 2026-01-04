'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import EnhancedWorkflowBuilder from '../../../components/EnhancedWorkflowBuilder'
import WorkflowTemplates from '../../../components/WorkflowTemplates'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Workflow {
  _id: string
  name: string
  description: string
  steps: Array<{
    order: number
    action: string
    config: any
  }>
  frequency: number
  lastUsed: string
  isTemplate: boolean
  tags: string[]
}

export default function WorkflowsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    steps: [] as Array<{ action: string; config: any }>
  })

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadData()
  }, [user, router])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [workflowsRes, suggestionsRes] = await Promise.all([
        axios.get(`${API_URL}/workflows`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        axios.get(`${API_URL}/workflows/suggestions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      ])

      if (workflowsRes.data.success) {
        setWorkflows(workflowsRes.data.data || [])
      }
      if (suggestionsRes.data.success) {
        setSuggestions(suggestionsRes.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load workflows', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async (workflowId: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/workflows/${workflowId}/execute`,
        { data: {} },
        {
        }
      )

      if (response.data.success) {
        showToast('Workflow executed successfully!', 'success')
        const workflow = response.data.data.workflow
        // Navigate to first step
        if (workflow.steps && workflow.steps.length > 0) {
          const firstAction = workflow.steps[0].action
          navigateToAction(firstAction)
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to execute workflow', 'error')
    }
  }

  const navigateToAction = (action: string) => {
    const routes: Record<string, string> = {
      'upload_video': '/dashboard/video',
      'generate_content': '/dashboard/content',
      'generate_script': '/dashboard/scripts',
      'create_quote': '/dashboard/quotes',
      'schedule_post': '/dashboard/scheduler'
    }
    if (routes[action]) {
      router.push(routes[action])
    }
  }

  const handleCreate = async () => {
    if (!newWorkflow.name || newWorkflow.steps.length === 0) {
      showToast('Name and at least one step are required', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/workflows`,
        newWorkflow,
        {
        }
      )

      if (response.data.success) {
        showToast('Workflow created successfully!', 'success')
        setShowCreateModal(false)
        setNewWorkflow({ name: '', description: '', steps: [] })
        await loadData()
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create workflow', 'error')
    }
  }

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.delete(`${API_URL}/workflows/${workflowId}`, {
      })
      showToast('Workflow deleted successfully', 'success')
      await loadData()
    } catch (error: any) {
      showToast('Failed to delete workflow', 'error')
    }
  }

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
          <div className="mb-8 animate-in fade-in duration-300">
            <h1 className="text-3xl font-bold mb-2">Workflows</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Automate your content creation process with powerful workflows
            </p>
          </div>

          {suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold mb-2">💡 Suggested Workflows</h2>
            <p className="text-sm text-gray-600 mb-3">
              Based on your usage patterns, we've detected these common workflows:
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded p-3">
                  <div>
                    <p className="font-medium">{suggestion.title}</p>
                    <p className="text-sm text-gray-600">{suggestion.description}</p>
                  </div>
                  {suggestion.workflowId && (
                    <button
                      onClick={() => handleExecute(suggestion.workflowId)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Use Workflow
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <div key={workflow._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{workflow.name}</h3>
                  {workflow.description && (
                    <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
                  )}
                </div>
                {workflow.isTemplate && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                    Template
                  </span>
                )}
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Steps:</p>
                <div className="space-y-1">
                  {workflow.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-xs">
                        {step.order}
                      </span>
                      <span className="text-gray-700 capitalize">
                        {step.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>Used {workflow.frequency} time{workflow.frequency !== 1 ? 's' : ''}</span>
                {workflow.lastUsed && (
                  <span>
                    {new Date(workflow.lastUsed).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExecute(workflow._id)}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  Execute
                </button>
                <button
                  onClick={() => handleDelete(workflow._id)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          </div>

          {workflows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No workflows yet. Create your first workflow!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Create Workflow
            </button>
          </div>
          )}

          {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Create Workflow</h2>
              
              <div className="mb-4">
                <label htmlFor="workflow-name" className="block text-sm font-medium mb-2">Name *</label>
                <input
                  id="workflow-name"
                  name="workflowName"
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g., Video to Social Media"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="workflow-description" className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  id="workflow-description"
                  name="workflowDescription"
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Describe this workflow..."
                />
              </div>

              <div className="mb-4">
                <label htmlFor="workflow-steps" className="block text-sm font-medium mb-2">Steps *</label>
                <div className="space-y-2">
                  {newWorkflow.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{index + 1}.</span>
                      <select
                        value={step.action}
                        onChange={(e) => {
                          const updated = [...newWorkflow.steps]
                          updated[index].action = e.target.value
                          setNewWorkflow({ ...newWorkflow, steps: updated })
                        }}
                        className="flex-1 px-3 py-1 border rounded text-sm"
                      >
                        <option value="">Select action...</option>
                        <option value="upload_video">Upload Video</option>
                        <option value="generate_content">Generate Content</option>
                        <option value="generate_script">Generate Script</option>
                        <option value="create_quote">Create Quote</option>
                        <option value="schedule_post">Schedule Post</option>
                        <option value="apply_effects">Apply Effects</option>
                        <option value="add_music">Add Music</option>
                        <option value="export">Export</option>
                      </select>
                      <button
                        onClick={() => {
                          const updated = newWorkflow.steps.filter((_, i) => i !== index)
                          setNewWorkflow({ ...newWorkflow, steps: updated })
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setNewWorkflow({
                        ...newWorkflow,
                        steps: [...newWorkflow.steps, { action: '', config: {} }]
                      })
                    }}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-500 hover:text-purple-600"
                  >
                    + Add Step
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewWorkflow({ name: '', description: '', steps: [] })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Workflow Templates Section */}
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* <WorkflowTemplates /> */}
          </div>

          {/* Enhanced Workflow Builder */}
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <EnhancedWorkflowBuilder />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

