'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface VersionComparisonProps {
  entityId: string
  entityType?: 'content' | 'post'
  version1: number
  version2: number
  onClose?: () => void
}

export default function VersionComparison({
  entityId,
  entityType = 'content',
  version1,
  version2,
  onClose
}: VersionComparisonProps) {
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exportFormat, setExportFormat] = useState<'json' | 'html' | 'pdf'>('json')

  useEffect(() => {
    loadComparison()
  }, [entityId, version1, version2])

  const loadComparison = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/versions/${entityId}/compare?version1=${version1}&version2=${version2}&entityType=${entityType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setComparison(res.data.data)
      }
    } catch (error) {
      console.error('Error loading comparison', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/versions/${entityId}/compare/export?version1=${version1}&version2=${version2}&entityType=${entityType}&format=${exportFormat}`,
        {
          responseType: exportFormat === 'json' ? 'blob' : 'text'
        }
      )

      if (exportFormat === 'json') {
        const blob = new Blob([res.data], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `version-comparison-${version1}-${version2}.json`
        a.click()
      } else if (exportFormat === 'html') {
        const blob = new Blob([res.data], { type: 'text/html' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `version-comparison-${version1}-${version2}.html`
        a.click()
      }
    } catch (error) {
      console.error('Error exporting comparison', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!comparison) {
    return <div className="p-8 text-center text-gray-500">No comparison data available</div>
  }

  return (
    <div className="p-6">
      {onClose && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Version Comparison</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Version Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Version {comparison.version1.number}</div>
          <div className="font-semibold mt-1">
            {new Date(comparison.version1.createdAt).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {comparison.version1.changeReason || 'No reason provided'}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Version {comparison.version2.number}</div>
          <div className="font-semibold mt-1">
            {new Date(comparison.version2.createdAt).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {comparison.version2.changeReason || 'No reason provided'}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-2">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Total Changes</div>
            <div className="text-xl font-bold">{comparison.summary.totalChanges}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Text Changed</div>
            <div className="text-xl font-bold">{comparison.summary.textChanged ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Hashtags Changed</div>
            <div className="text-xl font-bold">{comparison.summary.hashtagsChanged ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Media Changed</div>
            <div className="text-xl font-bold">{comparison.summary.mediaChanged ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Text Comparison */}
      {comparison.differences.text.changed && (
        <div className="mb-6">
          <h3 className="font-semibold mb-4">Text Differences</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm font-semibold mb-2 text-red-800">Version {comparison.version1.number} (Old)</div>
              <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border border-red-200">
                {comparison.differences.text.oldValue}
              </pre>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm font-semibold mb-2 text-green-800">Version {comparison.version2.number} (New)</div>
              <pre className="text-sm whitespace-pre-wrap bg-white p-3 rounded border border-green-200">
                {comparison.differences.text.newValue}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Hashtag Changes */}
      {comparison.differences.hashtags.added.length > 0 || comparison.differences.hashtags.removed.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold mb-4">Hashtag Changes</h3>
          <div className="grid grid-cols-2 gap-4">
            {comparison.differences.hashtags.removed.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2 text-red-800">Removed</div>
                <div className="flex flex-wrap gap-2">
                  {comparison.differences.hashtags.removed.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                      -{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {comparison.differences.hashtags.added.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2 text-green-800">Added</div>
                <div className="flex flex-wrap gap-2">
                  {comparison.differences.hashtags.added.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      +{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Export for Legal/Compliance</h3>
        <div className="flex gap-4 items-center">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'html' | 'pdf')}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            onClick={handleExport}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}


