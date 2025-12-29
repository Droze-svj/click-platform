'use client'

import { useState } from 'react'
import { Plus, X, GripVertical, Image, Video, FileText, Music } from 'lucide-react'

interface ContentBlock {
  id: string
  type: 'text' | 'image' | 'video' | 'quote' | 'hashtags'
  content: string
  order: number
}

interface DragDropContentBuilderProps {
  onContentChange?: (blocks: ContentBlock[]) => void
  initialBlocks?: ContentBlock[]
}

export default function DragDropContentBuilder({ 
  onContentChange, 
  initialBlocks = [] 
}: DragDropContentBuilderProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks)
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null)

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      content: '',
      order: blocks.length
    }
    const updated = [...blocks, newBlock]
    setBlocks(updated)
    onContentChange?.(updated)
  }

  const removeBlock = (id: string) => {
    const updated = blocks.filter(b => b.id !== id).map((b, idx) => ({ ...b, order: idx }))
    setBlocks(updated)
    onContentChange?.(updated)
  }

  const updateBlock = (id: string, content: string) => {
    const updated = blocks.map(b => b.id === id ? { ...b, content } : b)
    setBlocks(updated)
    onContentChange?.(updated)
  }

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const updated = [...blocks]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    const reordered = updated.map((b, idx) => ({ ...b, order: idx }))
    setBlocks(reordered)
    onContentChange?.(reordered)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBlock(blocks[index].id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedBlock === null) return

    const dragIndex = blocks.findIndex(b => b.id === draggedBlock)
    if (dragIndex !== dropIndex) {
      moveBlock(dragIndex, dropIndex)
    }
    setDraggedBlock(null)
  }

  const getBlockIcon = (type: ContentBlock['type']) => {
    switch (type) {
      case 'text':
        return <FileText className="w-4 h-4" />
      case 'image':
        return <Image className="w-4 h-4" />
      case 'video':
        return <Video className="w-4 h-4" />
      case 'quote':
        return <FileText className="w-4 h-4" />
      case 'hashtags':
        return <FileText className="w-4 h-4" />
      default:
        return null
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Content Builder
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => addBlock('text')}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Text
          </button>
          <button
            onClick={() => addBlock('image')}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Image
          </button>
          <button
            onClick={() => addBlock('hashtags')}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Hashtags
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>Click the buttons above to add content blocks</p>
            <p className="text-sm mt-2">Drag blocks to reorder them</p>
          </div>
        ) : (
          blocks.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-move bg-gray-50 dark:bg-gray-900"
            >
              <div className="mt-1 text-gray-400">
                <GripVertical className="w-5 h-5" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getBlockIcon(block.type)}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {block.type}
                  </span>
                  <button
                    onClick={() => removeBlock(block.id)}
                    className="ml-auto p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {block.type === 'text' || block.type === 'quote' ? (
                  <textarea
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, e.target.value)}
                    placeholder={`Enter ${block.type}...`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                    rows={block.type === 'quote' ? 3 : 4}
                  />
                ) : block.type === 'hashtags' ? (
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, e.target.value)}
                    placeholder="Enter hashtags (e.g., #marketing #socialmedia)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept={block.type === 'image' ? 'image/*' : 'video/*'}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          updateBlock(block.id, file.name)
                        }
                      }}
                      className="hidden"
                      id={`file-${block.id}`}
                    />
                    <label
                      htmlFor={`file-${block.id}`}
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      {block.type === 'image' ? (
                        <Image className="w-8 h-8 text-gray-400" />
                      ) : (
                        <Video className="w-8 h-8 text-gray-400" />
                      )}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Click to upload {block.type}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}


