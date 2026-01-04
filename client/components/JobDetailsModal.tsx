'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { X, RefreshCw, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface JobDetailsModalProps {
  jobId: string
  queueName: string
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function JobDetailsModal({ jobId, queueName, isOpen, onClose, onRefresh }: JobDetailsModalProps) {
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (isOpen && jobId) {
      loadJobDetails()
      const interval = setInterval(loadJobDetails, 2000) // Poll every 2 seconds
      return () => clearInterval(interval)
    }
  }, [isOpen, jobId, queueName])

  const loadJobDetails = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await axios.get(`${API_URL}/jobs/status/${queueName}/${jobId}`, {
      })

      setJob(response.data.data)
    } catch (error) {
      console.error('Failed to load job details:', error)
    } finally {
      setLoading(false)
    }
  }

  const retryJob = async () => {
    setRetrying(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      await axios.post(`${API_URL}/jobs/retry/${queueName}/${jobId}`, {}, {
      })

      onRefresh()
      onClose()
    } catch (error) {
      console.error('Failed to retry job:', error)
    } finally {
      setRetrying(false)
    }
  }

  if (!isOpen) return null

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />
      case 'active': return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      case 'waiting': return <Clock className="w-5 h-5 text-yellow-600" />
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Job Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        ) : job ? (
          <div className="p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3">
              {getStateIcon(job.state)}
              <div>
                <h3 className="font-semibold text-lg">{job.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">State: {job.state}</p>
              </div>
            </div>

            {/* Progress */}
            {job.state === 'active' && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{job.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Job Data */}
            <div>
              <h4 className="font-semibold mb-2">Job Data</h4>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
                <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
              </div>
              {job.processedOn && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Started</p>
                  <p className="font-medium">{new Date(job.processedOn).toLocaleString()}</p>
                </div>
              )}
              {job.finishedOn && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Finished</p>
                  <p className="font-medium">{new Date(job.finishedOn).toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attempts</p>
                <p className="font-medium">{job.attemptsMade}</p>
              </div>
            </div>

            {/* Error */}
            {job.failedReason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Error</h4>
                <p className="text-sm text-red-700 dark:text-red-300">{job.failedReason}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {job.state === 'failed' && (
                <button
                  onClick={retryJob}
                  disabled={retrying}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying...' : 'Retry Job'}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-gray-500">Job not found</p>
          </div>
        )}
      </div>
    </div>
  )
}



