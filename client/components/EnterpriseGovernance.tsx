'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Shield,
  Search,
  FileText,
  AlertTriangle,
  Download,
  ChevronDown,
  Zap,
  Activity,
  Lock,
} from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface AuditLog {
  _id: string
  action: string
  resourceType: string
  resourceId: string
  userId: {
    _id: string
    name: string
    email: string
  } | null
  details: any
  timestamp: string
}

// GET /api/enterprise/workspaces/:id/audit-logs/analytics (last 30 days)
interface AuditAnalytics {
  totalActions: number
  complianceEvents: number
  securityEvents: number
}

export default function EnterpriseGovernance() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [totalLogs, setTotalLogs] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<AuditAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const loadWorkspaces = useCallback(async () => {
    try {
      const res: any = await apiGet('/enterprise/workspaces', undefined, false)
      const wsList = Array.isArray(res?.data?.workspaces) ? res.data.workspaces : []
      setWorkspaces(wsList)
      if (wsList.length > 0) setWorkspaceId(wsList[0]._id)
      else setLoading(false)
    } catch (error) {
      console.error('Error loading workspaces:', error)
      setLoadError(true)
      setLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setLoadError(false)
    try {
      const res: any = await apiGet(`/enterprise/workspaces/${workspaceId}/audit-logs`, undefined, false)
      setLogs(Array.isArray(res?.data?.logs) ? res.data.logs : [])
      setTotalLogs(Number.isFinite(Number(res?.data?.total)) ? Number(res.data.total) : null)
    } catch (error) {
      console.error('Error loading logs:', error)
      setLogs([])
      setTotalLogs(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const loadAnalytics = useCallback(async () => {
    if (!workspaceId) return
    try {
      const res: any = await apiGet(`/enterprise/workspaces/${workspaceId}/audit-logs/analytics`, undefined, false)
      setMetrics(res?.data && typeof res.data === 'object' ? res.data : null)
    } catch (error) {
      console.error('Error loading analytics:', error)
      setMetrics(null)
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

  // GET /api/enterprise/workspaces/:id/compliance/report — saved as JSON.
  const downloadReport = async () => {
    if (!workspaceId) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const res: any = await apiGet(`/enterprise/workspaces/${workspaceId}/compliance/report`, undefined, false)
      const blob = new Blob([JSON.stringify(res?.data ?? res, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compliance-report-${workspaceId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Compliance report download failed:', error)
      setDownloadError(t('enterpriseGovernance.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return logs
    return logs.filter(log =>
      [log.action, log.resourceType, log.userId?.name, log.userId?.email]
        .some(v => typeof v === 'string' && v.toLowerCase().includes(q))
    )
  }, [logs, query])

  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '—')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-blue-500/5">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-500 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" aria-hidden="true" />
            {t('enterpriseGovernance.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('enterpriseGovernance.subtitleReal')}
          </p>
        </div>

        {workspaces.length > 0 && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <select
                  value={workspaceId}
                  title={t('enterpriseGovernance.selectWorkspace')}
                  aria-label={t('enterpriseGovernance.selectWorkspace')}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="appearance-none bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-2 pr-10 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {workspaces.map(ws => (
                    <option key={ws._id} value={ws._id}>{ws.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={downloadReport}
                disabled={downloading}
                title={t('enterpriseGovernance.downloadReport')}
                aria-label={t('enterpriseGovernance.downloadReport')}
                className="p-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60"
              >
                <Download className={`w-5 h-5 ${downloading ? 'animate-pulse' : ''}`} aria-hidden="true" />
              </button>
            </div>
            {downloadError && <p role="alert" className="text-xs text-rose-500">{downloadError}</p>}
          </div>
        )}
      </div>

      {loadError && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {t('enterpriseGovernance.loadFailed')}
        </div>
      )}

      {!loading && !loadError && workspaces.length === 0 ? (
        <div className="bg-white dark:bg-[#0f172a] p-10 rounded-3xl border border-gray-100 dark:border-white/5 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('enterpriseGovernance.noWorkspaces')}
        </div>
      ) : (
      <>
      {/* Counts — straight from the audit log analytics (last 30 days) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title={t('enterpriseGovernance.metricActions')}
          value={num(metrics?.totalActions)}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title={t('enterpriseGovernance.metricPrivacyEvents')}
          value={num(metrics?.complianceEvents)}
          icon={Lock}
          color="indigo"
        />
        <MetricCard
          title={t('enterpriseGovernance.metricSecurityEvents')}
          value={num(metrics?.securityEvents)}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-xl shadow-blue-500/5">
        <div className="p-6 border-b border-gray-50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" aria-hidden="true" />
            {t('enterpriseGovernance.auditLog')}
            {totalLogs !== null && <span className="text-xs font-medium text-gray-400">({totalLogs.toLocaleString()})</span>}
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('enterpriseGovernance.searchLogsPlaceholder')}
              aria-label={t('enterpriseGovernance.searchLogsPlaceholder')}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 font-medium uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-4">{t('enterpriseGovernance.colAction')}</th>
                <th className="px-6 py-4">{t('enterpriseGovernance.colUser')}</th>
                <th className="px-6 py-4">{t('enterpriseGovernance.colResource')}</th>
                <th className="px-6 py-4">{t('enterpriseGovernance.colTimestamp')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-8 h-4 bg-gray-100/50 dark:bg-white/5 rounded-lg mb-2"></td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center opacity-60 italic">
                    {t('enterpriseGovernance.noLogsFound')}
                  </td>
                </tr>
              ) : filteredLogs.map(log => (
                <tr key={log._id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-blue-500" aria-hidden="true" />
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white capitalize">
                        {String(log.action || '').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{log.userId?.name || t('enterpriseGovernance.systemUser')}</span>
                      <span className="text-[10px] opacity-50">{log.userId?.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[10px] font-mono">
                      {String(log.resourceType || '—').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs opacity-60">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: 'blue' | 'amber' | 'indigo' }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    indigo: 'text-indigo-600 bg-indigo-500/10',
  }

  return (
    <div className="bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-blue-500/5">
      <div className={`w-12 h-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-4 shadow-inner`}>
        <Icon className="w-6 h-6" aria-hidden="true" />
      </div>
      <h4 className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</h4>
      <span className="text-2xl font-black text-gray-900 dark:text-white mt-1 block">{value}</span>
    </div>
  )
}
