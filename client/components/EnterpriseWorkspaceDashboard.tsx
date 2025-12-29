'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import {
  Building2,
  Users,
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Globe,
  BarChart3,
  Workflow,
  AlertTriangle
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export default function EnterpriseWorkspaceDashboard() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [compliance, setCompliance] = useState<any>(null)
  const [sla, setSla] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadWorkspaces()
  }, [])

  useEffect(() => {
    if (selectedWorkspace) {
      loadWorkspaceData(selectedWorkspace._id)
    }
  }, [selectedWorkspace])

  const loadWorkspaces = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/enterprise/workspaces`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setWorkspaces(response.data.data.workspaces || [])
        if (response.data.data.workspaces?.length > 0) {
          setSelectedWorkspace(response.data.data.workspaces[0])
        }
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load workspaces', 'error')
    }
  }

  const loadWorkspaceData = async (workspaceId: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [auditRes, templatesRes, complianceRes, slaRes] = await Promise.all([
        axios.get(`${API_URL}/enterprise/workspaces/${workspaceId}/audit-logs?limit=10`, { headers }),
        axios.get(`${API_URL}/enterprise/workflow-templates?workspaceId=${workspaceId}`, { headers }),
        axios.get(`${API_URL}/enterprise/workspaces/${workspaceId}/compliance/gdpr`, { headers }),
        axios.get(`${API_URL}/enterprise/workspaces/${workspaceId}/sla`, { headers })
      ])

      if (auditRes.data.success) setAuditLogs(auditRes.data.data.logs || [])
      if (templatesRes.data.success) setTemplates(templatesRes.data.data.templates || [])
      if (complianceRes.data.success) setCompliance(complianceRes.data.data)
      if (slaRes.data.success) setSla(slaRes.data.data)
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load workspace data', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Enterprise Workspaces</h1>
            <p className="text-indigo-100">
              Multi-brand/multi-client workspaces with granular permissions
            </p>
          </div>
          <button className="bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2">
            <Building2 className="w-5 h-5 inline mr-2" />
            New Workspace
          </button>
        </div>
      </div>

      {/* Workspace Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-4 overflow-x-auto">
          {workspaces.map(ws => (
            <button
              key={ws._id}
              onClick={() => setSelectedWorkspace(ws)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                selectedWorkspace?._id === ws._id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              {ws.name}
              <span className="ml-2 text-xs opacity-75">({ws.type})</span>
            </button>
          ))}
        </div>
      </div>

      {selectedWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workspace Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              Workspace Details
            </h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Type</div>
                <div className="font-medium capitalize">{selectedWorkspace.type}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Your Role</div>
                <div className="font-medium capitalize">{selectedWorkspace.userRole}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Members</div>
                <div className="font-medium">{selectedWorkspace.members?.length || 0}</div>
              </div>
              {selectedWorkspace.settings?.dataResidency && (
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data Residency</div>
                  <div className="font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {selectedWorkspace.settings.dataResidency.region.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Permissions */}
          {selectedWorkspace.userPermissions && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                Your Permissions
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(selectedWorkspace.userPermissions).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2">
                    {value ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Logs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Recent Audit Logs
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditLogs.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No audit logs</div>
              ) : (
                auditLogs.map((log: any, index: number) => (
                  <div key={index} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                    <div className="font-medium">{log.action}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Workflow Templates */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Workflow className="w-6 h-6 text-indigo-600" />
              Workflow Templates
            </h2>
            <div className="space-y-2">
              {templates.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No templates</div>
              ) : (
                templates.map((template: any) => (
                  <div key={template._id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-gray-500">{template.description}</div>
                    <div className="text-xs text-indigo-600 mt-1">
                      Used {template.usageCount || 0} times
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* GDPR Compliance */}
          {compliance && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                GDPR Compliance
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">GDPR Enabled</span>
                  {compliance.gdprEnabled ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Data Residency</div>
                  <div className="font-medium">{compliance.dataResidency.toUpperCase()}</div>
                </div>
                {compliance.issues && compliance.issues.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      {compliance.issues.length} Issues Found
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SLA Status */}
          {sla && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                SLA Status
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Uptime</span>
                    <span className={`font-medium ${
                      sla.compliance?.uptime ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {sla.actual?.uptime?.toFixed(2)}% / {sla.configured?.uptime}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        sla.compliance?.uptime ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${sla.actual?.uptime || 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Response Time</span>
                    <span className={`font-medium ${
                      sla.compliance?.responseTime ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {sla.actual?.avgResponseTime}ms / {sla.configured?.responseTime}ms
                    </span>
                  </div>
                </div>
                {sla.violations && sla.violations.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="text-sm font-medium text-red-900 dark:text-red-100">
                      {sla.violations.length} SLA Violations
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

