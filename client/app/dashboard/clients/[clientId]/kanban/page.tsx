'use client'

import { useParams, useSearchParams } from 'next/navigation'
import ApprovalKanbanBoard from '../../../../../components/ApprovalKanbanBoard'
import { SectionHeader, EmptyState } from '@/components/ui'
import { LayoutGrid } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function ClientKanbanPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const clientId = params.clientId as string
  const agencyWorkspaceId = searchParams.get('agencyWorkspaceId') || ''

  if (!agencyWorkspaceId) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto">
        <EmptyState
          icon={LayoutGrid}
          title={t('clientKanbanPage.workspaceIdRequired')}
          className="py-24"
        />
      </div>
    )
  }

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
      <SectionHeader
        as="h1"
        title={t('clientKanbanPage.title')}
        description={t('clientKanbanPage.subtitle')}
        className="mb-6"
      />
      <ApprovalKanbanBoard
        clientWorkspaceId={clientId}
        agencyWorkspaceId={agencyWorkspaceId}
      />
    </div>
  )
}
