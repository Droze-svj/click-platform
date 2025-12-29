'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, TrendingUp, Clock, CheckCircle, XCircle, Play, Pause, Plus, BarChart3 } from 'lucide-react'
import AdvancedRecyclingAnalytics from './AdvancedRecyclingAnalytics'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface RecyclableContent {
  postId: string
  contentId: string
  platform: string
  title: string
  engagement: number
  impressions: number
  engagementRate: number
  postedAt: string
  isEvergreen?: boolean
  evergreenScore?: number
  recommendation?: string
}

interface RecyclingPlan {
  _id: string
  originalContentId: {
    _id: string
    title: string
  }
  platform: string
  status: string
  repostSchedule: {
    frequency: string
    interval: number
    maxReposts: number
    currentRepostCount: number
    nextRepostDate: string
    isActive: boolean
  }
  originalPerformance: {
    engagement: number
    engagementRate: number
  }
  repostPerformance?: {
    engagement: number
    engagementRate: number
  }
  isEvergreen: boolean
  evergreenScore: number
}

interface RecyclingStats {
  totalRecycled: number
  active: number
  completed: number
  totalReposts: number
  averagePerformanceChange: number
  evergreenContent: number
  byPlatform: Record<string, { count: number; reposts: number }>
  topPerformers: Array<{
    recycleId: string
    contentId: string
    platform: string
    engagement: number
  }>
}

export default function ContentRecyclingDashboard() {
  const [suggestions, setSuggestions] = useState<RecyclableContent[]>([])
  const [plans, setPlans] = useState<RecyclingPlan[]>([])
  const [stats, setStats] = useState<RecyclingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'suggestions' | 'plans' | 'stats'>('suggestions')
  const [selectedContent, setSelectedContent] = useState<RecyclableContent | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      if (activeTab === 'suggestions') {
        const response = await axios.get(
          `${API_URL}/recycling/suggestions?limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.success) {
          setSuggestions(response.data.data.suggestions || [])
        }
      } else if (activeTab === 'plans') {
        const response = await axios.get(
          `${API_URL}/recycling/plans`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.success) {
          setPlans(response.data.data.plans || [])
        }
      } else if (activeTab === 'stats') {
        const response = await axios.get(
          `${API_URL}/recycling/stats`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (response.data.success) {
          setStats(response.data.data)
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createRecyclingPlan = async (postId: string, options: any = {}) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/recycling/create`,
        { postId, ...options },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert('Recycling plan created!')
      loadData()
      setSelectedContent(null)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error creating recycling plan')
    }
  }

  const toggleRecycling = async (recycleId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/recycling/plans/${recycleId}/toggle`,
        { isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error toggling recycling')
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
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
          <div className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Content Recycling & Auto-Reposting
            </h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {(['suggestions', 'plans', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                High-performing content that's perfect for recycling. Click to create a recycling plan.
              </p>
            </div>
            {suggestions.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <RefreshCw className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No recyclable content found</p>
                <p className="text-sm mt-2">Create more content to see suggestions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((item) => (
                  <div
                    key={item.postId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-green-500 dark:hover:border-green-400 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                            {item.platform}
                          </span>
                          {item.isEvergreen && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Evergreen
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Engagement</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatNumber(item.engagement)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Engagement Rate</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {item.engagementRate.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Posted</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              {formatDate(item.postedAt)}
                            </p>
                          </div>
                        </div>
                        {item.recommendation && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            💡 {item.recommendation}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedContent(item)}
                        className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Recycle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div>
            {plans.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No recycling plans yet</p>
                <p className="text-sm mt-2">Go to Suggestions to create your first plan</p>
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((plan) => (
                  <div
                    key={plan._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {plan.originalContentId?.title || 'Untitled'}
                          </h3>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                            {plan.platform}
                          </span>
                          {plan.isEvergreen && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                              Evergreen ({plan.evergreenScore}%)
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Reposts</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {plan.repostSchedule.currentRepostCount} / {plan.repostSchedule.maxReposts}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Frequency</p>
                            <p className="font-semibold text-gray-900 dark:text-white capitalize">
                              {plan.repostSchedule.frequency}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Next Repost</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {plan.repostSchedule.nextRepostDate
                                ? formatDate(plan.repostSchedule.nextRepostDate)
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Performance</p>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {plan.repostPerformance
                                ? `${formatNumber(plan.repostPerformance.engagement)}`
                                : formatNumber(plan.originalPerformance.engagement)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRecycling(plan._id, !plan.repostSchedule.isActive)}
                        className={`ml-4 p-2 rounded-lg ${
                          plan.repostSchedule.isActive
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                        }`}
                        title={plan.repostSchedule.isActive ? 'Pause' : 'Resume'}
                      >
                        {plan.repostSchedule.isActive ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div>
            {stats ? (
              <div>
                {/* Basic Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Recycled</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.totalRecycled || 0}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Plans</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.active || 0}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Reposts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {stats?.totalReposts || 0}
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Change</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(stats?.averagePerformanceChange || 0) > 0 ? '+' : ''}
                      {(stats?.averagePerformanceChange || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {stats?.topPerformers && (stats?.topPerformers?.length || 0) > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                      Top Performing Reposts
                    </h3>
                    <div className="space-y-2">
                      {(stats?.topPerformers || []).map((performer, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full flex items-center justify-center font-semibold">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white capitalize">
                                {performer.platform}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {formatNumber(performer.engagement)} engagement
                              </p>
                            </div>
                          </div>
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No statistics available</p>
              </div>
            )}
            
            {/* Advanced Analytics */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Advanced Analytics
              </h3>
              <AdvancedRecyclingAnalytics period={30} />
            </div>
          </div>
        )}
        
        {/* Old Stats Tab Code Removed */}
        {false && activeTab === 'stats' && stats && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Recycled</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.totalRecycled || 0}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Plans</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.active || 0}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Reposts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.totalReposts || 0}
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Change</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(stats?.averagePerformanceChange || 0) > 0 ? '+' : ''}
                  {(stats?.averagePerformanceChange || 0).toFixed(1)}%
                </p>
              </div>
            </div>

            {stats?.topPerformers && (stats?.topPerformers?.length || 0) > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                  Top Performing Reposts
                </h3>
                <div className="space-y-2">
                  {(stats?.topPerformers || []).map((performer, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full flex items-center justify-center font-semibold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {performer.platform}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatNumber(performer.engagement)} engagement
                          </p>
                        </div>
                      </div>
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Recycling Plan Modal */}
      {selectedContent && (
        <CreateRecyclingPlanModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onCreate={createRecyclingPlan}
        />
      )}
    </div>
  )
}

function CreateRecyclingPlanModal({
  content,
  onClose,
  onCreate
}: {
  content: RecyclableContent
  onClose: () => void
  onCreate: (postId: string, options: any) => void
}) {
  const [frequency, setFrequency] = useState('monthly')
  const [interval, setInterval] = useState(30)
  const [maxReposts, setMaxReposts] = useState(5)
  const [updateHashtags, setUpdateHashtags] = useState(true)
  const [updateTiming, setUpdateTiming] = useState(true)
  const [updateCaption, setUpdateCaption] = useState(false)
  const [autoSchedule, setAutoSchedule] = useState(true)

  const handleCreate = () => {
    onCreate(content.postId, {
      repostSchedule: {
        frequency,
        interval,
        maxReposts
      },
      refreshOptions: {
        updateHashtags,
        updateTiming,
        updateCaption,
        addNewElements: false
      },
      autoSchedule
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Create Recycling Plan
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              {content.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {content.platform} • {formatNumber(content.engagement)} engagement • {content.engagementRate.toFixed(2)}% rate
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Repost Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value)
                  const intervals: Record<string, number> = {
                    daily: 1,
                    weekly: 7,
                    monthly: 30,
                    quarterly: 90
                  }
                  setInterval(intervals[e.target.value] || 30)
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {frequency === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interval (days)
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(parseInt(e.target.value) || 30)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  min="1"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Reposts
              </label>
              <input
                type="number"
                value={maxReposts}
                onChange={(e) => setMaxReposts(parseInt(e.target.value) || 5)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                min="1"
                max="20"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Refresh Options
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateHashtags}
                    onChange={(e) => setUpdateHashtags(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Update hashtags for each repost
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateTiming}
                    onChange={(e) => setUpdateTiming(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Use optimal posting times
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateCaption}
                    onChange={(e) => setUpdateCaption(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Refresh caption text
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="w-4 h-4 text-green-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Automatically schedule first repost
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Create Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

