'use client'

import { useState } from 'react'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface Variant {
  id: string
  content: string
  index: number
  description: string
}

interface AssistedEditorProps {
  content: string
  onContentChange?: (content: string) => void
}

export default function AssistedEditor({ content, onContentChange }: AssistedEditorProps) {
  const [variants, setVariants] = useState<Variant[]>([])
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingMode, setEditingMode] = useState<'variants' | 'improve' | 'tone' | 'hooks' | null>(null)
  const [improvedSection, setImprovedSection] = useState<string | null>(null)
  const [targetTone, setTargetTone] = useState<string>('professional')

  const generateVariants = async () => {
    setLoading(true)
    setEditingMode('variants')
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/ai/variants`,
        { content, count: 5 },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setVariants(res.data.data.variants)
      }
    } catch (error) {
      console.error('Error generating variants', error)
    } finally {
      setLoading(false)
    }
  }

  const improveHook = async () => {
    setLoading(true)
    setEditingMode('improve')
    try {
      const token = localStorage.getItem('token')
      const hook = content.split('.')[0] || content.substring(0, 100)
      const res = await axios.post(
        `${API_URL}/ai/improve`,
        {
          content,
          section: hook,
          options: { sectionType: 'hook', improvementType: 'enhance' }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setImprovedSection(res.data.data.improved)
      }
    } catch (error) {
      console.error('Error improving hook', error)
    } finally {
      setLoading(false)
    }
  }

  const rewriteForTone = async () => {
    setLoading(true)
    setEditingMode('tone')
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/ai/rewrite`,
        {
          content,
          tone: targetTone,
          options: { preserveLength: true }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        if (onContentChange) {
          onContentChange(res.data.data.rewritten)
        }
      }
    } catch (error) {
      console.error('Error rewriting for tone', error)
    } finally {
      setLoading(false)
    }
  }

  const generateHooks = async () => {
    setLoading(true)
    setEditingMode('hooks')
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${API_URL}/ai/hooks`,
        { content, count: 5 },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setVariants(res.data.data.variants)
      }
    } catch (error) {
      console.error('Error generating hooks', error)
    } finally {
      setLoading(false)
    }
  }

  const selectVariant = (variant: Variant) => {
    setSelectedVariant(variant.id)
    if (onContentChange) {
      onContentChange(variant.content)
    }
  }

  const applyImprovedSection = () => {
    if (improvedSection) {
      const hook = content.split('.')[0] || content.substring(0, 100)
      const newContent = content.replace(hook, improvedSection)
      if (onContentChange) {
        onContentChange(newContent)
      }
      setImprovedSection(null)
      setEditingMode(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={generateVariants}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && editingMode === 'variants' ? 'Generating...' : 'Generate 5 Variants'}
        </button>
        <button
          onClick={improveHook}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading && editingMode === 'improve' ? 'Improving...' : 'Improve Hook Only'}
        </button>
        <div className="flex gap-2">
          <select
            value={targetTone}
            onChange={(e) => setTargetTone(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="friendly">Friendly</option>
            <option value="humorous">Humorous</option>
            <option value="authoritative">Authoritative</option>
          </select>
          <button
            onClick={rewriteForTone}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading && editingMode === 'tone' ? 'Rewriting...' : 'Rewrite for Tone'}
          </button>
        </div>
        <button
          onClick={generateHooks}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {loading && editingMode === 'hooks' ? 'Generating...' : 'Generate Hook Variations'}
        </button>
      </div>

      {/* Variants Display */}
      {variants.length > 0 && editingMode === 'variants' && (
        <div className="space-y-3">
          <h3 className="font-semibold">Select a Variant:</h3>
          {variants.map((variant) => (
            <div
              key={variant.id}
              onClick={() => selectVariant(variant)}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                selectedVariant === variant.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium">Variant {variant.index}</span>
                <span className="text-sm text-gray-500">{variant.description}</span>
              </div>
              <p className="text-sm text-gray-700">{variant.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Improved Section Display */}
      {improvedSection && editingMode === 'improve' && (
        <div className="space-y-3">
          <h3 className="font-semibold">Improved Hook:</h3>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-gray-700 mb-3">{improvedSection}</p>
            <div className="flex gap-2">
              <button
                onClick={applyImprovedSection}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setImprovedSection(null)
                  setEditingMode(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hook Variations Display */}
      {variants.length > 0 && editingMode === 'hooks' && (
        <div className="space-y-3">
          <h3 className="font-semibold">Hook Variations:</h3>
          {variants.map((variant) => (
            <div
              key={variant.id}
              onClick={() => {
                if (onContentChange && 'fullContent' in variant) {
                  onContentChange((variant as any).fullContent)
                }
              }}
              className="p-4 border-2 rounded-lg cursor-pointer transition-colors border-gray-200 hover:border-gray-300"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium">Hook {variant.index}</span>
                <span className="text-sm text-gray-500">{variant.description}</span>
              </div>
              <p className="text-sm text-gray-700">{variant.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


