'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertCircle, Send } from 'lucide-react'
import axios from 'axios'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ContentApprovalButtonProps {
  contentId: string
  onApprovalStarted?: () => void
}

export default function ContentApprovalButton({ 
  contentId, 
  onApprovalStarted
}: ContentApprovalButtonProps) {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/approvals/workflows`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setWorkflows(response.data.data.workflows || [])
        // Auto-select default workflow
        const defaultWorkflow = response.data.data.workflows.find((w: any) => w.isDefault)
        if (defaultWorkflow) {
          setSelectedWorkflow(defaultWorkflow._id)
        }
      }
    } catch (error) {
      console.error('Error loading workflows:', error)
    }
  }

  const startApproval = async () => {
    if (!selectedWorkflow) {
      alert(t('contentApprovalButton.selectWorkflowAlert'))
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/approvals/start`,
        { contentId, workflowId: selectedWorkflow },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        alert(t('contentApprovalButton.approvalStarted'))
        setShowModal(false)
        onApprovalStarted?.()
      }
    } catch (error: any) {
      alert(error.response?.data?.error || t('contentApprovalButton.errorStarting'))
    } finally {
      setLoading(false)
    }
  }

  if (workflows.length === 0) {
    return (
      <button
        type="button"
        onClick={() => alert(t('contentApprovalButton.noWorkflowsAlert'))}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
        disabled
      >
        <Clock className="w-4 h-4" />
        {t('contentApprovalButton.noWorkflowsAvailable')}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Send className="w-4 h-4" />
        {t('contentApprovalButton.requestApproval')}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-[var(--text-main)]">
                  {t('contentApprovalButton.startApprovalProcess')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('contentApprovalButton.selectWorkflow')}
                </label>
                <select
                  value={selectedWorkflow}
                  onChange={(e) => setSelectedWorkflow(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('contentApprovalButton.selectWorkflowPlaceholder')}</option>
                  {workflows.map((workflow) => (
                    <option key={workflow._id} value={workflow._id}>
                      {workflow.name} {workflow.isDefault && t('contentApprovalButton.defaultSuffix')}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWorkflow && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {workflows.find(w => w._id === selectedWorkflow)?.description || t('contentApprovalButton.noDescription')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {t('contentApprovalButton.stageCount', { count: workflows.find(w => w._id === selectedWorkflow)?.stages?.length || 0 })}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {t('contentApprovalButton.cancel')}
                </button>
                <button
                  type="button"
                  onClick={startApproval}
                  disabled={!selectedWorkflow || loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      {t('contentApprovalButton.starting')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {t('contentApprovalButton.startApproval')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


