'use client'

import { useState, useCallback, useRef } from 'react'

interface HistoryState<T> {
  state: T
  timestamp: number
}

/**
 * Hook for undo/redo functionality
 */
export function useUndoRedo<T>(initialState: T) {
  const [currentState, setCurrentState] = useState<T>(initialState)
  const [history, setHistory] = useState<HistoryState<T>[]>([{ state: initialState, timestamp: Date.now() }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const maxHistorySize = useRef(50)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const updateState = useCallback((newState: T) => {
    setCurrentState(newState)
    
    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1)
    
    // Add new state to history
    const updatedHistory = [
      ...newHistory,
      { state: newState, timestamp: Date.now() }
    ]

    // Limit history size
    if (updatedHistory.length > maxHistorySize.current) {
      updatedHistory.shift()
    } else {
      setHistoryIndex(updatedHistory.length - 1)
    }

    setHistory(updatedHistory)
  }, [history, historyIndex])

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCurrentState(history[newIndex].state)
      return history[newIndex].state
    }
    return currentState
  }, [canUndo, historyIndex, history, currentState])

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setCurrentState(history[newIndex].state)
      return history[newIndex].state
    }
    return currentState
  }, [canRedo, historyIndex, history, currentState])

  const reset = useCallback((newState?: T) => {
    const state = newState ?? initialState
    setCurrentState(state)
    setHistory([{ state, timestamp: Date.now() }])
    setHistoryIndex(0)
  }, [initialState])

  const clearHistory = useCallback(() => {
    setHistory([{ state: currentState, timestamp: Date.now() }])
    setHistoryIndex(0)
  }, [currentState])

  return {
    state: currentState,
    updateState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearHistory,
    historySize: history.length,
    historyIndex
  }
}




