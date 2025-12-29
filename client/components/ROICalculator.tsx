'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, Target, Calculator } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface ROIData {
  totalEngagement: number
  totalReach: number
  totalPosts: number
  estimatedValue: number
  timeSpent: number
  costPerEngagement: number
  costPerReach: number
  roi: number
  recommendations: Array<{
    title: string
    description: string
    potentialIncrease: string
  }>
}

export default function ROICalculator() {
  const [roiData, setRoiData] = useState<ROIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [hourlyRate, setHourlyRate] = useState(50)

  useEffect(() => {
    loadROIData()
  }, [period, hourlyRate])

  const loadROIData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const response = await axios.get(
        `${API_URL}/analytics/roi?period=${period}&hourlyRate=${hourlyRate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data.success) {
        setRoiData(response.data.data)
      }
    } catch (error: any) {
      console.error('ROI data error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!roiData) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calculator className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            ROI Calculator
          </h3>
        </div>
        <div className="flex gap-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
              Hourly Rate ($)
            </label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ROI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Value</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.estimatedValue)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">ROI</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {roiData.roi > 0 ? '+' : ''}{roiData.roi.toFixed(1)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Cost/Engagement</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.costPerEngagement)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Cost/Reach</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.costPerReach)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Engagement</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(roiData.totalEngagement)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Reach</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(roiData.totalReach)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Time Spent</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {roiData.timeSpent.toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {roiData.recommendations.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Recommendations to Improve ROI
          </h4>
          <div className="space-y-3">
            {roiData.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500"
              >
                <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                  {rec.title}
                </h5>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  {rec.description}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Potential: {rec.potentialIncrease}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


