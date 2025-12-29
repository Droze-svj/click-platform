'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, MessageSquare, RefreshCw } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface Approval {
  _id: string
  contentId: {
    _id: string
    title: string
    type: string
  }
  createdBy: {
    name: string
    email: string
  }
  status: string
  currentStage: number
  stages: Array<{
    stageOrder: number
    stageName: string
    status: string
    approvals: Array<{
      approverId: {
        name: string
        email: string
      }
      status: string
      comment: string
    }>
  }>
  createdAt: string
}

export default function ApprovalDashboard() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'approved' | 'rejected'>('all')
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)

  useEffect(() => {
    loadApprovals()
  }, [filter])

  const loadApprovals = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const status = filter !== 'all' ? filter : null
      
      const response = await axios.get(
        `${API_URL}/approvals/my-approvals${status ? `?status=${status}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setApprovals(response.data.data.approvals || [])
      }
    } catch (error: any) {
      console.error('Error loading approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approvalId: string, comment: string = '') => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${approvalId}/approve`,
        { comment },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      loadApprovals()
      setSelectedApproval(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error approving content')
    }
  }

  const handleReject = async (approvalId: string, rejectionReason: string, comment: string = '') => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${approvalId}/reject`,
        { rejectionReason, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      loadApprovals()
      setSelectedApproval(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error rejecting content')
    }
  }

  const handleRequestChanges = async (approvalId: string, requestedChanges: string, comment: string = '') => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${approvalId}/request-changes`,
        { requestedChanges, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      loadApprovals()
      setSelectedApproval(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error requesting changes')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'changes_requested':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'changes_requested':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Approval Dashboard
          </h2>
          <button
            onClick={loadApprovals}
            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'in_progress', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Approvals List */}
        {approvals.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No approvals found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div
                key={approval._id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer"
                onClick={() => setSelectedApproval(approval)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(approval.status)}
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {approval.contentId?.title || 'Untitled'}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(approval.status)}`}>
                        {approval.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Created by: {approval.createdBy?.name || approval.createdBy?.email}
                    </p>
                    {approval.stages && approval.stages.length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Stage {approval.currentStage + 1} of {approval.stages.length}: {approval.stages[approval.currentStage]?.stageName}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedApproval(approval)
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Detail Modal */}
      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onRequestChanges={handleRequestChanges}
        />
      )}
    </div>
  )
}

function ApprovalDetailModal({
  approval,
  onClose,
  onApprove,
  onReject,
  onRequestChanges
}: {
  approval: Approval
  onClose: () => void
  onApprove: (id: string, comment: string) => void
  onReject: (id: string, reason: string, comment: string) => void
  onRequestChanges: (id: string, changes: string, comment: string) => void
}) {
  const [comment, setComment] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [requestedChanges, setRequestedChanges] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | 'changes' | null>(null)

  const currentStage = approval.stages[approval.currentStage]
  const myApproval = currentStage?.approvals.find(
    a => a.status === 'pending'
  )

  if (!myApproval) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Approval Details
              </h3>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              You have already responded to this approval or are not an approver for this stage.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {approval.contentId?.title || 'Untitled'}
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          {/* Current Stage Info */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Current Stage: {currentStage?.stageName}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stage {approval.currentStage + 1} of {approval.stages.length}
            </p>
          </div>

          {/* Approval Actions */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setAction('approve')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action === 'approve'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Approve
              </button>
              <button
                onClick={() => setAction('changes')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action === 'changes'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Request Changes
              </button>
              <button
                onClick={() => setAction('reject')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action === 'reject'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
                }`}
              >
                <XCircle className="w-4 h-4 inline mr-2" />
                Reject
              </button>
            </div>

            {action === 'approve' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Add a comment..."
                />
                <button
                  onClick={() => onApprove(approval._id, comment)}
                  className="mt-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Submit Approval
                </button>
              </div>
            )}

            {action === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rejection Reason *
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white mb-2"
                  placeholder="e.g., Content doesn't meet brand guidelines"
                />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Add additional feedback..."
                />
                <button
                  onClick={() => onReject(approval._id, rejectionReason, comment)}
                  disabled={!rejectionReason.trim()}
                  className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Submit Rejection
                </button>
              </div>
            )}

            {action === 'changes' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Requested Changes *
                </label>
                <textarea
                  value={requestedChanges}
                  onChange={(e) => setRequestedChanges(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-700 dark:text-white mb-2"
                  rows={4}
                  placeholder="Describe the changes needed..."
                />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Add additional feedback..."
                />
                <button
                  onClick={() => onRequestChanges(approval._id, requestedChanges, comment)}
                  disabled={!requestedChanges.trim()}
                  className="mt-2 w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  Request Changes
                </button>
              </div>
            )}
          </div>

          {/* Approval History */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Approval History</h4>
            <div className="space-y-2">
              {approval.stages.map((stage, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {stage.stageName}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(stage.status)}`}>
                      {stage.status}
                    </span>
                  </div>
                  {stage.approvals.map((approval, aIdx) => (
                    <div key={aIdx} className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                      {approval.approverId?.name}: {approval.status}
                      {approval.comment && ` - ${approval.comment}`}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'changes_requested':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}


