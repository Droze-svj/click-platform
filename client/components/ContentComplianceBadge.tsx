'use client'

import { useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'

interface ComplianceIssue {
  type: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

interface ComplianceCheck {
  status: 'passed' | 'warning' | 'failed' | 'pending' | null
  score?: number | null
  checkedAt?: string
  issues?: ComplianceIssue[]
  platforms?: string[]
}

interface ContentComplianceBadgeProps {
  complianceCheck: ComplianceCheck | null | undefined
  showScore?: boolean
  showPopover?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const STATUS_CONFIG = {
  passed: {
    icon: ShieldCheck,
    label: 'Compliant',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    iconClass: 'text-emerald-500',
  },
  warning: {
    icon: ShieldAlert,
    label: 'Warnings',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    iconClass: 'text-amber-500',
  },
  failed: {
    icon: ShieldX,
    label: 'Failed',
    badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
    iconClass: 'text-red-500',
  },
  pending: {
    icon: AlertTriangle,
    label: 'Unchecked',
    badgeClass: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border border-gray-500/30',
    iconClass: 'text-gray-400',
  },
}

const SEVERITY_COLORS = {
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const SIZE_CLASSES = {
  sm: { badge: 'text-xs px-1.5 py-0.5 gap-1', icon: 'w-3 h-3', popover: 'w-64' },
  md: { badge: 'text-sm px-2 py-1 gap-1.5', icon: 'w-4 h-4', popover: 'w-72' },
  lg: { badge: 'text-sm px-3 py-1.5 gap-2', icon: 'w-5 h-5', popover: 'w-80' },
}

export default function ContentComplianceBadge({
  complianceCheck,
  showScore = false,
  showPopover = true,
  size = 'md',
}: ContentComplianceBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)

  const status = complianceCheck?.status ?? 'pending'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon
  const sizeClasses = SIZE_CLASSES[size]

  if (!complianceCheck) {
    return (
      <span
        className={`inline-flex items-center rounded-full font-medium ${sizeClasses.badge} bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-300/30`}
        title="No compliance check performed"
      >
        <AlertTriangle className={`${sizeClasses.icon} text-gray-400`} />
        Not checked
      </span>
    )
  }

  const issues = complianceCheck.issues || []
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warnCount = issues.filter(i => i.severity === 'warning').length

  const badge = (
    <button
      id="compliance-badge-toggle"
      onClick={() => showPopover && setIsOpen(!isOpen)}
      className={`inline-flex items-center rounded-full font-medium transition-all ${sizeClasses.badge} ${config.badgeClass} ${showPopover ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      title={`Compliance: ${config.label}${complianceCheck.score != null ? ` (${complianceCheck.score}/100)` : ''}`}
    >
      <Icon className={`${sizeClasses.icon} ${config.iconClass} flex-shrink-0`} />
      <span>{config.label}</span>
      {showScore && complianceCheck.score != null && (
        <span className="opacity-70 ml-1">· {complianceCheck.score}</span>
      )}
      {showPopover && issues.length > 0 && (
        isOpen ? <ChevronUp className={`${sizeClasses.icon} ml-0.5 opacity-60`} /> : <ChevronDown className={`${sizeClasses.icon} ml-0.5 opacity-60`} />
      )}
    </button>
  )

  if (!showPopover || issues.length === 0) return badge

  return (
    <div className="relative inline-block">
      {badge}

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 left-0 ${sizeClasses.popover} bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3`}
          role="dialog"
          aria-label="Compliance issues"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Icon className={`w-4 h-4 ${config.iconClass}`} />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                {errorCount > 0 && warnCount > 0 && ', '}
                {warnCount > 0 && `${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
                {errorCount === 0 && warnCount === 0 && 'Issues'}
              </span>
            </div>
            {complianceCheck.score != null && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Score: {complianceCheck.score}/100
              </span>
            )}
          </div>

          {/* Issues list */}
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {issues.slice(0, 8).map((issue, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <Info className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${SEVERITY_COLORS[issue.severity]}`} />
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                  {issue.message}
                </p>
              </li>
            ))}
            {issues.length > 8 && (
              <li className="text-xs text-gray-400 dark:text-gray-500 pl-5">
                +{issues.length - 8} more issue(s)…
              </li>
            )}
          </ul>

          {/* Platforms */}
          {complianceCheck.platforms && complianceCheck.platforms.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Checked for: {complianceCheck.platforms.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
