'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useAuth } from '../../../hooks/useAuth'
import { useTranslation } from '../../../hooks/useTranslation'
import { useToast } from '../../../contexts/ToastContext'
import { API_URL } from '../../../lib/api'
import {
  Shield, CheckCircle2, XCircle, Clock, Plus, ChevronRight,
  MessageSquare, Inbox, type LucideIcon,
} from 'lucide-react'
import ToastContainer from '../../../components/ToastContainer'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Badge,
  FormField,
  Input,
  Textarea,
  Modal,
  EmptyState,
  SectionHeader,
} from '../../../components/ui'

interface ApprovalRequest {
  _id: string
  entityType: string
  entityId: string
  requestedBy: {
    _id: string
    name: string
    email: string
  }
  requestedFrom: {
    _id: string
    name: string
    email: string
  }
  status: string
  priority: string
  response: string
  createdAt: string
  expiresAt: string | null
}

const STATUS_BADGE: Record<string, string> = {
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

export default function ApprovalsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newRequest, setNewRequest] = useState({
    entityType: 'content',
    entityId: '',
    requestedFrom: '',
    priority: 'medium',
    message: ''
  })

  const loadRequests = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) return

      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)

      const res = await axios.get(`${API_URL}/approvals?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data.success) {
        setRequests(Array.isArray(res.data.data) ? res.data.data : [])
      }
    } catch {
      showToast(t('approvalsPage.toastLoadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    loadRequests()
  }, [user, router, loadRequests])

  const handleApprove = async (id: string) => {
    const log = prompt(t('approvalsPage.promptValidationLog'))
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/approve`, { response: log || '' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast(t('approvalsPage.toastAuthorized'), 'success')
      loadRequests()
    } catch (err: any) {
      showToast(err.response?.data?.error || t('approvalsPage.toastAuthorizeFailed'), 'error')
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt(t('approvalsPage.promptDissentReason'))
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/reject`, { response: reason || '' }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast(t('approvalsPage.toastVetoed'), 'success')
      loadRequests()
    } catch (err: any) {
      showToast(err.response?.data?.error || t('approvalsPage.toastVetoFailed'), 'error')
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm(t('approvalsPage.confirmAbortInit'))) return
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      showToast(t('approvalsPage.toastAborted'), 'success')
      loadRequests()
    } catch (err: any) {
      showToast(err.response?.data?.error || t('approvalsPage.toastAbortFailed'), 'error')
    }
  }

  const handleCreate = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${API_URL}/approvals`, newRequest, { headers: { Authorization: `Bearer ${token}` } })
      showToast(t('approvalsPage.toastInitialized'), 'success')
      setShowModal(false)
      setNewRequest({ entityType: 'content', entityId: '', requestedFrom: '', priority: 'medium', message: '' })
      loadRequests()
    } catch (err: any) {
      showToast(err.response?.data?.error || t('approvalsPage.toastInitFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center gap-4 py-48" aria-busy="true" aria-label={t('approvalsPage.loading')}>
        <Shield size={32} className="text-primary animate-pulse" aria-hidden />
        <span className="ds-text-label text-theme-muted">{t('approvalsPage.loading')}</span>
      </div>
    )
  }

  const pendingNodes = requests.filter(r => r.status === 'pending')

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* Header (global DashboardHeader provides the breadcrumb) */}
        <SectionHeader
          as="h1"
          title={t('approvalsPage.title')}
          description={t('approvalsPage.subtitle')}
          className="mb-6"
          actions={
            <Button
              variant="primary"
              size="md"
              onClick={() => setShowModal(true)}
              leftIcon={<Plus size={16} aria-hidden />}
            >
              {t('approvalsPage.initializeConsensus')}
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {t(`approvalsPage.filter.${f}`)}
            </Button>
          ))}
        </div>

        {/* Pending requests */}
        {pendingNodes.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              as="h2"
              title={t('approvalsPage.pendingTitle')}
              description={t('approvalsPage.pendingSubtitle')}
              className="mb-5"
              actions={
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {t('approvalsPage.resonanceAlert', { count: pendingNodes.length })}
                </Badge>
              }
            />

            <div className="ds-bento-grid">
              {pendingNodes.map((request) => (
                <Panel key={request._id} variant="bento" className="ds-bento-2x1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 space-y-2">
                      <Badge className="bg-primary/10 text-primary">
                        {t('approvalsPage.nodeEntity', { entity: request.entityType })}
                      </Badge>
                      <h3 className="ds-text-h3 text-theme-primary truncate">{request.requestedBy.name}</h3>
                      <p className="ds-text-caption truncate">{t('approvalsPage.idLabel', { id: request.entityId.substring(0, 16) })}</p>
                    </div>
                    <div className="flex items-center gap-1.5 ds-text-caption flex-shrink-0">
                      <Clock size={14} aria-hidden />
                      {new Date(request.createdAt).toLocaleTimeString()}
                    </div>
                  </div>

                  {request.response && (
                    <div className="ds-surface-subtle flex gap-2 p-3 mb-4">
                      <MessageSquare size={16} className="text-theme-muted flex-shrink-0 mt-0.5" aria-hidden />
                      <p className="ds-text-body text-theme-muted line-clamp-3">{request.response}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      onClick={() => handleApprove(request._id)}
                      leftIcon={<CheckCircle2 size={16} aria-hidden />}
                    >
                      {t('approvalsPage.authorize')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      className="flex-1 text-rose-500"
                      onClick={() => handleReject(request._id)}
                      leftIcon={<XCircle size={16} aria-hidden />}
                    >
                      {t('approvalsPage.dissent')}
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        <section>
          <SectionHeader
            as="h2"
            title={t('approvalsPage.historyTitle')}
            description={t('approvalsPage.protocolLogsAnalyzed', { count: requests.length })}
            className="mb-5"
          />

          {requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={t('approvalsPage.emptyTitle')}
              description={t('approvalsPage.emptyState')}
              className="ds-surface-card"
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const isInitiator = request.requestedBy._id === user?.id
                const isValidator = request.requestedFrom._id === user?.id

                return (
                  <Panel key={request._id} variant="glass" className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="ds-surface-subtle flex h-14 w-14 flex-col items-center justify-center rounded-xl flex-shrink-0">
                      <span className="ds-text-h3 text-theme-primary leading-none">{new Date(request.createdAt).getDate()}</span>
                      <span className="ds-text-caption leading-none">{new Date(request.createdAt).toLocaleString('default', { month: 'short' })}</span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={STATUS_BADGE[request.status] || STATUS_BADGE.pending}>
                          {t(`approvalsPage.status.${request.status}`)}
                        </Badge>
                        <Badge className="ds-surface-subtle text-theme-muted">
                          {t('approvalsPage.nodeEntity', { entity: request.entityType })}
                        </Badge>
                        <span className="ds-text-caption">{t('approvalsPage.hashLabel', { hash: request.entityId.substring(0, 24) })}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-8 gap-y-2">
                        <div>
                          <p className="ds-text-caption">{t('approvalsPage.identMapPrimary')}</p>
                          <p className="ds-text-label text-theme-primary">{isInitiator ? request.requestedFrom.name : request.requestedBy.name}</p>
                        </div>
                        <div>
                          <p className="ds-text-caption">{t('approvalsPage.nodeRoleSigner')}</p>
                          <p className="ds-text-label text-primary">{isInitiator ? t('approvalsPage.targetValidator') : t('approvalsPage.inboundInitiator')}</p>
                        </div>
                      </div>
                      {request.response && (
                        <div className="ds-surface-subtle p-3">
                          <p className="ds-text-caption mb-1">{t('approvalsPage.logResonanceData')}</p>
                          <p className="ds-text-body text-theme-muted">{request.response}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {request.status === 'pending' && isValidator && (
                        <>
                          <IconButton variant="primary" size="md" aria-label={t('approvalsPage.authorize')} title={t('approvalsPage.authorize')} onClick={() => handleApprove(request._id)}>
                            <CheckCircle2 size={18} aria-hidden />
                          </IconButton>
                          <IconButton variant="secondary" size="md" aria-label={t('approvalsPage.dissent')} title={t('approvalsPage.dissent')} className="text-rose-500" onClick={() => handleReject(request._id)}>
                            <XCircle size={18} aria-hidden />
                          </IconButton>
                        </>
                      )}
                      {request.status === 'pending' && isInitiator && (
                        <Button variant="secondary" size="sm" className="text-rose-500" onClick={() => handleCancel(request._id)}>
                          {t('approvalsPage.abortInit')}
                        </Button>
                      )}
                    </div>
                  </Panel>
                )
              })}
            </div>
          )}
        </section>

        {/* Create request modal */}
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={t('approvalsPage.modalTitle')}
          description={t('approvalsPage.modalSubtitle')}
          className="max-w-2xl"
        >
          <div className="space-y-5">
            <FormField label={t('approvalsPage.nodeEntitySelection')}>
              <div className="grid grid-cols-3 gap-2">
                {['content', 'script', 'payload'].map(type => (
                  <Button
                    key={type}
                    variant={newRequest.entityType === type ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => setNewRequest({ ...newRequest, entityType: type })}
                  >
                    {t('approvalsPage.nodeEntity', { entity: type })}
                  </Button>
                ))}
              </div>
            </FormField>

            <FormField label={t('approvalsPage.criticalityFlux')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <Button
                    key={p}
                    variant={newRequest.priority === p ? (p === 'urgent' ? 'destructive' : 'primary') : 'secondary'}
                    size="sm"
                    onClick={() => setNewRequest({ ...newRequest, priority: p })}
                  >
                    {t(`approvalsPage.priority.${p}`)}
                  </Button>
                ))}
              </div>
            </FormField>

            <FormField label={t('approvalsPage.targetSignerIdentity')} htmlFor="req-signer">
              <Input
                id="req-signer"
                type="text"
                value={newRequest.requestedFrom}
                onChange={e => setNewRequest({ ...newRequest, requestedFrom: e.target.value })}
                placeholder={t('approvalsPage.placeholderOperatorId')}
              />
            </FormField>

            <FormField label={t('approvalsPage.payloadHashLabel')} htmlFor="req-payload">
              <Input
                id="req-payload"
                type="text"
                value={newRequest.entityId}
                onChange={e => setNewRequest({ ...newRequest, entityId: e.target.value })}
                placeholder={t('approvalsPage.placeholderPayloadHash')}
              />
            </FormField>

            <FormField label={t('approvalsPage.objectivePromptLabel')} htmlFor="req-message">
              <Textarea
                id="req-message"
                value={newRequest.message}
                onChange={e => setNewRequest({ ...newRequest, message: e.target.value })}
                rows={3}
                placeholder={t('approvalsPage.placeholderConsensusGoal')}
              />
            </FormField>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleCreate}
              loading={submitting}
              leftIcon={!submitting ? <Shield size={18} aria-hidden /> : undefined}
            >
              {t('approvalsPage.startGateProtocol')}
            </Button>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  )
}
