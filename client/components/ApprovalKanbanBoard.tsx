'use client'

import { useState, useEffect } from 'react'
// Note: Install react-beautiful-dnd or @dnd-kit/core for drag-and-drop
// For now, using click-based movement
// import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import axios from 'axios'
import { API_URL } from '@/lib/api'

interface KanbanCard {
  id: string
  contentId: string
  title: string
  type: string
  status: string
  priority: string
  assignee: string | null
  dueDate: string | null
  sla: {
    status: string
    hoursRemaining: number
  } | null
  createdAt: string
  currentStage: number
  stageName: string
}

interface KanbanColumn {
  id: string
  name: string
  order: number
  status: string
  color: string
  cards: KanbanCard[]
  count: number
}

interface KanbanBoard {
  board: {
    columns: KanbanColumn[]
  }
  summary: {
    total: number
    byStatus: Record<string, number>
    overdue: number
    atRisk: number
  }
}

interface ApprovalKanbanBoardProps {
  clientWorkspaceId: string
  agencyWorkspaceId: string
}

export default function ApprovalKanbanBoard({ clientWorkspaceId, agencyWorkspaceId }: ApprovalKanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)

  useEffect(() => {
    loadBoard()
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadBoard, 30000)
    return () => clearInterval(interval)
  }, [clientWorkspaceId, agencyWorkspaceId])

  const loadBoard = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await axios.get(
        `${API_URL}/clients/${clientWorkspaceId}/kanban?agencyWorkspaceId=${agencyWorkspaceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.data.success) {
        setBoard(res.data.data)
      }
    } catch (error) {
      console.error('Error loading Kanban board', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMoveCard = async (cardId: string, fromColumnId: string, toColumnId: string) => {
    if (fromColumnId === toColumnId || !board) return

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        `${API_URL}/clients/${clientWorkspaceId}/kanban/move`,
        {
          cardId,
          fromColumnId,
          toColumnId,
          agencyWorkspaceId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Reload to get fresh data
      await loadBoard()
    } catch (error) {
      console.error('Error moving card', error)
      await loadBoard() // Reload on error
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getSLAColor = (sla: { status: string } | null) => {
    if (!sla) return ''
    switch (sla.status) {
      case 'overdue': return 'text-red-600 font-semibold'
      case 'at_risk': return 'text-orange-600 font-semibold'
      case 'on_time': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!board) {
    return <div className="p-8 text-center text-gray-500">No board data available</div>
  }

  return (
    <div className="p-6">
      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold">{board.summary.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Overdue</div>
          <div className="text-2xl font-bold text-red-600">{board.summary.overdue}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">At Risk</div>
          <div className="text-2xl font-bold text-orange-600">{board.summary.atRisk}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">With Client</div>
          <div className="text-2xl font-bold text-blue-600">{board.summary.byStatus.with_client || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Approved</div>
          <div className="text-2xl font-bold text-green-600">{board.summary.byStatus.approved || 0}</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.board.columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4"
          >
            <div
              className="flex items-center justify-between mb-4"
              style={{ borderLeft: `4px solid ${column.color}` }}
            >
              <h3 className="font-semibold text-lg px-3">{column.name}</h3>
              <span className="bg-white rounded-full px-3 py-1 text-sm font-medium">
                {column.count}
              </span>
            </div>

            <div className="min-h-[400px] space-y-3">
              {column.cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm flex-1">{card.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(card.priority)}`}>
                      {card.priority}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mb-2">
                    {card.stageName}
                  </div>

                  {card.sla && (
                    <div className={`text-xs mb-2 ${getSLAColor(card.sla)}`}>
                      {card.sla.status === 'overdue' && '⚠️ Overdue'}
                      {card.sla.status === 'at_risk' && `⚠️ ${Math.round(card.sla.hoursRemaining)}h left`}
                      {card.sla.status === 'on_time' && `✓ ${Math.round(card.sla.hoursRemaining)}h left`}
                    </div>
                  )}

                  {card.dueDate && (
                    <div className="text-xs text-gray-500">
                      Due: {new Date(card.dueDate).toLocaleDateString()}
                    </div>
                  )}

                  {/* Move buttons */}
                  <div className="mt-3 flex gap-2">
                    {board.board.columns
                      .filter(c => c.id !== column.id)
                      .slice(0, 2)
                      .map(targetCol => (
                        <button
                          key={targetCol.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMoveCard(card.id, column.id, targetCol.id)
                          }}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                        >
                          → {targetCol.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{selectedCard.title}</h2>
              <button
                onClick={() => setSelectedCard(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">{selectedCard.stageName}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Priority</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs border ${getPriorityColor(selectedCard.priority)}`}>
                    {selectedCard.priority}
                  </span>
                </div>
              </div>
              {selectedCard.sla && (
                <div>
                  <label className="text-sm font-medium text-gray-700">SLA Status</label>
                  <div className={`mt-1 ${getSLAColor(selectedCard.sla)}`}>
                    {selectedCard.sla.status === 'overdue' && '⚠️ Overdue'}
                    {selectedCard.sla.status === 'at_risk' && `⚠️ At Risk - ${Math.round(selectedCard.sla.hoursRemaining)} hours remaining`}
                    {selectedCard.sla.status === 'on_time' && `✓ On Time - ${Math.round(selectedCard.sla.hoursRemaining)} hours remaining`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

