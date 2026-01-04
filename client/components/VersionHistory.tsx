'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import LoadingSpinner from './LoadingSpinner'
import { History, RotateCcw, Eye } from 'lucide-react'

interface Version {
  _id: string
  versionNumber: number
  contentSnapshot: any
  changes: string
  changedBy: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
}

interface VersionHistoryProps {
  contentId: string
  onRestore?: () => void
}

export default function VersionHistory({ contentId, onRestore }: VersionHistoryProps) {
  const { showToast } = useToast()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)

  useEffect(() => {
    if (contentId) {
      loadVersions()
    }
  }, [contentId])

  const loadVersions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/versions/content/${contentId}`,
        {
        }
      )

      if (response.data.success) {
        setVersions(response.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load version history', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (version: Version) => {
    if (!confirm(`Restore to version ${version.versionNumber}? This will overwrite the current content.`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/versions/${version._id}/restore`,
        {},
        {
        }
      )

      showToast('Version restored successfully!', 'success')
      onRestore?.()
    } catch (error) {
      showToast('Failed to restore version', 'error')
    }
  }

  if (loading) {
    return <LoadingSpinner size="sm" text="Loading version history..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <History size={20} className="text-purple-600" />
        <h3 className="text-lg font-semibold">Version History</h3>
      </div>

      {versions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No version history available</p>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version._id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">Version {version.versionNumber}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(version.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    by {version.changedBy.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedVersion(version)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg"
                    title="View version"
                  >
                    <Eye size={18} />
                  </button>
                  {version.versionNumber !== versions[0].versionNumber && (
                    <button
                      onClick={() => handleRestore(version)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg"
                      title="Restore version"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                </div>
              </div>
              {version.changes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {version.changes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Version {selectedVersion.versionNumber}
              </h3>
              <button
                onClick={() => setSelectedVersion(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(selectedVersion.contentSnapshot, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
