'use client'

import { useState, useEffect } from 'react'
import { Webhook, Plus, Trash2, TestTube, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

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

  useEffect(() => {
    loadWebhooks()
  }, [workflowId])

  const loadWebhooks = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks?workflowId=${workflowId}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }

  const createWebhook = async () => {
    if (!newWebhook.url) {
      showToast('Webhook URL is required', 'error')
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
        showToast('Webhook created successfully', 'success')
        setShowCreate(false)
        setNewWebhook({ url: '', secret: '', events: ['workflow.completed'] })
        loadWebhooks()
      } else {
        showToast('Failed to create webhook', 'error')
      }
    } catch (error) {
      showToast('Failed to create webhook', 'error')
    }
  }

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Webhook deleted', 'success')
        loadWebhooks()
      } else {
        showToast('Failed to delete webhook', 'error')
      }
    } catch (error) {
      showToast('Failed to delete webhook', 'error')
    }
  }

  const testWebhook = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/workflows/webhooks/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Webhook test sent', 'success')
        loadWebhooks()
      } else {
        showToast('Webhook test failed', 'error')
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
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Webhooks
          </h3>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Webhook</span>
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Webhook URL
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
                Secret (optional)
              </label>
              <input
                type="password"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                placeholder="Webhook secret for signing"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createWebhook}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No webhooks configured. Add a webhook to receive notifications when workflows run.
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
                    Events: {webhook.events.join(', ')}
                  </span>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {webhook.successCount} success
                    </span>
                  </div>
                  {webhook.failureCount > 0 && (
                    <div className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {webhook.failureCount} failed
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testWebhook(webhook._id)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Test Webhook"
                >
                  <TestTube className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteWebhook(webhook._id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
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






