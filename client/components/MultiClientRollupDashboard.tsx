'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface ClientSummary {
  clientWorkspaceId: string
  clientName: string
  performance: {
    totalReach: number
    totalEngagement: number
    engagementRate: number
    totalRevenue: number
    roi: number
  }
  healthScore: {
    overall: number
    trend: string
  }
  riskFlags: Array<{
    type: string
    severity: string
  }>
}

interface MultiClientRollup {
  clients: ClientSummary[]
  totals: {
    totalReach: number
    totalEngagement: number
    averageEngagementRate: number
    totalRevenue: number
    averageRoi: number
    averageHealthScore: number
  }
  riskSummary: {
    totalClients: number
    clientsAtRisk: number
    criticalRisks: number
    highRisks: number
  }
  topPerformers: {
    byEngagement: Array<{ clientName: string; value: number }>
    byRoi: Array<{ clientName: string; value: number }>
  }
}

interface MultiClientRollupDashboardProps {
  agencyWorkspaceId: string
}

export default function MultiClientRollupDashboard({ agencyWorkspaceId }: MultiClientRollupDashboardProps) {
  const [rollup, setRollup] = useState<MultiClientRollup | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  useEffect(() => {
    loadRollup()
  }, [agencyWorkspaceId])

  const loadRollup = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/agencies/${agencyWorkspaceId}/rollup`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setRollup(res.data.data)
      }
    } catch (error) {
      console.error('Error loading rollup', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/agencies/${agencyWorkspaceId}/rollup/summary`,
        { tone: 'professional' },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setAiSummary(res.data.data.text)
      }
    } catch (error) {
      console.error('Error generating summary', error)
    } finally {
      setGeneratingSummary(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!rollup) {
    return <div className="p-8 text-center text-gray-500">No rollup data available</div>
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Multi-Client Rollup Dashboard</h1>
        <button
          onClick={generateSummary}
          disabled={generatingSummary}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {generatingSummary ? 'Generating...' : 'Generate AI Summary'}
        </button>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-2">AI-Generated Summary</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{aiSummary}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Clients</div>
          <div className="text-2xl font-bold">{rollup.riskSummary.totalClients}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Clients at Risk</div>
          <div className="text-2xl font-bold text-red-600">{rollup.riskSummary.clientsAtRisk}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Average Health Score</div>
          <div className={`text-2xl font-bold ${getHealthColor(rollup.totals.averageHealthScore)}`}>
            {rollup.totals.averageHealthScore.toFixed(0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Revenue</div>
          <div className="text-2xl font-bold">${rollup.totals.totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Risk Summary</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{rollup.riskSummary.criticalRisks}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{rollup.riskSummary.highRisks}</div>
            <div className="text-sm text-gray-600">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{(rollup.riskSummary as any).mediumRisks || 0}</div>
            <div className="text-sm text-gray-600">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{(rollup.riskSummary as any).lowRisks || 0}</div>
            <div className="text-sm text-gray-600">Low</div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">All Clients</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Client</th>
                <th className="text-right p-3">Health Score</th>
                <th className="text-right p-3">Engagement Rate</th>
                <th className="text-right p-3">ROI</th>
                <th className="text-right p-3">Revenue</th>
                <th className="text-center p-3">Risk Flags</th>
              </tr>
            </thead>
            <tbody>
              {rollup.clients.map((client) => (
                <tr key={client.clientWorkspaceId} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{client.clientName}</td>
                  <td className="p-3 text-right">
                    <span className={getHealthColor(client.healthScore.overall)}>
                      {client.healthScore.overall.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {client.performance.engagementRate.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">
                    {client.performance.roi.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right">
                    ${client.performance.totalRevenue.toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    {client.riskFlags.length > 0 ? (
                      <div className="flex gap-1 justify-center">
                        {client.riskFlags.map((flag, i) => (
                          <span
                            key={i}
                            className={`px-2 py-1 rounded text-xs border ${getSeverityColor(flag.severity)}`}
                            title={flag.type}
                          >
                            {flag.severity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-green-600">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top by Engagement</h2>
          <div className="space-y-3">
            {rollup.topPerformers.byEngagement.map((client, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-medium">{client.clientName}</span>
                <span className="text-blue-600 font-semibold">{client.value.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top by ROI</h2>
          <div className="space-y-3">
            {rollup.topPerformers.byRoi.map((client, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="font-medium">{client.clientName}</span>
                <span className="text-green-600 font-semibold">{client.value.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

