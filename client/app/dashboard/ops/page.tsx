'use client'

/**
 * /dashboard/ops — Autonomous Operations.
 *
 * Ten HUDs that were fully built, each reading a live endpoint, and imported by
 * nothing. They were written as editor views, but none of them takes editor
 * state — they are account-level operational readouts, and the video editor was
 * deliberately trimmed from 16 tools to 10 for usability, so adding ten more
 * categories there would undo that.
 *
 * They belong together: one page, one tab each, each bounded on its own so a
 * failing readout cannot blank its neighbours.
 *
 *   Fleet            /api/phase10_12/fleet/status, /fleet/verify-network
 *   Network          /api/click/network-health
 *   Arbitrage        /api/phase10_12/arbitrage/manifest
 *   Culture          /api/click/arbitrage-triggers, /resurrection-candidates
 *   Fiscal           /api/click/fiscal-velocity
 *   Forecast         /api/click/forecast
 *   Consensus        /api/click/syndicate-consensus
 *   Compliance       /api/click/compliance-audit
 *   Expert DNA       /api/phase16_18/dna/mine
 *   Oracle sandbox   /api/phase9/oracle-sandbox/deploy
 *   Omnipresence     /api/phase9/swarm/pulse, /autonomic-cm/*, /phase10_12/intelligence/pulse
 */

import { useState } from 'react'
import {
  Server, Activity, TrendingUp, Globe2, DollarSign, LineChart,
  Users, ShieldCheck, Fingerprint, FlaskConical, Radio, type LucideIcon,
} from 'lucide-react'

import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { PageShell, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui'

import { FleetControlHUD } from '../../../components/editor/views/FleetControlHUD'
import { NetworkStatusHUD } from '../../../components/editor/views/NetworkStatusHUD'
import { ArbitrageSteererView } from '../../../components/editor/views/ArbitrageSteererView'
import { CulturalArbitrageHUD } from '../../../components/editor/views/CulturalArbitrageHUD'
import { FiscalAutonomyHUD } from '../../../components/editor/views/FiscalAutonomyHUD'
import { SpectralForecastHUD } from '../../../components/editor/views/SpectralForecastHUD'
import { SyndicateConsensusView } from '../../../components/editor/views/SyndicateConsensusView'
import { RegionalComplianceView } from '../../../components/editor/views/RegionalComplianceView'
import { ExpertDNAView } from '../../../components/editor/views/ExpertDNAView'
import { OracleSandboxHUD } from '../../../components/editor/OracleSandboxHUD'
import OmnipresenceNetworkView from '../../../components/editor/views/OmnipresenceNetworkView'

export default function AutonomousOpsPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [tab, setTab] = useState('fleet')

  // OracleSandboxHUD is the only one that needs anything from its host.
  const TABS: { id: string; label: string; icon: LucideIcon; node: React.ReactNode }[] = [
    { id: 'fleet', label: t('opsPage.fleet'), icon: Server, node: <FleetControlHUD /> },
    { id: 'network', label: t('opsPage.network'), icon: Activity, node: <NetworkStatusHUD /> },
    { id: 'arbitrage', label: t('opsPage.arbitrage'), icon: TrendingUp, node: <ArbitrageSteererView /> },
    { id: 'culture', label: t('opsPage.culture'), icon: Globe2, node: <CulturalArbitrageHUD /> },
    { id: 'fiscal', label: t('opsPage.fiscal'), icon: DollarSign, node: <FiscalAutonomyHUD /> },
    { id: 'forecast', label: t('opsPage.forecast'), icon: LineChart, node: <SpectralForecastHUD /> },
    { id: 'consensus', label: t('opsPage.consensus'), icon: Users, node: <SyndicateConsensusView /> },
    { id: 'compliance', label: t('opsPage.compliance'), icon: ShieldCheck, node: <RegionalComplianceView /> },
    { id: 'dna', label: t('opsPage.expertDna'), icon: Fingerprint, node: <ExpertDNAView /> },
    { id: 'oracle', label: t('opsPage.oracle'), icon: FlaskConical, node: <OracleSandboxHUD showToast={showToast} /> },
    // videoId is optional here — the swarm/autonomic readouts are account-level.
    { id: 'omnipresence', label: t('opsPage.omnipresence'), icon: Radio, node: <OmnipresenceNetworkView showToast={showToast} /> },
  ]

  return (
    <PageShell width="wide">
      <PageHeader
        as="h2"
        title={t('opsPage.title')}
        description={t('opsPage.description')}
      />

      <Tabs value={tab} onValueChange={setTab}>
        {/* Ten tabs: allow the list to wrap rather than overflow off-screen on
            narrow viewports. */}
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-1.5">
              <Icon size={14} aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ id, node }) => (
          <TabsContent key={id} value={id} className="mt-6">
            {/* Each readout hits a different backend; one being unavailable must
                not take the whole page down. */}
            <ErrorBoundary>{node}</ErrorBoundary>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  )
}
