'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react'

interface ResizableTimelineProps {
  children: React.ReactNode
  minHeight?: number
  maxHeight?: number
  defaultHeight?: number
  onHeightChange?: (height: number) => void
}

export default function ResizableTimeline({ 
  children, 
  minHeight = 200, 
  maxHeight = 600,
  defaultHeight = 300,
  onHeightChange
}: ResizableTimelineProps) {
  const [height, setHeight] = useState(() => {
    // Try to restore from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('timeline-height')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (parsed >= minHeight && parsed <= maxHeight) {
          return parsed
        }
      }
    }
    return defaultHeight
  })
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const previousHeightRef = useRef(height)
  const resizeRef = useRef<HTMLDivElement>(null)

  const updateHeight = useCallback((newHeight: number) => {
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
    setHeight(clampedHeight)
    if (onHeightChange) {
      onHeightChange(clampedHeight)
    }
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('timeline-height', clampedHeight.toString())
    }
  }, [minHeight, maxHeight, onHeightChange])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newHeight = window.innerHeight - e.clientY
      updateHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isResizing) {
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, updateHeight])

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore previous height
      updateHeight(previousHeightRef.current)
      setIsMaximized(false)
    } else {
      // Save current height and maximize
      previousHeightRef.current = height
      updateHeight(maxHeight)
      setIsMaximized(true)
    }
  }, [isMaximized, height, maxHeight, updateHeight])

  const currentHeight = isMaximized ? maxHeight : height

  return (
    <div className="relative flex flex-col group" style={{ height: `${currentHeight}px` }}>
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
        className="absolute top-0 left-0 right-0 h-2 bg-gray-700 hover:bg-blue-500 cursor-ns-resize z-10 transition-all duration-200 flex items-center justify-center"
        style={{ cursor: isResizing ? 'ns-resize' : 'row-resize' }}
      >
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-300" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleMaximize()
            }}
            className="p-1 hover:bg-gray-600 rounded transition-colors"
            title={isMaximized ? 'Restore timeline size' : 'Maximize timeline'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3 h-3 text-gray-300" />
            ) : (
              <Maximize2 className="w-3 h-3 text-gray-300" />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden" style={{ marginTop: '8px' }}>
        {children}
      </div>
    </div>
  )
}
