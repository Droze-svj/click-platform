'use client'

import { useState, useEffect, useCallback } from 'react'
import { Webhook, Plus, Trash2, TestTube, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

interface Webhook {
  _id: string
  url: string
  events: string[]
  isActive: boolean
  successCount: number
  failureCount: number
  lastTriggered?: string
}

interface WorkflowWebhookManagerProps {
  workflowId: string
}

export default function WorkflowWebhookManager({ workflowId }: WorkflowWebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    secret: '',
    events: ['workflow.completed'],
  })
  const { showToast } = useToast()
  const { t } = useTranslation()

  const loadWebhooks = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks?workflowId=${workflowId}`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setWebhooks(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    loadWebhooks()
  }, [loadWebhooks])

  const createWebhook = async () => {
    if (!newWebhook.url) {
      showToast(t('workflowWebhookManager.urlRequired'), 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/workflows/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          workflowId,
          ...newWebhook,
        }),
      })

      if (response.ok) {
        showToast(t('workflowWebhookManager.createSuccess'), 'success')
        setShowCreate(false)
        setNewWebhook({ url: '', secret: '', events: ['workflow.completed'] })
        loadWebhooks()
      } else {
        showToast(t('workflowWebhookManager.createFailed'), 'error')
      }
    } catch (error) {
      showToast('Failed to create webhook', 'error')
    }
  }

  const deleteWebhook = async (id: string) => {
    if (!confirm(t('workflowWebhookManager.deleteConfirm'))) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks/${id}`, {
        credentials: 'include',
      })

      if (response.ok) {
        showToast(t('workflowWebhookManager.deleted'), 'success')
        loadWebhooks()
      } else {
        showToast(t('workflowWebhookManager.deleteFailed'), 'error')
      }
    } catch (error) {
      showToast('Failed to delete webhook', 'error')
    }
  }

  const testWebhook = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks/${id}/test`, {
        credentials: 'include',
      })

      if (response.ok) {
        showToast(t('workflowWebhookManager.testSent'), 'success')
        loadWebhooks()
      } else {
        showToast(t('workflowWebhookManager.testFailed'), 'error')
      }
    } catch (error) {
      showToast('Webhook test failed', 'error')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold text-lg text-gray-900 dark:text-[var(--text-main)]">
            {t('workflowWebhookManager.title')}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t('workflowWebhookManager.addWebhook')}</span>
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('workflowWebhookManager.urlLabel')}
              </label>
              <input
                type="url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('workflowWebhookManager.secretLabel')}
              </label>
              <input
                type="password"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                placeholder={t('workflowWebhookManager.secretPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createWebhook}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {t('workflowWebhookManager.create')}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('workflowWebhookManager.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('workflowWebhookManager.loading')}</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('workflowWebhookManager.emptyState')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map((webhook) => (
            <div
              key={webhook._id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {webhook.url}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t('workflowWebhookManager.eventsLabel')}: {webhook.events.join(', ')}
                  </span>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {t('workflowWebhookManager.successCount', { count: webhook.successCount })}
                    </span>
                  </div>
                  {webhook.failureCount > 0 && (
                    <div className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {t('workflowWebhookManager.failureCount', { count: webhook.failureCount })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => testWebhook(webhook._id)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title={t('workflowWebhookManager.testWebhook')}
                >
                  <TestTube className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteWebhook(webhook._id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title={t('workflowWebhookManager.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}






