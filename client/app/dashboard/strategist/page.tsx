'use client'

import { Sparkles, Compass, BrainCircuit } from 'lucide-react'
import MarketingStrategistChat from '../../../components/MarketingStrategistChat'
import NicheStrategyPanel from '../../../components/NicheStrategyPanel'
import HookVariantsCard from '../../../components/HookVariantsCard'
import { useWorkflow } from '../../../contexts/WorkflowContext'
import { useTranslation } from '@/hooks/useTranslation'
import { Panel, SectionHeader, Badge } from '../../../components/ui'

export default function StrategistPage() {
  const { state, setNiche } = useWorkflow()
  const { t } = useTranslation()
  const niche = state.niche || 'general'
  const platform = state.platform || 'tiktok'

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1900px] mx-auto overflow-x-hidden text-theme-primary">
      <SectionHeader
        as="h1"
        title={t('strategistPage.title')}
        description={t('strategistPage.subtitle')}
        className="mb-6"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 capitalize">
              <Sparkles size={13} aria-hidden /> {niche}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 capitalize">
              <Compass size={13} aria-hidden /> {platform}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <Panel variant="bento" className="overflow-hidden">
            <h2 className="ds-text-label text-theme-secondary flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-primary" aria-hidden /> {t('strategistPage.nicheIntelligence')}
            </h2>
            <NicheStrategyPanel currentNiche={niche} currentPlatform={platform} onNicheChange={setNiche} />
          </Panel>
          <Panel variant="bento" className="overflow-hidden p-0">
            <HookVariantsCard niche={niche} platform={platform} />
          </Panel>
        </div>

        <div className="xl:col-span-8 min-h-[700px]">
          <Panel variant="bento" className="h-full flex flex-col overflow-hidden p-0">
            <header className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border-subtle)]">
              <h2 className="ds-text-label text-theme-secondary flex items-center gap-2">
                <BrainCircuit size={15} className="text-primary" aria-hidden /> {t('strategistPage.autonomousAgentChat')}
              </h2>
            </header>
            <div className="flex-1 p-4">
              <MarketingStrategistChat niche={niche} platforms={[platform]} className="h-full" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
