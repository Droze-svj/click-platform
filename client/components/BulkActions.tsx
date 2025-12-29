'use client'

import { useState } from 'react'
import { Trash2, Tag, Folder, Download, Archive } from 'lucide-react'
import ConfirmationDialog from './ConfirmationDialog'

interface BulkActionsProps {
  selectedItems: string[]
  onDelete?: (ids: string[]) => void
  onTag?: (ids: string[]) => void
  onMove?: (ids: string[]) => void
  onExport?: (ids: string[]) => void
  onArchive?: (ids: string[]) => void
}

export default function BulkActions({
  selectedItems,
  onDelete,
  onTag,
  onMove,
  onExport,
  onArchive
}: BulkActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (selectedItems.length === 0) {
    return null
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(selectedItems)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            {onTag && (
              <button
                onClick={() => onTag(selectedItems)}
                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                title="Add tags"
              >
                <Tag size={18} />
              </button>
            )}
            {onMove && (
              <button
                onClick={() => onMove(selectedItems)}
                className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900 rounded-lg transition-colors"
                title="Move to folder"
              >
                <Folder size={18} />
              </button>
            )}
            {onExport && (
              <button
                onClick={() => onExport(selectedItems)}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                title="Export"
              >
                <Download size={18} />
              </button>
            )}
            {onArchive && (
              <button
                onClick={() => onArchive(selectedItems)}
                className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900 rounded-lg transition-colors"
                title="Archive"
              >
                <Archive size={18} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        title="Delete Items"
        message={`Are you sure you want to delete ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
        onConfirm={handleDelete}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}







