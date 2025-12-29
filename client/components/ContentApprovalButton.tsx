'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertCircle, Send } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ContentApprovalButtonProps {
  contentId: string
  onApprovalStarted?: () => void
}

export default function ContentApprovalButton({ 
  contentId, 
  onApprovalStarted 
}: ContentApprovalButtonProps) {
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
      alert('Please select a workflow')
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
        alert('Approval process started!')
        setShowModal(false)
        onApprovalStarted?.()
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error starting approval')
    } finally {
      setLoading(false)
    }
  }

  if (workflows.length === 0) {
    return (
      <button
        onClick={() => alert('No approval workflows available. Please create one first.')}
        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
        disabled
      >
        <Clock className="w-4 h-4" />
        No Workflows Available
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Send className="w-4 h-4" />
        Request Approval
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Start Approval Process
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Workflow
                </label>
                <select
                  value={selectedWorkflow}
                  onChange={(e) => setSelectedWorkflow(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a workflow...</option>
                  {workflows.map((workflow) => (
                    <option key={workflow._id} value={workflow._id}>
                      {workflow.name} {workflow.isDefault && '(Default)'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedWorkflow && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {workflows.find(w => w._id === selectedWorkflow)?.description || 'No description'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {workflows.find(w => w._id === selectedWorkflow)?.stages?.length || 0} stage(s)
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={startApproval}
                  disabled={!selectedWorkflow || loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Start Approval
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


