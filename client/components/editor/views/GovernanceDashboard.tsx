'use client'

import React, { useState, useEffect } from 'react'
import { ShieldCheck, Fingerprint } from 'lucide-react'
import { apiGet, handleApiError } from '../../../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface GovernanceAction {
  _id: string
  actionType: string
  resourceId: string
  resourceType: string
  justification: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: {
    decisionHash: string
    immutableAnchor: boolean
    [key: string]: any
  }
  timestamp: string
}

export const GovernanceDashboard: React.FC = () => {
    const { t } = useTranslation()
    const [actions, setActions] = useState<GovernanceAction[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        fetchLedger()
    }, [])

    const fetchLedger = async () => {
        try {
            // GET /click/ledger answers a bare GovernanceAction[] for this user.
            // (/sovereign/ledger is a different {audits, state} payload.)
            const res: any = await apiGet('/click/ledger', undefined, false)
            const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
            setActions(list)
            setLoadError('')
        } catch (err) {
            setActions([])
            setLoadError(handleApiError(err) || t('governanceDashboard.loadFailed'))
        } finally {
            setLoading(false)
        }
    }

    // Restyled onto the design system: this was the only block on the page set in
    // 8-10px black italic uppercase on hardcoded white/[0.03] glass, which also
    // disappeared in light theme. The internal decision hash column is gone —
    // it meant nothing to a reader; the reason column carries the substance.
    const severityClass = (sev: GovernanceAction['severity']) =>
        sev === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        : sev === 'high' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
        : 'bg-muted border-default text-theme-secondary'

    return (
        <section className="space-y-4">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h2 className="ds-text-h3 text-theme-primary">{t('governanceDashboard.title')}</h2>
                    <p className="text-sm text-theme-muted">{t('governanceDashboard.subtitle')}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full border border-default px-2.5 py-1 text-xs font-medium text-theme-secondary tabular-nums">
                    {t('governanceDashboard.count', { count: actions.length })}
                </span>
            </div>

            <div className="ds-surface-card overflow-hidden">
                {loading ? (
                    <div className="space-y-3 p-5" aria-busy="true">
                        {[1, 2, 3].map((n) => <div key={n} className="h-4 animate-pulse rounded-full bg-muted" />)}
                    </div>
                ) : loadError ? (
                    <div role="alert" className="p-5 text-sm text-rose-600 dark:text-rose-400">{t('governanceDashboard.loadFailed')} {loadError}</div>
                ) : actions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                        <Fingerprint className="w-10 h-10 text-theme-muted" aria-hidden="true" />
                        <p className="text-sm font-medium text-theme-primary">{t('governanceDashboard.emptyTitle')}</p>
                        <p className="max-w-sm text-sm text-theme-muted">{t('governanceDashboard.emptyBody')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-left text-sm">
                            <thead className="border-b border-default bg-muted/40">
                                <tr>
                                    <th className="px-5 py-3 ds-text-label text-theme-muted">{t('governanceDashboard.colTime')}</th>
                                    <th className="px-5 py-3 ds-text-label text-theme-muted">{t('governanceDashboard.colAction')}</th>
                                    <th className="px-5 py-3 ds-text-label text-theme-muted">{t('governanceDashboard.colReason')}</th>
                                    <th className="px-5 py-3 ds-text-label text-theme-muted">{t('governanceDashboard.colSeverity')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)]">
                                {actions.map((action) => (
                                    <tr key={action._id} className="hover:bg-muted/40 transition-colors">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <div className="text-theme-primary">{new Date(action.timestamp).toLocaleTimeString()}</div>
                                            <div className="text-xs text-theme-muted">{new Date(action.timestamp).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-theme-primary">{action.actionType}</td>
                                        <td className="px-5 py-3 text-theme-secondary"><p className="max-w-md line-clamp-2">{action.justification}</p></td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${severityClass(action.severity)}`}>
                                                {action.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    )
}
