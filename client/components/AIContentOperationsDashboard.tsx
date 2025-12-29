'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import {
  Activity,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Zap,
  RefreshCw,
  Lightbulb,
  Award,
  TrendingDown
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export default function AIContentOperationsDashboard() {
  const [healthCheck, setHealthCheck] = useState<any>(null)
  const [performance, setPerformance] = useState<any>(null)
  const [benchmarks, setBenchmarks] = useState<any>(null)
  const [nextWeek, setNextWeek] = useState<any>(null)
  const [selectedPlatform, setSelectedPlatform] = useState('twitter')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const platforms = [
    { id: 'twitter', name: 'Twitter/X' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'youtube', name: 'YouTube' },
    { id: 'tiktok', name: 'TikTok' }
  ]

  useEffect(() => {
    loadDashboard()
  }, [selectedPlatform])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [healthRes, benchmarksRes, nextWeekRes] = await Promise.all([
        axios.get(`${API_URL}/content-operations/health`, { headers }),
        axios.get(`${API_URL}/content-operations/benchmarks?platform=${selectedPlatform}`, { headers }),
        axios.get(`${API_URL}/content-operations/next-week?platform=${selectedPlatform}`, { headers })
      ])

      if (healthRes.data.success) setHealthCheck(healthRes.data.data)
      if (benchmarksRes.data.success) setBenchmarks(benchmarksRes.data.data)
      if (nextWeekRes.data.success) setNextWeek(nextWeekRes.data.data)
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load dashboard', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 dark:bg-green-900/20'
      case 'B': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20'
      case 'C': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
      case 'D': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20'
      default: return 'text-red-600 bg-red-100 dark:bg-red-900/20'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Content Operations</h1>
            <p className="text-indigo-100">
              Complete content operations platform for social media - not just AI writing
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
            >
              {platforms.map(p => (
                <option key={p.id} value={p.id} className="text-gray-900">{p.name}</option>
              ))}
            </select>
            <button
              onClick={loadDashboard}
              className="bg-white/20 hover:bg-white/30 rounded-lg p-2"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
        </div>
      ) : (
        <>
          {/* Content Health Check */}
          {healthCheck && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold">Content Health Check</h2>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className={`text-4xl font-bold mb-2 ${getGradeColor(healthCheck.overall.grade)} px-4 py-2 rounded-lg inline-block`}>
                    {healthCheck.overall.grade}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Overall Score</div>
                  <div className="text-2xl font-semibold mt-1">{healthCheck.overall.score}/100</div>
                </div>

                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{healthCheck.overall.healthyContent}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Healthy</div>
                </div>

                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-600">{healthCheck.overall.needsAttention}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Needs Attention</div>
                </div>

                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">{healthCheck.overall.criticalIssues}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
                </div>
              </div>

              {/* Gap Analysis */}
              {healthCheck.gaps && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Content Gaps Identified
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(healthCheck.gaps.byType || {}).map(([type, gap]: [string, any]) => (
                      <div key={type} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <div className="font-medium capitalize">{type}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Gap: {gap.gap} more needed
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {healthCheck.recommendations && healthCheck.recommendations.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    Recommendations (Tied to Gaps)
                  </h3>
                  <div className="space-y-2">
                    {healthCheck.recommendations.slice(0, 5).map((rec: any, index: number) => (
                      <div key={index} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <div className="font-medium">{rec.title}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.description}</div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                          Action: {rec.action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Competitive Benchmarks */}
          {benchmarks && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold">Competitive Benchmarking</h2>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your Performance</div>
                  <div className="text-3xl font-bold">{benchmarks.user.avgEngagement}</div>
                  <div className="text-sm text-gray-500">avg engagement</div>
                </div>

                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Industry Top 25%</div>
                  <div className="text-3xl font-bold text-indigo-600">{benchmarks.industry.top25}</div>
                  <div className="text-sm text-gray-500">target engagement</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Percentile Ranking</span>
                  <span className="text-lg font-bold text-indigo-600">{benchmarks.industry.percentile}th</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full"
                    style={{ width: `${benchmarks.industry.percentile}%` }}
                  />
                </div>
              </div>

              {benchmarks.recommendations && benchmarks.recommendations.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Beat Benchmark Recommendations</h3>
                  <div className="space-y-2">
                    {benchmarks.recommendations.map((rec: any, index: number) => (
                      <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="font-medium">{rec.title}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.description}</div>
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                          Impact: {rec.estimatedImpact}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* What to Post Next Week */}
          {nextWeek && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold">What to Post Next Week</h2>
                <span className="text-sm text-gray-500">(To Beat Benchmark)</span>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
                <div className="font-semibold mb-2">Goal</div>
                <div className="text-sm text-gray-700 dark:text-gray-300">{nextWeek.goal}</div>
                <div className="mt-2 text-indigo-600 dark:text-indigo-400 font-medium">
                  Gap to close: {nextWeek.gap} engagement points
                </div>
              </div>

              {nextWeek.weeklyPlan && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Weekly Content Plan</h3>
                  <div className="space-y-3">
                    {nextWeek.weeklyPlan.map((plan: any, index: number) => (
                      <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{plan.day}</div>
                          <div className="text-sm text-indigo-600 dark:text-indigo-400">
                            Target: {plan.goal}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {plan.content.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {plan.content.type} • {plan.content.category} • Est. {plan.content.estimatedEngagement} engagement
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nextWeek.optimizationTips && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Optimization Tips
                  </h3>
                  <ul className="space-y-2">
                    {nextWeek.optimizationTips.map((tip: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Performance Prediction */}
          {performance && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold">Adaptive Performance Prediction</h2>
              </div>

              {performance.forecast && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Next Week</div>
                    <div className="text-2xl font-bold">{performance.forecast.nextWeek.engagement}</div>
                    <div className="text-xs text-gray-500">predicted engagement</div>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Next Month</div>
                    <div className="text-2xl font-bold">{performance.forecast.nextMonth.engagement}</div>
                    <div className="text-xs text-gray-500">predicted engagement</div>
                  </div>
                </div>
              )}

              {performance.accuracy && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm font-medium mb-2">Prediction Accuracy</div>
                  <div className="text-2xl font-bold text-green-600">{performance.accuracy.overall}%</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Based on {performance.actualData?.posts || 0} actual posts
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

