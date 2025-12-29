'use client'

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  className?: string
  animate?: boolean
}

export default function EnhancedSkeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  animate = true
}: SkeletonProps) {
  const baseClasses = `
    bg-gray-200 dark:bg-gray-700
    ${animate ? 'animate-pulse' : ''}
    ${className}
  `

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]}`}
      style={style}
      aria-hidden="true"
    />
  )
}

// Pre-built skeleton components
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      <EnhancedSkeleton variant="rounded" height={24} width="60%" />
      <EnhancedSkeleton variant="text" width="100%" />
      <EnhancedSkeleton variant="text" width="80%" />
      <div className="flex gap-2 mt-4">
        <EnhancedSkeleton variant="rounded" height={32} width={100} />
        <EnhancedSkeleton variant="rounded" height={32} width={100} />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <EnhancedSkeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <EnhancedSkeleton variant="text" width="40%" />
            <EnhancedSkeleton variant="text" width="60%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <EnhancedSkeleton key={i} variant="text" width="100%" height={20} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <EnhancedSkeleton key={colIndex} variant="text" width="100%" height={16} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonForm() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <EnhancedSkeleton variant="text" width={80} height={16} />
        <EnhancedSkeleton variant="rounded" height={40} width="100%" />
      </div>
      <div className="space-y-2">
        <EnhancedSkeleton variant="text" width={80} height={16} />
        <EnhancedSkeleton variant="rounded" height={120} width="100%" />
      </div>
      <EnhancedSkeleton variant="rounded" height={44} width={120} />
    </div>
  )
}




