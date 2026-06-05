'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'
import { useTranslation } from '@/hooks/useTranslation'

interface Workflow {
  id: string
  name: string
  description: string
  trigger: 'manual' | 'scheduled' | 'event'
  conditions: any[]
  actions: any[]
  enabled: boolean
  schedule?: any
}

interface WorkflowSuggestion {
  type: string
  name: string
  description: string
  trigger: string
  schedule?: any
  conditions?: any[]
  actions: any[]
}

export default function EnhancedWorkflowBuilder() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [suggestions, setSuggestions] = useState<WorkflowSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState<Partial<Workflow>>({
    name: '',
    description: '',
    trigger: 'manual',
    conditions: [],
    actions: [],
    enabled: true
  })

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await apiGet<{ success: boolean; data: Workflow[] }>('/workflows')
      if (response.success) {
        setWorkflows(response.data || [])
      }
    } catch (error) {
      showToast(t('enhancedWorkflowBuilder.failedToLoadWorkflows'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await apiGet<{ success: boolean; data: WorkflowSuggestion[] }>('/workflows/enhanced/suggestions')
      if (response.success) {
        setSuggestions(response.data || [])
      }
    } catch (error) {
      // Silent fail - suggestions are optional
      console.debug('Failed to load workflow suggestions:', error)
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadWorkflows()
      loadSuggestions()
    }
  }, [user, loadWorkflows, loadSuggestions])

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name) {
      showToast(t('enhancedWorkflowBuilder.pleaseEnterName'), 'error')
      return
    }

    try {
      await apiPost('/workflows/enhanced', newWorkflow)
      showToast(t('enhancedWorkflowBuilder.workflowCreated'), 'success')
      setShowCreateModal(false)
      setNewWorkflow({
        name: '',
        description: '',
        trigger: 'manual',
        conditions: [],
        actions: [],
        enabled: true
      })
      loadWorkflows()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('enhancedWorkflowBuilder.failedToCreate'), 'error')
    }
  }

  const handleUseSuggestion = (suggestion: WorkflowSuggestion) => {
    setNewWorkflow({
      name: suggestion.name,
      description: suggestion.description,
      trigger: suggestion.trigger as any,
      schedule: suggestion.schedule,
      conditions: suggestion.conditions || [],
      actions: suggestion.actions || [],
      enabled: true
    })
    setShowCreateModal(true)
  }

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      await apiPost(`/workflows/enhanced/${workflowId}/execute`, {})
      showToast(t('enhancedWorkflowBuilder.workflowExecuted'), 'success')
    } catch (error: any) {
      showToast(error.response?.data?.error || t('enhancedWorkflowBuilder.failedToExecute'), 'error')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text={t('enhancedWorkflowBuilder.loadingWorkflows')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t('enhancedWorkflowBuilder.workflowAutomation')}</h1>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            {t('enhancedWorkflowBuilder.createWorkflowButton')}
          </button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">{t('enhancedWorkflowBuilder.suggestedWorkflows')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700"
                >
                  <h3 className="font-semibold mb-2">{suggestion.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {suggestion.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUseSuggestion(suggestion)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t('enhancedWorkflowBuilder.useThisWorkflow')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflows List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{workflow.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {workflow.description}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    workflow.enabled
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {workflow.enabled ? t('enhancedWorkflowBuilder.statusActive') : t('enhancedWorkflowBuilder.statusDisabled')}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('enhancedWorkflowBuilder.triggerLabel')} <span className="font-semibold capitalize">{t(`enhancedWorkflowBuilder.trigger_${workflow.trigger}`)}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('enhancedWorkflowBuilder.actionsLabel')} <span className="font-semibold">{workflow.actions.length}</span>
                </p>
                {workflow.conditions.length > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('enhancedWorkflowBuilder.conditionsLabel')} <span className="font-semibold">{workflow.conditions.length}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteWorkflow(workflow.id)}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  {t('enhancedWorkflowBuilder.execute')}
                </button>
                <button className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                  {t('enhancedWorkflowBuilder.edit')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {workflows.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>{t('enhancedWorkflowBuilder.noWorkflows')}</p>
          </div>
        )}

        {/* Create Workflow Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4">{t('enhancedWorkflowBuilder.createWorkflowTitle')}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('enhancedWorkflowBuilder.workflowName')}</label>
                  <input
                    type="text"
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder={t('enhancedWorkflowBuilder.workflowNamePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('enhancedWorkflowBuilder.description')}</label>
                  <textarea
                    value={newWorkflow.description}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder={t('enhancedWorkflowBuilder.descriptionPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('enhancedWorkflowBuilder.trigger')}</label>
                  <select
                    value={newWorkflow.trigger}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value as any })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="manual">{t('enhancedWorkflowBuilder.trigger_manual')}</option>
                    <option value="scheduled">{t('enhancedWorkflowBuilder.trigger_scheduled')}</option>
                    <option value="event">{t('enhancedWorkflowBuilder.triggerEventBased')}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newWorkflow.enabled}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm">{t('enhancedWorkflowBuilder.enableWorkflow')}</label>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewWorkflow({
                      name: '',
                      description: '',
                      trigger: 'manual',
                      conditions: [],
                      actions: [],
                      enabled: true
                    })
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t('enhancedWorkflowBuilder.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreateWorkflow}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {t('enhancedWorkflowBuilder.createWorkflowTitle')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}







