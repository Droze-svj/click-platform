'use client'

import React, { useState, useEffect } from 'react'
import { 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Scissors, 
  Volume2, 
  Maximize, 
  History,
  Play,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import { apiPost, handleApiError } from '../../../lib/api'
import { useTranslation } from '@/hooks/useTranslation'
import { Panel, SectionHeader, Button } from '../../ui'

interface RemediationAction {
  type: string
  value?: number
  timestamp?: number
}

// What POST /phase16_18/remediation/process returns (server/services/remediationService.js).
interface RemediationStatus {
  success: boolean
  status: 'IDLE' | 'CLEAN' | 'SCHEDULED' | 'EVOLVED'
  actionPlan?: RemediationAction[]
  applied?: string[]
  commentsChecked?: number
  finalUrl?: string
  window?: { start: number, end: number }
}

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => unknown


export const RemediationHUD: React.FC<{ contentId: string; showToast?: ToastFn }> = ({ contentId, showToast }) => {
    const { t } = useTranslation()
    const [status, setStatus] = useState<RemediationStatus | null>(null)
    const [loading, setLoading] = useState(false)
    const [isEvolutionWindow, setIsEvolutionWindow] = useState(false)

    useEffect(() => {
        // Quick check if we are in window
        const hour = new Date().getHours()
        setIsEvolutionWindow(hour >= 2 && hour < 6)
    }, [])

    const triggerRemediation = async () => {
        setLoading(true)
        try {
            const res: any = await apiPost('/phase16_18/remediation/process', { contentId })
            const data: RemediationStatus = res?.data ?? res
            setStatus(data)
            const count = data?.actionPlan?.length || 0
            if (data?.status === 'CLEAN') showToast?.(t('editorPanels.remediation.noFixesToast'), 'info')
            else if (data?.status === 'SCHEDULED') showToast?.(t('editorPanels.remediation.scheduledToast', { count }), 'info')
            else if (data?.status === 'EVOLVED') showToast?.(t('editorPanels.remediation.appliedToast', { applied: data.applied?.length || 0, count }), 'success')
        } catch (err) {
            showToast?.(t('editorPanels.remediation.failedToast', { error: handleApiError(err) }), 'error')
        } finally {
            setLoading(false)
        }
    }

    const ACTION_LABEL: Record<string, string> = {
        ADJUST_VOLUME: t('editorPanels.remediation.actionVolume'),
        STABILIZE: t('editorPanels.remediation.actionStabilize'),
        ENLARGE_TEXT: t('editorPanels.remediation.actionText'),
    }
    const lastRun = status?.status === 'EVOLVED' || status?.status === 'CLEAN'
        ? t('editorPanels.remediation.lastRunNow')
        : status?.status === 'SCHEDULED' ? t('editorPanels.remediation.lastRunScheduled') : t('editorPanels.remediation.lastRunNever')

    return (
        <Panel>
            <SectionHeader
                as="h3"
                title={
                    <span className="inline-flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-amber-500" aria-hidden />
                        {t('editorPanels.remediation.title')}
                    </span>
                }
                description={t('editorPanels.remediation.subtitle')}
                actions={
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        isEvolutionWindow
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                        : 'border-[var(--border-subtle)] text-theme-muted'
                    }`}>
                        <Clock className="w-3.5 h-3.5" aria-hidden />
                        {isEvolutionWindow ? t('editorPanels.remediation.windowOpen') : t('editorPanels.remediation.windowHours')}
                    </span>
                }
                className="mb-5"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Planned fixes */}
                <div className="ds-surface-subtle p-4">
                    <h4 className="ds-text-label text-theme-primary mb-3">{t('editorPanels.remediation.plannedFixes')}</h4>
                    {status?.actionPlan && status.actionPlan.length > 0 ? (
                        <ul className="space-y-2">
                            {status.actionPlan.map((action, i) => (
                                <m.li
                                    key={i}
                                    initial={{ x: -8, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] p-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {action.type === 'ADJUST_VOLUME' && <Volume2 className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden />}
                                        {action.type === 'STABILIZE' && <Zap className="w-4 h-4 text-amber-500 shrink-0" aria-hidden />}
                                        {action.type === 'ENLARGE_TEXT' && <Maximize className="w-4 h-4 text-sky-500 shrink-0" aria-hidden />}
                                        <div className="min-w-0">
                                            <span className="block text-sm font-medium text-theme-primary">
                                                {ACTION_LABEL[action.type] || action.type.replace(/_/g, ' ').toLowerCase()}
                                            </span>
                                            <span className="ds-text-caption text-theme-muted">
                                                {t('editorPanels.remediation.value', { value: action.value ?? '—' })}
                                            </span>
                                        </div>
                                    </div>
                                    {status.status === 'EVOLVED' && status.applied?.includes(action.type) ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label={t('editorPanels.remediation.applied')} />
                                    ) : (
                                        <span className="ds-text-caption text-theme-muted">
                                            {status.status === 'EVOLVED' ? t('editorPanels.remediation.notApplied') : t('editorPanels.remediation.planned')}
                                        </span>
                                    )}
                                </m.li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-theme-muted">
                            <AlertCircle className="w-6 h-6" aria-hidden />
                            <span className="text-sm">
                                {status?.status === 'CLEAN'
                                    ? t('editorPanels.remediation.noFixesNeeded', { count: status.commentsChecked ?? 0 })
                                    : t('editorPanels.remediation.notChecked')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Run */}
                <div className="ds-surface-subtle p-4 flex flex-col gap-4">
                    <div>
                        <h4 className="ds-text-label text-theme-primary">{t('editorPanels.remediation.checkComments')}</h4>
                        <p className="mt-1 text-sm text-theme-muted">{t('editorPanels.remediation.checkCommentsDesc')}</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={triggerRemediation}
                        disabled={loading}
                        loading={loading}
                        leftIcon={!loading ? <Sparkles className="w-4 h-4" aria-hidden /> : undefined}
                        className="w-full"
                    >
                        {loading ? t('editorPanels.remediation.checking') : t('editorPanels.remediation.run')}
                    </Button>
                    <div className="mt-auto flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3 ds-text-caption text-theme-muted">
                        <History className="w-4 h-4" aria-hidden />
                        <span>{t('editorPanels.remediation.lastRun')}</span>
                        <span className="font-medium text-theme-primary">{lastRun}</span>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
