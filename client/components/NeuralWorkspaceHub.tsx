'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet, apiPost } from '../lib/api'
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
  AlertTriangle,
  Zap,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Layers,
  Fingerprint,
  Brain,
  TrendingUp,
  Lightbulb
} from 'lucide-react'
import { useCreatorProfile } from './OnboardingWizard'
import { useTranslation } from '@/hooks/useTranslation'

const glassStyle = "relative overflow-hidden rounded-[2.5rem] border border-white/[0.05] bg-white/[0.02] backdrop-blur-2xl shadow-2xl transition-all"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

export default function NeuralWorkspaceHub() {
  const { t } = useTranslation()
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [compliance, setCompliance] = useState<any>(null)
  const [sla, setSla] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [advisorData, setAdvisorData] = useState<any>(null)
  const { showToast } = useToast()
  const creatorProfile = useCreatorProfile()

  const loadAdvisorData = useCallback(async () => {
    const goalMap: Record<string, { nba: string; forecast: string; efficiency: number }> = {
      viral:          { nba: t('neuralWorkspaceHub.nbaViral'), forecast: t('neuralWorkspaceHub.forecastViral'), efficiency: 82 },
      engagement:     { nba: t('neuralWorkspaceHub.nbaEngagement'), forecast: t('neuralWorkspaceHub.forecastEngagement'), efficiency: 74 },
      monetize:       { nba: t('neuralWorkspaceHub.nbaMonetize'), forecast: t('neuralWorkspaceHub.forecastMonetize'), efficiency: 68 },
      brand_awareness:{ nba: t('neuralWorkspaceHub.nbaBrandAwareness'), forecast: t('neuralWorkspaceHub.forecastBrandAwareness'), efficiency: 71 },
    }
    const goal = creatorProfile?.creatorGoal || 'engagement'
    setAdvisorData(goalMap[goal] || goalMap.engagement)
  }, [creatorProfile, t])

  useEffect(() => {
    loadWorkspaces()
    loadAdvisorData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAdvisorData])

  const loadWorkspaces = async () => {
    try {
      const response = await apiGet('/enterprise/workspaces')
      const ws = response?.workspaces || response?.data?.workspaces || []
      setWorkspaces(ws)
      if (ws.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(ws[0])
      }
    } catch (error: any) {
      showToast(t('neuralWorkspaceHub.failedToSynchronizeWorkspaces'), 'error')
    }
  }

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    setLoading(true)
    try {
      const [auditRes, templatesRes, complianceRes, slaRes] = await Promise.all([
        apiGet(`/enterprise/workspaces/${workspaceId}/audit-logs?limit=10`),
        apiGet(`/enterprise/workflow-templates?workspaceId=${workspaceId}`),
        apiGet(`/enterprise/workspaces/${workspaceId}/compliance/gdpr`),
        apiGet(`/enterprise/workspaces/${workspaceId}/sla`)
      ])

      setAuditLogs(auditRes?.logs || auditRes?.data?.logs || [])
      setTemplates(templatesRes?.templates || templatesRes?.data?.templates || [])
      setCompliance(complianceRes?.data || complianceRes)
      setSla(slaRes?.data || slaRes)
    } catch (error: any) {
      showToast(t('neuralWorkspaceHub.neuralTelemetryLinkInterrupted'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (selectedWorkspace) {
      loadWorkspaceData(selectedWorkspace._id)
    }
  }, [selectedWorkspace, loadWorkspaceData])

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12 max-w-7xl mx-auto pb-20 relative px-8 mt-12"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/05 blur-[150px] rounded-full opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-600/05 blur-[150px] rounded-full opacity-50 pointer-events-none" />

      {/* Hero Header */}
      <div className="space-y-8 border-b border-white/[0.05] pb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">
          <Fingerprint className="w-3.5 h-3.5" />
          {t('neuralWorkspaceHub.sovereignGovernanceNode')}
        </div>
        <div className="flex flex-col xl:flex-row items-end justify-between gap-8">
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-[var(--text-main)] uppercase leading-[0.8]">
            {t('neuralWorkspaceHub.workspace')}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">{t('neuralWorkspaceHub.control')}</span>
          </h1>
          <div className="flex-1 max-w-xl">
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-4">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               {t('neuralWorkspaceHub.autonomousPermissionsSync')}
            </p>
            <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-indigo-500/30 pl-4">
              {t('neuralWorkspaceHub.multiBrandManagementPre')} <span className="text-indigo-400 font-bold">{t('neuralWorkspaceHub.neuralClearance')}</span> {t('neuralWorkspaceHub.multiBrandManagementPost')}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="px-10 py-5 rounded-2xl bg-indigo-600 text-white font-black text-xs tracking-[0.2em] uppercase shadow-2xl shadow-indigo-600/20 flex items-center gap-4 transition-all"
          >
            <Building2 className="w-4 h-4" />
            {t('neuralWorkspaceHub.newWorkspaceCluster')}
          </motion.button>
        </div>
      </div>

      {/* Workspace Selector */}
      <motion.div variants={itemVariants} className={`${glassStyle} p-3 group`}>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1 custom-scrollbar">
          {workspaces.map(ws => (
            <button
              type="button"
              key={ws._id}
              onClick={() => setSelectedWorkspace(ws)}
              className={`px-6 py-4 rounded-2xl whitespace-nowrap transition-all flex items-center gap-3 border shadow-inner ${
                selectedWorkspace?._id === ws._id
                  ? 'bg-white/[0.08] text-white border-white/20 shadow-xl'
                  : 'bg-white/[0.02] text-slate-500 border-white/5 hover:bg-white/[0.05] hover:text-slate-300'
              }`}
            >
              <Building2 className={`w-4 h-4 ${selectedWorkspace?._id === ws._id ? 'text-indigo-400' : 'text-slate-600'}`} />
              <span className="text-[11px] font-black uppercase tracking-widest">{ws.name}</span>
              <span className="text-[9px] font-bold opacity-30 italic font-mono">/{ws.type.substring(0,3)}</span>
            </button>
          ))}
          {workspaces.length === 0 && (
            <div className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em] py-4 px-6 italic">{t('neuralWorkspaceHub.searchingNeuralCloud')}</div>
          )}
        </div>
      </motion.div>

      {selectedWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Details & Permissions */}
          <div className="lg:col-span-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Core Attributes */}
              <motion.div variants={itemVariants} className={`${glassStyle} p-10 group`}>
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-inner">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic tracking-[0.2em]">{t('neuralWorkspaceHub.coreClusterHub')}</div>
                </div>
                <div className="space-y-6 relative z-10">
                  <h3 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight uppercase">{t('neuralWorkspaceHub.clusterHealth')}</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">{t('neuralWorkspaceHub.syncStatus')}</div>
                      <div className="text-lg font-black text-emerald-400 italic uppercase leading-none flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" /> {t('neuralWorkspaceHub.normal')}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">{t('neuralWorkspaceHub.accessLevel')}</div>
                      <div className="text-lg font-black text-white italic uppercase leading-none">{selectedWorkspace.userRole || t('neuralWorkspaceHub.member')}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">{t('neuralWorkspaceHub.totalNodes')}</div>
                      <div className="text-lg font-black text-white italic uppercase leading-none">{t('neuralWorkspaceHub.entitiesCount', { count: selectedWorkspace.members?.length || 0 })}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">{t('neuralWorkspaceHub.residency')}</div>
                      <div className="text-lg font-black text-indigo-400 italic uppercase leading-none flex items-center gap-1.5 font-mono">
                        <Globe className="w-3 h-3" />
                        {selectedWorkspace.settings?.dataResidency?.region?.toUpperCase() || 'GLB'}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Permission Matrix */}
              <motion.div variants={itemVariants} className={`${glassStyle} p-10 group`}>
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 shadow-inner">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic tracking-[0.2em]">{t('neuralWorkspaceHub.clearanceGrid')}</div>
                </div>
                <div className="space-y-6 relative z-10">
                  <h3 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight uppercase">{t('neuralWorkspaceHub.nodePermissions')}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {(selectedWorkspace.userPermissions ? Object.entries(selectedWorkspace.userPermissions) : []).slice(0, 6).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between p-3 px-4 rounded-xl bg-white/[0.02] border border-white/[0.05] transition-all hover:bg-white/[0.05]">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${value ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        {value ? (
                          <div className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="p-1 rounded-md bg-white/5 border border-white/10">
                            <XCircle className="w-3 h-3 text-slate-700" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Audit Log Timeline */}
            <motion.div variants={itemVariants} className={`${glassStyle} p-10 space-y-10 group`}>
              <div className="flex items-center justify-between border-b border-white/[0.05] pb-10">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Activity className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight uppercase">{t('neuralWorkspaceHub.sovereignLedger')}</h3>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{t('neuralWorkspaceHub.autonomousIntegrityAudit')}</p>
                  </div>
                </div>
                <button className="px-5 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all shadow-xl">{t('neuralWorkspaceHub.exportSyncLog')}</button>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <div className="p-20 text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center mx-auto opacity-40">
                      <Clock className="w-7 h-7 text-slate-600" />
                    </div>
                    <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] italic">{t('neuralWorkspaceHub.noActiveLedgerEntries')}</p>
                  </div>
                ) : (
                  auditLogs.map((log: any, index: number) => (
                    <motion.div
                      key={index}
                      whileHover={{ x: 8 }}
                      className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] flex items-center justify-between group cursor-default transition-all hover:bg-white/[0.05] hover:border-white/10"
                    >
                      <div className="flex items-center gap-8">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/10 text-slate-500 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-[var(--text-main)] italic tracking-tight uppercase group-hover:text-indigo-400 transition-colors">{log.action}</h4>
                          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest font-mono mt-1 block">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                        <ArrowUpRight className="w-4 h-4 text-indigo-400" />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
          {/* Right Column: Templates, Compliance, SLA */}
          <div className="lg:col-span-4 space-y-10">
            {/* Workflow Templates */}
            <motion.div variants={itemVariants} className={`${glassStyle} p-10 space-y-8 group`}>
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Workflow className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{t('neuralWorkspaceHub.automationNodes')}</h3>
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{t('neuralWorkspaceHub.workflowRepositories')}</p>
                </div>
              </div>
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <div className="text-slate-600 text-[10px] font-black uppercase tracking-widest italic p-8 bg-white/[0.02] border border-dashed border-white/10 rounded-[2rem] text-center">{t('neuralWorkspaceHub.emptyRepository')}</div>
                ) : (
                  templates.map((template: any) => (
                    <div key={template._id} className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] group hover:bg-white/[0.05] transition-all cursor-pointer">
                      <div className="font-black text-sm text-white uppercase italic tracking-tight">{template.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold mt-1 line-clamp-1">{template.description}</div>
                      <div className="flex items-center justify-between mt-6">
                        <div className="px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-[8px] font-black border border-purple-500/20 uppercase tracking-widest">{template.category || t('neuralWorkspaceHub.standard')}</div>
                        <div className="text-[9px] font-black text-slate-600 tabular-nums uppercase tracking-widest">{t('neuralWorkspaceHub.deployedCount', { count: template.usageCount || 0 })}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button className="w-full py-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-purple-400 text-[9px] font-black uppercase tracking-[0.4em] transition-all shadow-xl">{t('neuralWorkspaceHub.syncSwarmMarketplace')}</button>
            </motion.div>

            {/* Compliance HUD */}
            {compliance && (
              <motion.div variants={itemVariants} className={`${glassStyle} p-10 space-y-8 relative group`}>
                <div className="absolute inset-0 bg-emerald-500/05 opacity-20 pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{t('neuralWorkspaceHub.governanceStatus')}</h3>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{t('neuralWorkspaceHub.sovereignCompliance')}</p>
                  </div>
                </div>
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between p-5 px-6 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('neuralWorkspaceHub.globalGdpr')}</span>
                    {compliance.gdprEnabled ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[9px] font-black border border-emerald-500/20 italic uppercase tracking-widest">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('neuralWorkspaceHub.normal')}
                      </div>
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 px-6 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05]">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 font-mono">{t('neuralWorkspaceHub.residency')}</div>
                      <div className="text-xl font-black text-white italic uppercase leading-none">{compliance.dataResidency?.toUpperCase() || 'GLB'}</div>
                    </div>
                    <div className="p-5 px-6 rounded-[1.5rem] bg-white/[0.02] border border-white/[0.05]">
                      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 font-mono">{t('neuralWorkspaceHub.trustLvl')}</div>
                      <div className="text-xl font-black text-white italic uppercase leading-none">{t('neuralWorkspaceHub.tier1')}</div>
                    </div>
                  </div>
                  {compliance.issues && compliance.issues.length > 0 && (
                    <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-amber-500/05">
                      <AlertTriangle className="w-7 h-7 text-amber-400" />
                      <div>
                        <div className="text-[11px] font-black text-amber-400 uppercase tracking-widest">{t('neuralWorkspaceHub.integrityGaps', { count: compliance.issues.length })}</div>
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight mt-0.5">{t('neuralWorkspaceHub.optimizationAvailable')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SLA Telemetry */}
            {sla && (
              <motion.div variants={itemVariants} className={`${glassStyle} p-10 space-y-8 group`}>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-main)] italic uppercase tracking-tight">{t('neuralWorkspaceHub.slaTelemetry')}</h3>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">{t('neuralWorkspaceHub.realtimeNodeUptime')}</p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{t('neuralWorkspaceHub.signalPurity')}</span>
                      <span className={`text-2xl font-black italic tabular-nums ${
                        sla.compliance?.uptime ? 'text-emerald-400' : 'text-rose-500'
                      }`}>
                        {sla.actual?.uptime?.toFixed(3)}<span className="text-[10px] opacity-40 ml-1 font-mono">%</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-white/[0.02] rounded-full overflow-hidden p-0.5 border border-white/[0.05]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${sla.actual?.uptime || 0}%` }}
                        className={`h-full rounded-full ${
                          sla.compliance?.uptime ? 'bg-emerald-500' : 'bg-rose-500'
                        } shadow-[0_0_20px_rgba(16,185,129,0.3)]`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-6 px-8 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] shadow-inner">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic line-clamp-1">{t('neuralWorkspaceHub.avgLatency')}</span>
                      <div className="text-2xl font-black text-white italic tabular-nums">{sla.actual?.avgResponseTime}<span className="text-xs opacity-40 ml-1 font-mono tracking-tighter">MS</span></div>
                    </div>
                    <div className="text-right space-y-2">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic line-clamp-1">{t('neuralWorkspaceHub.target')}</span>
                      <div className="text-2xl font-black text-slate-500 italic tabular-nums">{sla.configured?.responseTime}<span className="text-xs opacity-40 ml-1 font-mono tracking-tighter">MS</span></div>
                    </div>
                  </div>
                  {sla.violations && sla.violations.length > 0 && (
                    <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-rose-500/05">
                      <ZapOff className="w-7 h-7 text-rose-500" />
                      <div>
                        <div className="text-[11px] font-black text-rose-500 uppercase tracking-widest">{t('neuralWorkspaceHub.dropouts', { count: sla.violations.length })}</div>
                         <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight mt-0.5">{t('neuralWorkspaceHub.slaNonCompliance')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* AI Advisor Hub — Fixed below main grid */}
      <motion.div variants={itemVariants} className={`${glassStyle} p-12 space-y-10 relative group bg-gradient-to-br from-indigo-500/05 to-purple-500/05`}>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-1000" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 border-b border-white/[0.05] pb-10">
          <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
            <Brain className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-4xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">{t('neuralWorkspaceHub.swarmAdvisor')}</h3>
            <p className="text-[11px] text-slate-500 uppercase tracking-[0.4em] font-black mt-1">
              {creatorProfile?.creatorGoal ? t('neuralWorkspaceHub.missionStrategy', { goal: creatorProfile.creatorGoal.replace('_', ' ') }) : t('neuralWorkspaceHub.awaitingMissionCalibration')}
            </p>
          </div>
        </div>

        {advisorData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {/* Next Best Action */}
            <div className="md:col-span-2 p-8 rounded-[2.5rem] bg-indigo-500/05 border border-indigo-500/10 space-y-4 shadow-inner group-hover:border-indigo-500/20 transition-all">
              <div className="flex items-center gap-2.5 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                <Lightbulb className="w-4 h-4" /> {t('neuralWorkspaceHub.nextStrategicNode')}
              </div>
              <p className="text-white font-bold text-lg leading-relaxed italic border-l-2 border-indigo-500/30 pl-6">&quot;{advisorData.nba}&quot;</p>
            </div>
            {/* Forecast */}
            <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] space-y-4 shadow-inner">
              <div className="flex items-center gap-2.5 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                <TrendingUp className="w-4 h-4" /> {t('neuralWorkspaceHub.predictedYield')}
              </div>
              <p className="text-emerald-400 font-black text-2xl italic tracking-tight">{advisorData.forecast}</p>
            </div>
            {/* Workflow Efficiency */}
            <div className="md:col-span-3 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                  <Zap className="w-4 h-4 text-amber-400" /> {t('neuralWorkspaceHub.swarmAlignmentScore')}
                </div>
                <span className={`text-3xl font-black italic tabular-nums ${
                  advisorData.efficiency >= 80 ? 'text-emerald-400' : advisorData.efficiency >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>{advisorData.efficiency}<span className="text-[10px] opacity-30 ml-1 font-mono font-bold">%</span></span>
              </div>
              <div className="h-3 rounded-full bg-white/[0.02] overflow-hidden p-0.5 border border-white/[0.05]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${advisorData.efficiency}%` }}
                  transition={{ duration: 1.5, ease: 'circOut' }}
                  className={`h-full rounded-full ${
                    advisorData.efficiency >= 80 ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : advisorData.efficiency >= 60 ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                  }`}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-16 text-center text-slate-600 text-[10px] font-black uppercase tracking-[0.5em] italic border-2 border-dashed border-white/5 rounded-[4rem]">
            {t('neuralWorkspaceHub.syncMissionProfile')}
          </div>
        )}
      </motion.div>

      {/* Footer Info */}
      <motion.div variants={itemVariants} className="text-center pt-24 opacity-30">
        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[1em] italic">{t('neuralWorkspaceHub.footerTagline')}</p>
      </motion.div>
    </motion.div>
  )
}

const ZapOff = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="12.41 6.75 13 2 10.57 4.92"></polyline><polyline points="18.57 12.91 21 10 15.66 10"></polyline><polyline points="8 8 3 14 12 14 11 22 16 16"></polyline><line x1="1" y1="1" x2="23" y2="23"></line></svg>
