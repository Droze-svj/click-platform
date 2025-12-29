'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Settings, Users, Clock, CheckCircle, X } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Approver {
  userId: string
  name: string
  role: 'required' | 'optional' | 'any'
  order: number
}

interface Stage {
  order: number
  name: string
  description: string
  approvers: Approver[]
  approvalType: 'all' | 'any' | 'majority'
  autoApprove: boolean
  autoApproveAfter: number | null
  canReject: boolean
  canRequestChanges: boolean
}

interface Workflow {
  _id?: string
  name: string
  description: string
  teamId?: string
  isDefault: boolean
  stages: Stage[]
  settings: {
    allowParallelApprovals: boolean
    notifyOnStageChange: boolean
    notifyOnRejection: boolean
    allowCreatorEdit: boolean
    requireAllStages: boolean
  }
}

export default function ApprovalWorkflowBuilder({ 
  workflowId, 
  onSave 
}: { 
  workflowId?: string
  onSave?: () => void 
}) {
  const [workflow, setWorkflow] = useState<Workflow>({
    name: '',
    description: '',
    isDefault: false,
    stages: [],
    settings: {
      allowParallelApprovals: false,
      notifyOnStageChange: true,
      notifyOnRejection: true,
      allowCreatorEdit: true,
      requireAllStages: true
    }
  })
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<Array<{ _id: string; name: string; email: string }>>([])

  useEffect(() => {
    loadUsers()
    if (workflowId) {
      loadWorkflow()
    }
  }, [workflowId])

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/teams/members`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setUsers(response.data.data.members || [])
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadWorkflow = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/approvals/workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        const found = response.data.data.workflows.find((w: any) => w._id === workflowId)
        if (found) {
          setWorkflow(found)
        }
      }
    } catch (error) {
      console.error('Error loading workflow:', error)
    }
  }

  const addStage = () => {
    const newStage: Stage = {
      order: workflow.stages.length,
      name: `Stage ${workflow.stages.length + 1}`,
      description: '',
      approvers: [],
      approvalType: 'all',
      autoApprove: false,
      autoApproveAfter: null,
      canReject: true,
      canRequestChanges: true
    }
    setWorkflow({
      ...workflow,
      stages: [...workflow.stages, newStage]
    })
  }

  const removeStage = (index: number) => {
    const newStages = workflow.stages
      .filter((_, i) => i !== index)
      .map((stage, i) => ({ ...stage, order: i }))
    setWorkflow({ ...workflow, stages: newStages })
  }

  const updateStage = (index: number, updates: Partial<Stage>) => {
    const newStages = [...workflow.stages]
    newStages[index] = { ...newStages[index], ...updates }
    setWorkflow({ ...workflow, stages: newStages })
  }

  const addApprover = (stageIndex: number) => {
    const newStages = [...workflow.stages]
    newStages[stageIndex].approvers.push({
      userId: '',
      name: '',
      role: 'required',
      order: newStages[stageIndex].approvers.length
    })
    setWorkflow({ ...workflow, stages: newStages })
  }

  const removeApprover = (stageIndex: number, approverIndex: number) => {
    const newStages = [...workflow.stages]
    newStages[stageIndex].approvers = newStages[stageIndex].approvers.filter(
      (_, i) => i !== approverIndex
    )
    setWorkflow({ ...workflow, stages: newStages })
  }

  const saveWorkflow = async () => {
    if (!workflow.name.trim()) {
      alert('Workflow name is required')
      return
    }

    if (workflow.stages.length === 0) {
      alert('At least one stage is required')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/approvals/workflows`,
        workflow,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        alert('Workflow saved successfully!')
        onSave?.()
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error saving workflow')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Approval Workflow Builder
        </h2>
        <button
          onClick={saveWorkflow}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>

      {/* Basic Info */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Workflow Name *
          </label>
          <input
            type="text"
            value={workflow.name}
            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder="e.g., Standard Content Approval"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={workflow.description}
            onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={3}
            placeholder="Describe this workflow..."
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={workflow.isDefault}
            onChange={(e) => setWorkflow({ ...workflow, isDefault: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label className="text-sm text-gray-700 dark:text-gray-300">
            Set as default workflow
          </label>
        </div>
      </div>

      {/* Stages */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Approval Stages
          </h3>
          <button
            onClick={addStage}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Stage
          </button>
        </div>

        {workflow.stages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No stages yet. Click "Add Stage" to create your first approval stage.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflow.stages.map((stage, stageIndex) => (
              <div
                key={stageIndex}
                className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-semibold">
                      Stage {stage.order + 1}
                    </span>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => updateStage(stageIndex, { name: e.target.value })}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-semibold"
                      placeholder="Stage name"
                    />
                  </div>
                  <button
                    onClick={() => removeStage(stageIndex)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={stage.description}
                      onChange={(e) => updateStage(stageIndex, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      rows={2}
                      placeholder="Stage description..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Approval Type
                    </label>
                    <select
                      value={stage.approvalType}
                      onChange={(e) => updateStage(stageIndex, { approvalType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="all">All approvers must approve</option>
                      <option value="any">Any approver can approve</option>
                      <option value="majority">Majority must approve</option>
                    </select>
                  </div>

                  {/* Approvers */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Approvers
                      </label>
                      <button
                        onClick={() => addApprover(stageIndex)}
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Approver
                      </button>
                    </div>
                    {stage.approvers.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No approvers added. Add at least one approver.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stage.approvers.map((approver, approverIndex) => (
                          <div
                            key={approverIndex}
                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded"
                          >
                            <select
                              value={approver.userId}
                              onChange={(e) => {
                                const user = users.find(u => u._id === e.target.value)
                                const newStages = [...workflow.stages]
                                newStages[stageIndex].approvers[approverIndex] = {
                                  ...approver,
                                  userId: e.target.value,
                                  name: user?.name || ''
                                }
                                setWorkflow({ ...workflow, stages: newStages })
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">Select approver...</option>
                              {users.map(user => (
                                <option key={user._id} value={user._id}>
                                  {user.name} ({user.email})
                                </option>
                              ))}
                            </select>
                            <select
                              value={approver.role}
                              onChange={(e) => {
                                const newStages = [...workflow.stages]
                                newStages[stageIndex].approvers[approverIndex].role = e.target.value as any
                                setWorkflow({ ...workflow, stages: newStages })
                              }}
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            >
                              <option value="required">Required</option>
                              <option value="optional">Optional</option>
                              <option value="any">Any</option>
                            </select>
                            <button
                              onClick={() => removeApprover(stageIndex, approverIndex)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stage Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.autoApprove}
                        onChange={(e) => updateStage(stageIndex, { autoApprove: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-approve
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.canReject}
                        onChange={(e) => updateStage(stageIndex, { canReject: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Can reject
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={stage.canRequestChanges}
                        onChange={(e) => updateStage(stageIndex, { canRequestChanges: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label className="text-sm text-gray-700 dark:text-gray-300">
                        Can request changes
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Workflow Settings
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workflow.settings.allowParallelApprovals}
              onChange={(e) => setWorkflow({
                ...workflow,
                settings: { ...workflow.settings, allowParallelApprovals: e.target.checked }
              })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Allow parallel approvals
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workflow.settings.notifyOnStageChange}
              onChange={(e) => setWorkflow({
                ...workflow,
                settings: { ...workflow.settings, notifyOnStageChange: e.target.checked }
              })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Notify on stage change
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workflow.settings.notifyOnRejection}
              onChange={(e) => setWorkflow({
                ...workflow,
                settings: { ...workflow.settings, notifyOnRejection: e.target.checked }
              })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Notify on rejection
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workflow.settings.allowCreatorEdit}
              onChange={(e) => setWorkflow({
                ...workflow,
                settings: { ...workflow.settings, allowCreatorEdit: e.target.checked }
              })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Allow creator to edit
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}


