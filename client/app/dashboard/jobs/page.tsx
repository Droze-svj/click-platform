'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
// Navbar removed - provided by dashboard layout
import LoadingSkeleton from '../../../components/LoadingSkeleton'
import ToastContainer from '../../../components/ToastContainer'
import JobDetailsModal from '../../../components/JobDetailsModal'
import { Search, Filter, Download, RefreshCw } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface Job {
  id: string
  name: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  attemptsMade: number
  failedReason?: string
  processedOn?: Date
  finishedOn?: Date
  createdAt: Date
  queue?: string
}

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  total: number
}

interface QueueMetrics {
  total: number
  successful: number
  failed: number
  averageDuration: number
  averageMemory: number
  totalCost: number
  totalRetries: number
}

export default function JobsDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [userJobs, setUserJobs] = useState<{
    active: Job[]
    completed: Job[]
    failed: Job[]
  }>({ active: [], completed: [], failed: [] })
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({})
  const [userMetrics, setUserMetrics] = useState<QueueMetrics | null>(null)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('24h')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedJob, setSelectedJob] = useState<{ id: string; queue: string } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadData()
    if (autoRefresh) {
      const interval = setInterval(loadData, 10000) // Refresh every 10 seconds
      return () => clearInterval(interval)
    }
  }, [timeRange, autoRefresh])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const headers = { Authorization: `Bearer ${token}` }

      // Load user jobs
      const jobsResponse = await axios.get(`${API_URL}/jobs/user`, { headers })
      setUserJobs(jobsResponse.data.data || { active: [], completed: [], failed: [] })

      // Load user metrics
      try {
        const metricsResponse = await axios.get(`${API_URL}/jobs/metrics/user?timeRange=${timeRange}`, { headers })
        setUserMetrics(metricsResponse.data.data)
      } catch (error) {
        console.warn('Metrics not available')
      }

      // Load queue stats (if admin)
      const isAdmin = !!user && (((user as any).role === 'admin') || !!(user as any).isAdmin)
      if (isAdmin) {
        try {
          const statsResponse = await axios.get(`${API_URL}/jobs/dashboard/stats`, { headers })
          setQueueStats(statsResponse.data.data || {})
        } catch (error) {
          // If stats fail even for admins, don't break the rest of the dashboard.
        }
      }
    } catch (error: any) {
      console.error('Failed to load jobs:', error)
      if (error.response?.status === 401) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Find which queue the job is in
      const allJobs = [...userJobs.active, ...userJobs.completed, ...userJobs.failed]
      const job = allJobs.find(j => j.id === jobId)
      
      if (!job) return

      // Try to cancel (we'll need to find the queue)
      await axios.post(`${API_URL}/jobs/user/${jobId}/cancel`, {}, {
      })

      loadData()
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'waiting': return 'bg-yellow-100 text-yellow-800'
      case 'delayed': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Job Queue Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage your background jobs</p>
        </div>

        {/* Metrics Overview */}
        {userMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Jobs"
              value={userMetrics.total}
              icon="📊"
              color="blue"
            />
            <MetricCard
              title="Successful"
              value={userMetrics.successful}
              icon="✅"
              color="green"
            />
            <MetricCard
              title="Failed"
              value={userMetrics.failed}
              icon="❌"
              color="red"
            />
            <MetricCard
              title="Total Cost"
              value={`$${userMetrics.totalCost.toFixed(4)}`}
              icon="💰"
              color="purple"
            />
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Time Range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                autoRefresh
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto Refresh
            </button>

            {/* Manual Refresh */}
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Active Jobs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Jobs currently being processed</p>
          </div>
          <div className="p-6">
            {userJobs.active.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No active jobs</p>
            ) : (
              <div className="space-y-4">
                {userJobs.active
                  .filter(job =>
                    searchQuery === '' ||
                    job.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onCancel={cancelJob}
                      onViewDetails={() => setSelectedJob({ id: job.id, queue: job.queue || 'unknown' })}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Recent Completed Jobs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Last 20 completed jobs</p>
          </div>
          <div className="p-6">
            {userJobs.completed.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No completed jobs</p>
            ) : (
              <div className="space-y-4">
                {userJobs.completed
                  .filter(job =>
                    searchQuery === '' ||
                    job.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onCancel={cancelJob}
                      onViewDetails={() => setSelectedJob({ id: job.id, queue: job.queue || 'unknown' })}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Failed Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold">Failed Jobs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Jobs that failed after retries</p>
          </div>
          <div className="p-6">
            {userJobs.failed.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No failed jobs</p>
            ) : (
              <div className="space-y-4">
                {userJobs.failed
                  .filter(job =>
                    searchQuery === '' ||
                    job.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onCancel={cancelJob}
                      onViewDetails={() => setSelectedJob({ id: job.id, queue: job.queue || 'unknown' })}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <JobDetailsModal
            jobId={selectedJob.id}
            queueName={selectedJob.queue}
            isOpen={!!selectedJob}
            onClose={() => setSelectedJob(null)}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    green: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function JobCard({ job, onCancel, onViewDetails }: { job: Job; onCancel: (id: string) => void; onViewDetails: () => void }) {
  const getStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'active': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      case 'failed': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      case 'waiting': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'delayed': return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(job.state)}`}>
              {job.state.toUpperCase()}
            </span>
            <span className="text-sm font-medium">{job.name}</span>
          </div>
          
          {job.state === 'active' && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm mb-1">
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

          {job.failedReason && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              <strong>Error:</strong> {job.failedReason}
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Created: {new Date(job.createdAt).toLocaleString()}
            {job.finishedOn && ` • Finished: ${new Date(job.finishedOn).toLocaleString()}`}
            {job.attemptsMade > 0 && ` • Attempts: ${job.attemptsMade}`}
          </div>
        </div>

        <div className="ml-4 flex gap-2">
          <button
            onClick={onViewDetails}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
          >
            Details
          </button>
          {(job.state === 'active' || job.state === 'waiting') && (
            <button
              onClick={() => onCancel(job.id)}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

