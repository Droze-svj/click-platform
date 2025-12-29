'use client'

import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, RefreshCw, FileText, Shield, Eye, BarChart3, Lock } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '../hooks/useTranslation'

interface Backup {
  filename: string
  size: number
  createdAt: Date
  filepath: string
  type?: 'full' | 'incremental'
}

interface BackupStats {
  totalBackups: number
  fullBackups: number
  incrementalBackups: number
  totalSize: number
  oldestBackup: Date | null
  newestBackup: Date | null
}

export default function BackupManager() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [backupOptions, setBackupOptions] = useState({
    includeContent: true,
    includePosts: true,
    includeScripts: true,
    includeSettings: true,
    format: 'json' as 'json' | 'csv',
    encrypt: false,
    incremental: false,
  })
  const [encryptionPassword, setEncryptionPassword] = useState('')
  const { showToast } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    loadBackups()
    loadStats()
  }, [])

  const loadBackups = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/backup/list', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setBackups(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load backups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/backup/stats', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const createBackup = async () => {
    if (backupOptions.encrypt && !encryptionPassword) {
      showToast('Password required for encrypted backup', 'error')
      return
    }

    setIsCreating(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...backupOptions,
          password: backupOptions.encrypt ? encryptionPassword : null,
        }),
      })

      if (response.ok) {
        showToast('Backup created successfully', 'success')
        setShowCreate(false)
        setEncryptionPassword('')
        loadBackups()
        loadStats()
      } else {
        showToast('Failed to create backup', 'error')
      }
    } catch (error) {
      showToast('Failed to create backup', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const downloadBackup = async (filename: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/backup/export`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showToast('Backup downloaded', 'success')
      }
    } catch (error) {
      showToast('Failed to download backup', 'error')
    }
  }

  const deleteBackup = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/backup/${filename}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (response.ok) {
        showToast('Backup deleted', 'success')
        loadBackups()
        loadStats()
      } else {
        showToast('Failed to delete backup', 'error')
      }
    } catch (error) {
      showToast('Failed to delete backup', 'error')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Backup Statistics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Backups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBackups}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Full Backups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.fullBackups}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Incremental</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.incrementalBackups}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Size</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatFileSize(stats.totalSize)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Backup Manager */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              Backup & Recovery
            </h3>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Create Backup</span>
          </button>
        </div>

        {/* Create Backup Form */}
        {showCreate && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Backup Options</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backupOptions.includeContent}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeContent: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Content</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backupOptions.includePosts}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includePosts: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Posts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backupOptions.includeScripts}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeScripts: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Scripts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={backupOptions.includeSettings}
                    onChange={(e) => setBackupOptions({ ...backupOptions, includeSettings: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Include Settings</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Format
                  </label>
                  <select
                    value={backupOptions.format}
                    onChange={(e) => setBackupOptions({ ...backupOptions, format: e.target.value as 'json' | 'csv' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={backupOptions.incremental}
                      onChange={(e) => setBackupOptions({ ...backupOptions, incremental: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Incremental Backup</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={backupOptions.encrypt}
                    onChange={(e) => setBackupOptions({ ...backupOptions, encrypt: e.target.checked })}
                    className="rounded"
                  />
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Encrypt Backup</span>
                  </div>
                </label>
                {backupOptions.encrypt && (
                  <input
                    type="password"
                    value={encryptionPassword}
                    onChange={(e) => setEncryptionPassword(e.target.value)}
                    placeholder="Enter encryption password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={createBackup}
                  disabled={isCreating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Backup'}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setEncryptionPassword('')
                  }}
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
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading backups...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              No backups found. Create your first backup to protect your data.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {backup.filename}
                      </p>
                      {backup.type && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          backup.type === 'full'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                        }`}>
                          {backup.type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatFileSize(backup.size)} • {new Date(backup.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadBackup(backup.filename)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.filename)}
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
    </div>
  )
}
