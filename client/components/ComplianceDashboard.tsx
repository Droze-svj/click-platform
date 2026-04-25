'use client'

import { useState, useCallback } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Settings,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Globe,
  BarChart2,
  Tag,
  Link2,
  Zap,
} from 'lucide-react'
import { extractApiData } from '../utils/apiResponse'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplianceIssue {
  type: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

interface PlatformRules {
  platform: string
  maxCharacters?: number
  maxHashtags?: number
  recommendedHashtags?: number
  noExternalLinks?: boolean
  characterUsage?: number
  hashtagCount?: number
}

interface BreakdownSection {
  passed: boolean
  issues: ComplianceIssue[]
  spamScore?: number
  checkedUrls?: number
  categories?: Record<string, boolean>
}

interface ComplianceReport {
  status: 'passed' | 'warning' | 'failed'
  score: number
  checkedAt: string
  issueCount: number
  issues: ComplianceIssue[]
  platforms: string[]
  breakdown: {
    profanity: BreakdownSection
    spam: BreakdownSection
    brandSafety: BreakdownSection
    linkSafety: BreakdownSection & { checkedUrls?: number }
    platformPolicy: Record<string, { passed: boolean; issues: ComplianceIssue[]; platformRules: PlatformRules }>
    ai: { passed: boolean; categories: Record<string, boolean> } | null
  }
  recommendations: string[]
}

interface ComplianceRule {
  _id: string
  name: string
  description?: string
  category: string
  ruleType: string
  keywords?: string[]
  blockedDomains?: string[]
  severity: 'info' | 'warning' | 'error'
  action: 'warn' | 'block' | 'flag_for_review'
  isActive: boolean
  triggerCount: number
  createdAt: string
}

interface PlatformPolicy {
  maxCharacters?: number
  maxHashtags?: number
  recommendedHashtags?: number
  noExternalLinks?: boolean
  notes?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS = ['tiktok', 'instagram', 'twitter', 'youtube', 'linkedin', 'facebook']

const SEVERITY_STYLES = {
  error: { badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25', icon: XCircle, dot: 'bg-red-500' },
  warning: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25', icon: AlertTriangle, dot: 'bg-amber-500' },
  info: { badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25', icon: Info, dot: 'bg-blue-500' },
}

const STATUS_STYLES = {
  passed: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', icon: ShieldCheck },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', icon: ShieldAlert },
  failed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-600 dark:text-red-400', icon: ShieldX },
}

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  brand_safety: Tag,
  profanity: ShieldX,
  link_safety: Link2,
  platform_policy: Globe,
  legal: Shield,
  custom: Settings,
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 40
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-800" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{score}</div>
        <div className="text-xs text-gray-500 -mt-0.5">/ 100</div>
      </div>
    </div>
  )
}

function IssueCard({ issue }: { issue: ComplianceIssue }) {
  const style = SEVERITY_STYLES[issue.severity]
  const Icon = style.icon

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg ${style.badge}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm leading-relaxed">{issue.message}</p>
        <p className="text-xs opacity-60 capitalize mt-0.5">{issue.type.replace(/_/g, ' ')}</p>
      </div>
    </div>
  )
}

function BreakdownRow({
  label, icon: Icon, passed, issueCount, onClick,
}: {
  label: string
  icon: React.FC<{ className?: string }>
  passed: boolean
  issueCount: number
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg ${passed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {issueCount > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </span>
        )}
        {passed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-red-500" />}
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </div>
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<'checker' | 'rules' | 'platforms' | 'history'>('checker')

  // ── Checker State ──
  const [checkerText, setCheckerText] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [checkerError, setCheckerError] = useState<string | null>(null)

  // ── Rules State ──
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [isAddingRule, setIsAddingRule] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', category: 'brand_safety', ruleType: 'keyword_block', keywords: '', severity: 'warning' })
  const [isSavingRule, setIsSavingRule] = useState(false)

  // ── Platform Policies State ──
  const [policies, setPolicies] = useState<Record<string, PlatformPolicy> | null>(null)
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)

  // ── History State ──
  const [history, setHistory] = useState<{ summary: any; items: any[] } | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // ─── Checker ─────────────────────────────────────────────────────────────

  const handleCheck = async () => {
    if (!checkerText.trim()) return
    setIsChecking(true)
    setCheckerError(null)
    setReport(null)

    try {
      const response = await fetch('/api/moderation/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: checkerText,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Compliance check failed')
      }

      const data = await response.json()
      const result = extractApiData<ComplianceReport>(data)
      if (result) setReport(result)
    } catch (err: any) {
      setCheckerError(err.message)
    } finally {
      setIsChecking(false)
    }
  }

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  // ─── Rules Management ─────────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    setIsLoadingRules(true)
    try {
      const res = await fetch('/api/moderation/rules', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRules(extractApiData<ComplianceRule[]>(data) || [])
      }
    } catch { /* silent */ } finally {
      setIsLoadingRules(false)
    }
  }, [])

  const handleSaveRule = async () => {
    setIsSavingRule(true)
    try {
      const res = await fetch('/api/moderation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newRule,
          keywords: newRule.keywords.split(',').map(k => k.trim()).filter(Boolean),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const rule = extractApiData<ComplianceRule>(data)
        if (rule) setRules(prev => [rule, ...prev])
        setIsAddingRule(false)
        setNewRule({ name: '', category: 'brand_safety', ruleType: 'keyword_block', keywords: '', severity: 'warning' })
      }
    } catch { /* silent */ } finally {
      setIsSavingRule(false)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/moderation/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setRules(prev => prev.filter(r => r._id !== ruleId))
      }
    } catch { /* silent */ }
  }

  // ─── Platform Policies ────────────────────────────────────────────────────

  const loadPolicies = useCallback(async () => {
    setIsLoadingPolicies(true)
    try {
      const res = await fetch('/api/moderation/platform-policies', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPolicies(extractApiData<Record<string, PlatformPolicy>>(data) || {})
      }
    } catch { /* silent */ } finally {
      setIsLoadingPolicies(false)
    }
  }, [])

  // ─── History ─────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const res = await fetch('/api/moderation/report/workspace', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setHistory(extractApiData(data) as any)
      }
    } catch { /* silent */ } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  // Tab change side-effects
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (tab === 'rules' && rules.length === 0) loadRules()
    if (tab === 'platforms' && !policies) loadPolicies()
    if (tab === 'history' && !history) loadHistory()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'checker' as const, label: 'Pre-Publish Check', icon: Shield },
    { id: 'rules' as const, label: 'Rules', icon: Settings },
    { id: 'platforms' as const, label: 'Platform Policies', icon: Globe },
    { id: 'history' as const, label: 'History', icon: BarChart2 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Compliance & Brand Safety
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ensure content meets brand standards and platform policies before publishing
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            {TABS.map(tab => (
              <button
                key={tab.id}
                id={`compliance-tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ─── PRE-PUBLISH CHECKER ─── */}
            {activeTab === 'checker' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Input */}
                  <div className="lg:col-span-2 space-y-4">
                    <div>
                      <label htmlFor="compliance-content-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Content to Check
                      </label>
                      <textarea
                        id="compliance-content-input"
                        title="Content text to check for compliance"
                        placeholder="Paste your post caption, video description, or any text to run a compliance check…"
                        value={checkerText}
                        onChange={(e) => setCheckerText(e.target.value)}
                        rows={8}
                        className="w-full p-4 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-400">{checkerText.length} characters</span>
                        <span className="text-xs text-gray-400">{(checkerText.match(/#[^\s]+/g) || []).length} hashtags</span>
                      </div>
                    </div>

                    {/* Platform selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Check Against Platforms (optional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map(p => (
                          <button
                            key={p}
                            id={`platform-filter-${p}`}
                            onClick={() => togglePlatform(p)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize transition-all ${
                              selectedPlatforms.includes(p)
                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-400'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      id="run-compliance-check-btn"
                      onClick={handleCheck}
                      disabled={isChecking || !checkerText.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {isChecking ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</>
                      ) : (
                        <><Zap className="w-4 h-4" /> Run Compliance Check</>
                      )}
                    </button>
                  </div>

                  {/* Score panel */}
                  {report && (
                    <div className="space-y-4">
                      {/* Overall score */}
                      <div className={`p-5 rounded-2xl border ${STATUS_STYLES[report.status].bg} ${STATUS_STYLES[report.status].border}`}>
                        <div className="flex flex-col items-center gap-3">
                          <ScoreRing score={report.score} />
                          <div className={`flex items-center gap-1.5 font-semibold ${STATUS_STYLES[report.status].text}`}>
                            {(() => { const S = STATUS_STYLES[report.status].icon; return <S className="w-5 h-5" /> })()}
                            <span className="capitalize">{report.status}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            {report.issueCount} issue{report.issueCount !== 1 ? 's' : ''} found
                          </p>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
                        <BreakdownRow
                          label="Profanity"
                          icon={ShieldX}
                          passed={report.breakdown.profanity.passed}
                          issueCount={report.breakdown.profanity.issues.length}
                        />
                        <BreakdownRow
                          label="Spam"
                          icon={AlertTriangle}
                          passed={report.breakdown.spam.passed}
                          issueCount={report.breakdown.spam.issues.length}
                        />
                        <BreakdownRow
                          label="Brand Safety"
                          icon={Tag}
                          passed={report.breakdown.brandSafety.passed}
                          issueCount={report.breakdown.brandSafety.issues.length}
                        />
                        <BreakdownRow
                          label="Link Safety"
                          icon={Link2}
                          passed={report.breakdown.linkSafety.passed}
                          issueCount={report.breakdown.linkSafety.issues.length}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Error */}
                {checkerError && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    {checkerError}
                  </div>
                )}

                {/* Issue cards */}
                {report && report.issues.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Issues Found</h3>
                    <div className="grid gap-2">
                      {report.issues.map((issue, idx) => <IssueCard key={idx} issue={issue} />)}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {report && report.recommendations.length > 0 && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                    <h3 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2 text-sm">Recommendations</h3>
                    <ul className="space-y-1.5">
                      {report.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                          <ChevronRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ─── RULES MANAGER ─── */}
            {activeTab === 'rules' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">Workspace Rules</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Custom keywords, blocked domains, and patterns for your brand</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      id="refresh-rules-btn"
                      onClick={loadRules}
                      className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingRules ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      id="add-rule-btn"
                      onClick={() => setIsAddingRule(!isAddingRule)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Rule
                    </button>
                  </div>
                </div>

                {/* Add rule form */}
                {isAddingRule && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                    <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200">New Rule</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="new-rule-name" className="text-xs text-gray-500 mb-1 block">Rule Name *</label>
                        <input
                          id="new-rule-name"
                          type="text"
                          title="Rule name"
                          placeholder="e.g. Block Competitor Brands"
                          value={newRule.name}
                          onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="new-rule-category" className="text-xs text-gray-500 mb-1 block">Category *</label>
                        <select
                          id="new-rule-category"
                          title="Rule category"
                          value={newRule.category}
                          onChange={e => setNewRule(p => ({ ...p, category: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="brand_safety">Brand Safety</option>
                          <option value="profanity">Profanity</option>
                          <option value="link_safety">Link Safety</option>
                          <option value="platform_policy">Platform Policy</option>
                          <option value="legal">Legal</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="new-rule-type" className="text-xs text-gray-500 mb-1 block">Rule Type *</label>
                        <select
                          id="new-rule-type"
                          title="Rule type"
                          value={newRule.ruleType}
                          onChange={e => setNewRule(p => ({ ...p, ruleType: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="keyword_block">Block Keywords</option>
                          <option value="keyword_require">Require Keywords</option>
                          <option value="url_block">Block URLs / Domains</option>
                          <option value="regex">Regex Pattern</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="new-rule-severity" className="text-xs text-gray-500 mb-1 block">Severity</label>
                        <select
                          id="new-rule-severity"
                          title="Rule severity"
                          value={newRule.severity}
                          onChange={e => setNewRule(p => ({ ...p, severity: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="info">Info</option>
                          <option value="warning">Warning</option>
                          <option value="error">Error (block)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="new-rule-keywords" className="text-xs text-gray-500 mb-1 block">
                        {newRule.ruleType === 'url_block' ? 'Blocked Domains (comma-separated)' : 'Keywords (comma-separated)'}
                      </label>
                      <input
                        id="new-rule-keywords"
                        type="text"
                        title="Keywords or domains"
                        placeholder={newRule.ruleType === 'url_block' ? 'example.com, badsite.net' : 'competitor, rival-brand, off-brand-term'}
                        value={newRule.keywords}
                        onChange={e => setNewRule(p => ({ ...p, keywords: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setIsAddingRule(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        Cancel
                      </button>
                      <button
                        id="save-rule-btn"
                        onClick={handleSaveRule}
                        disabled={isSavingRule || !newRule.name}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50"
                      >
                        {isSavingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Save Rule
                      </button>
                    </div>
                  </div>
                )}

                {/* Rules list */}
                {isLoadingRules ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No compliance rules yet. Add one to protect your brand.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rules.map(rule => {
                      const CatIcon = CATEGORY_ICONS[rule.category] || Settings
                      return (
                        <div
                          key={rule._id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                            rule.isActive
                              ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                              : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800/50 opacity-60'
                          }`}
                        >
                          <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <CatIcon className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{rule.name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_STYLES[rule.severity]?.badge}`}>
                                {rule.severity}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 capitalize mt-0.5">
                              {rule.category.replace(/_/g, ' ')} · {rule.ruleType.replace(/_/g, ' ')}
                              {rule.keywords && rule.keywords.length > 0 && ` · ${rule.keywords.slice(0, 3).join(', ')}${rule.keywords.length > 3 ? '…' : ''}`}
                            </p>
                          </div>
                          {rule.triggerCount > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-400">{rule.triggerCount} trigger{rule.triggerCount !== 1 ? 's' : ''}</p>
                            </div>
                          )}
                          <button
                            id={`delete-rule-${rule._id}`}
                            onClick={() => handleDeleteRule(rule._id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                            title="Deactivate rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── PLATFORM POLICIES ─── */}
            {activeTab === 'platforms' && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Platform Content Policies</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Official limits and guidelines for each platform</p>
                </div>

                {isLoadingPolicies ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : policies ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(policies).map(([platform, policy]) => (
                      <div key={platform} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold capitalize text-gray-900 dark:text-white mb-3">{platform}</h3>
                        <dl className="space-y-1.5">
                          {policy.maxCharacters && (
                            <div className="flex justify-between text-sm">
                              <dt className="text-gray-500">Max characters</dt>
                              <dd className="font-mono text-gray-900 dark:text-white">{policy.maxCharacters.toLocaleString()}</dd>
                            </div>
                          )}
                          {policy.maxHashtags !== undefined && (
                            <div className="flex justify-between text-sm">
                              <dt className="text-gray-500">Max hashtags</dt>
                              <dd className="font-mono text-gray-900 dark:text-white">{policy.maxHashtags}</dd>
                            </div>
                          )}
                          {policy.recommendedHashtags !== undefined && (
                            <div className="flex justify-between text-sm">
                              <dt className="text-gray-500">Recommended hashtags</dt>
                              <dd className="font-mono text-indigo-600 dark:text-indigo-400">{policy.recommendedHashtags}</dd>
                            </div>
                          )}
                          {policy.noExternalLinks && (
                            <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              No clickable external links in captions
                            </div>
                          )}
                          {(policy as any).notes && (
                            <p className="text-xs text-gray-400 italic">{(policy as any).notes}</p>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <button
                      id="load-platform-policies-btn"
                      onClick={loadPolicies}
                      className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg"
                    >
                      Load Platform Policies
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── HISTORY ─── */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">Compliance History</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Past compliance checks across your content library</p>
                  </div>
                  <button
                    id="refresh-history-btn"
                    onClick={loadHistory}
                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : history ? (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Total Checks', value: history.summary.total, color: 'text-indigo-600' },
                        { label: 'Passed', value: history.summary.passed, color: 'text-emerald-600' },
                        { label: 'Warnings', value: history.summary.warnings, color: 'text-amber-600' },
                        { label: 'Failed', value: history.summary.failed, color: 'text-red-600' },
                      ].map(stat => (
                        <div key={stat.label} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {history.summary.avgScore != null && (
                      <p className="text-center text-sm text-gray-500">
                        Average compliance score: <span className="font-semibold text-gray-900 dark:text-white">{history.summary.avgScore}/100</span>
                      </p>
                    )}

                    {/* Items table */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Content</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Score</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Checked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {history.items.map((item: any) => {
                            const s = STATUS_STYLES[item.complianceCheck?.status as 'passed' | 'warning' | 'failed'] || STATUS_STYLES.passed
                            const Icon = s.icon
                            return (
                              <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-900 dark:text-white truncate max-w-48">
                                    {item.title || '(Untitled)'}
                                  </p>
                                  <p className="text-xs text-gray-400 capitalize">{item.type}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text} border ${s.border}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                    <span className="capitalize">{item.complianceCheck?.status}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">
                                  {item.complianceCheck?.score ?? '—'}/100
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {item.complianceCheck?.checkedAt
                                    ? new Date(item.complianceCheck.checkedAt).toLocaleDateString()
                                    : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No compliance history yet.</p>
                    <p className="text-xs mt-1">Run a check on your content to start tracking.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
