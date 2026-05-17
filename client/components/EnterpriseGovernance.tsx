'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Shield, 
  Search, 
  Filter, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  BarChart2, 
  Download,
  Info,
  ChevronDown,
  User,
  Zap,
  Lock
} from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface AuditLog {
  _id: string
  action: string
  resourceType: string
  resourceId: string
  userId: {
    _id: string
    name: string
    email: string
  }
  details: any
  timestamp: string
  isVerified?: boolean
}

interface ComplianceMetrics {
  totalChecks: number
  passRate: number
  topIssues: Array<{ type: string; count: number }>
  riskTrend: Array<{ date: string; score: number }>
}

export default function EnterpriseGovernance() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [filter, setFilter] = useState({
    action: '',
    resourceType: '',
    startDate: '',
    endDate: ''
  })

  const loadWorkspaces = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/enterprise/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        const wsList = response.data.data.workspaces
        setWorkspaces(wsList)
        if (wsList.length > 0) setWorkspaceId(wsList[0]._id)
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams(filter)
      const response = await axios.get(
        `${API_URL}/enterprise/workspaces/${workspaceId}/audit-logs?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setLogs(response.data.data.logs || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, filter])

  const loadAnalytics = useCallback(async () => {
    if (!workspaceId) return
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${API_URL}/enterprise/workspaces/${workspaceId}/audit-logs/analytics`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        setMetrics(response.data.data)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    }
  }, [workspaceId])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  useEffect(() => {
    if (workspaceId) {
      loadLogs()
      loadAnalytics()
    }
  }, [workspaceId, loadLogs, loadAnalytics])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-blue-500/5">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-500 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Enterprise Governance
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Centralized audit logging, compliance tracking, and ethics oversight.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={workspaceId}
              title="Select Workspace"
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="appearance-none bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2 pr-10 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {workspaces.map(ws => (
                <option key={ws._id} value={ws._id}>{ws.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50" />
          </div>
          <button title="Download Governance Report" className="p-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Compliance Score" 
          value="98.2%" 
          trend="+1.2%" 
          icon={Zap} 
          color="blue"
        />
        <MetricCard 
          title="Active Risk Flags" 
          value={metrics?.totalChecks ? "3" : "0"} 
          trend="Decreasing" 
          icon={AlertTriangle} 
          color="amber"
        />
        <MetricCard 
          title="Human Reviews" 
          value="12" 
          trend="Avg 4.2h SLA" 
          icon={User} 
          color="indigo"
        />
        <MetricCard 
          title="Data Integrity" 
          value="Verified" 
          trend="AES-256 Active" 
          icon={Lock} 
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit Log Table */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f172a] rounded-3xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-xl shadow-blue-500/5">
          <div className="p-6 border-b border-gray-50 dark:border-white/5 flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Real-time Audit Trail
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button title="Filter Logs" className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <Filter className="w-4 h-4 opacity-50" />
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 font-medium uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Resource</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8 h-4 bg-gray-100/50 dark:bg-white/5 rounded-lg mb-2"></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center opacity-40 italic">
                      No logs found for this period.
                    </td>
                  </tr>
                ) : logs.map(log => (
                  <tr key={log._id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{log.userId?.name || 'System'}</span>
                        <span className="text-[10px] opacity-50">{log.userId?.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[10px] font-mono">
                        {log.resourceType.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs opacity-60">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1 text-xs font-bold uppercase tracking-tighter ${
                        log.isVerified !== false ? 'text-green-500' : 'text-rose-500'
                      }`}>
                        {log.isVerified !== false ? (
                          <><CheckCircle className="w-3 h-3" /> Verified</>
                        ) : (
                          <><AlertTriangle className="w-3 h-3" /> Tampered</>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar - Compliance Pulse */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-blue-500/5">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              Ethics Breakdown
            </h3>
            <div className="space-y-4">
              <ProgressItem label="AI Transparency" value={95} color="blue" />
              <ProgressItem label="Bias Mitigation" value={88} color="indigo" />
              <ProgressItem label="IP Compliance" value={92} color="green" />
              <ProgressItem label="GDPR Residency" value={100} color="emerald" />
            </div>
            
            <div className="mt-6 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-[10px] leading-relaxed text-blue-600 dark:text-blue-400 font-medium">
                  Compliance protocols are active. Automated deletion is scheduled for 3:00 AM UTC. 
                  All AI content is marked with mandatory transparency tags.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Shield className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <h3 className="font-bold text-xl mb-2">DMA/DSA Ready</h3>
              <p className="text-white/70 text-xs leading-relaxed mb-4">
                Your platform is currently optimized for EU digital market standards, ensuring 
                full interoperability and user choice.
              </p>
              <button className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-bold transition-all">
                Download Compliance Pack
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, trend, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    indigo: 'text-indigo-600 bg-indigo-500/10',
    green: 'text-green-600 bg-green-500/10'
  }

  return (
    <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-blue-500/5 hover:scale-[1.02] transition-all cursor-default">
      <div className={`w-12 h-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-4 shadow-inner`}>
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</h4>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-black text-gray-900 dark:text-white">{value}</span>
        <span className="text-[10px] font-bold text-blue-500 mb-1">{trend}</span>
      </div>
    </div>
  )
}

function ProgressItem({ label, value, color }: any) {
  const barColors: any = {
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    green: 'bg-green-500',
    emerald: 'bg-emerald-500'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-bold">
        <span className="opacity-60">{label}</span>
        <span className="text-blue-500">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColors[color]} rounded-full transition-all duration-1000`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
