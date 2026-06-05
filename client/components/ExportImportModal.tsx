'use client'

import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '@/hooks/useTranslation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'


interface ExportImportModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'content' | 'scripts' | 'posts'
  selectedIds?: string[]
}

export default function ExportImportModal({ isOpen, onClose, type, selectedIds = [] }: ExportImportModalProps) {
  const { showToast } = useToast()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  if (!isOpen) return null

  const handleExport = async () => {

    setExporting(true)
    try {
      const token = localStorage.getItem('token')

      if (selectedIds.length > 0) {
        // Bulk export

        const response = await axios.post(
          `${API_URL}/export/bulk`,
          { type, ids: selectedIds, format: exportFormat },
          {
            responseType: 'blob'
          }
        )

        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-export-${Date.now()}.${exportFormat}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        showToast(t('exportImportModal.exportedItems', { count: selectedIds.length }), 'success')
      } else {
        // Export all
        const response = await axios.get(
          `${API_URL}/export/${type}?format=${exportFormat}`,
          {
            responseType: 'blob'
          }
        )

        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-export-${Date.now()}.${exportFormat}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        showToast(t('exportImportModal.exportCompleted'), 'success')
      }
      onClose()
    } catch (error: any) {
      showToast(error.response?.data?.error || t('exportImportModal.exportFailed'), 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      showToast(t('exportImportModal.selectFile'), 'error')
      return
    }

    setImporting(true)
    try {
      const token = localStorage.getItem('token')
      const fileContent = await importFile.text()
      const data = JSON.parse(fileContent)

      if (!Array.isArray(data)) {
        showToast(t('exportImportModal.invalidFileFormat'), 'error')
        return
      }

      await axios.post(
        `${API_URL}/import/${type}`,
        { data },
        {
        }
      )

      showToast(t('exportImportModal.importedItems', { count: data.length }), 'success')
      setImportFile(null)
      onClose()
      // Refresh the page or trigger a reload
      window.location.reload()
    } catch (error: any) {
      if (error.response?.data?.error) {
        showToast(error.response.data.error, 'error')
      } else if (error instanceof SyntaxError) {
        showToast(t('exportImportModal.invalidJsonFile'), 'error')
      } else {
        showToast(t('exportImportModal.importFailed'), 'error')
      }
    } finally {
      setImporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setImportFile(file)
      } else {
        showToast(t('exportImportModal.selectJsonFile'), 'error')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{t('exportImportModal.title')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'export'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('exportImportModal.tabExport')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 font-medium ${
                activeTab === 'import'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('exportImportModal.tabImport')}
            </button>
          </div>

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('exportImportModal.format')}</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              {selectedIds.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {selectedIds.length === 1
                      ? t('exportImportModal.exportingSelectedItem', { count: selectedIds.length })
                      : t('exportImportModal.exportingSelectedItems', { count: selectedIds.length })}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? t('exportImportModal.exporting') : t('exportImportModal.exportButton')}
              </button>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('exportImportModal.selectJsonFileLabel')}</label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {importFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {t('exportImportModal.selectedFile', { name: importFile.name })}
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('exportImportModal.importWarning')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={!importFile || importing}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? t('exportImportModal.importing') : t('exportImportModal.importButton')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}







