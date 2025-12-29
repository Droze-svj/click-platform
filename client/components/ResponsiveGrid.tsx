'use client'

import React from 'react'

interface ResponsiveGridProps {
  children: React.ReactNode
  cols?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

export default function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 6,
  className = ''
}: ResponsiveGridProps) {
  const gridCols = {
    sm: `grid-cols-${cols.sm || 1}`,
    md: `md:grid-cols-${cols.md || 2}`,
    lg: `lg:grid-cols-${cols.lg || 3}`,
    xl: `xl:grid-cols-${cols.xl || 4}`
  }

  return (
    <div
      className={`grid ${gridCols.sm} ${gridCols.md} ${gridCols.lg} ${gridCols.xl} gap-${gap} ${className}`}
    >
      {children}
    </div>
  )
}







