'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ApprovalRequest {
  _id: string
  entityType: string
  entityId: string
  requestedBy: {
    _id: string
    name: string
    email: string
  }
  requestedFrom: {
    _id: string
    name: string
    email: string
  }
  status: string
  priority: string
  message: string
  response: string
  createdAt: string
  expiresAt: string | null
}

export default function ApprovalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [newRequest, setNewRequest] = useState({
    entityType: 'content',
    entityId: '',
    requestedFrom: '',
    message: '',
    priority: 'medium'
  })

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadData()
  }, [user, router, filter])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter)
      }

      const [requestsRes, countRes] = await Promise.all([
        axios.get(`${API_URL}/approvals?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/approvals/pending-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (requestsRes.data.success) {
        setRequests(requestsRes.data.data || [])
      }
      if (countRes.data.success) {
        setPendingCount(countRes.data.data.count || 0)
      }
    } catch (error) {
      showToast('Failed to load approvals', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    const response = prompt('Add a response (optional):')
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${requestId}/approve`,
        { response: response || '' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      showToast('Request approved', 'success')
      await loadData()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to approve', 'error')
    }
  }

  const handleReject = async (requestId: string) => {
    const response = prompt('Add a reason for rejection (optional):')
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${requestId}/reject`,
        { response: response || '' },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      showToast('Request rejected', 'success')
      await loadData()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to reject', 'error')
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/approvals/${requestId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      showToast('Request cancelled', 'success')
      await loadData()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to cancel', 'error')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading approvals..." />
      </div>
    )
  }

  const pendingRequests = requests.filter(r => r.status === 'pending' && r.requestedFrom._id === user?.id)
  const myRequests = requests.filter(r => r.requestedBy._id === user?.id)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Approval Workflows</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''} waiting for you
              </p>
            )}
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            + Request Approval
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {['all', 'pending', 'approved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg capitalize ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="font-semibold mb-2">⚠️ Pending Your Approval</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request._id} className="bg-white rounded-lg p-4 border border-yellow-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">
                        {request.requestedBy.name} requested approval for {request.entityType}
                      </p>
                      {request.message && (
                        <p className="text-sm text-gray-600 mt-1">{request.message}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleApprove(request._id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request._id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Requests</h2>
          {requests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No approval requests</p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const isRequester = request.requestedBy._id === user?.id
                const isApprover = request.requestedFrom._id === user?.id

                return (
                  <div key={request._id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold capitalize">{request.entityType}</span>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(request.priority)}`}>
                            {request.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {isRequester ? (
                            <>Requested from <strong>{request.requestedFrom.name}</strong></>
                          ) : (
                            <>Requested by <strong>{request.requestedBy.name}</strong></>
                          )}
                        </p>
                        {request.message && (
                          <p className="text-sm text-gray-700 mt-1">{request.message}</p>
                        )}
                        {request.response && (
                          <p className="text-sm text-gray-600 mt-1 italic">
                            Response: {request.response}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 mt-4">
                        {isApprover && (
                          <>
                            <button
                              onClick={() => handleApprove(request._id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(request._id)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isRequester && (
                          <button
                            onClick={() => handleCancel(request._id)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {showRequestModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Request Approval</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Entity Type</label>
                  <select
                    value={newRequest.entityType}
                    onChange={(e) => setNewRequest({ ...newRequest, entityType: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="content">Content</option>
                    <option value="script">Script</option>
                    <option value="post">Post</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Entity ID</label>
                  <input
                    type="text"
                    value={newRequest.entityId}
                    onChange={(e) => setNewRequest({ ...newRequest, entityId: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Enter content/script/post ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Request From (User ID)</label>
                  <input
                    type="text"
                    value={newRequest.requestedFrom}
                    onChange={(e) => setNewRequest({ ...newRequest, requestedFrom: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Enter user ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    value={newRequest.message}
                    onChange={(e) => setNewRequest({ ...newRequest, message: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows={3}
                    placeholder="Add a message..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRequestModal(false)
                    setNewRequest({
                      entityType: 'content',
                      entityId: '',
                      requestedFrom: '',
                      message: '',
                      priority: 'medium'
                    })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token')
                      await axios.post(
                        `${API_URL}/approvals`,
                        newRequest,
                        {
                          headers: { Authorization: `Bearer ${token}` }
                        }
                      )
                      showToast('Approval request created', 'success')
                      setShowRequestModal(false)
                      setNewRequest({
                        entityType: 'content',
                        entityId: '',
                        requestedFrom: '',
                        message: '',
                        priority: 'medium'
                      })
                      await loadData()
                    } catch (error: any) {
                      showToast(error.response?.data?.error || 'Failed to create request', 'error')
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}







