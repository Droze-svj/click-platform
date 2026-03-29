'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo)
    
    // Telemetry capture: Send to Global Error Logger
    try {
      fetch('/api/health/error-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.name,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: typeof window !== 'undefined' ? window.location.href : 'SSR',
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        })
      }).catch(err => console.error('Failed to dispatch telemetry:', err))
    } catch (e) {
      console.error('Telemetry dispatch crash:', e)
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 max-w-lg mx-auto overflow-hidden">
          <h2 className="text-xl font-black mb-2 uppercase tracking-widest">Neural UI Exception</h2>
          <p className="text-sm text-center mb-4 opacity-80">
            A fatal error occurred in the component tree.
          </p>
          <pre className="p-4 bg-black/50 rounded-xl text-[10px] w-full overflow-auto whitespace-pre-wrap font-mono text-rose-300 border border-rose-500/10">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-6 px-6 py-2 rounded-xl bg-rose-500 text-white font-bold uppercase tracking-wider text-xs hover:bg-rose-400 transition-colors"
          >
            Attempt Recovery
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
