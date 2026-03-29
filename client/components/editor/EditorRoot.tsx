import "./styles/layout-autofit.css";
import "./styles/layout-autofit.css";
'use client'

import React from 'react'

interface EditorRootProps {
  className?: string
  reduceMotion?: boolean
  children: React.ReactNode
}

export default function EditorRoot({ className, reduceMotion, children }: EditorRootProps) {
  return (
    <div className={className} data-reduce-motion={reduceMotion}>
      {children}
    </div>
  )
}
