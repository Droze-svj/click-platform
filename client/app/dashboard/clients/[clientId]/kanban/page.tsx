'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import ApprovalKanbanBoard from '../../../../../components/ApprovalKanbanBoard'

export default function ClientKanbanPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const clientId = params.clientId as string
  const agencyWorkspaceId = searchParams.get('agencyWorkspaceId') || ''

  if (!agencyWorkspaceId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Agency workspace ID required. Add ?agencyWorkspaceId=xxx to URL</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Approval Kanban Board</h1>
        <p className="text-gray-600 mt-2">Drag and drop cards to move between stages</p>
      </div>
      <ApprovalKanbanBoard
        clientWorkspaceId={clientId}
        agencyWorkspaceId={agencyWorkspaceId}
      />
    </div>
  )
}

