'use client'

import { useState } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface DiffItem {
  type: 'added' | 'removed' | 'unchanged' | 'modified'
  value: string
  index: number
}

interface ContentComparisonProps {
  original: string
  edited: string
  onClose?: () => void
}

export default function ContentComparison({ original, edited, onClose }: ContentComparisonProps) {
  const [comparison, setComparison] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const compare = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/ai/compare`,
        { original, edited },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setComparison(res.data.data)
      }
    } catch (error) {
      console.error('Error comparing content', error)
    } finally {
      setLoading(false)
    }
  }

  const getDiffColor = (type: string) => {
    switch (type) {
      case 'added': return 'bg-green-100 text-green-800'
      case 'removed': return 'bg-red-100 text-red-800 line-through'
      case 'modified': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-white'
    }
  }

  if (!comparison && !loading) {
    return (
      <div className="p-4">
        <button
          onClick={compare}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Compare Content
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!comparison) return null

  return (
    <div className="p-6">
      {onClose && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Content Comparison</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Added</div>
          <div className="text-2xl font-bold text-green-600">{comparison.changes.added}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Removed</div>
          <div className="text-2xl font-bold text-red-600">{comparison.changes.removed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Modified</div>
          <div className="text-2xl font-bold text-yellow-600">{comparison.changes.modified}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Similarity</div>
          <div className="text-2xl font-bold text-blue-600">{comparison.similarity}%</div>
        </div>
      </div>

      {/* Side-by-Side View */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Original</h3>
          <div className="space-y-1">
            {comparison.diff.map((item: DiffItem, i: number) => (
              <span
                key={i}
                className={item.type === 'removed' || item.type === 'modified' ? getDiffColor(item.type) : ''}
              >
                {item.value}{' '}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Edited</h3>
          <div className="space-y-1">
            {comparison.diff.map((item: DiffItem, i: number) => (
              <span
                key={i}
                className={item.type === 'added' || item.type === 'modified' ? getDiffColor(item.type) : ''}
              >
                {item.value}{' '}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
