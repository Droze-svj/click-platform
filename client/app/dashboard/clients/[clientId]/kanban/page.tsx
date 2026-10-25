'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import ApprovalKanbanBoard from '../../../../../components/ApprovalKanbanBoard'
import { SectionHeader, EmptyState,
  PageShell,
} from '@/components/ui'
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
      <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen">
        {/* Was "Agency workspace ID required. Add ?agencyWorkspaceId=xxx to URL" —
            a developer note shown to customers as the page title. */}
        <EmptyState
          icon={LayoutGrid}
          title={t('clientKanbanPage.noWorkspaceTitle')}
          description={t('clientKanbanPage.noWorkspaceBody')}
          action={
            <Link
              href="/dashboard/workspaces"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('clientKanbanPage.openWorkspaces')}
            </Link>
          }
          className="py-24"
        />
      </PageShell>
    )
  }

  return (
    <PageShell width="wide" className="ds-bg-mesh-soft min-h-screen overflow-x-hidden">
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
    </PageShell>
  )
}
