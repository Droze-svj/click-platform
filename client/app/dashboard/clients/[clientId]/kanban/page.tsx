'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import ApprovalKanbanBoard from '../../../../../components/ApprovalKanbanBoard'
import { useTranslation } from '@/hooks/useTranslation'

export default function ClientKanbanPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const clientId = params.clientId as string
  const agencyWorkspaceId = searchParams.get('agencyWorkspaceId') || ''

  if (!agencyWorkspaceId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">{t('clientKanbanPage.workspaceIdRequired')}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('clientKanbanPage.title')}</h1>
        <p className="text-gray-600 mt-2">{t('clientKanbanPage.subtitle')}</p>
      </div>
      <ApprovalKanbanBoard
        clientWorkspaceId={clientId}
        agencyWorkspaceId={agencyWorkspaceId}
      />
    </div>
  )
}

