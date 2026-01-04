'use client'

import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface BatchOperationsProps {
  selectedItems: string[]
  type: 'content' | 'scripts'
  onComplete: () => void
}

export default function BatchOperations({ selectedItems, type, onComplete }: BatchOperationsProps) {
  const { showToast } = useToast()
  const [operation, setOperation] = useState<'delete' | 'export' | null>(null)
  const [loading, setLoading] = useState(false)

  if (selectedItems.length === 0) {
    return null
  }

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) {
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = type === 'content' 
        ? `${API_URL}/batch/delete-content`
        : `${API_URL}/batch/delete-scripts`
      const body = type === 'content'
        ? { contentIds: selectedItems }
        : { scriptIds: selectedItems }
      
      await axios.post(
        endpoint,
        body,
        {
        }
      )
      showToast(`Deleted ${selectedItems.length} items successfully`, 'success')
      onComplete()
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete items', 'error')
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBatchExport = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/export/bulk`,
        { type, ids: selectedItems },
        {
          responseType: 'blob'
        }
      )

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showToast(`Exported ${selectedItems.length} items successfully`, 'success')
      onComplete()
    } catch (error: any) {
      showToast('Failed to export items', 'error')
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOperation('export')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              Export
            </button>
            <button
              onClick={() => setOperation('delete')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Delete
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>

        {operation === 'delete' && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800 mb-2">
              Are you sure you want to delete {selectedItems.length} items? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleBatchDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => setOperation(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {operation === 'export' && loading && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Exporting...
          </div>
        )}
      </div>
    </div>
  )
}

